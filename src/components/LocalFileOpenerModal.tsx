import React, { useState, useRef } from 'react';
import { ComicIssue } from '../types/comic';
import { syncWithServerDatabase } from '../services/databaseService';
import {
  FileUp,
  X,
  FileText,
  Archive,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Maximize2
} from 'lucide-react';

interface LocalFileOpenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComicLoaded: (comic: ComicIssue) => void;
}

export const LocalFileOpenerModal: React.FC<LocalFileOpenerModalProps> = ({
  isOpen,
  onClose,
  onComicLoaded,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setError(null);
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();
    const validExts = ['cbr', 'cbz', 'pdf', 'epub', 'cb7', 'cbt', 'rar', 'zip', 'tar', '7z'];

    if (!ext || !validExts.includes(ext)) {
      setError(`Formato de arquivo não suportado (.${ext}). Selecione arquivos *.cbr, *.cbz, *.pdf, *.epub, *.cb7 ou *.cbt.`);
      return;
    }

    try {
      setLoading(true);
      setLoadingStatus(`Lendo arquivo ${fileName} (${(file.size / (1024 * 1024)).toFixed(1)} MB)...`);

      // Read as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Erro ao ler bytes do arquivo.'));
      });

      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      setLoadingStatus(`Processando arquivo .${ext.toUpperCase()} no leitor nativo interno...`);

      const resp = await fetch('/api/acervo/upload-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileBase64: base64Data,
          format: ext,
        }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `Falha do servidor ao processar .${ext}`);
      }

      const data = await resp.json();
      if (!data.comic) {
        throw new Error('Falha ao gerar páginas da HQ.');
      }

      setLoadingStatus('Pronto! Abrindo Leitor Ativo Interno...');
      syncWithServerDatabase().catch(() => {});
      setTimeout(() => {
        setLoading(false);
        onComicLoaded(data.comic);
        onClose();
      }, 500);
    } catch (err: any) {
      console.error('Erro ao abrir HQ local:', err);
      setError(err?.message || 'Falha ao processar arquivo para leitura interna.');
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileProcess(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#12121f] border border-[#ffc531] rounded-[4px] w-full max-w-lg p-5 shadow-2xl relative text-[#f4ebd8]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#8a8ca5]/20 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[4px] bg-[#d62839] flex items-center justify-center text-[#f4ebd8] font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-anton text-base tracking-wide uppercase text-[#f4ebd8]">
                ABRIR HQ LOCAL
              </h3>
              <p className="text-[11px] text-[#8a8ca5]">
                Leitura 100% interna sem sair do aplicativo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-[#8a8ca5] hover:text-[#f4ebd8] p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supported formats showcase badge bar */}
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-[#8a8ca5] block mb-1.5 uppercase tracking-wider">
            Formatos Nativos Suportados (Internos):
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
            {['.CBR', '.CBZ', '.PDF', '.EPUB', '.CB7', '.CBT'].map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-1 bg-[#1a1a2e] border border-[#ffc531]/30 rounded-[3px] font-anton text-xs text-[#ffc531] tracking-wider"
              >
                {fmt}
              </span>
            ))}
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[4px] p-6 sm:p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[190px] ${
            isDragging
              ? 'border-[#ffc531] bg-[#ffc531]/10'
              : 'border-[#8a8ca5]/30 hover:border-[#ffc531]/60 bg-[#1a1a2e]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".cbr,.cbz,.pdf,.epub,.cb7,.cbt,.rar,.zip,.tar,.7z"
            onChange={handleInputChange}
            className="hidden"
          />

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <span className="animate-spin inline-block w-8 h-8 border-3 border-[#ffc531] border-t-transparent rounded-full" />
              <p className="font-anton text-sm tracking-wider uppercase text-[#ffc531] animate-pulse">
                {loadingStatus}
              </p>
              <span className="text-[11px] text-[#8a8ca5]">
                Descompactando e indexando páginas HD para o leitor interno...
              </span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-[#12121f] border border-[#ffc531]/40 flex items-center justify-center text-[#ffc531] mb-3 shadow-inner">
                <FileUp className="w-6 h-6" />
              </div>
              <h4 className="font-anton text-sm sm:text-base tracking-wider uppercase text-[#f4ebd8] mb-1">
                ARRASTE OU CLIQUE PARA SELECIONAR
              </h4>
              <p className="text-xs text-[#8a8ca5] max-w-xs">
                Selecione qualquer gibi em <strong>.cbr, .cbz, .pdf, .epub, .cb7 ou .cbt</strong>
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-[#12121f] rounded-[3px] border border-[#8a8ca5]/20 text-[10px] text-[#16e1ff] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Processamento Seguro e Local
              </div>
            </>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#8a8ca5]/15 text-center text-[10px] text-[#8a8ca5]">
          <div className="flex flex-col items-center gap-1">
            <BookOpen className="w-4 h-4 text-[#ffc531]" />
            <span>Avança páginas com toque ou teclado</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Maximize2 className="w-4 h-4 text-[#ffc531]" />
            <span>Tela Cheia HD responsiva</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <CheckCircle className="w-4 h-4 text-[#ffc531]" />
            <span>Salva páginas lidas e marca progresso</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 p-3 bg-[#d62839]/20 border border-[#d62839] rounded-[3px] text-xs text-[#f4ebd8] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#d62839] flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
