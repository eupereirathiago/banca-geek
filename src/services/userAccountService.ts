import { UserProfile } from '../types/comic';
import { getReadingBadge } from './profileService';

export interface UserAccountData {
  username: string; // e.g. "@thiago"
  name: string;
  avatarUrl: string;
  pin?: string;
  favoritePublisher?: string;
  bio?: string;
  readingProgress: Record<string, any>;
  favorites: Record<string, any>;
  collection: Record<string, any>;
  bookmarks: any[];
  readIssuesCount?: number;
  readBadge?: string;
  readingMilestone?: string;
  createdAt: string;
  lastLoginAt: string;
}

const ACTIVE_USERNAME_KEY = 'banca_geek_active_username';

export function normalizeUsername(raw: string): string {
  const clean = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '');
  return clean ? `@${clean}` : '';
}

export function getActiveUsername(): string | null {
  try {
    return localStorage.getItem(ACTIVE_USERNAME_KEY);
  } catch {
    return null;
  }
}

export function setActiveUsername(username: string | null) {
  try {
    if (username) {
      localStorage.setItem(ACTIVE_USERNAME_KEY, normalizeUsername(username));
    } else {
      localStorage.removeItem(ACTIVE_USERNAME_KEY);
    }
  } catch {}
}

export async function checkUsernameAvailability(raw: string): Promise<{
  available: boolean;
  exists: boolean;
  username: string;
  error?: string;
}> {
  const normalized = normalizeUsername(raw);
  if (!normalized || normalized.length < 3) {
    return {
      available: false,
      exists: false,
      username: normalized,
      error: 'O @usuário deve ter no mínimo 2 caracteres após o @.',
    };
  }

  try {
    const res = await fetch(`/api/user/check/${encodeURIComponent(normalized)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  // Fallback check against local cache
  try {
    const cached = localStorage.getItem(`banca_geek_user_${normalized}`);
    if (cached) {
      return { available: false, exists: true, username: normalized };
    }
  } catch {}

  return { available: true, exists: false, username: normalized };
}

export async function registerUserAccount(data: {
  username: string;
  name: string;
  avatarUrl?: string;
  pin?: string;
  favoritePublisher?: string;
  bio?: string;
}): Promise<UserAccountData> {
  const normalized = normalizeUsername(data.username);
  if (!normalized || normalized.length < 3) {
    throw new Error('O @usuário deve ter no mínimo 2 caracteres (ex: @leitor).');
  }

  const payload = {
    ...data,
    username: normalized,
    name: data.name.trim() || normalized.replace('@', ''),
  };

  try {
    const res = await fetch('/api/user/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error || 'Falha ao registrar usuário único.');
    }

    const user: UserAccountData = body.user;
    saveLocalUserAccount(user);
    setActiveUsername(user.username);
    return user;
  } catch (err: any) {
    // If backend offline, create locally
    if (err.message && err.message.includes('já existe')) {
      throw err;
    }
    const badgeInfo = getReadingBadge(0);
    const localUser: UserAccountData = {
      username: normalized,
      name: payload.name,
      avatarUrl: payload.avatarUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=300&q=80',
      pin: payload.pin,
      favoritePublisher: payload.favoritePublisher || 'Marvel',
      bio: payload.bio || '',
      readingProgress: {},
      favorites: {},
      collection: {},
      bookmarks: [],
      readIssuesCount: 0,
      readBadge: badgeInfo.badgeText,
      readingMilestone: badgeInfo.tier,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    saveLocalUserAccount(localUser);
    setActiveUsername(localUser.username);
    return localUser;
  }
}

export async function loginUserAccount(rawUsername: string, pin?: string): Promise<UserAccountData> {
  const normalized = normalizeUsername(rawUsername);
  if (!normalized) {
    throw new Error('Por favor, informe seu @usuário.');
  }

  try {
    const res = await fetch('/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: normalized, pin }),
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.error || 'Usuário ou PIN inválido.');
    }

    const user: UserAccountData = body.user;
    saveLocalUserAccount(user);
    setActiveUsername(user.username);

    // Apply isolated reading progress to current session
    applyIsolatedUserData(user);

    return user;
  } catch (err: any) {
    // Check if we have it cached locally
    const local = getLocalUserAccount(normalized);
    if (local) {
      if (local.pin && local.pin !== pin) {
        throw new Error('PIN incorreto para este @usuário.');
      }
      setActiveUsername(local.username);
      applyIsolatedUserData(local);
      return local;
    }
    throw err;
  }
}

export function saveLocalUserAccount(user: UserAccountData) {
  try {
    localStorage.setItem(`banca_geek_user_${user.username}`, JSON.stringify(user));
  } catch {}
}

export function getLocalUserAccount(username: string): UserAccountData | null {
  try {
    const raw = localStorage.getItem(`banca_geek_user_${normalizeUsername(username)}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applyIsolatedUserData(user: UserAccountData) {
  try {
    // 1. Isolate reading progress
    if (user.readingProgress) {
      localStorage.setItem(`banca_geek_reading_progress_${user.username}`, JSON.stringify(user.readingProgress));
      localStorage.setItem('banca_geek_reading_progress', JSON.stringify(user.readingProgress));
    }
    // 2. Isolate favorites
    if (user.favorites) {
      localStorage.setItem(`banca_geek_favorites_${user.username}`, JSON.stringify(user.favorites));
    }
    // 3. Isolate collection
    if (user.collection) {
      localStorage.setItem(`banca_geek_collection_${user.username}`, JSON.stringify(user.collection));
    }
    // 4. Isolate bookmarks
    if (user.bookmarks) {
      localStorage.setItem(`banca_geek_bookmarks_${user.username}`, JSON.stringify(user.bookmarks));
    }

    // 5. Update user profile
    const badgeInfo = getReadingBadge(user.readIssuesCount || 0);
    const profile: UserProfile = {
      name: user.name,
      username: user.username,
      pin: user.pin,
      avatarUrl: user.avatarUrl,
      readBadge: user.readBadge || badgeInfo.badgeText,
      readingMilestone: user.readingMilestone || badgeInfo.tier,
      readIssuesCount: user.readIssuesCount || 0,
      nextMilestoneCount: badgeInfo.nextTarget,
      nextBadgeName: badgeInfo.nextBadge,
      completedSagasCount: 0,
      cachedStorageGb: 0,
      maxCacheGb: 10,
      offlineExpiryDays: 30,
      favoritePublisher: user.favoritePublisher || 'Marvel',
      bio: user.bio || '',
      createdAt: user.createdAt,
    };
    localStorage.setItem('banca_geek_user_profile', JSON.stringify(profile));
  } catch {}
}

export async function syncActiveUserProgress(payload: {
  readingProgress?: Record<string, any>;
  favorites?: Record<string, any>;
  collection?: Record<string, any>;
  bookmarks?: any[];
  profile?: Partial<UserProfile>;
}) {
  const activeUsername = getActiveUsername();
  if (!activeUsername) return;

  try {
    await fetch('/api/user/sync-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: activeUsername,
        ...payload,
      }),
    });
  } catch {}
}
