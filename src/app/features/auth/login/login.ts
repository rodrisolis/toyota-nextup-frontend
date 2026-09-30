import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FirestoreService } from '../../../services/firestore';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { MsalService } from '@azure/msal-angular';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {

  private cdr = inject(ChangeDetectorRef);

  usuarios:any[] = [];

  password:string = '';
  selectedUser: any = null;

  constructor(
    private firestoreService: FirestoreService, 
    private messageService: MessageService,
    private router: Router,
    private msalService: MsalService
  ) {
    this.msalService.handleRedirectObservable().subscribe({
      next: (result) => {
        if (result?.account) {
          this.msalService.instance.setActiveAccount(result.account);
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => console.error(err),
    });
  }

  async ngOnInit() {
    // if (localStorage.getItem('isLoggedIn') === 'true') {
    //   this.router.navigate(['/dashboard']);
    // }
    // this.usuarios = await this.firestoreService.getManagers();
    // this.cdr.detectChanges();
    // console.log(this.usuarios);
  }

  login(){
    console.log(this.selectedUser);
    if(this.password === '1234' && this.selectedUser.role === 'Manager') {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userAdmin', JSON.stringify(this.selectedUser));
      this.router.navigate(['/dashboard']);

    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Incorrect password' });
    }
  }

  loginMS() {
    this.msalService.loginRedirect({
      scopes: ['User.Read'],
    });
  }

}