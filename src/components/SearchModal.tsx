import React, { useState } from 'react';
import { ComicIssue, Saga, CharacterHighlight } from '../types/comic';
import { Search, X, BookOpen, Compass, ChevronRight } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  comics: ComicIssue[];
  sagas: Saga[];
  onSelectComic: (comic: ComicIssue) => void;
  onSelectSaga: (saga: Saga) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  comics,
  sagas,
  onSelectComic,
  onSelectSaga,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'dc' | 'marvel' | 'vertigo'>('all');

  if (!isOpen) return null;

  const filteredComics = comics.filter((c) => {
    const matchesQuery =
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      (c.sagaTitle && c.sagaTitle.toLowerCase().includes(query.toLowerCase())) ||
      (c.scriptWriter && c.scriptWriter.toLowerCase().includes(query.toLowerCase())) ||
      (c.artArtist && c.artArtist.toLowerCase().includes(query.toLowerCase())) ||
      c.year.toString().includes(query);

    const matchesFilter =
      filterType === 'all'
        ? true
        : filterType === 'dc'
        ? c.publisher.toLowerCase().includes('dc')
        : filterType === 'marvel'
        ? c.publisher.toLowerCase().includes('marvel')
        : c.publisher.toLowerCase().includes('vertigo');

    return matchesQuery && matchesFilter;
  });

  const filteredSagas = sagas.filter((s) =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-3 sm:p-6 items-center">
      <div className="w-full max-w-2xl bg-[#1a1a2e] border border-[#ffc531] rounded-[6px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#8a8ca5]/20 flex items-center gap-3 bg-[#12121f]">
          <Search className="w-5 h-5 text-[#ffc531]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por herói, arco, autor (ex: Batman, Frank Miller, 1993)..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-[#f4ebd8] placeholder-[#8a8ca5] outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#8a8ca5] hover:text-[#f4ebd8] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-2 py-1 bg-[#22223b] text-[#f4ebd8] rounded-[3px] text-xs font-anton tracking-wider uppercase cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Quick Filter Tags */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#161628] border-b border-[#8a8ca5]/10 overflow-x-auto hide-scrollbar text-xs">
          <span className="text-[#8a8ca5] text-[10px] font-semibold uppercase">Filtro:</span>
          {(['all', 'dc', 'marvel', 'vertigo'] as const).map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterType(tag)}
              className={`px-2.5 py-1 rounded-[2px] font-anton tracking-wider uppercase cursor-pointer transition-colors ${
                filterType === tag
                  ? 'bg-[#ffc531] text-[#12121f] font-bold'
                  : 'bg-[#1a1a2e] text-[#8a8ca5] hover:text-[#f4ebd8]'
              }`}
            >
              {tag === 'all' ? 'Todos' : tag}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {/* Sagas matches */}
          {filteredSagas.length > 0 && (
            <div>
              <span className="text-[11px] font-anton tracking-wider uppercase text-[#ffc531] block mb-2">
                SAGAS ENCONTRADAS ({filteredSagas.length})
              </span>
              <div className="space-y-2">
                {filteredSagas.map((s, idx) => (
                  <div
                    key={`search-saga-${s.id}-${idx}`}
                    onClick={() => {
                      onSelectSaga(s);
                      onClose();
                    }}
                    className="p-2.5 bg-[#12121f] rounded-[3px] border border-[#8a8ca5]/20 hover:border-[#ffc531] flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <Compass className="w-4 h-4 text-[#ffc531]" />
                      <div>
                        <h4 className="font-anton text-sm uppercase text-[#f4ebd8]">
                          {s.title}
                        </h4>
                        <span className="text-[10px] text-[#8a8ca5]">
                          {s.publisher} • {s.totalIssues} Edições • {s.years}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8a8ca5]" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comics matches */}
          <div>
            <span className="text-[11px] font-anton tracking-wider uppercase text-[#f4ebd8] block mb-2">
              EDIÇÕES DO ACERVO ({filteredComics.length})
            </span>

            {filteredComics.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#8a8ca5]">
                Nenhuma edição encontrada para &quot;{query}&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredComics.map((comic, idx) => (
                  <div
                    key={`search-comic-${comic.id}-${idx}`}
                    onClick={() => {
                      onSelectComic(comic);
                      onClose();
                    }}
                    className="p-2 bg-[#12121f] rounded-[3px] border border-[#8a8ca5]/20 hover:border-[#ffc531] flex gap-2.5 cursor-pointer group transition-all"
                  >
                    <img
                      src={comic.coverUrl}
                      alt={comic.title}
                      className="w-12 aspect-[2/3] object-cover rounded-[2px]"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <span className="text-[9px] font-semibold text-[#ffc531] block uppercase">
                          {comic.publisher} • {comic.year}
                        </span>
                        <h4 className="font-anton text-xs text-[#f4ebd8] uppercase truncate group-hover:text-[#ffc531] transition-colors">
                          {comic.title}
                        </h4>
                        <p className="text-[10px] text-[#8a8ca5] truncate">
                          {comic.scriptWriter} • {comic.artArtist}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-[#8a8ca5]">
                        <span>{comic.totalPages} págs</span>
                        {comic.readProgressPercent > 0 && (
                          <span className="text-[#d62839] font-bold">
                            {comic.readProgressPercent}% lido
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
