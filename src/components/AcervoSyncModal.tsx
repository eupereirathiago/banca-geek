import React, { useState, useEffect } from 'react';
import {
  triggerAcervoSync,
  fetchAcervoComics,
  testDriveConnection,
  saveServiceAccountKey,
  DriveTestResult
} from '../services/acervoService';
import { googleSignIn, logout, initAuth, getAccessToken } from '../services/authService';
import { ComicIssue } from '../types/comic';
import {
  ShieldCheck,
  RefreshCw,
  Lock,
  Sparkles,
  Zap,
  Check,
  UserCheck,
  LogOut,
  AlertCircle,
  Key,
  FileCode,
  Upload,
  ExternalLink,
  Copy,
  FolderOpen
} from 'lucide-react';
import type { User } from 'firebase/auth';

interface AcervoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshComics: (refreshedComics: ComicIssue[]) => void;
  currentCount: number;
}

export const AcervoSyncModal: React.FC<AcervoSyncModalProps> = ({
  isOpen,
  onClose,
  onRefreshComics,
  currentCount,
}) => {
  const [activeTab, setActiveTab] = useState<'service_account' | 'oauth'>('service_account');
  const [curatorUser, setCuratorUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Key JSON input state
  const [keyInput, setKeyInput] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [keyFeedback, setKeyFeedback] = useState<string | null>(null);

  // Diagnostic state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DriveTestResult | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Run connection test on open to show current status
    runDiagnosticTest();

    const unsubscribe = initAuth(
      (user, token) => {
        setCuratorUser(user);
        setAuthToken(token || null);
      },
      () => {
        setCuratorUser(null);
        setAuthToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const runDiagnosticTest = async () => {
    setIsTesting(true);
    setErrorMessage(null);
    try {
      const result = await testDriveConnection();
      setTestResult(result);
    } catch {
      setTestResult({
        configured: false,
        message: 'Não foi possível contatar o gateway do servidor.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setKeyInput(content);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveKey = async () => {
    if (!keyInput.trim()) {
      setErrorMessage('Cole o conteúdo do JSON da Service Account ou selecione o arquivo.');
      return;
    }

    setIsSavingKey(true);
    setErrorMessage(null);
    setKeyFeedback(null);

    try {
      const res = await saveServiceAccountKey(keyInput.trim());
      if (res.success) {
        setKeyFeedback(`Chave salva com sucesso para ${res.clientEmail || 'a Service Account'}!`);
        setKeyInput('');
        // Re-run test and reload comics
        await runDiagnosticTest();
        const updated = await fetchAcervoComics();
        if (updated.length > 0) {
          onRefreshComics(updated);
        }
      } else {
        setErrorMessage(res.error || 'Falha ao processar chave.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao salvar chave.');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleCuratorLogin = async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCuratorUser(res.user);
        setAuthToken(res.accessToken || null);
        setSyncResult('Credenciais de curador autenticadas com sucesso!');
        await runDiagnosticTest();
        setTimeout(() => setSyncResult(null), 2500);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Falha ao autenticar credenciais do curador.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleCuratorLogout = async () => {
    await logout();
    setCuratorUser(null);
    setAuthToken(null);
    setSyncResult('Sessão de curadoria encerrada.');
    setTimeout(() => setSyncResult(null), 2000);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setErrorMessage(null);
    try {
      let activeToken = authToken || (await getAccessToken()) || null;

      if (!activeToken && !curatorUser && activeTab === 'oauth') {
        try {
          const res = await googleSignIn();
          if (res?.accessToken) {
            activeToken = res.accessToken;
            setCuratorUser(res.user);
            setAuthToken(res.accessToken);
          }
        } catch (loginErr: any) {
          console.warn('Login de curador cancelado:', loginErr?.message);
        }
      }

      const res = await triggerAcervoSync(activeToken || undefined);
      const updated = await fetchAcervoComics();
      if (updated.length > 0) {
        onRefreshComics(updated);
      }
      setSyncResult(res.message || 'Acervo Central sincronizado via Gateway Seguro!');
      await runDiagnosticTest();
      setTimeout(() => {
        setSyncResult(null);
      }, 3000);
    } catch {
      setErrorMessage('Acervo operando em modo seguro local.');
    } finally {
      setIsSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#1a1a2e] border-2 border-[#16e1ff] rounded-[6px] w-full max-w-xl p-5 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#8a8ca5]/20 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[3px] bg-[#16e1ff] text-[#12121f] flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-anton text-base sm:text-lg tracking-wide uppercase text-[#f4ebd8]">
                GATEWAY DO ACERVO PRIVADO
              </h2>
              <span className="text-[11px] text-[#16e1ff] font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Google Drive API • Streaming Opaque DRM Nível 3
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#8a8ca5] hover:text-[#f4ebd8] text-sm cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#8a8ca5]/20 mb-4">
          <button
            onClick={() => setActiveTab('service_account')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-anton tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
              activeTab === 'service_account'
                ? 'border-[#16e1ff] text-[#16e1ff] bg-[#16e1ff]/10'
                : 'border-transparent text-[#8a8ca5] hover:text-[#f4ebd8]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            Service Account (JSON)
          </button>

          <button
            onClick={() => setActiveTab('oauth')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-anton tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
              activeTab === 'oauth'
                ? 'border-[#16e1ff] text-[#16e1ff] bg-[#16e1ff]/10'
                : 'border-transparent text-[#8a8ca5] hover:text-[#f4ebd8]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Curador OAuth (Google)
          </button>
        </div>

        {/* TAB 1: SERVICE ACCOUNT CONFIG */}
        {activeTab === 'service_account' && (
          <div className="space-y-4 mb-4">
            <div className="bg-[#12121f] rounded-[4px] p-3.5 border border-[#8a8ca5]/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#ffc531]" />
                  <span className="text-xs font-anton tracking-wide uppercase text-[#f4ebd8]">
                    Chave de Conta de Serviço
                  </span>
                </div>

                <label className="flex items-center gap-1 px-2.5 py-1 bg-[#22223b] hover:bg-[#33334d] text-[#16e1ff] text-[11px] font-bold rounded-[2px] cursor-pointer transition-colors border border-[#16e1ff]/30">
                  <Upload className="w-3 h-3" />
                  Carregar .json
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Cole o conteúdo do seu arquivo service-account.json aqui (ou use o botão Carregar .json acima)..."
                rows={3}
                className="w-full bg-[#1a1a2e] text-[#f4ebd8] text-xs font-mono p-2.5 rounded-[3px] border border-[#8a8ca5]/30 focus:border-[#16e1ff] focus:outline-none resize-none"
              />

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#8a8ca5]">
                  Escopo: <code className="text-[#16e1ff]">https://www.googleapis.com/auth/drive.readonly</code>
                </span>

                <button
                  onClick={handleSaveKey}
                  disabled={isSavingKey || !keyInput.trim()}
                  className="px-3.5 py-1.5 bg-[#16e1ff] hover:bg-[#00c8e6] text-[#12121f] text-xs font-anton tracking-wider uppercase rounded-[3px] font-bold cursor-pointer transition-all disabled:opacity-40"
                >
                  {isSavingKey ? 'Validando...' : 'Salvar & Ativar Chave'}
                </button>
              </div>

              {keyFeedback && (
                <div className="p-2 bg-[#10b981]/20 border border-[#10b981] text-[#10b981] text-xs rounded-[3px] flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {keyFeedback}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: OAUTH CONFIG */}
        {activeTab === 'oauth' && (
          <div className="space-y-4 mb-4">
            <div className="bg-[#12121f] rounded-[4px] p-3 border border-[#8a8ca5]/25">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className={`w-4 h-4 ${curatorUser ? 'text-[#10b981]' : 'text-[#8a8ca5]'}`} />
                  <div className="text-xs">
                    <span className="text-[#8a8ca5] block text-[10px] uppercase font-bold tracking-wider">
                      Sessão Google OAuth
                    </span>
                    {curatorUser ? (
                      <span className="text-[#f4ebd8] font-bold">
                        {curatorUser.displayName || curatorUser.email}
                      </span>
                    ) : (
                      <span className="text-[#8a8ca5]">Não conectado</span>
                    )}
                  </div>
                </div>

                {curatorUser ? (
                  <button
                    onClick={handleCuratorLogout}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#22223b] hover:bg-[#d62839] text-xs text-[#f4ebd8] rounded-[2px] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sair</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCuratorLogin}
                    disabled={isAuthenticating}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#f4ebd8] hover:bg-white text-[#12121f] text-xs font-bold rounded-[3px] shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isAuthenticating ? 'Conectando...' : 'Conectar com Google'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DRIVE DIAGNOSTIC PANEL */}
        <div className="bg-[#12121f] rounded-[4px] p-3.5 border border-[#16e1ff]/30 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-anton uppercase tracking-wide text-[#f4ebd8] flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-[#16e1ff]" />
              Diagnóstico do Repositório (Drive)
            </span>

            <button
              onClick={runDiagnosticTest}
              disabled={isTesting}
              className="text-[11px] text-[#16e1ff] hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8a8ca5]">Pasta Alvo:</span>
              <a
                href="https://drive.google.com/drive/folders/14R42LfMQvsU7SxkB5mNgPOTIh-i4u5Ch"
                target="_blank"
                rel="noreferrer"
                className="text-[#16e1ff] font-mono hover:underline flex items-center gap-1"
              >
                14R42LfMQvsU7SxkB5mNgPOTIh-i4u5Ch
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8a8ca5]">Google Drive API:</span>
              <span className={`font-bold ${testResult?.apiActive ? 'text-[#10b981]' : 'text-[#ffc531]'}`}>
                {testResult?.apiActive ? '✅ ATIVA' : 'AGUARDANDO VALIDAÇÃO'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#8a8ca5]">Edições no Catálogo Ativo:</span>
              <span className="text-[#f4ebd8] font-bold">{currentCount} Edições</span>
            </div>
          </div>

          {/* Diagnosis & Error Resolution Guide */}
          {testResult && testResult.diagnosis && (
            <div className="mt-3 p-3 bg-[#d62839]/15 border border-[#d62839] rounded-[4px] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ff6b6b]">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#d62839]" />
                {testResult.diagnosis}
              </div>

              {testResult.clientEmail && (
                <div className="bg-[#1a1a2e] p-2 rounded-[3px] border border-[#8a8ca5]/30">
                  <span className="text-[10px] text-[#8a8ca5] block mb-1">
                    Compartilhe a pasta do Drive com este e-mail:
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-[#16e1ff] break-all font-mono font-bold">
                      {testResult.clientEmail}
                    </code>
                    <button
                      onClick={() => copyToClipboard(testResult.clientEmail!)}
                      className="px-2 py-1 bg-[#22223b] hover:bg-[#33334d] text-xs text-[#f4ebd8] rounded-[2px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedEmail ? <Check className="w-3 h-3 text-[#10b981]" /> : <Copy className="w-3 h-3" />}
                      {copiedEmail ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>
              )}

              {testResult.steps && (
                <ol className="list-decimal list-inside text-[11px] text-[#f4ebd8] space-y-1">
                  {testResult.steps.map((st, i) => (
                    <li key={i}>{st}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Success listing snippet */}
          {testResult && testResult.items && testResult.items.length > 0 && (
            <div className="mt-3 p-2.5 bg-[#10b981]/10 border border-[#10b981]/40 rounded-[4px]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#10b981] mb-1.5">
                <Check className="w-3.5 h-3.5" />
                {testResult.itemCount} itens localizados na pasta do Drive:
              </div>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[10px] text-[#f4ebd8]">
                {testResult.items.slice(0, 10).map((it) => (
                  <div key={it.id} className="flex items-center justify-between py-0.5 border-b border-[#8a8ca5]/10">
                    <span className="truncate">{it.isFolder ? '📁' : '📄'} {it.name}</span>
                    <span className="text-[#8a8ca5] text-[9px] ml-2 shrink-0">{it.id.slice(0, 8)}...</span>
                  </div>
                ))}
                {testResult.items.length > 10 && (
                  <div className="text-[9px] text-[#8a8ca5] italic">
                    + {testResult.items.length - 10} outros itens
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Safeguard Highlights */}
        <div className="space-y-1.5 mb-4 text-xs text-[#8a8ca5]">
          <div className="flex items-center gap-2 bg-[#12121f]/50 p-2 rounded-[3px] border border-[#8a8ca5]/10">
            <Lock className="w-3.5 h-3.5 text-[#ffc531] shrink-0" />
            <span className="text-[11px]">
              <strong>Streaming Binário Direto:</strong> As páginas são servidas via proxy opaco sem expor URLs ou IDs do Drive.
            </span>
          </div>
        </div>

        {/* Messages */}
        {errorMessage && (
          <div className="p-2.5 bg-[#d62839]/20 border border-[#d62839] text-[#f4ebd8] text-center rounded-[3px] text-xs font-semibold flex items-center justify-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-[#d62839] shrink-0" />
            {errorMessage}
          </div>
        )}

        {syncResult && (
          <div className="p-2.5 bg-[#10b981]/20 border border-[#10b981] text-[#f4ebd8] text-center rounded-[3px] text-xs font-semibold flex items-center justify-center gap-2 mb-3">
            <Check className="w-4 h-4 text-[#10b981] shrink-0" />
            {syncResult}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[#8a8ca5]/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#8a8ca5] hover:text-[#f4ebd8] cursor-pointer"
          >
            FECHAR
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-xs tracking-wider uppercase rounded-[3px] border border-[#ffc531] transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'SINCRONIZANDO GATEWAY...' : 'SINCRONIZAR ACERVO'}
          </button>
        </div>
      </div>
    </div>
  );
};
