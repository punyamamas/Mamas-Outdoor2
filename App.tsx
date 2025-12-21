import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import GeminiAdvisor from './components/GeminiAdvisor';
import { PRODUCTS, CATEGORIES } from './constants';
import { CartItem, Product } from './types';
import { getProducts } from './services/productService';
import { MapPin, Star, Plus, Check, School, Github } from 'lucide-react';

function App() {
  const [products, setProducts] = useState<Product[]>(PRODUCTS); // Init dengan data mock/statis dulu agar tidak kosong
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Load products from Supabase (or fallback)
  useEffect(() => {
    const initProducts = async () => {
      const data = await getProducts();
      setProducts(data);
    };
    initProducts();
  }, []);

  // Load cart from local storage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('mamasCart');
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
  }, []);

  // Save cart whenever it changes
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

  const filteredProducts = selectedCategory === 'Semua' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <Navbar 
        cartCount={cartItems.reduce((acc, item) => acc + item.quantity, 0)} 
        onOpenCart={() => setIsCartOpen(true)}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cartItems={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
      />

      {/* Hero Section */}
      <section className="relative h-[500px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1920&auto=format&fit=crop" 
            alt="Camping Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-white text-sm font-medium mb-6 border border-white/20">
            <MapPin size={16} className="text-adventure-500" />
            <span>Basecamp: Purwokerto Utara (Dekat UNSOED)</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Jelajahi Alam Bebas <br/> Tanpa Batas Biaya
          </h1>
          <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
            Sewa alat outdoor lengkap, bersih, dan terawat. Partner terbaik mahasiswa Purwokerto untuk mendaki Slamet, Prau, dan sekitarnya.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#katalog" className="bg-adventure-500 hover:bg-adventure-600 text-white px-8 py-3.5 rounded-xl font-bold transition shadow-lg shadow-adventure-900/20">
              Sewa Sekarang
            </a>
            <a href="#ai-guide" className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-8 py-3.5 rounded-xl font-bold transition">
              Tanya AI Guide
            </a>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="katalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Katalog Alat</h2>
            <p className="text-gray-500">Pilih perlengkapan sesuai kebutuhan petualanganmu.</p>
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  selectedCategory === cat 
                    ? 'bg-nature-700 text-white shadow-md shadow-nature-200' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-nature-300 hover:text-nature-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map(product => {
            const inCart = cartItems.find(i => i.id === product.id);
            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 overflow-hidden border border-gray-100 group">
                <div className="relative h-48 overflow-hidden">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-nature-700 shadow-sm">
                    Stok: {product.stock}
                  </div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-semibold text-adventure-600 mb-2 uppercase tracking-wide">{product.category}</div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1" title={product.name}>{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[40px]">{product.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-lg font-bold text-gray-900">Rp{product.price.toLocaleString('id-ID')}</span>
                      <span className="text-xs text-gray-400">/24jam</span>
                    </div>
                    <button 
                      onClick={() => addToCart(product)}
                      className={`p-3 rounded-xl transition shadow-lg ${
                        inCart 
                          ? 'bg-nature-50 text-nature-700 border border-nature-200' 
                          : 'bg-nature-600 text-white hover:bg-nature-700 shadow-nature-200'
                      }`}
                    >
                      {inCart ? <Check size={20} /> : <Plus size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Assistant Section */}
      <section className="bg-nature-50 border-y border-nature-100">
        <GeminiAdvisor products={products} onAddRecommended={addRecommendedToCart} />
      </section>

      {/* Features/Trust Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Star className="fill-current" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Alat Terawat</h3>
            <p className="text-gray-500">Selalu dibersihkan dan dicek setelah pemakaian. Tidak ada tenda bocor atau frame patah.</p>
          </div>
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
             <div className="w-14 h-14 bg-adventure-50 text-adventure-600 rounded-full flex items-center justify-center mb-4">
              <MapPin className="fill-current" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Lokasi Strategis</h3>
            <p className="text-gray-500">Dekat dengan kampus UNSOED. Mudah dijangkau untuk pengambilan dan pengembalian.</p>
          </div>
          <div className="flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
             <div className="w-14 h-14 bg-nature-50 text-nature-600 rounded-full flex items-center justify-center mb-4">
              <School className="fill-current" size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Diskon Mahasiswa</h3>
            <p className="text-gray-500">Tunjukkan KTM (Kartu Tanda Mahasiswa) saat pengambilan untuk mendapatkan harga spesial.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <h2 className="text-2xl font-bold mb-4">Mamas<span className="text-nature-400">Outdoor</span></h2>
              <p className="text-gray-400 max-w-sm">
                Teman setia petualanganmu. Kami menyediakan peralatan outdoor berkualitas dengan harga mahasiswa.
                Mari jelajahi keindahan alam Indonesia bersama kami.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Layanan</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-nature-400">Sewa Tenda</a></li>
                <li><a href="#" className="hover:text-nature-400">Sewa Carrier</a></li>
                <li><a href="#" className="hover:text-nature-400">Paket Pendakian</a></li>
                <li><a href="#" className="hover:text-nature-400">Consultation</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold mb-4">Kontak</h3>
              <ul className="space-y-2 text-gray-400">
                <li>Jl. Kampus No. 123, Grendeng</li>
                <li>Purwokerto Utara</li>
                <li>WA: 0812-3456-7890</li>
                <li>IG: @mamasoutdoor</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
            <p>&copy; 2024 Mamas Outdoor. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="flex items-center gap-1 hover:text-white transition">
                <Github size={16} />
                <span>Repository</span>
              </a>
              <p>Made with ❤️ for Nature Lovers</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;