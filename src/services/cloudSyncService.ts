/**
 * Cloud Firestore Synchronization Service for Banca Geek
 * High-performance cloud persistence with multi-tier caching (RAM + IndexedDB + Server cache).
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import {
  UserDatabaseState,
  ReadingProgressRecord,
  BookmarkItem,
  ComicReview,
  ActivityLogItem,
  getDatabaseState,
} from './databaseService';

export interface CloudSyncStatus {
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastCloudSync: string | null;
  userId: string | null;
  pendingChangesCount: number;
  syncError: string | null;
}

let syncStatusListeners: ((status: CloudSyncStatus) => void)[] = [];
let currentStatus: CloudSyncStatus = {
  isCloudConnected: false,
  isSyncing: false,
  lastCloudSync: null,
  userId: null,
  pendingChangesCount: 0,
  syncError: null,
};

function updateStatus(delta: Partial<CloudSyncStatus>) {
  currentStatus = { ...currentStatus, ...delta };
  syncStatusListeners.forEach((fn) => fn(currentStatus));
}

export function subscribeToSyncStatus(listener: (status: CloudSyncStatus) => void): () => void {
  syncStatusListeners.push(listener);
  listener(currentStatus);
  return () => {
    syncStatusListeners = syncStatusListeners.filter((fn) => fn !== listener);
  };
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return currentStatus;
}

let activeSubscriptions: Unsubscribe[] = [];

/**
 * Initializes Cloud Firestore real-time synchronization for an authenticated user.
 */
export function initUserCloudSync(userId: string, onCloudUpdate?: (state: UserDatabaseState) => void) {
  // Clear any existing listeners
  cleanupCloudSync();

  if (!userId) return;

  updateStatus({
    isCloudConnected: true,
    userId,
    isSyncing: true,
    syncError: null,
  });

  try {
    // 1. Listen to Reading Progress subcollection
    const progPath = `users/${userId}/readingProgress`;
    const unsubProg = onSnapshot(
      collection(db, 'users', userId, 'readingProgress'),
      (snapshot) => {
        const state = getDatabaseState();
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as ReadingProgressRecord;
          if (change.type === 'added' || change.type === 'modified') {
            if (
              !state.readingProgress[data.comicId] ||
              new Date(data.updatedAt) > new Date(state.readingProgress[data.comicId].updatedAt)
            ) {
              state.readingProgress[data.comicId] = data;
              changed = true;
            }
          } else if (change.type === 'removed') {
            if (state.readingProgress[change.doc.id]) {
              delete state.readingProgress[change.doc.id];
              changed = true;
            }
          }
        });

        if (changed && onCloudUpdate) {
          onCloudUpdate(state);
        }
        updateStatus({ isSyncing: false, lastCloudSync: new Date().toISOString() });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, progPath);
      }
    );
    activeSubscriptions.push(unsubProg);

    // 2. Listen to Favorites subcollection
    const favPath = `users/${userId}/favorites`;
    const unsubFav = onSnapshot(
      collection(db, 'users', userId, 'favorites'),
      (snapshot) => {
        const state = getDatabaseState();
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as { comicId: string; addedAt: string; title?: string };
          if (change.type === 'added' || change.type === 'modified') {
            state.favorites[data.comicId] = data;
            changed = true;
          } else if (change.type === 'removed') {
            delete state.favorites[change.doc.id];
            changed = true;
          }
        });
        if (changed && onCloudUpdate) onCloudUpdate(state);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, favPath);
      }
    );
    activeSubscriptions.push(unsubFav);

    // 3. Listen to Collection shelf
    const colPath = `users/${userId}/collection`;
    const unsubCol = onSnapshot(
      collection(db, 'users', userId, 'collection'),
      (snapshot) => {
        const state = getDatabaseState();
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as { comicId: string; addedAt: string; title?: string };
          if (change.type === 'added' || change.type === 'modified') {
            state.collection[data.comicId] = data;
            changed = true;
          } else if (change.type === 'removed') {
            delete state.collection[change.doc.id];
            changed = true;
          }
        });
        if (changed && onCloudUpdate) onCloudUpdate(state);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, colPath);
      }
    );
    activeSubscriptions.push(unsubCol);

    // 4. Listen to Bookmarks
    const bmPath = `users/${userId}/bookmarks`;
    const unsubBm = onSnapshot(
      collection(db, 'users', userId, 'bookmarks'),
      (snapshot) => {
        const state = getDatabaseState();
        const currentBmMap = new Map(state.bookmarks.map((b) => [b.id, b]));
        let changed = false;

        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as BookmarkItem;
          if (change.type === 'added' || change.type === 'modified') {
            currentBmMap.set(data.id, data);
            changed = true;
          } else if (change.type === 'removed') {
            currentBmMap.delete(change.doc.id);
            changed = true;
          }
        });

        if (changed) {
          state.bookmarks = Array.from(currentBmMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          if (onCloudUpdate) onCloudUpdate(state);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, bmPath);
      }
    );
    activeSubscriptions.push(unsubBm);

    // 5. Listen to Reviews
    const revPath = `users/${userId}/reviews`;
    const unsubRev = onSnapshot(
      collection(db, 'users', userId, 'reviews'),
      (snapshot) => {
        const state = getDatabaseState();
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data() as ComicReview;
          if (change.type === 'added' || change.type === 'modified') {
            state.reviews[data.comicId] = data;
            changed = true;
          } else if (change.type === 'removed') {
            delete state.reviews[change.doc.id];
            changed = true;
          }
        });
        if (changed && onCloudUpdate) onCloudUpdate(state);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, revPath);
      }
    );
    activeSubscriptions.push(unsubRev);

    // Perform initial seed of any local cached items into the cloud if user just signed in
    syncLocalStateToCloud(userId).catch(() => {});
  } catch (err: any) {
    console.error('[CloudSync] Falha ao inicializar listeners:', err);
    updateStatus({ isSyncing: false, syncError: err?.message || 'Erro na sincronia' });
  }
}

export function cleanupCloudSync() {
  activeSubscriptions.forEach((unsub) => {
    try {
      unsub();
    } catch {}
  });
  activeSubscriptions = [];
  updateStatus({ isCloudConnected: false, userId: null, isSyncing: false });
}

/**
 * Sync all local in-memory/disk state up to Cloud Firestore
 */
export async function syncLocalStateToCloud(userId: string): Promise<void> {
  if (!userId || !auth.currentUser) return;

  const state = getDatabaseState();
  updateStatus({ isSyncing: true, syncError: null });

  try {
    // 1. Reading Progress
    const progressEntries = Object.entries(state.readingProgress);
    for (const [comicId, prog] of progressEntries) {
      const cleanComicId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const targetPath = `users/${userId}/readingProgress/${cleanComicId}`;
      try {
        await setDoc(
          doc(db, 'users', userId, 'readingProgress', cleanComicId),
          {
            comicId: cleanComicId,
            userId,
            currentPage: Number(prog.currentPage) || 1,
            totalPages: Number(prog.totalPages) || 36,
            progressPercent: Number(prog.progressPercent) || 0,
            isCompleted: Boolean(prog.isCompleted),
            comicTitle: (prog.comicTitle || '').slice(0, 200),
            updatedAt: prog.updatedAt || new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, targetPath);
      }
    }

    // 2. Favorites
    for (const [comicId, fav] of Object.entries(state.favorites)) {
      const cleanComicId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const targetPath = `users/${userId}/favorites/${cleanComicId}`;
      try {
        await setDoc(
          doc(db, 'users', userId, 'favorites', cleanComicId),
          {
            comicId: cleanComicId,
            userId,
            title: (fav.title || '').slice(0, 200),
            addedAt: fav.addedAt || new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, targetPath);
      }
    }

    // 3. Collection
    for (const [comicId, col] of Object.entries(state.collection)) {
      const cleanComicId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const targetPath = `users/${userId}/collection/${cleanComicId}`;
      try {
        await setDoc(
          doc(db, 'users', userId, 'collection', cleanComicId),
          {
            comicId: cleanComicId,
            userId,
            title: (col.title || '').slice(0, 200),
            addedAt: col.addedAt || new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, targetPath);
      }
    }

    // 4. Bookmarks
    for (const bm of state.bookmarks) {
      const cleanBmId = bm.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const cleanComicId = bm.comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const targetPath = `users/${userId}/bookmarks/${cleanBmId}`;
      try {
        await setDoc(
          doc(db, 'users', userId, 'bookmarks', cleanBmId),
          {
            id: cleanBmId,
            comicId: cleanComicId,
            userId,
            comicTitle: (bm.comicTitle || '').slice(0, 200),
            pageNumber: Number(bm.pageNumber) || 1,
            note: (bm.note || '').slice(0, 500),
            createdAt: bm.createdAt || new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, targetPath);
      }
    }

    // 5. Reviews
    for (const [comicId, rev] of Object.entries(state.reviews)) {
      const cleanComicId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const targetPath = `users/${userId}/reviews/${cleanComicId}`;
      try {
        await setDoc(
          doc(db, 'users', userId, 'reviews', cleanComicId),
          {
            comicId: cleanComicId,
            userId,
            comicTitle: (rev.comicTitle || '').slice(0, 200),
            rating: Math.max(1, Math.min(5, Number(rev.rating) || 5)),
            reviewText: (rev.reviewText || '').slice(0, 2000),
            updatedAt: rev.updatedAt || new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, targetPath);
      }
    }

    // 6. User Profile sync
    const profileRaw = localStorage.getItem('banca_geek_user_profile');
    if (profileRaw) {
      try {
        const p = JSON.parse(profileRaw);
        const targetPath = `users/${userId}`;
        await setDoc(
          doc(db, 'users', userId),
          {
            userId,
            name: (p.name || 'LEITOR').slice(0, 100),
            readBadge: (p.readBadge || 'INICIANTE').slice(0, 150),
            readingMilestone: (p.readingMilestone || 'NÍVEL 1').slice(0, 100),
            avatarUrl: (p.avatarUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5').slice(0, 500),
            readIssuesCount: Number(p.readIssuesCount) || 0,
            nextMilestoneCount: Number(p.nextMilestoneCount) || 10,
            nextBadgeName: (p.nextBadgeName || '').slice(0, 150),
            completedSagasCount: Number(p.completedSagasCount) || 0,
            favoritePublisher: (p.favoritePublisher || 'DC Comics').slice(0, 100),
            bio: (p.bio || '').slice(0, 500),
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }
    }

    updateStatus({
      isSyncing: false,
      lastCloudSync: new Date().toISOString(),
      syncError: null,
    });
  } catch (err: any) {
    console.warn('[CloudSync] Erro na sincronia em lote:', err);
    updateStatus({ isSyncing: false, syncError: err?.message || 'Falha na sincronia' });
  }
}

/**
 * Cloud write helper for single progress updates (Optimistic local + background cloud write)
 */
export async function pushCloudReadingProgress(record: ReadingProgressRecord): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const cleanComicId = record.comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${user.uid}/readingProgress/${cleanComicId}`;

  try {
    await setDoc(
      doc(db, 'users', user.uid, 'readingProgress', cleanComicId),
      {
        comicId: cleanComicId,
        userId: user.uid,
        currentPage: record.currentPage,
        totalPages: record.totalPages,
        progressPercent: record.progressPercent,
        isCompleted: record.isCompleted,
        comicTitle: (record.comicTitle || '').slice(0, 200),
        updatedAt: record.updatedAt || new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Cloud write helper for favorites
 */
export async function pushCloudFavorite(comicId: string, isFavorite: boolean, title?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const cleanComicId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${user.uid}/favorites/${cleanComicId}`;

  try {
    if (isFavorite) {
      await setDoc(doc(db, 'users', user.uid, 'favorites', cleanComicId), {
        comicId: cleanComicId,
        userId: user.uid,
        title: (title || '').slice(0, 200),
        addedAt: new Date().toISOString(),
      });
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'favorites', cleanComicId));
    }
  } catch (error) {
    handleFirestoreError(error, isFavorite ? OperationType.WRITE : OperationType.DELETE, path);
  }
}

/**
 * Cloud write helper for shelf collection
 */
export async function pushCloudCollection(comicId: string, inCollection: boolean, title?: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const cleanComicId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${user.uid}/collection/${cleanComicId}`;

  try {
    if (inCollection) {
      await setDoc(doc(db, 'users', user.uid, 'collection', cleanComicId), {
        comicId: cleanComicId,
        userId: user.uid,
        title: (title || '').slice(0, 200),
        addedAt: new Date().toISOString(),
      });
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'collection', cleanComicId));
    }
  } catch (error) {
    handleFirestoreError(error, inCollection ? OperationType.WRITE : OperationType.DELETE, path);
  }
}

/**
 * Cloud write helper for bookmarks
 */
export async function pushCloudBookmark(bookmark: BookmarkItem, remove: boolean = false): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const cleanBmId = bookmark.id.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const cleanComicId = bookmark.comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${user.uid}/bookmarks/${cleanBmId}`;

  try {
    if (remove) {
      await deleteDoc(doc(db, 'users', user.uid, 'bookmarks', cleanBmId));
    } else {
      await setDoc(doc(db, 'users', user.uid, 'bookmarks', cleanBmId), {
        id: cleanBmId,
        comicId: cleanComicId,
        userId: user.uid,
        comicTitle: (bookmark.comicTitle || '').slice(0, 200),
        pageNumber: bookmark.pageNumber,
        note: (bookmark.note || '').slice(0, 500),
        createdAt: bookmark.createdAt || new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, remove ? OperationType.DELETE : OperationType.WRITE, path);
  }
}

/**
 * Cloud write helper for reviews
 */
export async function pushCloudReview(review: ComicReview): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const cleanComicId = review.comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const path = `users/${user.uid}/reviews/${cleanComicId}`;

  try {
    await setDoc(doc(db, 'users', user.uid, 'reviews', cleanComicId), {
      comicId: cleanComicId,
      userId: user.uid,
      comicTitle: (review.comicTitle || '').slice(0, 200),
      rating: review.rating,
      reviewText: (review.reviewText || '').slice(0, 2000),
      updatedAt: review.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Cloud & Server persistence helper for user profile
 */
export async function pushCloudProfile(profile: any): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    fetch('/api/db/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }).catch(() => {});
    return;
  }

  const uid = user.uid;
  const targetPath = `users/${uid}`;

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        userId: uid,
        name: (profile.name || 'LEITOR').slice(0, 100),
        readBadge: (profile.readBadge || 'SELO INICIANTE').slice(0, 150),
        readingMilestone: (profile.readingMilestone || 'COMEÇANDO DO ZERO').slice(0, 100),
        avatarUrl: profile.avatarUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&q=80',
        readIssuesCount: Number(profile.readIssuesCount) || 0,
        nextMilestoneCount: Number(profile.nextMilestoneCount) || 1,
        nextBadgeName: (profile.nextBadgeName || 'PRIMEIRA LEITURA').slice(0, 150),
        completedSagasCount: Number(profile.completedSagasCount) || 0,
        favoritePublisher: (profile.favoritePublisher || 'DC Comics').slice(0, 100),
        bio: (profile.bio || '').slice(0, 500),
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn('[CloudSync] Aviso ao gravar perfil no Firestore:', error);
  }

  // Also sync to server backend database
  fetch('/api/db/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  }).catch(() => {});
}

