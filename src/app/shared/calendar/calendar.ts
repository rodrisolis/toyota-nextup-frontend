import { Component, Input, OnChanges, OnInit, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { FirestoreService2 } from '../../services/firestore2';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  imports: [ButtonModule, DatePickerModule, FormsModule, CommonModule, DialogModule, TooltipModule],
  providers: [FirestoreService2]
})
export class Calendar implements OnInit, OnChanges {

  @Input() env?: string;
  @Input() branchOverride?: 'north' | 'south';

  users: any[] = [];
  areas: any[] = [];
  salesCalendars: any[] = [];

  showWeekCalendar = false;
  loadingCalendar = false;

  selectedCalendarDate: Date = new Date();
  selectedDatabaseName = 'sfc-db-ty-north-qa';

  weekDays: {
    label: string;
    date: string;
    dayNumber: number;
  }[] = [];

  constructor(
    private firestoreService: FirestoreService2,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    await this.initializeCalendar();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['env'] || changes['branchOverride']) {
      await this.initializeCalendar();
    }
  }

  private async initializeCalendar() {
    this.selectedDatabaseName = this.resolveDatabase();

    this.firestoreService.setDatabase(this.selectedDatabaseName);

    this.buildWeekFromDate(this.selectedCalendarDate);

    await this.refreshCalendarData();

    this.cdr.detectChanges();
  }

  private resolveDatabase(): string {
    if (!this.env) {
      return '';
    }

    if (!this.env?.includes('ty')) {
      return '';
    }

    const isProd = this.env.includes('prod');
    const environment = isProd ? 'prod' : 'qa';

    let branch: 'north' | 'south' =
      this.env.includes('south') ? 'south' : 'north';

    if (this.branchOverride) {
      branch = this.branchOverride;
    }

    return `sfc-db-ty-${branch}-${environment}`;
  }

  async toggleWeekCalendar() {
    this.showWeekCalendar = !this.showWeekCalendar;

    if (this.showWeekCalendar) {
      await this.initializeCalendar();
    }
  }

  private async refreshCalendarData() {
    this.loadingCalendar = true;

    try {
      this.firestoreService.setDatabase(this.selectedDatabaseName);

      const [users, areas, salesCalendars] = await Promise.all([
        this.firestoreService.getUsuarios(),
        this.firestoreService.getAreas(),
        this.firestoreService.getSalesCalendars()
      ]);

      this.users = users || [];
      this.areas = areas || [];
      this.salesCalendars = salesCalendars || [];

      console.log('calendar users', this.users);
      console.log('calendar areas', this.areas);
      console.log('calendar salesCalendars', this.salesCalendars);
    } finally {
      this.loadingCalendar = false;
    }
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

  async onCalendarDateChange() {
    this.buildWeekFromDate(this.selectedCalendarDate);
    await this.refreshCalendarData();
    this.cdr.detectChanges();
  }

  getSalespersonName(salespersonId: string) {
    return this.users.find(u => u.id === salespersonId)?.name || 'No salesperson';
  }

  getSalesCalendarByAreaAndDate(areaId: string, date: string) {
    return this.salesCalendars.filter(item =>
      item.area_id === areaId &&
      item.date === date
    );
  }
}