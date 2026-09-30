import { Component } from '@angular/core';
import { environment } from '../../../environments/environment';


@Component({
  selector: 'app-tynorthsalesfloor',
  standalone: false,
  templateUrl: './tynorthsalesfloor.html',
  styleUrl: './tynorthsalesfloor.scss',
})
export class Tynorthsalesfloor {

  
    public env = environment.firebase.firestoreDb;
  
}
