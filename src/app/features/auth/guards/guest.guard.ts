import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(MsalService);
  const router = inject(Router);

  const account =
    auth.instance.getActiveAccount() ??
    auth.instance.getAllAccounts()[0];

  if (account) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};