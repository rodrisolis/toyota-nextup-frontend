import { Component } from '@angular/core';
import { LiveFloorSecondary } from '../../../../shared/live-floor-secondary/live-floor-secondary';

@Component({
  selector: 'app-live-view',
  standalone: true,
  templateUrl: './live-view.html',
  styleUrl: './live-view.scss',
  imports: [LiveFloorSecondary],
})
export class LiveView {}
