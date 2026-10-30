import { createClient, SupabaseClient } from '@supabase/supabase-js';

import supabaseCoverMap from '../data/supabaseCoverMap.json';

// Supabase Project Configurations provided for Banca Geek
export const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL || 'https://urnxozvpirwotccsxwgu.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.dummy_fallback_key';

export const SUPABASE_STORAGE_BUCKET =
  import.meta.env?.VITE_SUPABASE_BUCKET || 'comics';

export const SUPABASE_COVERS_BUCKET =
  import.meta.env?.VITE_SUPABASE_COVERS_BUCKET || 'comic-covers';

export const SUPABASE_PROJECT_ID = 'urnxozvpirwotccsxwgu';
export const SUPABASE_PROJECT_NAME = 'banca-geek';

// Safe memory storage fallback when localStorage is blocked or restricted in preview iframes
const memoryStore = new Map<string, string>();
const safeStorageAdapter = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memoryStore.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {}
    memoryStore.set(key, value);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStore.delete(key);
  },
};

// Singleton Supabase Client with sandbox-safe options
export const supabase: SupabaseClient = (() => {
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: safeStorageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    console.warn('[Supabase] Falha ao inicializar com storage adapter, usando fallback:', err);
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
})();

export interface SupabaseStorageItem {
  name: string;
  id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: any;
}

/**
 * Validates connection with Supabase and specifically with bucket 'comics'
 */
export async function testSupabaseStorageConnection(): Promise<{
  connected: boolean;
  bucketExists: boolean;
  itemCount: number;
  files: SupabaseStorageItem[];
  message: string;
  error?: string;
}> {
  try {
    // 1. List files in 'comics' bucket
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .list('', { limit: 100, offset: 0 });

    if (error) {
      console.warn('[Supabase Storage] Aviso ao listar bucket comics:', error.message);
      // If error indicates bucket not found or permissions
      return {
        connected: true,
        bucketExists: false,
        itemCount: 0,
        files: [],
        message: `Conectado ao Supabase (${SUPABASE_PROJECT_NAME}), mas o bucket "${SUPABASE_STORAGE_BUCKET}" retornou: ${error.message}`,
        error: error.message,
      };
    }

    const files = (data || []).map((item) => ({
      name: item.name,
      id: item.id,
      updated_at: item.updated_at,
      created_at: item.created_at,
      metadata: item.metadata,
    }));

    return {
      connected: true,
      bucketExists: true,
      itemCount: files.length,
      files,
      message: `Conexão bem-sucedida! Bucket "${SUPABASE_STORAGE_BUCKET}" acessível com ${files.length} arquivos/pastas.`,
    };
  } catch (err: any) {
    console.error('[Supabase Storage] Erro na conexão:', err);
    return {
      connected: false,
      bucketExists: false,
      itemCount: 0,
      files: [],
      message: 'Falha ao conectar com o Supabase Storage.',
      error: err?.message || String(err),
    };
  }
}

/**
 * Returns public URL for a file in 'comics' bucket
 */
export function getSupabaseStoragePublicUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}

/**
 * Uploads a file (blob, buffer, text) to Supabase Storage in 'comics' bucket
 */
export async function uploadToSupabaseStorage(
  filePath: string,
  fileBody: Blob | File | string | ArrayBuffer,
  contentType: string = 'application/octet-stream',
  upsert: boolean = true
): Promise<{ success: boolean; path: string; publicUrl: string; error?: string }> {
  try {
    const cleanPath = filePath.replace(/^\/+/, '');
    const { data, error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(cleanPath, fileBody, {
        contentType,
        upsert,
      });

    if (error) {
      throw error;
    }

    const publicUrl = getSupabaseStoragePublicUrl(cleanPath);
    return {
      success: true,
      path: data?.path || cleanPath,
      publicUrl,
    };
  } catch (err: any) {
    console.error(`[Supabase Storage] Erro ao fazer upload de ${filePath}:`, err?.message || err);
    return {
      success: false,
      path: filePath,
      publicUrl: '',
      error: err?.message || String(err),
    };
  }
}

/**
 * Downloads a file as text or JSON from Supabase Storage
 */
export async function downloadFromSupabaseStorage(filePath: string): Promise<Blob | null> {
  try {
    const cleanPath = filePath.replace(/^\/+/, '');
    const { data, error } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).download(cleanPath);
    if (error || !data) return null;
    return data;
  } catch (err) {
    console.warn(`[Supabase Storage] Falha ao baixar ${filePath}:`, err);
    return null;
  }
}

/**
 * Returns public CDN URL for a cover in 'comic-covers' bucket
 */
export function getSupabaseCoverPublicUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  const { data } = supabase.storage.from(SUPABASE_COVERS_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}

/**
 * Resolves high-resolution cover URL from Supabase 'comic-covers' bucket without Google Drive
 */
export function getComicCoverFromSupabase(
  comicId: string,
  rawFileName?: string,
  title?: string
): string | null {
  if (!comicId) return null;

  // 1. Direct match in precomputed map
  const editionsMap = (supabaseCoverMap as any)?.editionsMap || {};
  const mapped = editionsMap[comicId];
  if (mapped) {
    return getSupabaseCoverPublicUrl(mapped);
  }

  // Helper for transliterated matching
  function cleanPt(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_([aeiou])_/gi, '$1')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const cleanNameMap = (supabaseCoverMap as any)?.cleanNameMap || {};

  // 2. Match by raw filename
  if (rawFileName) {
    const rawClean = cleanPt(rawFileName.replace(/\.[a-z0-9]+$/i, ''));
    if (cleanNameMap[rawClean]) {
      return getSupabaseCoverPublicUrl(cleanNameMap[rawClean]);
    }
  }

  // 3. Match by clean title
  if (title) {
    const titleClean = cleanPt(title);
    if (cleanNameMap[titleClean]) {
      return getSupabaseCoverPublicUrl(cleanNameMap[titleClean]);
    }
  }

  return null;
}

/**
 * Validates connection with Supabase 'comic-covers' bucket
 */
export async function testSupabaseCoversConnection(): Promise<{
  connected: boolean;
  bucketExists: boolean;
  itemCount: number;
  message: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.storage
      .from(SUPABASE_COVERS_BUCKET)
      .list('covers', { limit: 10 });

    if (error) {
      return {
        connected: true,
        bucketExists: false,
        itemCount: 0,
        message: `Bucket "${SUPABASE_COVERS_BUCKET}" retornou: ${error.message}`,
        error: error.message,
      };
    }

    const count = (supabaseCoverMap as any)?.totalBucketCovers || (data ? data.length : 0);
    return {
      connected: true,
      bucketExists: true,
      itemCount: count,
      message: `Bucket "${SUPABASE_COVERS_BUCKET}" conectado! ${count} capas disponíveis para visualização instantânea sem Google Drive.`,
    };
  } catch (err: any) {
    return {
      connected: false,
      bucketExists: false,
      itemCount: 0,
      message: 'Falha ao conectar ao bucket comic-covers.',
      error: err?.message || String(err),
    };
  }
}

