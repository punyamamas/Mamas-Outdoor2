import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import HistoryDrawer from './components/HistoryDrawer';
import GeminiAdvisor from './components/GeminiAdvisor';
import TermsModal from './components/TermsModal';
import AdminDashboard from './components/AdminDashboard';
import { PRODUCTS, CATEGORIES as CONSTANT_CATEGORIES } from './constants'; 
import { CartItem, Product, Category } from './types';
import { getProducts, addProduct, updateProduct, deleteProduct } from './services/productService';
import { getCategories, addCategory, updateCategory, deleteCategory } from './services/categoryService';
import { MapPin, Star, Plus, Check, School, Github, Loader2, Flame, Lock, Calendar, Users, ArrowRight as ArrowIcon, ChevronDown, ShieldCheck, Zap, ShoppingCart, Info, Weight, Tent, Wind } from 'lucide-react';

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'admin'>('home');
  const [products, setProducts] = useState<Product[]>([]); 
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Define fetch data functions
  const fetchData = async () => {
    if (products.length === 0) setIsLoading(true);
    
    try {
      // Fetch concurrently
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories()
      ]);
      
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Failed to load data", error);
      setProducts(PRODUCTS); 
      // Fallback menggunakan daftar constant yang sudah diurutkan
      const fallbackCats = CONSTANT_CATEGORIES
        .filter(c => c !== 'Semua')
        .map((name, idx) => ({ id: (idx + 1).toString(), name }));
      setCategories(fallbackCats);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Cart Management
  useEffect(() => {
    const savedCart = localStorage.getItem('mamasCart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (parsed.length > 0 && parsed[0].price2Days === undefined) {
          console.warn("Mendeteksi format keranjang lama. Mereset keranjang.");
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

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const addRecommendedToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      addToCart(product);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // --- Product Handlers ---
  const handleAddProduct = async (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    const savedProduct = await addProduct(newProduct);
    if (savedProduct) {
       setProducts(prev => prev.map(p => p.id === newProduct.id ? savedProduct : p));
    } else {
       alert("Gagal menyimpan ke database.");
       fetchData();
    }
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    await updateProduct(updatedProduct);
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Yakin ingin menghapus produk ini?')) {
      const success = await deleteProduct(id);
      if (success) {
        setProducts(prev => prev.filter(p => p.id !== id));
      } else {
        fetchData();
      }
    }
  };

  // --- Category Handlers ---
  const handleAddCategory = async (name: string) => {
    const newCat = await addCategory(name);
    if (newCat) {
      setCategories(prev => [...prev, newCat]);
    }
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    const updated = await updateCategory(id, name);
    if (updated) {
      setCategories(prev => prev.map(c => c.id === id ? updated : c));
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (window.confirm('Yakin hapus kategori? Produk di kategori ini mungkin akan kehilangan label kategori.')) {
      const success = await deleteCategory(id);
      if (success) {
        setCategories(prev => prev.filter(c => c.id !== id));
      }
    }
  };

  if (currentPage === 'admin') {
    return (
      <AdminDashboard 
        products={products}
        categories={categories}
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

  const filteredProducts = selectedCategory === 'Semua' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const getProductFeatures = (category: string) => {
    const catLower = category.toLowerCase();
    if (catLower.includes('tenda')) return <div className="flex items-center gap-1"><Tent size={14} /> <span>Waterproof</span></div>;
    if (catLower.includes('carrier') || catLower.includes('tas')) return <div className="flex items-center gap-1"><Weight size={14} /> <span>Backsystem</span></div>;
    if (catLower.includes('tidur') || catLower.includes('sleeping')) return <div className="flex items-center gap-1"><Wind size={14} /> <span>Warm</span></div>;
    if (catLower.includes('masak') || catLower.includes('kompor')) return <div className="flex items-center gap-1"><Flame size={14} /> <span>Portable</span></div>;
    return <div className="flex items-center gap-1"><Star size={14} /> <span>Premium</span></div>;
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
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
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
      />

      <HistoryDrawer 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      <TermsModal 
        isOpen={isTermsOpen} 
        onClose={() => setIsTermsOpen(false)} 
      />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden py-32 group/hero">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop" 
            alt="Gunung Slamet Peak" 
            className="w-full h-full object-cover transition-transform duration-[20s] ease-in-out group-hover/hero:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900/90 via-gray-900/50 to-gray-50/10"></div>
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center items-center">
          <div className="hidden 2xl:block absolute left-4 top-1/4 animate-float" style={{animationDelay: '0s'}}>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-72 text-left hover:scale-105 transition duration-300 cursor-default">
               <div className="bg-green-500/20 p-3 rounded-xl text-green-400 shadow-inner">
                 <School size={32} />
               </div>
               <div>
                 <p className="text-white font-bold text-lg leading-tight">Diskon Mahasiswa</p>
                 <p className="text-gray-300 text-sm font-medium mt-1">UNSOED, UMP, & Lainnya</p>
               </div>
            </div>
          </div>

          <div className="hidden 2xl:block absolute right-4 bottom-1/4 animate-float" style={{animationDelay: '3s'}}>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl shadow-2xl flex items-center gap-4 w-72 text-left hover:scale-105 transition duration-300 cursor-default">
               <div className="bg-orange-500/20 p-3 rounded-xl text-orange-400 shadow-inner">
                 <ShieldCheck size={32} />
               </div>
               <div>
                 <p className="text-white font-bold text-lg leading-tight">Alat Terawat</p>
                 <p className="text-gray-300 text-sm font-medium mt-1">Bersih, Wangi, No Bocor</p>
               </div>
            </div>
          </div>

          <div className="text-center max-w-5xl mx-auto relative z-20 px-4 flex flex-col items-center">
            <div className="inline-flex items-center gap-2 bg-nature-600/90 backdrop-blur-md px-5 py-2 rounded-full text-white text-xs md:text-sm font-bold mb-8 border border-white/10 uppercase tracking-widest shadow-xl shadow-nature-900/50 hover:bg-nature-700 hover:scale-105 transition duration-300 cursor-default">
              <Flame size={16} className="text-yellow-400 fill-current animate-pulse" />
              <span>Basecamp Anak Gunung Purwokerto</span>
            </div>

            <h1 className="font-black text-white mb-8 tracking-tight drop-shadow-2xl">
              <span className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-4 hover:tracking-wide transition-all duration-500 ease-out cursor-default">
                GAS TERUS
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-5xl sm:text-6xl md:text-7xl lg:text-8xl py-2 animate-gradient-x bg-[length:200%_auto] cursor-default">
                TAKLUKKAN ALAM
              </span>
            </h1>

            <p className="text-lg text-gray-200 mb-10 max-w-2xl mx-auto font-medium leading-relaxed drop-shadow-md px-4">
              Sewa alat outdoor gak pake ribet. Gear lengkap, harga bersahabat, stok melimpah. 
              Partner resmi penakluk <span className="text-yellow-400 font-bold border-b-2 border-yellow-400/30 hover:bg-yellow-400/10 transition-colors px-1">Slamet, Prau, & Sindoro</span>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <a 
                href="#katalog" 
                className="w-full sm:w-auto bg-nature-600 hover:bg-nature-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition duration-300 shadow-lg shadow-nature-600/30 flex items-center justify-center gap-2 group border border-transparent hover:border-white/20 hover:-translate-y-1 active:scale-95"
              >
                Gasken Sewa
                <ArrowIcon className="group-hover:translate-x-1 transition" size={20} />
              </a>
              <a 
                href="#ai-guide" 
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-xl font-bold text-lg transition duration-300 shadow-lg flex items-center justify-center gap-2 group hover:-translate-y-1 active:scale-95"
              >
                <Zap size={20} className="text-yellow-400 group-hover:text-yellow-300" />
                Tanya AI Dulu
              </a>
            </div>

            <div className="mt-16 flex flex-wrap justify-center gap-6 2xl:hidden">
              <div className="flex items-center gap-3 px-5 py-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-md hover:bg-black/60 transition cursor-default">
                <School size={18} className="text-green-400" />
                <span className="text-white text-sm font-bold tracking-wide">Diskon Mahasiswa</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-md hover:bg-black/60 transition cursor-default">
                <ShieldCheck size={18} className="text-orange-400" />
                <span className="text-white text-sm font-bold tracking-wide">Alat Terawat & Bersih</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/60 animate-bounce md:hidden z-20">
          <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
          <ChevronDown size={20} />
        </div>
      </section>

      {/* Catalog Section Revamped */}
      <section id="katalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
            Pilih <span className="text-transparent bg-clip-text bg-gradient-to-r from-nature-600 to-red-500">Gear Andalan</span>
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Koleksi lengkap, bersih, dan terawat. Siap menemanimu menaklukkan puncak impian.
          </p>
        </div>

        {/* Dynamic Category Filter */}
        <div className="flex justify-center mb-12">
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

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-gray-100 rounded-3xl h-[400px] animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filteredProducts.map(product => {
              const inCart = cartItems.find(i => i.id === product.id);
              const displayPrice = product.price2Days || 0;
              
              return (
                <div key={product.id} className="group relative bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-2 flex flex-col h-full">
                  <div className="relative h-64 overflow-hidden bg-gray-100">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700 ease-in-out" 
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition duration-300"></div>

                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                       {product.stock < 3 && product.stock > 0 && (
                         <span className="bg-adventure-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse uppercase tracking-wider flex items-center gap-1">
                           <Zap size={10} fill="currentColor" /> Terbatas!
                         </span>
                       )}
                       <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md border border-white/20 ${
                         product.stock > 0 ? 'bg-white/90 text-nature-700' : 'bg-red-600 text-white'
                       }`}>
                         Stok: {product.stock}
                       </span>
                    </div>

                    <div className="absolute top-4 left-4">
                      <span className="bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                        {product.category}
                      </span>
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
                           <Check size={10} /> Bersih
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-gray-50">
                      <div className="flex items-end justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Paket 2 Hari</span>
                          <span className="text-xl font-black text-gray-900 tracking-tight">
                            Rp{displayPrice.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <button 
                          onClick={() => addToCart(product)}
                          className={`
                            h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg
                            ${inCart 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : 'bg-nature-600 text-white hover:bg-nature-700 hover:scale-110 active:scale-95 shadow-nature-200'
                            }
                          `}
                          title={inCart ? "Sudah di keranjang" : "Tambah ke keranjang"}
                        >
                          {inCart ? <Check size={24} strokeWidth={3} /> : <Plus size={24} strokeWidth={3} />}
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

      {/* Other sections (AI, Event, Features, Footer) remain unchanged... */}
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

      {/* Features Section */}
      <section className="bg-gray-50 border-t border-gray-200 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-nature-200 transition group">
            <div className="w-16 h-16 bg-nature-50 text-nature-600 rounded-2xl rotate-3 group-hover:rotate-6 transition duration-300 flex items-center justify-center mb-6">
              <Star className="fill-current" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Gear Sultan</h3>
            <p className="text-gray-500">Alat branded, bersih, dan wangi. Gak ada cerita tenda bocor pas badai.</p>
          </div>
          <div className="flex flex-col items-center text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-nature-200 transition group">
             <div className="w-16 h-16 bg-adventure-50 text-adventure-600 rounded-2xl -rotate-3 group-hover:-rotate-6 transition duration-300 flex items-center justify-center mb-6">
              <MapPin className="fill-current" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Lokasi UNSOED</h3>
            <p className="text-gray-500">Basecamp strategis di Grendeng. Gas ambil alat sambil berangkat kuliah.</p>
          </div>
          <div className="flex flex-col items-center text-center p-8 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-nature-200 transition group">
             <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl rotate-3 group-hover:rotate-6 transition duration-300 flex items-center justify-center mb-6">
              <School className="fill-current" size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Harga Mahasiswa</h3>
            <p className="text-gray-500">Tunjukkan KTM sakti mu, dapatkan harga spesial kawan.</p>
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
