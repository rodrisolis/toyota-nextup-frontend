import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';

import { FirestoreService } from '../../services/firestore';
import { collection, Firestore, onSnapshot, orderBy, query } from 'firebase/firestore';
// import { db } from '../../firebase.config';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EmailService } from '../../services/email.service';
import { MessageService } from 'primeng/api';
import { getDynamicDb } from '../../firebase.config';


@Component({
  selector: 'app-live-floor',
  standalone: true,
  templateUrl: './live-floor.html',
  imports: [DialogModule, ButtonModule, SelectModule, FormsModule, CommonModule],
  providers: [MessageService, FirestoreService]
})
export class LiveFloor implements OnInit, OnDestroy {

  private db: Firestore = getDynamicDb();

  // private firestoreService = inject(FirestoreService);
  private cdr = inject(ChangeDetectorRef);
  public router = inject(Router);
  private emailService = inject(EmailService);
  private messageService = inject(MessageService);


  users: any[] = [];
  availableUsers: any[] = [];

  queue: any[] = [];
  withCustomers: any[] = [];

  currentShift: any = null;
  currentUser: any = null;
  remainingTime: string = '00:00';

  visible: boolean = false;
  selectedUser: any = null;

  private timerInterval: any = null;

  private queueUnsub: () => void = () => { };
  private shiftUnsub: () => void = () => { };
  private withUnsub: () => void = () => { };

  private isAssigningNext = false;
  private isRefreshingQueue = false;
  private isDestroyed = false;

  // Evita carreras cuando un turno está terminando
  private isProcessingShiftEnd = false;
  private closingShiftId: string | null = null;

  isAdmin: boolean = JSON.parse(localStorage.getItem('userAdmin') || 'false');

  constructor(private firestoreService: FirestoreService){}


  async ngOnInit() {
    this.firestoreService.resetDatabase();
    await this.initData();
    this.initRealtime();
  }

  async initData() {
    this.users = await this.firestoreService.getUsuarios();
    await this.refreshAllState();
  }

  initRealtime() {
    this.queueUnsub = onSnapshot(
      query(collection(this.db, 'queue'), orderBy('request_time', 'asc')),
      async () => {
        await this.updateQueue();
      }
    );

    this.shiftUnsub = onSnapshot(
      collection(this.db, 'sales_floor_active'),
      async () => {
        await this.loadActiveShift();
        await this.updateQueue();
      }
    );

    this.withUnsub = onSnapshot(
      collection(this.db, 'with_customer'),
      async () => {
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

      if (!this.currentShift && !this.isProcessingShiftEnd && this.queue.length > 0) {
        await this.autoAssignNext();
        this.queue = await this.firestoreService.getQueueUsers();
      }

      const queueEntries = await this.firestoreService.getQueueUserSales();

      for (let i = 0; i < this.queue.length; i++) {
        const user = this.queue[i];
        const queueEntry = queueEntries.find((u: any) => u.salesperson_id === user.id);

        if (!queueEntry) continue;

        try {
          if (i === 1) {
            const sentSecond = await this.firestoreService.markEmailSent(user.id, 'secondSent');
            if (sentSecond) {
              this.sendSecondPositionEmail(user);
              console.log(`Second position email sent to ${user.name}: ${new Date().toISOString()}`);
            }
          }

          if (i === 0) {
            const sentFirst = await this.firestoreService.markEmailSent(user.id, 'firstSent');
            if (sentFirst) {
              this.sendFirstPositionEmail(user);
              console.log(`First position email sent to ${user.name}: ${new Date().toISOString()}`);
            }
          }
        } catch (err) {
          console.error('Error in email flow:', err);
        }
      }

      this.updateAvailableUsers();
      this.cdr.detectChanges();
    } finally {
      this.isRefreshingQueue = false;
    }
  }

  async updateWithCustomers() {
    this.withCustomers = await this.firestoreService.getWithCustomers();
    this.updateAvailableUsers();
    this.cdr.detectChanges();
  }

  async loadActiveShift() {
    // Mientras se está cerrando un turno, ignoramos recargas momentáneas
    if (this.isProcessingShiftEnd) {
      return;
    }

    const shift = await this.firestoreService.getActiveShift();

    if (!shift) {
      this.currentShift = null;
      this.currentUser = null;
      this.remainingTime = '00:00';

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      this.updateAvailableUsers();
      this.cdr.detectChanges();
      return;
    }

    // Si ese shift justo se está cerrando, no lo revivas en UI
    if (this.closingShiftId && shift.id === this.closingShiftId) {
      return;
    }

    const hasShiftChanged = this.currentShift?.id !== shift.id;

    this.currentShift = shift;
    this.currentUser = this.users.find(u => u.id === shift.salesperson_id) || null;

    this.updateAvailableUsers();

    if (hasShiftChanged || !this.timerInterval) {
      this.startTimer();
    } else {
      this.updateRemainingTime();
    }

    this.cdr.detectChanges();
  }

  startTimer() {
    if (!this.currentShift || !this.currentShift.scheduled_end_time) {
      this.remainingTime = '00:00';
      return;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.updateRemainingTime();

    this.timerInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      if (this.isProcessingShiftEnd) return;
      if (!this.currentShift) return;

      const remaining = this.getRemainingMsForCurrentShift();

      await this.checkTwoMinEmail();

      if (remaining <= 0) {
        await this.handleShiftExpiration();
        return;
      }

      this.updateRemainingTime();
      this.cdr.detectChanges();
    }, 1000);
  }

  private async handleShiftExpiration() {
    if (!this.currentShift || this.isProcessingShiftEnd) return;

    this.isProcessingShiftEnd = true;
    this.closingShiftId = this.currentShift.id;
    this.remainingTime = '00:00';

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const finishedUser = this.currentUser;
    const finishedShift = this.currentShift;

    // Limpieza local inmediata para que no siga mostrando el turno viejo
    this.currentShift = null;
    this.currentUser = null;
    this.updateAvailableUsers();
    this.cdr.detectChanges();

    try {
      if (finishedShift) {
        await this.firestoreService.completeShift(finishedShift.id);
      }

      if (finishedUser) {
        try {
          await this.firestoreService.addToQueue(finishedUser.id);
        } catch (err) {
          console.error('Error requeueing finished user:', err);
        }
      }

      // Pequeña recarga ordenada del estado real
      await this.updateWithCustomers();
      this.queue = await this.firestoreService.getQueueUsers();

      // Ya terminado el cierre, ahora sí se puede asignar el siguiente
      this.isProcessingShiftEnd = false;
      this.closingShiftId = null;

      await this.loadActiveShift();

      if (!this.currentShift && this.queue.length > 0) {
        await this.autoAssignNext();
      }

      await this.refreshAllState();
    } catch (err) {
      console.error('Error handling shift expiration:', err);

      this.isProcessingShiftEnd = false;
      this.closingShiftId = null;

      await this.refreshAllState();
    }
  }

  updateRemainingTime() {
    if (!this.currentShift || !this.currentShift.scheduled_end_time) {
      this.remainingTime = '00:00';
      return;
    }

    const remaining = this.getRemainingMsForCurrentShift();

    if (remaining <= 0) {
      this.remainingTime = '00:00';
      return;
    }

    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);

    this.remainingTime = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  parseDate(value: any): Date {
    if (!value) return new Date();
    return typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  }

  async sendToCustomer() {
    if (!this.currentUser || !this.currentShift) return;
    if (this.isProcessingShiftEnd) return;

    try {
      this.isProcessingShiftEnd = true;
      this.closingShiftId = this.currentShift.id;

      await this.firestoreService.moveFloorToWithCustomer(
        this.currentUser.id,
        this.currentShift.id
      );

      this.currentShift = null;
      this.currentUser = null;
      this.remainingTime = '00:00';

      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      this.isProcessingShiftEnd = false;
      this.closingShiftId = null;

      await this.refreshAllState();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'detail: ' + err });
      console.error('Error moving floor user to with customer:', err);
      this.isProcessingShiftEnd = false;
      this.closingShiftId = null;
      await this.refreshAllState();
    }
  }

  async finishCustomer(entry: any) {
    try {
      await this.firestoreService.moveWithCustomerToQueue(entry.salesperson_id, entry.id);
      await this.refreshAllState();
    } catch (err) {
      console.error('Error finishing customer:', err);
    }
  }

  async sendQueueToCustomer(entry: any) {
    try {
      await this.firestoreService.moveQueueToWithCustomer(entry.id, entry.queueId);
      await this.refreshAllState();
    } catch (err) {
      console.error('Error moving queue user to with customer:', err);
    }
  }

  async removeQueueEntry(entry: any) {
    try {
      await this.firestoreService.deleteQueueEntry(entry.queueId);
      await this.refreshAllState();
    } catch (err) {
      console.error('Error removing queue entry:', err);
    }
  }

  async moveQueueEntry(entry: any, direction: 'up' | 'down') {
    try {
      await this.firestoreService.moveQueueEntry(entry.queueId, direction);
      await this.updateQueue();
    } catch (err) {
      console.error('Error moving queue entry:', err);
    }
  }

  async autoAssignNext() {
    if (this.isAssigningNext) return;
    if (this.isProcessingShiftEnd) return;
    if (this.currentShift) return;
    if (this.queue.length === 0) return;

    this.isAssigningNext = true;

    try {
      const freshShift = await this.firestoreService.getActiveShift();

      if (freshShift) {
        if (!this.closingShiftId || freshShift.id !== this.closingShiftId) {
          this.currentShift = freshShift;
          this.currentUser = this.users.find(u => u.id === freshShift.salesperson_id) || null;
          this.updateAvailableUsers();
          this.startTimer();
        }
        return;
      }

      const freshQueue = await this.firestoreService.getQueueUsers();
      this.queue = freshQueue;

      const user = this.queue[0];
      if (!user) return;

      await this.startShiftForUser(user);
    } catch (err) {
      console.error('Error auto assigning next user:', err);
    } finally {
      this.isAssigningNext = false;
    }
  }

  async startShiftForUser(user: any) {
    const settings = await this.firestoreService.getSettings();
    const shiftSetting = settings.find(s => s.setting_name === 'shift_duration_minutes');
    const minutes = Number(shiftSetting?.setting_value || 1);

    const shift = await this.firestoreService.startShift(user.id, minutes);

    this.currentShift = shift;
    this.currentUser = this.users.find(u => u.id === shift.salesperson_id) || user;

    this.startTimer();

    this.queue = await this.firestoreService.getQueueUsers();
    this.updateAvailableUsers();
    this.cdr.detectChanges();
  }

  async addToQueue(user: any) {
    console.log(user);
    if (!user || !user.id) return;

    try {
      await this.firestoreService.addToQueue(user.id);
      this.visible = false;
      this.selectedUser = null;
      await this.refreshAllState();
    } catch (err) {
      console.error('Error adding to queue:', err);
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.queueUnsub();
    this.shiftUnsub();
    this.withUnsub();
  }

  sendSecondPositionEmail(user: any) {
    this.emailService.sendCustomEmail(
      'You are now second in line!',
      `<b>Hello ${user.name}!</b> You are about to reach the first position on the sales floor.`,
      user.email
    ).subscribe();
  }

  sendTwoMinEmail(user: any) {
    this.emailService.sendCustomEmail(
      'You will be first in 2 minutes!',
      `<b>Hello ${user.name}!</b> Only 2 minutes left until you reach the first position.`,
      user.email
    ).subscribe();
  }

  sendFirstPositionEmail(user: any) {
    this.emailService.sendCustomEmail(
      'You are now first in line!',
      `<b>Hello ${user.name}!</b> It is your turn to go to the sales floor.`,
      user.email
    ).subscribe();
  }

  getRemainingMsForCurrentShift(): number {
    if (!this.currentShift || !this.currentShift.scheduled_end_time) return Infinity;
    const endTime = this.parseDate(this.currentShift.scheduled_end_time);
    return endTime.getTime() - new Date().getTime();
  }

  private async checkTwoMinEmail() {
    if (!this.currentShift || this.queue.length < 2) return;
    if (this.isProcessingShiftEnd) return;

    const secondUser = this.queue[1];
    if (!secondUser) return;

    const remaining = this.getRemainingMsForCurrentShift();

    if (remaining <= 2 * 60000 && remaining > 0) {
      try {
        const sent = await this.firestoreService.markEmailSent(secondUser.id, 'twoMinSent');

        if (sent) {
          this.sendTwoMinEmail(secondUser);
          console.log(`Two minute email sent to ${secondUser.name}: ${new Date().toISOString()}`);
        }
      } catch (err) {
        console.error('Error sending 2 min email:', err);
      }
    }
  }

  updateAvailableUsers() {
    const currentShiftUserId = this.currentUser?.id ?? this.currentShift?.salesperson_id ?? null;
    const withCustomerIds = this.withCustomers.map(item => item.salesperson_id);
    const queueIds = this.queue.map(item => item.id);

    this.availableUsers = this.users.filter(user => {
      const isCurrent = user.id === currentShiftUserId;
      const isWithCustomer = withCustomerIds.includes(user.id);
      const isInQueue = queueIds.includes(user.id);

      return !isCurrent && !isWithCustomer && !isInQueue;
    });

    if (this.selectedUser && !this.availableUsers.some(u => u.id === this.selectedUser.id)) {
      this.selectedUser = null;
    }
  }
}