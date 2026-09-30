import { APP_INITIALIZER, NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { Login } from './features/auth/login/login';
import { Admin } from './features/dashboard/admin/admin';
import { Salesfloor } from './features/dashboard/salesfloor/salesfloor';
import { FormsModule } from '@angular/forms';

import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TooltipModule } from 'primeng/tooltip';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { LiveFloor } from './shared/live-floor/live-floor';
import { DatePickerModule } from 'primeng/datepicker';
import { LiveFloorSecondary } from './shared/live-floor-secondary/live-floor-secondary';
import { FirestoreService } from './services/firestore';
import { Calendar } from './shared/calendar/calendar';
import { Tynorthsalesfloor } from './features/dashboard/tynorthsalesfloor/tynorthsalesfloor';
import { Tysouthsalesfloor } from './features/dashboard/tysouthsalesfloor/tysouthsalesfloor';
import { LiveFloorTertiary } from './shared/live-floor-tertiary/live-floor-tertiary';
import { FirestoreService2 } from './services/firestore2';

import {
  MSAL_INSTANCE,
  MSAL_GUARD_CONFIG,
  MSAL_INTERCEPTOR_CONFIG,
  MsalService,
  MsalGuard,
  MsalBroadcastService,
  MsalInterceptor,
} from '@azure/msal-angular';

import {
  MSALInstanceFactory,
  MSALGuardConfigFactory,
  MSALInterceptorConfigFactory,
} from './features/auth/config/msal.config';
import { IPublicClientApplication } from '@azure/msal-browser';

/*
 * ============================================================
 * MSAL INITIALIZER
 * ============================================================
 */

export function MSALInitializerFactory(
  msalInstance: IPublicClientApplication,
): () => Promise<void> {
  return () => {
    return msalInstance
      .initialize()

      .then(() => {
        console.log('MSAL initialized successfully');

        const accounts = msalInstance.getAllAccounts();

        if (!msalInstance.getActiveAccount() && accounts.length > 0) {
          msalInstance.setActiveAccount(accounts[0]);
        }
      })

      .catch((error) => {
        console.error('MSAL initialization failed:', error);

        throw error;
      });
  };
}

@NgModule({
  declarations: [
    App,
    Login,
    Admin,
    Salesfloor,
    Tynorthsalesfloor,
    Tysouthsalesfloor,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TooltipModule,
    ToastModule,
    LiveFloor,
    LiveFloorSecondary,
    DatePickerModule,
    Calendar,
    LiveFloorTertiary,
  ],
  providers: [
    {
      provide: MSAL_INSTANCE,
      useFactory: MSALInstanceFactory,
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory,
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: MSALInitializerFactory,
      deps: [MSAL_INSTANCE],
      multi: true,
    },

    {
      provide: HTTP_INTERCEPTORS,
      useClass: MsalInterceptor,
      multi: true,
    },
    provideBrowserGlobalErrorListeners(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          primary: 'rose',
          darkModeSelector: '.app-dark',
        },
      },
    }),
    MessageService,
    FirestoreService,
    FirestoreService2,
    MsalService,
    MsalGuard,
    MsalBroadcastService,
  ],
  bootstrap: [App],
})
export class AppModule {}
