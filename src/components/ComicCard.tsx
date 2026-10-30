import React, { useState } from 'react';
import { ComicIssue } from '../types/comic';
import { BookOpen } from 'lucide-react';
import { ClientComicCover } from './ClientComicCover';
import { getLocalCover } from '../services/localCoverStorage';

import { getComicCoverFromSupabase } from '../lib/supabase';

interface ComicCardProps {
  comic: ComicIssue;
  onSelect: (comic: ComicIssue) => void;
  onContinueReading?: (comic: ComicIssue) => void;
  showProgress?: boolean;
  aspect?: '2/3' | '3/4';
  size?: 'sm' | 'md' | 'lg';
}

const resolveInitialCover = (c: ComicIssue): string => {
  if (c.coverUrl && c.coverUrl.includes('supabase.co')) {
    return c.coverUrl;
  }
  const supa = getComicCoverFromSupabase(c.id, (c as any).rawFileName, c.title);
  if (supa) {
    return supa;
  }
  return `/covers/${c.id}.jpg`;
};

export const ComicCard: React.FC<ComicCardProps> = ({
  comic,
  onSelect,
  onContinueReading,
  showProgress = false,
  aspect = '2/3',
  size = 'md',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(() => resolveInitialCover(comic));
  const [hasError, setHasError] = useState(false);
  const [localLqip, setLocalLqip] = useState<string | null>(() => (comic as any).lqip || null);
  const [isFullLoaded, setIsFullLoaded] = useState(false);

  React.useEffect(() => {
    setCurrentSrc(resolveInitialCover(comic));
    setHasError(false);
    setIsFullLoaded(false);

    // Load device-cached low quality preview immediately for 0ms visual appearance
    let isSubscribed = true;
    getLocalCover(comic.id).then((cached) => {
      if (isSubscribed && cached) {
        setLocalLqip(cached);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [comic.id, comic.coverUrl]);

  const handleImageError = () => {
    if (currentSrc.includes('supabase.co')) {
      setCurrentSrc(`/covers/${comic.id}.jpg`);
    } else if (currentSrc.startsWith('/covers/')) {
      setCurrentSrc(`/api/acervo/cover/${comic.id}`);
    } else if (currentSrc.includes('/api/acervo/cover/')) {
      setCurrentSrc(`/api/acervo/cover-art/${comic.id}`);
    } else {
      setHasError(true);
    }
  };

  const widthClasses = {
    sm: 'w-32 min-w-[128px]',
    md: 'w-40 min-w-[160px]',
    lg: 'w-48 min-w-[192px]',
  }[size];

  const aspectClass = aspect === '3/4' ? 'aspect-[3/4]' : 'aspect-[2/3]';

  return (
    <div
      onClick={() => onSelect(comic)}
      className={`group relative flex-shrink-0 cursor-pointer ${widthClasses} flex flex-col transition-all duration-200 hover:-translate-y-1`}
    >
      {/* Cover frame */}
      <div
        className={`relative w-full ${aspectClass} overflow-hidden rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 group-hover:border-[#ffc531] transition-all duration-200 shadow-lg`}
      >
        {/* Instant Low-Quality Device Preview (LQIP) */}
        {localLqip && (
          <img
            src={localLqip}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 filter blur-xs scale-105 ${
              isFullLoaded && !hasError ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          />
        )}

        {!hasError ? (
          <img
            src={currentSrc}
            alt={comic.title}
            onError={handleImageError}
            onLoad={() => setIsFullLoaded(true)}
            className={`relative z-5 h-full w-full object-cover transition-all duration-300 group-hover:scale-105 ${
              isFullLoaded ? 'opacity-100' : localLqip ? 'opacity-0' : 'opacity-100'
            }`}
            loading="lazy"
            decoding="async"
          />
        ) : localLqip ? (
          /* If full-res failed but local LQIP is available, show clear local preview */
          <img
            src={localLqip}
            alt={comic.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <ClientComicCover comic={comic} />
        )}

        {/* Top-left Badge (Show only non-format rarity/special badges) */}
        {comic.badge && !/cbr|cbz|rar|pdf|arquivo/i.test(comic.badge) && (
          <div className="absolute top-1.5 left-1.5 z-10">
            <span
              className={`inline-block px-1.5 py-0.5 text-[10px] font-bold font-anton tracking-wider uppercase rounded-[2px] ${
                comic.badgeType === 'rarity'
                  ? 'bg-[#ffc531] text-[#12121f]'
                  : comic.badgeType === 'restored'
                  ? 'bg-[#ffc531] text-[#12121f]'
                  : 'bg-[#d62839] text-[#f4ebd8]'
              }`}
            >
              {comic.badge}
            </span>
          </div>
        )}

        {/* Year pill on bottom right */}
        <div className="absolute bottom-1.5 right-1.5 z-10">
          <span className="bg-[#12121f]/90 backdrop-blur-xs px-1.5 py-0.5 text-[10px] font-semibold text-[#8a8ca5] rounded-[2px]">
            {comic.year}
          </span>
        </div>

        {/* Reading progress overlay bar */}
        {showProgress && comic.readProgressPercent > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 h-1.5 bg-black/40">
            <div
              className={`h-full ${comic.readProgressPercent >= 100 ? 'bg-[#10b981]' : 'bg-[#d62839]'}`}
              style={{ width: `${Math.min(100, comic.readProgressPercent)}%` }}
            />
          </div>
        )}

        {/* Hover Quick Action */}
        <div className="absolute inset-0 z-15 bg-gradient-to-t from-[#12121f] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
          {onContinueReading && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContinueReading(comic);
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] text-xs font-anton tracking-wide uppercase rounded-[2px] shadow-md border border-[#ffc531]"
            >
              <BookOpen className="w-3 h-3" />
              {comic.readProgressPercent >= 100 ? 'Reler' : 'Ler Agora'}
            </button>
          )}
        </div>
      </div>

      {/* Two baseline metadata rows */}
      <div className="mt-2 flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#8a8ca5]">
          <span className="truncate">{comic.publisher} • {comic.year}</span>
        </div>
        <h4 className="text-xs font-bold text-[#f4ebd8] line-clamp-1 group-hover:text-[#ffc531] transition-colors">
          {comic.title}
        </h4>
        {showProgress && (
          <span className="text-[11px] font-medium text-[#8a8ca5]">
            {comic.readProgressPercent >= 100 ? (
              <span className="text-[#10b981] font-bold">🏆 Concluído (100%)</span>
            ) : (
              `Pág ${comic.currentPage || 1} de ${comic.totalPages}`
            )}
          </span>
        )}
      </div>
    </div>
  );
};
