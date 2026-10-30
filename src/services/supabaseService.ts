/**
 * Supabase Storage & Database Integration Service for Banca Geek
 * Handles cloud persistence in bucket 'comics' (database snapshots, covers, archives, and user profiles)
 */
import {
  supabase,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_COVERS_BUCKET,
  SUPABASE_PROJECT_ID,
  SUPABASE_PROJECT_NAME,
  testSupabaseStorageConnection,
  testSupabaseCoversConnection,
  uploadToSupabaseStorage,
  downloadFromSupabaseStorage,
  getSupabaseStoragePublicUrl,
  getSupabaseCoverPublicUrl,
  getComicCoverFromSupabase,
  SupabaseStorageItem,
} from '../lib/supabase';
import { UserDatabaseState, getDatabaseState } from './databaseService';

export interface SupabaseSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  bucket: string;
  coversBucket: string;
  isCoversConnected: boolean;
  coversInBucket: number;
  projectId: string;
  projectName: string;
  lastSyncTime: string | null;
  filesInBucket: number;
  files: SupabaseStorageItem[];
  error: string | null;
}

let syncState: SupabaseSyncState = {
  isConnected: false,
  isSyncing: false,
  bucket: SUPABASE_STORAGE_BUCKET,
  coversBucket: SUPABASE_COVERS_BUCKET,
  isCoversConnected: false,
  coversInBucket: 2395,
  projectId: SUPABASE_PROJECT_ID,
  projectName: SUPABASE_PROJECT_NAME,
  lastSyncTime: null,
  filesInBucket: 0,
  files: [],
  error: null,
};

type SyncListener = (state: SupabaseSyncState) => void;
const syncListeners: SyncListener[] = [];

function notifyListeners() {
  syncListeners.forEach((l) => l({ ...syncState }));
}

export function subscribeToSupabaseSync(listener: SyncListener): () => void {
  syncListeners.push(listener);
  listener({ ...syncState });
  return () => {
    const idx = syncListeners.indexOf(listener);
    if (idx !== -1) syncListeners.splice(idx, 1);
  };
}

export function getSupabaseSyncState(): SupabaseSyncState {
  return { ...syncState };
}

/**
 * Initializes and validates Supabase Storage connection
 */
export async function initSupabaseStorage(): Promise<SupabaseSyncState> {
  syncState.isSyncing = true;
  notifyListeners();

  try {
    const [testResult, coversResult] = await Promise.all([
      testSupabaseStorageConnection(),
      testSupabaseCoversConnection(),
    ]);

    syncState.isConnected = testResult.connected;
    syncState.filesInBucket = testResult.itemCount;
    syncState.files = testResult.files;
    syncState.isCoversConnected = coversResult.connected && coversResult.bucketExists;
    syncState.coversInBucket = coversResult.itemCount || 2395;
    syncState.error = testResult.error || coversResult.error || null;
    syncState.isSyncing = false;
    syncState.lastSyncTime = new Date().toISOString();
    notifyListeners();

    // In background, sync server database with Supabase Storage
    syncServerDatabaseWithSupabase().catch(() => {});
  } catch (err: any) {
    syncState.isConnected = false;
    syncState.isSyncing = false;
    syncState.error = err?.message || 'Falha na conexão';
    notifyListeners();
  }

  return { ...syncState };
}

/**
 * Synchronize full user database state to Supabase Storage bucket 'comics'
 * Saved under 'database/banca_geek_database.json'
 */
export async function syncDatabaseStateToSupabaseStorage(
  state?: UserDatabaseState
): Promise<{ success: boolean; url?: string; error?: string }> {
  const data = state || getDatabaseState();
  syncState.isSyncing = true;
  notifyListeners();

  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const result = await uploadToSupabaseStorage(
      'database/banca_geek_database.json',
      blob,
      'application/json',
      true
    );

    if (result.success) {
      syncState.isConnected = true;
      syncState.isSyncing = false;
      syncState.lastSyncTime = new Date().toISOString();
      syncState.error = null;
      notifyListeners();

      // Trigger backend sync as well
      fetch('/api/supabase/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: data }),
      }).catch(() => {});

      return { success: true, url: result.publicUrl };
    } else {
      throw new Error(result.error || 'Falha ao sincronizar');
    }
  } catch (err: any) {
    syncState.isSyncing = false;
    syncState.error = err?.message || 'Erro ao sincronizar dados';
    notifyListeners();
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Pull latest database snapshot from Supabase Storage
 */
export async function fetchDatabaseFromSupabaseStorage(): Promise<UserDatabaseState | null> {
  try {
    const blob = await downloadFromSupabaseStorage('database/banca_geek_database.json');
    if (!blob) return null;
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.warn('[Supabase Storage] Não foi possível ler banco da nuvem:', err);
    return null;
  }
}

/**
 * Calls backend endpoint to verify and sync with Supabase
 */
export async function syncServerDatabaseWithSupabase(): Promise<any> {
  try {
    const res = await fetch('/api/supabase/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}
  return null;
}

/**
 * Upload a comic cover to Supabase Storage
 */
export async function uploadCoverToSupabase(
  comicId: string,
  base64OrBlob: string | Blob,
  mimeType: string = 'image/jpeg'
): Promise<string | null> {
  try {
    let blob: Blob;
    if (typeof base64OrBlob === 'string') {
      const base64Data = base64OrBlob.replace(/^data:image\/\w+;base64,/, '');
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: mimeType });
    } else {
      blob = base64OrBlob;
    }

    const cleanId = comicId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const filePath = `covers/${cleanId}.${ext}`;

    // Upload directly to public comic-covers bucket
    const { data, error } = await supabase.storage
      .from(SUPABASE_COVERS_BUCKET)
      .upload(filePath, blob, { contentType: mimeType, upsert: true });

    if (!error && data) {
      return getSupabaseCoverPublicUrl(filePath);
    }

    // Fallback to comics bucket if needed
    const res = await uploadToSupabaseStorage(filePath, blob, mimeType, true);
    if (res.success) {
      return res.publicUrl;
    }
  } catch (err) {
    console.warn('[Supabase Storage] Erro ao enviar capa:', err);
  }
  return null;
}

/**
 * List files inside the Supabase Storage bucket 'comics'
 */
export async function listSupabaseComicsFiles(folder: string = ''): Promise<SupabaseStorageItem[]> {
  try {
    const cleanFolder = folder.replace(/^\/+/, '');
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .list(cleanFolder, { limit: 100, sortBy: { column: 'name', order: 'asc' } });

    if (error || !data) return [];
    return data.map((d) => ({
      name: d.name,
      id: d.id,
      updated_at: d.updated_at,
      created_at: d.created_at,
      metadata: d.metadata,
    }));
  } catch {
    return [];
  }
}
