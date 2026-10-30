import React, { useState, useEffect } from 'react';
import { ComicIssue, Saga } from '../types/comic';
import {
  ShieldCheck,
  Share2,
  Bookmark,
  BookOpen,
  CheckCircle,
  PlayCircle,
  ArrowRight,
  Lock,
  Flame,
  Check,
  CheckCheck,
  Sparkles,
  Star,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import { ClientComicCover } from './ClientComicCover';
import {
  requestAiSynopsis,
  getCachedAiSynopsis,
  saveRatingAndReview,
  getDatabaseState,
  AiSynopsisData,
} from '../services/databaseService';

interface IssueDetailsScreenProps {
  comic: ComicIssue;
  allComics?: ComicIssue[];
  allSagas?: Saga[];
  saga?: Saga;
  relatedComics: ComicIssue[];
  onOpenReader: (comic: ComicIssue, pageNumber?: number) => void;
  onSelectComic: (comic: ComicIssue) => void;
  onToggleBookmark: (comicId: string) => void;
  onToggleCollection: (comicId: string) => void;
  onToggleOffline: (comicId: string) => void;
}

export const IssueDetailsScreen: React.FC<IssueDetailsScreenProps> = ({
  comic,
  allComics = [],
  allSagas = [],
  saga,
  relatedComics,
  onOpenReader,
  onSelectComic,
  onToggleBookmark,
  onToggleCollection,
  onToggleOffline,
}) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<boolean>(false);
  const [showAllSagaIssues, setShowAllSagaIssues] = useState<boolean>(false);

  useEffect(() => {
    setCoverError(false);
    setShowAllSagaIssues(false);
  }, [comic.id]);

  // Persistent AI Synopsis State
  const [aiData, setAiData] = useState<AiSynopsisData | null>(() => getCachedAiSynopsis(comic.id));
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);

  // Persistent User Review & Rating State (Auto-saved)
  const [userRating, setUserRating] = useState<number>(() => {
    return getDatabaseState().reviews[comic.id]?.rating || 0;
  });
  const [reviewNote, setReviewNote] = useState<string>(() => {
    return getDatabaseState().reviews[comic.id]?.reviewText || '';
  });

  useEffect(() => {
    let isCancelled = false;
    const cached = comic.aiSynopsis || getCachedAiSynopsis(comic.id);

    if (cached) {
      setAiData(cached);
      if (comic.synopsis !== cached.synopsis) {
        comic.synopsis = cached.synopsis;
      }
    } else {
      // Auto-activate AI synopsis for all comics!
      setAiLoading(true);
      requestAiSynopsis(comic, false)
        .then((data) => {
          if (!isCancelled && data) {
            setAiData(data);
            comic.synopsis = data.synopsis;
            comic.aiSynopsis = data;
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!isCancelled) setAiLoading(false);
        });
    }

    const db = getDatabaseState();
    if (db.reviews[comic.id]) {
      setUserRating(db.reviews[comic.id].rating);
      setReviewNote(db.reviews[comic.id].reviewText);
    }

    return () => {
      isCancelled = true;
    };
  }, [comic.id]);

  const handleGenerateAiSynopsis = async (force: boolean = false) => {
    setAiLoading(true);
    showToast('Consultando IA Gemini para regenerar curadoria...');
    try {
      const res = await requestAiSynopsis(comic, force);
      if (res) {
        setAiData(res);
        comic.synopsis = res.synopsis;
        comic.aiSynopsis = res;
        showToast('Sinopse de IA atualizada com sucesso!');
      }
    } catch {
      showToast('Falha ao processar sinopse com IA.');
    } finally {
      setAiLoading(false);
    }
  };

  // Automatic saving on rating change
  const handleRatingChange = (star: number) => {
    setUserRating(star);
    saveRatingAndReview(comic.id, star, reviewNote, comic.title);
  };

  // Automatic saving on note input change
  const handleNoteChange = (text: string) => {
    setReviewNote(text);
    saveRatingAndReview(comic.id, userRating, text, comic.title);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: comic.title,
        text: `Confira ${comic.title} na Banca Geek Collector Edition!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Link da edição copiado para a área de transferência!');
    }
  };

  // Resolve matching saga from allSagas or saga prop
  const matchedSaga = React.useMemo(() => {
    if (saga && saga.issues && saga.issues.length > 0) return saga;
    const pool = allSagas || [];
    return (
      pool.find((s) =>
        (comic.sagaTitle && s.title.toLowerCase() === comic.sagaTitle.toLowerCase()) ||
        (comic.sagaTitle && s.title.toLowerCase().includes(comic.sagaTitle.toLowerCase())) ||
        (comic.sagaTitle && comic.sagaTitle.toLowerCase().includes(s.title.toLowerCase())) ||
        (comic.folderPath && s.title.toLowerCase().includes(comic.folderPath.toLowerCase())) ||
        comic.title.toLowerCase().includes(s.title.toLowerCase())
      ) || null
    );
  }, [saga, allSagas, comic]);

  // Dynamically resolve real chronological saga order
  const chronologicalIssues = React.useMemo(() => {
    const pool = (allComics && allComics.length > 0 ? allComics : relatedComics) || [];

    // 1. Collect all comics in the same sagaTitle or folderPath
    let seq: ComicIssue[] = [];
    const curSaga = comic.sagaTitle?.trim().toLowerCase();
    if (curSaga) {
      seq = pool.filter(
        (c) => c.sagaTitle && c.sagaTitle.trim().toLowerCase() === curSaga
      );
    }

    const curFolder = comic.folderPath?.trim().toLowerCase();
    if (seq.length <= 1 && curFolder) {
      seq = pool.filter(
        (c) => c.folderPath && c.folderPath.trim().toLowerCase() === curFolder
      );
    }

    // 2. If no direct match in pool by sagaTitle/folderPath, check matchedSaga issues
    if (seq.length <= 1 && matchedSaga && matchedSaga.issues && matchedSaga.issues.length > 0) {
      const mapped: ComicIssue[] = [];
      for (const sIss of matchedSaga.issues) {
        const found = pool.find((c) =>
          (c.sagaTitle && c.sagaTitle.toLowerCase().includes(matchedSaga.title.toLowerCase()) && c.issueNumber === sIss.number) ||
          c.issueNumber === sIss.number ||
          c.title.toLowerCase().includes(sIss.title.toLowerCase())
        );
        if (found && !mapped.some((m) => m.id === found.id)) {
          mapped.push(found);
        }
      }
      if (mapped.length > 0) {
        seq = mapped;
      }
    }

    // Always ensure current comic is in the sequence
    if (!seq.some((c) => c.id === comic.id)) {
      seq.push(comic);
    }

    // Sort in real, certified chronological order:
    // 1. By issueNumber (ascending: 1, 2, 3...)
    // 2. If same or 0, by year
    // 3. If same, natural alphanumeric comparison of title / rawFileName
    seq.sort((a, b) => {
      const numA = typeof a.issueNumber === 'number' && !isNaN(a.issueNumber) ? a.issueNumber : 0;
      const numB = typeof b.issueNumber === 'number' && !isNaN(b.issueNumber) ? b.issueNumber : 0;
      if (numA !== numB && numA > 0 && numB > 0) return numA - numB;
      if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
      return (a.rawFileName || a.title).localeCompare(b.rawFileName || b.title, 'pt-BR', {
        numeric: true,
        sensitivity: 'base',
      });
    });

    return seq;
  }, [comic, allComics, relatedComics, matchedSaga]);

  const currentIndex = chronologicalIssues.findIndex((c) => c.id === comic.id);
  const totalInSeq = chronologicalIssues.length;

  const displayedIssues = React.useMemo(() => {
    if (showAllSagaIssues || totalInSeq <= 6) {
      return chronologicalIssues;
    }
    const start = Math.max(0, Math.min(currentIndex - 1, totalInSeq - 6));
    return chronologicalIssues.slice(start, start + 6);
  }, [chronologicalIssues, showAllSagaIssues, totalInSeq, currentIndex]);

  return (
    <div className="pb-28 pt-2 max-w-3xl mx-auto px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e] border border-[#ffc531] text-[#f4ebd8] px-4 py-2 rounded-[4px] shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-[#ffc531]" />
          {toastMessage}
        </div>
      )}

      {/* Top Banner: EDIÇÃO CANÔNICA PRESERVADA & Quick Actions */}
      <div className="flex items-center justify-between py-2 border-b border-[#8a8ca5]/15 mb-4">
        <div className="flex items-center gap-1.5 text-[#ffc531] text-xs font-anton tracking-wider uppercase">
          <ShieldCheck className="w-4 h-4" />
          EDIÇÃO CANÔNICA PRESERVADA
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            aria-label="Compartilhar edição"
            className="p-1.5 text-[#8a8ca5] hover:text-[#f4ebd8] hover:bg-[#1a1a2e] rounded-full transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              onToggleBookmark(comic.id);
              showToast(comic.isBookmarked ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
            }}
            aria-label="Salvar nos favoritos"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              comic.isBookmarked ? 'text-[#ffc531] bg-[#1a1a2e]' : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${comic.isBookmarked ? 'fill-[#ffc531]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Central Cover Showcase */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative w-56 sm:w-64 aspect-[2/3] rounded-[4px] overflow-hidden border-2 border-[#8a8ca5]/30 shadow-2xl bg-[#1a1a2e]">
          {!coverError ? (
            <img
              src={`/covers/${comic.id}.jpg`}
              alt={comic.title}
              onError={(e) => {
                const target = e.currentTarget;
                if (target.src.includes('/covers/')) {
                  target.src = comic.coverUrl || `/api/acervo/cover/${comic.id}`;
                } else {
                  setCoverError(true);
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <ClientComicCover comic={comic} />
          )}

          {/* Rarity Tag at top-left */}
          <div className="absolute top-2 left-2 z-10">
            <span className="px-2 py-0.5 bg-[#ffc531] text-[#12121f] text-xs font-anton tracking-wider uppercase rounded-[2px] font-bold shadow-md">
              {comic.badge && !/cbr|cbz|rar|pdf|arquivo/i.test(comic.badge) ? comic.badge : 'EDIÇÃO COMPLETA'}
            </span>
          </div>

          {/* Paper sheen subtle effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
        </div>

        {/* Subtitle / Saga marker */}
        <span className="text-[#ffc531] font-anton text-xs sm:text-sm tracking-widest uppercase mt-4 mb-1">
          {comic.sagaTitle || 'SAGA BATMAN'} • {comic.sagaPart || 'PARTE 1: ONZE HORAS'}
        </span>

        {/* Big Issue Headline */}
        <h1 className="font-anton text-2xl sm:text-3xl md:text-4xl tracking-wide uppercase text-[#f4ebd8] text-center mb-3">
          {comic.title}
        </h1>

        {/* Metadata Chips Row */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-[#8a8ca5] mb-2 font-medium">
          <span className="px-2.5 py-1 bg-[#1a1a2e] rounded-[3px] border border-[#8a8ca5]/20 text-[#f4ebd8]">
            {comic.publisher}
          </span>
          <span className="px-2.5 py-1 bg-[#1a1a2e] rounded-[3px] border border-[#8a8ca5]/20 text-[#f4ebd8]">
            Ano {comic.year}
          </span>
          <span className="px-2.5 py-1 bg-[#1a1a2e] rounded-[3px] border border-[#8a8ca5]/20 text-[#f4ebd8]">
            {comic.totalPages} Páginas
          </span>
          <span className="px-2.5 py-1 bg-[#1a1a2e] rounded-[3px] border border-[#8a8ca5]/20 text-[#f4ebd8]">
            Edição {comic.issueNumber} de {comic.totalIssuesInSaga || 12} (Arco Principal)
          </span>
          <span className="px-2.5 py-1 bg-[#1a1a2e] rounded-[3px] border border-[#8a8ca5]/20 text-[#f4ebd8]">
            {comic.ageRating}
          </span>
        </div>

      </div>

      {/* Reading Progress Card */}
      <div className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#f4ebd8]">
            <BookOpen className="w-4 h-4 text-[#ffc531]" />
            <span>Progresso de Leitura</span>
          </div>
          <span className="text-xs font-semibold text-[#ffc531]">
            {comic.readProgressPercent >= 100
              ? '🏆 100% LIDO (CONCLUÍDO)'
              : `${comic.readProgressPercent}% concluído`}
          </span>
        </div>

        <p className="text-xs text-[#8a8ca5] mb-2">
          {comic.readProgressPercent >= 100 ? (
            <span className="text-[#10b981] font-semibold">Parabéns! Você completou todas as {comic.totalPages} páginas desta edição.</span>
          ) : (
            <>Você parou na <strong className="text-[#f4ebd8]">Página {comic.currentPage || 1}</strong> de {comic.totalPages}</>
          )}
        </p>

        {/* Progress bar */}
        <div className="h-2 w-full bg-[#12121f] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              comic.readProgressPercent >= 100 ? 'bg-[#10b981]' : 'bg-[#d62839]'
            }`}
            style={{ width: `${Math.min(100, Math.max(comic.readProgressPercent, 3))}%` }}
          />
        </div>
      </div>

      {/* Main Red Primary CTA Button */}
      <button
        onClick={() => onOpenReader(comic, comic.currentPage || 1)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-base tracking-widest uppercase rounded-[4px] shadow-xl border border-[#ffc531] transition-all cursor-pointer active:scale-98 mb-2"
      >
        <BookOpen className="w-5 h-5 fill-current" />
        {comic.readProgressPercent >= 100
          ? `RELER HQ (PÁG. 1 DE ${comic.totalPages})`
          : `LER HQ AGORA (PÁG. ${comic.currentPage || 1} DE ${comic.totalPages})`}
      </button>

      {comic.driveFileId && (
        <a
          href={comic.drivePreviewUrl ? comic.drivePreviewUrl.replace('/preview', '/view') : `https://drive.google.com/file/d/${comic.driveFileId}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 py-2 bg-[#1a1a2e] hover:bg-[#22223b] text-[#ffc531] border border-[#ffc531]/40 hover:border-[#ffc531] rounded-[4px] text-xs font-anton tracking-wider uppercase transition-all mb-3 cursor-pointer shadow-xs"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>ABRIR ARQUIVO DIRETO NO GOOGLE DRIVE</span>
        </a>
      )}

      {/* Secondary Actions: Favoritos & Na Coleção (Zero downloads, auto-salvo) */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <button
          onClick={() => {
            onToggleBookmark(comic.id);
            showToast(comic.isBookmarked ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
          }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-[4px] text-xs font-semibold border transition-all cursor-pointer ${
            comic.isBookmarked
              ? 'bg-[#1a1a2e] border-[#ffc531] text-[#ffc531]'
              : 'bg-[#1a1a2e] hover:bg-[#22223b] border-[#8a8ca5]/30 text-[#f4ebd8]'
          }`}
        >
          <Star className={`w-4 h-4 ${comic.isBookmarked ? 'fill-[#ffc531] text-[#ffc531]' : 'text-[#8a8ca5]'}`} />
          {comic.isBookmarked ? 'Nos Favoritos' : 'Favoritar HQ'}
        </button>

        <button
          onClick={() => {
            onToggleCollection(comic.id);
            showToast(comic.isInCollection ? 'Removido da estante' : 'Adicionado à sua estante');
          }}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-[4px] text-xs font-semibold border transition-all cursor-pointer ${
            comic.isInCollection
              ? 'bg-[#1a1a2e] border-[#ffc531] text-[#ffc531]'
              : 'bg-[#1a1a2e] hover:bg-[#22223b] border-[#8a8ca5]/30 text-[#f4ebd8]'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${comic.isInCollection ? 'fill-[#ffc531] text-[#ffc531]' : 'text-[#8a8ca5]'}`} />
          {comic.isInCollection ? 'Na Coleção' : 'Adicionar à Coleção'}
        </button>
      </div>

      {/* Clean Edition Metadata Card */}
      <div className="bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/15 p-3 mb-6 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[#8a8ca5] min-w-0">
          <BookOpen className="w-4 h-4 text-[#ffc531] flex-shrink-0" />
          <span className="text-[#f4ebd8] font-semibold truncate">
            {comic.title}
          </span>
        </div>
        <span className="text-[#8a8ca5] text-[11px] font-semibold flex-shrink-0">
          {comic.totalPages} páginas • {comic.publisher}
        </span>
      </div>

      {/* Sinopse da Edição & Curadoria com Inteligência Artificial */}
      <div className="mb-6 bg-[#1a1a2e]/80 rounded-[6px] p-4 border border-[#8a8ca5]/20 shadow-xl relative overflow-hidden">
        {/* Top Header with AI Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-[#8a8ca5]/15">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
            <h2 className="font-anton text-base tracking-wider uppercase text-[#f4ebd8]">
              SINOPSE & CURADORIA DA EDIÇÃO
            </h2>
            {aiData && (
              <span className="px-2 py-0.5 bg-[#ffc531]/15 border border-[#ffc531]/40 text-[#ffc531] rounded-full text-[10px] font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#ffc531]" />
                IA GERADA
              </span>
            )}
          </div>

          <button
            onClick={() => handleGenerateAiSynopsis(Boolean(aiData))}
            disabled={aiLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase border transition-all cursor-pointer shadow-md ${
              aiLoading
                ? 'bg-[#12121f] text-[#8a8ca5] border-[#8a8ca5]/30 opacity-75'
                : 'bg-gradient-to-r from-[#d62839] to-[#b20024] hover:from-[#e63946] hover:to-[#c1121f] text-[#f4ebd8] border-[#ffc531]/50 hover:shadow-lg hover:shadow-[#d62839]/20'
            }`}
          >
            {aiLoading ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-[#ffc531] border-t-transparent rounded-full" />
                <span>GERANDO COM IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#ffc531]" />
                <span>{aiData ? 'REGENERAR COM IA' : 'GERAR SINOPSE COM IA'}</span>
              </>
            )}
          </button>
        </div>

        {/* AI Dramatic Logline if present */}
        {aiData?.logline && (
          <div className="mb-3 p-2.5 rounded-[4px] bg-[#12121f] border-l-3 border-[#ffc531] text-xs text-[#f4ebd8] italic font-serif">
            "{aiData.logline}"
          </div>
        )}

        {/* Main Synopsis Content */}
        <p className="text-sm text-[#f4ebd8]/90 leading-relaxed mb-4 whitespace-pre-line">
          {aiData?.synopsis || comic.synopsis}
        </p>

        {/* Expandable AI Deep Insights */}
        {aiData && (
          <div className="mb-4">
            <button
              onClick={() => setShowAiDetails(!showAiDetails)}
              className="flex items-center justify-between w-full py-2 px-3 bg-[#12121f]/70 rounded-[4px] text-xs text-[#8a8ca5] hover:text-[#f4ebd8] border border-[#8a8ca5]/15 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-[#ffc531]" />
                {showAiDetails ? 'Ocultar Análise & Curiosidades da IA' : 'Ver Personagens & Análise Histórica da IA'}
              </span>
              {showAiDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAiDetails && (
              <div className="mt-2 p-3 bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/20 text-xs flex flex-col gap-3 animate-fade-in">
                {/* Tone and Atmosphere */}
                {aiData.tone && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffc531] block mb-1">
                      TOM DA HISTÓRIA
                    </span>
                    <span className="inline-block px-2.5 py-1 bg-[#1a1a2e] border border-[#8a8ca5]/30 rounded-[3px] text-[#f4ebd8] font-medium">
                      🎭 {aiData.tone}
                    </span>
                  </div>
                )}

                {/* Main Characters */}
                {aiData.mainCharacters && aiData.mainCharacters.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffc531] block mb-1">
                      PERSONAGENS EM DESTAQUE
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiData.mainCharacters.map((char, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-[#1a1a2e] text-[#f4ebd8] rounded-[2px] border border-[#8a8ca5]/20 text-[11px]"
                        >
                          {char}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historical Context & Curiosities */}
                {aiData.historicalContext && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffc531] block mb-1">
                      CONTEXTO HISTÓRICO & CURIOSIDADES
                    </span>
                    <p className="text-[#8a8ca5] leading-relaxed">
                      {aiData.historicalContext}
                    </p>
                  </div>
                )}

                {/* Recommended for */}
                {aiData.recommendedFor && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#ffc531] block mb-1">
                      RECOMENDADO PARA
                    </span>
                    <p className="text-[#8a8ca5] leading-relaxed">
                      {aiData.recommendedFor}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Creator credits */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#8a8ca5]/15 text-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#8a8ca5] font-semibold block">
              ROTEIRO
            </span>
            <span className="text-[#f4ebd8] font-bold">{comic.scriptWriter}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#8a8ca5] font-semibold block">
              ARTE
            </span>
            <span className="text-[#f4ebd8] font-bold">{comic.artArtist}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#8a8ca5] font-semibold block">
              CORES
            </span>
            <span className="text-[#f4ebd8] font-bold">{comic.colorsArtist || 'Equipe Editorial'}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#8a8ca5] font-semibold block">
              EDITORA ORIGINAL
            </span>
            <span className="text-[#f4ebd8] font-bold">{comic.originalEditor || comic.publisher}</span>
          </div>
        </div>
      </div>

      {/* Avaliação Pessoal e Anotações (Salvo Automaticamente) */}
      <div className="mb-6 bg-[#12121f] rounded-[6px] p-4 border border-[#8a8ca5]/20 shadow-lg">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#8a8ca5]/15">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#ffc531]" />
            <h3 className="font-anton text-sm tracking-wider uppercase text-[#f4ebd8]">
              SUA AVALIAÇÃO &amp; ANOTAÇÕES
            </h3>
          </div>
        </div>

        {/* 5-Star Rating Widget */}
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs text-[#8a8ca5] font-semibold">Sua Nota:</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingChange(star)}
                className="p-1 hover:scale-125 transition-transform cursor-pointer"
                aria-label={`Avaliar com ${star} estrelas`}
              >
                <Star
                  className={`w-5 h-5 ${
                    star <= userRating
                      ? 'fill-[#ffc531] text-[#ffc531]'
                      : 'text-[#8a8ca5]/40 hover:text-[#ffc531]'
                  }`}
                />
              </button>
            ))}
          </div>
          <span className="text-xs text-[#ffc531] font-bold">
            {userRating > 0 ? `${userRating} / 5 Estrelas` : 'Toque nas estrelas para avaliar'}
          </span>
        </div>

        {/* Review / Reader Note Input (Auto-salvo) */}
        <div>
          <label className="text-[11px] text-[#8a8ca5] font-semibold mb-1 block">
            Anotações &amp; Comentários Pessoais:
          </label>
          <textarea
            value={reviewNote}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Escreva suas impressões sobre esta edição..."
            rows={2}
            className="w-full bg-[#1a1a2e] border border-[#8a8ca5]/30 rounded-[4px] p-2.5 text-xs text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:outline-none focus:border-[#ffc531] transition-colors resize-none"
          />
        </div>
      </div>

      {/* Ordem Cronológica da Saga */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
            <h2 className="font-anton text-base tracking-wider uppercase text-[#f4ebd8]">
              ORDEM CRONOLÓGICA DA SAGA
            </h2>
          </div>
          <span className="text-xs text-[#ffc531] font-semibold">
            {comic.sagaTitle || matchedSaga?.title || 'Trilha Oficial'} • {totalInSeq} {totalInSeq === 1 ? 'Edição' : 'Edições'}
          </span>
        </div>

        {/* Chronological issues list */}
        <div className="flex flex-col gap-2">
          {displayedIssues.map((item) => {
            const itemIndex = chronologicalIssues.findIndex((c) => c.id === item.id);
            const isCurrent = item.id === comic.id;
            const isNext = itemIndex === currentIndex + 1;
            const isRead = item.readProgressPercent >= 90;
            const inProgress = item.readProgressPercent > 0 && item.readProgressPercent < 90;
            const displayNum = item.issueNumber
              ? String(item.issueNumber).padStart(2, '0')
              : String(itemIndex + 1).padStart(2, '0');

            return (
              <div
                key={`chrono-${item.id}-${itemIndex}`}
                onClick={() => {
                  if (isCurrent) {
                    onOpenReader(comic, comic.currentPage || 1);
                  } else {
                    onSelectComic(item);
                  }
                }}
                className={`flex items-center justify-between p-3 rounded-[4px] cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-[#1a1a2e] border-2 border-[#ffc531] shadow-md hover:bg-[#22223b]'
                    : isNext
                    ? 'bg-[#1a1a2e] border border-[#ffc531]/50 hover:border-[#ffc531] hover:bg-[#22223b]'
                    : 'bg-[#1a1a2e]/70 border border-[#8a8ca5]/20 hover:border-[#8a8ca5]/60 hover:bg-[#22223b]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <span
                    className={`font-anton text-base px-2 py-0.5 rounded-[2px] shrink-0 font-bold ${
                      isCurrent
                        ? 'text-[#12121f] bg-[#ffc531]'
                        : isNext
                        ? 'text-[#ffc531] bg-[#ffc531]/20 border border-[#ffc531]/40'
                        : 'text-[#8a8ca5] bg-[#12121f]'
                    }`}
                  >
                    {displayNum}
                  </span>
                  <div className="min-w-0">
                    <h4
                      className={`font-bold text-sm truncate ${
                        isCurrent
                          ? 'text-[#f4ebd8]'
                          : isNext
                          ? 'text-[#f4ebd8]'
                          : 'text-[#d6d7e3] hover:text-[#f4ebd8]'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs">
                      {isCurrent ? (
                        <div className="flex items-center gap-1.5 text-[#ffc531] font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ffc531] animate-pulse" />
                          Edição Atual (Lendo)
                        </div>
                      ) : isNext ? (
                        <span className="text-[#ffc531] font-semibold">
                          Próxima Edição na Sequência
                        </span>
                      ) : isRead ? (
                        <span className="text-[#10b981] font-semibold flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5" />
                          Leitura Concluída
                        </span>
                      ) : inProgress ? (
                        <span className="text-[#ffc531]">
                          {item.readProgressPercent}% lido • pág. {item.currentPage}
                        </span>
                      ) : (
                        <span className="text-[#8a8ca5]/80">
                          {item.totalPages || 36} Páginas • {item.year || 'Edição Canônica'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isCurrent ? (
                    <PlayCircle className="w-5 h-5 text-[#ffc531]" />
                  ) : isNext ? (
                    <ArrowRight className="w-4 h-4 text-[#ffc531]" />
                  ) : (
                    <button
                      type="button"
                      title="Ler esta edição"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenReader(item, 1);
                      }}
                      className="p-1 rounded hover:bg-[#ffc531]/20 text-[#8a8ca5] hover:text-[#ffc531] transition-colors"
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Toggle to see all issues in long sagas */}
        {totalInSeq > 6 && (
          <button
            type="button"
            onClick={() => setShowAllSagaIssues(!showAllSagaIssues)}
            className="w-full mt-2.5 py-2 px-3 bg-[#1a1a2e] border border-[#ffc531]/30 hover:border-[#ffc531] rounded-[4px] text-xs font-anton tracking-wider text-[#ffc531] hover:text-[#f4ebd8] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {showAllSagaIssues ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                MOSTRAR MENOS EDIÇÕES
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                VER TODAS AS {totalInSeq} EDIÇÕES DA SAGA ({comic.sagaTitle || matchedSaga?.title || 'TRILHA'})
              </>
            )}
          </button>
        )}
      </div>

      {/* Edições Relacionadas e Recomendadas */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-[#d62839]" />
          <h2 className="font-anton text-base tracking-wider uppercase text-[#f4ebd8]">
            EDIÇÕES RELACIONADAS E RECOMENDADAS
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {relatedComics.slice(0, 3).map((rel, idx) => (
            <div
              key={`rel-${rel.id}-${idx}`}
              onClick={() => onSelectComic(rel)}
              className="group cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[2/3] rounded-[3px] overflow-hidden bg-[#1a1a2e] border border-[#8a8ca5]/20 group-hover:border-[#ffc531] transition-all">
                <img
                  src={`/covers/${rel.id}.jpg`}
                  alt={rel.title}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.includes('/covers/')) {
                      target.src = rel.coverUrl || `/api/acervo/cover/${rel.id}`;
                    }
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                {rel.badge && (
                  <div className="absolute top-1 left-1">
                    <span className="px-1.5 py-0.5 bg-[#ffc531] text-[#12121f] text-[9px] font-anton tracking-wider uppercase rounded-[2px] font-bold">
                      {rel.badge}
                    </span>
                  </div>
                )}
              </div>
              <h4 className="font-bold text-xs text-[#f4ebd8] mt-1.5 truncate group-hover:text-[#ffc531] transition-colors">
                {rel.title}
              </h4>
              <span className="text-[10px] text-[#8a8ca5] truncate">
                {rel.scriptWriter} • {rel.artArtist}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
