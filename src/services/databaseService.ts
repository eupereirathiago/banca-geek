/**
 * Banca Geek Persistent Database Service
 * Persists all user actions, reading progress, favorites, bookmarks,
 * ratings, notes, AI synopses, and activity timeline.
 * Syncs seamlessly between localStorage (offline) and the backend database.
 */

import {
  pushCloudReadingProgress,
  pushCloudFavorite,
  pushCloudCollection,
  pushCloudBookmark,
  pushCloudReview,
} from './cloudSyncService';

export interface ReadingProgressRecord {
  comicId: string;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  isCompleted: boolean;
  updatedAt: string;
  comicTitle?: string;
  timeSpentSeconds?: number;
}

export interface BookmarkItem {
  id: string;
  comicId: string;
  comicTitle: string;
  pageNumber: number;
  note?: string;
  createdAt: string;
}

export interface ComicReview {
  comicId: string;
  comicTitle?: string;
  rating: number; // 1 to 5
  reviewText: string;
  updatedAt: string;
}

export interface AiSynopsisData {
  comicId: string;
  synopsis: string;
  logline: string;
  mainCharacters: string[];
  tone: string;
  historicalContext: string;
  recommendedFor?: string;
  generatedAt: string;
}

export interface ActivityLogItem {
  id: string;
  type:
    | 'read_start'
    | 'read_progress'
    | 'read_complete'
    | 'favorite_added'
    | 'favorite_removed'
    | 'collection_added'
    | 'collection_removed'
    | 'bookmark_added'
    | 'bookmark_removed'
    | 'review_added'
    | 'ai_synopsis_generated'
    | 'comic_uploaded';
  title: string;
  description: string;
  comicId?: string;
  comicTitle?: string;
  timestamp: string;
  metadata?: any;
}

export interface UserDatabaseState {
  version: number;
  lastUpdated: string;
  readingProgress: Record<string, ReadingProgressRecord>;
  favorites: Record<string, { comicId: string; addedAt: string; title?: string }>;
  collection: Record<string, { comicId: string; addedAt: string; title?: string }>;
  bookmarks: BookmarkItem[];
  reviews: Record<string, ComicReview>;
  aiSynopses: Record<string, AiSynopsisData>;
  activities: ActivityLogItem[];
  customComics: any[];
  covers: Record<string, { comicId: string; coverDataUrl?: string; mimeType: string; extractedAt: string; title?: string }>;
  settings: {
    readerTheme: 'dark' | 'sepia' | 'light' | 'midnight';
    readingMode: 'single' | 'double' | 'webtoon';
    fitMode: 'contain' | 'width' | 'height';
    autoAdvance: boolean;
    autoAdvanceSeconds: number;
  };
}

const LOCAL_STORAGE_DB_KEY = 'banca_geek_persistent_db_v5';

const DEFAULT_STATE: UserDatabaseState = {
  version: 5,
  lastUpdated: new Date().toISOString(),
  readingProgress: {},
  favorites: {},
  collection: {},
  bookmarks: [],
  reviews: {},
  aiSynopses: {},
  activities: [
    {
      id: 'act-init-001',
      type: 'comic_uploaded',
      title: 'Estante Conectada',
      description: 'Sua estante pessoal e histórico de leitura foram configurados com sucesso.',
      timestamp: new Date().toISOString(),
    },
  ],
  customComics: [],
  covers: {},
  settings: {
    readerTheme: 'dark',
    readingMode: 'single',
    fitMode: 'contain',
    autoAdvance: false,
    autoAdvanceSeconds: 8,
  },
};

// In-memory state cache
let memoryState: UserDatabaseState | null = null;
let syncScheduled = false;

function loadLocalState(): UserDatabaseState {
  if (memoryState) return memoryState;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryState = { ...DEFAULT_STATE, ...parsed };
      return memoryState!;
    }
  } catch (err) {
    console.warn('[DB Service] Erro ao carregar do localStorage:', err);
  }
  memoryState = { ...DEFAULT_STATE };
  return memoryState;
}

function persistLocalState(state: UserDatabaseState) {
  state.lastUpdated = new Date().toISOString();
  memoryState = state;
  try {
    localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('[DB Service] Falha ao persistir no localStorage:', err);
  }
  scheduleServerSync();
}

function scheduleServerSync() {
  if (syncScheduled) return;
  syncScheduled = true;
  setTimeout(async () => {
    syncScheduled = false;
    await syncWithServerDatabase();
  }, 1000);
}

/**
 * Synchronize state with persistent backend database
 */
export async function syncWithServerDatabase(): Promise<UserDatabaseState> {
  const local = loadLocalState();
  try {
    const response = await fetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(local),
    });
    if (response.ok) {
      const serverState = await response.json();
      if (serverState && serverState.success && serverState.data) {
        memoryState = serverState.data;
        try {
          localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(memoryState));
        } catch {}
        return memoryState!;
      }
    }
  } catch (err) {
    console.debug('[DB Service] Servidor offline ou em sincronia pendente:', err);
  }
  return local;
}

/**
 * Fetch full database state from server or fallback to local
 */
export async function fetchFullDatabase(): Promise<UserDatabaseState> {
  try {
    const resp = await fetch('/api/db/state');
    if (resp.ok) {
      const res = await resp.json();
      if (res.success && res.data) {
        memoryState = res.data;
        try {
          localStorage.setItem(LOCAL_STORAGE_DB_KEY, JSON.stringify(memoryState));
        } catch {}
        return memoryState!;
      }
    }
  } catch {}
  return loadLocalState();
}

export function getDatabaseState(): UserDatabaseState {
  return loadLocalState();
}

/**
 * Save Reading Progress & auto-log activity
 */
export function recordReadingProgress(
  comicId: string,
  pageNumber: number,
  totalPages: number = 36,
  comicTitle?: string,
  timeSpentSeconds?: number
): ReadingProgressRecord {
  const state = loadLocalState();
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(pageNumber, safeTotal));
  const percent = Math.round((safePage / safeTotal) * 100);
  const isCompleted = safePage >= safeTotal;
  const now = new Date().toISOString();

  const prev = state.readingProgress[comicId];
  const record: ReadingProgressRecord = {
    comicId,
    currentPage: safePage,
    totalPages: safeTotal,
    progressPercent: percent,
    isCompleted,
    updatedAt: now,
    comicTitle: comicTitle || prev?.comicTitle,
    timeSpentSeconds: (prev?.timeSpentSeconds || 0) + (timeSpentSeconds || 0),
  };

  state.readingProgress[comicId] = record;

  // Log activity if completed or milestone reached
  if (isCompleted && (!prev || !prev.isCompleted)) {
    addActivityLog({
      type: 'read_complete',
      title: 'HQ Concluída! 🏆',
      description: `Você leu todas as ${safeTotal} páginas de "${comicTitle || 'Edição'}".`,
      comicId,
      comicTitle,
    });
  } else if (!prev || prev.currentPage !== safePage) {
    if (safePage === 1 && !prev) {
      addActivityLog({
        type: 'read_start',
        title: 'Iniciou Leitura',
        description: `Começou a ler "${comicTitle || 'Edição'}" na página 1.`,
        comicId,
        comicTitle,
      });
    }
  }

  persistLocalState(state);

  // Sync to Cloud Firestore in background
  pushCloudReadingProgress(record).catch(() => {});

  // Fire individual endpoint in background for ACID persistence
  fetch('/api/db/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  }).catch(() => {});

  return record;
}

/**
 * Toggle Favorite status
 */
export function toggleFavoriteItem(comicId: string, title?: string): boolean {
  const state = loadLocalState();
  const exists = Boolean(state.favorites[comicId]);
  const now = new Date().toISOString();

  if (exists) {
    delete state.favorites[comicId];
    addActivityLog({
      type: 'favorite_removed',
      title: 'Removido dos Favoritos',
      description: `"${title || 'Edição'}" foi removida dos seus favoritos.`,
      comicId,
      comicTitle: title,
    });
  } else {
    state.favorites[comicId] = { comicId, addedAt: now, title };
    addActivityLog({
      type: 'favorite_added',
      title: 'Adicionado aos Favoritos ⭐',
      description: `"${title || 'Edição'}" foi salva na sua lista de favoritos.`,
      comicId,
      comicTitle: title,
    });
  }

  persistLocalState(state);

  // Sync to Cloud Firestore in background
  pushCloudFavorite(comicId, !exists, title).catch(() => {});

  fetch('/api/db/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comicId, title, isFavorite: !exists }),
  }).catch(() => {});

  return !exists;
}

/**
 * Toggle Collection status
 */
export function toggleCollectionItem(comicId: string, title?: string): boolean {
  const state = loadLocalState();
  const exists = Boolean(state.collection[comicId]);
  const now = new Date().toISOString();

  if (exists) {
    delete state.collection[comicId];
    addActivityLog({
      type: 'collection_removed',
      title: 'Removido da Estante',
      description: `"${title || 'Edição'}" foi removida da sua estante pessoal.`,
      comicId,
      comicTitle: title,
    });
  } else {
    state.collection[comicId] = { comicId, addedAt: now, title };
    addActivityLog({
      type: 'collection_added',
      title: 'Adicionado à Estante 📚',
      description: `"${title || 'Edição'}" foi catalogada na sua estante.`,
      comicId,
      comicTitle: title,
    });
  }

  persistLocalState(state);

  // Sync to Cloud Firestore in background
  pushCloudCollection(comicId, !exists, title).catch(() => {});

  fetch('/api/db/collection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comicId, title, inCollection: !exists }),
  }).catch(() => {});

  return !exists;
}

/**
 * Bookmarks: Add & Remove
 */
export function addBookmarkItem(
  comicId: string,
  pageNumber: number,
  comicTitle: string,
  note?: string
): BookmarkItem {
  const state = loadLocalState();
  const item: BookmarkItem = {
    id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    comicId,
    comicTitle,
    pageNumber,
    note,
    createdAt: new Date().toISOString(),
  };

  // Keep max 100 bookmarks
  state.bookmarks = [item, ...state.bookmarks.filter((b) => !(b.comicId === comicId && b.pageNumber === pageNumber))].slice(0, 100);

  addActivityLog({
    type: 'bookmark_added',
    title: 'Marcador de Página Criado 🔖',
    description: `Marcada página ${pageNumber} de "${comicTitle}".`,
    comicId,
    comicTitle,
  });

  persistLocalState(state);

  // Sync to Cloud Firestore in background
  pushCloudBookmark(item, false).catch(() => {});

  fetch('/api/db/bookmark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', bookmark: item }),
  }).catch(() => {});

  return item;
}

export function removeBookmarkItem(bookmarkId: string) {
  const state = loadLocalState();
  const target = state.bookmarks.find((b) => b.id === bookmarkId);
  state.bookmarks = state.bookmarks.filter((b) => b.id !== bookmarkId);
  persistLocalState(state);

  if (target) {
    pushCloudBookmark(target, true).catch(() => {});
  }

  fetch('/api/db/bookmark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', bookmarkId }),
  }).catch(() => {});
}

/**
 * Rating & Personal Review
 */
export function saveRatingAndReview(
  comicId: string,
  rating: number,
  reviewText: string,
  comicTitle?: string
): ComicReview {
  const state = loadLocalState();
  const review: ComicReview = {
    comicId,
    comicTitle,
    rating: Math.max(1, Math.min(5, rating)),
    reviewText: reviewText.trim(),
    updatedAt: new Date().toISOString(),
  };

  state.reviews[comicId] = review;

  addActivityLog({
    type: 'review_added',
    title: 'Avaliação Registrada ⭐',
    description: `Você deu ${rating} estrela(s) para "${comicTitle || 'Edição'}".`,
    comicId,
    comicTitle,
  });

  persistLocalState(state);

  // Sync to Cloud Firestore in background
  pushCloudReview(review).catch(() => {});

  fetch('/api/db/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  }).catch(() => {});

  return review;
}

/**
 * AI Synopsis Request & Persistence
 */
export async function requestAiSynopsis(
  comic: {
    id: string;
    title: string;
    publisher?: string;
    year?: number;
    issueNumber?: number;
    sagaTitle?: string;
    synopsis?: string;
  },
  forceRegenerate: boolean = false
): Promise<AiSynopsisData | null> {
  const state = loadLocalState();

  // If already cached and not forced, return immediately
  if (!forceRegenerate && state.aiSynopses[comic.id]) {
    return state.aiSynopses[comic.id];
  }

  try {
    const res = await fetch('/api/ai/synopsis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comicId: comic.id,
        title: comic.title,
        publisher: comic.publisher,
        year: comic.year,
        issueNumber: comic.issueNumber,
        sagaTitle: comic.sagaTitle,
        forceRegenerate,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const aiData: AiSynopsisData = json.data;
        state.aiSynopses[comic.id] = aiData;
        addActivityLog({
          type: 'ai_synopsis_generated',
          title: 'Sinopse Gerada por IA ✨',
          description: `IA gerou a curadoria e sinopse completa para "${comic.title}".`,
          comicId: comic.id,
          comicTitle: comic.title,
        });
        persistLocalState(state);
        return aiData;
      }
    }
  } catch (err) {
    console.warn('[DB Service] Erro ao solicitar sinopse IA:', err);
  }

  // Fallback intelligent synopsis if API is temporarily unavailable
  if (!state.aiSynopses[comic.id]) {
    const cleanTitle = (comic.title || 'Edição Canônica').replace(/^\(\d{4}\)\s*-\s*/, '').trim();
    const pub = comic.publisher || 'Marvel';
    const year = comic.year || 1990;
    const saga = comic.sagaTitle || cleanTitle;
    const fallbackData: AiSynopsisData = {
      comicId: comic.id,
      synopsis: `Mergulhe na narrativa emocionante de "${cleanTitle}". Publicação histórica da ${pub} lançada originalmente em ${year}. A história aprofunda os dilemas e confrontos de ${saga}, trazendo reviravoltas intensas, diálogos memoráveis e ilustrações restauradas para a melhor experiência de leitura.`,
      logline: `Os segredos e perigos de ${saga} atingem seu ápice dramático em ${cleanTitle}.`,
      mainCharacters: [saga, 'Heróis do Arco', 'Antagonistas'],
      tone: 'Aventura Clássica Canônica',
      historicalContext: `Edição preservada do acervo da ${pub} (${year}), representativa da cronologia clássica com roteiro e arte consagradas pelos leitores.`,
      recommendedFor: `Colecionadores e leitores que acompanham os grandes arcos da ${pub}.`,
      generatedAt: new Date().toISOString(),
    };
    state.aiSynopses[comic.id] = fallbackData;
    persistLocalState(state);
    return fallbackData;
  }

  return state.aiSynopses[comic.id] || null;
}

export function getCachedAiSynopsis(comicId: string): AiSynopsisData | null {
  const state = loadLocalState();
  return state.aiSynopses[comicId] || null;
}

/**
 * Activity Logging
 */
export function addActivityLog(item: Omit<ActivityLogItem, 'id' | 'timestamp'>): ActivityLogItem {
  const state = loadLocalState();
  const log: ActivityLogItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...item,
  };

  // Keep last 150 activities
  state.activities = [log, ...state.activities].slice(0, 150);
  persistLocalState(state);

  return log;
}

export function getRecentActivities(limit: number = 20): ActivityLogItem[] {
  const state = loadLocalState();
  return state.activities.slice(0, limit);
}

/**
 * Reader Statistics Calculation
 */
export function getReaderStatistics() {
  const state = loadLocalState();
  const progressList = Object.values(state.readingProgress);
  const totalComicsRead = progressList.filter((p) => p.isCompleted).length;
  const inProgressCount = progressList.filter((p) => !p.isCompleted && p.currentPage > 1).length;
  const totalPagesRead = progressList.reduce((acc, p) => acc + (p.currentPage || 1), 0);
  const totalFavorites = Object.keys(state.favorites).length;
  const totalReviews = Object.keys(state.reviews).length;
  const totalAiSynopses = Object.keys(state.aiSynopses).length;
  const totalBookmarks = state.bookmarks.length;

  return {
    totalComicsRead,
    inProgressCount,
    totalPagesRead,
    totalFavorites,
    totalReviews,
    totalAiSynopses,
    totalBookmarks,
  };
}

/**
 * Persist custom loaded comic into local & cloud databases
 */
export function addCustomComicToDatabase(comic: any): void {
  const state = loadLocalState();
  state.customComics = [comic, ...state.customComics.filter((c: any) => c.id !== comic.id)];

  if (comic.coverDataUrl) {
    state.covers[comic.id] = {
      comicId: comic.id,
      coverDataUrl: comic.coverDataUrl,
      mimeType: 'image/jpeg',
      extractedAt: new Date().toISOString(),
      title: comic.title,
    };
  }

  addActivityLog({
    type: 'comic_uploaded',
    title: 'Nova HQ Adicionada 📚',
    description: `"${comic.title}" (${comic.totalPages} páginas) catalogada e pronta para leitura.`,
    comicId: comic.id,
    comicTitle: comic.title,
  });

  persistLocalState(state);
}

/**
 * Persist extracted comic cover into database to prevent missing covers
 */
export function saveComicCoverToDatabase(
  comicId: string,
  coverDataUrl: string,
  mimeType: string = 'image/jpeg',
  title?: string
): void {
  const state = loadLocalState();
  state.covers[comicId] = {
    comicId,
    coverDataUrl,
    mimeType,
    extractedAt: new Date().toISOString(),
    title,
  };
  persistLocalState(state);
}
