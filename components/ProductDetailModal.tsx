import React from 'react';
import { X, ShoppingCart, Check, Layers, Clock, AlertCircle } from 'lucide-react';
import { Product } from '../types';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onAddToCart: (product: Product) => void;
  isInCart: boolean;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  product, 
  onAddToCart,
  isInCart
}) => {
  if (!isOpen || !product) return null;

  // Helper untuk format harga
  const fmt = (price: number) => `Rp${(price || 0).toLocaleString('id-ID')}`;

  // Daftar harga sewa
  const prices = [
    { day: 2, price: product.price2Days, label: 'Minimal' },
    { day: 3, price: product.price3Days },
    { day: 4, price: product.price4Days },
    { day: 5, price: product.price5Days },
    { day: 6, price: product.price6Days },
    { day: 7, price: product.price7Days, label: 'Seminggu' },
  ];

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
        
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
          onClick={onClose}
        ></div>

        {/* Modal Panel */}
        <div className="relative w-full max-w-4xl transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all animate-slide-in-right md:animate-none md:scale-100 flex flex-col md:flex-row max-h-[90vh]">
          
          {/* Close Button (Mobile Absolute) */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition md:hidden"
          >
            <X size={20} />
          </button>

          {/* Left Side: Image */}
          <div className="w-full md:w-1/2 bg-gray-100 relative h-64 md:h-auto">
             <img 
               src={product.image} 
               alt={product.name} 
               className="w-full h-full object-cover"
             />
             <div className="absolute top-4 left-4">
                <span className="bg-nature-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg uppercase tracking-wide">
                  {product.category}
                </span>
             </div>
          </div>

          {/* Right Side: Details */}
          <div className="w-full md:w-1/2 flex flex-col bg-white overflow-y-auto">
            <div className="p-6 md:p-8 flex-1">
              <div className="hidden md:flex justify-end mb-2">
                 <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                   <X size={24} />
                 </button>
              </div>

              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 leading-tight">
                {product.name}
              </h2>
              
              <div className="flex items-center gap-3 mb-6">
                 <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                   product.stock > 0 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-red-50 text-red-700 border-red-200'
                 }`}>
                    {product.stock > 0 ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                    {product.stock > 0 ? `Stok Tersedia: ${product.stock}` : 'Stok Habis'}
                 </div>
              </div>

              <div className="prose prose-sm text-gray-600 mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Deskripsi Produk</h3>
                <p className="leading-relaxed whitespace-pre-line">{product.description}</p>
              </div>

              {/* Package Items List (If applicable) */}
              {product.packageItems && product.packageItems.length > 0 && (
                <div className="mb-8 bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <h3 className="text-sm font-bold text-purple-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Layers size={16} /> Isi Paket Ini:
                  </h3>
                  <ul className="space-y-2">
                    {product.packageItems.map((item, idx) => (
                      <li key={idx} className="flex items-center justify-between text-sm text-purple-800 bg-white/50 px-3 py-2 rounded-lg">
                        <span className="font-medium">Item ID: {item.productId}</span> 
                        {/* Note: Idealnya kita lookup nama produk dari ID, tapi di komponen ini kita hanya terima data product itu sendiri. 
                            Untuk MVP ini cukup menampilkan ID atau jumlahnya. */}
                        <span className="font-bold">x{item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-purple-600 mt-2 flex items-center gap-1">
                    <AlertCircle size={10} /> Stok item di atas akan berkurang otomatis saat paket disewa.
                  </p>
                </div>
              )}

              {/* Pricing Table */}
              <div className="mb-8">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Clock size={16} /> Daftar Harga Sewa
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {prices.map((p) => (
                    <div key={p.day} className={`p-2 rounded-lg text-center border ${p.day === 2 ? 'bg-nature-50 border-nature-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">{p.day} Hari {p.label && `(${p.label})`}</div>
                      <div className={`font-bold ${p.day === 2 ? 'text-nature-700' : 'text-gray-700'}`}>
                        {fmt(p.price || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 md:rounded-br-3xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 font-bold uppercase">Harga Mulai</span>
                  <span className="text-2xl font-black text-nature-600">{fmt(product.price2Days || 0)}</span>
                </div>
                <button 
                  onClick={() => {
                    onAddToCart(product);
                    // Optional: Close modal after adding? 
                    // onClose(); 
                  }}
                  className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-white shadow-lg transition transform active:scale-95 flex items-center justify-center gap-2 ${
                    isInCart 
                      ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                      : 'bg-nature-600 hover:bg-nature-700 shadow-nature-200'
                  }`}
                >
                  {isInCart ? (
                    <>
                      <Check size={20} /> Ditambahkan
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={20} /> Sewa Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
