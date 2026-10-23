import React from 'react';
import { ComicIssue } from '../types/comic';
import { BookOpen, ShieldCheck } from 'lucide-react';

interface ClientComicCoverProps {
  comic: ComicIssue;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const ClientComicCover: React.FC<ClientComicCoverProps> = ({ comic, size = 'md' }) => {
  const rawTitle = comic.title || 'EDIÇÃO EXCLUSIVA MARVEL';
  const cleanTitle = rawTitle.replace(/[\(\)\d\-_]/g, ' ').trim().slice(0, 36);
  const publisher = comic.publisher || 'Marvel';
  const issueNum = comic.issueNumber || 1;
  const year = comic.year || 1985;
  const isAbril =
    rawTitle.toLowerCase().includes('abril') ||
    rawTitle.toLowerCase().includes('super') ||
    rawTitle.toLowerCase().includes('heróis');
  const bannerText = isAbril ? 'EDITORA ABRIL' : `${publisher.toUpperCase()} COMICS`;
  const saga = (comic.sagaTitle || publisher).slice(0, 24);

  const isHero = size === 'hero';

  return (
    <div
      className={`w-full h-full relative overflow-hidden bg-gradient-to-b from-[#1f1035] via-[#12121f] to-[#0a0a14] flex flex-col justify-between select-none border border-[#ffc531]/40 ${
        isHero ? 'p-6' : 'p-2.5'
      }`}
    >
      {/* Top Banner (Trade Dress) */}
      <div
        className={`bg-gradient-to-r from-[#d62839] to-[#b20024] flex items-center justify-between border-b border-[#ffc531]/40 shadow-md ${
          isHero ? '-mx-6 -mt-6 px-6 py-2.5' : '-mx-2.5 -mt-2.5 px-2.5 py-1.5'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`font-anton tracking-wider text-[#f4ebd8] uppercase truncate ${
              isHero ? 'text-sm' : 'text-[10px]'
            }`}
          >
            {bannerText}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] font-bold text-[#ffc531]">#{issueNum}</span>
          <span className="text-[8px] bg-[#12121f]/80 px-1 py-0.2 rounded text-[#f4ebd8] font-bold">
            {year}
          </span>
        </div>
      </div>

      {/* Comics Code Seal Icon */}
      <div className="flex justify-between items-start pt-1">
        <div className="bg-[#12121f]/90 border border-[#ffc531]/30 px-1.5 py-0.5 rounded-[2px] text-[8px] font-mono text-[#ffc531]">
          {comic.format?.toUpperCase() || 'HQ'}
        </div>
        <div className="border border-[#8a8ca5]/30 bg-[#12121f]/90 px-1 py-0.5 rounded-[2px] text-[7px] font-bold text-[#f4ebd8] flex items-center gap-0.5">
          <ShieldCheck className="w-2.5 h-2.5 text-[#ffc531]" />
          <span>AUTÊNTICO</span>
        </div>
      </div>

      {/* Center Comic Badge & Title */}
      <div className="my-auto text-center flex flex-col items-center justify-center px-1">
        <div
          className={`rounded-full border border-[#ffc531] bg-[#d62839]/25 flex items-center justify-center shadow-lg mb-2 ${
            isHero ? 'w-16 h-16' : 'w-10 h-10'
          }`}
        >
          <BookOpen className={`${isHero ? 'w-8 h-8 text-[#ffc531]' : 'w-5 h-5 text-[#ffc531]'}`} />
        </div>

        <h4
          className={`font-anton leading-tight text-[#ffc531] uppercase tracking-wide drop-shadow-md ${
            isHero ? 'text-xl sm:text-2xl line-clamp-3' : 'text-xs line-clamp-3'
          }`}
        >
          {cleanTitle.toUpperCase()}
        </h4>

        {saga && (
          <span className="inline-block mt-1.5 text-[8px] font-bold text-[#16e1ff] bg-[#16e1ff]/15 px-2 py-0.5 rounded-[2px] uppercase tracking-wider truncate max-w-[95%] border border-[#16e1ff]/30">
            {saga.toUpperCase()}
          </span>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div
        className={`border-t border-[#8a8ca5]/20 bg-[#12121f]/95 flex items-center justify-between font-mono text-[#8a8ca5] ${
          isHero ? '-mx-6 -mb-6 px-6 py-2.5 text-xs' : '-mx-2.5 -mb-2.5 px-2.5 py-1 text-[8px]'
        }`}
      >
        <span className="font-semibold text-[#f4ebd8]">{comic.publisher}</span>
        <span className="text-[#ffc531] font-bold">{comic.totalPages} PÁGINAS</span>
      </div>
    </div>
  );
};
