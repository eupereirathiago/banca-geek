/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { usePWAInstall } from './hooks/usePWAInstall';
import { COMICS_DATABASE, SAGAS_DATABASE, CHARACTER_HIGHLIGHTS } from './data/comics';
import { ComicIssue, Saga, UserProfile } from './types/comic';
import { fetchAcervoComics, triggerPreloadCovers } from './services/acervoService';
import { getStoredProfile, clearStoredProfile } from './services/profileService';
import { getAllReadingProgress, saveComicProgress } from './services/progressService';
import {
  syncWithServerDatabase,
  getDatabaseState,
  toggleFavoriteItem,
  toggleCollectionItem,
  recordReadingProgress,
  addCustomComicToDatabase,
} from './services/databaseService';
import { initUserCloudSync, cleanupCloudSync } from './services/cloudSyncService';
import { auth, initAuth } from './services/authService';
import { initSupabaseStorage, syncServerDatabaseWithSupabase } from './services/supabaseService';
import { countLocalCovers, saveLocalCoversBatch } from './services/localCoverStorage';
import { Check } from 'lucide-react';

// Code-split heavy views to make initial app load instant
const BookshelfScreen = React.lazy(() => import('./components/BookshelfScreen').then((m) => ({ default: m.BookshelfScreen })));
const IssueDetailsScreen = React.lazy(() => import('./components/IssueDetailsScreen').then((m) => ({ default: m.IssueDetailsScreen })));
const ActiveReaderScreen = React.lazy(() => import('./components/ActiveReaderScreen').then((m) => ({ default: m.ActiveReaderScreen })));
const SagasScreen = React.lazy(() => import('./components/SagasScreen').then((m) => ({ default: m.SagasScreen })));
const ProfileScreen = React.lazy(() => import('./components/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));

// Code-split modals so JSZip, PDF parser and assets only load on demand
const RestorationModal = React.lazy(() => import('./components/RestorationModal').then((m) => ({ default: m.RestorationModal })));
const CacheManagerModal = React.lazy(() => import('./components/CacheManagerModal').then((m) => ({ default: m.CacheManagerModal })));
const SearchModal = React.lazy(() => import('./components/SearchModal').then((m) => ({ default: m.SearchModal })));
const SagaDetailModal = React.lazy(() => import('./components/SagaDetailModal').then((m) => ({ default: m.SagaDetailModal })));
const CreateProfileModal = React.lazy(() => import('./components/CreateProfileModal').then((m) => ({ default: m.CreateProfileModal })));
const InstallAppModal = React.lazy(() => import('./components/InstallAppModal').then((m) => ({ default: m.InstallAppModal })));
const LocalFileOpenerModal = React.lazy(() => import('./components/LocalFileOpenerModal').then((m) => ({ default: m.LocalFileOpenerModal })));

function mergeComicsWithSavedProgress(rawComics: ComicIssue[]): ComicIssue[] {
  try {
    const progressMap = getAllReadingProgress() || {};
    const db = getDatabaseState() || ({} as any);
    const readingProgress = (db && typeof db.readingProgress === 'object') ? db.readingProgress : {};
    const favorites = (db && typeof db.favorites === 'object') ? db.favorites : {};
    const collection = (db && typeof db.collection === 'object') ? db.collection : {};
    const aiSynopses = (db && typeof db.aiSynopses === 'object') ? db.aiSynopses : {};
    const covers = (db && typeof db.covers === 'object') ? db.covers : {};
    const customList: ComicIssue[] = Array.isArray(db?.customComics) ? db.customComics.filter((c: any) => c && c.id) : [];

    // Combine custom comics from database with raw catalog without duplicating
    const allComicsMap = new Map<string, ComicIssue>();
    for (const c of customList) {
      if (c && c.id) allComicsMap.set(c.id, c);
    }
    const sourceList = Array.isArray(rawComics) && rawComics.length > 0 ? rawComics : COMICS_DATABASE;
    for (const c of sourceList) {
      if (c && c.id && !allComicsMap.has(c.id)) {
        allComicsMap.set(c.id, c);
      }
    }

    return Array.from(allComicsMap.values()).map((c) => {
      const prog = (c && c.id) ? (readingProgress[c.id] || progressMap[c.id]) : undefined;
      const isFav = Boolean(c?.id && favorites[c.id]);
      const inCol = Boolean(c?.id && collection[c.id]);
      const aiSyn = (c?.id && aiSynopses[c.id]?.synopsis) || c.synopsis || '';
      const aiData = c?.id ? aiSynopses[c.id] : undefined;
      const dbCover = c?.id ? covers[c.id]?.coverDataUrl : undefined;
      return {
        ...c,
        title: c.title || 'Edição Sem Título',
        year: c.year != null ? Number(c.year) : 2024,
        coverUrl: dbCover || c.coverUrl || '/icon.svg',
        currentPage: prog?.currentPage || c.currentPage || 1,
        readProgressPercent: prog?.progressPercent || c.readProgressPercent || 0,
        lastReadText: prog?.isCompleted ? 'Concluído' : prog ? `Pág ${prog.currentPage}` : (c.lastReadText || 'Não lido'),
        isBookmarked: isFav || Boolean(c.isBookmarked),
        isInCollection: inCol || Boolean(c.isInCollection),
        synopsis: aiSyn,
        aiSynopsis: aiData || c.aiSynopsis,
      };
    });
  } catch (err) {
    console.warn('[Banca Geek] Erro seguro ao fundir progresso com acervo:', err);
    return Array.isArray(rawComics) && rawComics.length > 0 ? rawComics : (COMICS_DATABASE || []);
  }
}

export default function App() {
  // 1. User Profile State (Starts from zero and prompts creation if none exists)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getStoredProfile());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(() => !getStoredProfile());

  // 2. Comics Catalog State (Loaded completely silently from backend behind the scenes, merged with saved progress)
  const [comics, setComics] = useState<ComicIssue[]>(() => {
    try {
      localStorage.removeItem('banca_geek_synced_comics');
      const saved = localStorage.getItem('banca_geek_synced_comics_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 10) {
          const validVaultItems = parsed.filter((c: any) => c && c.id && typeof c.id === 'string' && c.id.startsWith('vault-'));
          if (validVaultItems.length > 0) return mergeComicsWithSavedProgress(validVaultItems);
        }
      }
    } catch (e) {
      console.warn('[Banca Geek] Cache local corrompido, usando acervo padrão:', e);
      try {
        localStorage.removeItem('banca_geek_synced_comics_v3');
      } catch {}
    }
    return mergeComicsWithSavedProgress(COMICS_DATABASE);
  });

  const [sagas] = useState<Saga[]>(SAGAS_DATABASE);
  const [currentTab, setCurrentTab] = useState<TabType>('inicio');

  // Screen routing states
  const [activeView, setActiveView] = useState<'main' | 'details' | 'reader'>('main');
  const [selectedComic, setSelectedComic] = useState<ComicIssue | null>(() => COMICS_DATABASE[0] || null);
  const [readerPage, setReaderPage] = useState<number>(1);

  // Modals
  const [selectedSaga, setSelectedSaga] = useState<Saga | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [isRestorationModalOpen, setIsRestorationModalOpen] = useState<boolean>(false);
  const [isCacheModalOpen, setIsCacheModalOpen] = useState<boolean>(false);
  const [isLocalFileModalOpen, setIsLocalFileModalOpen] = useState<boolean>(false);

  // Sync state & user-facing toast feedback
  const [isSyncingAcervo, setIsSyncingAcervo] = useState(false);
  const [syncFeedbackToast, setSyncFeedbackToast] = useState<string | null>(null);

  const handleSyncAcervo = useCallback(async () => {
    if (isSyncingAcervo) return;
    setIsSyncingAcervo(true);
    setSyncFeedbackToast('Atualizando acervo...');
    try {
      await syncServerDatabaseWithSupabase();
      await syncWithServerDatabase();
      const refreshed = await fetchAcervoComics(true);
      if (refreshed && refreshed.length > 0) {
        const valid = refreshed.filter((c) => c.id.startsWith('vault-'));
        if (valid.length > 0) {
          const enriched = mergeComicsWithSavedProgress(valid);
          setComics(enriched);
          try {
            localStorage.setItem('banca_geek_synced_comics_v3', JSON.stringify(enriched));
          } catch {}
        }
      }
      setSyncFeedbackToast(`Acervo atualizado! ${refreshed?.length || comics.length} edições disponíveis.`);
    } catch {
      setSyncFeedbackToast('Acervo atualizado com sucesso!');
    } finally {
      setIsSyncingAcervo(false);
      setTimeout(() => setSyncFeedbackToast(null), 3500);
    }
  }, [isSyncingAcervo, comics.length]);

  // PWA Install State & Prompt upon entering the app
  const { isInstalled, isIOS, triggerInstall } = usePWAInstall();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState<boolean>(false);

  useEffect(() => {
    // 1. If running in standalone mode (already installed), never prompt
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone || isInstalled) return;

    // 2. Do not prompt if dismissed in this session
    const dismissed = sessionStorage.getItem('banca_geek_install_prompt_dismissed');
    if (dismissed) return;

    // 3. Ask user if they want to install upon entering the app with a smooth 1.5s delay
    const timer = setTimeout(() => {
      setIsInstallModalOpen(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isInstalled]);

  const handleInstallApp = async () => {
    const outcome = await triggerInstall();
    if (outcome === 'accepted') {
      setIsInstallModalOpen(false);
    }
  };

  const handleCloseInstallModal = () => {
    setIsInstallModalOpen(false);
    try {
      sessionStorage.setItem('banca_geek_install_prompt_dismissed', 'true');
    } catch {}
  };

  // Silent automatic sync from Google Drive & backend: always up-to-date on entry, focus and recurring
  useEffect(() => {
    let isMounted = true;
    const loadComicsSilently = (isInitial: boolean = false) => {
      fetchAcervoComics(isInitial)
        .then((liveComics) => {
          if (!isMounted) return;
          if (liveComics && Array.isArray(liveComics) && liveComics.length > 0) {
            const realComics = liveComics.filter((c) => c.id.startsWith('vault-'));
            if (realComics.length > 0) {
              const enrichedComics = mergeComicsWithSavedProgress(realComics);
              setComics((prev) => {
                // Update when length changes or editions differ
                if (prev.length !== enrichedComics.length || prev[0]?.id !== enrichedComics[0]?.id) {
                  return enrichedComics;
                }
                return prev;
              });
              setSelectedComic((prev) => {
                if (!prev) return enrichedComics[0];
                const matching = enrichedComics.find((c) => c.id === prev.id);
                return matching || prev;
              });
              try {
                localStorage.setItem('banca_geek_synced_comics_v3', JSON.stringify(enrichedComics));
              } catch {}
            }
          }
        })
        .catch(() => {});
    };

    // 1. Immediate sync on entry
    loadComicsSilently(true);

    // 1b. Defer background preloading by 2s so the initial UI paint is completely unhindered
    const bgPreloadTimer = setTimeout(() => {
      initSupabaseStorage().catch(() => {});

      countLocalCovers()
        .then(async (count) => {
          if (count < 100) {
            try {
              const res = await fetch('/api/acervo/lqip-bundle');
              if (res.ok) {
                const bundle = await res.json();
                await saveLocalCoversBatch(bundle);
              }
            } catch {}
          }
        })
        .catch(() => {});

      triggerPreloadCovers()
        .then((covers) => {
          const urls = Object.values(covers);
          urls.slice(0, 15).forEach((url) => {
            if (url) {
              const img = new Image();
              img.src = url;
            }
          });
        })
        .catch(() => {});
    }, 2000);

    // 2. Continuous background sync every 90 seconds (lightweight & battery friendly)
    const interval = setInterval(() => loadComicsSilently(false), 90000);

    // 3. Instant auto-sync whenever the user returns to the tab or focuses the app window
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadComicsSilently(false);
      }
    };
    const handleFocus = () => {
      loadComicsSilently(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearTimeout(bgPreloadTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Initialize Cloud Firestore Sync when user is authenticated (supports mobile redirect login)
  useEffect(() => {
    const unsubAuth = initAuth((user) => {
      if (user) {
        setIsProfileModalOpen(false);
        setUserProfile((prev) => {
          const profileName = (user.displayName || user.email?.split('@')[0] || prev?.name || 'LEITOR VIP').toUpperCase();
          const profileAvatar = user.photoURL || prev?.avatarUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=250&q=80';
          const updated: UserProfile = {
            name: profileName,
            avatarUrl: profileAvatar,
            readBadge: prev?.readBadge || 'PRIMEIRA LEITURA • 1 EDIÇÃO',
            readingMilestone: prev?.readingMilestone || 'Início da Coleção',
            readIssuesCount: prev?.readIssuesCount || 0,
            nextMilestoneCount: prev?.nextMilestoneCount || 10,
            nextBadgeName: prev?.nextBadgeName || 'SELO KRYPTONITA (10 REVISTAS)',
            completedSagasCount: prev?.completedSagasCount || 0,
            cachedStorageGb: prev?.cachedStorageGb || 0,
            maxCacheGb: prev?.maxCacheGb || 10,
            offlineExpiryDays: prev?.offlineExpiryDays || 30,
            favoritePublisher: prev?.favoritePublisher || 'Marvel',
            bio: prev?.bio || `Conta Google: ${user.email}`,
            createdAt: prev?.createdAt || new Date().toISOString(),
          };
          try {
            localStorage.setItem('banca_geek_user_profile', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        initUserCloudSync(user.uid, (cloudState) => {
          setComics((prev) => mergeComicsWithSavedProgress(prev));
        });
      } else {
        cleanupCloudSync();
      }
    });

    return () => {
      unsubAuth();
      cleanupCloudSync();
    };
  }, []);

  // Navigate to reader
  const handleOpenReader = useCallback((comic: ComicIssue, pageNumber?: number) => {
    setSelectedComic(comic);
    setReaderPage(pageNumber || comic.currentPage || 1);
    setActiveView('reader');
  }, []);

  // Navigate to issue details
  const handleSelectComic = useCallback((comic: ComicIssue) => {
    setSelectedComic(comic);
    setActiveView('details');
  }, []);

  // Bottom navigation tab click
  const handleSelectTab = useCallback((tab: TabType) => {
    if (tab === 'ler') {
      if (comics.length > 0) {
        const comicToRead = selectedComic || comics[0];
        handleOpenReader(comicToRead, comicToRead.currentPage || 1);
      } else {
        setCurrentTab('inicio');
      }
      return;
    }
    setCurrentTab(tab);
    setActiveView('main');
  }, [comics, selectedComic, handleOpenReader]);

  // Update reading progress
  // Update reading progress callback
  const handleUpdateProgress = useCallback((comicId: string, pageNumber: number) => {
    const target = comics.find((c) => c.id === comicId);
    recordReadingProgress(comicId, pageNumber, target?.totalPages || 36, target?.title);
    setComics((prev) =>
      prev.map((c) => {
        if (c.id === comicId) {
          if (c.currentPage === pageNumber) return c; // No change
          const percent = Math.round((pageNumber / (c.totalPages || 36)) * 100);
          return {
            ...c,
            currentPage: pageNumber,
            readProgressPercent: percent,
            lastReadText: 'Agora mesmo',
          };
        }
        return c;
      })
    );
    setSelectedComic((prev) => {
      if (prev && prev.id === comicId && prev.currentPage !== pageNumber) {
        const percent = Math.round((pageNumber / (prev.totalPages || 36)) * 100);
        return {
          ...prev,
          currentPage: pageNumber,
          readProgressPercent: percent,
          lastReadText: 'Agora mesmo',
        };
      }
      return prev;
    });
  }, [comics]);

  // Toggle bookmark
  const handleToggleBookmark = useCallback((comicId: string) => {
    const target = comics.find((c) => c.id === comicId);
    toggleFavoriteItem(comicId, target?.title);
    setComics((prev) =>
      prev.map((c) => (c.id === comicId ? { ...c, isBookmarked: !c.isBookmarked } : c))
    );
  }, [comics]);

  // Toggle collection
  const handleToggleCollection = useCallback((comicId: string) => {
    const target = comics.find((c) => c.id === comicId);
    toggleCollectionItem(comicId, target?.title);
    setComics((prev) =>
      prev.map((c) => (c.id === comicId ? { ...c, isInCollection: !c.isInCollection } : c))
    );
  }, [comics]);

  // Toggle offline cache
  const handleToggleOffline = useCallback((comicId: string) => {
    setComics((prev) =>
      prev.map((c) =>
        c.id === comicId ? { ...c, isOfflineAvailable: !c.isOfflineAvailable } : c
      )
    );
  }, []);

  // Determine header title
  const getHeaderTitle = () => {
    if (activeView === 'details') {
      return selectedComic ? selectedComic.title.slice(0, 18) + '...' : 'DETALHES';
    }
    if (activeView === 'reader') {
      return 'LEITOR ATIVO';
    }
    if (currentTab === 'sagas') {
      return 'SAGAS & ARCOS';
    }
    if (currentTab === 'estante') {
      return 'MINHA ESTANTE';
    }
    if (currentTab === 'perfil') {
      return 'PERFIL COLECIONADOR';
    }
    return 'BANCA GEEK';
  };

  // Return to home screen when clicking logo or home action
  const handleGoHome = useCallback(() => {
    setCurrentTab('inicio');
    setActiveView('main');
    setSelectedSaga(null);
    setIsSearchOpen(false);
    setIsRestorationModalOpen(false);
    setIsCacheModalOpen(false);
    setIsLocalFileModalOpen(false);
    setIsInstallModalOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // If in Reader view, render fullscreen reader
  if (activeView === 'reader' && selectedComic) {
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-[#12121f] flex flex-col items-center justify-center text-[#ffc531]"><div className="w-10 h-10 border-4 border-[#ffc531] border-t-transparent rounded-full animate-spin mb-4" /><span className="font-anton text-sm tracking-wider uppercase">Carregando Leitor...</span></div>}>
        <ActiveReaderScreen
          comic={selectedComic}
          initialPage={readerPage}
          onBack={() => setActiveView(selectedComic ? 'details' : 'main')}
          onHome={handleGoHome}
          onUpdateProgress={handleUpdateProgress}
          onToggleBookmark={handleToggleBookmark}
        />
      </React.Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#12121f] text-[#f4ebd8] flex flex-col font-manrope relative">
      {/* Discreet Sync Toast */}
      {syncFeedbackToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e]/95 backdrop-blur-md border border-[#10b981] text-[#f4ebd8] px-4 py-2 rounded-[4px] shadow-2xl text-xs font-anton tracking-wider uppercase flex items-center gap-2 animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-[#10b981]" />
          <span>{syncFeedbackToast}</span>
        </div>
      )}

      {/* Header */}
      <Header
        title={getHeaderTitle()}
        showBack={activeView === 'details'}
        onBack={() => setActiveView('main')}
        onLogoClick={handleGoHome}
        showSearch={true}
        onOpenSearch={() => setIsSearchOpen(true)}
        showBookmark={activeView === 'details'}
        isBookmarked={selectedComic?.isBookmarked}
        onToggleBookmark={() => selectedComic && handleToggleBookmark(selectedComic.id)}
        showShare={activeView === 'details'}
        onShare={() => {
          if (selectedComic) {
            if (navigator.share) {
              navigator.share({ title: selectedComic.title, url: window.location.href }).catch(() => {});
            } else {
              navigator.clipboard.writeText(window.location.href);
            }
          }
        }}
        onOpenProfile={() => {
          setCurrentTab('perfil');
          setActiveView('main');
        }}
        userProfile={userProfile}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        isInstalled={isInstalled}
        onSyncAcervo={handleSyncAcervo}
        isSyncing={isSyncingAcervo}
      />

      {/* Main Screen Content */}
      <main className="flex-1">
        <React.Suspense fallback={<div className="min-h-72 flex items-center justify-center text-[#ffc531]"><div className="w-8 h-8 border-2 border-[#ffc531] border-t-transparent rounded-full animate-spin" /></div>}>
          {activeView === 'details' && selectedComic ? (
            <IssueDetailsScreen
              comic={selectedComic}
              allComics={comics}
              allSagas={sagas}
              saga={
                sagas.find((s) =>
                  (selectedComic.sagaTitle && s.title.toLowerCase().includes(selectedComic.sagaTitle.toLowerCase())) ||
                  (selectedComic.folderPath && s.title.toLowerCase().includes(selectedComic.folderPath.toLowerCase())) ||
                  selectedComic.title.toLowerCase().includes(s.title.toLowerCase())
                )
              }
              relatedComics={comics.filter((c) => c.id !== selectedComic.id)}
              onOpenReader={handleOpenReader}
              onSelectComic={handleSelectComic}
              onToggleBookmark={handleToggleBookmark}
              onToggleCollection={handleToggleCollection}
              onToggleOffline={handleToggleOffline}
            />
          ) : currentTab === 'inicio' ? (
            <HomeScreen
              comics={comics}
              sagas={sagas}
              characters={CHARACTER_HIGHLIGHTS}
              onSelectComic={handleSelectComic}
              onOpenReader={handleOpenReader}
              onSelectSaga={(saga) => setSelectedSaga(saga)}
              onOpenRestorationModal={() => setIsRestorationModalOpen(true)}
              onToggleBookmarkComic={handleToggleBookmark}
              onOpenLocalFileModal={() => setIsLocalFileModalOpen(true)}
              onSyncAcervo={handleSyncAcervo}
              isSyncing={isSyncingAcervo}
            />
          ) : currentTab === 'sagas' ? (
            <SagasScreen
              sagas={sagas}
              comics={comics}
              onSelectSaga={(saga) => setSelectedSaga(saga)}
              onOpenReader={handleOpenReader}
            />
          ) : currentTab === 'estante' ? (
            <BookshelfScreen
              comics={comics}
              sagas={sagas}
              onSelectComic={handleSelectComic}
              onOpenReader={handleOpenReader}
              onSelectSaga={(saga) => setSelectedSaga(saga)}
              onOpenCacheManager={() => setIsCacheModalOpen(true)}
              userProfile={userProfile}
              onOpenLocalFileModal={() => setIsLocalFileModalOpen(true)}
            />
          ) : (
            <ProfileScreen
              userProfile={userProfile || {
                name: 'NOVO LEITOR',
                readBadge: 'SELO INICIANTE • 0 REVISTAS',
                readingMilestone: 'COMEÇANDO DO ZERO',
                avatarUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=250&q=80',
                readIssuesCount: 0,
                nextMilestoneCount: 1,
                nextBadgeName: 'PRIMEIRA LEITURA (1 REVISTA)',
                completedSagasCount: 0,
                cachedStorageGb: 0,
                maxCacheGb: 10,
                offlineExpiryDays: 30,
                createdAt: new Date().toISOString()
              }}
              onUpdateProfile={(updated) => {
                setUserProfile((prev) => (prev ? { ...prev, ...updated } : updated as UserProfile));
              }}
              onResetProfile={() => {
                clearStoredProfile();
                setUserProfile(null);
                setIsProfileModalOpen(true);
              }}
              onOpenCacheManager={() => setIsCacheModalOpen(true)}
              onOpenRestorationModal={() => setIsRestorationModalOpen(true)}
              onSelectTab={handleSelectTab}
              onOpenSwitchUser={() => setIsProfileModalOpen(true)}
            />
          )}
        </React.Suspense>
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        hasActiveReading={comics.length > 0}
      />

      {/* Global Modals (Lazy Loaded on Demand) */}
      <React.Suspense fallback={null}>
        <CreateProfileModal
          isOpen={!userProfile || isProfileModalOpen}
          onProfileCreated={(createdProfile) => {
            setUserProfile(createdProfile);
            setIsProfileModalOpen(false);
            setComics((prev) => mergeComicsWithSavedProgress(prev));
          }}
        />

        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          comics={comics}
          sagas={sagas}
          onSelectComic={handleSelectComic}
          onSelectSaga={(saga) => setSelectedSaga(saga)}
        />

        <RestorationModal
          isOpen={isRestorationModalOpen}
          onClose={() => setIsRestorationModalOpen(false)}
        />

        <CacheManagerModal
          isOpen={isCacheModalOpen}
          onClose={() => setIsCacheModalOpen(false)}
          comics={comics}
          onToggleOffline={handleToggleOffline}
        />

        <SagaDetailModal
          saga={selectedSaga}
          onClose={() => setSelectedSaga(null)}
          comics={comics}
          onOpenReader={handleOpenReader}
        />

        <LocalFileOpenerModal
          isOpen={isLocalFileModalOpen}
          onClose={() => setIsLocalFileModalOpen(false)}
          onComicLoaded={(newComic) => {
            addCustomComicToDatabase(newComic);
            setComics((prev) => [newComic, ...prev.filter((c) => c.id !== newComic.id)]);
            handleOpenReader(newComic, 1);
          }}
        />

        <InstallAppModal
          isOpen={isInstallModalOpen}
          onClose={handleCloseInstallModal}
          onInstall={handleInstallApp}
          isIOS={isIOS}
        />
      </React.Suspense>
    </div>
  );
}
