import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  Router,
  UrlTree
} from '@angular/router';

import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class EnvRouteGuard implements CanActivate {

  private envDb = environment.firebase.firestoreDb;

  constructor(private router: Router) { }

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {

    const path = route.routeConfig?.path || '';

    const isToyotaEnv = this.envDb.includes('ty');

    if (isToyotaEnv) {
      if (path === 'toyota-north' || path === 'toyota-south') {
        return true;
      }

      return this.router.parseUrl('/');
    } else {
      if (path === 'toyota-north' || path === 'toyota-south') {
        return this.router.parseUrl('/');
      }

      return true;
    }
  }
}