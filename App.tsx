import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Filter, MapPin, MessageCircle, CalendarCheck, Smile, School, Sparkles, Award, Check, ThumbsUp, ShieldCheck, Instagram, Facebook, Phone, Globe, ChevronDown, Lock, CalendarDays, Clock } from 'lucide-react';
import Navbar from './components/Navbar';
import GeminiAdvisor from './components/GeminiAdvisor';
import CartDrawer from './components/CartDrawer';
import HistoryDrawer from './components/HistoryDrawer';
import TermsModal from './components/TermsModal';
import ProductDetailModal from './components/ProductDetailModal';
import { AdminDashboard } from './components/AdminDashboard';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import ImageLoader from './components/ImageLoader';
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

  // Config
  const storeConfig = getStoreConfig();

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
        // Abaikan transaksi yang batal atau selesai (barang sudah balik)
        // NOTE: Completed biasanya berarti sudah dikembalikan, jadi stok aman.
        if (trx.status === 'cancelled' || trx.status === 'completed') return;
        
        const trxStart = new Date(trx.rentalDate).getTime();
        const trxEnd = new Date(trx.rentalDate).getTime() + (trx.duration * 24 * 60 * 60 * 1000);
        
        // Cek irisan waktu (Overlapping)
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
    // 1. Paket: Cek ketersediaan item terkecil di dalamnya
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
    
    // 2. Produk Biasa / Varian
    // Catatan: Untuk varian spesifik (size/warna), logika ini menyederhanakan ke level ID produk utama
    // karena transaksi menyimpan ID produk. 
    // Idealnya booking map juga mencatat varian, tapi untuk MVP ID cukup.
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
    setIsCartOpen(true);
  };

  const handleUpdateCartQuantity = (id: string, delta: number, size?: string, color?: string) => {
    // Cek stok saat update
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

  // Product Modal Handler
  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setIsProductModalOpen(true);
  };

  // Filtering & Sorting (UPDATED: Category then Name)
  const filteredProducts = useMemo(() => {
    return products
      .filter(product => {
        const matchesCategory = activeCategory === 'Semua' || product.category === activeCategory;
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        // 1. Sort by Category
        const catCompare = a.category.localeCompare(b.category);
        if (catCompare !== 0) return catCompare;
        
        // 2. Sort by Name
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

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 scroll-smooth">
      <Navbar 
        cartCount={cartTotalItems}
        onOpenCart={() => setIsCartOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-40 overflow-hidden">
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
            <span className="inline-block px-4 py-1.5 rounded-full bg-nature-600/90 text-nature-100 text-sm font-bold mb-6 backdrop-blur-sm border border-nature-500 shadow-lg">
              #1 Sewa Alat Outdoor Purwokerto
            </span>
            <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6 tracking-tight drop-shadow-lg">
              Jelajahi Alam <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">Tanpa Batas.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-200 mb-8 leading-relaxed max-w-2xl drop-shadow-md">
              Sewa peralatan camping & hiking lengkap, bersih, dan berkualitas. 
              Siap temani petualanganmu di Gunung Slamet, Prau, dan sekitarnya.
            </p>

            {/* BUTTONS RESTORED */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
                 <a 
                   href="https://maps.google.com/?q=Mamas+Outdoor+Purwokerto" 
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center justify-center gap-2 bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg hover:-translate-y-1"
                 >
                    <MapPin size={20} /> Lihat Lokasi Gmaps
                 </a>
                 <a 
                   href={`https://wa.me/${storeConfig.adminWhatsapp}?text=Halo%20Mamas%20Outdoor,%20saya%20mau%20tanya%20sewa%20alat...`} 
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-6 py-3 rounded-xl font-bold transition backdrop-blur-sm"
                 >
                    <MessageCircle size={20} /> Chat WhatsApp
                 </a>
            </div>
          </div>

          {/* BOOKING WIDGET (RESTORED) */}
          <div className="bg-white p-3 rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl transform translate-y-8 animate-slide-in-right">
              <div className="flex flex-col md:flex-row items-center p-2 gap-2">
                  {/* Date Input */}
                  <div className="flex-1 bg-gray-50 rounded-2xl p-3 w-full border border-transparent hover:border-nature-200 transition group cursor-pointer relative">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1 block">Mulai Tanggal</label>
                      <div className="flex items-center gap-2">
                          <CalendarDays className="text-nature-600" size={20} />
                          <input 
                              type="date" 
                              className="bg-transparent font-bold text-gray-800 text-sm outline-none w-full cursor-pointer"
                              value={checkDate}
                              onChange={(e) => setCheckDate(e.target.value)}
                          />
                      </div>
                  </div>

                  {/* Duration Input */}
                  <div className="flex-1 bg-gray-50 rounded-2xl p-3 w-full border border-transparent hover:border-nature-200 transition group">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1 block">Durasi Sewa</label>
                      <div className="flex items-center gap-2">
                          <Clock className="text-nature-600" size={20} />
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

                  {/* Search Button */}
                  <button 
                      onClick={() => document.getElementById('katalog')?.scrollIntoView({ behavior: 'smooth' })}
                      className="bg-nature-600 hover:bg-nature-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all hover:scale-105 active:scale-95 w-full md:w-auto flex items-center justify-center gap-2"
                  >
                      <Search size={20} />
                      Cek Alat Ready
                  </button>
              </div>
          </div>

        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="pt-32 pb-20 bg-nature-50/50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-nature-600 font-black tracking-widest uppercase text-sm mb-2 block">KEUNGGULAN KAMI</span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">Kenapa Harus Sewa di Mamas?</h2>
            <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
              Bukan sekadar rental biasa. Berikut alasan kenapa anak-anak gunung Purwokerto langganan di sini:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <CalendarCheck size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Buka Setiap Hari</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Tanggal merah & hari libur nasional <span className="font-bold text-red-600">TETAP BUKA</span>. Nanjak kapanpun gas terus tanpa halangan.
               </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Smile size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Pelayanan Bestie</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Admin ramah, cepat, dan responsif. Enak diajak diskusi soal alat atau jalur pendakian.
               </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <MapPin size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Lokasi Strategis</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Pinggir jalan raya Grendeng. Dekat banget sama kampus UNSOED. Gampang dicari gampang dijangkau.
               </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <School size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Harga Mahasiswa</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Harga sangat kompetitif dan bersahabat untuk kantong mahasiswa & pelajar Purwokerto.
               </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Sparkles size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Bersih & Wangi</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Alat jaminan bersih, sudah dicuci, dan wangi. Tenda ga bau apek, sleeping bag higienis.
               </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Award size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Brand Ternama</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Eiger, Rei, Consina, Naturehike, dll. Stok banyak pilihan warna & model. Kualitas terjamin.
               </p>
            </div>

            {/* Feature 7 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Check size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Free Item</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Gratis sewa sajadah lipat untuk rombongan (selama persediaan ada).
               </p>
            </div>

            {/* Feature 8 */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1 group">
               <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <ThumbsUp size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Bebas Pilih</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Bebas cek, pilih, dan coba alat suka-suka saat pengambilan biar pas dan nyaman dipakai.
               </p>
            </div>

          </div>

          {/* Guarantee Note */}
          <div className="mt-12 bg-nature-600 rounded-3xl p-8 text-center text-white relative overflow-hidden shadow-xl shadow-nature-200">
             <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
             <div className="relative z-10 max-w-3xl mx-auto">
                <ShieldCheck size={48} className="mx-auto mb-4 text-yellow-400" />
                <h3 className="text-xl md:text-2xl font-black mb-4">Jaminan Kualitas Mamas Outdoor</h3>
                <p className="text-nature-100 text-sm md:text-base leading-relaxed">
                   Demi memberikan pelayanan yang terbaik, kami menjamin bahwa barang yang kami sewakan adalah <span className="text-white font-bold underline decoration-yellow-400">bersih, layak pakai, dan berkualitas</span>. 
                   Dan tentunya telah memenuhi standart keamanan demi kenyamanan bersama. Keistimewaan itu semua bisa Anda dapatkan dengan harga yang sangat kompetitif.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="katalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6">
          <div>
            <span className="text-nature-600 font-black tracking-widest uppercase text-sm mb-2 block">KATALOG ALAT</span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">Pilih Perlengkapanmu</h2>
            <p className="text-sm text-gray-500 mt-1 font-medium">Menampilkan ketersediaan untuk tanggal: <span className="text-nature-600 font-bold">{new Date(checkDate).toLocaleDateString('id-ID', {day: 'numeric', month:'long'})}</span></p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-3 text-gray-400 group-focus-within:text-nature-600 transition" size={20} />
              <input 
                type="text" 
                placeholder="Cari Tenda, Tas..." 
                className="pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none w-full sm:w-64 transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Category Dropdown (Mobile/Desktop Unified) */}
            <div className="relative group">
               <div className="absolute left-3 top-3 text-gray-400"><Filter size={20}/></div>
               <select 
                 className="pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none w-full sm:w-auto appearance-none cursor-pointer font-bold text-gray-600"
                 value={activeCategory}
                 onChange={(e) => setActiveCategory(e.target.value)}
               >
                 {['Semua', ...categories.map(c => c.name)].map(cat => (
                   <option key={cat} value={cat}>{cat}</option>
                 ))}
               </select>
               <ChevronDown className="absolute right-3 top-3 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map(product => {
             const isInCart = cartItems.some(item => item.id === product.id);
             // Calculate real-time stock
             const availableStock = getAvailableStock(product);
             const isOutOfStock = availableStock <= 0;

             return (
               <div 
                 key={product.id} 
                 className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col overflow-hidden cursor-pointer"
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
                      <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                        DIJUAL
                      </div>
                    )}
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg transform -rotate-6 shadow-lg border border-white">
                            HABIS DI TANGGAL INI
                        </span>
                      </div>
                    )}
                    {!isOutOfStock && availableStock <= 3 && (
                        <div className="absolute bottom-3 left-3 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-1 rounded shadow-sm border border-red-200">
                            Sisa {availableStock} Unit
                        </div>
                    )}
                 </div>

                 {/* Content */}
                 <div className="p-5 flex flex-col flex-1">
                    <div className="text-xs font-bold text-gray-400 mb-1">{product.category}</div>
                    <h3 className="font-bold text-gray-900 text-lg leading-tight mb-2 line-clamp-2 group-hover:text-nature-600 transition">
                      {product.name}
                    </h3>
                    
                    <div className="mt-auto pt-4 flex items-end justify-between border-t border-gray-50">
                       <div>
                          <p className="text-xs text-gray-400 font-medium">{product.isSale ? 'Harga Jual' : 'Sewa 2 Hari'}</p>
                          <p className="text-xl font-black text-nature-700">
                            Rp{product.isSale ? (product.salePrice||0).toLocaleString('id-ID') : product.price2Days.toLocaleString('id-ID')}
                          </p>
                       </div>
                       <button 
                         className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-md ${
                           isInCart 
                             ? 'bg-green-100 text-green-600' 
                             : isOutOfStock 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-nature-600 text-white hover:bg-nature-700 hover:scale-110'
                         }`}
                         onClick={(e) => {
                           e.stopPropagation();
                           if (!isOutOfStock) openProductModal(product);
                         }}
                         disabled={isOutOfStock}
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

      {/* Gemini AI Section */}
      <GeminiAdvisor products={products} onAddRecommended={(id) => {
         const p = products.find(prod => prod.id === id);
         if(p) openProductModal(p);
      }} />

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-16 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <img src="https://imgur.com/iC8ycHT.png" alt="Logo" className="w-8 h-8 grayscale brightness-200" />
                <span className="text-xl font-black tracking-tight">MamasOutdoor</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6">
                Sahabat petualanganmu di Purwokerto. Menyediakan peralatan outdoor berkualitas untuk pengalaman mendaki yang aman dan nyaman.
              </p>
              <div className="flex gap-4">
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-nature-600 transition"><Instagram size={20}/></a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-blue-600 transition"><Facebook size={20}/></a>
                <a href="#" className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center hover:bg-green-600 transition"><Phone size={20}/></a>
              </div>
            </div>
            
            <div>
              <h4 className="text-lg font-bold mb-6">Navigasi</h4>
              <ul className="space-y-3 text-gray-400">
                <li><a href="#" className="hover:text-nature-400 transition">Beranda</a></li>
                <li><a href="#katalog" className="hover:text-nature-400 transition">Katalog Alat</a></li>
                <li><a href="#ai-guide" className="hover:text-nature-400 transition">Tanya Mamas AI</a></li>
                <li><button onClick={() => setIsTermsOpen(true)} className="hover:text-nature-400 transition">Syarat & Ketentuan</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-6">Kontak & Lokasi</h4>
              <ul className="space-y-4 text-gray-400">
                <li className="flex gap-3">
                  <MapPin className="flex-shrink-0 text-nature-500" size={20} />
                  <span className="text-sm">{storeConfig.storeAddress}</span>
                </li>
                <li className="flex gap-3 items-center">
                  <Phone className="flex-shrink-0 text-nature-500" size={20} />
                  <span>{storeConfig.adminWhatsapp}</span>
                </li>
                <li className="flex gap-3 items-center">
                  <Globe className="flex-shrink-0 text-nature-500" size={20} />
                  <span>mamasoutdoor.com</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold mb-6">Jam Operasional</h4>
              <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-gray-400">Senin - Minggu</span>
                  <span className="font-bold text-white">08:30 - 22:00</span>
                </div>
                <div className="h-px bg-gray-700 my-2"></div>
                <p className="text-xs text-nature-400 italic">
                  *Buka setiap hari termasuk tanggal merah.
                </p>
              </div>
              <button 
                onClick={() => setIsAdminMode(true)}
                className="mt-6 flex items-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition"
              >
                <Lock size={12}/> Admin Login
              </button>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 text-center md:text-left flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Mamas Outdoor. All rights reserved.</p>
            <p>Made with ❤️ in Purwokerto</p>
          </div>
        </div>
      </footer>

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

      <FloatingWhatsApp />
    </div>
  );
};

export default App;