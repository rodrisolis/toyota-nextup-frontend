import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';

export const authGuard:CanActivateFn =()=>{

const msal = inject(MsalService);
const router = inject(Router);
const account = msal.instance.getActiveAccount();

if(account){
    return true;
}
router.navigate(['/']);
return false;
}