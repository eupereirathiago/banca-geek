import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, BookOpen } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Banca Geek] Erro capturado pelo ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCacheAndReload = () => {
    try {
      localStorage.removeItem('banca_geek_synced_comics_v3');
      localStorage.removeItem('banca_geek_synced_comics');
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#12121f] text-[#f4ebd8] flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#1a1a2e] border-2 border-[#d62839]/40 rounded-2xl p-6 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#d62839]/15 border border-[#d62839]/30 flex items-center justify-center text-[#d62839]">
              <AlertTriangle className="w-9 h-9" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-widest text-[#ffc531] bg-[#ffc531]/10 px-3 py-1 rounded-full">
                Alerta de Inicialização
              </span>
              <h1 className="text-2xl font-black text-white mt-3 font-anton tracking-wide">
                RECUPERANDO A BANCA GEEK
              </h1>
              <p className="text-xs text-[#8a8ca5] mt-2 leading-relaxed">
                Um detalhe inesperado ocorreu durante a montagem da estante. Não se preocupe, seus quadrinhos e seu histórico continuam salvos.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-[#12121f] p-3 rounded-lg border border-[#8a8ca5]/20 text-left overflow-x-auto text-[11px] font-mono text-[#ffc531]/90 max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-[#ffc531] hover:bg-[#e5b12c] text-[#12121f] font-black text-xs uppercase tracking-wider rounded-xl transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#ffc531]/20"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Aplicativo
              </button>

              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="w-full py-2.5 px-4 bg-[#22223b] hover:bg-[#2a2a46] text-[#8a8ca5] hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#d62839]" />
                Limpar Cache Local e Reiniciar
              </button>
            </div>

            <div className="pt-2 border-t border-[#8a8ca5]/10 flex items-center justify-center gap-2 text-[10px] text-[#8a8ca5]">
              <BookOpen className="w-3.5 h-3.5 text-[#ffc531]" />
              <span>Banca Geek Collector Edition</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
