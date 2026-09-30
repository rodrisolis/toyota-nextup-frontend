import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-admin-history-table',
  templateUrl: './admin-history-table.html',
})
export class AdminHistoryTableComponent {
  @Input() withCustomerHistory: Array<{salesperson_id: string, entry: Date, exit: Date}> = [];
  @Input() users: any[] = [];
}
