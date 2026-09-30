// import { addDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
// import { db } from '../firebase.config';

// export async function logWithCustomerHistory(salesperson_id: string, entry: Date, exit: Date) {
//   const q = query(
//     collection(db, 'with_customer_history'),
//     where('salesperson_id', '==', salesperson_id),
//     where('entry', '==', entry),
//     where('exit', '==', exit)
//   );
//   const snapshot = await getDocs(q);
//   if (!snapshot.empty) return; 

//   await addDoc(collection(db, 'with_customer_history'), {
//     salesperson_id,
//     entry,
//     exit,
//     created_at: serverTimestamp(),
//   });
// }

// export async function getWithCustomerHistory() {
//   const querySnapshot = await getDocs(collection(db, 'with_customer_history'));
//   const arr: any[] = [];
//   querySnapshot.forEach(doc => {
//     arr.push({ id: doc.id, ...doc.data() });
//   });
//   return arr;
// }
