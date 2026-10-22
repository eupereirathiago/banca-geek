import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Singleton Firebase App initialization
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// High-Performance Firestore with persistent IndexedDB multi-tab local caching
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch (err) {
  // If already initialized, retrieve existing instance
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;

// Setup Google Auth Provider
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleAuthProvider.setCustomParameters({
  prompt: 'select_account',
});

// ----------------------------------------------------
// STANDARDIZED FIRESTORE ERROR HANDLING (Required by Skill)
// ----------------------------------------------------
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------
// CONNECTION VALIDATION (Mandated by Skill)
// ----------------------------------------------------
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase Cloud] Conexão com Firestore validada com sucesso.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Document not found on test collection is expected on initial empty DB
    console.log('[Firebase Cloud] Conexão inicial estabelecida.');
    return true;
  }
}

// Boot connection check
if (typeof window !== 'undefined') {
  validateFirestoreConnection().catch(() => {});
}

export { signInWithPopup, signOut };
