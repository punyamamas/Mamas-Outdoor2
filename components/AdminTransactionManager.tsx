import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Calendar, Eye, Trash2, X, User, CreditCard, Banknote, ArrowRightLeft, Save, Calculator, CheckCircle, RotateCcw, Wallet, Edit, Plus, Minus, Search, ShoppingBag } from 'lucide-react';
import { Transaction, Product, CartItem } from '../types';
import { updateTransactionPayment, updateTransactionItems } from '../services/transactionService';

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  products?: Product[]; // Added prop to select products when editing
  onStatusUpdate: (id: string, status: string) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({
  transactions,
  isLoading,
  products = [],
  onStatusUpdate,
  onDeleteTransaction,
  onRefreshData
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // State: Nominal yang SEDANG diketik (Pembayaran Baru) - DIBAGI DUA
  const [cashInput, setCashInput] = useState<number>(0);
  const [transferInput, setTransferInput] = useState<number>(0);
  
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // --- EDIT ITEMS STATES ---
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState<CartItem[]>([]);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // Reset input ke 0 setiap kali modal dibuka
  useEffect(() => {
    if (selectedTransaction) {
      setCashInput(0); 
      setTransferInput(0);
      setIsEditingItems(false);
      setEditedItems(selectedTransaction.items);
    }
  }, [selectedTransaction]);

  // Kalkulasi Realtime untuk Tampilan Kasir
  const calculateFinancials = () => {
    if (!selectedTransaction) return { total: 0, prevPaid: 0, finalPaid: 0, remaining: 0, isLunas: false, isKembalian: false, currentInputTotal: 0 };

    const total = selectedTransaction.totalPrice;
    const prevPaid = selectedTransaction.amountPaid || 0;
    
    // Total Masuk Sesi Ini = Cash + Transfer
    const currentInputTotal = cashInput + transferInput;

    // Total Akhir = Uang yang sudah masuk duluan + Uang yang baru diinput sekarang
    const finalPaid = prevPaid + currentInputTotal;
    
    const remaining = total - finalPaid;
    const isLunas = remaining <= 0;
    const isKembalian = remaining < 0;

    return { total, prevPaid, finalPaid, remaining, isLunas, isKembalian, currentInputTotal };
  };

  const { total, prevPaid, remaining, isLunas, isKembalian, currentInputTotal } = calculateFinancials();

  const handleSavePayment = async () => {
    if (!selectedTransaction) return;
    setIsSavingPayment(true);
    
    const finalPaid = (selectedTransaction.amountPaid || 0) + cashInput + transferInput;
    
    // KETERANGAN UNTUK LOG KEUANGAN
    const isDP = (selectedTransaction.amountPaid || 0) === 0 && (selectedTransaction.totalPrice - finalPaid) > 0;
    const isPelunasan = (selectedTransaction.totalPrice - finalPaid) <= 0;
    const desc = isDP ? "Pembayaran DP" : isPelunasan ? "Pelunasan" : "Cicilan Tambahan";

    // Update Transaction & Create Log
    const result = await updateTransactionPayment(
      selectedTransaction.id, 
      finalPaid,
      // Pass log details
      {
        cashAmount: cashInput,
        transferAmount: transferInput,
        description: `${desc} (${selectedTransaction.customerName})`
      }
    );
    
    if (result.success) {
      // 1. Refresh Data Tabel Utama
      if (onRefreshData) {
        await onRefreshData();
      }

      // 2. Update State Lokal (Agar modal mencerminkan perubahan tanpa tutup)
      const updatedTrx = { 
        ...selectedTransaction, 
        amountPaid: finalPaid,
        status: result.newStatus ? (result.newStatus as any) : selectedTransaction.status
      };
      
      setSelectedTransaction(updatedTrx);
      setCashInput(0);
      setTransferInput(0);
      
      alert(`Pembayaran tersimpan & tercatat di Keuangan!`);
      
    } else {
      alert(`Gagal update pembayaran: ${result.error || 'Terjadi kesalahan sistem'}`);
    }
    setIsSavingPayment(false);
  };

  // --- ITEM EDITING FUNCTIONS ---
  
  const handleAddItem = (product: Product, variantKey?: string) => {
    // Check if item exists in editedItems (Match ID & Variant)
    let selectedSize = undefined;
    let selectedColor = undefined;
    
    if (variantKey) {
        const [color, size] = variantKey.split('|');
        selectedColor = color;
        selectedSize = size;
    }

    const existingIndex = editedItems.findIndex(i => 
       i.id === product.id && 
       i.selectedSize === selectedSize && 
       i.selectedColor === selectedColor
    );

    if (existingIndex >= 0) {
        // Increment Qty
        const newItems = [...editedItems];
        newItems[existingIndex].quantity += 1;
        setEditedItems(newItems);
    } else {
        // Add new item
        const newItem: CartItem = {
            ...product,
            quantity: 1,
            selectedSize,
            selectedColor
        };
        setEditedItems([...editedItems, newItem]);
    }
    setItemSearchTerm(''); // Clear search
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
      const newItems = [...editedItems];
      const newQty = newItems[index].quantity + delta;
      if (newQty > 0) {
          newItems[index].quantity = newQty;
          setEditedItems(newItems);
      }
  };

  const handleRemoveItem = (index: number) => {
      if (confirm('Hapus item ini dari transaksi?')) {
          setEditedItems(editedItems.filter((_, i) => i !== index));
      }
  };

  const handleSaveEditedItems = async () => {
      if (!selectedTransaction) return;
      if (editedItems.length === 0) return alert("Transaksi tidak boleh kosong item!");
      
      setIsSavingItems(true);
      const success = await updateTransactionItems(selectedTransaction.id, editedItems);
      
      if (success) {
          if (onRefreshData) await onRefreshData();
          setIsEditingItems(false);
          // Perlu refresh selectedTransaction karena total harga berubah
          // Kita tutup modal saja biar data refresh dari parent
          setSelectedTransaction(null);
          alert("Item transaksi berhasil diupdate! Stok telah disesuaikan & Harga dikalkulasi ulang.");
      } else {
          alert("Gagal mengupdate item transaksi.");
      }
      setIsSavingItems(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-red-50 text-red-600 border-red-100';
      case 'partial_payment': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'booked': return 'bg-blue-50 text-blue-600 border-blue-100'; // Lunas / Booking
      case 'rented': return 'bg-purple-50 text-purple-600 border-purple-100'; // Sedang Sewa (Diambil)
      case 'completed': return 'bg-green-50 text-green-600 border-green-100';
      case 'cancelled': return 'bg-gray-100 text-gray-500 border-gray-200';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <ClipboardList size={18} /> Daftar Transaksi
        </h3>
      </div>

      {isLoading ? (
        <div className="p-10 text-center flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">ID / Tanggal</th>
                <th className="px-6 py-4">Penyewa</th>
                <th className="px-6 py-4">Keuangan</th>
                <th className="px-6 py-4">Status & Aksi</th>
                <th className="px-6 py-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(trx => {
                const paid = trx.amountPaid || 0;
                const totalTrx = trx.totalPrice;
                const isPaidOffTrx = paid >= totalTrx;
                
                return (
                  <tr key={trx.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 align-middle">
                      <div className="font-mono text-xs text-gray-500">#{trx.id.slice(0, 6)}</div>
                      <div className="text-xs font-bold text-gray-700 mt-1">
                        {new Date(trx.created_at || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="font-bold text-gray-900">{trx.customerName}</div>
                      <div className="text-xs text-gray-500">{trx.customerWhatsapp}</div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="font-bold text-nature-700">Rp{totalTrx.toLocaleString('id-ID')}</div>
                      <div className="mt-1">
                        {isPaidOffTrx ? (
                           <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">Lunas</span>
                        ) : paid === 0 ? (
                           <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Belum Bayar</span>
                        ) : (
                           <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold uppercase">
                             Sisa: Rp{(totalTrx - paid).toLocaleString('id-ID')}
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <select
                        value={trx.status}
                        onChange={(e) => onStatusUpdate(trx.id, e.target.value)}
                        className={`text-xs border rounded px-2 py-1.5 focus:ring-nature-500 outline-none w-40 font-bold cursor-pointer transition capitalize ${getStatusBadge(trx.status)}`}
                      >
                        <option value="pending" className="text-gray-600">Belum Bayar</option>
                        <option value="partial_payment" className="text-orange-600">Cicil (Belum Lunas)</option>
                        <option value="booked" className="text-blue-600">Booking (Siap Ambil)</option>
                        <option value="rented" className="text-purple-600">Sedang Sewa</option>
                        <option value="completed" className="text-green-600">Selesai (Kembali)</option>
                        <option value="cancelled" className="text-red-600">Dibatalkan</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      <button
                        onClick={() => setSelectedTransaction(trx)}
                        className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Belum ada transaksi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL KASIR INTERAKTIF */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)}></div>
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-slide-in-right md:animate-none flex flex-col max-h-[95vh]">
              
              {/* Header */}
              <div className="bg-nature-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20} /> Kasir & Detail Order</h3>
                    <p className="text-xs text-nature-200 font-mono mt-0.5">#{selectedTransaction.id.slice(0,8)} - {selectedTransaction.customerName}</p>
                 </div>
                 <button onClick={() => setSelectedTransaction(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    
                    {/* LEFT COLUMN: ITEM DETAILS (EDITABLE) */}
                    <div className="flex flex-col gap-4 order-2 xl:order-1">
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
                           <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                              <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><ShoppingBag size={16}/> Daftar Barang</h4>
                              {!isEditingItems ? (
                                 <button 
                                   onClick={() => setIsEditingItems(true)} 
                                   className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition flex items-center gap-1"
                                 >
                                    <Edit size={12}/> Ubah Order
                                 </button>
                              ) : (
                                 <div className="flex gap-2">
                                    <button 
                                      onClick={() => { setIsEditingItems(false); setEditedItems(selectedTransaction.items); }}
                                      className="text-xs bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-300"
                                    >
                                       Batal
                                    </button>
                                    <button 
                                      onClick={handleSaveEditedItems}
                                      disabled={isSavingItems}
                                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 flex items-center gap-1"
                                    >
                                       {isSavingItems ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Simpan
                                    </button>
                                 </div>
                              )}
                           </div>
                           
                           {/* Item List or Editor */}
                           <div className="p-4 flex-1">
                              {isEditingItems && (
                                 <div className="mb-4 relative z-20">
                                    <div className="relative">
                                       <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                       <input 
                                         type="text" 
                                         placeholder="Cari barang untuk ditambah..." 
                                         className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                         value={itemSearchTerm}
                                         onChange={e => setItemSearchTerm(e.target.value)}
                                       />
                                    </div>
                                    {itemSearchTerm && (
                                       <div className="absolute w-full bg-white shadow-xl border border-gray-100 rounded-b-lg mt-1 max-h-48 overflow-y-auto">
                                          {products
                                            .filter(p => p.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                                            .map(p => {
                                               const hasVariants = p.variants && p.variants.length > 0;
                                               return (
                                                  <div key={p.id} className="p-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-sm">
                                                     <div className="font-bold text-gray-800">{p.name}</div>
                                                     {hasVariants ? (
                                                         <div className="flex flex-wrap gap-1 mt-1">
                                                            {p.variants?.map((v, i) => (
                                                               <button 
                                                                 key={i} 
                                                                 onClick={() => handleAddItem(p, `${v.color}|${v.size}`)}
                                                                 className="text-[10px] bg-gray-100 hover:bg-blue-100 px-2 py-0.5 rounded border"
                                                               >
                                                                  {v.color} - {v.size}
                                                               </button>
                                                            ))}
                                                         </div>
                                                     ) : (
                                                         <button onClick={() => handleAddItem(p)} className="text-[10px] text-blue-600 font-bold mt-1 hover:underline">
                                                            + Tambah
                                                         </button>
                                                     )}
                                                  </div>
                                               );
                                            })}
                                       </div>
                                    )}
                                 </div>
                              )}

                              <div className="space-y-3">
                                 {(isEditingItems ? editedItems : selectedTransaction.items).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                                       <div>
                                          <div className="font-bold text-gray-800">{item.name}</div>
                                          <div className="text-[10px] text-gray-500 flex gap-2">
                                             {item.selectedSize && <span className="bg-gray-100 px-1 rounded">Size: {item.selectedSize}</span>}
                                             {item.selectedColor && <span className="bg-gray-100 px-1 rounded">Color: {item.selectedColor}</span>}
                                          </div>
                                       </div>
                                       
                                       <div className="flex items-center gap-3">
                                          {isEditingItems ? (
                                             <div className="flex items-center border rounded-lg bg-gray-50">
                                                <button onClick={() => handleUpdateItemQty(idx, -1)} className="p-1 hover:bg-gray-200 rounded-l-lg"><Minus size={12}/></button>
                                                <span className="w-8 text-center font-bold text-xs">{item.quantity}</span>
                                                <button onClick={() => handleUpdateItemQty(idx, 1)} className="p-1 hover:bg-gray-200 rounded-r-lg"><Plus size={12}/></button>
                                             </div>
                                          ) : (
                                             <span className="font-bold bg-gray-100 px-2 py-1 rounded text-xs">x{item.quantity}</span>
                                          )}
                                          
                                          {isEditingItems && (
                                             <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                                                <Trash2 size={14}/>
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* Customer Info */}
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                           <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2"><User size={14}/> Kontak Penyewa</h4>
                           <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-800">{selectedTransaction.customerName}</p>
                                <p className="text-sm text-gray-500">{selectedTransaction.customerWhatsapp}</p>
                              </div>
                              <a href={`https://wa.me/${selectedTransaction.customerWhatsapp}`} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 p-2 rounded-lg hover:bg-blue-100 transition">
                                    <ArrowRightLeft size={16} />
                              </a>
                           </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: FINANCIALS (PAYMENT) */}
                    <div className="order-1 xl:order-2">
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl shadow-sm h-full">
                           <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                              <Wallet size={16}/> Status Pembayaran
                           </h4>

                           <div className="space-y-4 mb-6">
                              <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-600">Total Tagihan</span>
                                 <span className="text-xl font-black text-gray-900">Rp{total.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-600">Sudah Dibayar</span>
                                 <span className="text-base font-bold text-green-600">Rp{prevPaid.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-300">
                                 <span className="text-xs font-bold text-gray-400 uppercase">Kekurangan</span>
                                 <span className="text-lg font-bold text-red-600">Rp{Math.max(0, total - prevPaid).toLocaleString('id-ID')}</span>
                              </div>
                           </div>

                           {/* Payment Inputs */}
                           <div className="space-y-3">
                              <label className="text-xs font-black text-gray-500 uppercase">Input Bayar Tambahan</label>
                              <div className="flex gap-2">
                                 <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Cash</span>
                                    <input 
                                      type="number" 
                                      className="w-full pl-12 pr-2 py-2 text-sm font-bold border rounded-lg outline-none focus:border-green-500"
                                      placeholder="0"
                                      value={cashInput === 0 ? '' : cashInput}
                                      onChange={(e) => setCashInput(Number(e.target.value))}
                                    />
                                 </div>
                                 <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">TF</span>
                                    <input 
                                      type="number" 
                                      className="w-full pl-10 pr-2 py-2 text-sm font-bold border rounded-lg outline-none focus:border-blue-500"
                                      placeholder="0"
                                      value={transferInput === 0 ? '' : transferInput}
                                      onChange={(e) => setTransferInput(Number(e.target.value))}
                                    />
                                 </div>
                              </div>
                              
                              <div className="flex gap-2">
                                 <button onClick={() => { setCashInput(0); setTransferInput(0); }} className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg"><RotateCcw size={16}/></button>
                                 <button 
                                   onClick={handleSavePayment}
                                   disabled={isSavingPayment || currentInputTotal === 0}
                                   className="flex-1 bg-nature-900 text-white font-bold py-2 rounded-lg hover:bg-nature-800 disabled:opacity-50 flex items-center justify-center gap-2"
                                 >
                                    {isSavingPayment ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} 
                                    Simpan Pembayaran
                                 </button>
                              </div>
                           </div>
                           
                           <div className={`mt-6 p-3 rounded-lg text-center text-sm font-bold border ${isLunas ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                              {isLunas ? 'STATUS: LUNAS' : 'STATUS: BELUM LUNAS'}
                           </div>
                        </div>
                    </div>
                 </div>

                 <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
                    <button 
                       onClick={() => {
                          const conf = window.confirm("Hapus transaksi ini permanen? Data tidak bisa kembali.");
                          if (conf) {
                             onDeleteTransaction(selectedTransaction.id);
                             setSelectedTransaction(null);
                          }
                       }}
                       className="flex items-center gap-2 text-red-400 hover:text-red-600 px-3 py-2 rounded-lg transition text-xs font-bold hover:bg-red-50"
                    >
                       <Trash2 size={14} /> Hapus Data Transaksi
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactionManager;