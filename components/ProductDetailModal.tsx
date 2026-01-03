import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Check, PackageOpen, Palette, Scissors, Clock, MessageSquare, BadgeCheck, Star, ShoppingBag, Layers, AlertCircle } from 'lucide-react';
import { Product, Review } from '../types';
import { getReviewsForProduct } from '../services/reviewService';
import ImageLoader from './ImageLoader';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  allProducts: Product[];
  onAddToCart: (product: Product, size?: string, color?: string) => void;
  isInCart: boolean;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ 
  isOpen, 
  onClose, 
  product, 
  allProducts,
  onAddToCart, 
  isInCart 
}) => {
  const [selectedSize, setSelectedSize] = useState<string | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'details' | 'reviews'>('details');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      // Reset state
      setSelectedSize(undefined);
      setSelectedColor(undefined);
      setActiveTab('details');
      
      // Auto-select if only 1 option
      if (product.colors && product.colors.length === 1) setSelectedColor(product.colors[0]);
      // If sizes is object {S: 5}, keys are sizes.
      const sizeKeys = product.sizes ? Object.keys(product.sizes) : [];
      if (sizeKeys.length === 1) setSelectedSize(sizeKeys[0]);

      // Fetch reviews
      fetchReviews(product.id);
    }
  }, [isOpen, product]);

  const fetchReviews = async (productId: string) => {
    setIsLoadingReviews(true);
    const data = await getReviewsForProduct(productId);
    setReviews(data);
    setIsLoadingReviews(false);
  };

  if (!isOpen || !product) return null;

  // Helpers
  const fmt = (val: number) => `Rp${val.toLocaleString('id-ID')}`;

  // Package Logic
  const isPackage = (product.packageItems && product.packageItems.length > 0) || product.category === 'Paketan Sewa';
  const packageContents = product.packageItems?.map(pi => {
      const child = allProducts.find(p => p.id === pi.productId);
      return child ? { name: child.name, qty: pi.quantity } : null;
  }).filter(Boolean) || [];

  // Variant Logic
  const hasAdvancedVariants = product.variants && product.variants.length > 0;
  const hasColors = (product.colors && product.colors.length > 0) || (hasAdvancedVariants && product.variants!.some(v => v.color));
  const hasSizes = (product.sizes && Object.keys(product.sizes).length > 0) || (hasAdvancedVariants && product.variants!.some(v => v.size));

  // Determine available options
  let availableColors: string[] = [];
  if (hasAdvancedVariants) {
      availableColors = Array.from(new Set(product.variants!.map(v => v.color)));
  } else if (product.colors) {
      availableColors = product.colors;
  }

  let sortedSizes: string[] = [];
  if (hasAdvancedVariants) {
      // If color selected, show sizes for that color, else show all possible sizes
      if (selectedColor) {
          sortedSizes = product.variants!
              .filter(v => v.color === selectedColor)
              .map(v => v.size)
              .sort((a,b) => {
                  const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL'];
                  return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
              });
      } else {
          sortedSizes = Array.from(new Set(product.variants!.map(v => v.size))).sort();
      }
  } else if (product.sizes) {
      sortedSizes = Object.keys(product.sizes).sort();
  }

  // Calculate Specific Stock
  let specificStock = product.stock;
  if (hasAdvancedVariants && selectedColor && selectedSize) {
      const v = product.variants!.find(x => x.color === selectedColor && x.size === selectedSize);
      specificStock = v ? v.stock : 0;
  } else if (!hasAdvancedVariants && selectedSize && product.sizes) {
      specificStock = product.sizes[selectedSize] || 0;
  }

  const isReadyToAdd = (!hasColors || selectedColor) && (!hasSizes || selectedSize) && specificStock > 0;

  // Price List for Rental
  const prices = [
    { day: 2, label: '2 Hari', price: product.price2Days },
    { day: 3, label: '3 Hari', price: product.price3Days },
    { day: 4, label: '4 Hari', price: product.price4Days },
    { day: 5, label: '5 Hari', price: product.price5Days },
    { day: 6, label: '6 Hari', price: product.price6Days },
    { day: 7, label: '7 Hari', price: product.price7Days },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col md:flex-row animate-scale-up">
        
        {/* Left: Image & Quick Stats */}
        <div className="w-full md:w-1/2 bg-gray-100 relative group min-h-[300px] md:min-h-full">
           <ImageLoader 
             src={product.image} 
             alt={product.name} 
             className="w-full h-full object-cover"
           />
           <button onClick={onClose} className="absolute top-4 left-4 bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-white transition md:hidden z-10">
             <X size={24} />
           </button>
           
           {/* Sale Badge */}
           {product.isSale && (
             <div className="absolute top-4 right-4 bg-blue-600 text-white px-4 py-1.5 rounded-full font-bold text-xs shadow-lg uppercase tracking-wider">
               Barang Dijual
             </div>
           )}
        </div>

        {/* Right: Details & Actions */}
        <div className="w-full md:w-1/2 flex flex-col bg-white">
           {/* Header */}
           <div className="p-6 md:p-8 border-b border-gray-100 relative">
              <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition hidden md:block">
                <X size={24} />
              </button>
              
              <div className="text-xs font-bold text-nature-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                 <Layers size={14}/> {product.category}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-2">
                {product.name}
              </h2>
              
              {/* Rating Summary */}
              <div className="flex items-center gap-2 mb-4">
                 <div className="flex text-yellow-400">
                    {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={reviews.length > 0 && i <= 4 ? "currentColor" : "none"} className={reviews.length === 0 ? "text-gray-300" : ""}/>)}
                 </div>
                 <span className="text-xs text-gray-500 font-medium">
                    {reviews.length > 0 ? `${reviews.length} Ulasan` : 'Belum ada ulasan'}
                 </span>
              </div>

              {/* Price */}
              <div className="flex items-end gap-2">
                 <span className="text-3xl font-black text-nature-700">
                    {fmt(product.isSale ? (product.salePrice||0) : product.price2Days)}
                 </span>
                 {!product.isSale && <span className="text-gray-400 text-sm font-bold mb-1">/ 2 hari</span>}
              </div>
           </div>

           {/* Tabs */}
           <div className="flex border-b border-gray-100">
              <button 
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-sm font-bold text-center transition border-b-2 ${activeTab === 'details' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                Detail & Sewa
              </button>
              <button 
                onClick={() => setActiveTab('reviews')}
                className={`flex-1 py-3 text-sm font-bold text-center transition border-b-2 ${activeTab === 'reviews' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                Ulasan ({reviews.length})
              </button>
           </div>

           {/* Content Area */}
           <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
              {activeTab === 'details' ? (
                <>
                  <div className="prose prose-sm text-gray-600 mb-8">
                    <p>{product.description}</p>
                  </div>

                  {/* PACKAGE CONTENTS */}
                  {isPackage && packageContents.length > 0 && (
                    <div className="mb-8">
                        <h3 className="flex items-center gap-2 text-sm font-black text-purple-800 uppercase tracking-widest mb-4 bg-purple-50 p-2 rounded-lg w-fit">
                            <PackageOpen className="text-purple-600" size={16} /> Isi Paket Hemat Ini
                        </h3>
                        <div className="bg-white border border-purple-100 rounded-xl p-4 shadow-sm">
                            <ul className="space-y-3">
                                {packageContents.map((item: any, idx: number) => (
                                    <li key={idx} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded text-xs">
                                                {item.qty}x
                                            </span>
                                            <span className="font-medium text-gray-700">{item.name}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-3 pt-3 border-t border-purple-50 text-xs text-purple-600 font-medium italic text-center">
                                *Stok paket otomatis mengikuti ketersediaan item di atas.
                            </div>
                        </div>
                    </div>
                  )}

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
                                // Reset size if not valid for new color
                                if (hasAdvancedVariants && selectedSize) {
                                    const isValidSize = product.variants!.some(v => v.color === color && v.size === selectedSize && v.stock > 0);
                                    if (!isValidSize) setSelectedSize(undefined);
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
                          let isAvailable = true;
                          
                          if (hasAdvancedVariants) {
                            if (selectedColor) {
                              const v = product.variants!.find(x => x.color === selectedColor && x.size === size);
                              isAvailable = (v?.stock || 0) > 0;
                            } else {
                              isAvailable = false;
                            }
                          } else if (product.sizes) {
                            isAvailable = (product.sizes[size] || 0) > 0;
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

                  {/* Pricing Grid - ONLY FOR RENTAL */}
                  {!product.isSale && (
                    <div className="mb-6">
                        <h3 className="flex items-center gap-2 text-sm font-black text-gray-900 uppercase tracking-widest mb-4">
                        <Clock className="text-nature-600" size={16} /> Mau Healing Berapa Lama?
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
                  )}
                </>
              ) : (
                <div className="space-y-4 animate-slide-in-right">
                   {isLoadingReviews ? (
                      <div className="flex justify-center py-8">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nature-600"></div>
                      </div>
                   ) : reviews.length === 0 ? (
                      <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                         <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <MessageSquare className="text-gray-400" size={24} />
                         </div>
                         <p className="text-sm font-bold text-gray-600">Belum ada ulasan untuk alat ini.</p>
                         <p className="text-xs text-gray-400 mt-1">Jadilah yang pertama menyewa dan mereview!</p>
                      </div>
                   ) : (
                      <>
                        {reviews.map((review) => (
                            <div key={review.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-nature-100 text-nature-700 flex items-center justify-center font-bold text-xs">
                                        {review.customer_name ? review.customer_name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 flex items-center gap-1">
                                            {review.customer_name}
                                            <BadgeCheck size={14} className="text-blue-500 fill-current text-white" />
                                        </p>
                                        <div className="flex text-yellow-400">
                                          {[...Array(5)].map((_, i) => (
                                              <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} className={i >= review.rating ? "text-gray-300" : ""} />
                                          ))}
                                        </div>
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-gray-400">
                                    {new Date(review.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}
                                  </span>
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed italic">"{review.comment}"</p>
                            </div>
                        ))}
                        <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100 mt-4">
                            <p className="text-xs font-bold text-blue-800 flex items-center justify-center gap-2">
                              <ShoppingBag size={14}/> Pernah sewa alat ini?
                            </p>
                            <p className="text-[10px] text-blue-600 mt-1">
                              Buka menu <strong>Riwayat Sewa</strong> di pojok kanan atas untuk memberikan ulasanmu!
                            </p>
                        </div>
                      </>
                   )}
                </div>
              )}
           </div>

           {/* Footer: Add to Cart */}
           {activeTab === 'details' && (
             <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center gap-4">
                <div className="hidden md:block">
                   <p className="text-xs text-gray-500 font-medium">Stok Ready</p>
                   <p className="text-xl font-black text-gray-900">{specificStock} Unit</p>
                </div>
                <button 
                  onClick={() => onAddToCart(product, selectedSize, selectedColor)}
                  disabled={!isReadyToAdd}
                  className={`
                    flex-1 h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-xl
                    ${isReadyToAdd 
                      ? 'bg-nature-600 hover:bg-nature-700 text-white shadow-nature-200 hover:shadow-nature-300 hover:scale-[1.02]' 
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}
                  `}
                >
                  {isReadyToAdd ? (
                    <>
                      {isInCart ? <Check size={24} strokeWidth={3} /> : <ShoppingCart size={24} strokeWidth={3} />}
                      {isInCart ? 'Tambah Lagi' : 'Masuk Keranjang'}
                    </>
                  ) : (
                    <>
                      <AlertCircle size={24} />
                      {specificStock <= 0 ? 'Stok Habis' : 'Pilih Varian'}
                    </>
                  )}
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;