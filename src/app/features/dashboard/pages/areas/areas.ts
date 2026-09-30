import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { FirestoreService2 } from '../../../../services/firestore2';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-areas',
  standalone: true,
  templateUrl: './areas.html',
  styleUrl: './areas.scss',
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, ToastModule],
})
export class Areas implements OnInit {

  areas: any[] = [];

  newAreaName: string = '';
  newAreaDescription: string = '';

  editAreaModalVisible: boolean = false;
  editAreaId: string = '';
  editAreaName: string = '';
  editAreaDescription: string = '';

  constructor(
    private firestoreService2: FirestoreService2, 
    private messageService: MessageService, 
    private cdr: ChangeDetectorRef
  ) { }


  async ngOnInit() {
    this.areas = await this.firestoreService2.getAreas();
    this.cdr.detectChanges();
  }

  
  async addArea() {
    if (!this.newAreaName || this.newAreaName.trim().length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Name required',
        detail: 'Please enter a valid area name.'
      });
      return;
    }

    const areaExists = this.areas.some(
      area => area.name?.toLowerCase() === this.newAreaName.trim().toLowerCase()
    );

    if (areaExists) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Duplicate area',
        detail: 'This area already exists.'
      });
      return;
    }

    const randomId = Math.floor(Math.random() * 999999) + 1;

    const area = {
      id: 'area_' + randomId,
      name: this.newAreaName.trim(),
      description: this.newAreaDescription.trim(),
      active: true,
      created_at: new Date()
    };

    try {
      await this.firestoreService2.addArea(area);

      this.messageService.add({
        severity: 'success',
        summary: 'Added',
        detail: 'Area added successfully.'
      });

      this.newAreaName = '';
      this.newAreaDescription = '';

      this.areas = await this.firestoreService2.getAreas();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not add area.'
      });
    }
  }

  openEditAreaModal(area: any) {
    this.editAreaId = area.id;
    this.editAreaName = area.name;
    this.editAreaDescription = area.description || '';
    this.editAreaModalVisible = true;
  }

  async saveAreaEdit() {
    if (!this.editAreaName || this.editAreaName.trim().length < 2) {
      return;
    }

    const currentArea = this.areas.find(a => a.id === this.editAreaId);

    const updatedArea = {
      ...currentArea,
      name: this.editAreaName.trim(),
      description: this.editAreaDescription.trim(),
      updated_at: new Date()
    };

    try {
      await this.firestoreService2.addArea(updatedArea);

      this.messageService.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Area updated successfully.'
      });

      this.editAreaModalVisible = false;

      this.areas = await this.firestoreService2.getAreas();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not update area.'
      });
    }
  }

  async deleteArea(area: any) {
    try {
      await this.firestoreService2.deleteArea(area.id);

      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: 'Area deleted successfully.'
      });

      this.areas = await this.firestoreService2.getAreas();
      this.cdr.detectChanges();

    } catch (err) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not delete area.'
      });
    }
  }
}
