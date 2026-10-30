import React, { useState } from 'react';
import { Saga, ComicIssue } from '../types/comic';
import {
  Compass,
  CheckCircle2,
  Play,
  Lock,
  ArrowRight,
  BookOpen,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

interface SagasScreenProps {
  sagas: Saga[];
  comics: ComicIssue[];
  onSelectSaga: (saga: Saga) => void;
  onOpenReader: (comic: ComicIssue, pageNumber?: number) => void;
}

export const SagasScreen: React.FC<SagasScreenProps> = ({
  sagas,
  comics,
  onSelectSaga,
  onOpenReader,
}) => {
  const [selectedPublisher, setSelectedPublisher] = useState<'TODAS' | 'DC Comics' | 'Marvel'>('TODAS');
  const [sortOrder, setSortOrder] = useState<'cronologica' | 'edicoes' | 'alfabetica'>('cronologica');

  const filteredSagas = React.useMemo(() => {
    let list = selectedPublisher === 'TODAS'
      ? [...sagas]
      : sagas.filter((s) => s.publisher === selectedPublisher);

    if (sortOrder === 'cronologica') {
      list.sort((a, b) => {
        const yearA = parseInt(a.years?.match(/\d{4}/)?.[0] || '2000', 10);
        const yearB = parseInt(b.years?.match(/\d{4}/)?.[0] || '2000', 10);
        if (yearA !== yearB) return yearA - yearB;
        return a.title.localeCompare(b.title);
      });
    } else if (sortOrder === 'edicoes') {
      list.sort((a, b) => (b.totalIssues || 0) - (a.totalIssues || 0));
    } else {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    return list;
  }, [sagas, selectedPublisher, sortOrder]);

  return (
    <div className="pb-28 pt-2 max-w-3xl mx-auto px-4">
      {/* Header Info */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Compass className="w-5 h-5 text-[#ffc531]" />
          <h1 className="font-anton text-2xl tracking-wide uppercase text-[#f4ebd8]">
            SAGAS E CRONOLOGIAS OFICIAIS
          </h1>
        </div>
        <p className="text-xs text-[#8a8ca5]">
          Guias de leitura certificados e arcos canônicos organizados em ordem cronológica de publicação e narrativa histórica.
        </p>
      </div>

      {/* Publisher & Sort Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          {(['TODAS', 'DC Comics', 'Marvel'] as const).map((pub) => (
            <button
              key={pub}
              onClick={() => setSelectedPublisher(pub)}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-anton tracking-wider uppercase transition-all cursor-pointer ${
                selectedPublisher === pub
                  ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-sm'
                  : 'bg-[#1a1a2e] text-[#8a8ca5] hover:text-[#f4ebd8] border border-[#8a8ca5]/20'
              }`}
            >
              {pub}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#8a8ca5] text-[11px] font-semibold hidden sm:inline">Ordenar:</span>
          <button
            onClick={() => setSortOrder('cronologica')}
            className={`px-2.5 py-1 rounded-[3px] text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              sortOrder === 'cronologica'
                ? 'bg-[#ffc531]/20 text-[#ffc531] border border-[#ffc531]/50 font-bold'
                : 'bg-[#1a1a2e] text-[#8a8ca5] hover:text-[#f4ebd8] border border-[#8a8ca5]/20'
            }`}
          >
            <Calendar className="w-3 h-3" />
            Cronologia (Ano)
          </button>
          <button
            onClick={() => setSortOrder('edicoes')}
            className={`px-2.5 py-1 rounded-[3px] text-[11px] font-semibold transition-all cursor-pointer ${
              sortOrder === 'edicoes'
                ? 'bg-[#ffc531]/20 text-[#ffc531] border border-[#ffc531]/50 font-bold'
                : 'bg-[#1a1a2e] text-[#8a8ca5] hover:text-[#f4ebd8] border border-[#8a8ca5]/20'
            }`}
          >
            Mais Edições
          </button>
          <button
            onClick={() => setSortOrder('alfabetica')}
            className={`px-2.5 py-1 rounded-[3px] text-[11px] font-semibold transition-all cursor-pointer ${
              sortOrder === 'alfabetica'
                ? 'bg-[#ffc531]/20 text-[#ffc531] border border-[#ffc531]/50 font-bold'
                : 'bg-[#1a1a2e] text-[#8a8ca5] hover:text-[#f4ebd8] border border-[#8a8ca5]/20'
            }`}
          >
            A-Z
          </button>
        </div>
      </div>

      {/* Sagas Cards */}
      {filteredSagas.length === 0 ? (
        <div className="bg-[#1a1a2e] border border-[#8a8ca5]/20 rounded-[4px] p-8 text-center my-4">
          <Compass className="w-10 h-10 text-[#ffc531] mx-auto mb-3 opacity-80" />
          <h3 className="font-anton text-base uppercase text-[#f4ebd8] mb-1">
            Nenhuma saga catalogada ainda
          </h3>
          <p className="text-xs text-[#8a8ca5] max-w-md mx-auto">
            Todas as sagas fictícias foram removidas. Sincronize suas pastas do Google Drive para organizar suas coleções em arcos e sagas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredSagas.map((saga, idx) => {
          const matchingComic = comics.find((c) =>
            saga.title.toLowerCase().includes(c.title.toLowerCase()) ||
            (c.sagaTitle && c.sagaTitle.toLowerCase().includes(saga.title.toLowerCase()))
          );

          return (
            <div
              key={`saga-card-${saga.id || 'sg'}-${idx}`}
              className="bg-[#1a1a2e] rounded-[4px] border border-[#8a8ca5]/25 overflow-hidden shadow-xl hover:border-[#ffc531] transition-all group"
            >
              {/* Banner Area */}
              <div className="relative h-44 sm:h-52 overflow-hidden">
                <img
                  src={saga.bannerUrl}
                  alt={saga.title}
                  className="w-full h-full object-cover filter brightness-75 group-hover:scale-103 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/60 to-transparent" />

                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#d62839] text-[#f4ebd8] text-[10px] font-anton tracking-wider uppercase rounded-[2px] font-bold shadow-md">
                    {saga.badgeText}
                  </span>
                  <span className="px-2 py-0.5 bg-[#12121f]/80 backdrop-blur-xs text-[#ffc531] text-[10px] font-anton tracking-wider uppercase rounded-[2px] border border-[#ffc531]/40">
                    {saga.publisher}
                  </span>
                </div>

                <div className="absolute bottom-3 left-4 right-4">
                  <div className="flex items-center gap-2 text-[11px] text-[#8a8ca5] font-semibold mb-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#ffc531]" />
                      {saga.years}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#16e1ff]" />
                      {saga.totalIssues} Edições na Trilha
                    </span>
                  </div>
                  <h2 className="font-anton text-2xl sm:text-3xl tracking-wide uppercase text-[#f4ebd8] group-hover:text-[#ffc531] transition-colors leading-tight">
                    {saga.title}
                  </h2>
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <p className="text-xs sm:text-sm text-[#8a8ca5] leading-relaxed mb-4">
                  {saga.subtitle}
                </p>

                {/* Progress bar */}
                <div className="bg-[#12121f] rounded-[4px] p-2.5 border border-[#8a8ca5]/15 mb-4">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                    <span className="text-[#8a8ca5]">Progresso da Trilha</span>
                    <span className="text-[#ffc531] font-anton tracking-wider">
                      {saga.completedIssues} de {saga.totalIssues} Edições ({saga.progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#22223b] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        saga.isComplete ? 'bg-[#10b981]' : 'bg-[#ffc531]'
                      }`}
                      style={{ width: `${saga.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Sample issue list */}
                <div className="space-y-1.5 mb-4">
                  <span className="text-[10px] font-anton uppercase tracking-wider text-[#8a8ca5] block mb-1">
                    PRIMEIRAS EDIÇÕES NA CRONOLOGIA:
                  </span>
                  {saga.issues.slice(0, 3).map((iss, index) => (
                    <div
                      key={`saga-card-iss-${saga.id || 'sg'}-${iss.issueCode}-${iss.number || index}-${index}`}
                      onClick={() => {
                        if (matchingComic) {
                          onOpenReader(matchingComic, 1);
                        }
                      }}
                      className="flex items-center justify-between p-2 rounded-[3px] bg-[#12121f]/60 hover:bg-[#22223b] border border-[#8a8ca5]/15 text-xs cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-anton text-[11px] text-[#ffc531] bg-[#1a1a2e] px-1.5 py-0.5 rounded-[2px]">
                          {iss.issueCode}
                        </span>
                        <span className="font-semibold text-[#f4ebd8] line-clamp-1">
                          {iss.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[#8a8ca5]">
                        {iss.status === 'reading' && (
                          <span className="text-[10px] text-[#ffc531] font-bold">Lendo</span>
                        )}
                        {iss.status === 'completed' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                        )}
                        {iss.status === 'locked' && (
                          <Lock className="w-3.5 h-3.5 text-[#8a8ca5]/50" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-[#8a8ca5]/15">
                  <button
                    onClick={() => onSelectSaga(saga)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#ffc531] hover:bg-[#e5b02b] text-[#12121f] font-anton text-xs tracking-wider uppercase rounded-[3px] font-bold transition-colors cursor-pointer"
                  >
                    <Compass className="w-4 h-4" />
                    EXPLORAR CRONOLOGIA COMPLETA
                  </button>

                  {matchingComic && (
                    <button
                      onClick={() => onOpenReader(matchingComic, matchingComic.currentPage || 1)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-xs tracking-wider uppercase rounded-[3px] transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      LER #01
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
