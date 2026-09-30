import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';

import { FirestoreService2 } from '../../services/firestore2';
import {
  collection,
  Firestore,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EmailService } from '../../services/email.service';
import { MessageService } from 'primeng/api';
import { TooltipModule } from 'primeng/tooltip';
import { environment } from '../../environments/environment';

type BranchKey = 'north' | 'south';

interface BranchFloorState {
  key: BranchKey;
  title: string;
  databaseName: string;

  service: FirestoreService2;
  db: Firestore;

  users: any[];
  availableUsers: any[];
  queue: any[];
  withCustomers: any[];

  currentShift: any | null;
  currentUser: any | null;

  visible: boolean;
  selectedUser: any | null;

  queueUnsub: () => void;
  shiftUnsub: () => void;
  withUnsub: () => void;

  isAssigningNext: boolean;
  isRefreshingQueue: boolean;
}

@Component({
  selector: 'app-live-floor-secondary',
  standalone: true,
  templateUrl: './live-floor-secondary.html',
  styleUrl: './live-floor-secondary.scss',
  imports: [
    DialogModule,
    ButtonModule,
    SelectModule,
    FormsModule,
    CommonModule,
    TooltipModule
  ],
  providers: [
    MessageService
  ],
})
export class LiveFloorSecondary implements OnInit, OnDestroy {

  private cdr = inject(ChangeDetectorRef);
  public router = inject(Router);
  private emailService = inject(EmailService);
  private messageService = inject(MessageService);

  isAdmin: boolean = JSON.parse(localStorage.getItem('userAdmin') || 'false');

  public env = environment.firebase.firestoreDb;
  

  private getEnvironmentSuffix(): string {
    if (this.env?.includes('qa')) {
      return 'qa';
    }

    if (this.env?.includes('prod')) {
      return 'prod';
    }

    // fallback por si viene vacío o sin valor válido
    return 'qa';
  }

  branches: BranchFloorState[] = [
    this.createBranch(
      'north',
      'TY North',
      `sfc-db-ty-north-${this.getEnvironmentSuffix()}`
    ),

    this.createBranch(
      'south',
      'TY South',
      `sfc-db-ty-south-${this.getEnvironmentSuffix()}`
    ),
  ];

  private isDestroyed = false;

  private createBranch(
    key: BranchKey,
    title: string,
    databaseName: string
  ): BranchFloorState {
    const service = new FirestoreService2();
    service.setDatabase(databaseName);

    return {
      key,
      title,
      databaseName,

      service,
      db: service.getDatabase(),

      users: [],
      availableUsers: [],
      queue: [],
      withCustomers: [],

      currentShift: null,
      currentUser: null,

      visible: false,
      selectedUser: null,

      queueUnsub: () => { },
      shiftUnsub: () => { },
      withUnsub: () => { },

      isAssigningNext: false,
      isRefreshingQueue: false,
    };
  }

  async ngOnInit() {
    console.log('LiveFloorSecondary initialized with env:', this.env);
    for (const branch of this.branches) {
      await this.initBranch(branch);
      this.initRealtime(branch);
    }
  }

  async initBranch(branch: BranchFloorState) {
    branch.users = await branch.service.getUsuarios();
    await this.refreshBranchState(branch);
  }

  initRealtime(branch: BranchFloorState) {
    branch.queueUnsub = onSnapshot(
      query(collection(branch.db, 'queue'), orderBy('request_time', 'asc')),
      async () => {
        await this.updateQueue(branch);
      }
    );

    branch.shiftUnsub = onSnapshot(
      collection(branch.db, 'sales_floor_active'),
      async () => {
        await this.loadActiveShift(branch);
        await this.updateQueue(branch);
      }
    );

    branch.withUnsub = onSnapshot(
      collection(branch.db, 'with_customer'),
      async () => {
        await this.updateWithCustomers(branch);
      }
    );
  }

  async refreshBranchState(branch: BranchFloorState) {
    await this.loadActiveShift(branch);
    await this.updateWithCustomers(branch);
    await this.updateQueue(branch);

    this.updateAvailableUsers(branch);
    this.cdr.detectChanges();
  }

  async updateQueue(branch: BranchFloorState, force: boolean = false) {
    if (branch.isRefreshingQueue && !force) return;

    branch.isRefreshingQueue = true;

    try {
      branch.queue = await branch.service.getQueueUsers();

      if (!branch.currentShift && branch.queue.length > 0) {
        await this.autoAssignNext(branch);
        branch.queue = await branch.service.getQueueUsers();
      }

      await this.processQueueEmails(branch);

      this.updateAvailableUsers(branch);

      branch.queue = [...branch.queue];

      this.cdr.detectChanges();
    } catch (err) {
      console.error(`[${branch.title}] Error updating queue:`, err);
    } finally {
      branch.isRefreshingQueue = false;
    }
  }

  async updateWithCustomers(branch: BranchFloorState) {
    try {
      branch.withCustomers = await branch.service.getWithCustomers();
      this.updateAvailableUsers(branch);
      this.cdr.detectChanges();
    } catch (err) {
      console.error(`[${branch.title}] Error updating with customer:`, err);
    }
  }

  async loadActiveShift(branch: BranchFloorState) {
    try {
      const shift = await branch.service.getActiveShift();

      if (!shift) {
        branch.currentShift = null;
        branch.currentUser = null;

        this.updateAvailableUsers(branch);
        this.cdr.detectChanges();
        return;
      }

      branch.currentShift = shift;
      branch.currentUser =
        branch.users.find(u => u.id === shift.salesperson_id) || null;

      this.updateAvailableUsers(branch);
      this.cdr.detectChanges();
    } catch (err) {
      console.error(`[${branch.title}] Error loading active shift:`, err);
    }
  }

  async autoAssignNext(branch: BranchFloorState) {
    if (branch.isAssigningNext) return;
    if (branch.currentShift) return;
    if (branch.queue.length === 0) return;

    branch.isAssigningNext = true;

    try {
      const freshShift = await branch.service.getActiveShift();

      if (freshShift) {
        branch.currentShift = freshShift;
        branch.currentUser =
          branch.users.find(u => u.id === freshShift.salesperson_id) || null;

        this.updateAvailableUsers(branch);
        return;
      }

      const freshQueue = await branch.service.getQueueUsers();
      branch.queue = freshQueue;

      const firstUser = branch.queue[0];

      if (!firstUser) return;

      const shift = await branch.service.startShift(firstUser.id);

      branch.currentShift = shift;
      branch.currentUser =
        branch.users.find(u => u.id === shift.salesperson_id) || firstUser;

      branch.queue = await branch.service.getQueueUsers();

      this.updateAvailableUsers(branch);
      this.cdr.detectChanges();
    } catch (err) {
      console.error(`[${branch.title}] Error assigning next user:`, err);
    } finally {
      branch.isAssigningNext = false;
    }
  }

  async sendToCustomer(branch: BranchFloorState) {
    if (!branch.currentUser || !branch.currentShift) return;

    try {
      await branch.service.moveFloorToWithCustomer(
        branch.currentUser.id,
        branch.currentShift.id
      );

      branch.currentShift = null;
      branch.currentUser = null;

      await this.refreshBranchState(branch);

      if (!branch.currentShift && branch.queue.length > 0) {
        await this.autoAssignNext(branch);
        await this.refreshBranchState(branch);
      }
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: String(err)
      });

      console.error(`[${branch.title}] Error moving floor user to with customer:`, err);
      await this.refreshBranchState(branch);
    }
  }

  async finishCustomer(branch: BranchFloorState, entry: any) {
    try {
      await branch.service.moveWithCustomerToQueue(
        entry.salesperson_id,
        entry.id
      );

      await this.refreshBranchState(branch);
    } catch (err) {
      console.error(`[${branch.title}] Error finishing customer:`, err);
    }
  }

  async sendQueueToCustomer(branch: BranchFloorState, user: any) {
    try {
      await branch.service.moveQueueToWithCustomer(
        user.id,
        user.queueId
      );

      await this.refreshBranchState(branch);
    } catch (err) {
      console.error(`[${branch.title}] Error moving queue user to with customer:`, err);
    }
  }

  async removeQueueEntry(branch: BranchFloorState, user: any) {
    try {
      await branch.service.deleteQueueEntry(user.queueId);
      await this.refreshBranchState(branch);
    } catch (err) {
      console.error(`[${branch.title}] Error removing queue entry:`, err);
    }
  }

  async moveQueueEntry(
    branch: BranchFloorState,
    user: any,
    direction: 'up' | 'down'
  ) {
    try {
      const index = branch.queue.findIndex(x => x.queueId === user.queueId);

      if (index === -1) return;

      const swapIndex =
        direction === 'up'
          ? index - 1
          : index + 1;

      if (swapIndex < 0 || swapIndex >= branch.queue.length) return;

      const newQueue = [...branch.queue];

      [newQueue[index], newQueue[swapIndex]] = [
        newQueue[swapIndex],
        newQueue[index]
      ];

      branch.queue = newQueue;
      this.cdr.detectChanges();

      await branch.service.moveQueueEntry(user.queueId, direction);

      await this.updateQueue(branch, true);
    } catch (err) {
      console.error(`[${branch.title}] Error moving queue entry:`, err);
      await this.updateQueue(branch, true);
    }
  }

  async addToQueue(branch: BranchFloorState, user: any) {
    if (!user || !user.id) return;

    try {
      await branch.service.addToQueue(user.id);

      branch.visible = false;
      branch.selectedUser = null;

      await this.refreshBranchState(branch);
    } catch (err) {
      console.error(`[${branch.title}] Error adding user to queue:`, err);

      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: String(err)
      });
    }
  }

  updateAvailableUsers(branch: BranchFloorState) {
    const currentShiftUserId =
      branch.currentUser?.id ??
      branch.currentShift?.salesperson_id ??
      null;

    const withCustomerIds = branch.withCustomers.map(item => item.salesperson_id);
    const queueIds = branch.queue.map(item => item.id);

    branch.availableUsers = branch.users.filter(user => {
      const isCurrent = user.id === currentShiftUserId;
      const isWithCustomer = withCustomerIds.includes(user.id);
      const isInQueue = queueIds.includes(user.id);

      return !isCurrent && !isWithCustomer && !isInQueue;
    });

    if (
      branch.selectedUser &&
      !branch.availableUsers.some(u => u.id === branch.selectedUser.id)
    ) {
      branch.selectedUser = null;
    }
  }

  getUserById(branch: BranchFloorState, userId: string) {
    return branch.users.find(u => u.id === userId);
  }

  private async processQueueEmails(branch: BranchFloorState) {
    const queueEntries = await branch.service.getQueueUserSales();

    for (let i = 0; i < branch.queue.length; i++) {
      const user = branch.queue[i];
      const queueEntry = queueEntries.find(
        (u: any) => u.salesperson_id === user.id
      );

      if (!queueEntry) continue;

      try {
        if (i === 1) {
          const sentSecond = await branch.service.markEmailSent(
            user.id,
            'secondSent'
          );

          if (sentSecond) {
            this.sendSecondPositionEmail(user, branch.databaseName);
          }
        }

        if (i === 0) {
          const sentFirst = await branch.service.markEmailSent(
            user.id,
            'firstSent'
          );

          if (sentFirst) {
            this.sendFirstPositionEmail(user, branch.databaseName);
          }
        }
      } catch (err) {
        console.error(`[${branch.title}] Error in email flow:`, err);
      }
    }
  }

  sendSecondPositionEmail(user: any, databaseName: any) {
    const branchText = this.getBranchText(databaseName);
    this.emailService.sendCustomEmail(
      'You are now second in line!',
      `<b>Hello ${user.name}!</b> You are about to reach the first position on the sales floor${branchText}.`,
      user.email
    ).subscribe();
  }

  sendFirstPositionEmail(user: any, databaseName: any) {
    const branchText = this.getBranchText(databaseName);
    this.emailService.sendCustomEmail(
      'You are now first in line!',
      `<b>Hello ${user.name}!</b> It is your turn to go to the sales floor${branchText}.`,
      user.email
    ).subscribe();
  }

  ngOnDestroy() {
    this.isDestroyed = true;

    for (const branch of this.branches) {
      branch.queueUnsub();
      branch.shiftUnsub();
      branch.withUnsub();
    }
  }

  private getBranchText(databaseName?: string): string {
    if (!databaseName) return '';

    const name = databaseName.toLowerCase();

    if (name.includes('north')) return ' at Toyota North';
    if (name.includes('south')) return ' at Toyota South';

    return '';
  }

  trackByQueueId(index: number, user: any) {
    return user.queueId;
  }
}