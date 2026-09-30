import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Salesfloor } from './features/dashboard/salesfloor/salesfloor';
import { Tynorthsalesfloor } from './features/dashboard/tynorthsalesfloor/tynorthsalesfloor';
import { Tysouthsalesfloor } from './features/dashboard/tysouthsalesfloor/tysouthsalesfloor';
import { EnvRouteGuard } from './shared/guards/env-route.guard';
import { authGuard } from './features/auth/guards/auth.guard';
import { guestGuard } from './features/auth/guards/guest.guard';
import { DashboardLayout } from './features/dashboard/components/dashboard.layout';

@NgModule({
  imports: [RouterModule.forRoot([
    { path: '', component: Login, canActivate: [guestGuard], },
    { path: 'dashboard', canActivate: [authGuard], component: DashboardLayout,
      children: [
        { path: '', redirectTo: 'liveview', pathMatch: 'full', },
        { path: 'liveview', loadComponent: () => import('./features/dashboard/pages/live-view/live-view').then(m => m.LiveView) },
        { path: 'salespeople', loadComponent: () => import('./features/dashboard/pages/salespeople/salespeople').then(m => m.Salespeople) },
        { path: 'reports', loadComponent: () => import('./features/dashboard/pages/reports/reports').then(m => m.Reports) },
        { path: 'areas', loadComponent: () => import('./features/dashboard/pages/areas/areas').then(m => m.Areas) },
        { path: 'salescalendar', loadComponent: () => import('./features/dashboard/pages/salescalendar/salescalendar').then(m => m.Salescalendar) },
      ],
     },
            
    { path: 'salesfloor', component: Salesfloor },
    { path: 'toyota-north', component: Tynorthsalesfloor, canActivate: [EnvRouteGuard] },
    { path: 'toyota-south', component: Tysouthsalesfloor, canActivate: [EnvRouteGuard] },
  ])],
  exports: [RouterModule]
})
export class AppRoutingModule { }
