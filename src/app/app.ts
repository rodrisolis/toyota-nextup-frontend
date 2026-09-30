import { Component, inject, signal } from '@angular/core';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('salesfloorscheduler');

  private msal = inject(MsalService);

  constructor() {
    this.msal.handleRedirectObservable().subscribe({
      next: (result) => {
        if (result) {
          this.msal.instance.setActiveAccount(result.account);
        }
      },
      error: console.error,
    });
  }
    
}
