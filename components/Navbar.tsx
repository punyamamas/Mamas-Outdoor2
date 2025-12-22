import React from 'react';
import { Mountain, ShoppingBag, Menu, X, History } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
  onOpenHistory: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onToggleMobileMenu, isMobileMenuOpen, onOpenHistory }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md shadow-sm z-50 border-b border-nature-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="bg-nature-600 p-2 rounded-lg text-white">
              <Mountain size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Mamas<span className="text-nature-600">Outdoor</span></h1>
              <p className="text-[10px] text-gray-500 font-medium tracking-wider">RENTAL ALAT CAMPING PURWOKERTO</p>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-gray-600 hover:text-nature-600 font-medium transition">Beranda</a>
            <a href="#katalog" className="text-gray-600 hover:text-nature-600 font-medium transition">Katalog</a>
            <a href="#ai-guide" className="text-gray-600 hover:text-nature-600 font-medium transition">AI Guide</a>
            
            <div className="h-6 w-px bg-gray-200 mx-2"></div>

            <button 
              onClick={onOpenHistory}
              className="text-gray-600 hover:text-nature-600 font-medium transition flex items-center gap-1"
              title="Riwayat Sewa"
            >
              <History size={20} />
              <span className="hidden lg:inline">Riwayat</span>
            </button>

            <button 
              onClick={onOpenCart}
              className="relative bg-nature-50 p-2 rounded-full hover:bg-nature-100 transition group"
            >
              <ShoppingBag className="text-nature-700" size={24} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-adventure-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-4">
             <button 
              onClick={onOpenCart}
              className="relative p-2"
            >
              <ShoppingBag className="text-gray-700" size={24} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 bg-adventure-500 text-white text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
            <button onClick={onToggleMobileMenu} className="text-gray-700">
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 pt-2 pb-6 space-y-2">
            <a href="#" className="block py-3 px-2 text-base font-medium text-gray-700 border-b border-gray-50">Beranda</a>
            <a href="#katalog" className="block py-3 px-2 text-base font-medium text-gray-700 border-b border-gray-50">Katalog Alat</a>
            <a href="#ai-guide" className="block py-3 px-2 text-base font-medium text-gray-700 border-b border-gray-50">Tanya AI Assistant</a>
            <button onClick={() => { onOpenHistory(); onToggleMobileMenu(); }} className="w-full text-left py-3 px-2 text-base font-medium text-gray-700 flex items-center gap-2">
              <History size={18} /> Riwayat Sewa
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;