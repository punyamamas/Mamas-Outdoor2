import React, { useState, useEffect } from 'react';
import { Mountain, ShoppingBag, Menu, X, History, FileText, Calendar, Phone, Sparkles, ChevronRight } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
  onOpenHistory: () => void;
  onOpenTerms: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onOpenCart, onToggleMobileMenu, isMobileMenuOpen, onOpenHistory, onOpenTerms }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  // Deteksi scroll untuk memberikan efek shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
          isScrolled 
            ? 'bg-white/90 backdrop-blur-md shadow-md py-2' 
            : 'bg-white/50 backdrop-blur-sm py-4 border-b border-white/20'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            
            {/* Logo Section */}
            <div 
              className="flex items-center gap-2.5 cursor-pointer group" 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className="bg-gradient-to-br from-nature-600 to-nature-800 p-2.5 rounded-xl text-white shadow-lg shadow-nature-200 group-hover:rotate-12 transition-transform duration-300">
                <Mountain size={24} strokeWidth={2.5} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-none group-hover:text-nature-700 transition-colors">
                  Mamas<span className="text-nature-600">Outdoor</span>
                </h1>
                <p className="text-[10px] text-gray-500 font-bold tracking-[0.2em] uppercase mt-0.5">Rental & Adventure</p>
              </div>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-1 bg-white/50 p-1.5 rounded-full border border-gray-100 shadow-sm backdrop-blur-md">
              <NavLink href="#" label="Beranda" />
              <NavLink href="#katalog" label="Katalog" />
              <NavLink href="#event" label="Event" />
              <NavLink href="#contact" label="Kontak" />
              
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
              
              <a 
                href="#ai-guide" 
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold text-gray-600 hover:text-adventure-600 hover:bg-yellow-50 transition-all"
              >
                <Sparkles size={16} /> AI Guide
              </a>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Desktop CTA Button */}
              <button 
                onClick={onOpenTerms} 
                className="hidden md:flex bg-nature-600 hover:bg-nature-700 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg shadow-nature-200 transition-all hover:scale-105 active:scale-95 items-center gap-2"
              >
                <FileText size={16} /> Sewa Sekarang
              </button>

              {/* History Button */}
              <button 
                onClick={onOpenHistory}
                className="p-2.5 text-gray-500 hover:text-nature-600 hover:bg-nature-50 rounded-full transition-all hidden sm:flex relative group"
                title="Riwayat Sewa"
              >
                <History size={22} />
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none">Riwayat</span>
              </button>

              {/* Cart Button */}
              <button 
                onClick={onOpenCart}
                className="relative p-2.5 bg-white hover:bg-nature-50 text-gray-700 hover:text-nature-700 rounded-full transition-all border border-gray-100 shadow-sm group"
              >
                <ShoppingBag size={22} className="group-hover:scale-110 transition-transform" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-adventure-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-bounce">
                    {cartCount}
                  </span>
                )}
              </button>

              {/* Mobile Menu Toggle */}
              <button 
                onClick={onToggleMobileMenu} 
                className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onToggleMobileMenu}></div>
          <div className="absolute top-16 left-0 right-0 bg-white shadow-2xl rounded-b-3xl overflow-hidden animate-slide-in-right origin-top">
            <div className="p-6 space-y-2">
              <MobileNavLink onClick={onToggleMobileMenu} href="#" icon={<Mountain size={18} />} label="Beranda" />
              <MobileNavLink onClick={onToggleMobileMenu} href="#katalog" icon={<ShoppingBag size={18} />} label="Katalog Alat" />
              <MobileNavLink onClick={onToggleMobileMenu} href="#event" icon={<Calendar size={18} />} label="Event & Open Trip" />
              <MobileNavLink onClick={onToggleMobileMenu} href="#ai-guide" icon={<Sparkles size={18} />} label="Tanya AI Assistant" highlight />
              
              <hr className="border-gray-100 my-2" />
              
              <button 
                onClick={() => { onOpenTerms(); onToggleMobileMenu(); }} 
                className="w-full flex items-center justify-between p-3 rounded-xl bg-nature-50 text-nature-700 font-bold"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} /> Syarat Sewa
                </div>
                <ChevronRight size={16} />
              </button>
              
              <button 
                onClick={() => { onOpenHistory(); onToggleMobileMenu(); }} 
                className="w-full flex items-center justify-between p-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <History size={18} /> Riwayat Sewa
                </div>
              </button>
              
              <a 
                href="#contact" 
                onClick={onToggleMobileMenu} 
                className="w-full flex items-center justify-between p-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <Phone size={18} /> Hubungi Kami
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper Component untuk Link Desktop
const NavLink = ({ href, label }: { href: string, label: string }) => (
  <a 
    href={href} 
    className="px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:text-nature-700 hover:bg-nature-50 transition-all duration-300"
  >
    {label}
  </a>
);

// Helper Component untuk Link Mobile
const MobileNavLink = ({ onClick, href, icon, label, highlight = false }: { onClick: () => void, href: string, icon: React.ReactNode, label: string, highlight?: boolean }) => (
  <a 
    href={href} 
    onClick={onClick} 
    className={`flex items-center justify-between p-3 rounded-xl transition ${
      highlight 
        ? 'bg-yellow-50 text-yellow-700 font-bold border border-yellow-100' 
        : 'text-gray-600 font-medium hover:bg-gray-50'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon} {label}
    </div>
  </a>
);

export default Navbar;