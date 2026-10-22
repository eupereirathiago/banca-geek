import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, Bookmark, Share2, Cloud, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types/comic';
import { subscribeToSyncStatus, CloudSyncStatus } from '../services/cloudSyncService';

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
}) => {
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>({
    isCloudConnected: false,
    isSyncing: false,
    lastCloudSync: null,
    userId: null,
    pendingChangesCount: 0,
    syncError: null,
  });

  useEffect(() => {
    return subscribeToSyncStatus((status) => {
      setCloudStatus(status);
    });
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

          {/* User Profile Avatar with Reading Milestone Seal */}
          <button
            onClick={onOpenProfile}
            title={userProfile?.readBadge || 'Perfil do Leitor'}
            aria-label={`Perfil do usuário - ${userProfile?.name || 'Leitor'}`}
            className="relative ml-0.5 rounded-full p-0.5 ring-2 ring-[#ffc531] hover:ring-[#d62839] transition-all cursor-pointer flex-shrink-0 group"
          >
            <img
              src={userProfile?.avatarUrl || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=250&q=80'}
              alt={userProfile?.name || 'Leitor'}
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
