import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { Calendar } from '../../../../shared/calendar/calendar';
import { environment } from '../../../../environments/environment';
import { MessageService } from 'primeng/api';
import { FirestoreService2 } from '../../../../services/firestore2';
import { FirestoreService } from '../../../../services/firestore';

@Component({
  selector: 'app-salescalendar',
  standalone: true,
  templateUrl: './salescalendar.html',
  styleUrl: './salescalendar.scss',
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, ToastModule, DatePickerModule, Calendar],
  providers: [MessageService],
})
export class Salescalendar implements OnInit {

    public env = environment.firebase.firestoreDb;

  areas: any[] = [];
  users: any[] = [];

  salesCalendars: any[] = [];

  newSalesCalendarDate: string = '';
  newSalesCalendarAreaId: string = '';
  newSalesCalendarSalespersonId: string = '';

  editSalesCalendarModalVisible: boolean = false;
  editSalesCalendarId: string = '';
  editSalesCalendarDate: string = '';
  editSalesCalendarAreaId: string = '';
  editSalesCalendarSalespersonId: string = '';

    showWeekCalendar: boolean = false;
  selectedCalendarDate: Date = new Date();

  weekDays: {
    label: string;
    date: string;
    dayNumber: number;
  }[] = [];

  constructor(
    private firestoreService2: FirestoreService2, 
    private firestoreService: FirestoreService, 
    private messageService: MessageService, 
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.users = await this.firestoreService.getUsuarios();
    this.areas = await this.firestoreService2.getAreas();
    this.salesCalendars = await this.firestoreService2.getSalesCalendars();
    this.buildCurrentWeek();
    this.cdr.detectChanges();
  }

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

}
