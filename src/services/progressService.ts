/**
 * Reading Progress Management Service
 * Handles instant persistence, page advancement, milestone tracking,
 * and completion state across sessions and devices.
 */

import { getActiveUsername, syncActiveUserProgress } from './userAccountService';

export interface ReadingProgressRecord {
  comicId: string;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  updatedAt: number;
  isCompleted: boolean;
  comicTitle?: string;
}

function getProgressStorageKey(): string {
  const active = getActiveUsername();
  return active ? `banca_geek_reading_progress_${active}` : 'banca_geek_reading_progress_v4';
}

export function getAllReadingProgress(): Record<string, ReadingProgressRecord> {
  try {
    const raw = localStorage.getItem(getProgressStorageKey());
    if (!raw) {
      // Check legacy fallback
      const legacy = localStorage.getItem('banca_geek_reading_progress_v4');
      return legacy ? JSON.parse(legacy) : {};
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function getComicProgress(comicId: string): ReadingProgressRecord | null {
  const all = getAllReadingProgress();
  return all[comicId] || null;
}

export function saveComicProgress(
  comicId: string,
  pageNumber: number,
  totalPages: number = 36,
  comicTitle?: string
): ReadingProgressRecord {
  const all = getAllReadingProgress();
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.max(1, Math.min(pageNumber, safeTotal));
  const percent = Math.round((safePage / safeTotal) * 100);
  const isCompleted = safePage >= safeTotal;

  const record: ReadingProgressRecord = {
    comicId,
    currentPage: safePage,
    totalPages: safeTotal,
    progressPercent: percent,
    updatedAt: Date.now(),
    isCompleted,
    comicTitle: comicTitle || all[comicId]?.comicTitle,
  };

  all[comicId] = record;

  try {
    localStorage.setItem(getProgressStorageKey(), JSON.stringify(all));
    syncActiveUserProgress({ readingProgress: all }).catch(() => {});
  } catch (err) {
    console.warn('[ProgressService] Erro ao salvar progresso no localStorage:', err);
  }

  // Also persist to server database & activity timeline
  try {
    import('./databaseService').then((db) => {
      db.recordReadingProgress(comicId, safePage, safeTotal, comicTitle);
    });
  } catch {}

  // Update user profile reading milestone
  try {
    const profileRaw = localStorage.getItem('banca_geek_profile_v2');
    if (profileRaw) {
      const profile = JSON.parse(profileRaw);
      const completedCount = Object.values(all).filter((r) => r.isCompleted).length;
      profile.readIssuesCount = Math.max(profile.readIssuesCount || 0, completedCount);
      if (completedCount >= 10) {
        profile.readingMilestone = 'MESTRE DO MULTIVERSO';
        profile.readBadge = 'NÍVEL 3 • MESTRE COLECIONADOR';
      } else if (completedCount >= 5) {
        profile.readingMilestone = 'VETERANO DAS HQ';
        profile.readBadge = 'NÍVEL 2 • COLECIONADOR ASSÍDUO';
      } else if (completedCount >= 1) {
        profile.readingMilestone = 'PRIMEIRAS AVENTURAS';
        profile.readBadge = 'NÍVEL 1 • EXPLORADOR DO ACERVO';
      }
      localStorage.setItem('banca_geek_profile_v2', JSON.stringify(profile));
    }
  } catch {}

  return record;
}

export function markComicAsCompleted(comicId: string, totalPages: number = 36, title?: string): ReadingProgressRecord {
  return saveComicProgress(comicId, totalPages, totalPages, title);
}

export function resetComicProgress(comicId: string, totalPages: number = 36): ReadingProgressRecord {
  return saveComicProgress(comicId, 1, totalPages);
}
