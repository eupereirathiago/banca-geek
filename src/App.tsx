/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { BookshelfScreen } from './components/BookshelfScreen';
import { IssueDetailsScreen } from './components/IssueDetailsScreen';
import { ActiveReaderScreen } from './components/ActiveReaderScreen';
import { SagasScreen } from './components/SagasScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { RestorationModal } from './components/RestorationModal';
import { CacheManagerModal } from './components/CacheManagerModal';
import { SearchModal } from './components/SearchModal';
import { SagaDetailModal } from './components/SagaDetailModal';
import { CreateProfileModal } from './components/CreateProfileModal';
import { COMICS_DATABASE, SAGAS_DATABASE, CHARACTER_HIGHLIGHTS } from './data/comics';
import { ComicIssue, Saga, UserProfile } from './types/comic';
import { fetchAcervoComics } from './services/acervoService';
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
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LocalFileOpenerModal } from './components/LocalFileOpenerModal';

function mergeComicsWithSavedProgress(rawComics: ComicIssue[]): ComicIssue[] {
  const progressMap = getAllReadingProgress();
  const db = getDatabaseState();
  const customList: ComicIssue[] = (db.customComics || []).filter((c: any) => c && c.id);

  // Combine custom comics from database with raw catalog without duplicating
  const allComicsMap = new Map<string, ComicIssue>();
  for (const c of customList) {
    allComicsMap.set(c.id, c);
  }
  for (const c of rawComics) {
    if (!allComicsMap.has(c.id)) {
      allComicsMap.set(c.id, c);
    }
  }

  return Array.from(allComicsMap.values()).map((c) => {
    const prog = db.readingProgress[c.id] || progressMap[c.id];
    const isFav = Boolean(db.favorites[c.id]);
    const inCol = Boolean(db.collection[c.id]);
    const aiSyn = db.aiSynopses[c.id]?.synopsis;
    const aiData = db.aiSynopses[c.id];
    const dbCover = db.covers?.[c.id]?.coverDataUrl;
    return {
      ...c,
      coverUrl: dbCover || c.coverUrl,
      currentPage: prog?.currentPage || c.currentPage,
      readProgressPercent: prog?.progressPercent || c.readProgressPercent,
      lastReadText: prog?.isCompleted ? 'Concluído' : prog ? `Pág ${prog.currentPage}` : c.lastReadText,
      isBookmarked: isFav || c.isBookmarked,
      isInCollection: inCol || c.isInCollection,
      synopsis: aiSyn || c.synopsis,
      aiSynopsis: aiData || c.aiSynopsis,
    };
  });
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
        if (Array.isArray(parsed) && parsed.length >= COMICS_DATABASE.length) {
          const validVaultItems = parsed.filter((c: any) => c.id && c.id.startsWith('vault-'));
          if (validVaultItems.length > 0) return mergeComicsWithSavedProgress(validVaultItems);
        }
      }
    } catch {}
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

  // Silent automatic sync from backend in the background
  useEffect(() => {
    let isMounted = true;
    const loadComicsSilently = () => {
      fetchAcervoComics()
        .then((liveComics) => {
          if (!isMounted) return;
          if (liveComics && Array.isArray(liveComics) && liveComics.length > 0) {
            const realComics = liveComics.filter((c) => c.id.startsWith('vault-'));
            if (realComics.length > 0) {
              const enrichedComics = mergeComicsWithSavedProgress(realComics);
              setComics((prev) => {
                // Avoid re-renders if the list has not changed
                if (prev.length === enrichedComics.length && prev[0]?.id === enrichedComics[0]?.id) {
                  return prev;
                }
                return enrichedComics;
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

    loadComicsSilently();
    // Periodically refresh comics behind the scenes every 30 seconds
    const interval = setInterval(loadComicsSilently, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Initialize Cloud Firestore Sync when user is authenticated
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
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

  // If in Reader view, render fullscreen reader
  if (activeView === 'reader' && selectedComic) {
    return (
      <ActiveReaderScreen
        comic={selectedComic}
        initialPage={readerPage}
        onBack={() => setActiveView(selectedComic ? 'details' : 'main')}
        onUpdateProgress={handleUpdateProgress}
        onToggleBookmark={handleToggleBookmark}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#12121f] text-[#f4ebd8] flex flex-col font-manrope">
      {/* Header */}
      <Header
        title={getHeaderTitle()}
        showBack={activeView === 'details'}
        onBack={() => setActiveView('main')}
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
      />

      {/* Main Screen Content */}
      <main className="flex-1">
        {activeView === 'details' && selectedComic ? (
          <IssueDetailsScreen
            comic={selectedComic}
            saga={sagas[0]}
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
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        hasActiveReading={comics.length > 0}
      />

      {/* Create Profile Modal */}
      <CreateProfileModal
        isOpen={!userProfile || isProfileModalOpen}
        onProfileCreated={(createdProfile) => {
          setUserProfile(createdProfile);
          setIsProfileModalOpen(false);
        }}
        defaultName="THIAGO"
      />

      {/* Global Modals */}
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

      {/* Local Comic File Opener (.cbr, .cbz, .pdf, .epub, .cb7, .cbt) */}
      <LocalFileOpenerModal
        isOpen={isLocalFileModalOpen}
        onClose={() => setIsLocalFileModalOpen(false)}
        onComicLoaded={(newComic) => {
          addCustomComicToDatabase(newComic);
          setComics((prev) => [newComic, ...prev.filter((c) => c.id !== newComic.id)]);
          handleOpenReader(newComic, 1);
        }}
      />
    </div>
  );
}
