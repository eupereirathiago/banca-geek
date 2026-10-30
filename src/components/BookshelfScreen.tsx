import React, { useState } from 'react';
import { ComicIssue, Saga, UserProfile } from '../types/comic';
import {
  BookOpen,
  Trophy,
  Search,
  ArrowRight,
  Sparkles,
  Star,
  Bookmark,
  Clock,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { getDatabaseState, getReaderStatistics } from '../services/databaseService';

interface BookshelfScreenProps {
  comics: ComicIssue[];
  sagas: Saga[];
  onSelectComic: (comic: ComicIssue) => void;
  onOpenReader: (comic: ComicIssue, pageNumber?: number) => void;
  onSelectSaga: (saga: Saga) => void;
  onOpenCacheManager: () => void;
  userProfile?: UserProfile | null;
  onOpenLocalFileModal?: () => void;
}

export const BookshelfScreen: React.FC<BookshelfScreenProps> = ({
  comics,
  sagas,
  onSelectComic,
  onOpenReader,
  onSelectSaga,
  userProfile,
  onOpenLocalFileModal,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'continuing' | 'completed' | 'favorites' | 'sagas' | 'activity'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPublisher, setSelectedPublisher] = useState<'Todas' | 'DC' | 'Marvel' | 'Vertigo' | 'Mangás'>('Todas');
  const [sortOrder, setSortOrder] = useState<'recent' | 'progress' | 'title'>('recent');

  const inProgress = comics.filter((c) => c.readProgressPercent > 0 && c.readProgressPercent < 100);
  const completed = comics.filter((c) => c.readProgressPercent >= 100);
  const favorites = comics.filter((c) => c.isBookmarked || c.isInCollection);

  // Filter items by tab
  const getTabComics = () => {
    if (activeTab === 'continuing') return inProgress;
    if (activeTab === 'completed') return completed;
    if (activeTab === 'favorites') return favorites;
    return comics;
  };

  // Filter by search & publisher
  const filteredIssues = getTabComics().filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.sagaTitle && c.sagaTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.scriptWriter && c.scriptWriter.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPublisher =
      selectedPublisher === 'Todas'
        ? true
        : c.publisher.toLowerCase().includes(selectedPublisher.toLowerCase());

    return matchesSearch && matchesPublisher;
  });

  // Sort issues
  filteredIssues.sort((a, b) => {
    if (sortOrder === 'title') return a.title.localeCompare(b.title);
    if (sortOrder === 'progress') return b.readProgressPercent - a.readProgressPercent;
    return 0;
  });

  const percentToNext = userProfile && userProfile.nextMilestoneCount > 0
    ? Math.min(100, Math.round((userProfile.readIssuesCount / userProfile.nextMilestoneCount) * 100))
    : 0;

  return (
    <div className="pb-28 pt-2 max-w-2xl mx-auto px-4">
      {/* 1. Collector Profile Card */}
      {userProfile && (
        <div className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-4 mb-4 shadow-xl">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="relative">
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-[#ffc531]"
              />
              <div className="absolute -bottom-1 -right-1 bg-[#ffc531] text-[#12121f] rounded-full px-1.5 py-0.5 shadow-md flex items-center gap-0.5 border border-[#12121f]">
                <BookOpen className="w-3 h-3 fill-current" />
                <span className="text-[9px] font-anton font-bold leading-none">{userProfile.readIssuesCount}</span>
              </div>
            </div>

            <div className="flex-1">
              <h2 className="font-anton text-xl tracking-wide uppercase text-[#f4ebd8]">
                {userProfile.name}
              </h2>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#ffc531] text-[#12121f] text-[11px] font-anton tracking-wider uppercase rounded-[2px] font-bold mt-0.5 shadow-sm">
                <BookOpen className="w-3.5 h-3.5 fill-current" />
                <span>{userProfile.readBadge}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#8a8ca5]">
                <span>Próximo marco: <strong className="text-[#16e1ff]">{userProfile.nextBadgeName}</strong></span>
                <span>•</span>
                <span>{userProfile.readIssuesCount}/{userProfile.nextMilestoneCount} ({percentToNext}%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[#12121f] rounded-[4px] p-3 border border-[#8a8ca5]/15 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[3px] bg-[#d62839]/20 border border-[#d62839]/40 flex items-center justify-center text-[#d62839]">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="font-anton text-xl text-[#f4ebd8] block leading-none">
                  {userProfile.readIssuesCount}
                </span>
                <span className="text-[10px] font-anton tracking-wider uppercase text-[#8a8ca5]">
                  EDIÇÕES LIDAS
                </span>
              </div>
            </div>

            <div className="bg-[#12121f] rounded-[4px] p-3 border border-[#8a8ca5]/15 flex items-center gap-3">
              <div className="w-9 h-9 rounded-[3px] bg-[#ffc531]/20 border border-[#ffc531]/40 flex items-center justify-center text-[#ffc531]">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span className="font-anton text-xl text-[#f4ebd8] block leading-none">
                  {userProfile.completedSagasCount}
                </span>
                <span className="text-[10px] font-anton tracking-wider uppercase text-[#8a8ca5]">
                  SAGAS FECHADAS
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Segmented Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar mb-4">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'all'
              ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
              : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
          }`}
        >
          TODAS AS HQS
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-bold">
            {comics.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('continuing')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'continuing'
              ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
              : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
          }`}
        >
          CONTINUANDO
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-bold">
            {inProgress.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'completed'
              ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
              : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
          }`}
        >
          LIDAS / CONCLUÍDAS
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-bold">
            {completed.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'favorites'
              ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
              : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
          }`}
        >
          FAVORITOS &amp; LISTA
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-bold">
            {favorites.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sagas')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'sagas'
              ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
              : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
          }`}
        >
          SAGAS
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-bold">
            {sagas.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer transition-all ${
            activeTab === 'activity'
              ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
              : 'bg-[#1a1a2e] text-[#f4ebd8] hover:bg-[#22223b] border border-[#8a8ca5]/20'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#ffc531]" />
          HISTÓRICO
        </button>

        {onOpenLocalFileModal && (
          <button
            onClick={onOpenLocalFileModal}
            className="flex items-center gap-1 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase whitespace-nowrap cursor-pointer bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] border border-[#ffc531] ml-auto transition-all"
          >
            + ABRIR HQ LOCAL
          </button>
        )}
      </div>

      {/* 3. Search Bar */}
      {activeTab !== 'activity' && (
        <div className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-2.5 mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#8a8ca5] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar no acervo por título, saga ou roteirista..."
            className="bg-transparent text-xs text-[#f4ebd8] placeholder-[#8a8ca5] outline-none flex-1"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-[#8a8ca5] hover:text-[#f4ebd8]">
              ✕
            </button>
          )}
        </div>
      )}

      {/* 4. Content Area */}
      {activeTab === 'activity' ? (
        <div className="flex flex-col gap-4 mb-8">
          {/* Reader Stats Overview */}
          {(() => {
            const stats = getReaderStatistics();
            const db = getDatabaseState();
            return (
              <>
                <div className="bg-[#12121f] rounded-[6px] border border-[#8a8ca5]/20 p-4 shadow-xl">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#8a8ca5]/15">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#ffc531]" />
                      <h3 className="font-anton text-sm tracking-wider uppercase text-[#f4ebd8]">
                        SEU HISTÓRICO DE LEITURA
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <div className="bg-[#1a1a2e] p-2.5 rounded-[4px] border border-[#8a8ca5]/15 text-center">
                      <span className="text-lg font-anton text-[#ffc531] block">{stats.totalComicsRead}</span>
                      <span className="text-[10px] text-[#8a8ca5] uppercase font-semibold">HQs Concluídas</span>
                    </div>
                    <div className="bg-[#1a1a2e] p-2.5 rounded-[4px] border border-[#8a8ca5]/15 text-center">
                      <span className="text-lg font-anton text-[#f4ebd8] block">{stats.totalPagesRead}</span>
                      <span className="text-[10px] text-[#8a8ca5] uppercase font-semibold">Páginas Lidas</span>
                    </div>
                    <div className="bg-[#1a1a2e] p-2.5 rounded-[4px] border border-[#8a8ca5]/15 text-center">
                      <span className="text-lg font-anton text-[#16e1ff] block">{stats.totalAiSynopses}</span>
                      <span className="text-[10px] text-[#8a8ca5] uppercase font-semibold">Sinopses com IA</span>
                    </div>
                    <div className="bg-[#1a1a2e] p-2.5 rounded-[4px] border border-[#8a8ca5]/15 text-center">
                      <span className="text-lg font-anton text-[#ffc531] block">{stats.totalFavorites}</span>
                      <span className="text-[10px] text-[#8a8ca5] uppercase font-semibold">Favoritos</span>
                    </div>
                    <div className="bg-[#1a1a2e] p-2.5 rounded-[4px] border border-[#8a8ca5]/15 text-center">
                      <span className="text-lg font-anton text-[#f4ebd8] block">{stats.totalReviews}</span>
                      <span className="text-[10px] text-[#8a8ca5] uppercase font-semibold">Avaliações</span>
                    </div>
                  </div>
                </div>

                {/* Chronological Timeline */}
                <div className="bg-[#1a1a2e] rounded-[6px] border border-[#8a8ca5]/20 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#8a8ca5]/15">
                    <Clock className="w-4 h-4 text-[#ffc531]" />
                    <h3 className="font-anton text-sm tracking-wider uppercase text-[#f4ebd8]">
                      LINHA DO TEMPO DE ATIVIDADES
                    </h3>
                  </div>

                  {db.activities.length === 0 ? (
                    <div className="py-8 text-center text-xs text-[#8a8ca5]">
                      Nenhuma atividade registrada ainda. Comece a ler uma HQ para ver seu histórico!
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {db.activities.map((act, idx) => {
                        const targetComic = act.comicId ? comics.find((c) => c.id === act.comicId) : null;
                        return (
                          <div
                            key={`act-${act.id || idx}-${idx}`}
                            className="bg-[#12121f] p-3 rounded-[4px] border border-[#8a8ca5]/15 flex items-start justify-between gap-3 hover:border-[#ffc531]/40 transition-colors"
                          >
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className="p-1.5 rounded-[4px] bg-[#1a1a2e] text-[#ffc531] mt-0.5 flex-shrink-0">
                                {act.type === 'read_complete' ? (
                                  <Trophy className="w-4 h-4 text-[#ffc531]" />
                                ) : act.type === 'favorite_added' ? (
                                  <Star className="w-4 h-4 text-[#ffc531]" />
                                ) : act.type === 'bookmark_added' ? (
                                  <Bookmark className="w-4 h-4 text-[#16e1ff]" />
                                ) : act.type === 'ai_synopsis_generated' ? (
                                  <Sparkles className="w-4 h-4 text-[#ffc531]" />
                                ) : act.type === 'review_added' ? (
                                  <Star className="w-4 h-4 text-[#ffc531]" />
                                ) : (
                                  <BookOpen className="w-4 h-4 text-[#f4ebd8]" />
                                )}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-anton text-xs tracking-wider uppercase text-[#f4ebd8] truncate">
                                    {act.title}
                                  </h4>
                                  <span className="text-[10px] text-[#8a8ca5]">
                                    {new Date(act.timestamp).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <p className="text-xs text-[#8a8ca5] mt-0.5 line-clamp-2">
                                  {act.description}
                                </p>
                              </div>
                            </div>

                            {targetComic && (
                              <button
                                onClick={() => onSelectComic(targetComic)}
                                className="px-2.5 py-1 text-[11px] font-anton tracking-wider uppercase bg-[#1a1a2e] hover:bg-[#ffc531] text-[#f4ebd8] hover:text-[#12121f] border border-[#8a8ca5]/30 rounded-[3px] transition-colors cursor-pointer flex-shrink-0"
                              >
                                Ver HQ
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      ) : activeTab === 'sagas' ? (
        sagas.length === 0 ? (
          <div className="bg-[#1a1a2e] border border-[#8a8ca5]/20 rounded-[4px] p-8 text-center my-4">
            <Trophy className="w-10 h-10 text-[#8a8ca5] mx-auto mb-3 opacity-60" />
            <h3 className="font-anton text-base uppercase text-[#f4ebd8] mb-1">
              Nenhuma saga catalogada ainda
            </h3>
            <p className="text-xs text-[#8a8ca5] max-w-sm mx-auto">
              As sagas e arcos serão organizados automaticamente à medida que os títulos forem carregados.
            </p>
          </div>
        ) : (
          <div className="mb-6 flex flex-col gap-3">
            {sagas.map((saga, idx) => (
              <div
                key={`shelf-saga-${saga.id || 'sg'}-${idx}`}
                onClick={() => onSelectSaga(saga)}
                className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-3.5 flex items-center justify-between cursor-pointer hover:border-[#ffc531] transition-all group"
              >
                <div className="flex-1 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-anton uppercase px-1.5 py-0.5 rounded-[2px] ${
                      saga.isComplete ? 'bg-[#ffc531] text-[#12121f]' : 'bg-[#d62839] text-[#f4ebd8]'
                    }`}>
                      {saga.badgeText || (saga.isComplete ? 'ARCO COMPLETO' : 'EM PROGRESSO')}
                    </span>
                    <span className="text-xs text-[#8a8ca5] font-semibold">{saga.years}</span>
                  </div>
                  <h3 className="font-anton text-base tracking-wide uppercase text-[#f4ebd8] group-hover:text-[#ffc531] transition-colors">
                    {saga.title}
                  </h3>
                  <p className="text-xs text-[#8a8ca5] line-clamp-1">{saga.subtitle}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#8a8ca5] group-hover:text-[#ffc531] group-hover:translate-x-1 transition-all" />
              </div>
            ))}
          </div>
        )
      ) : filteredIssues.length === 0 ? (
        <div className="bg-[#1a1a2e] border border-[#8a8ca5]/20 rounded-[6px] p-8 text-center my-4 shadow-xl">
          <BookOpen className="w-12 h-12 text-[#ffc531] mx-auto mb-3 opacity-80" />
          <h3 className="font-anton text-lg uppercase text-[#f4ebd8] mb-1">
            {comics.length === 0 ? 'SUA ESTANTE ESTÁ VAZIA' : 'NENHUMA HQ ENCONTRADA'}
          </h3>
          <p className="text-xs text-[#8a8ca5] max-w-md mx-auto leading-relaxed">
            {comics.length === 0
              ? 'Seus quadrinhos carregados aparecerão nesta estante automaticamente.'
              : 'Nenhum quadrinho corresponde aos filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredIssues.map((comic, idx) => (
            <div
              key={`shelf-comic-${comic.id}-${idx}`}
              onClick={() => onSelectComic(comic)}
              className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-3 flex gap-3 cursor-pointer group hover:border-[#ffc531] transition-all relative overflow-hidden"
            >
              <div className="relative w-20 min-w-[80px] aspect-[2/3] rounded-[3px] overflow-hidden bg-[#12121f] border border-[#8a8ca5]/20 flex-shrink-0">
                <img
                  src={`/covers/${comic.id}.jpg`}
                  alt={comic.title}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.src.includes('/covers/')) {
                      el.src = comic.coverUrl || `/api/acervo/cover/${comic.id}`;
                    } else if (!el.dataset.failed) {
                      el.dataset.failed = 'true';
                      el.src = `/api/acervo/cover-art/${comic.id}`;
                    }
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </div>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px] font-anton uppercase px-1.5 py-0.5 rounded-[2px] bg-[#ffc531] text-[#12121f] font-bold">
                      {comic.publisher}
                    </span>
                    <span className="text-[10px] text-[#8a8ca5] font-semibold">{comic.year}</span>
                  </div>
                  <h3 className="font-anton text-base tracking-wide uppercase text-[#f4ebd8] group-hover:text-[#ffc531] transition-colors truncate">
                    {comic.title}
                  </h3>
                  <p className="text-xs text-[#8a8ca5] line-clamp-1 mt-0.5">
                    {comic.synopsis}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-[#8a8ca5]/10">
                  <span className="text-[10px] text-[#8a8ca5]">
                    {comic.totalPages} páginas
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenReader(comic, comic.currentPage || 1);
                    }}
                    className="px-3 py-1 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-[11px] tracking-wider uppercase rounded-[2px] border border-[#ffc531] cursor-pointer"
                  >
                    Ler Agora
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
