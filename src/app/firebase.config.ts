// firebase.config.ts

import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { environment } from '../app/environments/environment';

const firebaseConfig = {
  apiKey: environment.firebase.apiKey,
  authDomain: environment.firebase.authDomain,
  projectId: environment.firebase.projectId,
  storageBucket: environment.firebase.storageBucket,
  messagingSenderId: environment.firebase.messagingSenderId,
  appId: environment.firebase.appId,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Si NO mandas nombre de DB:
 * usa la default del environment (comportamiento actual)
 *
 * Si mandas nombre:
 * usa esa database específica
 */
export function getDynamicDb(databaseName?: string): Firestore {
  if (databaseName && databaseName.trim() !== '') {
    return getFirestore(app, databaseName);
  }

  if (environment.firebase.firestoreDb) {
    return getFirestore(app, environment.firebase.firestoreDb);
  }

  return getFirestore(app);
}

export { app, auth };