import React, { useState } from 'react';
import { UserProfile } from '../types/comic';
import { AVATAR_OPTIONS, createInitialProfile } from '../services/profileService';
import { Shield, Sparkles, BookOpen, Check, UserPlus } from 'lucide-react';

interface CreateProfileModalProps {
  isOpen: boolean;
  onProfileCreated: (profile: UserProfile) => void;
  defaultName?: string;
}

export const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  isOpen,
  onProfileCreated,
  defaultName = '',
}) => {
  const [name, setName] = useState(defaultName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0].url);
  const [favoritePublisher, setFavoritePublisher] = useState('DC Comics');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe seu nome ou apelido para o perfil de leitor.');
      return;
    }

    const newProfile = createInitialProfile({
      name: name.trim(),
      avatarUrl: selectedAvatar,
      favoritePublisher,
      bio: bio.trim() || undefined,
    });

    onProfileCreated(newProfile);
  };

  const publishers = ['DC Comics', 'Marvel', 'Vertigo', 'Mangás', 'Dark Horse'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[6px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#d62839] via-[#850a18] to-[#12121f] p-5 text-white border-b border-[#ffc531]/40 relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-[#ffc531] text-[#12121f] text-[10px] font-anton tracking-wider uppercase rounded-[2px] font-bold">
              BEM-VINDO
            </span>
            <span className="text-xs text-[#f4ebd8]/80 font-medium">Banca Geek Reader</span>
          </div>
          <h2 className="font-anton text-2xl tracking-wide uppercase text-[#f4ebd8] flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-[#ffc531]" />
            CRIAR SEU PERFIL DE LEITOR
          </h2>
          <p className="text-xs text-[#f4ebd8]/80 mt-1 leading-relaxed">
            Configure seu perfil de leitor para acessar suas edições e acompanhar seu progresso de leitura.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-[#d62839]/20 border border-[#d62839] rounded-[4px] text-xs text-[#f4ebd8] flex items-center gap-2">
              <span className="font-bold">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* 1. Nome do Leitor */}
          <div>
            <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-1.5">
              Seu Nome / Apelido no Acervo <span className="text-[#ffc531]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: THIAGO PEREIRA"
              autoFocus
              className="w-full px-3.5 py-2.5 bg-[#12121f] border border-[#8a8ca5]/30 rounded-[4px] text-sm text-[#f4ebd8] placeholder-[#8a8ca5]/60 focus:border-[#ffc531] focus:outline-none focus:ring-1 focus:ring-[#ffc531] font-semibold tracking-wide"
            />
          </div>

          {/* 2. Escolha do Avatar */}
          <div>
            <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-2">
              Escolha seu Avatar de Colecionador
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((av) => {
                const isSelected = selectedAvatar === av.url;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setSelectedAvatar(av.url)}
                    className={`relative rounded-full aspect-square overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#ffc531] ring-2 ring-[#ffc531]/40 scale-105'
                        : 'border-[#8a8ca5]/30 hover:border-[#8a8ca5] opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={av.url} alt={av.label} className="w-full h-full object-cover rounded-full" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#ffc531]/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-[#ffc531] drop-shadow-md stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Editora Favorita */}
          <div>
            <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-2">
              Editora ou Linha Favorita
            </label>
            <div className="flex flex-wrap gap-2">
              {publishers.map((pub) => {
                const isSelected = favoritePublisher === pub;
                return (
                  <button
                    key={pub}
                    type="button"
                    onClick={() => setFavoritePublisher(pub)}
                    className={`px-3 py-1.5 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-all cursor-pointer ${
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

          {/* 4. Breve Bio / Lema */}
          <div>
            <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-1.5">
              Lema de Leitor / Bio (Opcional)
            </label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ex: Colecionador e leitor de clássicos"
              className="w-full px-3.5 py-2 bg-[#12121f] border border-[#8a8ca5]/30 rounded-[4px] text-xs text-[#f4ebd8] placeholder-[#8a8ca5]/50 focus:border-[#ffc531] focus:outline-none"
            />
          </div>

          {/* Initial Status Preview */}
          <div className="bg-[#12121f] p-3 rounded-[4px] border border-[#ffc531]/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-[4px] bg-[#ffc531]/10 border border-[#ffc531]/30 flex items-center justify-center text-[#ffc531] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-anton uppercase text-[#ffc531] block">
                Status Inicial • Zero Revistas
              </span>
              <p className="text-xs text-[#8a8ca5]">
                Seu selo começará em <strong className="text-[#f4ebd8]">SELO INICIANTE</strong> e evoluirá conforme você realizar suas leituras de quadrinhos.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-sm tracking-wider uppercase rounded-[4px] border border-[#ffc531] transition-all cursor-pointer shadow-xl flex items-center justify-center gap-2 active:scale-98"
          >
            <BookOpen className="w-4 h-4 text-[#ffc531]" />
            <span>CRIAR MEU PERFIL &amp; ACESSAR O APP</span>
          </button>
        </form>
      </div>
    </div>
  );
};
