import {
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
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

@Component({
  selector: 'app-live-floor-tertiary',
  standalone: true,
  templateUrl: './live-floor-tertiary.html',
  styleUrl: './live-floor-tertiary.scss',
  imports: [
    DialogModule,
    ButtonModule,
    SelectModule,
    FormsModule,
    CommonModule,
    TooltipModule
  ],
  providers: [
    MessageService,
    FirestoreService2
  ],

})
export class LiveFloorTertiary implements OnInit, OnChanges, OnDestroy {

  @Input() env!: string; // ej: toyota-south-qa
  @Input() branchOverride?: 'north' | 'south';

  private firestoreService = inject(FirestoreService2);
  private cdr = inject(ChangeDetectorRef);
  public router = inject(Router);
  private emailService = inject(EmailService);
  private messageService = inject(MessageService);

  branchOptions = [
    {
      label: 'TY North',
      value: 'sfc-db-ty-north-qa'
    },
    {
      label: 'TY South',
      value: 'sfc-db-ty-south-qa'
    }
  ];

  //selectedDatabaseName: string = 'sfc-db-ty-north-qa';
  selectedDatabaseName: string = this.resolveDatabase();

  users: any[] = [];
  availableUsers: any[] = [];

  queue: any[] = [];
  withCustomers: any[] = [];

  currentShift: any = null;
  currentUser: any = null;

  visible: boolean = false;
  selectedUser: any = null;

  private db!: Firestore;

  private queueUnsub: () => void = () => { };
  private shiftUnsub: () => void = () => { };
  private withUnsub: () => void = () => { };

  private isAssigningNext = false;
  private isRefreshingQueue = false;
  private isDestroyed = false;

  isAdmin: boolean = JSON.parse(localStorage.getItem('userAdmin') || 'false');

  get selectedBranchTitle(): string {
    return this.branchOptions.find(x => x.value === this.selectedDatabaseName)?.label || 'Branch';
  }

  async ngOnInit() {
    this.selectedDatabaseName = this.resolveDatabase();
    await this.loadSelectedBranch();
  }

  async onBranchChange() {
    await this.loadSelectedBranch();
  }

  private async loadSelectedBranch() {
    this.unsubscribeRealtime();

    this.resetLocalState();

    this.firestoreService.setDatabase(this.selectedDatabaseName);
    this.db = this.firestoreService.getDatabase();

    await this.initData();
    this.initRealtime();

    this.cdr.detectChanges();
  }

  private resetLocalState() {
    this.users = [];
    this.availableUsers = [];
    this.queue = [];
    this.withCustomers = [];

    this.currentShift = null;
    this.currentUser = null;

    this.visible = false;
    this.selectedUser = null;

    this.isAssigningNext = false;
    this.isRefreshingQueue = false;
  }

  private unsubscribeRealtime() {
    this.queueUnsub();
    this.shiftUnsub();
    this.withUnsub();

    this.queueUnsub = () => { };
    this.shiftUnsub = () => { };
    this.withUnsub = () => { };
  }

  async initData() {
    this.users = await this.firestoreService.getUsuarios();
    await this.refreshAllState();
  }

  initRealtime() {
    this.queueUnsub = onSnapshot(
      query(collection(this.db, 'queue'), orderBy('request_time', 'asc')),
      async () => {
        if (this.isDestroyed) return;
        await this.updateQueue();
      }
    );

    this.shiftUnsub = onSnapshot(
      collection(this.db, 'sales_floor_active'),
      async () => {
        if (this.isDestroyed) return;
        await this.loadActiveShift();
        await this.updateQueue();
      }
    );

    this.withUnsub = onSnapshot(
      collection(this.db, 'with_customer'),
      async () => {
        if (this.isDestroyed) return;
        await this.updateWithCustomers();
      }
    );
  }

  async refreshAllState() {
    await this.loadActiveShift();
    await this.updateWithCustomers();
    await this.updateQueue();

    this.updateAvailableUsers();
    this.cdr.detectChanges();
  }

  async updateQueue() {
    if (this.isRefreshingQueue) return;

    this.isRefreshingQueue = true;

    try {
      this.queue = await this.firestoreService.getQueueUsers();

      if (!this.currentShift && this.queue.length > 0) {
        await this.autoAssignNext();
        this.queue = await this.firestoreService.getQueueUsers();
      }

      await this.processQueueEmails();

      this.updateAvailableUsers();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error updating queue:', err);
    } finally {
      this.isRefreshingQueue = false;
    }
  }

  async updateWithCustomers() {
    try {
      this.withCustomers = await this.firestoreService.getWithCustomers();
      this.updateAvailableUsers();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error updating with customers:', err);
    }
  }

  async loadActiveShift() {
    try {
      const shift = await this.firestoreService.getActiveShift();

      if (!shift) {
        this.currentShift = null;
        this.currentUser = null;

        this.updateAvailableUsers();
        this.cdr.detectChanges();
        return;
      }

      this.currentShift = shift;
      this.currentUser = this.users.find(u => u.id === shift.salesperson_id) || null;

      this.updateAvailableUsers();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error loading active shift:', err);
    }
  }

  async autoAssignNext() {
    if (this.isAssigningNext) return;
    if (this.currentShift) return;
    if (this.queue.length === 0) return;

    this.isAssigningNext = true;

    try {
      const freshShift = await this.firestoreService.getActiveShift();

      if (freshShift) {
        this.currentShift = freshShift;
        this.currentUser = this.users.find(u => u.id === freshShift.salesperson_id) || null;

        this.updateAvailableUsers();
        return;
      }

      const freshQueue = await this.firestoreService.getQueueUsers();
      this.queue = freshQueue;

      const firstUser = this.queue[0];

      if (!firstUser) return;

      const shift = await this.firestoreService.startShift(firstUser.id);

      this.currentShift = shift;
      this.currentUser = this.users.find(u => u.id === shift.salesperson_id) || firstUser;

      this.queue = await this.firestoreService.getQueueUsers();

      this.updateAvailableUsers();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Error auto assigning next user:', err);
    } finally {
      this.isAssigningNext = false;
    }
  }

  async sendToCustomer() {
    if (!this.currentUser || !this.currentShift) return;

    try {
      await this.firestoreService.moveFloorToWithCustomer(
        this.currentUser.id,
        this.currentShift.id
      );

      this.currentShift = null;
      this.currentUser = null;

      await this.refreshAllState();

      if (!this.currentShift && this.queue.length > 0) {
        await this.autoAssignNext();
        await this.refreshAllState();
      }
    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: String(err)
      });

      console.error('Error moving floor user to with customer:', err);

      await this.refreshAllState();
    }
  }

  async finishCustomer(entry: any) {
    try {
      await this.firestoreService.moveWithCustomerToQueue(
        entry.salesperson_id,
        entry.id
      );

      await this.refreshAllState();
    } catch (err) {
      console.error('Error finishing customer:', err);
    }
  }

  async sendQueueToCustomer(user: any) {
    try {
      await this.firestoreService.moveQueueToWithCustomer(
        user.id,
        user.queueId
      );

      await this.refreshAllState();
    } catch (err) {
      console.error('Error moving queue user to with customer:', err);
    }
  }

  async removeQueueEntry(user: any) {
    try {
      await this.firestoreService.deleteQueueEntry(user.queueId);
      await this.refreshAllState();
    } catch (err) {
      console.error('Error removing queue entry:', err);
    }
  }

  async moveQueueEntry(user: any, direction: 'up' | 'down') {
    try {
      await this.firestoreService.moveQueueEntry(user.queueId, direction);
      await this.updateQueue();
    } catch (err) {
      console.error('Error moving queue entry:', err);
    }
  }

  async addToQueue(user: any) {
    if (!user || !user.id) return;

    try {
      await this.firestoreService.addToQueue(user.id);

      this.visible = false;
      this.selectedUser = null;

      await this.refreshAllState();
    } catch (err) {
      console.error('Error adding user to queue:', err);

      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: String(err)
      });
    }
  }

  updateAvailableUsers() {
    const currentShiftUserId =
      this.currentUser?.id ??
      this.currentShift?.salesperson_id ??
      null;

    const withCustomerIds = this.withCustomers.map(item => item.salesperson_id);
    const queueIds = this.queue.map(item => item.id);

    this.availableUsers = this.users.filter(user => {
      const isCurrent = user.id === currentShiftUserId;
      const isWithCustomer = withCustomerIds.includes(user.id);
      const isInQueue = queueIds.includes(user.id);

      return !isCurrent && !isWithCustomer && !isInQueue;
    });

    if (
      this.selectedUser &&
      !this.availableUsers.some(u => u.id === this.selectedUser.id)
    ) {
      this.selectedUser = null;
    }
  }

  getUserById(userId: string) {
    return this.users.find(u => u.id === userId);
  }

  private async processQueueEmails() {
    const queueEntries = await this.firestoreService.getQueueUserSales();

    for (let i = 0; i < this.queue.length; i++) {
      const user = this.queue[i];

      const queueEntry = queueEntries.find(
        (u: any) => u.salesperson_id === user.id
      );

      if (!queueEntry) continue;

      try {
        if (i === 1) {
          const sentSecond = await this.firestoreService.markEmailSent(
            user.id,
            'secondSent'
          );

          if (sentSecond) {
            this.sendSecondPositionEmail(user);
          }
        }

        if (i === 0) {
          const sentFirst = await this.firestoreService.markEmailSent(
            user.id,
            'firstSent'
          );

          if (sentFirst) {
            this.sendFirstPositionEmail(user);
          }
        }
      } catch (err) {
        console.error('Error in email flow:', err);
      }
    }
  }

  sendSecondPositionEmail(user: any) {
    const branchText = this.getBranchText();
    this.emailService.sendCustomEmail(
      'You are now second in line!',
      `<b>Hello ${user.name}!</b> You are about to reach the first position on the sales floor${branchText}.`,
      user.email
    ).subscribe();
  }

  sendFirstPositionEmail(user: any) {
    const branchText = this.getBranchText();
    this.emailService.sendCustomEmail(
      'You are now first in line!',
      `<b>Hello ${user.name}!</b> It is your turn to go to the sales floor${branchText}.`,
      user.email
    ).subscribe();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.unsubscribeRealtime();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['env'] || changes['branchOverride']) {
      this.selectedDatabaseName = this.resolveDatabase();
      await this.loadSelectedBranch();
    }
  }

  private resolveDatabase(): string {
    if (!this.env) {
      return 'sfc-db-ty-north-qa'; // fallback
    }

    // Detectar ambiente (qa o prod)
    const isProd = this.env.includes('prod');
    const environment = isProd ? 'prod' : 'qa';

    // Detectar branch base desde env
    let branch: 'north' | 'south' =
      this.env.includes('south') ? 'south' : 'north';

    // Si mandas override manual
    if (this.branchOverride) {
      branch = this.branchOverride;
    }

    return `sfc-db-ty-${branch}-${environment}`;
  }

  private getBranchText(): string {
    if (this.branchOverride === 'north') return ' at Toyota North';
    if (this.branchOverride === 'south') return ' at Toyota South';
    return '';
  }
}