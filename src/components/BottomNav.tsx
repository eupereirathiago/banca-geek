import React from 'react';
import { Home, Compass, BookOpen, Library, User } from 'lucide-react';

export type TabType = 'inicio' | 'sagas' | 'ler' | 'estante' | 'perfil';

interface BottomNavProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  hasActiveReading?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12121f]/95 backdrop-blur-md border-t border-[#8a8ca5]/20 py-1.5 px-3">
      <div className="max-w-lg mx-auto flex items-center justify-around">
        {/* INÍCIO */}
        <button
          onClick={() => onSelectTab('inicio')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors ${
            currentTab === 'inicio' ? 'text-[#ffc531]' : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-anton tracking-wider uppercase mt-1">INÍCIO</span>
        </button>

        {/* SAGAS */}
        <button
          onClick={() => onSelectTab('sagas')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors ${
            currentTab === 'sagas' ? 'text-[#ffc531]' : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-anton tracking-wider uppercase mt-1">SAGAS</span>
        </button>

        {/* LER - Highlighted Center Action Pill */}
        <button
          onClick={() => onSelectTab('ler')}
          className={`relative -top-2 flex flex-col items-center justify-center px-4 py-1.5 rounded-[4px] cursor-pointer shadow-lg transition-transform active:scale-95 ${
            currentTab === 'ler'
              ? 'bg-[#d62839] text-[#f4ebd8] ring-2 ring-[#ffc531]'
              : 'bg-[#d62839] text-[#f4ebd8] hover:bg-[#b20024] border border-[#ffc531]/60'
          }`}
        >
          <BookOpen className="w-5 h-5 fill-current" />
          <span className="text-[10px] font-anton tracking-widest uppercase mt-0.5 font-bold">
            LER
          </span>
        </button>

        {/* ESTANTE */}
        <button
          onClick={() => onSelectTab('estante')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors ${
            currentTab === 'estante' ? 'text-[#ffc531]' : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
          }`}
        >
          <Library className="w-5 h-5" />
          <span className="text-[10px] font-anton tracking-wider uppercase mt-1">ESTANTE</span>
        </button>

        {/* PERFIL */}
        <button
          onClick={() => onSelectTab('perfil')}
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors ${
            currentTab === 'perfil' ? 'text-[#ffc531]' : 'text-[#8a8ca5] hover:text-[#f4ebd8]'
          }`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-anton tracking-wider uppercase mt-1">PERFIL</span>
        </button>
      </div>
    </nav>
  );
};
