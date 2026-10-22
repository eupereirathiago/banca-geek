import React, { useState } from 'react';
import { ComicIssue } from '../types/comic';
import { USER_PROFILE } from '../data/comics';
import { HardDrive, Trash2, ShieldCheck, Check, Download } from 'lucide-react';

interface CacheManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  comics: ComicIssue[];
  onToggleOffline: (comicId: string) => void;
}

export const CacheManagerModal: React.FC<CacheManagerModalProps> = ({
  isOpen,
  onClose,
  comics,
  onToggleOffline,
}) => {
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  if (!isOpen) return null;

  const offlineComics = comics.filter((c) => c.isOfflineAvailable);

  const handleClearAll = () => {
    setClearing(true);
    setTimeout(() => {
      offlineComics.forEach((c) => onToggleOffline(c.id));
      setClearing(false);
      setCleared(true);
      setTimeout(() => setCleared(false), 2000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] border border-[#ffc531] rounded-[6px] w-full max-w-lg p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#8a8ca5]/20 mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#16e1ff]" />
            <h2 className="font-anton text-lg tracking-wide uppercase text-[#f4ebd8]">
              GERENCIAMENTO DE CACHE OFFLINE
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a8ca5] hover:text-[#f4ebd8] text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Storage stats */}
        <div className="bg-[#12121f] rounded-[4px] p-3.5 border border-[#8a8ca5]/15 mb-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-[#8a8ca5]">Armazenamento Local Utilizado</span>
            <span className="text-[#ffc531] font-bold">
              {offlineComics.length > 0 ? USER_PROFILE.cachedStorageGb : '0'} GB / {USER_PROFILE.maxCacheGb} GB
            </span>
          </div>

          <div className="w-full h-2 bg-[#22223b] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-[#16e1ff] rounded-full"
              style={{
                width: `${offlineComics.length > 0 ? (USER_PROFILE.cachedStorageGb / USER_PROFILE.maxCacheGb) * 100 : 0}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#8a8ca5]">
            <span className="flex items-center gap-1 text-[#10b981]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Gateway Criptografado Ativo
            </span>
            <span>{offlineComics.length} edições armazenadas</span>
          </div>
        </div>

        {/* List of Offline Items */}
        <div className="mb-4">
          <span className="text-xs font-anton tracking-wider uppercase text-[#8a8ca5] block mb-2">
            EDIÇÕES BAIXADAS NESTE DISPOSITIVO:
          </span>

          <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {offlineComics.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#8a8ca5] bg-[#12121f]/50 rounded-[3px]">
                Nenhuma edição armazenada offline no momento.
              </div>
            ) : (
              offlineComics.map((comic, idx) => (
                <div
                  key={`cache-${comic.id}-${idx}`}
                  className="flex items-center justify-between p-2.5 bg-[#12121f] rounded-[3px] border border-[#8a8ca5]/15 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <img
                      src={comic.coverUrl}
                      alt={comic.title}
                      className="w-7 h-10 object-cover rounded-[2px]"
                    />
                    <div className="truncate">
                      <span className="font-bold text-[#f4ebd8] block truncate">
                        {comic.title}
                      </span>
                      <span className="text-[10px] text-[#8a8ca5]">
                        {comic.totalPages} páginas • ~140 MB
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleOffline(comic.id)}
                    className="p-1.5 text-[#d62839] hover:bg-[#22223b] rounded-[2px] cursor-pointer"
                    title="Excluir do dispositivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#8a8ca5]/20">
          <button
            onClick={handleClearAll}
            disabled={clearing || offlineComics.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#22223b] hover:bg-[#d62839] text-[#f4ebd8] rounded-[3px] text-xs font-anton tracking-wider uppercase disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            {cleared ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10b981]" />
                LIMPO!
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                LIMPAR TODO O CACHE
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#ffc531] hover:bg-[#e5b02b] text-[#12121f] font-anton text-xs tracking-wider uppercase rounded-[3px] font-bold cursor-pointer"
          >
            CONCLUIR
          </button>
        </div>
      </div>
    </div>
  );
};
