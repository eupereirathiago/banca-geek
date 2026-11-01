import { ComicIssue, Saga, CharacterHighlight, ReadingMilestone } from '../types/comic';
import { READING_MILESTONES, getReadingBadge } from '../services/profileService';
import { REPOSITORY_COMICS, REPOSITORY_SAGAS } from './repositoryData';

export { READING_MILESTONES, getReadingBadge };

// Perfil de leitura do usuário
export const USER_PROFILE = {
  name: 'COLECIONADOR MARVEL',
  readBadge: 'SELO AUTÊNTICO • 1.269 EDIÇÕES',
  readingMilestone: 'LEITOR ATIVO',
  avatarUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=250&q=80',
  readIssuesCount: 0,
  nextMilestoneCount: 1,
  nextBadgeName: 'PRIMEIRA LEITURA (1 REVISTA)',
  completedSagasCount: 0,
  cachedStorageGb: 14.2,
  maxCacheGb: 50,
  offlineExpiryDays: 30,
};

import supabaseComicsCatalog from './supabaseComicsCatalog.json';
import { getComicSupabaseFileUrl } from '../lib/supabase';

// Base oficial de 948 edições reais hospedadas diretamente no Supabase Storage ('comics' bucket)
const primarySupabaseEditions: ComicIssue[] = ((supabaseComicsCatalog as any).editions || []).map((e: any) => ({
  ...e,
  storageSource: 'supabase',
  isPdf: true,
  format: 'pdf',
}));

const knownIds = new Set(primarySupabaseEditions.map((e) => e.id));
const knownTitles = new Set(
  primarySupabaseEditions.map((e) => e.title.toLowerCase().replace(/[^a-z0-9]/g, ''))
);

// Sanitiza edições legadas removendo qualquer visualizador do Google Drive e associando ao Supabase
const sanitizedRepositoryComics: ComicIssue[] = REPOSITORY_COMICS.filter((c) => {
  const cleanTitle = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !knownIds.has(c.id) && !knownTitles.has(cleanTitle);
}).map((c) => {
  const sanitized: ComicIssue = { ...c };
  // Remove todas as dependências de visualizadores externos do Drive
  delete sanitized.drivePreviewUrl;
  delete sanitized.driveDownloadUrl;
  const supaUrl = getComicSupabaseFileUrl(sanitized);
  if (supaUrl) {
    (sanitized as any).supabasePublicUrl = supaUrl;
    (sanitized as any).storageSource = 'supabase';
    sanitized.isPdf = true;
    sanitized.format = 'pdf';
  }
  return sanitized;
});

// Acervo unificado com prioridade absoluta para o Supabase Storage
export const COMICS_DATABASE: ComicIssue[] = [
  ...primarySupabaseEditions,
  ...sanitizedRepositoryComics,
];
export const SAGAS_DATABASE: Saga[] = REPOSITORY_SAGAS;

export const CHARACTER_HIGHLIGHTS: CharacterHighlight[] = [
  {
    id: 'char-thanos',
    name: 'Thanos / Infinito',
    issueCount: 120,
    avatarUrl: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3?auto=format&fit=crop&w=300&q=80',
    publisher: 'Marvel',
  },
  {
    id: 'char-fugitivos',
    name: 'Os Fugitivos (Runaways)',
    issueCount: 70,
    avatarUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=300&q=80',
    publisher: 'Marvel',
  },
  {
    id: 'char-pantera',
    name: 'Pantera Negra',
    issueCount: 110,
    avatarUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80',
    publisher: 'Marvel',
  },
  {
    id: 'char-defensores',
    name: 'Defensores & Mestres',
    issueCount: 113,
    avatarUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=300&q=80',
    publisher: 'Marvel',
  },
  {
    id: 'char-guardioes',
    name: 'Guardiões da Galáxia',
    issueCount: 85,
    avatarUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=300&q=80',
    publisher: 'Marvel',
  },
  {
    id: 'char-msmarvel',
    name: 'Ms. Marvel & Carol',
    issueCount: 105,
    avatarUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=300&q=80',
    publisher: 'Marvel',
  },
];
