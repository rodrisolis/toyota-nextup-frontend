import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

interface SidebarChildItem {
  label: string;
  icon?: string;
  badge?: string | number;
  badgeStyle?: 'dark' | 'light';
  chipBgClass?: string;
  chipTextClass?: string;
  route?: string;
}

interface SidebarSection {
  id: string;
  label: string;
  collapsible: boolean;
  open: boolean;
  icon?: string;
  route?: string;
  children?: SidebarChildItem[];
  dividerTop?: boolean;
}


@Component({
  selector: 'dashboard-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <!-- Overlay (solo móvil) -->
  <div *ngIf="isMobileOpen" class="fixed inset-0 z-40 bg-black/40 lg:hidden" (click)="onCloseSidebar()"></div>
  
  <!-- Sidebar -->
  <aside
      class="fixed top-0 left-0 z-50 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300"
      [ngClass]="[
      isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      collapsed ? 'lg:w-0 lg:overflow-hidden' : 'lg:w-[280px]'
    ]">
      <div *ngIf="!collapsed || isMobileOpen" class="flex flex-col h-full w-[280px]">
          <!-- Logo -->
          <div class="px-6 pt-7 pb-5 flex items-center justify-between">
  
              <div class="flex items-center gap-3 cursor-pointer" routerLink="/dashboard">
                  <img class="h-10 object-contain" src="logo-daltonb.png">
                  <img class="h-10 object-contain" src="toyota-logo.png">
              </div>
  
              <button type="button"
                  class="cursor-pointer lg:hidden w-10 h-10 rounded-lg flex items-center justify-center text-[#4B5D79] hover:bg-slate-100 transition"
                  (click)="onCloseSidebar()">
                  <i class="pi pi-times text-lg"></i>
              </button>
          </div>
  
          <!-- Scrollable content -->
          <div class="flex-1 overflow-y-auto px-5 pb-4">
              <div *ngFor="let section of sections; trackBy: trackBySection" class="pt-1 first:pt-0"
                  [ngClass]="section.dividerTop ? 'border-t border-slate-200' : ''">
                  <!-- CASO 1: Sección con subelementos (Children) -->
                  <ng-container *ngIf="section.children && section.children.length > 0; else standaloneSection">
                      <button type="button" (click)="toggleSection(section.id)"
                          class="w-full flex items-center justify-between text-left px-2 py-2 cursor-pointer">
                          <span class="text-[15px] font-semibold text-[#162B4D]">
                              {{ section.label }}
                          </span>
  
                          <i *ngIf="section.collapsible"
                              class="pi text-xs text-[#4B5D79] transition-transform duration-200"
                              [ngClass]="section.open ? 'pi-angle-down' : 'pi-angle-right'"></i>
                      </button>
  
                      <!-- Children -->
                      <div *ngIf="section.open" class="mt-1 ml-4 space-y-1">
                          <a *ngFor="let child of section.children; trackBy: trackByChild" [routerLink]="child.route"
                              routerLinkActive="bg-slate-100 !text-red-500"
                              class="group flex items-center justify-between rounded-xl px-2 py-3 text-[#243B63] hover:bg-slate-50 transition cursor-pointer"
                              (click)="onChildClick()">
                              <span class="flex items-center gap-3 min-w-0">
                                  <i *ngIf="child.icon && !child.chipBgClass"
                                      [class]="child.icon + ' text-sm text-[#4B5D79] group-[.text-red-500]:text-red-500'"></i>
  
                                  <span *ngIf="child.icon && child.chipBgClass"
                                      class="flex h-5 w-5 items-center justify-center rounded-md"
                                      [ngClass]="[child.chipBgClass, child.chipTextClass || 'text-[#4B5D79]']">
                                      <i [class]="child.icon + ' text-[10px]'"></i>
                                  </span>
  
                                  <span class="text-[15px] truncate">
                                      {{ child.label }}
                                  </span>
                              </span>
  
                              <span *ngIf="child.badge !== undefined && child.badge !== null"
                                  class="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                                  [ngClass]="child.badgeStyle === 'dark'
                ? 'bg-[#0B1530] text-white'
                : 'bg-slate-100 text-[#4B5D79]'">
                                  {{ child.badge }}
                              </span>
                          </a>
                      </div>
                  </ng-container>
  
                  <!-- CASO 2: Sección principal sin hijos (Enlace Directo) -->
                  <ng-template #standaloneSection>
                      <a [routerLink]="section.route" routerLinkActive="bg-slate-100 !text-red-500"
                          (click)="onSectionClick(section)"
                          class="group w-full flex items-center justify-between px-2 py-2 text-left rounded-xl transition cursor-pointer hover:bg-slate-50 text-[#162B4D]">
                          <span class="flex items-center gap-2.5 min-w-0">
                              <i *ngIf="section.icon"
                                  [class]="section.icon + ' text-sm text-[#4B5D79] group-[.text-red-500]:text-red-500'"></i>
                              <span class="text-[15px] font-semibold">
                                  {{ section.label }}
                              </span>
                          </span>
                      </a>
                  </ng-template>
              </div>
          </div>
  
          <!-- Footer user -->
          <!-- Footer account -->
          <div class="border-t border-slate-200 px-5 py-4">
  
              <!-- Opciones (colapsables) -->
              <div *ngIf="accountOpen" class="mb-3 space-y-1">
  
  
                  <a
                      class="flex items-center gap-3 rounded-xl px-2 py-3 text-[#243B63] hover:bg-slate-100 transition cursor-pointer group">
                      <i class="pi pi-sparkles text-sm text-amber-500"></i>
                      <div class="flex items-center gap-2">
                          <span class="relative flex h-2 w-2">
                              <span
                                  class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span
                              class="text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-full group-hover:bg-emerald-100 transition-colors">
                              v1.2.0
                          </span>
                      </div>
                  </a>
  
  
                  <a
                      class="flex items-center gap-3 rounded-xl px-2 py-3 text-[#243B63] hover:bg-slate-50 transition cursor-pointer">
                      <i class="pi pi-at text-sm text-[#4B5D79]"></i>
                      <span class="text-[13px] min-w-0 break-all">{{ email}}</span>
                  </a>
  
                  <a (click)="logout()"
                      class="flex items-center gap-3 rounded-xl px-2 py-3 text-red-500 hover:bg-red-50 transition cursor-pointer">
                      <i class="pi pi-sign-out text-sm"></i>
                      <span class="text-[15px]">Sign Out</span>
                  </a>
  
              </div>
  
              <!-- Trigger usuario -->
              <button type="button" (click)="toggleAccount()"
                  class="w-full flex items-center justify-between rounded-xl px-2 py-2 hover:bg-slate-50 transition cursor-pointer">
  
                  <span class="flex items-center gap-3 min-w-0">
                      <div
                          class="h-8 w-8 rounded-full bg-gradient-to-br from-pink-300 via-rose-400 to-red-500 text-white flex items-center justify-center font-semibold text-sm shadow-md shrink-0">
                          {{ initial }}
                      </div>
                      <span class="text-[15px] font-medium text-[#162B4D] truncate">
                          {{fullName}}
                      </span>
                  </span>
  
                  <i class="pi text-xs text-[#4B5D79] transition-transform duration-200"
                      [ngClass]="accountOpen ? 'pi-angle-up' : 'pi-angle-down'"></i>
              </button>
  
          </div>
      </div>
  </aside>
    `
})
export class DashboardSidebar {

  @Input() isMobileOpen = false;
  @Input() collapsed = false;
  @Output() closeSidebar = new EventEmitter<void>();

  private msalService = inject(MsalService);

  public fullName = this.msalService.instance.getActiveAccount()?.name || 'User';
  public initial = this.fullName.charAt(0).toUpperCase();
  public email = this.msalService.instance.getActiveAccount()?.username || '';

  sections: SidebarSection[] = [
    { id: 'liveview', label: 'Live View', collapsible: false, icon: 'pi pi-video', route: '/dashboard/liveview', open: false },
    { id: 'salespeople', label: 'Sales People', collapsible: false, icon: 'pi pi-users', route: '/dashboard/salespeople', open: false },
    { id: 'reports', label: 'Reports', collapsible: false, icon: 'pi pi-chart-line', route: '/dashboard/reports', open: false },
    { id: 'areas', label: 'Areas', collapsible: false, icon: 'pi pi-building', route: '/dashboard/areas', open: false },
    { id: 'salescalendar', label: 'Sales Calendar', collapsible: false, icon: 'pi pi-calendar', route: '/dashboard/salescalendar', open: false }
  ];

  onCloseSidebar(): void {
    this.closeSidebar.emit();
  }

  toggleSection(sectionId: string): void {
    const section = this.sections.find(s => s.id === sectionId);
    if (!section || !section.collapsible) return;
    section.open = !section.open;
  }

  trackBySection(index: number, item: SidebarSection): string {
    return item.id;
  }

  trackByChild(index: number, item: SidebarChildItem): string {
    return `${item.label}-${index}`;
  }

  accountOpen = false;

  toggleAccount() {
    this.accountOpen = !this.accountOpen;
  }

  onSectionClick(section: SidebarSection): void {
    if (this.isMobileOpen) {
      this.onCloseSidebar();
    }
  }

  onChildClick(): void {
    if (this.isMobileOpen) {
      this.onCloseSidebar();
    }
  }

  logout(): void {
    this.msalService.logoutRedirect({
      postLogoutRedirectUri: '/',
    });
  }
}