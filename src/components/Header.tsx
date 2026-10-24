import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, Bookmark, Share2, Cloud, RefreshCw, LogIn, Download } from 'lucide-react';
import { UserProfile } from '../types/comic';
import { subscribeToSyncStatus, CloudSyncStatus } from '../services/cloudSyncService';
import { auth, googleSignIn } from '../services/authService';
import { User } from 'firebase/auth';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSearch?: boolean;
  onOpenSearch?: () => void;
  showBookmark?: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  showShare?: boolean;
  onShare?: () => void;
  onOpenProfile?: () => void;
  userProfile?: UserProfile | null;
  onOpenInstall?: () => void;
  isInstalled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'BANCA GEEK',
  showBack = false,
  onBack,
  showSearch = true,
  onOpenSearch,
  showBookmark = false,
  isBookmarked = false,
  onToggleBookmark,
  showShare = false,
  onShare,
  onOpenProfile,
  userProfile,
  onOpenInstall,
  isInstalled = false,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>({
    isCloudConnected: false,
    isSyncing: false,
    lastCloudSync: null,
    userId: null,
    pendingChangesCount: 0,
    syncError: null,
  });

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => setCurrentUser(u));
    const unsubSync = subscribeToSyncStatus((status) => {
      setCloudStatus(status);
    });
    return () => {
      unsubAuth();
      unsubSync();
    };
  }, []);
  return (
    <header className="sticky top-0 z-40 w-full bg-[#12121f]/95 backdrop-blur-md border-b border-[#8a8ca5]/15 px-3 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Left Side: Back button or Brand */}
        <div className="flex items-center gap-2">
          {showBack ? (
            <button
              onClick={onBack}
              aria-label="Voltar"
              className="p-1.5 -ml-1 text-[#f4ebd8] hover:text-[#ffc531] hover:bg-[#1a1a2e] rounded-full transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}

          {/* Brand Logo */}
          <div
            onClick={onBack ? undefined : onOpenProfile}
            className="flex items-center gap-1.5 cursor-pointer select-none"
          >
            <div className="w-6 h-6 bg-[#ffc531] rounded-[2px] flex items-center justify-center shadow-xs">
              <span className="font-anton text-xs text-[#12121f] font-black leading-none">B</span>
            </div>
            <span className="font-anton text-sm tracking-wider text-[#f4ebd8] uppercase font-normal">
              BANCA GEEK
            </span>
          </div>
        </div>

        {/* Center Title */}
        <div className="flex-1 text-center truncate px-2">
          <span className="font-anton text-base md:text-lg tracking-wider text-[#f4ebd8] uppercase truncate block">
            {title}
          </span>
        </div>

        {/* Right Action Icons & Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {showSearch && onOpenSearch && (
            <button
              onClick={onOpenSearch}
              aria-label="Buscar quadrinhos"
              className="p-1.5 text-[#f4ebd8] hover:text-[#ffc531] hover:bg-[#1a1a2e] rounded-full transition-colors cursor-pointer"
            >
              <Search className="w-5 h-5" />
            </button>
          )}

          {showShare && onShare && (
            <button
              onClick={onShare}
              aria-label="Compartilhar"
              className="p-1.5 text-[#f4ebd8] hover:text-[#ffc531] hover:bg-[#1a1a2e] rounded-full transition-colors cursor-pointer"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}

          {showBookmark && onToggleBookmark && (
            <button
              onClick={onToggleBookmark}
              aria-label="Salvar favorito"
              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                isBookmarked
                  ? 'text-[#ffc531] bg-[#1a1a2e]'
                  : 'text-[#f4ebd8] hover:text-[#ffc531] hover:bg-[#1a1a2e]'
              }`}
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-[#ffc531]' : ''}`} />
            </button>
          )}

          {/* Quick Install PWA button */}
          {!isInstalled && onOpenInstall && (
            <button
              onClick={onOpenInstall}
              title="Instalar App no seu aparelho"
              className="flex items-center gap-1 px-2 py-1 bg-[#1a1a2e] hover:bg-[#ffc531] text-[#ffc531] hover:text-[#12121f] border border-[#ffc531]/40 rounded-[4px] text-[10px] font-anton tracking-wider uppercase transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">INSTALAR APP</span>
            </button>
          )}

          {/* Google 1-Click Login Button if not logged in */}
          {!currentUser ? (
            <button
              onClick={async () => {
                try {
                  await googleSignIn();
                } catch {
                  onOpenProfile?.();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-[#12121f] rounded-[4px] text-xs font-anton tracking-wider uppercase font-bold shadow-sm transition-all cursor-pointer active:scale-95"
              title="Entrar com sua conta Google"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>ENTRAR</span>
            </button>
          ) : null}

          {/* User Profile Avatar with Reading Milestone Seal */}
          <button
            onClick={onOpenProfile}
            title={currentUser?.displayName || userProfile?.readBadge || 'Perfil do Leitor'}
            aria-label={`Perfil do usuário - ${currentUser?.displayName || userProfile?.name || 'Leitor'}`}
            className="relative ml-0.5 rounded-full p-0.5 ring-2 ring-[#ffc531] hover:ring-[#d62839] transition-all cursor-pointer flex-shrink-0 group"
          >
            <img
              src={currentUser?.photoURL || userProfile?.avatarUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=250&q=80'}
              alt={currentUser?.displayName || userProfile?.name || 'Leitor'}
              className="w-7 h-7 rounded-full object-cover"
            />
            {/* Reading quantity mini seal */}
            <div className="absolute -bottom-1 -right-1 bg-[#ffc531] text-[#12121f] rounded-full px-1 py-0.2 text-[8px] font-anton font-bold leading-none shadow-xs border border-[#12121f]">
              {userProfile?.readIssuesCount ?? 0}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
