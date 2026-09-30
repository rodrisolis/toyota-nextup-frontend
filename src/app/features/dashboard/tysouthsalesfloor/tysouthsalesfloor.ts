import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tysouthsalesfloor',
  standalone: false,
  templateUrl: './tysouthsalesfloor.html',
  styleUrl: './tysouthsalesfloor.scss',
})
export class Tysouthsalesfloor {
  public env = environment.firebase.firestoreDb;
}
