import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types/comic';
import { AVATAR_OPTIONS } from '../services/profileService';
import { googleSignIn, openDomainHelpModal, getAuthErrorMessage } from '../services/authService';
import {
  checkUsernameAvailability,
  registerUserAccount,
  loginUserAccount,
  normalizeUsername,
} from '../services/userAccountService';
import {
  ShieldCheck,
  Check,
  Upload,
  Camera,
  AtSign,
  KeyRound,
  UserCheck,
  UserPlus,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface CreateProfileModalProps {
  isOpen: boolean;
  onProfileCreated: (profile: UserProfile) => void;
  defaultName?: string;
}

export const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  isOpen,
  onProfileCreated,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>('register');

  // Registration fields
  const [usernameInput, setUsernameInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].url);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [favoritePublisher, setFavoritePublisher] = useState('Marvel');

  // Login fields
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');

  // Status & Validation
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{
    checked: boolean;
    available?: boolean;
    error?: string;
  }>({ checked: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkTimeoutRef = useRef<any>(null);

  // Live availability check as user types @username in register tab
  useEffect(() => {
    if (tab !== 'register') return;

    const normalized = normalizeUsername(usernameInput);
    if (!normalized || normalized.length < 3) {
      setUsernameStatus({ checked: false });
      return;
    }

    if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);

    setIsCheckingUsername(true);
    checkTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(normalized);
        setUsernameStatus({
          checked: true,
          available: res.available,
          error: res.error,
        });
      } catch {
        setUsernameStatus({ checked: false });
      } finally {
        setIsCheckingUsername(false);
      }
    }, 400);

    return () => {
      if (checkTimeoutRef.current) clearTimeout(checkTimeoutRef.current);
    };
  }, [usernameInput, tab]);

  if (!isOpen) return null;

  // Photo upload handler
  const handleDevicePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 240;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setCustomAvatarPreview(compressedDataUrl);
          setSelectedAvatar(compressedDataUrl);
          if (error) setError(null);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit registration with unique @username
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUsername(usernameInput);
    if (!normalized || normalized.length < 3) {
      setError('Por favor, digite um @usuário com pelo menos 2 caracteres (ex: @thiago).');
      return;
    }

    if (usernameStatus.checked && !usernameStatus.available) {
      setError(`O @usuário "${normalized}" já existe! Clique na aba "JÁ TENHO @USUÁRIO" para entrar.`);
      return;
    }

    try {
      setIsLoading(true);
      const user = await registerUserAccount({
        username: normalized,
        name: nameInput.trim() || normalized.replace('@', ''),
        avatarUrl: selectedAvatar,
        pin: pinInput.trim() || undefined,
        favoritePublisher,
      });

      setSuccessMsg(`Bem-vindo, ${user.username}!`);
      setTimeout(() => {
        onProfileCreated({
          name: user.name,
          username: user.username,
          pin: user.pin,
          avatarUrl: user.avatarUrl,
          readBadge: user.readBadge || 'PRIMEIRA LEITURA • 0 REVISTAS',
          readingMilestone: user.readingMilestone || 'Início da Coleção',
          readIssuesCount: user.readIssuesCount || 0,
          nextMilestoneCount: 10,
          nextBadgeName: 'SELO KRYPTONITA (10 REVISTAS)',
          completedSagasCount: 0,
          cachedStorageGb: 0,
          maxCacheGb: 10,
          offlineExpiryDays: 30,
          favoritePublisher: user.favoritePublisher,
          createdAt: user.createdAt,
        });
      }, 600);
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit login with existing unique @username
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalized = normalizeUsername(loginUsername);
    if (!normalized) {
      setError('Por favor, digite seu @usuário para entrar.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await loginUserAccount(normalized, loginPin.trim() || undefined);

      setSuccessMsg(`Login efetuado com sucesso! Carregando seu progresso...`);
      setTimeout(() => {
        onProfileCreated({
          name: user.name,
          username: user.username,
          pin: user.pin,
          avatarUrl: user.avatarUrl,
          readBadge: user.readBadge || 'PRIMEIRA LEITURA • 0 REVISTAS',
          readingMilestone: user.readingMilestone || 'Início da Coleção',
          readIssuesCount: user.readIssuesCount || 0,
          nextMilestoneCount: 10,
          nextBadgeName: 'SELO KRYPTONITA (10 REVISTAS)',
          completedSagasCount: 0,
          cachedStorageGb: 0,
          maxCacheGb: 10,
          offlineExpiryDays: 30,
          favoritePublisher: user.favoritePublisher,
          createdAt: user.createdAt,
        });
      }, 600);
    } catch (err: any) {
      setError(err?.message || 'Erro ao entrar com este @usuário.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Login alternative
  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setError(null);
      const res = await googleSignIn();
      if (res && res.user) {
        const googleUsername = normalizeUsername(res.user.email?.split('@')[0] || 'google_user');
        const googleName = res.user.displayName || googleUsername.replace('@', '');
        const googlePhoto = res.user.photoURL || selectedAvatar;

        const profile: UserProfile = {
          name: googleName,
          username: googleUsername,
          avatarUrl: googlePhoto,
          readBadge: 'PRIMEIRA LEITURA • 0 REVISTAS',
          readingMilestone: 'Início da Coleção',
          readIssuesCount: 0,
          nextMilestoneCount: 10,
          nextBadgeName: 'SELO KRYPTONITA (10 REVISTAS)',
          completedSagasCount: 0,
          cachedStorageGb: 0,
          maxCacheGb: 10,
          offlineExpiryDays: 30,
          createdAt: new Date().toISOString(),
        };

        onProfileCreated(profile);
      }
    } catch (err: any) {
      if (err?.isDomainError) {
        openDomainHelpModal();
        setError('O domínio da Vercel precisa ser autorizado no Firebase Console. Abrindo instruções...');
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[8px] shadow-2xl overflow-hidden my-4">
        {/* Header Vintage */}
        <div className="bg-gradient-to-r from-[#d62839] via-[#850a18] to-[#12121f] p-4 text-white border-b border-[#ffc531]/40 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffc531] text-[#12121f] text-[10px] font-anton tracking-wider uppercase rounded-[3px] font-bold mb-1 shadow-md">
            <ShieldCheck className="w-3.5 h-3.5" /> ACERVO PESSOAL ISOLADO
          </div>
          <h2 className="font-anton text-xl tracking-wider uppercase text-[#f4ebd8]">
            BANCA GEEK COLLECTOR
          </h2>
          <p className="text-xs text-[#f4ebd8]/80">
            Cada leitor tem seu próprio @usuário e progresso exclusivo
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-[#8a8ca5]/20 bg-[#12121f]">
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 font-anton text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'register'
                ? 'bg-[#1a1a2e] text-[#ffc531] border-b-2 border-[#ffc531] font-bold'
                : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>CRIAR NOVO @USUÁRIO</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 font-anton text-xs tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              tab === 'login'
                ? 'bg-[#1a1a2e] text-[#ffc531] border-b-2 border-[#ffc531] font-bold'
                : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>JÁ TENHO MEU @USUÁRIO</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5">
          {/* Error & Success Messages */}
          {error && (
            <div className="mb-3.5 p-2.5 bg-[#d62839]/20 border border-[#d62839] rounded-[4px] text-xs text-[#f4ebd8] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#d62839] shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-3.5 p-2.5 bg-[#34a853]/20 border border-[#34a853] rounded-[4px] text-xs text-[#f4ebd8] flex items-center gap-2">
              <Check className="w-4 h-4 text-[#34a853] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'register' ? (
            /* TAB 1: CRIAR NOVO USUÁRIO */
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* @Username Único */}
              <div>
                <label className="block text-xs font-anton tracking-wider text-[#ffc531] uppercase mb-1">
                  1. ESCOLHA SEU @USUÁRIO ÚNICO *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#ffc531]">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={usernameInput.replace(/^@/, '')}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="ex: thiago, batman_geek, leitor01"
                    className="w-full bg-[#12121f] border border-[#8a8ca5]/40 rounded-[4px] pl-9 pr-10 py-2.5 text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:ring-1 focus:ring-[#ffc531] focus:outline-none"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    {isCheckingUsername ? (
                      <Loader2 className="w-4 h-4 text-[#ffc531] animate-spin" />
                    ) : usernameStatus.checked && usernameStatus.available ? (
                      <span className="text-[11px] font-anton text-[#34a853] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> DISPONÍVEL
                      </span>
                    ) : usernameStatus.checked && !usernameStatus.available ? (
                      <span className="text-[10px] font-anton text-[#d62839]">JÁ EM USO</span>
                    ) : null}
                  </div>
                </div>
                <p className="text-[11px] text-[#8a8ca5] mt-1">
                  Este nome será seu identificador exclusivo. Todo o seu progresso de leitura fica vinculado a ele.
                </p>
              </div>

              {/* Nome ou Apelido */}
              <div>
                <label className="block text-xs font-anton tracking-wider text-[#ffc531] uppercase mb-1">
                  2. SEU NOME OU APELIDO
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Como prefere ser chamado no app?"
                  className="w-full bg-[#12121f] border border-[#8a8ca5]/40 rounded-[4px] px-3 py-2 text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:outline-none"
                />
              </div>

              {/* PIN de Segurança Opcional */}
              <div>
                <label className="block text-xs font-anton tracking-wider text-[#ffc531] uppercase mb-1">
                  3. PIN DE SEGURANÇA (OPCIONAL)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a8ca5]">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex: 1234 (para maior privacidade)"
                    className="w-full bg-[#12121f] border border-[#8a8ca5]/40 rounded-[4px] pl-9 pr-3 py-2 text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-[#8a8ca5] mt-0.5">
                  Protege seu @usuário para que ninguém acesse suas HQs sem o seu PIN.
                </p>
              </div>

              {/* Seleção de Avatar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-anton tracking-wider text-[#ffc531] uppercase">
                    4. FOTO DE PERFIL
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] font-anton text-[#16e1ff] hover:text-[#ffc531] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Upload className="w-3 h-3" />
                    <span>ENVIAR MINHA FOTO</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleDevicePhotoUpload}
                    className="hidden"
                  />
                </div>

                {customAvatarPreview ? (
                  <div className="flex items-center gap-3 p-2 bg-[#12121f] rounded-[4px] border border-[#ffc531]">
                    <img
                      src={customAvatarPreview}
                      alt="Prévia"
                      className="w-11 h-11 rounded-full object-cover border border-[#ffc531]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold text-[#f4ebd8] block truncate">Sua foto selecionada</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomAvatarPreview(null);
                          setSelectedAvatar(AVATAR_OPTIONS[0].url);
                        }}
                        className="text-[10px] text-[#d62839] hover:underline cursor-pointer"
                      >
                        Trocar por herói clássico
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_OPTIONS.slice(0, 6).map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setSelectedAvatar(av.url)}
                        className={`relative rounded-full overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                          selectedAvatar === av.url
                            ? 'border-[#ffc531] scale-105 shadow-md shadow-[#ffc531]/30'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        title={av.label}
                      >
                        <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                        {selectedAvatar === av.url && (
                          <div className="absolute inset-0 bg-[#ffc531]/30 flex items-center justify-center">
                            <Check className="w-3 h-3 text-[#12121f] stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Botão de Criação */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#ffc531] via-[#ffb703] to-[#e09f00] hover:from-[#ffd166] hover:to-[#ffb703] text-[#12121f] font-anton text-sm tracking-wider uppercase rounded-[4px] shadow-lg flex items-center justify-center gap-2 font-black transition-all cursor-pointer active:scale-98 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CRIANDO @USUÁRIO...</span>
                  </>
                ) : (
                  <span>CRIAR CONTA &amp; COMEÇAR A LER</span>
                )}
              </button>
            </form>
          ) : (
            /* TAB 2: ENTRAR COM USUÁRIO EXISTENTE */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="p-3 bg-[#12121f] rounded-[4px] border border-[#8a8ca5]/20 text-xs text-[#8a8ca5] leading-relaxed">
                Digite o seu <strong className="text-[#ffc531]">@usuário</strong> cadastrado anteriormente para recuperar imediatamente todas as páginas lidas, marcadores e sua estante!
              </div>

              <div>
                <label className="block text-xs font-anton tracking-wider text-[#ffc531] uppercase mb-1">
                  SEU @USUÁRIO CADASTRADO *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#ffc531]">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={loginUsername.replace(/^@/, '')}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="ex: thiago"
                    className="w-full bg-[#12121f] border border-[#8a8ca5]/40 rounded-[4px] pl-9 pr-3 py-2.5 text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-anton tracking-wider text-[#ffc531] uppercase mb-1">
                  PIN DE SEGURANÇA (SE HOUVER)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a8ca5]">
                    <KeyRound className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    maxLength={6}
                    value={loginPin}
                    onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Digite seu PIN (deixe em branco se não cadastrou)"
                    className="w-full bg-[#12121f] border border-[#8a8ca5]/40 rounded-[4px] pl-9 pr-3 py-2 text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#ffc531] via-[#ffb703] to-[#e09f00] hover:from-[#ffd166] hover:to-[#ffb703] text-[#12121f] font-anton text-sm tracking-wider uppercase rounded-[4px] shadow-lg flex items-center justify-center gap-2 font-black transition-all cursor-pointer active:scale-98 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ENTRANDO NO ACERVO...</span>
                  </>
                ) : (
                  <span>ENTRAR NO MEU ACERVO</span>
                )}
              </button>
            </form>
          )}

          {/* Divisor Google */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#8a8ca5]/20" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-anton tracking-widest">
              <span className="bg-[#1a1a2e] px-2 text-[#8a8ca5]">OU CONTINUE COM</span>
            </div>
          </div>

          {/* Botão Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-[#12121f] font-anton text-xs tracking-wider uppercase rounded-[4px] shadow-sm flex items-center justify-center gap-2 font-bold transition-all cursor-pointer active:scale-98 disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isGoogleLoading ? 'CONECTANDO...' : 'ENTRAR COM CONTA GOOGLE'}</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="bg-[#12121f] px-4 py-2 border-t border-[#8a8ca5]/15 flex items-center justify-center gap-1.5 text-[10px] text-[#8a8ca5]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#34a853]" />
          <span>Isolamento total: seus marcadores e leituras são 100% privados</span>
        </div>
      </div>
    </div>
  );
};
