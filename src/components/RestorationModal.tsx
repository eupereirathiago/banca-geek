import React, { useState } from 'react';
import { Sparkles, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

interface RestorationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RestorationModal: React.FC<RestorationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[6px] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#8a8ca5]/20 bg-[#12121f]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[2px] bg-[#ffc531] text-[#12121f] flex items-center justify-center font-anton text-xs font-bold">
              4K
            </div>
            <div>
              <h2 className="font-anton text-base sm:text-lg tracking-wide uppercase text-[#f4ebd8]">
                CLUBE DE PRESERVAÇÃO HISTÓRICA
              </h2>
              <span className="text-[11px] text-[#ffc531] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Negativo Original (Anos 80) vs Restauração 4K
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a8ca5] hover:text-[#f4ebd8] text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Interactive Slider */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          <p className="text-xs text-[#8a8ca5] mb-3">
            Arraste a barra para comparar o impresso original em papel jornal envelhecido com a nossa matriz restaurada em altíssima definição:
          </p>

          {/* Before & After Interactive Canvas */}
          <div className="relative aspect-[4/3] w-full rounded-[4px] overflow-hidden border border-[#8a8ca5]/30 select-none shadow-inner mb-4">
            {/* Background Layer: 4K Restored */}
            <div className="absolute inset-0 bg-[#0d0d1a] flex items-center justify-center">
              <img
                src="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80"
                alt="4K Restored"
                className="w-full h-full object-cover filter contrast-125 brightness-105"
              />
              <div className="absolute bottom-2 right-2 bg-[#ffc531] text-[#12121f] text-[10px] font-anton px-2 py-0.5 rounded-[2px] font-bold shadow-md">
                RESTAURAÇÃO DIGITAL 4K
              </div>
            </div>

            {/* Foreground Layer: 1980s Original Faded (Clipped by slider) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <div className="w-[100vw] max-w-xl h-full relative">
                <img
                  src="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80"
                  alt="Original 1980s Scan"
                  className="w-full h-full object-cover sepia-paper filter contrast-90 brightness-90 saturate-50"
                />
                <div className="absolute inset-0 bg-[#f4ebd8]/15 mix-blend-multiply pointer-events-none" />
                <div className="absolute bottom-2 left-2 bg-[#12121f]/90 text-[#f4ebd8] text-[10px] font-anton px-2 py-0.5 rounded-[2px] border border-[#8a8ca5]/40 shadow-md">
                  IMPRESSO ORIGINAL 1993
                </div>
              </div>
            </div>

            {/* Slider Divider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#ffc531] shadow-[0_0_8px_#ffc531] cursor-ew-resize pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#ffc531] text-[#12121f] flex items-center justify-center shadow-lg border-2 border-[#12121f]">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Native slider input over canvas */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPos}
              onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
              className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full z-20"
            />
          </div>

          {/* Details list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-[#12121f] p-3 rounded-[3px] border border-[#8a8ca5]/15">
              <span className="font-anton text-xs text-[#ffc531] uppercase block mb-1">
                TÉCNICAS APLICADAS
              </span>
              <ul className="space-y-1 text-[#8a8ca5]">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                  Correção de descoloração do papel
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                  Eliminação de artefatos de fotolito
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />
                  Reconstituição das retículas Ben-Day
                </li>
              </ul>
            </div>

            <div className="bg-[#12121f] p-3 rounded-[3px] border border-[#8a8ca5]/15">
              <span className="font-anton text-xs text-[#16e1ff] uppercase block mb-1">
                GARANTIA COLECIONADOR
              </span>
              <p className="text-[#8a8ca5] leading-relaxed">
                Todas as páginas do catálogo contam com calibração de cor certificada e resolução óptica mínima de 2400 DPI.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#8a8ca5]/20 bg-[#12121f] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#ffc531] hover:bg-[#e5b02b] text-[#12121f] font-anton text-xs tracking-wider uppercase rounded-[3px] font-bold cursor-pointer"
          >
            FECHAR VISUALIZADOR
          </button>
        </div>
      </div>
    </div>
  );
};
