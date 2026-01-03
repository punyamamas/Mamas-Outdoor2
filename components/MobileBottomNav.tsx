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
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-6 z-40 md:hidden pb-safe">
      <div className="flex justify-between items-center">
        
        <button 
          onClick={scrollToTop}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-nature-600 transition group"
        >
          <div className="p-1 rounded-xl group-active:bg-nature-50">
             <Home size={24} className={activeTab === 'home' ? 'text-nature-600 fill-current' : ''} />
          </div>
          <span className="text-[10px] font-bold">Beranda</span>
        </button>

        <button 
          onClick={scrollToKatalog}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-nature-600 transition group"
        >
          <div className="p-1 rounded-xl group-active:bg-nature-50">
             <Search size={24} />
          </div>
          <span className="text-[10px] font-bold">Katalog</span>
        </button>

        <button 
          onClick={onOpenCart}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-nature-600 transition group relative"
        >
          <div className="p-1 rounded-xl group-active:bg-nature-50 relative">
             <ShoppingBag size={24} />
             {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-nature-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-bounce">
                  {cartCount}
                </span>
             )}
          </div>
          <span className="text-[10px] font-bold">Keranjang</span>
        </button>

        <button 
          onClick={onOpenHistory}
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-nature-600 transition group"
        >
          <div className="p-1 rounded-xl group-active:bg-nature-50">
             <History size={24} />
          </div>
          <span className="text-[10px] font-bold">Riwayat</span>
        </button>

      </div>
    </div>
  );
};

export default MobileBottomNav;