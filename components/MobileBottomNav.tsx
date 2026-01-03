
import React from 'react';
import { Home, ShoppingBag, History, Search } from 'lucide-react';

interface MobileBottomNavProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenHistory: () => void;
  activeTab: string; // 'home' | 'katalog' | etc
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ cartCount, onOpenCart, onOpenHistory, activeTab }) => {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToKatalog = () => document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' });

  return (
    // Updated: Glassmorphism effect, pb-safe padding, and better shadow
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-gray-200/50 py-3 px-6 z-50 md:hidden pb-safe shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        
        <button 
          onClick={scrollToTop}
          className="flex flex-col items-center gap-1 group w-12 transition-all duration-300"
        >
          <div className={`p-2 rounded-2xl transition-all duration-300 ${activeTab === 'home' ? 'bg-nature-50 text-nature-600 scale-110 shadow-sm' : 'text-gray-400 group-active:scale-95'}`}>
             <Home size={22} className={activeTab === 'home' ? 'fill-current' : ''} />
          </div>
          <span className={`text-[9px] font-bold ${activeTab === 'home' ? 'text-nature-700' : 'text-gray-400'}`}>Beranda</span>
        </button>

        <button 
          onClick={scrollToKatalog}
          className="flex flex-col items-center gap-1 group w-12 transition-all duration-300"
        >
          <div className="p-2 rounded-2xl text-gray-400 group-active:bg-nature-50 group-active:text-nature-600 group-active:scale-95 transition-all duration-300">
             <Search size={22} />
          </div>
          <span className="text-[9px] font-bold text-gray-400 group-hover:text-nature-600">Katalog</span>
        </button>

        <button 
          onClick={onOpenCart}
          className="flex flex-col items-center gap-1 group w-12 transition-all duration-300 relative"
        >
          <div className="p-2 rounded-2xl text-gray-400 group-active:bg-nature-50 group-active:text-nature-600 group-active:scale-95 transition-all duration-300 relative">
             <ShoppingBag size={22} />
             {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-nature-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-sm border border-white">
                  {cartCount}
                </span>
             )}
          </div>
          <span className="text-[9px] font-bold text-gray-400 group-hover:text-nature-600">Cart</span>
        </button>

        <button 
          onClick={onOpenHistory}
          className="flex flex-col items-center gap-1 group w-12 transition-all duration-300"
        >
          <div className="p-2 rounded-2xl text-gray-400 group-active:bg-nature-50 group-active:text-nature-600 group-active:scale-95 transition-all duration-300">
             <History size={22} />
          </div>
          <span className="text-[9px] font-bold text-gray-400 group-hover:text-nature-600">Riwayat</span>
        </button>

      </div>
    </div>
  );
};

export default MobileBottomNav;
