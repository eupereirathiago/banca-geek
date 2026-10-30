import React from 'react';
import { Saga, ComicIssue } from '../types/comic';
import {
  Compass,
  Play,
  Lock,
  CheckCircle2,
  Calendar,
  Layers,
  BookOpen,
  ArrowRight
} from 'lucide-react';

interface SagaDetailModalProps {
  saga: Saga | null;
  onClose: () => void;
  comics: ComicIssue[];
  onOpenReader: (comic: ComicIssue, pageNumber?: number) => void;
}

export const SagaDetailModal: React.FC<SagaDetailModalProps> = ({
  saga,
  onClose,
  comics,
  onOpenReader,
}) => {
  if (!saga) return null;

  // Find corresponding comic in DB if exists
  const matchingComic = comics.find((c) =>
    c.title.toLowerCase().includes(saga.title.toLowerCase()) ||
    (c.sagaTitle && c.sagaTitle.toLowerCase().includes(saga.title.toLowerCase()))
  ) || comics[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[6px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header with Saga Banner */}
        <div className="relative h-44 sm:h-52 overflow-hidden flex-shrink-0">
          <img
            src={saga.bannerUrl}
            alt={saga.title}
            className="w-full h-full object-cover filter brightness-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/60 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-[#f4ebd8] hover:text-[#ffc531] flex items-center justify-center cursor-pointer text-sm font-bold border border-white/20"
          >
            ✕
          </button>

          <div className="absolute top-3 left-3">
            <span className="px-2 py-0.5 bg-[#d62839] text-[#f4ebd8] text-[10px] font-anton tracking-wider uppercase rounded-[2px] font-bold">
              ORDEM CRONOLÓGICA OFICIAL
            </span>
          </div>

          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2 text-xs text-[#ffc531] font-semibold mb-0.5">
              <span>{saga.publisher}</span>
              <span>•</span>
              <span>{saga.years}</span>
            </div>
            <h2 className="font-anton text-2xl sm:text-3xl tracking-wide uppercase text-[#f4ebd8]">
              {saga.title}
            </h2>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          <p className="text-xs sm:text-sm text-[#8a8ca5] leading-relaxed">
            {saga.description || saga.subtitle}
          </p>

          {/* Saga Progress Bar */}
          <div className="bg-[#12121f] rounded-[4px] p-3 border border-[#8a8ca5]/15">
            <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
              <span className="text-[#8a8ca5]">Seu Progresso na Trilha</span>
              <span className="text-[#ffc531] font-anton tracking-wider">
                {saga.completedIssues} de {saga.totalIssues} Edições ({saga.progressPercent}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#22223b] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#ffc531] rounded-full"
                style={{ width: `${saga.progressPercent}%` }}
              />
            </div>
          </div>

          {/* All Issues in Chronological Order */}
          <div>
            <span className="text-xs font-anton tracking-wider uppercase text-[#ffc531] block mb-2.5">
              TRILHA DE LEITURA SEQUENCIAL ({saga.issues.length} EDIÇÕES)
            </span>

            <div className="space-y-2">
              {saga.issues.map((iss, index) => {
                const exactComic = comics.find((c) => {
                  const matchesSaga = (c.sagaTitle && c.sagaTitle.toLowerCase().includes(saga.title.toLowerCase())) ||
                                      (c.folderPath && c.folderPath.toLowerCase().includes(saga.title.toLowerCase()));
                  if (!matchesSaga) return false;
                  return (
                    c.issueNumber === iss.number ||
                    (c.title && iss.title && (c.title.toLowerCase().includes(iss.title.toLowerCase()) || iss.title.toLowerCase().includes(c.title.toLowerCase())))
                  );
                }) || comics.find((c) =>
                  c.issueNumber === iss.number && (c.sagaTitle && c.sagaTitle.toLowerCase().includes(saga.title.toLowerCase()))
                ) || matchingComic;

                return (
                  <div
                    key={`saga-iss-${saga.id || 'sg'}-${iss.issueCode}-${iss.number || index}-${index}`}
                    onClick={() => {
                      if (exactComic) {
                        onOpenReader(exactComic, exactComic.currentPage || 1);
                        onClose();
                      }
                    }}
                    className={`p-3 rounded-[3px] border flex items-center justify-between transition-all cursor-pointer ${
                      iss.status === 'reading'
                        ? 'bg-[#22223b] border-[#ffc531]'
                        : iss.status === 'completed'
                        ? 'bg-[#12121f] border-[#8a8ca5]/20 hover:border-[#8a8ca5]'
                        : 'bg-[#12121f]/50 border-[#8a8ca5]/10 hover:border-[#8a8ca5]/30'
                    }`}
                  >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-anton text-sm px-2 py-0.5 rounded-[2px] ${
                        iss.status === 'reading'
                          ? 'bg-[#ffc531] text-[#12121f] font-bold'
                          : 'bg-[#1a1a2e] text-[#8a8ca5]'
                      }`}
                    >
                      {iss.issueCode}
                    </span>

                    <div>
                      <h4 className="font-anton text-sm uppercase text-[#f4ebd8]">
                        {iss.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-[#8a8ca5]">
                        <span>{iss.pages} Páginas</span>
                        {iss.specialTag && (
                          <>
                            <span>•</span>
                            <span className="text-[#ffc531] font-semibold">{iss.specialTag}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {iss.status === 'reading' && (
                      <span className="flex items-center gap-1 px-2.5 py-1 bg-[#d62839] text-[#f4ebd8] font-anton text-xs rounded-[2px] tracking-wider uppercase">
                        <Play className="w-3 h-3 fill-current" />
                        LENDO
                      </span>
                    )}
                    {iss.status === 'next' && (
                      <span className="flex items-center gap-1 text-xs text-[#ffc531] font-semibold">
                        A Seguir <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {iss.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                    )}
                    {iss.status === 'locked' && (
                      <Lock className="w-4 h-4 text-[#8a8ca5]/40" />
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#8a8ca5]/20 bg-[#12121f] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#8a8ca5] hover:text-[#f4ebd8] cursor-pointer"
          >
            VOLTAR
          </button>

          <button
            onClick={() => {
              if (matchingComic) {
                onOpenReader(matchingComic, matchingComic.currentPage || 1);
                onClose();
              }
            }}
            className="flex items-center gap-2 px-5 py-2 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-xs tracking-wider uppercase rounded-[3px] border border-[#ffc531] cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            CONTINUAR LEITURA DA SAGA
          </button>
        </div>
      </div>
    </div>
  );
};
