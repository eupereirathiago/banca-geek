export interface ComicIssue {
  id: string;
  title: string;
  sagaTitle?: string;
  sagaPart?: string;
  issueNumber: number;
  totalIssuesInSaga?: number;
  publisher: 'DC Comics' | 'Marvel' | 'Vertigo' | 'Dark Horse' | 'Mangás';
  year: number;
  totalPages: number;
  currentPage: number;
  readProgressPercent: number;
  estimatedRemainingMinutes: number;
  lastReadText: string;
  badge?: string;
  badgeType?: 'rarity' | 'restored' | 'classic' | 'complete' | 'in_progress';
  coverUrl: string;
  synopsis: string;
  scriptWriter: string;
  artArtist: string;
  colorsArtist?: string;
  originalEditor?: string;
  ageRating: string;
  isOfflineAvailable: boolean;
  isInCollection: boolean;
  isBookmarked?: boolean;
  securityTier: string;
  driveFileId?: string;
  driveDownloadUrl?: string;
  drivePreviewUrl?: string;
  pdfStreamUrl?: string | null;
  format?: 'pdf' | 'cbz' | 'cbr' | 'epub' | 'cb7' | 'cbt' | 'rar' | 'zip' | 'tar' | '7z';
  isPdf?: boolean;
  rawFileName?: string;
  folderPath?: string;
  pages: ComicPage[];
  aiSynopsis?: AiSynopsisData;
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

export interface ComicPage {
  pageNumber: number;
  imageUrl?: string;
  title?: string;
  chapter?: string;
  speechSnippets?: string[];
  isDoubleSpread?: boolean;
  themeColor?: string;
}

export interface Saga {
  id: string;
  title: string;
  subtitle: string;
  publisher: string;
  years: string;
  totalIssues: number;
  completedIssues: number;
  progressPercent: number;
  isComplete: boolean;
  bannerUrl: string;
  badgeText: string;
  description: string;
  issues: {
    number: number;
    title: string;
    issueCode: string;
    status: 'reading' | 'next' | 'locked' | 'completed';
    pages?: number;
    specialTag?: string;
  }[];
}

export interface CharacterHighlight {
  id: string;
  name: string;
  issueCount: number;
  avatarUrl: string;
  publisher: string;
}

export interface ReadingMilestone {
  threshold: number;
  label: string;
  badgeName: string;
  tier: string;
  description: string;
  unlocked: boolean;
}

export interface UserProfile {
  name: string;
  readBadge: string;
  readingMilestone: string;
  avatarUrl: string;
  readIssuesCount: number;
  nextMilestoneCount: number;
  nextBadgeName: string;
  completedSagasCount: number;
  cachedStorageGb: number;
  maxCacheGb: number;
  offlineExpiryDays: number;
  favoritePublisher?: string;
  bio?: string;
  createdAt: string;
}

