import { Component, EventEmitter, inject, Output, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'dashboard-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="h-[88px] px-4 md:px-8 flex items-center justify-between">
  <!-- Left -->
  <div class="flex items-center gap-4">
    <button
  type="button"
  (click)="onToggleSidebar()"
  class="w-11 h-11 rounded-xl flex items-center justify-center text-[#2F476B] hover:bg-white/70 transition cursor-pointer"
>
  <i class="pi pi-bars text-2xl"></i>
</button>
  </div>

  <!-- Right -->
  <div class="flex items-center gap-3 md:gap-4">
    <!-- Avatar -->
    <!-- <button
  type="button"
  class="w-11 h-11 rounded-full overflow-hidden shadow-sm"
>
  <div
    class="w-full h-full rounded-full bg-gradient-to-br from-pink-300 via-rose-400 to-red-500 text-white flex items-center justify-center font-semibold text-base"
  >
    {{ initial }}
  </div>
</button> -->
  </div>
</header>
     `
})
export class DashboardNavbar {

  @Output() toggleSidebar = new EventEmitter<void>();

  private msalService = inject(MsalService);

  public fullName = this.msalService.instance.getActiveAccount()?.name || 'User';
  public initial = this.fullName.charAt(0).toUpperCase();

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }
}