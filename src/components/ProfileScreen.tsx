import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/comic';
import { READING_MILESTONES, AVATAR_OPTIONS, updateStoredProfile } from '../services/profileService';
import {
  Trophy,
  BookOpen,
  Shield,
  HardDrive,
  Sparkles,
  Settings,
  ChevronRight,
  Award,
  Flame,
  CheckCircle2,
  Clock,
  Medal,
  Lock,
  Edit3,
  RotateCcw,
  Check,
  Cloud,
  Database,
  Zap,
  RefreshCw,
  LogIn,
  LogOut,
  Layers,
} from 'lucide-react';
import { subscribeToSyncStatus, syncLocalStateToCloud, CloudSyncStatus } from '../services/cloudSyncService';
import { auth, googleSignIn, logout } from '../services/authService';
import { getReaderStatistics } from '../services/databaseService';

interface ProfileScreenProps {
  userProfile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onResetProfile: () => void;
  onOpenCacheManager: () => void;
  onOpenRestorationModal: () => void;
  onSelectTab: (tab: any) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile,
  onUpdateProfile,
  onResetProfile,
  onOpenCacheManager,
  onOpenRestorationModal,
  onSelectTab,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editAvatar, setEditAvatar] = useState(userProfile.avatarUrl);
  const [editPublisher, setEditPublisher] = useState(userProfile.favoritePublisher || 'DC Comics');
  const [editBio, setEditBio] = useState(userProfile.bio || '');

  // Cloud & Auth State
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>({
    isCloudConnected: false,
    isSyncing: false,
    lastCloudSync: null,
    userId: null,
    pendingChangesCount: 0,
    syncError: null,
  });
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubStatus = subscribeToSyncStatus((st) => setCloudStatus(st));
    const unsubAuth = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => {
      unsubStatus();
      unsubAuth();
    };
  }, []);

  const handleGoogleConnect = async () => {
    try {
      setIsAuthenticating(true);
      setSyncFeedback(null);
      const res = await googleSignIn();
      if (res?.user) {
        setSyncFeedback('Conta conectada! Sincronizando dados com o Firebase...');
        await syncLocalStateToCloud(res.user.uid);
        setTimeout(() => setSyncFeedback(null), 4000);
      }
    } catch (err: any) {
      setSyncFeedback(`Erro ao conectar: ${err?.message || 'Falha na autenticação'}`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setSyncFeedback('Desconectado da nuvem. Os dados permanecem salvos em cache local.');
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch {}
  };

  const handleManualCloudSync = async () => {
    if (!currentUser) {
      setSyncFeedback('Conecte sua conta Google abaixo para enviar ao banco na nuvem.');
      setTimeout(() => setSyncFeedback(null), 4000);
      return;
    }
    setSyncFeedback('Sincronizando com Firestore...');
    await syncLocalStateToCloud(currentUser.uid);
    setSyncFeedback('Nuvem e Cache 100% atualizados!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  const stats = getReaderStatistics();

  const percentToNext = userProfile.nextMilestoneCount > 0
    ? Math.min(100, Math.round((userProfile.readIssuesCount / userProfile.nextMilestoneCount) * 100))
    : 100;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const updated = updateStoredProfile({
      name: editName.trim().toUpperCase(),
      avatarUrl: editAvatar,
      favoritePublisher: editPublisher,
      bio: editBio.trim(),
    });

    onUpdateProfile(updated);
    setIsEditing(false);
  };

  const publishers = ['DC Comics', 'Marvel', 'Vertigo', 'Mangás', 'Dark Horse'];

  return (
    <div className="pb-28 pt-2 max-w-2xl mx-auto px-4">
      {/* Profile Header Card */}
      <div className="bg-[#1a1a2e] rounded-[4px] border border-[#ffc531]/40 p-5 mb-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffc531]/5 rounded-bl-full pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <div className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-[#ffc531] shadow-xl flex-shrink-0">
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name}
              className="w-full h-full object-cover"
            />
            {/* Seal marker on avatar */}
            <div className="absolute -bottom-1 -right-1 bg-[#ffc531] text-[#12121f] rounded-full px-2 py-0.5 shadow-md flex items-center gap-0.5 border border-[#12121f]">
              <BookOpen className="w-3 h-3 fill-current" />
              <span className="text-[10px] font-anton font-bold leading-none">{userProfile.readIssuesCount}</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-anton text-2xl tracking-wide uppercase text-[#f4ebd8]">
                  {userProfile.name}
                </h1>
                <Medal className="w-5 h-5 text-[#ffc531]" />
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1 bg-[#12121f] hover:bg-[#22223b] border border-[#8a8ca5]/30 rounded-[3px] text-xs font-anton tracking-wider uppercase text-[#8a8ca5] hover:text-[#ffc531] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>

            {/* Selo Principal: Quantidade de Revistas Lidas */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ffc531] text-[#12121f] text-xs font-anton tracking-wider uppercase rounded-[3px] font-bold shadow-md">
              <BookOpen className="w-4 h-4 fill-current" />
              <span>{userProfile.readBadge}</span>
            </div>

            <p className="text-xs text-[#8a8ca5] mt-1.5 flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[#ffc531]" />
              {userProfile.readingMilestone} • {userProfile.favoritePublisher || 'Colecionador'}
            </p>
            {userProfile.bio && (
              <p className="text-xs text-[#f4ebd8]/70 italic mt-1 font-normal">
                "{userProfile.bio}"
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar to next Milestone Seal */}
        <div className="bg-[#12121f] rounded-[4px] p-3 border border-[#8a8ca5]/15 mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[#8a8ca5] font-semibold">
              Próximo Selo: <strong className="text-[#16e1ff] font-anton">{userProfile.nextBadgeName}</strong>
            </span>
            <span className="text-[#ffc531] font-bold">
              {userProfile.readIssuesCount} / {userProfile.nextMilestoneCount} ({percentToNext}%)
            </span>
          </div>
          <div className="w-full h-2 bg-[#22223b] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#d62839] via-[#ffc531] to-[#16e1ff] rounded-full transition-all duration-500"
              style={{ width: `${percentToNext}%` }}
            />
          </div>
          <span className="text-[10px] text-[#8a8ca5] mt-1 block">
            {userProfile.readIssuesCount >= userProfile.nextMilestoneCount
              ? 'Parabéns! Marco atingido!'
              : `Faltam ${userProfile.nextMilestoneCount - userProfile.readIssuesCount} edições lidas para avançar de patamar.`}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#8a8ca5]/20">
          <div className="bg-[#12121f] rounded-[3px] p-2.5 text-center border border-[#8a8ca5]/10">
            <span className="font-anton text-2xl text-[#f4ebd8] block leading-none">
              {userProfile.readIssuesCount}
            </span>
            <span className="text-[10px] font-anton uppercase text-[#8a8ca5] tracking-wider mt-1 block">
              Revistas Lidas
            </span>
          </div>

          <div className="bg-[#12121f] rounded-[3px] p-2.5 text-center border border-[#8a8ca5]/10">
            <span className="font-anton text-2xl text-[#ffc531] block leading-none">
              {userProfile.completedSagasCount}
            </span>
            <span className="text-[10px] font-anton uppercase text-[#8a8ca5] tracking-wider mt-1 block">
              Sagas Fechadas
            </span>
          </div>

          <div className="bg-[#12121f] rounded-[3px] p-2.5 text-center border border-[#8a8ca5]/10">
            <span className="font-anton text-2xl text-[#16e1ff] block leading-none">
              {userProfile.cachedStorageGb} GB
            </span>
            <span className="text-[10px] font-anton uppercase text-[#8a8ca5] tracking-wider mt-1 block">
              Cache Seguro
            </span>
          </div>
        </div>
      </div>

      {/* Cloud Database & Performance Cache Section */}
      <div className="bg-[#1a1a2e] rounded-[4px] border border-[#16e1ff]/30 p-4 mb-5 shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3 border-b border-[#8a8ca5]/20 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-[4px] bg-[#16e1ff]/15 text-[#16e1ff]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-anton text-sm uppercase tracking-wide text-[#f4ebd8]">
                Banco de Dados em Nuvem &amp; Cache
              </h2>
              <span className="text-[10px] text-[#8a8ca5] block">
                Google Cloud Firestore • Alta Performance &amp; Offline Multi-Tab
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]"></span>
            </span>
            <span className="text-[10px] font-anton text-[#10b981] uppercase tracking-wider">
              {currentUser ? 'NUVEM ATIVA' : 'LOCAL + CACHE'}
            </span>
          </div>
        </div>

        {/* Sync feedback notification */}
        {syncFeedback && (
          <div className="mb-3 px-3 py-1.5 bg-[#16e1ff]/10 border border-[#16e1ff]/40 rounded-[3px] text-xs text-[#16e1ff] flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Multi-Tier Caching Architecture Indicators */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-[#12121f] p-2.5 rounded-[3px] border border-[#8a8ca5]/15 text-center">
            <div className="flex items-center justify-center gap-1 text-[#ffc531] mb-1">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[11px] font-anton">0ms RAM</span>
            </div>
            <span className="text-[9px] text-[#8a8ca5] uppercase font-anton tracking-wider block">
              Cache Leitor 60FPS
            </span>
          </div>

          <div className="bg-[#12121f] p-2.5 rounded-[3px] border border-[#8a8ca5]/15 text-center">
            <div className="flex items-center justify-center gap-1 text-[#16e1ff] mb-1">
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[11px] font-anton">INDEXEDDB</span>
            </div>
            <span className="text-[9px] text-[#8a8ca5] uppercase font-anton tracking-wider block">
              Multi-Tab Offline
            </span>
          </div>

          <div className="bg-[#12121f] p-2.5 rounded-[3px] border border-[#8a8ca5]/15 text-center">
            <div className="flex items-center justify-center gap-1 text-[#10b981] mb-1">
              <Cloud className="w-3.5 h-3.5" />
              <span className="text-[11px] font-anton">FIRESTORE</span>
            </div>
            <span className="text-[9px] text-[#8a8ca5] uppercase font-anton tracking-wider block">
              Sync em Nuvem
            </span>
          </div>
        </div>

        {/* Account Authentication Banner */}
        <div className="bg-[#12121f] rounded-[4px] p-3 border border-[#8a8ca5]/20 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'Google'}
                className="w-8 h-8 rounded-full border border-[#ffc531]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#22223b] flex items-center justify-center text-[#ffc531]">
                <Cloud className="w-4 h-4" />
              </div>
            )}
            <div>
              <span className="text-xs font-anton tracking-wide text-[#f4ebd8] block">
                {currentUser ? (currentUser.displayName || currentUser.email) : 'Conta Não Vinculada à Nuvem'}
              </span>
              <span className="text-[10px] text-[#8a8ca5]">
                {currentUser
                  ? `UID: ${currentUser.uid.slice(0, 10)}... • Google Cloud Firestore`
                  : 'Faça login com sua conta Google para sincronizar entre todos os aparelhos'}
              </span>
            </div>
          </div>

          {currentUser ? (
            <button
              onClick={handleGoogleDisconnect}
              className="px-2.5 py-1.5 bg-[#1a1a2e] hover:bg-[#d62839]/20 border border-[#8a8ca5]/30 hover:border-[#d62839] rounded-[3px] text-[11px] font-anton tracking-wider uppercase text-[#8a8ca5] hover:text-[#d62839] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              Desconectar
            </button>
          ) : (
            <button
              onClick={handleGoogleConnect}
              disabled={isAuthenticating}
              className="px-3 py-1.5 bg-[#ffc531] hover:bg-[#ffb703] text-[#12121f] font-anton text-xs uppercase tracking-wider rounded-[3px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              {isAuthenticating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogIn className="w-3.5 h-3.5" />
              )}
              {isAuthenticating ? 'Conectando...' : 'Conectar Conta Google'}
            </button>
          )}
        </div>

        {/* Cloud Persistence Stat Counters & Manual Sync */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#8a8ca5]/15">
          <div className="flex items-center gap-3 text-[11px] text-[#8a8ca5]">
            <span>Progresso: <strong className="text-[#f4ebd8] font-anton">{stats.totalComicsRead} HQs</strong></span>
            <span>Favoritos: <strong className="text-[#ffc531] font-anton">{stats.totalFavorites}</strong></span>
            <span>Marcadores: <strong className="text-[#16e1ff] font-anton">{stats.totalBookmarks}</strong></span>
            <span>Avaliações: <strong className="text-[#10b981] font-anton">{stats.totalReviews}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualCloudSync}
              disabled={cloudStatus.isSyncing}
              className="px-2.5 py-1 bg-[#12121f] hover:bg-[#22223b] border border-[#16e1ff]/40 text-[#16e1ff] hover:text-[#ffc531] rounded-[3px] text-[10px] font-anton tracking-wider uppercase flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${cloudStatus.isSyncing ? 'animate-spin text-[#ffc531]' : ''}`} />
              {cloudStatus.isSyncing ? 'Sincronizando...' : 'Sincronizar Nuvem'}
            </button>
            <button
              onClick={onOpenCacheManager}
              className="px-2.5 py-1 bg-[#12121f] hover:bg-[#22223b] border border-[#8a8ca5]/30 text-[#8a8ca5] hover:text-[#f4ebd8] rounded-[3px] text-[10px] font-anton tracking-wider uppercase flex items-center gap-1 transition-colors cursor-pointer"
            >
              <HardDrive className="w-3 h-3" />
              Limpar / Ajustar Cache
            </button>
          </div>
        </div>
      </div>


      {/* Selos & Patamares de Leitura */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#ffc531] rounded-xs inline-block" />
            <h2 className="font-anton text-base tracking-wider uppercase text-[#f4ebd8]">
              PATAMARES &amp; SELOS DE LEITOR
            </h2>
          </div>
          <span className="text-xs text-[#8a8ca5] font-anton uppercase">
            {READING_MILESTONES.filter((m) => userProfile.readIssuesCount >= m.threshold).length} / {READING_MILESTONES.length} DESBLOQUEADOS
          </span>
        </div>

        <div className="space-y-2.5">
          {READING_MILESTONES.map((milestone) => {
            const isUnlocked = userProfile.readIssuesCount >= milestone.threshold;
            return (
              <div
                key={milestone.threshold}
                className={`p-3.5 rounded-[4px] border transition-all flex items-start gap-3.5 ${
                  isUnlocked
                    ? 'bg-[#1a1a2e] border-[#ffc531]/40 shadow-sm'
                    : 'bg-[#12121f] border-[#8a8ca5]/15 opacity-60'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                    isUnlocked
                      ? 'bg-[#ffc531] text-[#12121f] border-[#ffc531] shadow-md'
                      : 'bg-[#1a1a2e] text-[#8a8ca5] border-[#8a8ca5]/30'
                  }`}
                >
                  {isUnlocked ? (
                    <Trophy className="w-5 h-5 fill-current" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-anton text-xs uppercase tracking-wide text-[#f4ebd8]">
                      {milestone.badgeName}
                    </span>
                    <span className="text-[10px] font-anton tracking-wider uppercase px-2 py-0.5 rounded-[2px] bg-[#12121f] text-[#8a8ca5] border border-[#8a8ca5]/20">
                      {milestone.label}
                    </span>
                  </div>
                  <span className="text-xs text-[#ffc531] font-semibold block mb-0.5">
                    {milestone.tier}
                  </span>
                  <p className="text-[11px] text-[#8a8ca5] leading-relaxed">
                    {milestone.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile Management Actions */}
      <div className="space-y-2.5 pt-2 border-t border-[#8a8ca5]/20">
        <button
          onClick={onOpenRestorationModal}
          className="w-full flex items-center justify-between p-3.5 bg-[#1a1a2e] hover:bg-[#22223b] border border-[#8a8ca5]/20 rounded-[4px] text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#ffc531]" />
            <div>
              <span className="font-anton text-xs uppercase text-[#f4ebd8] block">
                Clube de Restauração em 4K
              </span>
              <span className="text-[11px] text-[#8a8ca5]">
                Visualizar tecnologias de restauração de cores
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#8a8ca5]" />
        </button>

        <button
          onClick={() => {
            if (window.confirm('Tem certeza de que deseja redefinir seu perfil e começar do zero com um novo nome?')) {
              onResetProfile();
            }
          }}
          className="w-full flex items-center justify-center gap-2 p-3 bg-[#12121f] hover:bg-[#d62839]/15 border border-[#d62839]/40 hover:border-[#d62839] rounded-[4px] text-xs font-anton tracking-wider uppercase text-[#d62839] transition-colors cursor-pointer mt-4"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Redefinir Perfil / Criar Novo</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-[#1a1a2e] border-2 border-[#ffc531] rounded-[6px] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-[#d62839] to-[#12121f] p-4 text-white border-b border-[#ffc531]/40 flex items-center justify-between">
              <h3 className="font-anton text-lg tracking-wide uppercase text-[#f4ebd8]">
                EDITAR MEU PERFIL
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-[#f4ebd8]/70 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-1.5">
                  Nome do Leitor
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12121f] border border-[#8a8ca5]/30 rounded-[4px] text-sm text-[#f4ebd8] focus:border-[#ffc531] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-1.5">
                  Avatar
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((av) => {
                    const isSelected = editAvatar === av.url;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => setEditAvatar(av.url)}
                        className={`relative rounded-full aspect-square overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                          isSelected
                            ? 'border-[#ffc531] ring-2 ring-[#ffc531]/40'
                            : 'border-[#8a8ca5]/30 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={av.url} alt={av.label} className="w-full h-full object-cover rounded-full" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-[#ffc531]/30 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-[#ffc531] stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-1.5">
                  Editora Favorita
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {publishers.map((pub) => (
                    <button
                      key={pub}
                      type="button"
                      onClick={() => setEditPublisher(pub)}
                      className={`px-2.5 py-1 rounded-[3px] text-xs font-anton tracking-wider uppercase transition-all cursor-pointer ${
                        editPublisher === pub
                          ? 'bg-[#ffc531] text-[#12121f] font-bold'
                          : 'bg-[#12121f] text-[#8a8ca5] border border-[#8a8ca5]/20'
                      }`}
                    >
                      {pub}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-anton tracking-wider uppercase text-[#f4ebd8] mb-1.5">
                  Bio / Lema de Leitor
                </label>
                <input
                  type="text"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full px-3 py-2 bg-[#12121f] border border-[#8a8ca5]/30 rounded-[4px] text-xs text-[#f4ebd8] focus:border-[#ffc531] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2 bg-[#12121f] hover:bg-[#22223b] text-[#8a8ca5] font-anton text-xs uppercase rounded-[4px] border border-[#8a8ca5]/30 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#d62839] hover:bg-[#b20024] text-[#f4ebd8] font-anton text-xs uppercase rounded-[4px] border border-[#ffc531] cursor-pointer shadow-md"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
