import React, { useState, useEffect, useMemo } from 'react';
import { MapPin, MessageCircle, CalendarCheck, Smile, Bike, Sparkles, Award, Coffee, ThumbsUp, ShieldCheck, ShoppingBag, Search, ShoppingCart, ArrowRight } from 'lucide-react';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import HistoryDrawer from './components/HistoryDrawer';
import TermsModal from './components/TermsModal';
import ProductDetailModal from './components/ProductDetailModal';
import GeminiAdvisor from './components/GeminiAdvisor';
import FloatingWhatsApp from './components/FloatingWhatsApp';
import { AdminDashboard } from './components/AdminDashboard';
import { Product, CartItem, Category, Transaction } from './types';
import { getProducts, addProduct, updateProduct, deleteProduct } from './services/productService';
import { getCategories, addCategory, updateCategory, deleteCategory } from './services/categoryService';
import { getTransactions } from './services/transactionService';
import ImageLoader from './components/ImageLoader';
import Toast from './components/Toast';

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]); // For Admin
  const [isAdmin, setIsAdmin] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    loadData();
    // Simple Admin Check (URL query ?admin=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
        setIsAdmin(true);
    }
  }, []);

  // Fetch transactions only if admin
  useEffect(() => {
      if (isAdmin) {
          fetchTransactions();
      }
  }, [isAdmin]);

  const fetchTransactions = async () => {
      const data = await getTransactions();
      setTransactions(data);
  };

  const loadData = async () => {
    const [prodData, catData] = await Promise.all([
        getProducts(),
        getCategories()
    ]);
    setProducts(prodData);
    setCategories(catData);
  };

  const addToCart = (product: Product, size?: string, color?: string) => {
    setCart(prev => {
        const existing = prev.find(item => 
            item.id === product.id && 
            item.selectedSize === size && 
            item.selectedColor === color
        );
        if (existing) {
            return prev.map(item => 
                (item.id === product.id && item.selectedSize === size && item.selectedColor === color)
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            );
        }
        return [...prev, { ...product, quantity: 1, selectedSize: size, selectedColor: color }];
    });
  };

  const updateQuantity = (id: string, delta: number, size?: string, color?: string) => {
    setCart(prev => prev.map(item => {
        if (item.id === id && item.selectedSize === size && item.selectedColor === color) {
            return { ...item, quantity: Math.max(1, item.quantity + delta) };
        }
        return item;
    }));
  };

  const removeFromCart = (id: string, size?: string, color?: string) => {
    setCart(prev => prev.filter(item => 
        !(item.id === id && item.selectedSize === size && item.selectedColor === color)
    ));
  };

  const clearCart = () => setCart([]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Semua' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Admin Actions
  const handleAddProduct = async (product: Product) => { await addProduct(product); await loadData(); };
  const handleUpdateProduct = async (product: Product) => { await updateProduct(product); await loadData(); };
  const handleDeleteProduct = async (id: string) => { await deleteProduct(id); await loadData(); };
  const handleAddCategory = async (name: string) => { await addCategory(name); await loadData(); };
  const handleUpdateCategory = async (id: string, name: string) => { await updateCategory(id, name); await loadData(); };
  const handleDeleteCategory = async (id: string) => { await deleteCategory(id); await loadData(); };

  if (isAdmin) {
    return (
        <AdminDashboard 
            products={products}
            categories={categories}
            transactions={transactions}
            onBackToHome={() => setIsAdmin(false)}
            onAddProduct={handleAddProduct} 
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
            onRefresh={async () => { await loadData(); await fetchTransactions(); }}
        />
    );
  }

  return (
    <div className="font-sans text-gray-900 bg-white">
       <Navbar 
         cartCount={cart.reduce((acc, item) => acc + item.quantity, 0)}
         onOpenCart={() => setIsCartOpen(true)}
         onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
         isMobileMenuOpen={isMobileMenuOpen}
         onOpenHistory={() => setIsHistoryOpen(true)}
         onOpenTerms={() => setIsTermsOpen(true)}
       />
       
       {/* HERO SECTION */}
       <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-white/50 to-white z-10"></div>
              <img src="https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?q=80&w=2070&auto=format&fit=crop" alt="Background" className="w-full h-full object-cover" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
              <span className="inline-block py-1 px-3 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wider mb-6 animate-bounce">
                Purwokerto's #1 Outdoor Rental
              </span>
              <h1 className="text-5xl md:text-7xl font-black text-gray-900 mb-6 tracking-tight leading-tight">
                Petualangan Seru<br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-nature-600 to-adventure-500">Tanpa Ribet</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Sewa alat camping & pendakian terlengkap di Purwokerto. 
                Barang bersih, wangi, dan terawat. Buka setiap hari!
              </p>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                 <a 
                   href="https://maps.google.com/?q=Mamas+Outdoor+Purwokerto" 
                   target="_blank"
                   rel="noreferrer"
                   className="inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg hover:-translate-y-1"
                 >
                    <MapPin size={20} /> Lihat Lokasi Gmaps
                 </a>
                 <a 
                   href="#katalog" 
                   className="inline-flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-nature-600 text-gray-700 hover:text-nature-600 px-6 py-3 rounded-xl font-bold transition"
                 >
                    <ShoppingBag size={20} /> Lihat Katalog
                 </a>
              </div>
          </div>
       </section>

       {/* VALUE PROPOSITION SECTION */}
       <section className="py-20 bg-nature-50/50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-nature-600 font-black tracking-widest uppercase text-sm mb-2 block">KEUNGGULAN KAMI</span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">Kenapa Harus Sewa di Mamas?</h2>
            <p className="text-gray-500 mt-2 max-w-2xl mx-auto">
              Bukan sekadar rental biasa. Kami memberikan pelayanan ekstra demi kenyamanan petualanganmu.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center mb-4">
                  <CalendarCheck size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Buka Setiap Hari</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Tanggal merah & hari libur nasional <span className="font-bold text-red-600">TETAP BUKA</span>. Gas muncak kapanpun tanpa halangan.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center mb-4">
                  <Smile size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Pelayanan Bestie</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Admin ramah, cepat, dan responsif. Konsultasi alat atau jalur pendakian gratis sambil ngopi.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                  <MapPin size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Lokasi Strategis</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Pinggir jalan raya Grendeng. Dekat banget sama kampus UNSOED. Gampang dicari gampang dijangkau.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-4">
                  <Bike size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Parkir Gratis</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Akses mudah, parkir motor luas dan aman. <span className="font-bold text-green-600">Gratis</span> parkir buat pelanggan Mamas.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                  <Sparkles size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Bersih & Wangi</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Alat jaminan bersih, sudah dicuci, dan wangi. Tenda ga bau apek, sleeping bag higienis.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                  <Award size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Brand Ternama</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Eiger, Rei, Consina, Naturehike. Stok banyak pilihan warna & model. Kualitas terjamin.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-xl flex items-center justify-center mb-4">
                  <Coffee size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Free Amenities</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Gratis kopi dan isi ulang air minum di basecamp. Sambil nunggu packing, ngopi dulu lur.
               </p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition hover:-translate-y-1">
               <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center mb-4">
                  <ThumbsUp size={24} />
               </div>
               <h3 className="font-bold text-gray-900 text-lg mb-2">Bebas Pilih</h3>
               <p className="text-sm text-gray-600 leading-relaxed">
                  Bebas pilih dan coba alat suka-suka. Gratis sewa Sajadah & P3K (selama persediaan ada).
               </p>
            </div>
          </div>

          <div className="mt-12 bg-nature-600 rounded-3xl p-8 text-center text-white relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{backgroundImage: 'radial-gradient(#fff 2px, transparent 2px)', backgroundSize: '20px 20px'}}></div>
             <div className="relative z-10 max-w-3xl mx-auto">
                <ShieldCheck size={48} className="mx-auto mb-4 text-yellow-400" />
                <h3 className="text-xl md:text-2xl font-black mb-4">Jaminan Kualitas Mamas Outdoor</h3>
                <p className="text-nature-100 text-sm md:text-base leading-relaxed">
                   Demi memberikan pelayanan yang terbaik, kami menjamin bahwa barang yang kami sewakan adalah <span className="text-white font-bold underline decoration-yellow-400">bersih, layak pakai, dan berkualitas</span>. 
                   Dan tentunya telah memenuhi standart keamanan demi kenyamanan bersama. Keistimewaan itu semua bisa Anda dapatkan dengan harga yang sangat kompetitif khusus mahasiswa.
                </p>
             </div>
          </div>
        </div>
       </section>

       {/* CATALOG SECTION */}
       <section id="katalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white">
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                <h2 className="text-3xl font-black text-gray-900">Katalog Alat</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Cari alat..." 
                            className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none w-full sm:w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Categories */}
                    <select 
                        className="pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none appearance-none bg-white font-bold text-gray-600"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        {['Semua', ...categories.map(c => c.name)].map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map(product => (
                    <div key={product.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                        <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                            <ImageLoader src={product.image} alt={product.name} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                            {product.isSale && (
                                <span className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-lg uppercase tracking-wide">Dijual</span>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                            <button 
                                onClick={() => { setSelectedProduct(product); setIsDetailModalOpen(true); }}
                                className="absolute bottom-3 right-3 bg-white text-gray-900 p-2.5 rounded-full shadow-lg opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-nature-600 hover:text-white"
                            >
                                <ArrowRight size={20} />
                            </button>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                            <div className="flex-1">
                                <span className="text-[10px] font-bold text-nature-600 uppercase tracking-wider">{product.category}</span>
                                <h3 className="font-bold text-gray-900 mt-1 mb-2 line-clamp-2 leading-tight group-hover:text-nature-700 transition-colors">
                                    {product.name}
                                </h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-gray-900">
                                        Rp{(product.isSale ? product.salePrice : product.price2Days)?.toLocaleString('id-ID')}
                                    </span>
                                    {!product.isSale && <span className="text-xs text-gray-400 font-medium">/ 2 hari</span>}
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                <span className={`text-xs font-bold ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {product.stock > 0 ? `Stok: ${product.stock}` : 'Habis'}
                                </span>
                                <button 
                                    onClick={() => {
                                        addToCart(product);
                                        setToastMessage(`${product.name} masuk keranjang!`);
                                        setShowToast(true);
                                    }}
                                    disabled={product.stock <= 0}
                                    className="bg-gray-900 text-white p-2 rounded-lg hover:bg-nature-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ShoppingCart size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
       </section>

       {/* AI Guide */}
       <GeminiAdvisor products={products} onAddRecommended={(id) => {
           const p = products.find(prod => prod.id === id);
           if(p) {
               addToCart(p);
               setToastMessage(`${p.name} ditambahkan!`);
               setShowToast(true);
           }
       }} />

       {/* Floating Buttons */}
       <FloatingWhatsApp />
       
       {/* Modals & Drawers */}
       <CartDrawer 
           isOpen={isCartOpen} 
           onClose={() => setIsCartOpen(false)} 
           cartItems={cart}
           products={products}
           onUpdateQuantity={updateQuantity}
           onRemoveItem={removeFromCart}
           onClearCart={clearCart}
           onRefreshData={async () => await loadData()}
       />
       <HistoryDrawer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
       <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
       <ProductDetailModal 
           isOpen={isDetailModalOpen} 
           onClose={() => setIsDetailModalOpen(false)} 
           product={selectedProduct}
           allProducts={products}
           onAddToCart={(p, s, c) => {
               addToCart(p, s, c);
               setIsDetailModalOpen(false);
               setToastMessage("Berhasil masuk keranjang!");
               setShowToast(true);
           }}
           isInCart={selectedProduct ? cart.some(i => i.id === selectedProduct.id) : false}
       />
       <Toast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </div>
  );
}

export default App;