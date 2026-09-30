import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { FirestoreService } from '../../../../services/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-salespeople',
  standalone: true,
  templateUrl: './salespeople.html',
  styleUrl: './salespeople.scss',
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, ToastModule],
  providers: [MessageService],
})
export class Salespeople implements OnInit {

  users: any[] = [];

  newSalespersonName: string = '';
  newSalespersonEmail: string = '';

  editModalVisible: boolean = false;
  editSalespersonName: string = '';
  editSalespersonEmail: string = '';
  editSalespersonId: string = '';

  currentShift: any | null = null;
  currentUser: any | null = null;

  constructor(
    private firestoreService: FirestoreService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit() {
    this.users = await this.firestoreService.getUsuarios();
    this.cdr.detectChanges();
  }

  async addSalesperson() {
    if (!this.newSalespersonName || this.newSalespersonName.trim().length < 3) {
      this.messageService.add({ severity: 'warn', summary: 'Name required', detail: 'Please enter a valid name.' });
      return;
    }
    if (!this.newSalespersonEmail || !this.newSalespersonEmail.includes('@')) {
      this.messageService.add({ severity: 'warn', summary: 'Email required', detail: 'Please enter a valid email.' });
      return;
    }

    const emailExists = this.users.some(
      user => user.email?.toLowerCase() === this.newSalespersonEmail.toLowerCase()
    );

    if (emailExists) {
      this.messageService.add({ severity: 'warn', summary: 'Duplicate email', detail: 'This email is already registered.' });
      return;
    }

    // Generar randomId de 1 a 999
    const randomId = Math.floor(Math.random() * 999) + 1;
    // Generar id
    const id = 'user_sales_' + randomId;
    // Generar avatar_url
    const avatar_url = `https://picsum.photos/seed/avatar${randomId}/100/100`;

    const user = {
      avatar_url,
      email: this.newSalespersonEmail.trim(),
      id,
      name: this.newSalespersonName.trim(),
      notifyOnUnexpected: true,
      role: 'Salesperson',
    };

    try {

      await this.firestoreService.addUser(user);
      this.messageService.add({ severity: 'success', summary: 'Added', detail: 'Salesperson added successfully.' });
      this.newSalespersonName = '';
      this.newSalespersonEmail = '';

      this.users = await this.firestoreService.getUsuarios();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not add salesperson.' });
    }
  }

  openEditModal(user: any) {
    this.editSalespersonName = user.name;
    this.editSalespersonEmail = user.email;
    this.editSalespersonId = user.id;
    this.editModalVisible = true;
  }

  async saveSalespersonEdit() {
    if (!this.editSalespersonName || !this.editSalespersonEmail) return;
    const updatedUser = {
      ...this.users.find(u => u.id === this.editSalespersonId),
      name: this.editSalespersonName.trim(),
      email: this.editSalespersonEmail.trim(),
    };
    try {
      await this.firestoreService.addUser(updatedUser); // addUser hace upsert
      this.messageService.add({ severity: 'success', summary: 'Updated', detail: 'Salesperson updated.' });
      this.editModalVisible = false;
      this.users = await this.firestoreService.getUsuarios();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not update salesperson.' });
    }
  }

  async deleteSalesperson(user: any) {
    try {
      // 1. Si está en shift activo, marcar actual_end_time
      const activeShift = this.currentShift && this.currentUser && this.currentUser.id === user.id ? this.currentShift : null;
      if (activeShift) {
        await this.firestoreService.completeShift(activeShift.id);
      }

      // 2. Eliminar de with_customer
      const withCustomers = await this.firestoreService.getWithCustomers();
      for (const entry of withCustomers) {
        if (entry.salesperson_id === user.id) {
          await this.firestoreService.removeWithCustomer(entry.id);
        }
      }

      // 3. Eliminar de queue
      const queue = await this.firestoreService.getQueue();
      for (const entry of queue) {
        if (entry.salesperson_id === user.id) {
          await this.firestoreService.deleteQueueEntry(entry.id);
        }
      }

      // 4. Eliminar de users
      await this.firestoreService.deleteUser(user.id);

      this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'Salesperson deleted.' });
      // 5. Actualizar lista de usuarios
      this.users = await this.firestoreService.getUsuarios();
      this.cdr.detectChanges();
    } catch (err) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not delete salesperson.' });
    }
  }
}
