import React from 'react';
import { ComicIssue } from '../types/comic';
import { ShieldCheck, Flame, Zap, Sparkles, Award } from 'lucide-react';

interface ClientComicCoverProps {
  comic: ComicIssue;
  size?: 'sm' | 'md' | 'lg' | 'hero';
}

export const ClientComicCover: React.FC<ClientComicCoverProps> = ({ comic, size = 'md' }) => {
  const rawTitle = comic.title || 'EDIÇÃO MARVEL';
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

  // Determine dynamic thematic color palette based on title or saga
  const titleLower = rawTitle.toLowerCase();
  const isThanos = titleLower.includes('thanos') || titleLower.includes('infinito') || titleLower.includes('desafio');
  const isAvengers = titleLower.includes('vingadores') || titleLower.includes('avengers') || titleLower.includes('capit') || titleLower.includes('ferro');
  const isSpider = titleLower.includes('pulse') || titleLower.includes('aranha') || titleLower.includes('spider');
  const isCosmic = titleLower.includes('warlock') || titleLower.includes('surfe') || titleLower.includes('silver') || titleLower.includes('guardi');
  const isMutant = titleLower.includes('x-men') || titleLower.includes('mutant') || titleLower.includes('wolverine');

  const theme = isThanos
    ? {
        bg: 'from-[#2e0854] via-[#1a0933] to-[#0a0518]',
        accent: '#ffc531',
        border: 'border-[#ffc531]',
        tagBg: 'bg-[#9333ea]/30',
        tagText: 'text-[#e9d5ff]',
        badgeBg: 'bg-[#ffc531]',
        badgeText: 'text-[#12121f]',
        icon: <Sparkles className="w-6 h-6 text-[#ffc531]" />,
        aura: 'from-amber-400/20 to-purple-600/30',
      }
    : isAvengers
    ? {
        bg: 'from-[#450a0a] via-[#1f0e1a] to-[#0a0a14]',
        accent: '#ef4444',
        border: 'border-[#ef4444]',
        tagBg: 'bg-[#dc2626]/30',
        tagText: 'text-[#fecaca]',
        badgeBg: 'bg-[#ef4444]',
        badgeText: 'text-white',
        icon: <ShieldCheck className="w-6 h-6 text-[#ef4444]" />,
        aura: 'from-red-500/20 to-amber-500/20',
      }
    : isSpider
    ? {
        bg: 'from-[#3b0764] via-[#15102a] to-[#0a0a14]',
        accent: '#06b6d4',
        border: 'border-[#06b6d4]',
        tagBg: 'bg-[#0891b2]/30',
        tagText: 'text-[#cffafe]',
        badgeBg: 'bg-[#06b6d4]',
        badgeText: 'text-[#12121f]',
        icon: <Zap className="w-6 h-6 text-[#06b6d4]" />,
        aura: 'from-cyan-500/20 to-blue-600/20',
      }
    : isCosmic
    ? {
        bg: 'from-[#0f172a] via-[#1e1b4b] to-[#0a0a14]',
        accent: '#38bdf8',
        border: 'border-[#38bdf8]',
        tagBg: 'bg-[#0284c7]/30',
        tagText: 'text-[#e0f2fe]',
        badgeBg: 'bg-[#38bdf8]',
        badgeText: 'text-[#0f172a]',
        icon: <Flame className="w-6 h-6 text-[#38bdf8]" />,
        aura: 'from-sky-500/20 to-indigo-600/20',
      }
    : isMutant
    ? {
        bg: 'from-[#362f05] via-[#1a1820] to-[#0a0a14]',
        accent: '#eab308',
        border: 'border-[#eab308]',
        tagBg: 'bg-[#ca8a04]/30',
        tagText: 'text-[#fef08a]',
        badgeBg: 'bg-[#eab308]',
        badgeText: 'text-[#12121f]',
        icon: <Award className="w-6 h-6 text-[#eab308]" />,
        aura: 'from-yellow-500/20 to-amber-600/20',
      }
    : {
        bg: 'from-[#1e1136] via-[#131124] to-[#0a0a14]',
        accent: '#ffc531',
        border: 'border-[#ffc531]',
        tagBg: 'bg-[#ffc531]/20',
        tagText: 'text-[#ffc531]',
        badgeBg: 'bg-[#ffc531]',
        badgeText: 'text-[#12121f]',
        icon: <ShieldCheck className="w-6 h-6 text-[#ffc531]" />,
        aura: 'from-amber-500/20 to-purple-600/20',
      };

  const isHero = size === 'hero';

  return (
    <div
      className={`w-full h-full relative overflow-hidden bg-gradient-to-b ${theme.bg} flex flex-col justify-between select-none border-2 border-black shadow-inner ${
        isHero ? 'p-6' : 'p-2'
      }`}
    >
      {/* Halftone / Comic Dot Texture Simulation */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '6px 6px',
        }}
      />

      {/* Radiant Glow in Center */}
      <div className={`absolute inset-0 bg-gradient-to-r ${theme.aura} pointer-events-none opacity-40`} />

      {/* Top Banner (Classic Comic Trade Dress) */}
      <div
        className={`bg-gradient-to-r from-[#d62839] via-[#b20024] to-[#800018] flex items-center justify-between border-b-2 border-black shadow-lg relative z-10 ${
          isHero ? '-mx-6 -mt-6 px-6 py-2.5' : '-mx-2 -mt-2 px-2 py-1'
        }`}
      >
        <span
          className={`font-anton tracking-wider text-[#f4ebd8] uppercase truncate drop-shadow-sm ${
            isHero ? 'text-sm' : 'text-[10px]'
          }`}
        >
          {bannerText}
        </span>
        <div className="flex items-center gap-1 font-mono font-bold">
          <span className="text-[9px] text-[#ffc531] bg-black/60 px-1 py-0.5 rounded-[2px]">
            #{issueNum}
          </span>
          <span className="text-[8px] text-white/90 bg-black/40 px-1 py-0.5 rounded-[2px]">
            {year}
          </span>
        </div>
      </div>

      {/* Corner Box / Rating / Code Seal */}
      <div className="flex justify-between items-start pt-1 relative z-10">
        <div className="bg-black/70 border border-[#ffc531]/40 px-1.5 py-0.5 rounded-[2px] text-[8px] font-mono text-[#ffc531] font-bold">
          HQ
        </div>
        <div className="border border-white/30 bg-black/70 px-1 py-0.5 rounded-[2px] text-[7px] font-bold text-[#f4ebd8] flex items-center gap-0.5 tracking-wider">
          <span>COMICS CODE</span>
        </div>
      </div>

      {/* Dynamic Comic Art Showcase (Heroic Crest + Dramatic Title) */}
      <div className="my-auto text-center flex flex-col items-center justify-center px-1 relative z-10">
        {/* Dynamic Glowing Comic Insignia */}
        <div
          className={`relative rounded-full border-2 ${theme.border} bg-black/60 flex items-center justify-center shadow-2xl mb-2.5 ${
            isHero ? 'w-20 h-20' : 'w-12 h-12'
          }`}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
          {theme.icon}
        </div>

        {/* Vintage Impact Comic Title */}
        <h4
          className={`font-anton leading-tight text-[#ffc531] uppercase tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${
            isHero ? 'text-2xl sm:text-3xl line-clamp-3' : 'text-xs line-clamp-3'
          }`}
          style={{ WebkitTextStroke: '0.5px black' }}
        >
          {cleanTitle.toUpperCase()}
        </h4>

        {/* Comic Arc / Saga Tag */}
        {saga && (
          <span
            className={`inline-block mt-1.5 font-bold uppercase tracking-wider truncate max-w-[95%] border ${theme.border}/40 ${theme.tagBg} ${theme.tagText} ${
              isHero ? 'text-xs px-3 py-1 rounded-[3px]' : 'text-[8px] px-1.5 py-0.5 rounded-[2px]'
            }`}
          >
            {saga.toUpperCase()}
          </span>
        )}
      </div>

      {/* Bottom Footer Info (Simulating comic UPC / Publisher footer) */}
      <div
        className={`border-t-2 border-black bg-black/90 flex items-center justify-between font-mono relative z-10 ${
          isHero ? '-mx-6 -mb-6 px-6 py-2.5 text-xs' : '-mx-2 -mb-2 px-2 py-1 text-[8px]'
        }`}
      >
        <span className="font-bold text-[#f4ebd8] tracking-wider uppercase">{publisher}</span>
        <span className="text-[#ffc531] font-bold">{comic.totalPages} PÁG.</span>
      </div>
    </div>
  );
};
