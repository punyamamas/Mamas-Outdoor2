
import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Phone, User, ArrowRight, AlertCircle, Loader2, Clock, CreditCard, Banknote, MapPin, LocateFixed, Layers, Upload, Image as ImageIcon, CheckCircle } from 'lucide-react';
import { CartItem, UserDetails, Transaction, Product } from '../types';
import { processStockReduction } from '../services/productService';
import { createTransaction, uploadPaymentProof } from '../services/transactionService';
import { getStoreConfig } from '../utils/storeConfig';
import ImageLoader from './ImageLoader';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  products: Product[]; 
  onUpdateQuantity: (id: string, delta: number, size?: string, color?: string) => void;
  onRemoveItem: (id: string, size?: string, color?: string) => void;
  onClearCart: () => void;
  onRefreshData: () => Promise<void>; 
}

const CartDrawer: React.FC<CartDrawerProps> = ({ 
  isOpen, 
  onClose, 
  cartItems, 
  products = [], 
  onUpdateQuantity, 
  onRemoveItem, 
  onClearCart,
  onRefreshData
}) => {
  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  const [userDetails, setUserDetails] = useState<UserDetails>({
    name: '',
    whatsapp: '',
    location: '', 
    rentalDate: new Date().toISOString().split('T')[0],
    duration: 2,
    paymentMethod: 'cash' 
  });

  const storeConfig = getStoreConfig();

  useEffect(() => {
    if (!isOpen) {
        setStep('cart');
        setProofFile(null); 
    }
  }, [isOpen]);

  const detectLocation = () => {
    setIsLocating(true);
    
    if (!navigator.geolocation) {
        alert("Browser tidak mendukung geolokasi.");
        setIsLocating(false);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`);
                const data = await response.json();
                
                if (data && data.address) {
                    const district = data.address.suburb || data.address.village || data.address.town || '';
                    const city = data.address.city || data.address.regency || data.address.county || '';
                    const state = data.address.state || '';
                    
                    const formattedLocation = [district, city, state].filter(Boolean).join(', ');
                    setUserDetails(prev => ({ ...prev, location: formattedLocation }));
                } else {
                    setUserDetails(prev => ({ ...prev, location: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` }));
                }
            } catch (error) {
                console.error("Gagal reverse geocoding:", error);
                alert("Gagal mendeteksi nama jalan. Silakan ketik manual.");
            } finally {
                setIsLocating(false);
            }
        },
        (error) => {
            console.warn("GPS Error:", error.code);
            fetch('https://ipapi.co/json/')
                .then(res => res.json())
                .then(data => {
                    if (data.city) setUserDetails(prev => ({ ...prev, location: `${data.city} (IP Detected)` }));
                })
                .catch(() => {})
                .finally(() => setIsLocating(false));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getItemPriceForDuration = (item: CartItem, days: number): number => {
    if (item.isSale) return item.salePrice || 0;

    const p2 = item.price2Days || 0;
    const p3 = item.price3Days || 0;
    const p4 = item.price4Days || 0;
    const p5 = item.price5Days || 0;
    const p6 = item.price6Days || 0;
    const p7 = item.price7Days || 0;

    let unitPrice = 0;
    if (days <= 2) unitPrice = p2;
    else if (days === 3) unitPrice = p3;
    else if (days === 4) unitPrice = p4;
    else if (days === 5) unitPrice = p5;
    else if (days === 6) unitPrice = p6;
    else unitPrice = p7 + ((days - 7) * (p2 * 0.4)); 

    return unitPrice;
  };

  const getAvailableStock = (item: CartItem): number => {
    const originalProduct = products.find(p => p.id === item.id) || item;

    if (originalProduct.packageItems && originalProduct.packageItems.length > 0) {
        const possibleStocks = originalProduct.packageItems.map(pi => {
            const child = products.find(p => p.id === pi.productId);
            if (!child || child.stock <= 0) return 0;
            return Math.floor(child.stock / pi.quantity);
        });
        return possibleStocks.length > 0 ? Math.min(...possibleStocks) : 0;
    }

    if (item.variants && item.variants.length > 0 && item.selectedSize && item.selectedColor) {
      const variant = item.variants.find(v => v.size === item.selectedSize && v.color === item.selectedColor);
      return variant ? variant.stock : 0;
    }
    if (item.sizes && item.selectedSize && Object.keys(item.sizes).length > 0) {
       return item.sizes[item.selectedSize] || 0;
    }
    return originalProduct.stock || 0;
  };

  const getReturnDate = (startDateStr: string, duration: number): Date => {
    const date = new Date(startDateStr);
    date.setDate(date.getDate() + (duration - 1));
    return date;
  };

  const formatReturnDate = (date: Date): string => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const price = getItemPriceForDuration(item, userDetails.duration);
      return sum + (price * item.quantity);
    }, 0);
  };

  const total = calculateTotal();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("Ukuran file maksimal 5MB");
        return;
      }
      setProofFile(file);
    }
  };

  const handleCheckout = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    try {
      const returnDateObj = getReturnDate(userDetails.rentalDate, userDetails.duration);
      const returnDateFormatted = formatReturnDate(returnDateObj);

      const createdTrx = await createTransaction(userDetails, cartItems, total, userDetails.location);

      if (!createdTrx) {
        throw new Error("Gagal membuat transaksi di database.");
      }

      let uploadedProofUrl = '';
      if (proofFile && userDetails.paymentMethod === 'transfer') {
         uploadedProofUrl = await uploadPaymentProof(createdTrx.id, proofFile) || '';
      }

      await processStockReduction(cartItems);
      await onRefreshData();

      const existingHistory = localStorage.getItem('mamasHistory');
      const history = existingHistory ? JSON.parse(existingHistory) : [];
      if(uploadedProofUrl) createdTrx.paymentProofUrl = uploadedProofUrl;
      history.push(createdTrx);
      localStorage.setItem('mamasHistory', JSON.stringify(history));

      const dpAmount = Math.ceil(total * 0.5); 
      const remainingAmount = total - dpAmount;
      const trxIdShort = createdTrx.id.slice(0, 8); 

      const header = `*Halo ${storeConfig.storeName}! Saya mau sewa/beli dong.*\n*(Order ID: #${trxIdShort})*\n\n`;
      const buyerInfo = `*Data Pelanggan:*\nNama: ${userDetails.name}\nWA: ${userDetails.whatsapp}\nDomisili: ${userDetails.location || '-'}\n\n*Detail Order:*\nAmbil: ${userDetails.rentalDate}\nDurasi Sewa: ${userDetails.duration} Hari\nKembali (Utk Sewa): ${returnDateFormatted}\n\n`;
      
      const itemsList = cartItems.map((item, idx) => {
        const priceForDuration = getItemPriceForDuration(item, userDetails.duration);
        const sizeLabel = item.selectedSize ? ` [Size: ${item.selectedSize}]` : '';
        const colorLabel = item.selectedColor ? ` [Warna: ${item.selectedColor}]` : '';
        const typeLabel = item.isSale ? '(BELI)' : `(SEWA ${userDetails.duration} Hari)`;
        return `${idx + 1}. ${item.name}${sizeLabel}${colorLabel} (${item.quantity}x)\n   @ Rp${priceForDuration.toLocaleString('id-ID')} ${typeLabel}`;
      }).join('\n');

      let footer = `\n\n*Total Tagihan: Rp${total.toLocaleString('id-ID')}*`;
      
      if (userDetails.paymentMethod === 'transfer') {
        footer += `\n*Metode Bayar: Transfer (DP 50%)*`;
        footer += `\n---------------------------`;
        footer += `\n*Rekening DP: ${storeConfig.bankName} ${storeConfig.bankAccount} (${storeConfig.bankHolder})*`;
        footer += `\n*Wajib DP: Rp${dpAmount.toLocaleString('id-ID')}*`;
        footer += `\n*Pelunasan: Rp${remainingAmount.toLocaleString('id-ID')} (Saat Ambil)*`;
        
        if (uploadedProofUrl) {
            footer += `\n\n✅ *Bukti Transfer Telah Diupload:*`;
            footer += `\n${uploadedProofUrl}`;
        } else {
            footer += `\n\n⚠️ *Belum upload bukti transfer di web.*`;
        }

      } else {
        footer += `\n*Metode Bayar: Cash di Outlet*`;
      }
      
      const fullMessage = encodeURIComponent(header + buyerInfo + "*List Barang:*\n" + itemsList + footer);
      
      setTimeout(() => {
        window.open(`https://wa.me/${storeConfig.adminWhatsapp}?text=${fullMessage}`, '_blank');
        onClearCart();
        setStep('cart');
        setProofFile(null);
        onClose();
        setIsProcessing(false);
      }, 500);

    } catch (error) {
      console.error("Checkout Error:", error);
      alert("Terjadi kesalahan koneksi saat memproses pesanan. Pastikan internet lancar.");
      setIsProcessing(false);
    }
  };

  const handleDurationChange = (val: number) => {
    const newDuration = val < 2 ? 2 : val;
    setUserDetails(prev => ({ ...prev, duration: newDuration }));
  };

  if (!isOpen) return null;

  const returnDateDisplay = formatReturnDate(getReturnDate(userDetails.rentalDate, userDetails.duration));
  const dpValue = Math.ceil(total * 0.5);
  const hasRentalItems = cartItems.some(i => !i.isSale);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      {/* Drawer: Full width on mobile, max-md on desktop */}
      <div className="absolute inset-y-0 right-0 max-w-full flex w-full md:w-auto">
        <div className="w-full md:w-screen md:max-w-md bg-white shadow-xl flex flex-col h-full animate-slide-in-right pb-safe">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-nature-50">
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'cart' ? 'Keranjang Belanja' : 'Detail Penyewa'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 scroll-smooth pb-32">
            {step === 'cart' ? (
              <>
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
                    <div className="bg-gray-100 p-4 rounded-full">
                       <CreditCard size={40} className="text-gray-400" />
                    </div>
                    <p>Keranjangmu masih kosong nih.</p>
                    <button onClick={onClose} className="text-nature-600 font-medium hover:underline">
                      Cari alat dulu yuk
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {cartItems.map(item => {
                      const displayPrice = item.isSale ? (item.salePrice || 0) : (item.price2Days || 0);
                      const itemKey = `${item.id}-${item.selectedSize || 'default'}-${item.selectedColor || 'default'}`;
                      const maxStock = getAvailableStock(item);
                      const isMaxStock = item.quantity >= maxStock;
                      const isPackage = item.packageItems && item.packageItems.length > 0;
                      
                      let packageContentString = '';
                      if (isPackage) {
                          const contents = item.packageItems?.map(pi => {
                              const child = products.find(p => p.id === pi.productId);
                              return child ? `${child.name} (${pi.quantity})` : '';
                          }).filter(Boolean);
                          packageContentString = contents?.join(', ') || '';
                      }

                      return (
                        <div key={itemKey} className="flex gap-4">
                          <div className="w-20 h-20 relative flex-shrink-0">
                            <ImageLoader 
                              src={item.image} 
                              alt={item.name} 
                              className="w-full h-full object-cover rounded-lg"
                              containerClassName="rounded-lg"
                            />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 text-sm">{item.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.selectedSize && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase">Size: {item.selectedSize}</span>
                              )}
                              {item.selectedColor && (
                                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-bold uppercase">Warna: {item.selectedColor}</span>
                              )}
                              {item.isSale ? (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">BELI</span>
                              ) : (
                                <span className="text-[10px] bg-nature-50 text-nature-700 px-1.5 py-0.5 rounded font-bold uppercase">SEWA</span>
                              )}
                            </div>
                            
                            {isPackage && packageContentString && (
                                <div className="text-[10px] text-gray-500 mt-1 flex items-start gap-1">
                                    <Layers size={10} className="mt-0.5 shrink-0"/>
                                    <span className="italic leading-tight">{packageContentString}</span>
                                </div>
                            )}

                            <p className="text-adventure-600 font-bold text-sm mt-1">
                              Rp{displayPrice.toLocaleString('id-ID')}
                              {!item.isSale && <span className="text-gray-400 text-xs font-normal"> /2hari</span>}
                            </p>
                            
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                                <button 
                                  onClick={() => onUpdateQuantity(item.id, -1, item.selectedSize, item.selectedColor)}
                                  className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-nature-600 text-sm active:scale-95 transition"
                                >-</button>
                                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => onUpdateQuantity(item.id, 1, item.selectedSize, item.selectedColor)}
                                  disabled={isMaxStock}
                                  className={`w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm text-sm active:scale-95 transition ${
                                    isMaxStock ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-nature-600'
                                  }`}
                                >+</button>
                              </div>
                              <button onClick={() => onRemoveItem(item.id, item.selectedSize, item.selectedColor)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition">
                                <Trash2 size={20} />
                              </button>
                            </div>
                            {isMaxStock && (
                              <p className="text-[10px] text-red-500 mt-1 italic font-medium">Stok maksimal tercapai</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-5">
                {hasRentalItems && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-3">
                    <AlertCircle size={18} className="text-yellow-600 mt-0.5" />
                    <div className="text-xs text-yellow-800">
                        <p className="font-bold">Info Durasi</p>
                        <p>Minimal sewa adalah <strong>2 Hari</strong> (Contoh: Ambil Sabtu, Kembali Minggu).</p>
                    </div>
                    </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition text-base"
                      placeholder="Contoh: Budi Santoso"
                      value={userDetails.name}
                      onChange={e => setUserDetails({...userDetails, name: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="tel" 
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition text-base"
                      placeholder="0812..."
                      value={userDetails.whatsapp}
                      onChange={e => setUserDetails({...userDetails, whatsapp: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domisili / Lokasi</label>
                  <div className="relative flex gap-2">
                    <div className="relative flex-1">
                        <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                          type="text" 
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition text-base"
                          placeholder="Kecamatan / Kota..."
                          value={userDetails.location}
                          onChange={e => setUserDetails({...userDetails, location: e.target.value})}
                        />
                    </div>
                    <button 
                        onClick={detectLocation}
                        disabled={isLocating}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 rounded-lg border border-gray-200 transition disabled:opacity-50"
                        title="Deteksi Lokasi GPS"
                    >
                        {isLocating ? <Loader2 className="animate-spin" size={20}/> : <LocateFixed size={20}/>}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 italic">Klik ikon target untuk isi otomatis via GPS, atau ketik manual.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Ambil</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-2 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition text-base font-medium"
                        value={userDetails.rentalDate}
                        onChange={e => setUserDetails({...userDetails, rentalDate: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  {hasRentalItems ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (Hari)</label>
                        <input 
                        type="number" 
                        min="2"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition font-bold text-center text-base"
                        value={userDetails.duration}
                        onChange={e => handleDurationChange(parseInt(e.target.value) || 2)}
                        />
                    </div>
                  ) : (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Durasi</label>
                        <input disabled className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-400 text-center text-base" value="-" />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setUserDetails({...userDetails, paymentMethod: 'cash'})}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        userDetails.paymentMethod === 'cash' 
                          ? 'border-nature-600 bg-nature-50 text-nature-700' 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-nature-200'
                      }`}
                    >
                      <Banknote size={24} className="mb-1" />
                      <span className="text-xs font-bold">Cash di Outlet</span>
                    </button>
                    
                    <button
                      onClick={() => setUserDetails({...userDetails, paymentMethod: 'transfer'})}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                        userDetails.paymentMethod === 'transfer' 
                          ? 'border-blue-600 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200'
                      }`}
                    >
                      <CreditCard size={24} className="mb-1" />
                      <span className="text-xs font-bold">Transfer (DP 50%)</span>
                    </button>
                  </div>
                  
                  {userDetails.paymentMethod === 'transfer' && (
                    <div className="mt-3 bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-800 animate-slide-in-right">
                       <p className="font-bold mb-1">Rekening Pembayaran DP:</p>
                       <ul className="list-disc pl-4 space-y-1 text-xs">
                         <li><strong>{storeConfig.bankName}:</strong> {storeConfig.bankAccount} ({storeConfig.bankHolder})</li>
                         <li className="mt-2 pt-2 border-t border-blue-200 font-bold">
                            Total Tagihan: Rp{total.toLocaleString('id-ID')}
                         </li>
                         <li className="text-nature-600 font-black">
                            Wajib DP (50%): Rp{dpValue.toLocaleString('id-ID')}
                         </li>
                         
                         <li className="mt-3 pt-2 border-t border-blue-200 list-none -ml-4">
                            <label className="block text-[10px] font-bold uppercase tracking-wide text-blue-900 mb-2 flex items-center gap-1">
                                <Upload size={12} /> Upload Bukti Transfer
                            </label>
                            
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    id="proof-upload"
                                    className="hidden" 
                                />
                                <label 
                                    htmlFor="proof-upload" 
                                    className={`
                                        flex flex-col items-center justify-center w-full p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all
                                        ${proofFile 
                                            ? 'border-green-400 bg-green-50 text-green-700' 
                                            : 'border-blue-300 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-500'}
                                    `}
                                >
                                    {proofFile ? (
                                        <>
                                            <CheckCircle size={28} className="mb-1 text-green-600" />
                                            <span className="text-xs font-bold">{proofFile.name}</span>
                                            <span className="text-[9px] mt-1 text-green-600">Klik untuk ganti file</span>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon size={28} className="mb-2 opacity-70" />
                                            <span className="text-xs font-bold">Pilih Foto / Ambil Gambar</span>
                                            <span className="text-[9px] mt-1 opacity-70">Format: JPG, PNG (Max 5MB)</span>
                                        </>
                                    )}
                                </label>
                            </div>
                         </li>
                       </ul>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold text-blue-800 text-sm mb-2">Rincian Harga Paket</h4>
                  <div className="space-y-1 mb-3">
                    {cartItems.map((item, idx) => {
                       const price = getItemPriceForDuration(item, userDetails.duration);
                       const durationLabel = item.isSale ? '' : ` (${userDetails.duration} hari)`;
                       
                       return (
                        <div key={idx} className="flex justify-between text-xs text-blue-600">
                            <span>
                                {item.name} 
                                {item.selectedSize && ` (${item.selectedSize})`} 
                                {item.selectedColor && ` (${item.selectedColor})`}
                                x{item.quantity}
                                {item.isSale ? ' (BELI)' : durationLabel}
                            </span>
                            <span>Rp{(price * item.quantity).toLocaleString('id-ID')}</span>
                        </div>
                       );
                    })}
                  </div>
                  
                  {hasRentalItems && (
                    <div className="flex justify-between text-sm text-blue-900 font-medium pt-2 border-t border-blue-200">
                        <span className="flex items-center gap-1"><Clock size={14} /> Wajib Kembali</span>
                        <span className="font-bold text-right max-w-[50%] leading-tight">{returnDateDisplay}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-bold text-blue-900 text-lg mt-3 pt-2 border-t border-blue-200/60">
                    <span>Total Bayar</span>
                    <span>Rp{total.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions (Sticky Bottom) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 border-t border-gray-100 bg-white/95 backdrop-blur-md pb-safe shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.1)] z-20">
             {step === 'cart' ? (
               <div className="flex gap-4 items-center">
                 <div className="flex-1">
                    <span className="text-gray-500 text-xs font-bold uppercase block mb-0.5">Estimasi</span>
                    <span className="font-black text-xl text-gray-900">
                      Rp{cartItems.reduce((acc, item) => {
                          const price = item.isSale ? (item.salePrice||0) : (item.price2Days || 0);
                          return acc + (price * item.quantity);
                      }, 0).toLocaleString('id-ID')}
                    </span>
                 </div>
                 <button 
                  onClick={() => setStep('details')}
                  disabled={cartItems.length === 0}
                  className="bg-nature-600 hover:bg-nature-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-nature-200 transition flex items-center gap-2 active:scale-95"
                 >
                   Isi Data <ArrowRight size={20} />
                 </button>
               </div>
             ) : (
               <div className="flex gap-3">
                 <button 
                   onClick={() => setStep('cart')}
                   className="px-4 py-4 border border-gray-300 rounded-2xl font-bold text-gray-700 hover:bg-gray-100 transition"
                 >
                   Kembali
                 </button>
                 <button 
                  onClick={handleCheckout}
                  disabled={!userDetails.name || !userDetails.whatsapp || isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-lg shadow-green-200 transition flex items-center justify-center gap-2 active:scale-[0.98]"
                 >
                   {isProcessing ? (
                     <>
                        <Loader2 className="animate-spin" size={20} /> Memproses...
                     </>
                   ) : (
                     <>
                        Pesan via WhatsApp
                     </>
                   )}
                 </button>
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
