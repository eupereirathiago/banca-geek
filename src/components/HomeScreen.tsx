import React, { useState, useMemo } from 'react';
import { ComicIssue, Saga, CharacterHighlight } from '../types/comic';
import { ComicCard } from './ComicCard';
import { ClientComicCover } from './ClientComicCover';
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  Sparkles,
  Trophy,
  ArrowRight,
  Search,
  LayoutGrid,
  Layers,
  HardDrive,
  Flame,
  Check,
  Plus,
  RefreshCw
} from 'lucide-react';

interface HomeScreenProps {
  comics: ComicIssue[];
  sagas: Saga[];
  characters: CharacterHighlight[];
  onSelectComic: (comic: ComicIssue) => void;
  onOpenReader: (comic: ComicIssue, pageNumber?: number) => void;
  onSelectSaga: (saga: Saga) => void;
  onOpenRestorationModal: () => void;
  onToggleBookmarkComic: (comicId: string) => void;
  onSelectPublisherFilter?: (publisher: string) => void;
  onOpenLocalFileModal?: () => void;
  onSyncAcervo?: () => void;
  isSyncing?: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  comics,
  sagas,
  characters,
  onSelectComic,
  onOpenReader,
  onSelectSaga,
  onToggleBookmarkComic,
  onOpenLocalFileModal,
  onSyncAcervo,
  isSyncing = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [viewMode, setViewMode] = useState<'sections' | 'grid'>('sections');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleLimit, setVisibleLimit] = useState<number>(48);
  const [heroImageError, setHeroImageError] = useState<boolean>(false);


  // Featured hero issue
  const heroIssue = useMemo(() => {
    if (!comics || comics.length === 0) return null;
    const featured = comics.find((c) => {
      if (!c || typeof c.title !== 'string') return false;
      const t = c.title.toLowerCase();
      return (
        t.includes('desafio infinito') ||
        t.includes('saga de thanos') ||
        t.includes('marvels')
      );
    });
    return featured || comics[0] || null;
  }, [comics]);

  React.useEffect(() => {
    setHeroImageError(false);
  }, [heroIssue?.id]);

  // Format breakdowns
  const pdfComics = useMemo(() => (comics || []).filter((c) => c && (c.isPdf || c.format === 'pdf')), [comics]);
  const cbrComics = useMemo(() => (comics || []).filter((c) => c && (c.format === 'cbr' || c.format === 'rar')), [comics]);
  const cbzComics = useMemo(() => (comics || []).filter((c) => c && (c.format === 'cbz' || c.format === 'zip')), [comics]);
  const epubComics = useMemo(() => (comics || []).filter((c) => c && c.format === 'epub'), [comics]);
  const cb7Comics = useMemo(() => (comics || []).filter((c) => c && (c.format === 'cb7' || c.format === '7z')), [comics]);
  const cbtComics = useMemo(() => (comics || []).filter((c) => c && (c.format === 'cbt' || c.format === 'tar')), [comics]);

  // In-progress reading list
  const inProgressComics = useMemo(
    () => (comics || []).filter((c) => c && (c.readProgressPercent || 0) > 0 && (c.readProgressPercent || 0) < 100),
    [comics]
  );

  const completedComics = useMemo(
    () => (comics || []).filter((c) => c && (c.readProgressPercent || 0) >= 100),
    [comics]
  );

  // Categorized collections from the authentic repository
  const thanosComics = useMemo(
    () =>
      (comics || []).filter((c) => {
        if (!c) return false;
        const t = ((c.title || '') + ' ' + (c.sagaTitle || '')).toLowerCase();
        return (
          t.includes('thanos') ||
          t.includes('infinit') ||
          t.includes('desafio') ||
          t.includes('warlock') ||
          t.includes('abismo')
        );
      }),
    [comics]
  );

  const cosmicSagasComics = useMemo(
    () =>
      (comics || []).filter((c) => {
        if (!c) return false;
        const t = ((c.title || '') + ' ' + (c.sagaTitle || '')).toLowerCase();
        return (
          t.includes('guardi') ||
          t.includes('aniquila') ||
          t.includes('guerra de reis') ||
          t.includes('dominio de reis') ||
          t.includes('domínio de reis') ||
          t.includes('vulcano')
        );
      }),
    [comics]
  );

  const streetDefendersComics = useMemo(
    () =>
      (comics || []).filter((c) => {
        if (!c) return false;
        const t = ((c.title || '') + ' ' + (c.sagaTitle || '')).toLowerCase();
        return (
          t.includes('defensores') ||
          t.includes('kung fu') ||
          t.includes('inumanos') ||
          t.includes('eternos') ||
          t.includes('campe')
        );
      }),
    [comics]
  );

  const fugitivesPulseComics = useMemo(
    () =>
      (comics || []).filter((c) => {
        if (!c) return false;
        const t = ((c.title || '') + ' ' + (c.sagaTitle || '')).toLowerCase();
        return t.includes('fugitivos') || t.includes('pulse');
      }),
    [comics]
  );

  const pantherAvengersComics = useMemo(
    () =>
      (comics || []).filter((c) => {
        if (!c) return false;
        const t = ((c.title || '') + ' ' + (c.sagaTitle || '')).toLowerCase();
        return (
          t.includes('pantera') ||
          t.includes('vingadores') ||
          t.includes('ms marvel') ||
          t.includes('capit')
        );
      }),
    [comics]
  );

  const alexRossNoirComics = useMemo(
    () =>
      (comics || []).filter((c) => {
        if (!c) return false;
        const t = ((c.title || '') + ' ' + (c.sagaTitle || '')).toLowerCase();
        return (
          t.includes('marvels') ||
          t.includes('terra x') ||
          t.includes('universo x') ||
          t.includes('alias') ||
          t.includes('criminal') ||
          t.includes('s.h.i.e.l.d.') ||
          t.includes('poder supremo') ||
          t.includes('aconteceria')
        );
      }),
    [comics]
  );

  const thanosIdSet = useMemo(() => new Set(thanosComics.map((c) => c.id)), [thanosComics]);
  const cosmicIdSet = useMemo(() => new Set(cosmicSagasComics.map((c) => c.id)), [cosmicSagasComics]);
  const fugitivesIdSet = useMemo(() => new Set(fugitivesPulseComics.map((c) => c.id)), [fugitivesPulseComics]);
  const defendersIdSet = useMemo(() => new Set(streetDefendersComics.map((c) => c.id)), [streetDefendersComics]);
  const heroisIdSet = useMemo(() => new Set(pantherAvengersComics.map((c) => c.id)), [pantherAvengersComics]);
  const epicosIdSet = useMemo(() => new Set(alexRossNoirComics.map((c) => c.id)), [alexRossNoirComics]);

  const categories = [
    { id: 'TODOS', label: `✪ TODOS (${comics.length})` },
    { id: 'EM_ANDAMENTO', label: `📖 Em Leitura (${inProgressComics.length})` },
    { id: 'CONCLUIDOS', label: `🏆 Lidos (${completedComics.length})` },
    { id: 'THANOS', label: `Thanos & Infinito (${thanosComics.length})` },
    { id: 'COSMICOS', label: `Sagas Cósmicas (${cosmicSagasComics.length})` },
    { id: 'DEFENSORES', label: `Defensores (${streetDefendersComics.length})` },
    { id: 'HEROIS', label: `Pantera & Vingadores (${pantherAvengersComics.length})` },
    { id: 'EPICOS', label: `Alex Ross & Clássicos (${alexRossNoirComics.length})` },
  ];

  // Filtered comics based on search and category
  const filteredComics = useMemo(() => {
    const cleanQ = searchQuery.trim().toLowerCase();
    const normQ = cleanQ.replace(/[\s\-_.]/g, '');

    return (comics || []).filter((comic) => {
      if (!comic) return false;
      const titleLower = (comic.title || '').toLowerCase();
      const rawLower = ((comic.rawFileName || '') + ' ' + ((comic as any).supabaseFileName || '')).toLowerCase();
      const sagaTitleStr = (comic.sagaTitle || '').toLowerCase();
      const sagaPartStr = (comic.sagaPart || '').toLowerCase();
      const folderStr = (comic.folderPath || '').toLowerCase();
      const yearStr = comic.year != null ? String(comic.year) : '';

      const directMatch =
        cleanQ === '' ||
        titleLower.includes(cleanQ) ||
        rawLower.includes(cleanQ) ||
        sagaTitleStr.includes(cleanQ) ||
        sagaPartStr.includes(cleanQ) ||
        folderStr.includes(cleanQ) ||
        yearStr.includes(cleanQ);

      const normMatch =
        normQ.length >= 2 &&
        (titleLower.replace(/[\s\-_.]/g, '').includes(normQ) ||
          rawLower.replace(/[\s\-_.]/g, '').includes(normQ) ||
          sagaTitleStr.replace(/[\s\-_.]/g, '').includes(normQ));

      const matchesSearch = directMatch || normMatch;

      if (!matchesSearch) return false;

      const progress = comic.readProgressPercent || 0;
      if (selectedCategory === 'TODOS') return true;
      if (selectedCategory === 'EM_ANDAMENTO') return progress > 0 && progress < 100;
      if (selectedCategory === 'CONCLUIDOS') return progress >= 100;
      if (selectedCategory === 'THANOS') return thanosIdSet.has(comic.id);
      if (selectedCategory === 'COSMICOS') return cosmicIdSet.has(comic.id);
      if (selectedCategory === 'FUGITIVOS') return fugitivesIdSet.has(comic.id);
      if (selectedCategory === 'DEFENSORES') return defendersIdSet.has(comic.id);
      if (selectedCategory === 'HEROIS') return heroisIdSet.has(comic.id);
      if (selectedCategory === 'EPICOS') return epicosIdSet.has(comic.id);

      return true;
    });
  }, [
    comics,
    searchQuery,
    selectedCategory,
    thanosIdSet,
    cosmicIdSet,
    fugitivesIdSet,
    defendersIdSet,
    heroisIdSet,
    epicosIdSet,
  ]);

  const displayedGridComics = useMemo(() => {
    return filteredComics.slice(0, visibleLimit);
  }, [filteredComics, visibleLimit]);

  return (
    <div className="pb-28 pt-2">
      {/* Sincronização / Atualização do Acervo */}
      {onSyncAcervo && (
        <div className="px-4 mb-3 flex items-center justify-end gap-2">
          <button
            onClick={onSyncAcervo}
            disabled={isSyncing}
            title="Sincronizar / Atualizar acervo com a nuvem"
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#ffc531] text-[#ffc531] hover:text-[#12121f] font-anton text-xs tracking-wider uppercase rounded-[4px] border border-[#ffc531]/50 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Atualizando Acervo...' : 'Sincronizar / Atualizar'}</span>
          </button>

          {onOpenLocalFileModal && (
            <button
              onClick={onOpenLocalFileModal}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#22223b] text-[#f4ebd8] hover:text-[#ffc531] font-anton text-xs tracking-wider uppercase rounded-[4px] border border-[#8a8ca5]/30 transition-all cursor-pointer shadow-md flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Abrir HQ</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Hero Featured Banner */}
      {heroIssue && (
        <div className="px-4 mb-5">
          <div
            onClick={() => onSelectComic(heroIssue)}
            className="relative overflow-hidden rounded-[4px] border border-[#8a8ca5]/20 bg-[#1a1a2e] cursor-pointer group shadow-2xl transition-all hover:border-[#ffc531]"
          >
            {/* Background cover art with gradient overlay */}
            <div className="relative h-80 sm:h-96 w-full overflow-hidden">
              {!heroImageError ? (
                <img
                  src={`/covers/${heroIssue.id}.jpg`}
                  alt={heroIssue.title}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.includes('/covers/')) {
                      target.src = heroIssue.coverUrl || `/api/acervo/cover/${heroIssue.id}`;
                    } else {
                      setHeroImageError(true);
                    }
                  }}
                  className="h-full w-full object-cover object-top filter brightness-80 contrast-110 group-hover:scale-102 transition-transform duration-500"
                />
              ) : (
                <ClientComicCover comic={heroIssue} size="hero" />
              )}
              {/* Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#12121f] via-[#12121f]/75 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#12121f]/90 via-[#12121f]/50 to-transparent pointer-events-none" />

              {/* Content overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#ffc531] text-[#12121f] text-xs font-anton tracking-wider uppercase rounded-[2px] font-bold">
                    <Trophy className="w-3 h-3" />
                    {heroIssue.badge || 'DESTAQUE DO DEPÓSITO'}
                  </span>
                  <span className="px-2 py-0.5 bg-[#12121f]/80 backdrop-blur-xs text-[#8a8ca5] text-xs font-semibold rounded-[2px] border border-[#8a8ca5]/30 uppercase">
                    {heroIssue.publisher} • {heroIssue.year}
                  </span>
                </div>

                <h1 className="font-anton text-2xl sm:text-3xl md:text-4xl tracking-wide uppercase text-[#f4ebd8] group-hover:text-[#ffc531] transition-colors leading-tight mb-2">
                  {heroIssue.title}
                </h1>

                <p className="text-xs sm:text-sm text-[#8a8ca5] line-clamp-2 max-w-xl mb-4 font-normal">
                  {heroIssue.synopsis}
                </p>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenReader(heroIssue, heroIssue.currentPage || 1);
                    }}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-sm tracking-widest uppercase rounded-[4px] shadow-lg border border-[#ffc531] transition-all cursor-pointer active:scale-98"
                  >
                    <BookOpen className="w-4 h-4" />
                    ABRIR LEITOR
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleBookmarkComic(heroIssue.id);
                    }}
                    aria-label="Salvar na lista"
                    className="p-2.5 bg-[#1a1a2e]/90 hover:bg-[#22223b] border border-[#8a8ca5]/30 rounded-[4px] text-[#f4ebd8] hover:text-[#ffc531] transition-colors cursor-pointer"
                  >
                    <Bookmark
                      className={`w-5 h-5 ${heroIssue.isBookmarked ? 'fill-[#ffc531] text-[#ffc531]' : ''}`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search Bar & View Mode Toggle */}
      <div className="px-4 mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8ca5]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(48);
              }}
              placeholder="Buscar entre as 1.181 HQs por título, herói, saga ou ano..."
              className="w-full bg-[#1a1a2e] text-[#f4ebd8] placeholder-[#8a8ca5]/60 text-xs rounded-[4px] pl-9 pr-3 py-2 border border-[#8a8ca5]/20 focus:border-[#ffc531] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#8a8ca5] hover:text-[#f4ebd8]"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-[#1a1a2e] p-1 rounded-[4px] border border-[#8a8ca5]/20 self-end sm:self-auto">
            <button
              onClick={() => setViewMode('sections')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-all cursor-pointer ${
                viewMode === 'sections'
                  ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-xs'
                  : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Coleções
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-xs'
                  : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Grade ({filteredComics.length})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Category Filter Pills */}
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar py-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setVisibleLimit(48);
                }}
                className={`px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-[#ffc531] text-[#12121f] shadow-sm font-bold'
                    : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Section: CONTINUAR LENDO (only if in progress exists) */}
      {inProgressComics.length > 0 && (
        <div className="mb-6">
          <div className="px-4 flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#d62839] rounded-xs inline-block" />
              <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                CONTINUAR LENDO
              </h2>
            </div>
            <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
              {inProgressComics.length} EM ANDAMENTO
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
            {inProgressComics.map((comic, idx) => (
              <div key={`inprog-${comic.id}-${idx}`} className="snap-start">
                <ComicCard
                  comic={comic}
                  onSelect={onSelectComic}
                  onContinueReading={() => onOpenReader(comic, comic.currentPage)}
                  showProgress={true}
                  size="md"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. VIEW MODE: GRID */}
      {viewMode === 'grid' || searchQuery.trim() !== '' || selectedCategory !== 'TODOS' ? (
        <div className="px-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
              <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                CATÁLOGO ({filteredComics.length} EDIÇÕES)
              </h2>
            </div>
            <span className="text-xs text-[#8a8ca5]">
              Exibindo {Math.min(visibleLimit, filteredComics.length)} de {filteredComics.length}
            </span>
          </div>

          {filteredComics.length === 0 ? (
            <div className="bg-[#1a1a2e] p-8 text-center rounded-[4px] border border-[#8a8ca5]/20">
              <Search className="w-8 h-8 text-[#8a8ca5] mx-auto mb-2 opacity-60" />
              <p className="text-sm font-anton uppercase text-[#f4ebd8]">Nenhum arquivo encontrado</p>
              <p className="text-xs text-[#8a8ca5] mt-1">Tente ajustar o termo da busca ou categoria selecionada.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {displayedGridComics.map((comic, idx) => (
                  <div key={`grid-${comic.id}-${idx}`} className="flex justify-center">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>

              {visibleLimit < filteredComics.length && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setVisibleLimit((prev) => prev + 48)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1a1a2e] hover:bg-[#22223b] border border-[#ffc531] text-[#ffc531] rounded-[4px] font-anton text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    Carregar Mais Quadrinhos (+48)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* 7. VIEW MODE: SECTIONS */
        <>
          {/* Section: HQs em PDF (Official Drive PDF Reading) */}
          {pdfComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    HQS EM PDF • LEITURA OFICIAL ({pdfComics.length})
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setSelectedCategory('PDF');
                    setViewMode('grid');
                  }}
                  className="text-xs text-[#ffc531] hover:underline flex items-center gap-1 font-anton tracking-wider uppercase cursor-pointer"
                >
                  VER TODAS ({pdfComics.length}) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {pdfComics.slice(0, 30).map((comic, idx) => (
                  <div key={`pdf-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Thanos & As Joias do Infinito */}
          {thanosComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    SAGA DE THANOS &amp; O INFINITO ({thanosComics.length})
                  </h2>
                </div>
                <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
                  COSMIC MARVEL
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {thanosComics.slice(0, 25).map((comic, idx) => (
                  <div key={`thanos-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Sagas Cósmicas & Guerra de Reis */}
          {cosmicSagasComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#16e1ff] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    SAGAS CÓSMICAS &amp; GUERRA DE REIS ({cosmicSagasComics.length})
                  </h2>
                </div>
                <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
                  ANIQUILAÇÃO &amp; GUARDIÕES
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {cosmicSagasComics.slice(0, 25).map((comic, idx) => (
                  <div key={`cosmic-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Os Fugitivos */}
          {fugitivesPulseComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#d62839] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    OS FUGITIVOS &amp; THE PULSE ({fugitivesPulseComics.length})
                  </h2>
                </div>
                <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
                  BRIAN K. VAUGHAN
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {fugitivesPulseComics.slice(0, 25).map((comic, idx) => (
                  <div key={`fugitives-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Os Defensores & Mestres Marciais */}
          {streetDefendersComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    DEFENSORES, MESTRE DO KUNG FU &amp; ETERNOS ({streetDefendersComics.length})
                  </h2>
                </div>
                <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
                  CLÁSSICOS VINTAGE
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {streetDefendersComics.slice(0, 25).map((comic, idx) => (
                  <div key={`defenders-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Pantera Negra, Ms. Marvel & Vingadores */}
          {pantherAvengersComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#16e1ff] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    PANTERA NEGRA &amp; MS. MARVEL ({pantherAvengersComics.length})
                  </h2>
                </div>
                <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
                  WAKANDA &amp; VINGADORES
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {pantherAvengersComics.slice(0, 25).map((comic, idx) => (
                  <div key={`panther-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Alex Ross, Alias, Noir & Obras Modernas */}
          {alexRossNoirComics.length > 0 && (
            <div className="mb-7">
              <div className="px-4 flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-[#d62839] rounded-xs inline-block" />
                  <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                    ALEX ROSS, ALIAS &amp; ÉPICOS MODERNOS ({alexRossNoirComics.length})
                  </h2>
                </div>
                <span className="text-[11px] font-bold font-anton tracking-wider uppercase text-[#8a8ca5]">
                  MARVELS &amp; TERRA X
                </span>
              </div>

              <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
                {alexRossNoirComics.slice(0, 25).map((comic, idx) => (
                  <div key={`alex-${comic.id}-${idx}`} className="snap-start">
                    <ComicCard
                      comic={comic}
                      onSelect={onSelectComic}
                      onContinueReading={() => onOpenReader(comic, 1)}
                      showProgress={comic.readProgressPercent > 0}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Todas as Edições */}
          <div className="mb-7">
            <div className="px-4 flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-[#f4ebd8] rounded-xs inline-block" />
                <h2 className="font-anton text-base sm:text-lg tracking-wider uppercase text-[#f4ebd8]">
                  TODAS AS EDIÇÕES DO DEPÓSITO ({comics.length})
                </h2>
              </div>
              <button
                onClick={() => setViewMode('grid')}
                className="text-xs font-anton text-[#ffc531] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver Grade Completa <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-3 overflow-x-auto px-4 pb-2 hide-scrollbar snap-x">
              {comics.slice(0, 30).map((comic, idx) => (
                <div key={`all-${comic.id}-${idx}`} className="snap-start">
                  <ComicCard
                    comic={comic}
                    onSelect={onSelectComic}
                    onContinueReading={() => onOpenReader(comic, 1)}
                    showProgress={comic.readProgressPercent > 0}
                    size="md"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 8. Sagas Banner Section */}
      {sagas.length > 0 && (
        <div className="px-4 mb-6">
          <div className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#ffc531]" />
                <h3 className="font-anton text-base uppercase text-[#f4ebd8]">
                  COLEÇÕES &amp; SAGAS DO DEPÓSITO
                </h3>
              </div>
              <span className="text-xs text-[#ffc531] font-anton">{sagas.length} SAGAS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {sagas.slice(0, 6).map((saga, idx) => (
                <div
                  key={`home-saga-${saga.id || 'sg'}-${idx}`}
                  onClick={() => onSelectSaga(saga)}
                  className="flex items-center gap-3 p-2.5 bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/15 hover:border-[#ffc531] transition-all cursor-pointer group"
                >
                  <img
                    src={saga.bannerUrl}
                    alt={saga.title}
                    className="w-12 h-16 object-cover rounded-[2px]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-anton text-xs text-[#f4ebd8] group-hover:text-[#ffc531] transition-colors truncate uppercase">
                      {saga.title}
                    </h4>
                    <p className="text-[10px] text-[#8a8ca5] truncate">{saga.subtitle}</p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-[#ffc531]/10 text-[#ffc531] rounded-[2px] font-anton mt-1 inline-block">
                      {saga.totalIssues} EDIÇÕES
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8a8ca5] group-hover:text-[#ffc531]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
