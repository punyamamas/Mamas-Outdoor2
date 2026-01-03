
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import HistoryDrawer from './components/HistoryDrawer';
import GeminiAdvisor from './components/GeminiAdvisor';
import TermsModal from './components/TermsModal';
import { AdminDashboard } from './components/AdminDashboard';
import ProductDetailModal from './components/ProductDetailModal';
import Toast from './components/Toast'; 
import ImageLoader from './components/ImageLoader'; 
import { PRODUCTS, CATEGORIES as CONSTANT_CATEGORIES } from './constants'; 
import { CartItem, Product, Category, Transaction } from './types';
import { getProducts, addProduct, updateProduct, deleteProduct } from './services/productService';
import { getCategories, addCategory, updateCategory, deleteCategory } from './services/categoryService';
import { getActiveTransactions } from './services/transactionService'; 
import { MapPin, Star, Plus, Check, School, Github, Loader2, Flame, Lock, Calendar, Users, ArrowRight as ArrowIcon, ChevronDown, ShieldCheck, Zap, ShoppingCart, Info, Weight, Tent, Wind, ArrowUpDown, Search, XCircle, ShoppingBag, ClipboardList, MessageCircle, Truck, CalendarCheck, CalendarDays, Clock } from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'admin'>('home');
  const [products, setProducts] = useState<Product[]>([]); 
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); 
  const [isLoading, setIsLoading] = useState(true); 
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price_low' | 'price_high' | 'name'>('default');
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // --- AVAILABILITY STATE ---
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkDuration, setCheckDuration] = useState(2);

  const fetchData = async () => {
    if (products.length === 0) setIsLoading(true);
    try {
      const [productsData, categoriesData, transactionsData] = await Promise.all([
        getProducts(),
        getCategories(),
        getActiveTransactions() // Fetch only active for lightweight initial load
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error("Failed to load data", error);
      setProducts(PRODUCTS); 
      const fallbackCats = CONSTANT_CATEGORIES
        .filter(c => c !== 'Semua')
        .map((name, idx) => ({ id: (idx + 1).toString(), name }));
      setCategories(fallbackCats);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const savedCart = localStorage.getItem('mamasCart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (parsed.length > 0 && parsed[0].price2Days === undefined) {
          setCartItems([]);
          localStorage.removeItem('mamasCart');
        } else {
          setCartItems(parsed);
        }
      } catch (e) {
        setCartItems([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('mamasCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const showToast = (message: string) => {
    setToast({ show: true, message });
  };

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

  const getAvailableStock = (product: Product, size?: string, color?: string): number => {
    let physicalStock = product.stock;

    if (product.variants && product.variants.length > 0 && size && color) {
      const variant = product.variants.find(v => v.size === size && v.color === color);
      physicalStock = variant ? variant.stock : 0;
    } else if (product.sizes && size && Object.keys(product.sizes).length > 0) {
       physicalStock = product.sizes[size] || 0;
    }

    if (product.packageItems && product.packageItems.length > 0) {
        const possibleStocks = product.packageItems.map(pi => {
            const child = products.find(p => p.id === pi.productId);
            if (!child) return 0;
            const childBooked = bookedStockMap[child.id] || 0;
            const childPhysical = child.stock;
            const childAvailable = Math.max(0, childPhysical - childBooked);
            return Math.floor(childAvailable / pi.quantity);
        });
        physicalStock = possibleStocks.length > 0 ? Math.min(...possibleStocks) : 0;
    } 
    else {
        const bookedQty = bookedStockMap[product.id] || 0;
        physicalStock = Math.max(0, physicalStock - bookedQty);
    }
    return physicalStock;
  };

  const addToCart = (product: Product, selectedSize?: string, selectedColor?: string) => {
    const maxStock = getAvailableStock(product, selectedSize, selectedColor);
    const existingItem = cartItems.find(item => 
      item.id === product.id && 
      item.selectedSize === selectedSize &&
      item.selectedColor === selectedColor
    );
    const currentQtyInCart = existingItem ? existingItem.quantity : 0;

    if (currentQtyInCart + 1 > maxStock) {
      showToast(`Ups! Untuk tanggal ${checkDate}, sisa stok hanya ${maxStock} unit.`);
      return;
    }

    setCartItems(prev => {
      if (existingItem) {
        const newItems = [...prev];
        const index = prev.indexOf(existingItem);
        newItems[index] = { ...existingItem, quantity: existingItem.quantity + 1 };
        return newItems;
      }
      return [...prev, { ...product, quantity: 1, selectedSize, selectedColor }];
    });
    
    showToast(`${product.name} berhasil masuk keranjang!`);
  };

  const addRecommendedToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const hasSize = product.sizes && Object.keys(product.sizes).length > 0;
      const hasColor = product.colors && product.colors.length > 0;
      const hasVariants = product.variants && product.variants.length > 0;
      
      if (hasSize || hasColor || hasVariants) {
        setViewingProduct(product);
      } else {
        addToCart(product);
      }
    }
  };

  const updateQuantity = (id: string, delta: number, size?: string, color?: string) => {
    if (delta > 0) {
      const itemInCart = cartItems.find(i => i.id === id && i.selectedSize === size && i.selectedColor === color);
      if (itemInCart) {
        const originalProduct = products.find(p => p.id === id);
        if(originalProduct) {
            const maxStock = getAvailableStock(originalProduct, size, color);
            if (itemInCart.quantity + delta > maxStock) {
              showToast(`Maksimal stok tercapai (${maxStock} unit)`);
              return;
            }
        }
      }
    }
    setCartItems(prev => prev.map(item => {
      if (item.id === id && item.selectedSize === size && item.selectedColor === color) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeItem = (id: string, size?: string, color?: string) => {
    setCartItems(prev => prev.filter(item => 
      !(item.id === id && item.selectedSize === size && item.selectedColor === color)
    ));
  };

  const clearCart = () => setCartItems([]);

  // --- Handlers ---
  const handleAddProduct = async (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    const savedProduct = await addProduct(newProduct);
    if (savedProduct) setProducts(prev => prev.map(p => p.id === newProduct.id ? savedProduct : p));
    else fetchData();
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    await updateProduct(updatedProduct);
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus produk ini?')) {
      const success = await deleteProduct(id);
      if (success) setProducts(prev => prev.filter(p => p.id !== id));
      else fetchData();
    }
  };

  const handleAddCategory = async (name: string) => {
    const newCat = await addCategory(name);
    if (newCat) setCategories(prev => [...prev, newCat]);
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    const updated = await updateCategory(id, name);
    if (updated) setCategories(prev => prev.map(c => c.id === id ? updated : c));
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Yakin hapus kategori?')) {
      const success = await deleteCategory(id);
      if (success) setCategories(prev => prev.filter(c => c.id !== id));
    }
  };

  if (currentPage === 'admin') {
    return (
      <AdminDashboard 
        products={products}
        categories={categories}
        transactions={transactions}
        onBackToHome={() => setCurrentPage('home')}
        onAddProduct={handleAddProduct}
        onUpdateProduct={handleUpdateProduct}
        onDeleteProduct={handleDeleteProduct}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onRefresh={fetchData}
      />
    );
  }

  // --- Filter & Sort ---
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price_low': return (a.isSale ? (a.salePrice||0) : a.price2Days) - (b.isSale ? (b.salePrice||0) : b.price2Days);
      case 'price_high': return (b.isSale ? (b.salePrice||0) : b.price2Days) - (a.isSale ? (a.salePrice||0) : a.price2Days);
      case 'name': return a.name.localeCompare(b.name);
      case 'default':
      default:
        const idxA = CONSTANT_CATEGORIES.indexOf(a.category);
        const idxB = CONSTANT_CATEGORIES.indexOf(b.category);
        if (idxA !== idxB) {
          const validIdxA = idxA === -1 ? 999 : idxA;
          const validIdxB = idxB === -1 ? 999 : idxB;
          return validIdxA - validIdxB;
        }
        return a.name.localeCompare(b.name);
    }
  });

  const getProductFeatures = (category: string) => {
    const catLower = category.toLowerCase();
    if (catLower.includes('tenda')) return <div className="flex items-center gap-1"><Tent size={14} /> <span>Waterproof</span></div>;
    if (catLower.includes('carrier') || catLower.includes('tas')) return <div className="flex items-center gap-1"><Weight size={14} /> <span>Backsystem</span></div>;
    if (catLower.includes('tidur') || catLower.includes('sleeping')) return <div className="flex items-center gap-1"><Wind size={14} /> <span>Warm</span></div>;
    if (catLower.includes('masak') || catLower.includes('kompor')) return <div className="flex items-center gap-1"><Flame size={14} /> <span>Portable</span></div>;
    return <div className="flex items-center gap-1"><Star size={14} /> <span>Top Tier</span></div>;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <Toast message={toast.message} isVisible={toast.show} onClose={() => setToast({ ...toast, show: false })} />

      <Navbar 
        cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenTerms={() => setIsTermsOpen(true)}
      />

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cartItems={cartItems}
        products={products} 
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
        onRefreshData={fetchData} 
      />

      <HistoryDrawer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      
      <ProductDetailModal 
        isOpen={!!viewingProduct}
        onClose={() => setViewingProduct(null)}
        product={viewingProduct}
        allProducts={products}
        onAddToCart={addToCart}
        isInCart={viewingProduct ? !!cartItems.find(i => i.id === viewingProduct.id) : false} 
      />

      {/* Hero Section WITH BOOKING WIDGET */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden py-32 group/hero">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop" 
            alt="Gunung Slamet Peak" 
            className="w-full h-full object-cover transition-transform duration-[20s] ease-in-out group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/90 via-gray-900/50 to-gray-50/10"></div>
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center items-center">
          <div className="text-center max-w-5xl mx-auto relative z-20 px-4 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 bg-nature-600/90 backdrop-blur-md px-5 py-2 rounded-full text-white text-xs md:text-sm font-bold mb-8 border border-white/10 uppercase tracking-widest shadow-xl shadow-nature-900/50 hover:bg-nature-700 hover:scale-105 transition duration-300 cursor-default">
              <Flame size={16} className="text-yellow-400 fill-current animate-pulse" />
              <span>Sewa Alat Camping Terfavorit di Purwokerto</span>
            </div>

            <h1 className="font-black text-white mb-8 tracking-tight drop-shadow-2xl">
              <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-4 hover:tracking-wide transition-all duration-500 ease-out cursor-default">
                SEWA ALAT SAT-SET
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-5xl sm:text-6xl md:text-7xl lg:text-8xl py-2 animate-gradient-x bg-[length:200%_auto] cursor-default">
                ANTI RIBET
              </span>
            </h1>

            <p className="text-lg text-gray-200 mb-10 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow-md px-4">
              Alat ready, harga friendly, liburan jadi happy. Solusi anak Purwokerto buat muncak santai tanpa drama saat naik Gunung. <span className="text-yellow-400 font-bold border-b-2 border-yellow-400/30 hover:bg-yellow-400/10 transition-colors px-1">Slamet, Prau, & Sindoro</span>.
            </p>

            {/* --- BOOKING ENGINE WIDGET --- */}
            <div className="bg-white p-2 rounded-3xl shadow-2xl border border-gray-200 w-full max-w-4xl mx-auto transform translate-y-8 animate-slide-in-right">
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
                        Spill Yang Ready
                    </button>
                </div>
            </div>
            {/* --- END BOOKING WIDGET --- */}

          </div>
        </div>
      </section>

      {/* NEW SECTION: How It Works (ENHANCED) */}
      <section className="bg-nature-50 py-20 border-b border-nature-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-nature-600 font-black tracking-widest uppercase text-sm mb-2 block">TUTORIAL SEWA</span>
            <h2 className="text-3xl font-black text-gray-900">Cara Sewa Sat-Set Anti Ribet!</h2>
            <p className="text-gray-600 mt-2">Cuma 3 step doang, langsung gas healing tanpa pusing.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-transparent hover:border-nature-200">
                <div className="w-16 h-16 bg-nature-100 rounded-2xl flex items-center justify-center mb-6 text-nature-600 group-hover:scale-110 transition">
                  <ClipboardList size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">1. Cek Stok & Pilih Alat</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Input tanggal kapan lo mau muncak di atas. Biar sistem yang milihin gear yang ready. Kalo cocok, langsung add to cart aja!
                </p>
            </div>

            <div className="relative group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-transparent hover:border-blue-200">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition">
                  <MessageCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">2. Chat MasMin (Mamas Admin)</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Klik tombol pesan, terus konfirm ke Mamas. Mamas totalin biayanya, trus DP 50% dulu biar alat inceranmu gak ditikung orang.
                </p>
            </div>

            <div className="relative group bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-transparent hover:border-green-200">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mb-6 text-green-600 group-hover:scale-110 transition">
                  <Truck size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">3. Ambil & OTW!</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Merapat ke basecamp Mamas (depan warmino WBC). Titip identitas asli, lunasin sisa sewa, langsung tancap gas naik gunung!
                </p>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="katalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
            Spill <span className="text-transparent bg-clip-text bg-gradient-to-r from-nature-600 to-red-500">Alat Andalan</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Mulai dari tenda sampe printilan kecil ada. List ini real-time sesuai tanggal main lo ya, tinggal checkout!.
          </p>
        </div>

        {/* SEARCH BAR (SIMPLE) */}
        <div className="max-w-xl mx-auto mb-8 px-4 relative group">
           <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-nature-600 transition" size={20} />
              <input
                type="text"
                placeholder="Lagi nyari apa nih? Tenda, Carrier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition text-gray-800 font-medium"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                >
                  <XCircle size={18} />
                </button>
              )}
           </div>
        </div>

        {/* Dynamic Category Filter */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 bg-gray-100 rounded-full overflow-x-auto max-w-full no-scrollbar">
            <button
               onClick={() => setSelectedCategory('Semua')}
               className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                 selectedCategory === 'Semua'
                   ? 'bg-white text-nature-600 shadow-md transform scale-105' 
                   : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
               }`}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${
                  selectedCategory === cat.name 
                    ? 'bg-white text-nature-600 shadow-md transform scale-105' 
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-gray-100 rounded-3xl h-[400px] animate-pulse"></div>
            ))}
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-gray-400" />
             </div>
             <h3 className="text-lg font-bold text-gray-700">Produk tidak ditemukan</h3>
             <p className="text-gray-500">Coba kata kunci lain atau kategori berbeda.</p>
             <button 
               onClick={() => { setSearchQuery(''); setSelectedCategory('Semua'); }}
               className="mt-4 text-nature-600 font-bold hover:underline"
             >
               Reset Filter
             </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {sortedProducts.map(product => {
              const inCart = cartItems.find(i => i.id === product.id);
              const displayPrice = product.price2Days || 0;
              const displayStock = getAvailableStock(product);

              return (
                <div 
                  key={product.id} 
                  onClick={() => setViewingProduct(product)}
                  className="group relative bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-2 flex flex-col h-full cursor-pointer"
                >
                  <div className="relative h-64 overflow-hidden bg-gray-100">
                    <ImageLoader 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-in-out" 
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition duration-300"></div>

                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end z-20">
                       {displayStock < 3 && displayStock > 0 && (
                         <span className="bg-adventure-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse uppercase tracking-wider flex items-center gap-1">
                           <Zap size={10} fill="currentColor" /> Rebutan Nih!
                         </span>
                       )}
                       <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md border border-white/20 ${
                         displayStock > 0 ? 'bg-white/90 text-nature-700' : 'bg-red-600 text-white'
                       }`}>
                         Gercep! Sisa: {displayStock}
                       </span>
                    </div>

                    <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-1">
                      <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                        {product.category}
                      </span>
                      {product.isSale && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1 border border-white/20">
                           <ShoppingBag size={10} /> DIJUAL
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <div className="mb-auto">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight group-hover:text-nature-600 transition">
                        {product.name}
                      </h3>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-gray-100">
                           {getProductFeatures(product.category)}
                        </span>
                        <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border border-gray-100">
                           <Check size={10} /> Wangi
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-50">
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                             {product.isSale ? 'Harga Beli' : 'Paket 2 Hari'}
                          </span>
                          <span className={`text-xl font-black tracking-tight ${product.isSale ? 'text-blue-600' : 'text-gray-900'}`}>
                            {product.isSale ? `Rp${(product.salePrice||0).toLocaleString('id-ID')}` : `Rp${displayPrice.toLocaleString('id-ID')}`}
                          </span>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const hasVariant = (product.sizes && Object.keys(product.sizes).length > 0) || (product.colors && product.colors.length > 0) || (product.variants && product.variants.length > 0);
                            const isPackage = product.packageItems && product.packageItems.length > 0;

                            if (hasVariant || isPackage) {
                              setViewingProduct(product);
                            } else {
                              addToCart(product);
                            }
                          }}
                          className={`
                            h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg z-10
                            ${inCart 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : product.isSale 
                                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 active:scale-95 shadow-blue-200'
                                : 'bg-nature-600 text-white hover:bg-nature-700 hover:scale-110 active:scale-95 shadow-nature-200'
                            }
                          `}
                          title={inCart ? "Sudah di keranjang" : "Tambah ke keranjang"}
                        >
                          {inCart ? <Check size={24} strokeWidth={3} /> : product.isSale ? <ShoppingBag size={20} strokeWidth={2.5}/> : <Plus size={24} strokeWidth={3} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer & Other Sections ... */}
      <section className="bg-nature-50 border-y border-nature-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-nature-200 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-adventure-200 rounded-full blur-3xl opacity-50"></div>
        <GeminiAdvisor products={products} onAddRecommended={addRecommendedToCart} />
      </section>
      
      {/* Event Section */}
      <section id="event" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
         <div className="mb-10 text-center">
          <span className="text-nature-600 font-bold tracking-widest uppercase text-sm mb-2 block">Agenda & Kegiatan</span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900">Mamas Open Trip</h2>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
            Gak punya temen nanjak? Gabung bareng komunitas Mamas Outdoor. 
            Fasilitas lengkap, guide asik, dokumentasi kece.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition duration-300">
            <div className="relative h-64 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop" 
                alt="Gunung Slamet" 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
              />
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-center shadow-lg">
                <span className="block text-xs text-gray-500 font-bold uppercase">Agustus</span>
                <span className="block text-2xl font-black text-nature-600">17</span>
              </div>
            </div>
            <div className="p-8">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-nature-600">
                <MapPin size={16} /> 
                <span>Via Bambangan</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Upacara 17 Agustus Atap Jawa Tengah</h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Rayakan kemerdekaan di puncak tertinggi Jawa Tengah (3.428 mdpl). Include transportasi PP Purwokerto, tenda, alat masak, dan porter tim.
              </p>
              <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2 text-gray-500">
                   <Users size={18} />
                   <span className="text-sm">Sisa 5 Seat</span>
                </div>
                <a href="#" className="flex items-center gap-2 text-nature-600 font-bold hover:gap-3 transition">
                  Daftar Sekarang <ArrowIcon size={18} />
                </a>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition duration-300">
            <div className="relative h-64 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1533240332313-0db49b459ad6?q=80&w=800&auto=format&fit=crop" 
                alt="Camping Ceria" 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
              />
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg text-center shadow-lg">
                <span className="block text-xs text-gray-500 font-bold uppercase">Setiap</span>
                <span className="block text-xl font-black text-nature-600">Weekend</span>
              </div>
            </div>
            <div className="p-8">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-nature-600">
                <MapPin size={16} /> 
                <span>Bukit Tranggulasih / Baturraden</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Paket Camping Ceria Anti Ribet</h3>
              <p className="text-gray-500 mb-6 leading-relaxed">
                Buat kamu yang mau healing tipis-tipis. Kami siapkan tenda berdiri, api unggun, dan jagung bakar. Datang tinggal bawa badan!
              </p>
              <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                <div className="flex items-center gap-2 text-gray-500">
                   <Users size={18} />
                   <span className="text-sm">Private Group</span>
                </div>
                <a href="#" className="flex items-center gap-2 text-nature-600 font-bold hover:gap-3 transition">
                  Booking Tanggal <ArrowIcon size={18} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white pt-20 pb-10 border-t-4 border-nature-600 scroll-mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <h2 className="text-3xl font-black mb-6 tracking-tight">Mamas<span className="text-nature-500">Outdoor</span></h2>
              <p className="text-gray-400 max-w-sm leading-relaxed text-lg">
                Partner nanjak paling asik se-Purwokerto. 
                Sedia alat tempur buat naklukin Slamet, Prau, Sindoro, Sumbing. 
                <br/><br/>
                <span className="text-white font-bold">#SalamLestari</span>
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6 text-nature-500">Services</h3>
              <ul className="space-y-3 text-gray-400 font-medium">
                <li><a href="#" className="hover:text-white transition">Sewa Tenda Dome</a></li>
                <li><a href="#" className="hover:text-white transition">Sewa Carrier</a></li>
                <li><a href="#" className="hover:text-white transition">Paket Open Trip</a></li>
                <li><button onClick={() => setCurrentPage('admin')} className="text-left hover:text-white transition text-nature-800">Admin Login</button></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-6 text-nature-500">Contact Us</h3>
              <ul className="space-y-3 text-gray-400 font-medium">
                <li>Jl. Kampus Grendeng No. 123</li>
                <li>Purwokerto Utara</li>
                <li>WA: 0812-3456-7890</li>
                <li>IG: @mamasoutdoor</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
            <p>&copy; 2024 Mamas Outdoor. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="flex items-center gap-2 hover:text-white transition">
                <Github size={18} />
                <span>Source Code</span>
              </a>
              <p className="font-medium text-nature-500">Made with ❤️ for Nature Lovers</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Helper component for arrow icon
function ArrowRight({ className, size }: { className?: string, size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

export default App;