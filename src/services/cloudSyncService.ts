/**
 * Cloud Synchronization Service for Banca Geek using Supabase Storage ('comics')
 * Persists user state, reading progress, favorites, collection, bookmarks, and reviews directly in Supabase.
 */
import {
  supabase,
  SUPABASE_STORAGE_BUCKET,
  uploadToSupabaseStorage,
  downloadFromSupabaseStorage,
} from '../lib/supabase';
import {
  UserDatabaseState,
  ReadingProgressRecord,
  BookmarkItem,
  ComicReview,
  getDatabaseState,
} from './databaseService';
import { syncDatabaseStateToSupabaseStorage } from './supabaseService';

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
  isCloudConnected: true,
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

let syncDebounceTimer: any = null;

function triggerDebouncedSupabaseSync() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(async () => {
    updateStatus({ isSyncing: true });
    try {
      const state = getDatabaseState();
      await syncDatabaseStateToSupabaseStorage(state);
      updateStatus({
        isSyncing: false,
        isCloudConnected: true,
        lastCloudSync: new Date().toISOString(),
        syncError: null,
      });
    } catch (err: any) {
      updateStatus({ isSyncing: false, syncError: err?.message || 'Erro na sincronia' });
    }
  }, 1200);
}

/**
 * Initializes Supabase cloud sync for a user
 */
export function initUserCloudSync(userId: string, onCloudUpdate?: (state: UserDatabaseState) => void) {
  if (!userId) return;

  updateStatus({
    isCloudConnected: true,
    userId,
    isSyncing: true,
    syncError: null,
  });

  // Pull existing user state from Supabase Storage if available
  downloadFromSupabaseStorage(`users/${userId}/state.json`)
    .then(async (blob) => {
      if (blob) {
        const text = await blob.text();
        const cloudState = JSON.parse(text);
        if (cloudState && onCloudUpdate) {
          onCloudUpdate(cloudState);
        }
      }
      updateStatus({ isSyncing: false, lastCloudSync: new Date().toISOString() });
    })
    .catch(() => {
      updateStatus({ isSyncing: false });
    });

  // Send current state to Supabase
  syncLocalStateToCloud(userId).catch(() => {});
}

export function cleanupCloudSync() {
  updateStatus({ isCloudConnected: false, userId: null, isSyncing: false });
}

/**
 * Sync all local in-memory/disk state up to Supabase Storage
 */
export async function syncLocalStateToCloud(userId?: string): Promise<void> {
  const state = getDatabaseState();
  updateStatus({ isSyncing: true, syncError: null });

  try {
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // 1. Central database file in 'comics' bucket
    await uploadToSupabaseStorage('database/banca_geek_database.json', blob, 'application/json', true);

    // 2. User-specific snapshot in 'comics' bucket if user provided
    if (userId) {
      await uploadToSupabaseStorage(`users/${userId}/state.json`, blob, 'application/json', true);
    }

    updateStatus({
      isSyncing: false,
      isCloudConnected: true,
      lastCloudSync: new Date().toISOString(),
      syncError: null,
    });
  } catch (err: any) {
    console.warn('[Supabase Sync] Aviso ao sincronizar com storage:', err);
    updateStatus({ isSyncing: false, syncError: err?.message || 'Falha na sincronia' });
  }
}

/**
 * Cloud write helpers - optimistic local + background Supabase sync
 */
export async function pushCloudReadingProgress(record: ReadingProgressRecord): Promise<void> {
  triggerDebouncedSupabaseSync();
}

export async function pushCloudFavorite(comicId: string, isFavorite: boolean, title?: string): Promise<void> {
  triggerDebouncedSupabaseSync();
}

export async function pushCloudCollection(comicId: string, inCollection: boolean, title?: string): Promise<void> {
  triggerDebouncedSupabaseSync();
}

export async function pushCloudBookmark(bookmark: BookmarkItem, remove: boolean = false): Promise<void> {
  triggerDebouncedSupabaseSync();
}

export async function pushCloudReview(review: ComicReview): Promise<void> {
  triggerDebouncedSupabaseSync();
}

export async function pushCloudProfile(profile: any): Promise<void> {
  triggerDebouncedSupabaseSync();
}
