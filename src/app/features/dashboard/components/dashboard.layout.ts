import { Component, HostListener, Renderer2, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { DashboardSidebar } from './dashboard.sidebar';
import { DashboardNavbar } from './dashboard.navbar';


@Component({
    selector: 'dashboard-layout',
    standalone: true,
    imports: [CommonModule, RouterModule, DashboardSidebar, DashboardNavbar
    ],
    template: `
    <div class="min-h-screen bg-[#EEF2F6] flex">
  <dashboard-sidebar
    [isMobileOpen]="isMobileSidebarOpen"
    [collapsed]="isDesktopCollapsed"
    (closeSidebar)="closeSidebar()"
  ></dashboard-sidebar>

  <div
    class="flex-1 min-w-0 flex flex-col transition-all duration-300"
    [ngClass]="{
      'lg:ml-0': isDesktopCollapsed,
      'lg:ml-[280px]': !isDesktopCollapsed
    }"
  >
    <dashboard-topbar
      (toggleSidebar)="toggleSidebar()"
    ></dashboard-topbar>

    <main class="px-4 pb-4 md:px-6 md:pb-6 lg:px-8 lg:pb-8">
      <router-outlet></router-outlet>
      <!-- <div class="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <h1 class="text-3xl font-semibold text-[#2F476B]">Empty Page</h1>
        <p class="mt-4 text-lg text-[#2F476B]">
          Use this page to start from scratch and place your custom content.
        </p>
      </div> -->
    </main>
  </div>
</div>
    `
})
export class DashboardLayout {
    isMobileSidebarOpen = false;
    isDesktopCollapsed = false;

    private readonly desktopBreakpoint = 1024;

    toggleSidebar(): void {
        if (this.isMobileView()) {
            this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
        } else {
            this.isDesktopCollapsed = !this.isDesktopCollapsed;
        }
    }

    closeSidebar(): void {
        this.isMobileSidebarOpen = false;
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        if (this.isMobileView()) {
            // al entrar a móvil, el sidebar no debe quedarse "colapsado"
            this.isDesktopCollapsed = false;
        } else {
            // al volver a desktop, el drawer móvil debe cerrarse
            this.isMobileSidebarOpen = false;
        }
    }

    private isMobileView(): boolean {
        return window.innerWidth < this.desktopBreakpoint;
    }
}