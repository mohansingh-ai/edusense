import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// CRITICAL: Ensure we pass firestoreDatabaseId and use HTTP long-polling for standard stability in frame preview
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth();

export let isFirestoreOffline = false;

// Validate Connection as mandated by the Firebase Integration Skill
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    const err = error as any;
    if (err && (err.code === 'unavailable' || err.message?.includes('offline') || err.message?.includes('reach Cloud Firestore') || err.message?.includes('Could not reach'))) {
      isFirestoreOffline = true;
      console.warn("Firebase test connection is offline. Running in offline fallback mode.");
    } else {
      console.log("Firebase connection test ping (expected if document is absent, is normal).");
    }
  }
}

testConnection();

// Error handler code pattern matching the Firebase Integration Skill instructions
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const isPermissionError = 
    error instanceof Error && 
    (error.message.includes("permission") || 
     error.message.includes("Permission") || 
     error.message.includes("insufficient") || 
     (error as any).code === "permission-denied");

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isPermissionError) {
    console.error('Firestore Permission Error Payload: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn('Firestore Non-blocking Warning Payload: ', JSON.stringify(errInfo));
  }
}
