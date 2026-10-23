import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ComicIssue } from '../types/comic';
import {
  ArrowLeft,
  Bookmark,
  Sliders,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  BookOpen,
  Columns,
  Scroll,
  CloudCheck,
  Zap,
  Grid,
  Check,
  FileText,
  ExternalLink,
  Award,
  RefreshCw
} from 'lucide-react';
import { USER_PROFILE } from '../data/comics';
import { saveComicProgress, getComicProgress } from '../services/progressService';
import { getAccessToken } from '../services/authService';
import { ClientComicCover } from './ClientComicCover';

interface ActiveReaderScreenProps {
  comic: ComicIssue;
  initialPage?: number;
  onBack: () => void;
  onUpdateProgress: (comicId: string, pageNumber: number) => void;
  onToggleBookmark: (comicId: string) => void;
}

export type ViewMode = 'single' | 'double' | 'vertical';

export const ActiveReaderScreen: React.FC<ActiveReaderScreenProps> = ({
  comic,
  initialPage = 1,
  onBack,
  onUpdateProgress,
  onToggleBookmark,
}) => {
  // Initialize with saved progress or prop
  const savedRecord = getComicProgress(comic.id);
  const startPage = initialPage || savedRecord?.currentPage || comic.currentPage || 1;

  const [currentPage, setCurrentPage] = useState<number>(startPage);
  // Default to native internal reader canvas for all formats (.cbr, .cbz, .pdf, .epub, .cb7, .cbt)
  const [readerEngine, setReaderEngine] = useState<'canvas' | 'pdf'>('canvas');
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showThumbnailDrawer, setShowThumbnailDrawer] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [fitMode, setFitMode] = useState<'contain' | 'width' | 'height'>('contain');
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Settings
  const [brightness, setBrightness] = useState<number>(100);
  const [paperFilter, setPaperFilter] = useState<'normal' | 'sepia' | 'high-contrast'>('normal');
  const [showWatermarks, setShowWatermarks] = useState<boolean>(true);
  const [tokenParam, setTokenParam] = useState<string>('');
  const [pageError, setPageError] = useState<boolean>(false);

  useEffect(() => {
    getAccessToken()
      .then((t) => {
        if (t) setTokenParam(`?token=${encodeURIComponent(t)}`);
      })
      .catch(() => {});
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const readerStageRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.max(1, comic.totalPages || 36);
  const progressPercent = Math.min(100, Math.round((currentPage / totalPages) * 100));
  const isCompleted = currentPage >= totalPages;

  const rawFormat = (comic.format || (comic.isPdf ? 'pdf' : 'cbr')).toLowerCase();
  const formatLabel = rawFormat.toUpperCase();

  // Trigger toast message
  const triggerToast = useCallback((msg: string) => {
    setShowToast(msg);
    setTimeout(() => setShowToast(null), 2500);
  }, []);

  // Auto-hide controls in Fullscreen immersive mode after 3 seconds of inactivity
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isFullscreen) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      resetControlsTimeout();
    } else {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isFullscreen, resetControlsTimeout]);

  // Sync and save progress immediately whenever currentPage changes
  const prevPageRef = useRef<number>(currentPage);
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      saveComicProgress(comic.id, currentPage, totalPages, comic.title);
      onUpdateProgress(comic.id, currentPage);
    }
  }, [currentPage, comic.id, totalPages, comic.title, onUpdateProgress]);

  // Pre-load next and previous pages for instantaneous page flipping
  useEffect(() => {
    setImageLoaded(false);
    setPageError(false);
    if (currentPage < totalPages) {
      const nextImg = new Image();
      nextImg.src = `/api/acervo/page-media/${comic.id}/${currentPage + 1}${tokenParam}`;
    }
    if (currentPage > 1) {
      const prevImg = new Image();
      prevImg.src = `/api/acervo/page-media/${comic.id}/${currentPage - 1}${tokenParam}`;
    }
  }, [currentPage, totalPages, comic.id, tokenParam]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        setShowControls(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard navigation & Shortcuts (Arrows, Space, F for fullscreen, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          toggleFullscreen();
        } else if (showThumbnailDrawer) {
          setShowThumbnailDrawer(false);
        } else if (showSettingsModal) {
          setShowSettingsModal(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, isFullscreen, showThumbnailDrawer, showSettingsModal]);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const step = viewMode === 'double' ? 2 : 1;
      setCurrentPage((prev) => Math.min(prev + step, totalPages));
    } else {
      triggerToast('🎉 Você chegou à última página desta edição!');
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      const step = viewMode === 'double' ? 2 : 1;
      setCurrentPage((prev) => Math.max(prev - step, 1));
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPage = parseInt(e.target.value, 10);
    setCurrentPage(newPage);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    triggerToast('Visualização ajustada à tela');
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      setShowControls(false);
      resetControlsTimeout();
      triggerToast('Modo Imersivo Ativado: Header e Barra de Navegação Ocultos');
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      setIsFullscreen(false);
      setShowControls(true);
      setControlsVisible(true);
      triggerToast('Modo Padrão Restaurado (Header e Barra Visíveis)');
    }
  };

  const getFilterStyle = () => {
    let filterString = `brightness(${brightness}%)`;
    if (paperFilter === 'sepia') {
      filterString += ' sepia(0.25) contrast(1.05)';
    } else if (paperFilter === 'high-contrast') {
      filterString += ' contrast(1.25) brightness(0.95)';
    }
    return { filter: filterString };
  };

  const currentMediaUrl = `/api/acervo/page-media/${comic.id}/${currentPage}${tokenParam}`;
  const nextMediaUrl = `/api/acervo/page-media/${comic.id}/${currentPage + 1}${tokenParam}`;

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-[#0d0d1a] text-[#f4ebd8] flex flex-col select-none relative ${
        isFullscreen ? 'fixed inset-0 z-50 overflow-hidden' : ''
      }`}
    >
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a2e] border border-[#ffc531] text-[#f4ebd8] px-4 py-2 rounded-[4px] shadow-2xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-[#ffc531]" />
          {showToast}
        </div>
      )}

      {/* 1. Top Header Bar (Hidden in Fullscreen) */}
      {!isFullscreen && showControls && (
        <div className="sticky top-0 z-30 bg-[#12121f]/95 backdrop-blur-md border-b border-[#8a8ca5]/15 px-3 py-2 flex items-center justify-between transition-all">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1.5 text-[#f4ebd8] hover:text-[#ffc531] hover:bg-[#1a1a2e] rounded-full transition-colors cursor-pointer"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 bg-[#ffc531] rounded-[2px] flex items-center justify-center">
                <span className="font-anton text-xs text-[#12121f] font-black leading-none">B</span>
              </div>
              <span className="font-anton text-xs tracking-wider uppercase text-[#f4ebd8]">
                BANCA GEEK
              </span>
            </div>
          </div>

          {/* Central Title & Active Format Tag */}
          <div className="flex items-center gap-2">
            <span className="font-anton text-sm tracking-wider uppercase text-[#f4ebd8] hidden sm:inline">
              LEITOR ATIVO INTERNO
            </span>
            <span className="px-2 py-0.5 bg-[#d62839] text-[#f4ebd8] rounded-[2px] font-anton text-[10px] tracking-wider uppercase font-bold shadow-xs">
              .{formatLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => {
                onToggleBookmark(comic.id);
                triggerToast(comic.isBookmarked ? 'Marcador removido' : 'Página marcada nos favoritos!');
              }}
              className="p-1.5 text-[#f4ebd8] hover:text-[#ffc531] rounded-full transition-colors cursor-pointer"
              aria-label="Salvar Marcador"
            >
              <Bookmark className={`w-5 h-5 ${comic.isBookmarked ? 'fill-[#ffc531] text-[#ffc531]' : ''}`} />
            </button>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a2e] hover:bg-[#ffc531] text-[#f4ebd8] hover:text-[#12121f] border border-[#ffc531]/40 hover:border-[#ffc531] rounded-[4px] text-xs font-anton tracking-wider uppercase transition-all cursor-pointer shadow-xs"
              aria-label="Modo Imersivo (Tela Cheia)"
              title="Modo Tela Cheia Imersivo (Atalho: F) - Oculta header e barra de navegação"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-[#ffc531]" /> : <Maximize2 className="w-3.5 h-3.5 text-[#ffc531]" />}
              <span className="hidden sm:inline">{isFullscreen ? 'SAIR IMERSÃO' : 'MODO IMERSIVO'}</span>
            </button>

            <img
              src={USER_PROFILE.avatarUrl}
              alt={USER_PROFILE.name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-[#ffc531]/70"
            />
          </div>
        </div>
      )}

      {/* 2. Sub-Header Info Bar: Title & Live Page Tracker */}
      {!isFullscreen && showControls && (
        <div className="bg-[#12121f] px-3 py-2 border-b border-[#8a8ca5]/15 flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 flex items-center justify-center text-[#f4ebd8] hover:border-[#ffc531] transition-colors cursor-pointer flex-shrink-0"
            title="Voltar aos Detalhes"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 px-2">
            <h2 className="font-anton text-sm sm:text-base tracking-wide uppercase text-[#f4ebd8] truncate">
              {comic.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] truncate">
              <span className="font-bold text-[#ffc531] font-anton tracking-wider">
                PÁGINA {currentPage} DE {totalPages} ({progressPercent}%)
              </span>
              <span className="text-[#10b981] flex items-center gap-1 font-semibold">
                <CloudCheck className="w-3 h-3" />
                Progresso Salvo
              </span>
              <span className="text-[#8a8ca5] hidden sm:inline">• {comic.publisher} {comic.year}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowThumbnailDrawer(!showThumbnailDrawer)}
              aria-label="Grade de Páginas"
              title="Ver Grade de Miniaturas"
              className="w-8 h-8 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 flex items-center justify-center text-[#f4ebd8] hover:border-[#ffc531] transition-colors cursor-pointer"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              aria-label="Configurações do Leitor"
              title="Ajustes de Brilho e Papel"
              className="w-8 h-8 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 flex items-center justify-center text-[#f4ebd8] hover:border-[#ffc531] transition-colors cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Completion Banner when user finishes the comic */}
      {!isFullscreen && isCompleted && (
        <div className="bg-gradient-to-r from-[#b20024] via-[#d62839] to-[#b20024] text-[#f4ebd8] px-4 py-2 border-b border-[#ffc531] flex items-center justify-between text-xs animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#ffc531] flex-shrink-0" />
            <div>
              <span className="font-anton tracking-wider uppercase font-bold text-sm block">
                EDIÇÃO 100% CONCLUÍDA!
              </span>
              <span className="text-[11px] text-[#f4ebd8]/90">
                Página {totalPages} finalizada e salva permanentemente na sua estante.
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setCurrentPage(1);
              triggerToast('Leitura reiniciada na Página 1');
            }}
            className="flex items-center gap-1 px-3 py-1 bg-[#12121f] text-[#ffc531] hover:bg-[#1a1a2e] rounded-[3px] font-anton text-xs uppercase border border-[#ffc531] cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reler
          </button>
        </div>
      )}

      {/* 3. Main Reading Stage */}
      <div
        ref={readerStageRef}
        onMouseMove={resetControlsTimeout}
        onTouchStart={resetControlsTimeout}
        className={`relative flex items-center justify-center ${
          isFullscreen
            ? 'fixed inset-0 z-50 w-screen h-screen bg-black p-0 m-0 overflow-hidden'
            : 'flex-1 overflow-auto p-2 sm:p-4 bg-black/90'
        }`}
        style={{
          minHeight: isFullscreen ? '100vh' : '68vh',
          height: isFullscreen ? '100vh' : undefined,
          width: isFullscreen ? '100vw' : undefined,
        }}
      >
        {/* Floating Top-Right Exit Button inside Fullscreen stage with auto-hide */}
        {isFullscreen && (
          <div
            className={`absolute top-4 right-4 z-40 flex items-center gap-2 transition-all duration-300 ${
              controlsVisible ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none -translate-y-2'
            }`}
          >
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#12121f]/90 hover:bg-[#ffc531] text-[#f4ebd8] hover:text-[#12121f] rounded-full border border-white/20 shadow-2xl backdrop-blur-md text-xs font-anton tracking-wider uppercase transition-all cursor-pointer"
              title="Sair do Modo Imersivo (ESC ou toque)"
            >
              <Minimize2 className="w-4 h-4" />
              <span>Sair da Imersão (ESC)</span>
            </button>
          </div>
        )}

        {/* Floating Bottom Navigator inside Fullscreen stage with auto-hide */}
        {isFullscreen && (
          <div
            className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-[#12121f]/90 hover:bg-[#12121f]/95 backdrop-blur-md border border-[#ffc531]/60 px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-3 text-xs select-none transition-all duration-300 ${
              controlsVisible ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-4'
            }`}
          >
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              className="p-1 text-[#f4ebd8] hover:text-[#ffc531] disabled:opacity-30 cursor-pointer"
              title="Página Anterior (Seta Esquerda)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="font-anton text-sm text-[#ffc531] tracking-wider px-1">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className="p-1 text-[#f4ebd8] hover:text-[#ffc531] disabled:opacity-30 cursor-pointer"
              title="Próxima Página (Seta Direita / Espaço)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <span className="w-px h-4 bg-white/20" />

            <button
              onClick={() => {
                const next = fitMode === 'contain' ? 'width' : fitMode === 'width' ? 'height' : 'contain';
                setFitMode(next);
                triggerToast(next === 'contain' ? 'Ajuste: Proporção Original' : next === 'width' ? 'Ajuste: Largura Total' : 'Ajuste: Altura Total');
              }}
              className="px-2 py-0.5 bg-[#1a1a2e] border border-[#8a8ca5]/30 rounded-[3px] text-[10px] font-anton text-[#16e1ff] hover:text-[#ffc531] cursor-pointer"
              title="Ajuste de Imagem (Tela / Largura / Altura)"
            >
              {fitMode === 'contain' ? 'AJUSTE: TELA' : fitMode === 'width' ? 'AJUSTE: LARGURA' : 'AJUSTE: ALTURA'}
            </button>

            <span className="w-px h-4 bg-white/20" />

            <button
              onClick={toggleFullscreen}
              className="p-1 text-[#f4ebd8] hover:text-[#d62839] cursor-pointer"
              title="Sair do Modo Imersivo"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {readerEngine === 'pdf' ? (
          /* Optional Cloud View for PDF */
          <div
            className={`flex flex-col bg-[#12121f] overflow-hidden ${
              isFullscreen
                ? 'w-full h-full rounded-none border-0'
                : 'w-full max-w-4xl h-[78vh] rounded-[4px] border border-[#ffc531]/40 shadow-2xl'
            }`}
          >
            <div className="bg-[#1a1a2e] px-3 py-2 border-b border-[#8a8ca5]/20 flex items-center justify-between text-xs">
              <span className="font-anton text-xs text-[#ffc531] uppercase">
                Google Drive Cloud Viewer
              </span>
              <button
                onClick={() => setReaderEngine('canvas')}
                className="px-2.5 py-1 bg-[#d62839] text-[#f4ebd8] rounded-[3px] text-xs font-anton uppercase cursor-pointer"
              >
                Voltar ao Leitor Nativo Interno
              </button>
            </div>
            <div className="flex-1 w-full h-full relative bg-black">
              <iframe
                src={comic.drivePreviewUrl || `https://drive.google.com/file/d/${comic.driveFileId}/preview`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                title={comic.title}
              />
            </div>
          </div>
        ) : viewMode === 'vertical' ? (
          /* Vertical Continuous Scroll Webtoon Mode */
          <div
            className={`flex flex-col items-center gap-3 py-4 ${
              isFullscreen ? 'w-full max-w-4xl h-full overflow-y-auto px-2' : 'w-full max-w-3xl'
            }`}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <div
                key={pg}
                className="w-full bg-[#12121f] rounded-[3px] overflow-hidden border border-[#8a8ca5]/20 shadow-xl"
              >
                <img
                  src={`/api/acervo/page-media/${comic.id}/${pg}`}
                  alt={`${comic.title} Pág ${pg}`}
                  loading="lazy"
                  className="w-full h-auto object-contain bg-black"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (!el.dataset.failed) {
                      el.dataset.failed = 'true';
                      el.src = comic.coverUrl || `/api/acervo/cover-art/${comic.id}`;
                    }
                  }}
                />
                <div className="p-1.5 bg-[#12121f] text-center text-[10px] text-[#8a8ca5] font-mono border-t border-[#8a8ca5]/10">
                  Página {pg} de {totalPages}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Native Canvas / Panel Reader (Single Page or Double Spread) */
          <div
            className={`relative transition-transform duration-200 flex items-center justify-center ${
              isFullscreen
                ? 'w-full h-full max-w-none max-h-none'
                : viewMode === 'double'
                ? 'max-w-5xl w-full'
                : 'max-w-3xl w-full'
            }`}
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              ...getFilterStyle(),
            }}
          >
            <div
              className={`relative w-full h-full flex items-center justify-center ${
                isFullscreen ? 'gap-0 p-0 m-0' : 'gap-2'
              }`}
            >
              {/* Page 1 (Current Page) */}
              <div
                onDoubleClick={toggleFullscreen}
                className={`relative flex items-center justify-center bg-black overflow-hidden ${
                  isFullscreen
                    ? 'w-full h-full max-w-screen max-h-screen rounded-none border-0 shadow-none'
                    : 'aspect-[2/3] w-full max-h-[82vh] rounded-[4px] border-2 border-[#8a8ca5]/30 shadow-2xl'
                }`}
              >
                {!imageLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#12121f] text-[#8a8ca5] gap-2 z-10">
                    <span className="animate-spin inline-block w-6 h-6 border-2 border-[#ffc531] border-t-transparent rounded-full" />
                    <span className="text-[11px] font-anton text-[#ffc531]">CARREGANDO PÁG. {currentPage}...</span>
                  </div>
                )}

                {!pageError ? (
                  <img
                    src={currentMediaUrl}
                    alt={`${comic.title} Página ${currentPage}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageLoaded(true);
                      setPageError(true);
                    }}
                    className={`bg-black select-none transition-all ${
                      fitMode === 'width'
                        ? 'w-full h-auto object-contain max-w-none'
                        : fitMode === 'height'
                        ? 'h-full w-auto object-contain max-h-screen'
                        : isFullscreen
                        ? 'w-full h-full max-h-screen max-w-screen object-contain object-center'
                        : 'w-full h-full object-contain object-center'
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-[#12121f] text-center select-none">
                    <div className="w-44 aspect-[2/3] mb-4 shadow-2xl rounded-[4px] overflow-hidden border border-[#ffc531]/40">
                      <ClientComicCover comic={comic} />
                    </div>
                    <p className="text-xs text-[#8a8ca5] max-w-xs mb-3">
                      Página {currentPage} de {totalPages} • Edição Preservada no Google Drive
                    </p>
                    {comic.drivePreviewUrl && (
                      <a
                        href={comic.drivePreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#16e1ff] hover:bg-[#00c8e6] text-[#12121f] font-anton text-xs uppercase tracking-wider rounded-[3px] font-bold shadow-lg transition-transform hover:scale-105"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>LER NO VISUALIZADOR OFICIAL DO DRIVE</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Overlaid security watermark */}
                {showWatermarks && (
                  <div className="absolute top-2 left-3 right-3 flex justify-between text-[9px] font-mono text-white/35 tracking-widest select-none pointer-events-none uppercase">
                    <span>BG-NATIVE-{formatLabel}</span>
                    <span>PÁG {currentPage}/{totalPages}</span>
                  </div>
                )}

                {/* Interactive Click Zones: Click left -> prev, click right -> next, click middle -> toggle controls */}
                <div
                  onClick={goToPrevPage}
                  className="absolute inset-y-0 left-0 w-2/5 cursor-w-resize z-20 group"
                  title="Página Anterior (Seta Esquerda)"
                >
                  <div className="h-full flex items-center justify-start pl-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2.5 rounded-full bg-[#12121f]/90 text-[#ffc531] border border-[#ffc531] shadow-xl">
                      <ChevronLeft className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => {
                    if (isFullscreen) {
                      setControlsVisible((prev) => !prev);
                    } else {
                      setShowControls((prev) => !prev);
                    }
                  }}
                  className="absolute inset-y-0 left-2/5 right-2/5 cursor-pointer z-10"
                  title="Alternar Controles (ou Duplo Clique para Modo Imersivo)"
                />

                <div
                  onClick={goToNextPage}
                  className="absolute inset-y-0 right-0 w-2/5 cursor-e-resize z-20 group"
                  title="Próxima Página (Seta Direita / Espaço)"
                >
                  <div className="h-full flex items-center justify-end pr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-2.5 rounded-full bg-[#12121f]/90 text-[#ffc531] border border-[#ffc531] shadow-xl">
                      <ChevronRight className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Page 2 (If Double Page Spread Mode is enabled) */}
              {viewMode === 'double' && currentPage < totalPages && (
                <div
                  onDoubleClick={toggleFullscreen}
                  className={`relative flex items-center justify-center bg-black overflow-hidden ${
                    isFullscreen
                      ? 'w-1/2 h-full max-w-[50vw] max-h-screen rounded-none border-0 shadow-none'
                      : 'aspect-[2/3] w-full max-h-[82vh] rounded-[4px] border-2 border-[#8a8ca5]/30 shadow-2xl'
                  }`}
                >
                  <img
                    src={nextMediaUrl}
                    alt={`${comic.title} Página ${currentPage + 1}`}
                    className={`object-contain object-center bg-black select-none ${
                      isFullscreen ? 'w-full h-full max-h-screen' : 'w-full h-full'
                    }`}
                    onError={(e) => {
                      const el = e.currentTarget;
                      if (!el.dataset.failed) {
                        el.dataset.failed = 'true';
                        el.src = comic.coverUrl || `/api/acervo/cover-art/${comic.id}`;
                      }
                    }}
                  />
                  <div className="absolute top-2 right-3 text-[9px] font-mono text-white/35 uppercase pointer-events-none">
                    PÁG {currentPage + 1}/{totalPages}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Controls: View Mode, Scrubber, Zoom & Fullscreen */}
      {!isFullscreen && showControls && (
        <div className="bg-[#12121f] border-t border-[#8a8ca5]/15 px-3 py-2 z-20">
          {/* Mode Switcher Tabs */}
          <div className="flex justify-center mb-2 flex-wrap gap-1.5">
            <div className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/20 p-1 flex items-center gap-1 shadow-md">
              <button
                onClick={() => {
                  setReaderEngine('canvas');
                  setViewMode('single');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-colors cursor-pointer ${
                  readerEngine === 'canvas' && viewMode === 'single'
                    ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-xs'
                    : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                PÁGINA ÚNICA
              </button>

              <button
                onClick={() => {
                  setReaderEngine('canvas');
                  setViewMode('double');
                  triggerToast('Modo Página Dupla ativado');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-colors cursor-pointer ${
                  viewMode === 'double'
                    ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-xs'
                    : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                DUPLA
              </button>

              <button
                onClick={() => {
                  setReaderEngine('canvas');
                  setViewMode('vertical');
                  triggerToast('Modo Rolo Vertical contínuo ativado');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-colors cursor-pointer ${
                  viewMode === 'vertical'
                    ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-xs'
                    : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
                }`}
              >
                <Scroll className="w-3.5 h-3.5" />
                VERTICAL
              </button>

              {comic.isPdf && (
                <button
                  onClick={() => setReaderEngine(readerEngine === 'pdf' ? 'canvas' : 'pdf')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-colors cursor-pointer ${
                    readerEngine === 'pdf'
                      ? 'bg-[#d62839] text-[#f4ebd8] font-bold shadow-xs'
                      : 'text-[#ffc531] hover:text-[#f4ebd8]'
                  }`}
                  title="Alternar para Drive Viewer Oficial"
                >
                  <FileText className="w-3.5 h-3.5" />
                  DRIVE
                </button>
              )}
            </div>
          </div>

          {/* Scrubber / Slider Bar */}
          <div className="max-w-lg mx-auto flex items-center gap-3 mb-2">
            <button
              onClick={goToPrevPage}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
              className="w-9 h-9 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 flex items-center justify-center text-[#f4ebd8] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#ffc531] cursor-pointer flex-shrink-0 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#8a8ca5] w-6 text-right">01</span>

              <div className="relative flex-1 flex items-center">
                <input
                  type="range"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={handleScrubberChange}
                  className="w-full h-2 bg-[#1a1a2e] rounded-lg appearance-none cursor-pointer accent-[#d62839]"
                />
              </div>

              <span className="font-anton text-sm text-[#ffc531] tracking-wider px-1 whitespace-nowrap">
                {currentPage < 10 ? `0${currentPage}` : currentPage} / {totalPages}
              </span>

              <span className="text-[11px] font-mono text-[#8a8ca5] w-6">{totalPages}</span>
            </div>

            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              aria-label="Próxima página"
              className="w-9 h-9 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 flex items-center justify-center text-[#f4ebd8] disabled:opacity-30 disabled:cursor-not-allowed hover:border-[#ffc531] cursor-pointer flex-shrink-0 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Zoom & Fullscreen Toolbar */}
          <div className="max-w-lg mx-auto flex items-center justify-between text-xs pt-1 border-t border-[#8a8ca5]/10">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleZoomOut}
                aria-label="Diminuir Zoom"
                className="px-2.5 py-1 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 text-[#f4ebd8] hover:border-[#ffc531] cursor-pointer font-anton"
              >
                -
              </button>

              <button
                onClick={handleZoomIn}
                aria-label="Aumentar Zoom"
                className="px-2.5 py-1 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 text-[#f4ebd8] hover:border-[#ffc531] cursor-pointer font-anton"
              >
                +
              </button>

              <button
                onClick={handleResetZoom}
                aria-label="Ajustar à tela"
                className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#1a1a2e] border border-[#8a8ca5]/20 text-[#f4ebd8] hover:border-[#ffc531] cursor-pointer font-anton text-[11px] uppercase tracking-wider"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#ffc531]" />
                AJUSTAR
              </button>
            </div>

            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ffc531] hover:bg-[#ffb703] text-[#12121f] rounded-[4px] font-anton text-xs uppercase tracking-wider font-bold cursor-pointer transition-colors shadow-md"
              title="Alternar Modo de Tela Cheia Imersivo (Atalho: F) - Oculta header e barra de navegação"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'SAIR DA IMERSÃO' : 'MODO IMERSIVO (F)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] border border-[#ffc531] rounded-[4px] w-full max-w-sm p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#8a8ca5]/20 mb-4">
              <h3 className="font-anton text-base tracking-wide uppercase text-[#f4ebd8] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#ffc531]" />
                AJUSTES DO LEITOR INTERNO
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-[#8a8ca5] hover:text-[#f4ebd8] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Brightness */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-[#8a8ca5] mb-1">
                <span>Brilho da Página</span>
                <span className="text-[#ffc531] font-bold">{brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="120"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#12121f] rounded-lg appearance-none cursor-pointer accent-[#ffc531]"
              />
            </div>

            {/* Paper Filter */}
            <div className="mb-4">
              <span className="text-xs text-[#8a8ca5] block mb-2">Filtro de Papel e Tinta</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setPaperFilter('normal')}
                  className={`p-2 text-center rounded-[3px] border text-xs font-semibold cursor-pointer ${
                    paperFilter === 'normal'
                      ? 'bg-[#12121f] border-[#ffc531] text-[#ffc531]'
                      : 'bg-[#12121f]/50 border-[#8a8ca5]/20 text-[#8a8ca5]'
                  }`}
                >
                  Digital HD
                </button>

                <button
                  onClick={() => setPaperFilter('sepia')}
                  className={`p-2 text-center rounded-[3px] border text-xs font-semibold cursor-pointer ${
                    paperFilter === 'sepia'
                      ? 'bg-[#12121f] border-[#ffc531] text-[#ffc531]'
                      : 'bg-[#12121f]/50 border-[#8a8ca5]/20 text-[#8a8ca5]'
                  }`}
                >
                  Papel Retrô
                </button>

                <button
                  onClick={() => setPaperFilter('high-contrast')}
                  className={`p-2 text-center rounded-[3px] border text-xs font-semibold cursor-pointer ${
                    paperFilter === 'high-contrast'
                      ? 'bg-[#12121f] border-[#ffc531] text-[#ffc531]'
                      : 'bg-[#12121f]/50 border-[#8a8ca5]/20 text-[#8a8ca5]'
                  }`}
                >
                  Alto Contraste
                </button>
              </div>
            </div>

            {/* Watermark Toggle */}
            <div className="mb-5 flex items-center justify-between pt-2 border-t border-[#8a8ca5]/15">
              <div>
                <span className="text-xs font-bold text-[#f4ebd8] block">Marca d&apos;água de Acervo</span>
                <span className="text-[10px] text-[#8a8ca5]">Preservação e autenticidade da HQ</span>
              </div>
              <input
                type="checkbox"
                checked={showWatermarks}
                onChange={(e) => setShowWatermarks(e.target.checked)}
                className="w-4 h-4 accent-[#ffc531] cursor-pointer"
              />
            </div>

            {/* Modo Tela Cheia Imersivo */}
            <div className="mb-4 flex items-center justify-between pt-2 border-t border-[#8a8ca5]/15">
              <div>
                <span className="text-xs font-bold text-[#f4ebd8] block">Modo Tela Cheia (Imersão Total)</span>
                <span className="text-[10px] text-[#8a8ca5]">Oculta o header e a barra de navegação</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  toggleFullscreen();
                  setShowSettingsModal(false);
                }}
                className={`px-3 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase border transition-colors cursor-pointer ${
                  isFullscreen
                    ? 'bg-[#10b981] text-[#12121f] border-[#10b981] font-bold'
                    : 'bg-[#ffc531] text-[#12121f] border-[#ffc531] font-bold'
                }`}
              >
                {isFullscreen ? 'ATIVO' : 'ATIVAR'}
              </button>
            </div>

            {comic.drivePreviewUrl && (
              <div className="mb-4 pt-2 border-t border-[#8a8ca5]/15">
                <a
                  href={comic.drivePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 bg-[#12121f] hover:bg-[#22223b] border border-[#ffc531]/50 text-[#ffc531] rounded-[3px] text-xs font-anton tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>VISUALIZADOR GOOGLE DRIVE</span>
                </a>
              </div>
            )}

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-2 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-xs tracking-wider uppercase rounded-[3px] border border-[#ffc531] cursor-pointer"
            >
              APLICAR AJUSTES
            </button>
          </div>
        </div>
      )}

      {/* Thumbnail Drawer */}
      {showThumbnailDrawer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-[#1a1a2e] border-t-2 border-[#ffc531] rounded-t-[8px] max-h-[75vh] flex flex-col p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#8a8ca5]/20 mb-3">
              <h3 className="font-anton text-base tracking-wide uppercase text-[#f4ebd8] flex items-center gap-2">
                <Grid className="w-4 h-4 text-[#ffc531]" />
                SALTAR PARA PÁGINA ({totalPages} PÁGINAS)
              </h3>
              <button
                onClick={() => setShowThumbnailDrawer(false)}
                className="text-[#8a8ca5] hover:text-[#f4ebd8] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 p-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                <div
                  key={pg}
                  onClick={() => {
                    setCurrentPage(pg);
                    setShowThumbnailDrawer(false);
                    triggerToast(`Navegando para Página ${pg}`);
                  }}
                  className={`aspect-[2/3] rounded-[3px] border flex flex-col items-center justify-between p-1 cursor-pointer transition-all ${
                    pg === currentPage
                      ? 'border-[#ffc531] bg-[#ffc531]/20 ring-2 ring-[#ffc531]'
                      : 'border-[#8a8ca5]/20 bg-[#12121f] hover:border-[#ffc531]/70'
                  }`}
                >
                  <span className="text-[10px] font-anton text-[#ffc531] font-bold">
                    P. {pg}
                  </span>
                  <div className="w-full flex-1 bg-black/40 rounded-[2px] flex items-center justify-center overflow-hidden my-0.5">
                    <img
                      src={`/api/acervo/page-media/${comic.id}/${pg}`}
                      alt={`Pág ${pg}`}
                      loading="lazy"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = 'none';
                      }}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {pg === currentPage && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ffc531]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
