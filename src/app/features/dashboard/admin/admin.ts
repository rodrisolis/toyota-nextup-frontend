import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { EmailService } from '../../../services/email.service';
import { Router } from '@angular/router';
import { FirestoreService } from '../../../services/firestore';
import { MessageService } from 'primeng/api';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
// import { db } from '../../../firebase.config';
// import { logWithCustomerHistory } from '../../../services/with-customer-history';
import { environment } from '../../../environments/environment';
import { FirestoreService2 } from '../../../services/firestore2';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {

  sidebarOpen = false;
  desktopSidebarVisible = true;

  public env = environment.firebase.firestoreDb;


  private cdr = inject(ChangeDetectorRef);

  currentTab: string = 'LIVE';

  settings: any[] = [];

  extra_time_minutes_value: string = '0';
  shift_duration_minutes_value: string = '0';

  // Admin functions for SETTINGS tab


  users: any[] = [];


  // SALESPEOPLE TAB

  newSalespersonName: string = '';
  newSalespersonEmail: string = '';

  // Edit modal state
  editModalVisible: boolean = false;
  editSalespersonName: string = '';
  editSalespersonEmail: string = '';
  editSalespersonId: string = '';

  async addSalesperson() {
    if (!this.newSalespersonName || this.newSalespersonName.trim().length < 3) {
      this.messageService.add({ severity: 'warn', summary: 'Name required', detail: 'Please enter a valid name.' });
      return;
    }
    if (!this.newSalespersonEmail || !this.newSalespersonEmail.includes('@')) {
      this.messageService.add({ severity: 'warn', summary: 'Email required', detail: 'Please enter a valid email.' });
      return;
    }

    const emailExists = this.users.some(
      user => user.email?.toLowerCase() === this.newSalespersonEmail.toLowerCase()
    );

    if (emailExists) {
      this.messageService.add({ severity: 'warn', summary: 'Duplicate email', detail: 'This email is already registered.' });
      return;
    }


    const randomId = Math.floor(Math.random() * 999) + 1;

    const id = 'user_sales_' + randomId;
  
    const avatar_url = `https://picsum.photos/seed/avatar${randomId}/100/100`;

    const user = {
      avatar_url,
      email: this.newSalespersonEmail.trim(),
      id,
      name: this.newSalespersonName.trim(),
      notifyOnUnexpected: true,
      role: 'Salesperson',
    };

    try {
   
      await this.firestoreService.addUser(user);
      this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Salesperson added successfully.' });
      this.newSalespersonName = '';
      this.newSalespersonEmail = '';

      this.users = await this.firestoreService.getUsuarios();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not add salesperson.' });
    }
  }

  openEditModal(user: any) {
    this.editSalespersonName = user.name;
    this.editSalespersonEmail = user.email;
    this.editSalespersonId = user.id;
    this.editModalVisible = true;
  }

  async saveSalespersonEdit() {
    if (!this.editSalespersonName || !this.editSalespersonEmail) return;
    const updatedUser = {
      ...this.users.find(u => u.id === this.editSalespersonId),
      name: this.editSalespersonName.trim(),
      email: this.editSalespersonEmail.trim(),
    };
    try {
      await this.firestoreService.addUser(updatedUser); // addUser hace upsert
      this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Salesperson updated.' });
      this.editModalVisible = false;
      this.users = await this.firestoreService.getUsuarios();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not update salesperson.' });
    }
  }



  // currently active shift and associated user
  currentShift: any | null = null;
  currentUser: any | null = null;
  remainingTime: string = '00:00';

  userAdmin: any;

  //////// AREAS
  areas: any[] = [];

  newAreaName: string = '';
  newAreaDescription: string = '';

  editAreaModalVisible: boolean = false;
  editAreaId: string = '';
  editAreaName: string = '';
  editAreaDescription: string = '';

  /////// AREAS

  // SALES CALENDAR WEEK VIEW

  showWeekCalendar: boolean = false;
  selectedCalendarDate: Date = new Date();

  weekDays: {
    label: string;
    date: string;
    dayNumber: number;
  }[] = [];

  name = "User";


  constructor(
    private firestoreService: FirestoreService,
    private firestoreService2: FirestoreService2,
    private messageService: MessageService,
    private router: Router,
    private msalService: MsalService
  ) { }

  async ngOnInit() {
    this.userAdmin = JSON.parse(localStorage.getItem("userAdmin") || '{}');
    const fullName = this.msalService.instance.getActiveAccount()?.name;
    this.name = fullName ? fullName.split(' ')[0] : 'User';
    console.log("Admin user:", this.userAdmin);

    if (localStorage.getItem('isLoggedIn') !== 'true') {
      this.router.navigate(['/']);

    }

    this.users = await this.firestoreService.getUsuarios();
    console.log("Queue users:", this.users);
    this.areas = await this.firestoreService2.getAreas();
    this.salesCalendars = await this.firestoreService2.getSalesCalendars();

    this.buildCurrentWeek();

    this.cdr.detectChanges();

  }

  logout() {
    // localStorage.setItem('isLoggedIn', 'false');
    // localStorage.removeItem('userAdmin');
    // this.router.navigate(['/']);
    this.msalService.logoutRedirect({
      postLogoutRedirectUri: '/',
    });
  }

  goToTab(tab: string) {
    this.currentTab = tab;
    if (tab === 'SETTINGS') {
      this.getSettings();
    }
  }

  getSetting(name: string) {
    return this.settings.find(s => s.setting_name === name)?.setting_value || 0;
  }

  getSettings() {
    this.firestoreService.getSettings()
      .then((res: any) => {
        this.settings = res;
        // Asignar valores a los inputs
        const shift = this.settings.find(s => s.setting_name === 'shift_duration_minutes');
        const extra = this.settings.find(s => s.setting_name === 'extra_time_minutes');
        this.shift_duration_minutes_value = shift && shift.setting_value ? String(shift.setting_value) : '';
        this.extra_time_minutes_value = extra && extra.setting_value ? String(extra.setting_value) : '';
        this.cdr.detectChanges();
      })
      .catch((err: any) => {
        // console.error("Error:", err);
      })
  }

  async updateSettings() {
    // Validar ambos valores
    const shiftVal = Number(this.shift_duration_minutes_value);
    const extraVal = Number(this.extra_time_minutes_value);
    if (!shiftVal || !extraVal) {
      this.messageService.add({ severity: 'warn', summary: 'Incomplete', detail: 'Both values must be loaded and valid.' });
      return;
    }

    try {
      await this.firestoreService.updateSettingValue('extra_time_minutes', String(extraVal));
      await this.firestoreService.updateSettingValue('shift_duration_minutes', String(shiftVal));
      await this.getSettings();
      this.messageService.add({ severity: 'success', summary: 'Settings Updated', detail: 'Settings saved successfully.' });
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not update settings.' });
    }
  }
  get settingsLoaded() {
    // Ambos valores deben estar cargados y ser válidos
    const shiftVal = Number(this.shift_duration_minutes_value);
    const extraVal = Number(this.extra_time_minutes_value);
    return !!shiftVal && !!extraVal;
  }

  // Eliminados: notifiedSecond, notifiedFirst, notified2Min. Ahora el control es global en Firestore.
  async deleteSalesperson(user: any) {
    try {
      // 1. Si está en shift activo, marcar actual_end_time
      const activeShift = this.currentShift && this.currentUser && this.currentUser.id === user.id ? this.currentShift : null;
      if (activeShift) {
        await this.firestoreService.completeShift(activeShift.id);
      }

      // 2. Eliminar de with_customer
      const withCustomers = await this.firestoreService.getWithCustomers();
      for (const entry of withCustomers) {
        if (entry.salesperson_id === user.id) {
          await this.firestoreService.removeWithCustomer(entry.id);
        }
      }

      // 3. Eliminar de queue
      const queue = await this.firestoreService.getQueue();
      for (const entry of queue) {
        if (entry.salesperson_id === user.id) {
          await this.firestoreService.deleteQueueEntry(entry.id);
        }
      }

      // 4. Eliminar de users
      await this.firestoreService.deleteUser(user.id);

      this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Salesperson deleted.' });
      // 5. Actualizar lista de usuarios
      this.users = await this.firestoreService.getUsuarios();
      this.cdr.detectChanges();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not delete salesperson.' });
    }
  }


  //////// Admin Functions for LIVE tab //////////

  ///// AREAS

  async addArea() {
    if (!this.newAreaName || this.newAreaName.trim().length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Name required',
        detail: 'Please enter a valid area name.'
      });
      return;
    }

    const areaExists = this.areas.some(
      area => area.name?.toLowerCase() === this.newAreaName.trim().toLowerCase()
    );

    if (areaExists) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Duplicate area',
        detail: 'This area already exists.'
      });
      return;
    }

    const randomId = Math.floor(Math.random() * 999999) + 1;

    const area = {
      id: 'area_' + randomId,
      name: this.newAreaName.trim(),
      description: this.newAreaDescription.trim(),
      active: true,
      created_at: new Date()
    };

    try {
      await this.firestoreService2.addArea(area);

      this.messageService.add({
        severity: 'success',
        summary: 'Added',
        detail: 'Area added successfully.'
      });

      this.newAreaName = '';
      this.newAreaDescription = '';

      this.areas = await this.firestoreService2.getAreas();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not add area.'
      });
    }
  }

  openEditAreaModal(area: any) {
    this.editAreaId = area.id;
    this.editAreaName = area.name;
    this.editAreaDescription = area.description || '';
    this.editAreaModalVisible = true;
  }

  async saveAreaEdit() {
    if (!this.editAreaName || this.editAreaName.trim().length < 2) {
      return;
    }

    const currentArea = this.areas.find(a => a.id === this.editAreaId);

    const updatedArea = {
      ...currentArea,
      name: this.editAreaName.trim(),
      description: this.editAreaDescription.trim(),
      updated_at: new Date()
    };

    try {
      await this.firestoreService2.addArea(updatedArea);

      this.messageService.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Area updated successfully.'
      });

      this.editAreaModalVisible = false;

      this.areas = await this.firestoreService2.getAreas();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not update area.'
      });
    }
  }

  async deleteArea(area: any) {
    try {
      await this.firestoreService2.deleteArea(area.id);

      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: 'Area deleted successfully.'
      });

      this.areas = await this.firestoreService2.getAreas();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not delete area.'
      });
    }
  }

  // SALES CALENDAR TAB

  salesCalendars: any[] = [];

  newSalesCalendarDate: string = '';
  newSalesCalendarAreaId: string = '';
  newSalesCalendarSalespersonId: string = '';

  editSalesCalendarModalVisible: boolean = false;
  editSalesCalendarId: string = '';
  editSalesCalendarDate: string = '';
  editSalesCalendarAreaId: string = '';
  editSalesCalendarSalespersonId: string = '';

  getAreaName(areaId: string) {
    return this.areas.find(a => a.id === areaId)?.name || 'No area';
  }

  getSalespersonName(salespersonId: string) {
    return this.users.find(u => u.id === salespersonId)?.name || 'No salesperson';
  }

  async addSalesCalendar() {
    if (!this.newSalesCalendarDate || !this.newSalesCalendarAreaId || !this.newSalesCalendarSalespersonId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Incomplete',
        detail: 'Please select date, area and salesperson.'
      });
      return;
    }

    const alreadyExists = this.salesCalendars.some(item =>
      item.date === this.newSalesCalendarDate &&
      item.area_id === this.newSalesCalendarAreaId &&
      item.salesperson_id === this.newSalesCalendarSalespersonId
    );

    if (alreadyExists) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Duplicate',
        detail: 'This salesperson is already assigned to this area on this date.'
      });
      return;
    }

    const randomId = Math.floor(Math.random() * 999999) + 1;

    const salesCalendar = {
      id: 'sales_calendar_' + randomId,
      date: this.newSalesCalendarDate,
      area_id: this.newSalesCalendarAreaId,
      salesperson_id: this.newSalesCalendarSalespersonId,
      active: true,
      created_at: new Date()
    };

    try {
      await this.firestoreService2.addSalesCalendar(salesCalendar);

      this.messageService.add({
        severity: 'success',
        summary: 'Added',
        detail: 'Sales calendar added successfully.'
      });

      this.newSalesCalendarDate = '';
      this.newSalesCalendarAreaId = '';
      this.newSalesCalendarSalespersonId = '';

      this.salesCalendars = await this.firestoreService2.getSalesCalendars();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not add sales calendar.'
      });
    }
  }

  openEditSalesCalendarModal(item: any) {
    this.editSalesCalendarId = item.id;
    this.editSalesCalendarDate = item.date;
    this.editSalesCalendarAreaId = item.area_id;
    this.editSalesCalendarSalespersonId = item.salesperson_id;
    this.editSalesCalendarModalVisible = true;
  }

  async saveSalesCalendarEdit() {
    if (!this.editSalesCalendarDate || !this.editSalesCalendarAreaId || !this.editSalesCalendarSalespersonId) {
      return;
    }

    const currentItem = this.salesCalendars.find(x => x.id === this.editSalesCalendarId);

    const updatedSalesCalendar = {
      ...currentItem,
      date: this.editSalesCalendarDate,
      area_id: this.editSalesCalendarAreaId,
      salesperson_id: this.editSalesCalendarSalespersonId,
      updated_at: new Date()
    };

    try {
      await this.firestoreService2.addSalesCalendar(updatedSalesCalendar);

      this.messageService.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Sales calendar updated successfully.'
      });

      this.editSalesCalendarModalVisible = false;

      this.salesCalendars = await this.firestoreService2.getSalesCalendars();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not update sales calendar.'
      });
    }
  }

  async deleteSalesCalendar(item: any) {
    try {
      await this.firestoreService2.deleteSalesCalendar(item.id);

      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: 'Sales calendar deleted successfully.'
      });

      this.salesCalendars = await this.firestoreService2.getSalesCalendars();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not delete sales calendar.'
      });
    }
  }

  /////////// CALENDAR

  toggleWeekCalendar() {
    this.showWeekCalendar = !this.showWeekCalendar;

    if (this.showWeekCalendar) {
      this.buildCurrentWeek();
    }
  }

  onCalendarDateChange() {
    this.buildWeekFromDate(this.selectedCalendarDate);
  }

  buildCurrentWeek() {
    this.selectedCalendarDate = new Date();
    this.buildWeekFromDate(this.selectedCalendarDate);
  }

  buildWeekFromDate(date: Date) {
    const selected = new Date(date);

    const day = selected.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(selected);
    monday.setDate(selected.getDate() + diffToMonday);

    const labels = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];

    this.weekDays = [];

    for (let i = 0; i < 7; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);

      this.weekDays.push({
        label: labels[i],
        date: this.formatDateToInput(current),
        dayNumber: current.getDate()
      });
    }
  }

  formatDateToInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  getSalesCalendarByAreaAndDate(areaId: string, date: string) {
    return this.salesCalendars.filter(item =>
      item.area_id === areaId &&
      item.date === date
    );
  }

  selectTab(tab: string): void {
    this.goToTab(tab);

    if (window.innerWidth < 768) {
      this.sidebarOpen = false;
    }
  }

  toggleDesktopSidebar(): void {
    this.desktopSidebarVisible = !this.desktopSidebarVisible;
  }


}