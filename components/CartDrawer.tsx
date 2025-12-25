import React, { useState } from 'react';
import { X, Trash2, Calendar, Phone, User, School, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { CartItem, UserDetails, Transaction } from '../types';
import { WA_NUMBER } from '../constants';
import { processStockReduction } from '../services/productService';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number, size?: string, color?: string) => void;
  onRemoveItem: (id: string, size?: string, color?: string) => void;
  onClearCart: () => void;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onClearCart }) => {
  const [step, setStep] = useState<'cart' | 'details'>('cart');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails>({
    name: '',
    whatsapp: '',
    campus: '',
    rentalDate: new Date().toISOString().split('T')[0],
    duration: 2 // Minimal 2 hari
  });

  // Fungsi helper hitung harga item berdasarkan durasi
  const getItemPriceForDuration = (item: CartItem, days: number): number => {
    // Safety check: jika item format lama, gunakan default 0
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
    else unitPrice = p7 + ((days - 7) * (p2 * 0.4)); // Fallback logis jika > 7 hari

    return unitPrice;
  };

  // Helper untuk mendapatkan max stok item di cart (Duplikasi logic dari App.tsx agar UI responsif)
  const getAvailableStock = (item: CartItem): number => {
    if (item.variants && item.variants.length > 0 && item.selectedSize && item.selectedColor) {
      const variant = item.variants.find(v => v.size === item.selectedSize && v.color === item.selectedColor);
      return variant ? variant.stock : 0;
    }
    if (item.sizes && item.selectedSize && Object.keys(item.sizes).length > 0) {
       return item.sizes[item.selectedSize] || 0;
    }
    return item.stock || 0;
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const itemPriceTotal = getItemPriceForDuration(item, userDetails.duration) * item.quantity;
      return sum + itemPriceTotal;
    }, 0);
  };

  const total = calculateTotal();

  const handleCheckout = async () => {
    setIsProcessing(true);
    
    // 1. Process Stock Reduction (New Feature)
    // Ini akan mengurangi stok paket DAN stok komponen di dalamnya
    await processStockReduction(cartItems);

    // 2. Save Transaction to Local History
    const newTransaction: Transaction = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      rentalDate: userDetails.rentalDate,
      duration: userDetails.duration,
      totalPrice: total,
      items: [...cartItems],
      status: 'pending'
    };

    const existingHistory = localStorage.getItem('mamasHistory');
    const history = existingHistory ? JSON.parse(existingHistory) : [];
    history.push(newTransaction);
    localStorage.setItem('mamasHistory', JSON.stringify(history));

    // 3. Construct WhatsApp Message
    const header = `*Halo Mamas Outdoor! Saya mau sewa dong.*\n\n`;
    const buyerInfo = `*Data Penyewa:*\nNama: ${userDetails.name}\nKampus: ${userDetails.campus}\nWA: ${userDetails.whatsapp}\nTanggal Ambil: ${userDetails.rentalDate}\nLama Sewa: ${userDetails.duration} Hari\n\n`;
    
    const itemsList = cartItems.map((item, idx) => {
      const priceForDuration = getItemPriceForDuration(item, userDetails.duration);
      const sizeLabel = item.selectedSize ? ` [Size: ${item.selectedSize}]` : '';
      const colorLabel = item.selectedColor ? ` [Warna: ${item.selectedColor}]` : '';
      return `${idx + 1}. ${item.name}${sizeLabel}${colorLabel} (${item.quantity}x)\n   @ Rp${priceForDuration.toLocaleString('id-ID')} (Paket ${userDetails.duration} Hari)`;
    }).join('\n');

    const footer = `\n\n*Total Estimasi: Rp${total.toLocaleString('id-ID')}*`;
    
    const fullMessage = encodeURIComponent(header + buyerInfo + "*List Alat:*\n" + itemsList + footer);
    
    setIsProcessing(false);
    
    // 4. Open WhatsApp
    window.open(`https://wa.me/${WA_NUMBER}?text=${fullMessage}`, '_blank');
    
    // 5. Reset & Close
    onClearCart();
    setStep('cart');
    onClose();
  };

  const handleDurationChange = (val: number) => {
    // Enforce minimal 2 hari
    const newDuration = val < 2 ? 2 : val;
    setUserDetails(prev => ({ ...prev, duration: newDuration }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full animate-slide-in-right">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-nature-50">
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'cart' ? 'Keranjang Belanja' : 'Detail Penyewa'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'cart' ? (
              <>
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
                    <div className="bg-gray-100 p-4 rounded-full">
                       <School size={40} className="text-gray-400" />
                    </div>
                    <p>Keranjangmu masih kosong nih.</p>
                    <button onClick={onClose} className="text-nature-600 font-medium hover:underline">
                      Cari alat dulu yuk
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {cartItems.map(item => {
                      // Gunakan fallback untuk display
                      const displayPrice = item.price2Days || 0;
                      // Unique key combining ID, Size, and Color
                      const itemKey = `${item.id}-${item.selectedSize || 'default'}-${item.selectedColor || 'default'}`;
                      
                      const maxStock = getAvailableStock(item);
                      const isMaxStock = item.quantity >= maxStock;

                      return (
                        <div key={itemKey} className="flex gap-4">
                          <img src={item.image} alt={item.name} className="w-20 h-20 object-cover rounded-lg bg-gray-100" />
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 text-sm">{item.name}</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.selectedSize && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase">Size: {item.selectedSize}</span>
                              )}
                              {item.selectedColor && (
                                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-bold uppercase">Warna: {item.selectedColor}</span>
                              )}
                            </div>
                            <p className="text-adventure-600 font-bold text-sm mt-1">
                              Rp{displayPrice.toLocaleString('id-ID')}<span className="text-gray-400 text-xs font-normal"> /2hari</span>
                            </p>
                            
                            <div className="flex items-center justify-between mt-3">
                              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                                <button 
                                  onClick={() => onUpdateQuantity(item.id, -1, item.selectedSize, item.selectedColor)}
                                  className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-nature-600 text-xs"
                                >-</button>
                                <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => onUpdateQuantity(item.id, 1, item.selectedSize, item.selectedColor)}
                                  disabled={isMaxStock}
                                  className={`w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-xs transition ${
                                    isMaxStock ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:text-nature-600'
                                  }`}
                                >+</button>
                              </div>
                              <button onClick={() => onRemoveItem(item.id, item.selectedSize, item.selectedColor)} className="text-red-400 hover:text-red-600 p-1">
                                <Trash2 size={18} />
                              </button>
                            </div>
                            {isMaxStock && (
                              <p className="text-[10px] text-red-500 mt-1 italic">Stok maksimal</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-start gap-3">
                  <AlertCircle size={18} className="text-yellow-600 mt-0.5" />
                  <div className="text-xs text-yellow-800">
                    <p className="font-bold">Info Durasi</p>
                    <p>Minimal sewa adalah <strong>2 Hari</strong> (Contoh: Ambil Sabtu, Kembali Minggu).</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition"
                      placeholder="Contoh: Budi Santoso"
                      value={userDetails.name}
                      onChange={e => setUserDetails({...userDetails, name: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Asal Kampus / Instansi</label>
                  <div className="relative">
                    <School className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition"
                      placeholder="Contoh: UNSOED"
                      value={userDetails.campus}
                      onChange={e => setUserDetails({...userDetails, campus: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                      type="tel" 
                      className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition"
                      placeholder="0812..."
                      value={userDetails.whatsapp}
                      onChange={e => setUserDetails({...userDetails, whatsapp: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Ambil</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input 
                        type="date" 
                        className="w-full pl-10 pr-2 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition text-sm"
                        value={userDetails.rentalDate}
                        onChange={e => setUserDetails({...userDetails, rentalDate: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durasi (Hari)</label>
                    <input 
                      type="number" 
                      min="2"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition font-bold text-center"
                      value={userDetails.duration}
                      onChange={e => handleDurationChange(parseInt(e.target.value) || 2)}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mt-6">
                  <h4 className="font-semibold text-blue-800 text-sm mb-2">Rincian Harga Paket</h4>
                  <div className="space-y-1 mb-3">
                    {cartItems.map((item, idx) => (
                       <div key={idx} className="flex justify-between text-xs text-blue-600">
                         <span>
                            {item.name} 
                            {item.selectedSize && ` (${item.selectedSize})`} 
                            {item.selectedColor && ` (${item.selectedColor})`}
                            x{item.quantity}
                         </span>
                         <span>Rp{(getItemPriceForDuration(item, userDetails.duration) * item.quantity).toLocaleString('id-ID')}</span>
                       </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm text-blue-800 font-medium pt-2 border-t border-blue-200">
                    <span>Durasi Sewa</span>
                    <span>{userDetails.duration} Hari</span>
                  </div>
                  <div className="flex justify-between font-bold text-blue-900 text-lg mt-1">
                    <span>Total Bayar</span>
                    <span>Rp{total.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-100 bg-gray-50">
             {step === 'cart' ? (
               <>
                 <div className="flex justify-between mb-4">
                    <span className="text-gray-600 text-sm">Estimasi (Paket Min. 2 Hari)</span>
                    <span className="font-bold text-xl text-gray-900">
                      {/* Show estimate based on min 2 days */}
                      Rp{cartItems.reduce((acc, item) => acc + ((item.price2Days || 0) * item.quantity), 0).toLocaleString('id-ID')}
                    </span>
                 </div>
                 <button 
                  onClick={() => setStep('details')}
                  disabled={cartItems.length === 0}
                  className="w-full bg-nature-600 hover:bg-nature-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-nature-200 transition flex items-center justify-center gap-2"
                 >
                   Lanjut Isi Data <ArrowRight size={20} />
                 </button>
               </>
             ) : (
               <div className="flex gap-3">
                 <button 
                   onClick={() => setStep('cart')}
                   className="px-4 py-3.5 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-100 transition"
                 >
                   Kembali
                 </button>
                 <button 
                  onClick={handleCheckout}
                  disabled={!userDetails.name || !userDetails.whatsapp || isProcessing}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-200 transition flex items-center justify-center gap-2"
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