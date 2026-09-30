import { Injectable } from '@angular/core';
import { getDynamicDb } from '../firebase.config';
import {
  collection,
  documentId,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  where,
  updateDoc,
  doc,
  orderBy,
  deleteDoc,
  runTransaction,
  setDoc,
  onSnapshot,
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { environment } from '../environments/environment';

export interface ActiveShift {
  id: string;
  salesperson_id: string;
  actual_end_time: any;
  extra_time_requested: boolean;
  lost_time_reported: boolean;
  requeue: boolean;
  start_time: any;
}

export class FirestoreService2 {

  private db: Firestore = getDynamicDb();

  setDatabase(databaseName?: string): void {
    this.db = getDynamicDb(databaseName);
  }

  resetDatabase(): void {
    this.db = getDynamicDb();
  }

  getDatabase(): Firestore {
    return this.db;
  }

  private getCurrentDbName(): string {
    return (this.db as any)?._databaseId?.database || environment.firebase.firestoreDb;
  }

  private getUsersDb(): Firestore {
    const currentDbName = this.getCurrentDbName();

    const isToyota =
      currentDbName.includes('ty-north') ||
      currentDbName.includes('ty-south');

    if (!isToyota) {
      return this.db;
    }

    if (currentDbName.includes('-qa')) {
      return getDynamicDb('sfc-db-ty-north-qa');
    }

    if (currentDbName.includes('-prod')) {
      return getDynamicDb('sfc-db-ty-north-prod');
    }


    return this.db;
  }

  getUsersRealtime(callback: (users: any[]) => void): () => void {
    const usersCol = collection(this.getUsersDb(), 'users');

    return onSnapshot(usersCol, (snapshot) => {
      const users: any[] = [];

      snapshot.forEach((docItem) => {
        users.push({
          id: docItem.id,
          ...docItem.data()
        });
      });

      callback(users);
    });
  }

  async deleteUser(userId: string) {
    const userRef = doc(this.getUsersDb(), 'users', userId);
    await deleteDoc(userRef);
  }

  async addUser(user: any) {
    const userRef = doc(this.getUsersDb(), 'users', user.id);

    await updateDoc(userRef, user).catch(async () => {
      await setDoc(userRef, user);
    });
  }

  async getUsuarios() {
    console.log('DB =>', this.db);
    const q = query(
      collection(this.getUsersDb(), 'users'),
      where('role', '==', 'Salesperson')
    );

    const querySnapshot = await getDocs(q);
    const usuarios: any[] = [];

    querySnapshot.forEach((docItem) => {
      usuarios.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return usuarios;
  }

  async getManagers() {
    const q = query(
      collection(this.getUsersDb(), 'users'),
      where('role', '==', 'Manager')
    );

    const querySnapshot = await getDocs(q);
    const usuarios: any[] = [];

    querySnapshot.forEach((docItem) => {
      usuarios.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return usuarios;
  }

  async getSettings() {
    const querySnapshot = await getDocs(collection(this.db, 'settings'));
    const settings: any[] = [];

    querySnapshot.forEach((docItem) => {
      settings.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return settings;
  }

  async updateSettingValue(id: string, value: string) {
    const ref = doc(this.db, 'settings', id);

    await updateDoc(ref, {
      setting_value: value
    });
  }

  async getSettingValue(key: string) {
    const querySnapshot = await getDocs(
      query(
        collection(this.db, 'settings'),
        where(documentId(), '==', key)
      )
    );

    let value: any = null;

    querySnapshot.forEach((docItem) => {
      const data: any = docItem.data();
      value = data['setting_value'];
    });

    return value;
  }

  async getQueueEntryBySalesperson(salesperson_id: string) {
    const q = query(
      collection(this.db, 'queue'),
      where('salesperson_id', '==', salesperson_id)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const d = snapshot.docs[0];

    return {
      queueId: d.id,
      ...d.data()
    };
  }

  async addToQueue(salesperson_id: string) {
    const activeRef = doc(this.db, 'sales_floor_active', salesperson_id);

    await runTransaction(this.db, async (tx) => {
      const activeSnap = await tx.get(activeRef);

      if (activeSnap.exists()) {
        throw new Error('Salesperson is currently on floor.');
      }

      const queueQuery = query(
        collection(this.db, 'queue'),
        where('salesperson_id', '==', salesperson_id)
      );

      const queueSnap = await getDocs(queueQuery);

      if (!queueSnap.empty) {
        throw new Error('Salesperson is already in queue.');
      }

      const withCustomerQuery = query(
        collection(this.db, 'with_customer'),
        where('salesperson_id', '==', salesperson_id)
      );

      const withCustomerSnap = await getDocs(withCustomerQuery);

      if (!withCustomerSnap.empty) {
        throw new Error('Salesperson is already with a customer.');
      }

      const queueRef = doc(collection(this.db, 'queue'));

      tx.set(queueRef, {
        priority: false,
        request_time: serverTimestamp(),
        salesperson_id,
        notifiedFirst: false,
        notifiedSecond: false,
        notified2Min: false,
      });
    });
  }

  async addToQueueOnce(salesperson_id: string) {
    await this.addToQueue(salesperson_id);
  }

  async getQueue() {
    const querySnapshot = await getDocs(collection(this.db, 'queue'));
    const queueArr: any[] = [];

    querySnapshot.forEach((docItem) => {
      queueArr.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return queueArr;
  }

  async getQueueUserSales() {
    const queueSnapshot = await getDocs(
      query(
        collection(this.db, 'queue'),
        orderBy('request_time', 'asc')
      )
    );

    return queueSnapshot.docs.map(docItem => {
      const data: any = docItem.data();

      return {
        queueId: docItem.id,
        ...data
      };
    });
  }

  async getQueueUsers() {
    const queueSnapshot = await getDocs(
      query(
        collection(this.db, 'queue'),
        orderBy('request_time', 'asc')
      )
    );

    const entries: any[] = [];

    queueSnapshot.forEach((docItem) => {
      const data: any = docItem.data();

      entries.push({
        queueId: docItem.id,
        salesperson_id: data.salesperson_id,
        request_time: data.request_time
      });
    });

    if (entries.length === 0) return [];

    const idsSeen: Record<string, string> = {};

    for (const e of entries) {
      if (idsSeen[e.salesperson_id]) {
        await deleteDoc(doc(this.db, 'queue', e.queueId));
      } else {
        idsSeen[e.salesperson_id] = e.queueId;
      }
    }

    const uniqueEntries = Object.keys(idsSeen).map(id => ({
      salesperson_id: id,
      queueId: idsSeen[id]
    }));

    const userIds = uniqueEntries.map(e => e.salesperson_id);

    if (userIds.length === 0) return [];

    const usersQuery = query(
      collection(this.getUsersDb(), 'users'),
      where(documentId(), 'in', userIds)
    );

    const usersSnapshot = await getDocs(usersQuery);
    const users: any[] = [];

    usersSnapshot.forEach((docItem) => {
      users.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    const merged: any[] = [];

    uniqueEntries.forEach(e => {
      const user = users.find(x => x.id === e.salesperson_id);

      if (user) {
        merged.push({
          queueId: e.queueId,
          ...user
        });
      }
    });

    return merged;
  }

  async removeFromQueue(salesperson_id: string) {
    const q = query(
      collection(this.db, 'queue'),
      where('salesperson_id', '==', salesperson_id)
    );

    const snapshot = await getDocs(q);
    const deletions: Promise<void>[] = [];

    snapshot.forEach((docItem) => {
      deletions.push(deleteDoc(docItem.ref));
    });

    await Promise.all(deletions);
  }

  async startShift(salesperson_id: string): Promise<ActiveShift> {
    const shiftsCol = collection(this.db, 'sales_floor_shifts');
    const lockRef = doc(this.db, 'locks', 'activeShift');
    const activeRef = doc(this.db, 'sales_floor_active', salesperson_id);

    const result = await runTransaction<ActiveShift>(this.db, async (tx) => {
      const activeSnap = await tx.get(activeRef);
      const lockSnap = await tx.get(lockRef);

      if (activeSnap.exists()) {
        const activeData = activeSnap.data();

        if (activeData?.['shiftId']) {
          const shiftRef = doc(
            this.db,
            'sales_floor_shifts',
            activeData['shiftId']
          );

          const shiftSnap = await tx.get(shiftRef);

          if (
            shiftSnap.exists() &&
            shiftSnap.data()?.['actual_end_time'] === null
          ) {
            return {
              id: shiftSnap.id,
              ...(shiftSnap.data() as Omit<ActiveShift, 'id'>)
            };
          }
        }
      }

      if (lockSnap.exists()) {
        const lockedId = lockSnap.data()?.['shiftId'];

        if (lockedId) {
          const lockedShiftRef = doc(
            this.db,
            'sales_floor_shifts',
            lockedId
          );

          const lockedShiftSnap = await tx.get(lockedShiftRef);

          if (
            lockedShiftSnap.exists() &&
            lockedShiftSnap.data()?.['actual_end_time'] === null
          ) {
            return {
              id: lockedShiftSnap.id,
              ...(lockedShiftSnap.data() as Omit<ActiveShift, 'id'>)
            };
          }
        }
      }

      const queueQuery = query(
        collection(this.db, 'queue'),
        where('salesperson_id', '==', salesperson_id)
      );

      const queueSnap = await getDocs(queueQuery);

      if (queueSnap.empty) {
        throw new Error('Salesperson is not in queue.');
      }

      const withCustomerQuery = query(
        collection(this.db, 'with_customer'),
        where('salesperson_id', '==', salesperson_id)
      );

      const withCustomerSnap = await getDocs(withCustomerQuery);

      if (!withCustomerSnap.empty) {
        throw new Error('Salesperson is already with a customer.');
      }

      const queueDoc = queueSnap.docs[0];
      const newShiftRef = doc(shiftsCol);

      const data = {
        actual_end_time: null,
        extra_time_requested: false,
        lost_time_reported: false,
        requeue: true,
        salesperson_id,
        start_time: serverTimestamp(),
      };

      tx.set(newShiftRef, data);
      tx.set(lockRef, { shiftId: newShiftRef.id });
      tx.set(activeRef, { shiftId: newShiftRef.id });
      tx.delete(queueDoc.ref);

      return {
        id: newShiftRef.id,
        ...(data as Omit<ActiveShift, 'id'>)
      };
    });

    await this.syncSingleSalesFloorActive(
      result.id,
      result.salesperson_id
    );

    return result;
  }

  async getActiveShift(): Promise<ActiveShift | null> {
    const lockRef = doc(this.db, 'locks', 'activeShift');
    const lockSnap = await getDoc(lockRef);

    if (!lockSnap.exists()) return null;

    const shiftId = lockSnap.data()?.['shiftId'];

    if (!shiftId) return null;

    const shiftRef = doc(this.db, 'sales_floor_shifts', shiftId);
    const shiftSnap = await getDoc(shiftRef);

    if (!shiftSnap.exists()) return null;

    const shiftData: any = shiftSnap.data();

    if (shiftData.actual_end_time !== null) return null;

    return {
      id: shiftSnap.id,
      ...(shiftData as Omit<ActiveShift, 'id'>)
    };
  }

  async completeShift(shiftId: string) {
    const shiftRef = doc(this.db, 'sales_floor_shifts', shiftId);
    const lockRef = doc(this.db, 'locks', 'activeShift');

    await runTransaction(this.db, async (tx) => {
      const shiftSnap = await tx.get(shiftRef);
      const lockSnap = await tx.get(lockRef);

      if (!shiftSnap.exists()) return;

      const shiftData: any = shiftSnap.data();
      const salesperson_id = shiftData.salesperson_id;

      tx.update(shiftRef, {
        actual_end_time: serverTimestamp()
      });

      if (salesperson_id) {
        const activeRef = doc(
          this.db,
          'sales_floor_active',
          salesperson_id
        );

        tx.delete(activeRef);
      }

      if (
        lockSnap.exists() &&
        lockSnap.data()?.['shiftId'] === shiftId
      ) {
        tx.set(lockRef, { shiftId: null });
      }
    });

    await this.syncSingleSalesFloorActive(null);
  }

  async moveFloorToWithCustomer(
    salesperson_id: string,
    shiftId: string
  ) {
    const shiftRef = doc(this.db, 'sales_floor_shifts', shiftId);
    const activeRef = doc(this.db, 'sales_floor_active', salesperson_id);
    const lockRef = doc(this.db, 'locks', 'activeShift');
    const withCustomerRef = doc(collection(this.db, 'with_customer'));

    await runTransaction(this.db, async (tx) => {
      const shiftSnap = await tx.get(shiftRef);
      const activeSnap = await tx.get(activeRef);
      const lockSnap = await tx.get(lockRef);

      if (!shiftSnap.exists()) {
        throw new Error('Shift does not exist.');
      }

      const shiftData: any = shiftSnap.data();

      if (shiftData.actual_end_time !== null) {
        throw new Error('Shift is already completed.');
      }

      if (!activeSnap.exists()) {
        throw new Error('Salesperson is not active on floor.');
      }

      const withCustomerQuery = query(
        collection(this.db, 'with_customer'),
        where('salesperson_id', '==', salesperson_id)
      );

      const withCustomerSnap = await getDocs(withCustomerQuery);

      if (!withCustomerSnap.empty) {
        throw new Error('Salesperson is already with a customer.');
      }

      tx.set(withCustomerRef, {
        salesperson_id,
        start_time: serverTimestamp()
      });

      tx.update(shiftRef, {
        actual_end_time: serverTimestamp()
      });

      tx.delete(activeRef);

      if (
        lockSnap.exists() &&
        lockSnap.data()?.['shiftId'] === shiftId
      ) {
        tx.set(lockRef, { shiftId: null });
      }
    });

    await this.syncSingleSalesFloorActive(null);
  }

  async moveQueueToWithCustomer(
    salesperson_id: string,
    queueId: string
  ) {
    const queueRef = doc(this.db, 'queue', queueId);
    const activeRef = doc(this.db, 'sales_floor_active', salesperson_id);
    const withCustomerRef = doc(collection(this.db, 'with_customer'));

    await runTransaction(this.db, async (tx) => {
      const queueSnap = await tx.get(queueRef);
      const activeSnap = await tx.get(activeRef);

      if (!queueSnap.exists()) {
        throw new Error('Queue entry does not exist.');
      }

      const queueData: any = queueSnap.data();

      if (queueData.salesperson_id !== salesperson_id) {
        throw new Error('Queue entry does not belong to salesperson.');
      }

      if (activeSnap.exists()) {
        throw new Error('Salesperson is currently on floor.');
      }

      const withCustomerQuery = query(
        collection(this.db, 'with_customer'),
        where('salesperson_id', '==', salesperson_id)
      );

      const withCustomerSnap = await getDocs(withCustomerQuery);

      if (!withCustomerSnap.empty) {
        throw new Error('Salesperson is already with a customer.');
      }

      tx.set(withCustomerRef, {
        salesperson_id,
        start_time: serverTimestamp()
      });

      tx.delete(queueRef);
    });
  }

  async moveWithCustomerToQueue(
    salesperson_id: string,
    withCustomerId: string
  ) {
    const withCustomerRef = doc(
      this.db,
      'with_customer',
      withCustomerId
    );

    const activeRef = doc(
      this.db,
      'sales_floor_active',
      salesperson_id
    );

    await runTransaction(this.db, async (tx) => {
      const withSnap = await tx.get(withCustomerRef);
      const activeSnap = await tx.get(activeRef);

      if (!withSnap.exists()) {
        throw new Error('With-customer entry does not exist.');
      }

      const withData: any = withSnap.data();

      if (withData.salesperson_id !== salesperson_id) {
        throw new Error('With-customer entry does not belong to salesperson.');
      }

      if (activeSnap.exists()) {
        throw new Error('Salesperson is currently on floor.');
      }

      const queueQuery = query(
        collection(this.db, 'queue'),
        where('salesperson_id', '==', salesperson_id)
      );

      const queueSnap = await getDocs(queueQuery);

      if (!queueSnap.empty) {
        throw new Error('Salesperson is already in queue.');
      }

      const newQueueRef = doc(collection(this.db, 'queue'));

      tx.delete(withCustomerRef);

      tx.set(newQueueRef, {
        priority: false,
        request_time: serverTimestamp(),
        salesperson_id,
        notifiedFirst: false,
        notifiedSecond: false,
        notified2Min: false,
      });
    });
  }

  async getWithCustomers() {
    const querySnapshot = await getDocs(
      collection(this.db, 'with_customer')
    );

    const arr: any[] = [];

    querySnapshot.forEach(docItem => {
      arr.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return arr;
  }

  async removeWithCustomer(entryId: string) {
    const ref = doc(this.db, 'with_customer', entryId);
    await deleteDoc(ref);
  }

  async deleteQueueEntry(entryId: string) {
    const ref = doc(this.db, 'queue', entryId);
    await deleteDoc(ref);
  }

  async moveQueueEntry(
    entryId: string,
    direction: 'up' | 'down'
  ) {
    const qs = await getDocs(
      query(
        collection(this.db, 'queue'),
        orderBy('request_time', 'asc')
      )
    );

    const docs = qs.docs;
    const idx = docs.findIndex(d => d.id === entryId);

    if (idx === -1) return;

    let swapWith: any = null;

    if (direction === 'up' && idx > 0) {
      swapWith = docs[idx - 1];
    }

    if (direction === 'down' && idx < docs.length - 1) {
      swapWith = docs[idx + 1];
    }

    if (!swapWith) return;

    const currentDoc = docs[idx];
    const currentTime = currentDoc.data()['request_time'];
    const otherTime = swapWith.data()['request_time'];

    const batch = writeBatch(this.db);

    batch.update(currentDoc.ref, {
      request_time: otherTime
    });

    batch.update(swapWith.ref, {
      request_time: currentTime
    });

    await batch.commit();
  }

  async markQueueNotification(
    queueId: string,
    type: 'notifiedFirst' | 'notifiedSecond' | 'notified2Min'
  ): Promise<boolean> {
    const queueRef = doc(this.db, 'queue', queueId);
    let marked = false;

    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(queueRef);

      if (!snap.exists()) return;

      const data = snap.data();

      if (!data[type]) {
        tx.update(queueRef, {
          [type]: true
        });

        marked = true;
      }
    });

    return marked;
  }

  async markEmailSent(
    salespersonId: string,
    field: 'firstSent' | 'secondSent' | 'twoMinSent'
  ): Promise<boolean> {

    const fieldMap = {
      firstSent: 'notifiedFirst',
      secondSent: 'notifiedSecond',
      twoMinSent: 'notified2Min'
    };

    const firestoreField = fieldMap[field];

    const q = query(
      collection(this.db, 'queue'),
      where('salesperson_id', '==', salespersonId)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return false;
    }

    const userDoc = querySnapshot.docs[0];
    const ref = userDoc.ref;

    return await runTransaction(this.db, async (transaction) => {
      const snap = await transaction.get(ref);

      if (!snap.exists()) return false;

      const data = snap.data();

      if (data[firestoreField]) {
        return false;
      }

      transaction.update(ref, {
        [firestoreField]: true,
        [`${firestoreField}At`]: new Date()
      });

      return true;
    });
  }

  private async syncSingleSalesFloorActive(
    shiftId: string | null,
    salesperson_id?: string
  ): Promise<void> {
    const batch = writeBatch(this.db);

    const activeSnapshot = await getDocs(
      collection(this.db, 'sales_floor_active')
    );

    activeSnapshot.forEach((docItem) => {
      batch.delete(docItem.ref);
    });

    if (shiftId && salesperson_id) {
      const activeRef = doc(
        this.db,
        'sales_floor_active',
        salesperson_id
      );

      batch.set(activeRef, {
        shiftId
      });
    }

    await batch.commit();
  }

  // AREAS

  async getAreas() {
    const querySnapshot = await getDocs(collection(this.getUsersDb(), 'areas'));
    const areas: any[] = [];

    querySnapshot.forEach((docItem) => {
      areas.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return areas;
  }

  async addArea(area: any) {
    const areaRef = doc(this.getUsersDb(), 'areas', area.id);

    await updateDoc(areaRef, area).catch(async () => {
      await setDoc(areaRef, area);
    });
  }

  async deleteArea(areaId: string) {
    const areaRef = doc(this.getUsersDb(), 'areas', areaId);
    await deleteDoc(areaRef);
  }

  // SALES CALENDAR TAB

  async getSalesCalendars() {
    const querySnapshot = await getDocs(
      collection(this.getUsersDb(), 'sales_calendar')
    );

    const salesCalendars: any[] = [];

    querySnapshot.forEach((docItem) => {
      salesCalendars.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    return salesCalendars;
  }

  async addSalesCalendar(salesCalendar: any) {
    const salesCalendarRef = doc(
      this.getUsersDb(),
      'sales_calendar',
      salesCalendar.id
    );

    await updateDoc(salesCalendarRef, salesCalendar).catch(async () => {
      await setDoc(salesCalendarRef, salesCalendar);
    });
  }

  async deleteSalesCalendar(salesCalendarId: string) {
    const salesCalendarRef = doc(
      this.getUsersDb(),
      'sales_calendar',
      salesCalendarId
    );

    await deleteDoc(salesCalendarRef);
  }
}