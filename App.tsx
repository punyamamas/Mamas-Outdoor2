
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Filter, MapPin, MessageCircle, CalendarCheck, Smile, School, Sparkles, Award, Check, ThumbsUp, ShieldCheck, Instagram, Facebook, Phone, Globe, ChevronDown, Lock, CalendarDays, Clock, Package, HeartHandshake, Map } from 'lucide-react';
import Navbar from './components/Navbar';
import GeminiAdvisor from './components/GeminiAdvisor';
import CartDrawer from './components/CartDrawer';
import HistoryDrawer from './components/HistoryDrawer';
import TermsModal from './components/TermsModal';
import ProductDetailModal from './components/ProductDetailModal';
import { AdminDashboard } from './components/AdminDashboard';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import ImageLoader from './components/ImageLoader';
import Toast from './components/Toast'; 
import MobileBottomNav from './components/MobileBottomNav'; 
import WhyChooseUs from './components/WhyChooseUs'; 
import AboutSection from './components/AboutSection'; 
import Footer from './components/Footer'; 
import { Product, Category, CartItem, Transaction } from './types';
import { getProducts, addProduct, updateProduct, deleteProduct } from './services/productService';
import { getCategories, addCategory, updateCategory, deleteCategory } from './services/categoryService';
import { getTransactions } from './services/transactionService';
import { getStoreConfig } from './utils/storeConfig';

const App: React.FC = () => {
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  // UI State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Availability State (Booking Engine)
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkDuration, setCheckDuration] = useState(2);

  // Modal State
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Toast State
  const [isToastOpen, setIsToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Config
  const storeConfig = getStoreConfig();

  // Helper to determine if any overlay is active
  const isOverlayOpen = isCartOpen || isHistoryOpen || isTermsOpen || isProductModalOpen;

  // Initial Data Load
  useEffect(() => {
    refreshData();
    // Load cart from local storage
    const savedCart = localStorage.getItem('mamasCart');
    if (savedCart) setCartItems(JSON.parse(savedCart));
  }, []);

  // Sync Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('mamasCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const refreshData = async () => {
    const [fetchedProducts, fetchedCategories, fetchedTransactions] = await Promise.all([
      getProducts(),
      getCategories(),
      getTransactions()
    ]);
    setProducts(fetchedProducts);
    setCategories(fetchedCategories);
    setTransactions(fetchedTransactions);
  };

  // --- REAL-TIME STOCK LOGIC ---
  const bookedStockMap = useMemo(() => {
    const bookedMap: Record<string, number> = {}; 
    const userStart = new Date(checkDate).getTime();
    const userEnd = new Date(checkDate).getTime() + (checkDuration * 24 * 60 * 60 * 1000);

    transactions.forEach(trx => {
        if (trx.status === 'cancelled' || trx.status === 'completed') return;
        
        const trxStart = new Date(trx.rentalDate).getTime();
        const trxEnd = new Date(trx.rentalDate).getTime() + (trx.duration * 24 * 60 * 60 * 1000);
        
        const isOverlapping = (userStart < trxEnd) && (userEnd > trxStart);

        if (isOverlapping) {
            trx.items.forEach(item => {
                bookedMap[item.id] = (bookedMap[item.id] || 0) + item.quantity;
            });
        }
    });
    return bookedMap;
  }, [transactions, checkDate, checkDuration]);

  const getAvailableStock = (product: Product): number => {
    if (product.packageItems && product.packageItems.length > 0) {
        const possibleStocks = product.packageItems.map(pi => {
            const child = products.find(p => p.id === pi.productId);
            if (!child) return 0;
            const childBooked = bookedStockMap[child.id] || 0;
            const childPhysical = child.stock;
            const childAvailable = Math.max(0, childPhysical - childBooked);
            return Math.floor(childAvailable / pi.quantity);
        });
        return possibleStocks.length > 0 ? Math.min(...possibleStocks) : 0;
    } 
    const bookedQty = bookedStockMap[product.id] || 0;
    return Math.max(0, product.stock - bookedQty);
  };

  // Cart Handlers
  const handleAddToCart = (product: Product, size?: string, color?: string) => {
    const available = getAvailableStock(product);
    const existingItem = cartItems.find(item => 
      item.id === product.id && item.selectedSize === size && item.selectedColor === color
    );
    const currentQty = existingItem ? existingItem.quantity : 0;

    if (currentQty + 1 > available) {
        alert(`Stok tidak cukup untuk tanggal ${checkDate}. Sisa: ${available}`);
        return;
    }

    setCartItems(prev => {
      if (existingItem) {
        return prev.map(item => 
          (item.id === product.id && item.selectedSize === size && item.selectedColor === color)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1, selectedSize: size, selectedColor: color }];
    });
    
    setIsProductModalOpen(false);
    setToastMessage(`${product.name} masuk keranjang!`);
    setIsToastOpen(true);
  };

  const handleUpdateCartQuantity = (id: string, delta: number, size?: string, color?: string) => {
    if (delta > 0) {
        const product = products.find(p => p.id === id);
        const itemInCart = cartItems.find(i => i.id === id && i.selectedSize === size && i.selectedColor === color);
        if (product && itemInCart) {
            const available = getAvailableStock(product);
            if (itemInCart.quantity + 1 > available) {
                alert("Maksimal stok tersedia tercapai");
                return;
            }
        }
    }

    setCartItems(prev => prev.map(item => {
      if (item.id === id && item.selectedSize === size && item.selectedColor === color) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (id: string, size?: string, color?: string) => {
    setCartItems(prev => prev.filter(item => !(item.id === id && item.selectedSize === size && item.selectedColor === color)));
  };

  const handleClearCart = () => setCartItems([]);

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter(product => {
        const matchesCategory = activeCategory === 'Semua' || product.category === activeCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const catCompare = a.category.localeCompare(b.category);
        if (catCompare !== 0) return catCompare;
        return a.name.localeCompare(b.name);
      });
  }, [products, activeCategory, searchTerm]);

  const cartTotalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  if (isAdminMode) {
    return (
      <AdminDashboard
        products={products}
        categories={categories}
        transactions={transactions}
        onBackToHome={() => setIsAdminMode(false)}
        onAddProduct={async (p) => { await addProduct(p); await refreshData(); }}
        onUpdateProduct={async (p) => { await updateProduct(p); await refreshData(); }}
        onDeleteProduct={async (id) => { await deleteProduct(id); await refreshData(); }}
        onAddCategory={async (n) => { await addCategory(n); await refreshData(); }}
        onUpdateCategory={async (id, n) => { await updateCategory(id, n); await refreshData(); }}
        onDeleteCategory={async (id) => { await deleteCategory(id); await refreshData(); }}
        onRefresh={refreshData}
      />
    );
  }

  // Generate Pill Categories (Static 'Semua' + dynamic)
  const categoryPills = ['Semua', ...categories.map(c => c.name)];

  return (
    // Updated padding-bottom to 32 (128px) to clear floating buttons and safe area
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 scroll-smooth pb-32 md:pb-0">
      
      {/* HIDE DESKTOP NAVBAR ON MOBILE (Since we have bottom nav) but keep Logo visible via custom header or simplified nav */}
      <div className="hidden md:block">
        <Navbar 
            cartCount={cartTotalItems}
            onOpenCart={() => setIsCartOpen(true)}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            isMobileMenuOpen={isMobileMenuOpen}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
        />
      </div>

      {/* MOBILE HEADER (IMPROVED: Shows Selected Date Context) */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md z-50 border-b border-gray-100 shadow-sm transition-all duration-300">
         <div className="flex justify-between items-center px-4 py-2.5">
            <div className="flex items-center gap-2" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
                <img src="https://imgur.com/iC8ycHT.png" alt="Logo" className="w-8 h-8"/>
                <div>
                    <span className="font-extrabold text-base text-gray-900 leading-none block">Mamas<span className="text-nature-600">Outdoor</span></span>
                    {/* Booking Context Indicator */}
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium leading-none mt-0.5">
                        <CalendarDays size={10} className="text-nature-600"/>
                        <span>Sewa: {new Date(checkDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'})} ({checkDuration} Hari)</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isAdminMode ? null : (
                    <button 
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} // Scroll to Hero to change date
                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1 border border-gray-200"
                    >
                        <Clock size={12}/> Ganti Tgl
                    </button>
                )}
                {isAdminMode ? null : <button onClick={() => setIsAdminMode(true)} className="p-1"><Lock size={16} className="text-gray-300"/></button>}
            </div>
         </div>
      </div>

      {/* Hero Section - UPDATED PADDING FOR TABLET */}
      <section className="relative pt-24 pb-12 md:pt-36 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <ImageLoader 
            src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80" 
            alt="Camping Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-gray-900/40"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl animate-slide-in-right text-white mb-8">
            <span className="inline-block px-4 py-1.5 rounded-full bg-nature-600/90 text-nature-100 text-xs md:text-sm font-bold mb-4 md:mb-6 backdrop-blur-sm border border-nature-500 shadow-lg">
              #1 Sewa Alat Outdoor Purwokerto
            </span>
            <h1 className="text-3xl md:text-6xl font-black leading-tight mb-4 md:mb-6 tracking-tight drop-shadow-lg">
              Jelajahi Alam <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">Tanpa Batas.</span>
            </h1>
            <p className="text-sm md:text-xl text-gray-200 mb-6 md:mb-8 leading-relaxed max-w-2xl drop-shadow-md">
              Sewa peralatan camping & hiking lengkap, bersih, dan berkualitas. 
              Siap temani petualanganmu di Gunung Slamet, Prau, dan sekitarnya.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                 <a 
                   href="https://maps.google.com/?q=Mamas+Outdoor+Purwokerto" 
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center justify-center gap-2 bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg text-sm md:text-base"
                 >
                    <MapPin size={18} /> Lihat Lokasi Gmaps
                 </a>
            </div>
          </div>

          {/* BOOKING WIDGET (Compact on Mobile) */}
          <div className="bg-white p-3 rounded-2xl md:rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl transform translate-y-4 md:translate-y-8 animate-slide-in-right">
              <div className="flex flex-col md:flex-row items-center p-1 md:p-2 gap-2">
                  {/* Date Input */}
                  <div className="flex-1 bg-gray-50 rounded-xl md:rounded-2xl p-2 md:p-3 w-full border border-transparent cursor-pointer">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1 block">Mulai Tanggal</label>
                      <div className="flex items-center gap-2">
                          <CalendarDays className="text-nature-600" size={18} />
                          <input 
                              type="date" 
                              className="bg-transparent font-bold text-gray-800 text-sm outline-none w-full cursor-pointer"
                              value={checkDate}
                              onChange={(e) => setCheckDate(e.target.value)}
                          />
                      </div>
                  </div>

                  {/* Duration Input */}
                  <div className="flex-1 bg-gray-50 rounded-xl md:rounded-2xl p-2 md:p-3 w-full border border-transparent">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1 block">Durasi Sewa</label>
                      <div className="flex items-center gap-2">
                          <Clock className="text-nature-600" size={18} />
                          <select 
                              className="bg-transparent font-bold text-gray-800 text-sm outline-none w-full cursor-pointer appearance-none"
                              value={checkDuration}
                              onChange={(e) => setCheckDuration(Number(e.target.value))}
                          >
                              <option value={2}>2 Hari (Minimal)</option>
                              <option value={3}>3 Hari</option>
                              <option value={4}>4 Hari</option>
                              <option value={5}>5 Hari (Santai)</option>
                              <option value={6}>6 Hari</option>
                              <option value={7}>7 Hari (Seminggu)</option>
                          </select>
                          <ChevronDown size={16} className="text-gray-400"/>
                      </div>
                  </div>

                  <button 
                      onClick={() => document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' })}
                      className="bg-nature-600 hover:bg-nature-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-xl md:rounded-2xl shadow-lg transition-all w-full md:w-auto flex items-center justify-center gap-2 text-sm md:text-base"
                  >
                      <Search size={18} />
                      Cek Alat Ready
                  </button>
              </div>
          </div>

        </div>
      </section>

      {/* Catalog Section */}
      <section id="katalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 bg-white min-h-screen">
        <div className="flex flex-col md:flex-row justify-between items-end mb-6 md:mb-10 gap-4 md:gap-6">
          <div className="w-full md:w-auto">
            <span className="text-nature-600 font-black tracking-widest uppercase text-xs md:text-sm mb-2 block">KATALOG ALAT</span>
            <h2 className="text-2xl md:text-4xl font-black text-gray-900">Pilih Perlengkapanmu</h2>
            <p className="text-xs md:text-sm text-gray-500 mt-1 font-medium">Stok tersedia untuk: <span className="text-nature-600 font-bold">{new Date(checkDate).toLocaleDateString('id-ID', {day: 'numeric', month:'long'})}</span></p>
          </div>
          
          <div className="w-full md:w-auto space-y-4">
            {/* Search */}
            <div className="relative group w-full">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Cari Tenda, Tas..." 
                className="pl-10 pr-4 py-2.5 md:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none w-full md:w-64 transition text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* STICKY CATEGORY PILLS (IMPROVED WITH SNAP & SCROLL PADDING) */}
        <div className="sticky top-[53px] md:static z-40 bg-white/95 backdrop-blur-sm -mx-4 px-4 md:mx-0 md:px-0 py-3 mb-6 shadow-sm md:shadow-none border-b border-gray-100 md:border-none">
            <div className="overflow-x-auto no-scrollbar snap-x snap-mandatory">
                <div className="flex gap-2 w-max">
                    {categoryPills.map(cat => (
                        <button
                            key={cat}
                            onClick={() => {
                                setActiveCategory(cat);
                                window.scrollTo({ top: document.getElementById('katalog')?.offsetTop ? document.getElementById('katalog')!.offsetTop - 120 : 0, behavior: 'smooth' });
                            }}
                            className={`
                                snap-center px-4 py-2 rounded-full text-xs md:text-sm font-bold whitespace-nowrap transition-all
                                ${activeCategory === cat 
                                    ? 'bg-nature-600 text-white shadow-md shadow-nature-200 scale-105' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'}
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* Product Grid - OPTIMIZED FOR TABLETS (md:grid-cols-3) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
          {filteredProducts.map(product => {
             const isInCart = cartItems.some(item => item.id === product.id);
             const availableStock = getAvailableStock(product);
             const isOutOfStock = availableStock <= 0;
             const hasVariants = (product.colors && product.colors.length > 0) || (product.sizes && Object.keys(product.sizes).length > 0) || (product.variants && product.variants.length > 0);

             return (
               <div 
                 key={product.id} 
                 className="bg-white rounded-xl md:rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col overflow-hidden cursor-pointer active:scale-95 md:active:scale-100"
                 onClick={() => openProductModal(product)}
               >
                 {/* Image */}
                 <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                    <ImageLoader 
                      src={product.image} 
                      alt={product.name} 
                      className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${isOutOfStock ? 'grayscale' : ''}`}
                    />
                    {product.isSale && (
                      <div className="absolute top-2 right-2 md:top-3 md:right-3 bg-blue-600 text-white text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-lg">
                        DIJUAL
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-600 text-white font-bold text-[10px] md:text-sm px-2 py-1 rounded shadow-lg border border-white -rotate-6">
                            HABIS
                        </span>
                      </div>
                    )}
                    {!isOutOfStock && (
                        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 md:px-2 md:py-1 rounded text-[9px] md:text-[10px] font-bold shadow-sm border border-gray-100 flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${availableStock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-gray-700">Sisa {availableStock}</span>
                        </div>
                    )}
                 </div>

                 {/* Content */}
                 <div className="p-3 md:p-5 flex flex-col flex-1">
                    <div className="text-[10px] md:text-xs font-bold text-gray-400 mb-0.5 md:mb-1">{product.category}</div>
                    <h3 className="font-bold text-gray-900 text-sm md:text-lg leading-tight mb-2 line-clamp-2 group-hover:text-nature-600 transition">
                      {product.name}
                    </h3>
                    
                    <div className="mt-auto pt-2 md:pt-4 flex items-end justify-between border-t border-gray-50">
                       <div>
                          <p className="text-[10px] md:text-xs text-gray-400 font-medium">{product.isSale ? 'Harga Jual' : 'Sewa 2 Hari'}</p>
                          <p className="text-sm md:text-xl font-black text-nature-700">
                            Rp{product.isSale ? (product.salePrice||0).toLocaleString('id-ID') : product.price2Days.toLocaleString('id-ID')}
                          </p>
                       </div>
                       
                       {/* Enhanced Mobile Button: 40px minimum touch target */}
                       <button 
                         className={`w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center transition shadow-md ${
                           isInCart 
                             ? 'bg-green-100 text-green-600' 
                             : isOutOfStock 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-nature-600 text-white hover:bg-nature-700 active:bg-nature-800'
                         }`}
                         onClick={(e) => {
                           e.stopPropagation();
                           if (!isOutOfStock) {
                               if (hasVariants) openProductModal(product);
                               else handleAddToCart(product);
                           }
                         }}
                         disabled={isOutOfStock}
                         aria-label={isInCart ? "Sudah di keranjang" : "Tambah ke keranjang"}
                       >
                         {isInCart ? <Check size={20} /> : <ShoppingCart size={20} />}
                       </button>
                    </div>
                 </div>
               </div>
             )
          })}
        </div>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
              <Search size={40} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Produk tidak ditemukan</h3>
            <p className="text-gray-500">Coba cari dengan kata kunci lain atau kategori berbeda.</p>
          </div>
        )}
      </section>

      {/* WHY CHOOSE US (ADDED BACK) */}
      <WhyChooseUs />

      {/* Gemini AI Section */}
      <GeminiAdvisor products={products} onAddRecommended={(id) => {
         const p = products.find(prod => prod.id === id);
         if(p) openProductModal(p);
      }} />

      {/* About Section (REDESIGNED) */}
      <AboutSection />

      {/* Footer (IMPROVED PADDING) */}
      <Footer />

      {/* MOBILE BOTTOM NAV */}
      <MobileBottomNav 
        cartCount={cartTotalItems}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        activeTab="home"
      />

      {/* Modals */}
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        products={products}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onRefreshData={refreshData}
      />
      
      <HistoryDrawer 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      <TermsModal 
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
      />

      <ProductDetailModal 
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProduct}
        allProducts={products}
        onAddToCart={handleAddToCart}
        isInCart={selectedProduct ? cartItems.some(item => item.id === selectedProduct.id) : false}
      />

      {/* Conditionally Render Floating WA Button */}
      {!isOverlayOpen && (
        <div className="mb-16 md:mb-0">
          <FloatingWhatsApp />
        </div>
      )}
      
      <Toast 
        message={toastMessage} 
        isVisible={isToastOpen} 
        onClose={() => setIsToastOpen(false)} 
      />
    </div>
  );
};

export default App;
