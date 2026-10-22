import { UserProfile, ReadingMilestone } from '../types/comic';

const PROFILE_STORAGE_KEY = 'banca_geek_user_profile';

export const READING_MILESTONES: ReadingMilestone[] = [
  {
    threshold: 1,
    label: '1 Revista',
    badgeName: 'PRIMEIRA LEITURA • 1 EDIÇÃO',
    tier: 'Início da Coleção',
    description: 'Primeira página virada no seu novo acervo pessoal.',
    unlocked: false,
  },
  {
    threshold: 10,
    label: '10 Revistas',
    badgeName: 'SELO KRYPTONITA • 10 REVISTAS',
    tier: 'Radiação de Metrópolis',
    description: 'Primeira dose de energia extraterrestre nas páginas dos quadrinhos.',
    unlocked: false,
  },
  {
    threshold: 25,
    label: '25 Revistas',
    badgeName: 'SELO METAL ENÉSIMO • 25 REVISTAS',
    tier: 'Asas de Thanagar',
    description: 'Desafiando a gravidade através dos primeiros grandes arcos clássicos.',
    unlocked: false,
  },
  {
    threshold: 50,
    label: '50 Revistas',
    badgeName: 'SELO VIBRANIUM • 50 REVISTAS',
    tier: 'Guarda de Wakanda',
    description: 'Absorve todo o impacto narrativo das maiores sagas editoriais.',
    unlocked: false,
  },
  {
    threshold: 100,
    label: '100 Revistas',
    badgeName: 'SELO ADAMANTIUM • 100 REVISTAS',
    tier: 'Garra Inquebrável (Arma X)',
    description: 'Marco centenário forjado e indestrutível: mais de 100 edições lidas.',
    unlocked: false,
  },
  {
    threshold: 200,
    label: '200 Revistas',
    badgeName: 'SELO METAL URU • 200 REVISTAS',
    tier: 'Forja Sagrada de Mjolnir',
    description: 'Digno do trovão e das lendas asgardianas.',
    unlocked: false,
  },
  {
    threshold: 500,
    label: '500 Revistas',
    badgeName: 'SELO MANOPLA CÓSMICA • 500 REVISTAS',
    tier: 'Vigia do Multiverso',
    description: 'O patamar supremo com domínio total sobre todas as realidades dos quadrinhos.',
    unlocked: false,
  },
];

export function getReadingBadge(count: number) {
  if (count >= 500) {
    return {
      title: `${count} REVISTAS LIDAS`,
      tier: 'MANOPLA CÓSMICA',
      badgeText: `SELO MANOPLA CÓSMICA • ${count} REVISTAS`,
      color: '#ffc531',
      bgClass: 'bg-[#ffc531] text-[#12121f]',
      nextTarget: 1000,
      nextBadge: 'LENDA DO MULTIVERSO',
    };
  }
  if (count >= 200) {
    return {
      title: `${count} REVISTAS LIDAS`,
      tier: 'FORJA DE URU',
      badgeText: `SELO METAL URU • ${count} REVISTAS`,
      color: '#16e1ff',
      bgClass: 'bg-[#16e1ff] text-[#12121f]',
      nextTarget: 500,
      nextBadge: 'SELO MANOPLA CÓSMICA (500 REVISTAS)',
    };
  }
  if (count >= 100) {
    return {
      title: `${count} REVISTAS LIDAS`,
      tier: 'ADAMANTIUM PURO',
      badgeText: `SELO ADAMANTIUM • ${count} REVISTAS`,
      color: '#ffc531',
      bgClass: 'bg-[#ffc531] text-[#12121f]',
      nextTarget: 200,
      nextBadge: 'SELO METAL URU (200 REVISTAS)',
    };
  }
  if (count >= 50) {
    return {
      title: `${count} REVISTAS LIDAS`,
      tier: 'VIBRANIUM WAKANDANO',
      badgeText: `SELO VIBRANIUM • ${count} REVISTAS`,
      color: '#d62839',
      bgClass: 'bg-[#d62839] text-[#f4ebd8]',
      nextTarget: 100,
      nextBadge: 'SELO ADAMANTIUM (100 REVISTAS)',
    };
  }
  if (count >= 25) {
    return {
      title: `${count} REVISTAS LIDAS`,
      tier: 'METAL ENÉSIMO',
      badgeText: `SELO METAL ENÉSIMO • ${count} REVISTAS`,
      color: '#16e1ff',
      bgClass: 'bg-[#16e1ff] text-[#12121f]',
      nextTarget: 50,
      nextBadge: 'SELO VIBRANIUM (50 REVISTAS)',
    };
  }
  if (count >= 10) {
    return {
      title: `${count} REVISTAS LIDAS`,
      tier: 'KRYPTONITA',
      badgeText: `SELO KRYPTONITA • ${count} REVISTAS`,
      color: '#10b981',
      bgClass: 'bg-[#10b981] text-[#12121f]',
      nextTarget: 25,
      nextBadge: 'SELO METAL ENÉSIMO (25 REVISTAS)',
    };
  }
  if (count >= 1) {
    return {
      title: `${count} REVISTA LIDA`,
      tier: 'PRIMEIRA LEITURA',
      badgeText: `SELO INICIANTE • ${count} REVISTA`,
      color: '#16e1ff',
      bgClass: 'bg-[#16e1ff] text-[#12121f]',
      nextTarget: 10,
      nextBadge: 'SELO KRYPTONITA (10 REVISTAS)',
    };
  }
  return {
    title: 'NOVO LEITOR',
    tier: 'COMEÇANDO DO ZERO',
    badgeText: 'SELO INICIANTE • 0 REVISTAS',
    color: '#8a8ca5',
    bgClass: 'bg-[#22223b] text-[#8a8ca5]',
    nextTarget: 1,
    nextBadge: 'PRIMEIRA LEITURA (1 REVISTA)',
  };
}

export const AVATAR_OPTIONS = [
  { id: 'batman', label: 'Morcego', url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=250&q=80' },
  { id: 'spiderman', label: 'Aranha', url: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?auto=format&fit=crop&w=250&q=80' },
  { id: 'wolverine', label: 'Wolverine', url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=250&q=80' },
  { id: 'superman', label: 'Superman', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=250&q=80' },
  { id: 'cosmic', label: 'Cósmico', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=250&q=80' },
  { id: 'reader', label: 'Leitor', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80' },
];

export function getStoredProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return parsed;
    }
  } catch {}
  return null;
}

export function createInitialProfile(input: {
  name: string;
  avatarUrl?: string;
  favoritePublisher?: string;
  bio?: string;
}): UserProfile {
  const badgeInfo = getReadingBadge(0);
  const profile: UserProfile = {
    name: input.name.trim().toUpperCase(),
    readBadge: badgeInfo.badgeText,
    readingMilestone: badgeInfo.tier,
    avatarUrl: input.avatarUrl || AVATAR_OPTIONS[0].url,
    readIssuesCount: 0,
    nextMilestoneCount: badgeInfo.nextTarget,
    nextBadgeName: badgeInfo.nextBadge,
    completedSagasCount: 0,
    cachedStorageGb: 0,
    maxCacheGb: 10,
    offlineExpiryDays: 30,
    favoritePublisher: input.favoritePublisher || 'DC Comics',
    bio: input.bio || 'Colecionador de quadrinhos iniciando seu acervo central.',
    createdAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {}

  return profile;
}

export function updateStoredProfile(updated: Partial<UserProfile>): UserProfile {
  const current = getStoredProfile() || createInitialProfile({ name: 'LEITOR' });
  const merged: UserProfile = {
    ...current,
    ...updated,
  };

  // Recalculate badge if readIssuesCount changed
  if (typeof updated.readIssuesCount === 'number') {
    const badgeInfo = getReadingBadge(updated.readIssuesCount);
    merged.readBadge = badgeInfo.badgeText;
    merged.readingMilestone = badgeInfo.tier;
    merged.nextMilestoneCount = badgeInfo.nextTarget;
    merged.nextBadgeName = badgeInfo.nextBadge;
  }

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
  } catch {}

  return merged;
}

export function clearStoredProfile(): void {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {}
}
