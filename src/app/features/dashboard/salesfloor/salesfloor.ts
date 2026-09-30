import { Component, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-salesfloor',
  standalone: false,
  templateUrl: './salesfloor.html',
  styleUrl: './salesfloor.scss',
})
export class Salesfloor implements OnInit {

  public env = environment.firebase.firestoreDb;

  constructor() { }

  get isAdmin() {
    return localStorage.getItem('isLoggedIn') === 'true';
  }

  async ngOnInit() {
  }

}

