
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
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-gray-200/50 py-3 px-6 z-50 md:hidden pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center max-w-sm mx-auto">
        
        <button 
          onClick={scrollToTop}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-nature-600 transition group w-12"
        >
          <div className={`p-1.5 rounded-xl transition-all duration-300 ${activeTab === 'home' ? 'bg-nature-50 text-nature-600 scale-110' : 'group-active:scale-95'}`}>
             <Home size={22} className={activeTab === 'home' ? 'fill-current' : ''} />
          </div>
          <span className={`text-[9px] font-bold ${activeTab === 'home' ? 'text-nature-600' : ''}`}>Beranda</span>
        </button>

        <button 
          onClick={scrollToKatalog}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-nature-600 transition group w-12"
        >
          <div className="p-1.5 rounded-xl group-active:bg-nature-50 group-active:scale-95 transition-all duration-300">
             <Search size={22} />
          </div>
          <span className="text-[9px] font-bold">Katalog</span>
        </button>

        <button 
          onClick={onOpenCart}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-nature-600 transition group relative w-12"
        >
          <div className="p-1.5 rounded-xl group-active:bg-nature-50 group-active:scale-95 transition-all duration-300 relative">
             <ShoppingBag size={22} />
             {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-nature-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce shadow-sm border border-white">
                  {cartCount}
                </span>
             )}
          </div>
          <span className="text-[9px] font-bold">Cart</span>
        </button>

        <button 
          onClick={onOpenHistory}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-nature-600 transition group w-12"
        >
          <div className="p-1.5 rounded-xl group-active:bg-nature-50 group-active:scale-95 transition-all duration-300">
             <History size={22} />
          </div>
          <span className="text-[9px] font-bold">Riwayat</span>
        </button>

      </div>
    </div>
  );
};

export default MobileBottomNav;
