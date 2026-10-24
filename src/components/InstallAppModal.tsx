import React, { useState } from 'react';
import { Download, Smartphone, Sparkles, X, Share, PlusSquare, CheckCircle, ShieldCheck } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => Promise<void>;
  isIOS?: boolean;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  onInstall,
  isIOS = false,
}) => {
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }

    try {
      setIsInstalling(true);
      await onInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[8px] shadow-2xl overflow-hidden flex flex-col">
        {/* Comic Vintage Header */}
        <div className="bg-gradient-to-r from-[#d62839] via-[#850a18] to-[#12121f] p-4 text-white border-b border-[#ffc531]/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#ffc531] rounded-[4px] flex items-center justify-center shadow-md shrink-0 border border-[#12121f]">
              <span className="font-anton text-xl text-[#12121f] font-black leading-none">B</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-anton text-base tracking-wider uppercase text-[#f4ebd8]">
                  BANCA GEEK
                </span>
                <span className="px-1.5 py-0.5 bg-[#ffc531] text-[#12121f] text-[9px] font-anton tracking-wider uppercase rounded-[2px] font-bold">
                  APP OFICIAL
                </span>
              </div>
              <p className="text-[11px] text-[#f4ebd8]/80 leading-tight">
                Instale no seu aparelho para melhor experiência
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#f4ebd8]/70 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {!showIosGuide ? (
            <>
              {/* Question Banner */}
              <div className="text-center space-y-1">
                <h3 className="font-anton text-lg tracking-wide uppercase text-[#ffc531]">
                  Deseja instalar o app da Banca Geek?
                </h3>
                <p className="text-xs text-[#8a8ca5] leading-relaxed">
                  Adicione o leitor na tela de início do seu celular ou computador para ler com tela cheia e carregamento instantâneo.
                </p>
              </div>

              {/* Benefits List */}
              <div className="space-y-2.5 bg-[#12121f] p-3.5 rounded-[6px] border border-[#8a8ca5]/20">
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#ffc531]/15 text-[#ffc531] flex items-center justify-center shrink-0 mt-0.5">
                    <Smartphone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-anton text-[#f4ebd8] block">Ícone Direto na Tela de Início</span>
                    <span className="text-[11px] text-[#8a8ca5]">Abra seu acervo com 1 toque, sem precisar digitar URL.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#16e1ff]/15 text-[#16e1ff] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-anton text-[#f4ebd8] block">Leitura Imersiva em Tela Cheia</span>
                    <span className="text-[11px] text-[#8a8ca5]">Visual limpo sem barras de navegação do browser.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#34a853]/15 text-[#34a853] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-anton text-[#f4ebd8] block">Mais Rápido &amp; Salva Dados</span>
                    <span className="text-[11px] text-[#8a8ca5]">Capas e páginas abrem direto do cache permanente.</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={handleInstallClick}
                  disabled={isInstalling}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#ffc531] via-[#ffb703] to-[#e09f00] hover:from-[#ffd166] hover:to-[#ffb703] text-[#12121f] font-anton text-sm tracking-wider uppercase rounded-[4px] shadow-lg flex items-center justify-center gap-2 font-black transition-all cursor-pointer active:scale-98 disabled:opacity-60"
                >
                  <Download className="w-4 h-4 stroke-[2.5]" />
                  <span>{isInstalling ? 'INSTALANDO...' : 'INSTALAR APP AGORA (GRÁTIS)'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2 px-3 bg-transparent hover:bg-white/5 text-[#8a8ca5] hover:text-[#f4ebd8] text-xs font-anton tracking-wider uppercase rounded-[4px] transition-colors cursor-pointer text-center"
                >
                  Continuar no Navegador
                </button>
              </div>
            </>
          ) : (
            /* iOS Safari Step-by-Step Instructions */
            <div className="space-y-3.5 animate-fade-in">
              <div className="flex items-center gap-2 text-[#ffc531]">
                <Smartphone className="w-4 h-4" />
                <span className="font-anton text-sm uppercase tracking-wide">Como instalar no iPhone / iPad:</span>
              </div>

              <div className="space-y-2 text-xs text-[#f4ebd8]">
                <div className="flex items-center gap-2.5 p-2 bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/20">
                  <span className="w-5 h-5 rounded-full bg-[#d62839] text-[#f4ebd8] flex items-center justify-center font-anton text-xs shrink-0">1</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Toque no botão</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#22223b] rounded-[3px] font-semibold text-[#ffc531]">
                      <Share className="w-3.5 h-3.5" /> Compartilhar
                    </span>
                    <span>na barra inferior do Safari.</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/20">
                  <span className="w-5 h-5 rounded-full bg-[#d62839] text-[#f4ebd8] flex items-center justify-center font-anton text-xs shrink-0">2</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>Role para baixo e selecione</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#22223b] rounded-[3px] font-semibold text-[#16e1ff]">
                      <PlusSquare className="w-3.5 h-3.5" /> Adicionar à Tela de Início
                    </span>.
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/20">
                  <span className="w-5 h-5 rounded-full bg-[#d62839] text-[#f4ebd8] flex items-center justify-center font-anton text-xs shrink-0">3</span>
                  <span>Toque em <strong>Adicionar</strong> no canto superior direito.</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 px-3 bg-[#ffc531] hover:bg-[#ffb703] text-[#12121f] font-anton text-xs tracking-wider uppercase rounded-[4px] font-bold transition-all cursor-pointer text-center mt-2"
              >
                ENTENDI, VOU ADICIONAR
              </button>
            </div>
          )}
        </div>

        {/* Footer Security Seal */}
        <div className="bg-[#12121f] px-4 py-2 border-t border-[#8a8ca5]/15 flex items-center justify-center gap-1.5 text-[10px] text-[#8a8ca5]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#34a853]" />
          <span>App seguro e verificado • PWA nativo sem anúncios</span>
        </div>
      </div>
    </div>
  );
};
