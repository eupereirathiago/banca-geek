import {
  auth as firebaseAuth,
  googleAuthProvider,
  signInWithPopup,
  signOut,
} from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export interface AppUser {
  uid: string;
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
}

function mapFirebaseUser(u: FirebaseUser | null): AppUser | null {
  if (!u) return null;
  return {
    uid: u.uid,
    id: u.uid,
    email: u.email || undefined,
    displayName:
      u.displayName ||
      u.email?.split('@')[0] ||
      'Leitor',
    photoURL:
      u.photoURL ||
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=250&q=80',
  };
}

// Authentication shim compatible with existing components
export const auth = {
  get currentUser(): AppUser | null {
    return mapFirebaseUser(firebaseAuth.currentUser);
  },
  onAuthStateChanged(callback: (user: AppUser | null) => void) {
    return onAuthStateChanged(firebaseAuth, (user) => {
      callback(mapFirebaseUser(user));
    });
  },
};

export const initAuth = (
  onAuthSuccess?: (user: AppUser, token?: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
      const appUser = mapFirebaseUser(user)!;
      let token = '';
      try {
        token = await user.getIdToken();
      } catch {}
      if (onAuthSuccess) onAuthSuccess(appUser, token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Real Google Account sign in with popup via Firebase Auth
 */
export const googleSignIn = async (): Promise<{ user: AppUser; accessToken?: string } | null> => {
  try {
    const credential = await signInWithPopup(firebaseAuth, googleAuthProvider);
    const user = credential.user;
    const token = await user.getIdToken();
    const appUser = mapFirebaseUser(user)!;
    return { user: appUser, accessToken: token };
  } catch (err: any) {
    console.error('[Firebase Google Auth] Erro ao entrar:', err);
    if (err?.code === 'auth/unauthorized-domain') {
      err.isDomainError = true;
      openDomainHelpModal();
    }
    throw err;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!firebaseAuth.currentUser) return null;
  try {
    return await firebaseAuth.currentUser.getIdToken();
  } catch {
    return null;
  }
};

export const logout = async () => {
  await signOut(firebaseAuth);
};

export function getAuthErrorMessage(err: unknown): string {
  const code = (err as any)?.code;
  if (code === 'auth/popup-closed-by-user') {
    return 'Janela de login fechada antes da confirmação.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Tentativa anterior cancelada.';
  }
  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou a janela pop-up do Google. Permita pop-ups no seu navegador para entrar.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'Domínio não autorizado no Firebase Console. Adicione este endereço aos Authorized Domains do Firebase.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha na conexão de rede ao comunicar com os servidores Google.';
  }
  return (err as any)?.message || 'Erro ao realizar login com o Google.';
}

type DomainErrorListener = (isOpen: boolean, currentDomain: string) => void;
const domainListeners: DomainErrorListener[] = [];
let isDomainModalOpen = false;

export function openDomainHelpModal() {
  isDomainModalOpen = true;
  const domain = typeof window !== 'undefined' ? window.location.hostname : '';
  domainListeners.forEach((fn) => fn(true, domain));
}

export function closeDomainHelpModal() {
  isDomainModalOpen = false;
  domainListeners.forEach((fn) => fn(false, ''));
}

export function subscribeToDomainErrors(listener: DomainErrorListener) {
  domainListeners.push(listener);
  return () => {
    const idx = domainListeners.indexOf(listener);
    if (idx !== -1) domainListeners.splice(idx, 1);
  };
}
