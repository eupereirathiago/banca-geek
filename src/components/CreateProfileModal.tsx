import React, { useState, useRef } from 'react';
import { UserProfile } from '../types/comic';
import { AVATAR_OPTIONS, createInitialProfile } from '../services/profileService';
import { googleSignIn } from '../services/authService';
import { ShieldCheck, Check, LogIn, Upload, Camera, Sparkles } from 'lucide-react';

interface CreateProfileModalProps {
  isOpen: boolean;
  onProfileCreated: (profile: UserProfile) => void;
  defaultName?: string;
}

export const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  isOpen,
  onProfileCreated,
}) => {
  // Empty by default: each user enters their own name
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].url);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [favoritePublisher, setFavoritePublisher] = useState('DC Comics');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle direct photo upload from user's device (camera or gallery)
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
        // Optimize and resize image on canvas to maintain high fidelity under 80KB
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, digite seu nome ou apelido para criar seu perfil.');
      return;
    }

    const newProfile = createInitialProfile({
      name: name.trim(),
      avatarUrl: selectedAvatar,
      favoritePublisher,
    });

    onProfileCreated(newProfile);
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setError(null);
      const res = await googleSignIn();
      if (res && res.user) {
        const googleName = res.user.displayName || res.user.email?.split('@')[0] || 'Colecionador';
        const googlePhoto = res.user.photoURL || selectedAvatar;
        const newProfile = createInitialProfile({
          name: googleName,
          avatarUrl: googlePhoto,
          favoritePublisher,
        });
        onProfileCreated(newProfile);
      }
    } catch (err: any) {
      console.warn('[Login] Aviso ao autenticar com Google:', err?.message || err);
      setError('Conexão Google indisponível no momento. Digite seu nome abaixo para entrar.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const publishers = ['DC Comics', 'Marvel', 'Vertigo', 'Mangás'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-sm sm:max-w-md bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[6px] shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-[#d62839] via-[#850a18] to-[#12121f] px-4 py-2.5 sm:py-3 text-white border-b border-[#ffc531]/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#ffc531] rounded-[2px] flex items-center justify-center shadow-xs">
              <span className="font-anton text-sm text-[#12121f] font-black leading-none">B</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-anton text-base tracking-wider uppercase text-[#f4ebd8] leading-none">
                  BANCA GEEK
                </span>
                <span className="px-1.5 py-0.2 bg-[#ffc531] text-[#12121f] text-[9px] font-anton tracking-wider uppercase rounded-[2px] font-bold">
                  NOVA CONTA
                </span>
              </div>
              <p className="text-[10px] text-[#f4ebd8]/80 leading-none mt-0.5">
                Acesse sua estante pessoal e continue de onde parou
              </p>
            </div>
          </div>

          <ShieldCheck className="w-5 h-5 text-[#ffc531] opacity-80" />
        </div>

        {/* Form Body - Compact for Zero Mobile Scroll */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 space-y-2.5">
          {error && (
            <div className="p-2 bg-[#d62839]/25 border border-[#d62839] rounded-[3px] text-[11px] text-[#f4ebd8] flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-[#ffc531]">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. Nome do Leitor (Totalmente Limpo - Sem nome pré-fixado) */}
          <div>
            <label className="block text-[11px] font-anton tracking-wider uppercase text-[#f4ebd8] mb-1">
              Seu Nome ou Apelido de Leitor <span className="text-[#ffc531]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Digite seu nome ou apelido (Ex: Lucas, Camila, Alan)"
              autoFocus
              className="w-full px-3 py-2 bg-[#12121f] border border-[#8a8ca5]/30 rounded-[4px] text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:outline-none focus:ring-1 focus:ring-[#ffc531] font-semibold tracking-wide"
            />
          </div>

          {/* 2. Escolha de Foto: Do Dispositivo OU Avatares de Heróis */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-anton tracking-wider uppercase text-[#f4ebd8]">
                Foto do Perfil (Heróis ou Seu Aparelho)
              </label>

              {/* Botão de Foto do Aparelho */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] font-anton uppercase text-[#16e1ff] hover:text-[#ffc531] cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>+ FOTO DO APARELHO</span>
              </button>
            </div>

            {/* Hidden native file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleDevicePhotoUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Avatares de Heróis e Foto Personalizada */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {/* Tile da Foto Personalizada do Dispositivo (se houver) */}
              {customAvatarPreview && (
                <button
                  type="button"
                  onClick={() => setSelectedAvatar(customAvatarPreview)}
                  className={`relative rounded-full w-9 h-9 sm:w-10 sm:h-10 overflow-hidden border-2 transition-all p-0.5 cursor-pointer shrink-0 ${
                    selectedAvatar === customAvatarPreview
                      ? 'border-[#16e1ff] ring-2 ring-[#16e1ff]/60 scale-105'
                      : 'border-[#8a8ca5]/30 opacity-75'
                  }`}
                  title="Sua Foto do Dispositivo"
                >
                  <img src={customAvatarPreview} alt="Foto Personalizada" className="w-full h-full object-cover rounded-full" />
                  {selectedAvatar === customAvatarPreview && (
                    <div className="absolute inset-0 bg-[#16e1ff]/30 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-[#16e1ff] drop-shadow-md stroke-[3]" />
                    </div>
                  )}
                </button>
              )}

              {/* Botão Atalho para abrir galeria/câmera */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-dashed border-[#ffc531]/70 bg-[#12121f] flex flex-col items-center justify-center text-[#ffc531] hover:bg-[#ffc531]/10 transition-colors cursor-pointer shrink-0"
                title="Carregar foto da galeria ou câmera do seu celular"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="text-[7px] font-bold leading-none mt-0.5">DISP.</span>
              </button>

              {/* Avatares Oficiais de Heróis dos Quadrinhos */}
              {AVATAR_OPTIONS.map((av) => {
                const isSelected = selectedAvatar === av.url;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.url)}
                    className={`relative rounded-full w-9 h-9 sm:w-10 sm:h-10 overflow-hidden border-2 transition-all p-0.5 cursor-pointer shrink-0 ${
                      isSelected
                        ? 'border-[#ffc531] ring-2 ring-[#ffc531]/50 scale-105'
                        : 'border-[#8a8ca5]/30 hover:border-[#8a8ca5] opacity-75 hover:opacity-100'
                    }`}
                    title={`${av.label} (${av.hero})`}
                  >
                    <img src={av.url} alt={av.label} className="w-full h-full object-cover rounded-full" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#ffc531]/30 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-[#ffc531] drop-shadow-md stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Editora Favorita (Linha Única Compacta) */}
          <div>
            <label className="block text-[11px] font-anton tracking-wider uppercase text-[#f4ebd8] mb-1">
              Editora ou Linha Preferida
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {publishers.map((pub) => {
                const isSelected = favoritePublisher === pub;
                return (
                  <button
                    key={pub}
                    type="button"
                    onClick={() => setFavoritePublisher(pub)}
                    className={`py-1 px-1 text-center rounded-[3px] text-[10px] font-anton tracking-wider uppercase transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-[#ffc531] text-[#12121f] font-bold shadow-xs'
                        : 'bg-[#12121f] text-[#8a8ca5] border border-[#8a8ca5]/20 hover:border-[#8a8ca5]/50'
                    }`}
                  >
                    {pub}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full py-1.5 px-3 bg-[#12121f] hover:bg-[#22223b] text-[#f4ebd8] border border-[#8a8ca5]/30 hover:border-[#ffc531] rounded-[4px] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isGoogleLoading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-[#ffc531] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
            )}
            <span className="text-[11px]">{isGoogleLoading ? 'Conectando...' : 'Entrar com Conta Google'}</span>
          </button>

          {/* Big High-Contrast ENTER BUTTON */}
          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-[#d62839] via-[#b20024] to-[#850a18] hover:from-[#e63946] hover:to-[#a0001e] text-[#f4ebd8] font-anton text-sm sm:text-base tracking-wider uppercase rounded-[4px] border border-[#ffc531] transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2 active:scale-98"
          >
            <LogIn className="w-4 h-4 text-[#ffc531]" />
            <span>ENTRAR NO ACERVO GEEK</span>
          </button>
        </form>
      </div>
    </div>
  );
};
