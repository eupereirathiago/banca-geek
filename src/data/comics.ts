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

// Autêntico acervo indexado diretamente da nova pasta do Google Drive (1.269 edições reais com capas e PDFs)
export const COMICS_DATABASE: ComicIssue[] = REPOSITORY_COMICS;
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
