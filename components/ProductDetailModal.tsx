import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Check, Layers, Clock, Sparkles, Tag, ShieldCheck, Zap, Box, Scissors, Footprints, Palette } from 'lucide-react';
import { Product } from '../types';
import ImageLoader from './ImageLoader';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  allProducts: Product[]; // Prop baru untuk lookup nama produk
  onAddToCart: (product: Product, size?: string, color?: string) => void;
  isInCart: boolean;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  product, 
  allProducts = [], 
  onAddToCart,
  isInCart
}) => {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [displayImage, setDisplayImage] = useState<string>('');

  // Reset selections when modal opens/product changes
  useEffect(() => {
    if (product) {
      setSelectedSize(null);
      setSelectedColor(null);
      setDisplayImage(product.image);
    }
  }, [product]);

  // Effect: Update image when color changes
  useEffect(() => {
    if (product && selectedColor && product.colorImages) {
      const specificImg = product.colorImages.find(ci => ci.color === selectedColor);
      if (specificImg && specificImg.url) {
        setDisplayImage(specificImg.url);
      } else {
        setDisplayImage(product.image); // Revert to default if no specific image
      }
    } else if (product) {
      setDisplayImage(product.image);
    }
  }, [selectedColor, product]);

  if (!isOpen || !product) return null;

  const fmt = (price: number) => `Rp${(price || 0).toLocaleString('id-ID')}`;

  const prices = [
    { day: 2, price: product.price2Days, label: 'Min. 2 Hari' },
    { day: 3, price: product.price3Days, label: '3 Hari' },
    { day: 4, price: product.price4Days, label: '4 Hari' },
    { day: 5, price: product.price5Days, label: '5 Hari' },
    { day: 6, price: product.price6Days, label: '6 Hari' },
    { day: 7, price: product.price7Days, label: 'Seminggu (Hemat)' },
  ];

  const isPackage = product.packageItems && product.packageItems.length > 0;
  
  // LOGIC FOR VARIANTS
  const hasAdvancedVariants = product.variants && product.variants.length > 0;
  
  // Legacy Fallbacks
  const legacySizes = product.sizes ? Object.keys(product.sizes) : [];
  const legacyColors = product.colors || [];
  const hasLegacySizes = legacySizes.length > 0;
  const hasLegacyColors = legacyColors.length > 0;

  // Determine available colors
  const availableColors = hasAdvancedVariants 
    ? Array.from(new Set(product.variants!.map(v => v.color))) 
    : legacyColors;

  // Determine available sizes based on selected color (if advanced)
  let availableSizesForDisplay: string[] = [];
  
  if (hasAdvancedVariants) {
    if (selectedColor) {
      // Filter sizes for this color that have stock > 0
      availableSizesForDisplay = product.variants!
        .filter(v => v.color === selectedColor)
        .map(v => v.size);
    } else {
      // Show all possible sizes if no color selected yet
      availableSizesForDisplay = Array.from(new Set(product.variants!.map(v => v.size)));
    }
  } else {
    availableSizesForDisplay = legacySizes;
  }

  // Sort sizes logic
  const sortSizes = (sizes: string[]) => {
    const isNumeric = sizes.some(k => !isNaN(parseInt(k)));
    if (isNumeric) {
      return sizes.sort((a, b) => parseInt(a) - parseInt(b));
    } else {
      const order = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
      return sizes.sort((a, b) => {
         const idxA = order.indexOf(a);
         const idxB = order.indexOf(b);
         if (idxA === -1) return 1;
         if (idxB === -1) return -1;
         return idxA - idxB;
      });
    }
  };
  
  const sortedSizes = sortSizes(availableSizesForDisplay);
  const hasSizes = sortedSizes.length > 0;
  const hasColors = availableColors.length > 0;

  // Validation for Add to Cart
  const canAddToCart = 
    (!hasSizes || (hasSizes && selectedSize !== null)) && 
    (!hasColors || (hasColors && selectedColor !== null));

  // Get stock count for display
  const getSpecificStock = () => {
    if (hasAdvancedVariants && selectedColor && selectedSize) {
      const variant = product.variants!.find(v => v.color === selectedColor && v.size === selectedSize);
      return variant ? variant.stock : 0;
    }
    if (!hasAdvancedVariants && selectedSize && product.sizes) {
      return product.sizes[selectedSize];
    }
    return product.stock;
  };

  const specificStock = getSpecificStock();

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto font-sans">
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 text-center">
        
        <div 
          className="fixed inset-0 bg-gray-900/80 backdrop-blur-md transition-opacity" 
          onClick={onClose}
        ></div>

        <div className="relative w-full max-w-5xl transform overflow-hidden rounded-[2rem] bg-white text-left shadow-2xl transition-all animate-slide-in-right md:animate-none md:scale-100 flex flex-col md:flex-row max-h-[90vh]">
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full backdrop-blur-md transition md:hidden"
          >
            <X size={20} />
          </button>

          {/* Left Side: Image Area */}
          <div className="w-full md:w-5/12 bg-gray-100 relative h-72 md:h-auto group">
             <ImageLoader 
               src={displayImage} 
               alt={product.name} 
               className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80"></div>
             
             <div className="absolute top-4 left-4 flex flex-col items-start gap-2">
                <span className="bg-white/20 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg tracking-wide uppercase flex items-center gap-2">
                  <Tag size={12} /> {product.category}
                </span>
                {isPackage && (
                  <span className="bg-purple-500/90 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                    <Layers size={12} /> Paket Hemat
                  </span>
                )}
             </div>

             <div className="absolute bottom-6 left-6 text-white">
                <p className="text-xs font-medium opacity-80 mb-1">Status Barang</p>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${specificStock > 0 ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="font-bold text-sm tracking-wide">
                    {specificStock > 0 ? `Ready ${specificStock} Unit` : 'Yah, Habis Bro!'}
                  </span>
                </div>
             </div>
          </div>

          {/* Right Side: Details Area */}
          <div className="w-full md:w-7/12 flex flex-col bg-white overflow-y-auto custom-scrollbar">
            <div className="p-6 md:p-10 flex-1">
              <div className="hidden md:flex justify-end mb-4">
                 <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition">
                   <X size={24} />
                 </button>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 leading-tight tracking-tight">
                {product.name}
              </h2>
              
              <div className="flex flex-wrap gap-2 mb-8">
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-nature-50 text-nature-700 text-xs font-bold border border-nature-100">
                    <ShieldCheck size={14} /> Terawat
                 </span>
                 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                    <Zap size={14} /> Best Seller
                 </span>
              </div>

              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-8 relative overflow-hidden group hover:border-nature-200 transition">
                <div className="absolute -right-4 -top-4 text-gray-200 opacity-50 transform rotate-12 group-hover:rotate-0 transition duration-500">
                   <Sparkles size={80} strokeWidth={1} />
                </div>
                <h3 className="relative z-10 flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest mb-3">
                   <Sparkles className="text-adventure-500" size={16} /> Cerita Alat
                </h3>
                <p className="relative z-10 text-gray-600 leading-relaxed text-sm md:text-base font-medium whitespace-pre-line">
                  {product.description}
                </p>
              </div>

              {/* Color Selector */}
              {hasColors && (
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest mb-4">
                    <Palette className="text-nature-600" size={16} /> Pilih Warna
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {availableColors.map((color) => {
                      const isSelected = selectedColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            setSelectedColor(color);
                            // If switching color and curr size is invalid for new color, reset size
                            if (hasAdvancedVariants && selectedSize) {
                                const isValidSize = product.variants!.some(v => v.color === color && v.size === selectedSize && v.stock > 0);
                                if (!isValidSize) setSelectedSize(null);
                            }
                          }}
                          className={`
                            px-4 py-2 rounded-full font-bold border-2 transition-all relative flex items-center gap-2
                            ${isSelected
                                ? 'bg-gray-800 border-gray-800 text-white shadow-lg transform scale-105'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-nature-400 hover:text-nature-600'
                            }
                          `}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Selector */}
              {hasSizes && (
                <div className="mb-8">
                  <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest mb-4">
                    <Scissors className="text-nature-600" size={16} /> Pilih Ukuran
                  </h3>
                  {!selectedColor && hasAdvancedVariants && (
                    <p className="text-xs text-red-500 mb-2 italic">*Pilih warna dulu untuk melihat stok ukuran</p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {sortedSizes.map((size) => {
                      // Determine availability
                      let isAvailable = true;
                      let stockForThis = 0;

                      if (hasAdvancedVariants) {
                        if (selectedColor) {
                          const v = product.variants!.find(x => x.color === selectedColor && x.size === size);
                          stockForThis = v ? v.stock : 0;
                          isAvailable = stockForThis > 0;
                        } else {
                          isAvailable = false; // Force user to pick color first
                        }
                      } else {
                        stockForThis = product.sizes![size] || 0;
                        isAvailable = stockForThis > 0;
                      }

                      const isSelected = selectedSize === size;
                      
                      return (
                        <button
                          key={size}
                          disabled={!isAvailable}
                          onClick={() => setSelectedSize(size)}
                          className={`
                            min-w-[50px] px-4 py-2 rounded-xl font-bold border-2 transition-all relative overflow-hidden
                            ${!isAvailable 
                              ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed decoration-slice' 
                              : isSelected
                                ? 'bg-nature-600 border-nature-600 text-white shadow-lg scale-110'
                                : 'bg-white border-gray-200 text-gray-700 hover:border-nature-400 hover:text-nature-600'
                            }
                          `}
                        >
                          {size}
                          {!isAvailable && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-full h-0.5 bg-gray-300 -rotate-45"></div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedSize && (
                    <p className="text-xs text-nature-600 mt-2 font-medium animate-pulse">
                      Stok tersedia: {specificStock} unit
                    </p>
                  )}
                </div>
              )}

              {/* Pricing Grid */}
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest mb-4">
                  <Clock className="text-nature-600" size={16} /> Durasi & Mahar
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {prices.map((p) => (
                    <div 
                      key={p.day} 
                      className={`
                        relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all duration-300
                        ${p.day === 2 
                          ? 'bg-nature-600 border-nature-600 text-white shadow-lg shadow-nature-200 transform scale-105 z-10' 
                          : 'bg-white border-gray-100 text-gray-600 hover:border-gray-300'
                        }
                      `}
                    >
                      {p.day === 2 && (
                         <span className="absolute -top-3 bg-adventure-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">
                           Paling Laris
                         </span>
                      )}
                      <span className={`text-[10px] uppercase font-bold mb-1 ${p.day === 2 ? 'text-nature-100' : 'text-gray-400'}`}>
                        {p.label}
                      </span>
                      <span className={`text-sm md:text-base font-black ${p.day === 2 ? 'text-white' : 'text-gray-800'}`}>
                        {fmt(p.price || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 border-t border-gray-100 bg-gray-50/50 md:rounded-br-[2rem] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-6">
                <div className="hidden sm:flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mulai Dari</span>
                  <span className="text-3xl font-black text-gray-900 tracking-tight">{fmt(product.price2Days || 0)}</span>
                </div>
                <button 
                  disabled={!canAddToCart}
                  onClick={() => {
                    onAddToCart(product, selectedSize || undefined, selectedColor || undefined);
                  }}
                  className={`
                    flex-1 py-4 px-8 rounded-2xl font-bold text-white shadow-xl transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
                    ${isInCart && !hasSizes && !hasColors 
                      ? 'bg-green-600 hover:bg-green-700 shadow-green-200' 
                      : 'bg-gradient-to-r from-nature-600 to-nature-700 hover:from-nature-500 hover:to-nature-600 shadow-nature-200 hover:shadow-2xl hover:-translate-y-1'
                    }
                  `}
                >
                  {!canAddToCart ? (
                    <>Pilih Varian Dulu Bro!</>
                  ) : isInCart && !hasSizes && !hasColors ? (
                    <>
                      <Check size={24} strokeWidth={3} /> Masuk Tas!
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={24} strokeWidth={3} /> Bungkus Gan
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