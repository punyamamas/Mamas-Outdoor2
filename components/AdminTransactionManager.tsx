
import React, { useState, useEffect, useMemo } from 'react';
import { Eye, Trash2, User, Save, CheckCircle, PackagePlus, Search, Plus, Minus, X, AlertTriangle, Loader2, Printer, Calendar, Clock, DollarSign, RefreshCw, ShoppingCart, Wallet, CreditCard, ArrowRight } from 'lucide-react';
import { Transaction, Product, CartItem, UserDetails, UserRole } from '../types';
import { createTransaction, updateTransactionStatus, updateTransactionPayment, updateTransactionDetails, updateTransactionItems, applyTransactionFine, calculateItemPriceForDuration, recordPaymentLog } from '../services/transactionService';
import { printInvoice } from '../services/bluetoothPrinterService';
import { processStockReduction } from '../services/productService';
import ImageLoader from './ImageLoader';

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  products: Product[];
  onStatusUpdate: (id: string, newStatus: string) => Promise<boolean>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  totalCount: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  userRole?: UserRole;
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({ 
  transactions, 
  isLoading, 
  products, 
  onStatusUpdate, 
  onDeleteTransaction,
  onRefreshData,
  totalCount,
  currentPage,
  itemsPerPage,
  onPageChange,
  searchTerm,
  onSearchChange,
  filterStatus,
  onFilterChange,
  userRole = 'super_admin'
}) => {
  // --- STATES ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // EDIT STATES
  const [editTab, setEditTab] = useState<'status' | 'items' | 'payment'>('status');
  const [tempTrx, setTempTrx] = useState<Transaction | null>(null);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // PAYMENT STATES (NEW)
  const [payCash, setPayCash] = useState<number>(0);
  const [payTransfer, setPayTransfer] = useState<number>(0);

  // POS (Create Transaction) State
  const [newTrxDetails, setNewTrxDetails] = useState<UserDetails>({
    name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash'
  });
  const [newTrxItems, setNewTrxItems] = useState<CartItem[]>([]);
  const [newTrxSearch, setNewTrxSearch] = useState('');
  const [newTrxStatus, setNewTrxStatus] = useState('booked'); 
  const [newTrxPaid, setNewTrxPaid] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HELPERS ---
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const calculateTotal = (items: CartItem[], duration: number, fine: number = 0) => {
      const itemTotal = items.reduce((acc, item) => {
          const price = calculateItemPriceForDuration(item, duration);
          return acc + (price * item.quantity);
      }, 0);
      return itemTotal + fine;
  };

  // --- EFFECT: Init Edit State ---
  useEffect(() => {
      if (selectedTransaction) {
          setTempTrx(JSON.parse(JSON.stringify(selectedTransaction))); // Deep copy
          setPayCash(0);
          setPayTransfer(0);
      }
  }, [selectedTransaction]);

  // --- POS HANDLERS (CREATE) ---
  const posFilteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(newTrxSearch.toLowerCase()) && p.stock > 0
  );

  const handleAddItemToNewTrx = (product: Product) => {
    setNewTrxItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleUpdateItemQtyNewTrx = (id: string, delta: number) => {
    setNewTrxItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        const product = products.find(p => p.id === id);
        if (product && newQty > product.stock) {
            alert(`Stok hanya tersedia ${product.stock}`);
            return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(i => i.quantity > 0));
  };

  const handleRemoveItemFromNewTrx = (id: string) => {
    setNewTrxItems(prev => prev.filter(item => item.id !== id));
  };

  const handleCreateTransaction = async () => {
    if (!newTrxDetails.name || newTrxItems.length === 0) return alert("Data belum lengkap!");
    setIsSubmitting(true);

    const total = newTrxItems.reduce((acc, item) => acc + (calculateItemPriceForDuration(item, newTrxDetails.duration) * item.quantity), 0);
    
    const created = await createTransaction(
        newTrxDetails, 
        newTrxItems, 
        total, 
        undefined, 
        newTrxStatus, 
        newTrxPaid
    );

    if (created) {
        if (newTrxStatus === 'booked' || newTrxStatus === 'rented') {
            await processStockReduction(newTrxItems);
        }
        alert("✅ Transaksi Berhasil Dibuat!");
        setIsCreateModalOpen(false);
        setNewTrxItems([]);
        setNewTrxDetails({ name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash' });
        setNewTrxPaid(0);
        await onRefreshData();
    } else {
        alert("Gagal membuat transaksi.");
    }
    setIsSubmitting(false);
  };

  // --- EDIT HANDLERS (UPDATE) ---

  // 1. Update Status
  const handleEditStatus = async (newStatus: string) => {
      if (!tempTrx) return;
      setIsSaving(true);
      const success = await onStatusUpdate(tempTrx.id, newStatus);
      if (success) {
          setTempTrx({ ...tempTrx, status: newStatus as any });
          await onRefreshData(); 
      } else {
          alert("Gagal update status");
      }
      setIsSaving(false);
  };

  // 2. PROCESS PAYMENT (SPLIT CASH/TRANSFER + REAL INCOME LOGIC)
  const handleProcessPayment = async () => {
      if (!tempTrx) return;
      
      const totalBill = tempTrx.totalPrice;
      const alreadyPaid = tempTrx.amountPaid || 0;
      const remainingBill = Math.max(0, totalBill - alreadyPaid);
      const inputTotal = payCash + payTransfer;

      if (inputTotal <= 0) return alert("Masukkan nominal pembayaran (Tunai atau Transfer).");

      setIsSaving(true);

      // --- LOGIC UANG REAL (REAL INCOME) ---
      // Uang masuk ke sistem tidak boleh melebihi sisa tagihan.
      // Prioritas: Transfer dianggap pas dulu, sisanya ambil dari Cash.
      
      let realTransferIncome = 0;
      let realCashIncome = 0;

      // 1. Hitung Transfer Real
      // Jika bayar pakai transfer, biasanya pas. Tapi kalau lebih, kita catat max sebesar sisa tagihan.
      if (payTransfer > 0) {
          realTransferIncome = Math.min(payTransfer, remainingBill);
      }

      // Sisa tagihan setelah dipotong transfer
      const remainingAfterTransfer = Math.max(0, remainingBill - realTransferIncome);

      // 2. Hitung Cash Real
      // Cash yang masuk ke laci = Input Cash - Kembalian
      // Kembalian = (Total Input - Sisa Tagihan)
      // Jadi Real Cash = Input Cash - (Input Cash + Input Transfer - Sisa Tagihan) ... Simplified logic below:
      
      if (payCash > 0) {
          // Real Cash adalah sisa tagihan yang belum tertutup transfer, dicover oleh cash.
          realCashIncome = Math.min(payCash, remainingAfterTransfer);
      }

      const totalRealIncome = realTransferIncome + realCashIncome;
      const newAmountPaidTotal = alreadyPaid + totalRealIncome;
      const changeAmount = Math.max(0, inputTotal - remainingBill); // Kembalian

      // 3. Update Transaction Record
      const success = await updateTransactionPayment(tempTrx.id, newAmountPaidTotal);

      if (success) {
          // 4. Log Finance (HANYA UANG REAL)
          if (realTransferIncome > 0) {
              await recordPaymentLog({
                  transaction_id: tempTrx.id,
                  amount: realTransferIncome,
                  payment_method: 'transfer',
                  type: 'IN',
                  category: 'Sewa',
                  description: `Pelunasan Sewa #${tempTrx.id.slice(0,6)} (Transfer)`
              });
          }
          if (realCashIncome > 0) {
              await recordPaymentLog({
                  transaction_id: tempTrx.id,
                  amount: realCashIncome,
                  payment_method: 'cash',
                  type: 'IN',
                  category: 'Sewa',
                  description: `Pelunasan Sewa #${tempTrx.id.slice(0,6)} (Tunai)`
              });
          }

          // Auto update status to BOOKED if fully paid & current status is Pending
          if (newAmountPaidTotal >= totalBill && tempTrx.status === 'pending') {
               await onStatusUpdate(tempTrx.id, 'booked');
               setTempTrx({...tempTrx, amountPaid: newAmountPaidTotal, status: 'booked'});
          } else {
               setTempTrx({...tempTrx, amountPaid: newAmountPaidTotal});
          }

          // Reset inputs
          setPayCash(0);
          setPayTransfer(0);
          await onRefreshData();
          
          // Show Alert with Change Info
          alert(`✅ Pembayaran Berhasil!\n\n💵 Masuk Kas: Rp${totalRealIncome.toLocaleString('id-ID')}\n🔄 Kembalian: Rp${changeAmount.toLocaleString('id-ID')}`);
      } else {
          alert("Gagal memproses pembayaran.");
      }

      setIsSaving(false);
  };

  // 3. Apply Fine Logic
  const handleApplyFine = async (fine: number) => {
      if (!tempTrx) return;
      setIsSaving(true);
      const success = await applyTransactionFine(tempTrx.id, fine);
      if (success) {
          // Log Fine as Income (Optional: or wait until paid)
          // For now just update bill
          const newTotal = (tempTrx.totalPrice - (tempTrx.fineAmount || 0)) + fine;
          setTempTrx({ ...tempTrx, fineAmount: fine, totalPrice: newTotal });
          await onRefreshData();
      }
      setIsSaving(false);
  };

  // ... (Other handlers unchanged: handleSaveInfo, handleEditItemQty, etc.)
  const handleSaveInfo = async () => {
      if (!tempTrx) return;
      setIsSaving(true);
      await updateTransactionDetails(tempTrx.id, {
          customerName: tempTrx.customerName,
          customerWhatsapp: tempTrx.customerWhatsapp,
          customerIdentity: tempTrx.customerIdentity
      });
      const newTotal = calculateTotal(tempTrx.items, tempTrx.duration, tempTrx.fineAmount);
      await updateTransactionItems(tempTrx.id, tempTrx.items, newTotal);
      setTempTrx({ ...tempTrx, totalPrice: newTotal });
      await onRefreshData();
      alert("Data berhasil diperbarui!");
      setIsSaving(false);
  };

  const handleEditItemQty = (idx: number, delta: number) => {
      if (!tempTrx) return;
      const newItems = [...tempTrx.items];
      const item = newItems[idx];
      const newQty = Math.max(1, item.quantity + delta);
      newItems[idx] = { ...item, quantity: newQty };
      const newTotal = calculateTotal(newItems, tempTrx.duration, tempTrx.fineAmount);
      setTempTrx({ ...tempTrx, items: newItems, totalPrice: newTotal });
  };

  const handleEditRemoveItem = (idx: number) => {
      if (!tempTrx) return;
      if (window.confirm("Hapus item ini dari transaksi?")) {
          const newItems = tempTrx.items.filter((_, i) => i !== idx);
          const newTotal = calculateTotal(newItems, tempTrx.duration, tempTrx.fineAmount);
          setTempTrx({ ...tempTrx, items: newItems, totalPrice: newTotal });
      }
  };

  const handleEditAddItem = (product: Product) => {
      if (!tempTrx) return;
      const newItems = [...tempTrx.items];
      const existingIdx = newItems.findIndex(i => i.id === product.id);
      if (existingIdx >= 0) {
          newItems[existingIdx].quantity += 1;
      } else {
          newItems.push({ ...product, quantity: 1 });
      }
      const newTotal = calculateTotal(newItems, tempTrx.duration, tempTrx.fineAmount);
      setTempTrx({ ...tempTrx, items: newItems, totalPrice: newTotal });
      setAddItemSearch(''); 
  };

  const handleSaveItems = async () => {
      if (!tempTrx) return;
      setIsSaving(true);
      const success = await updateTransactionItems(tempTrx.id, tempTrx.items, tempTrx.totalPrice);
      if (success) {
          await onRefreshData();
          alert("Perubahan item disimpan!");
      } else {
          alert("Gagal menyimpan item.");
      }
      setIsSaving(false);
  };

  const editAddProducts = products.filter(p => p.name.toLowerCase().includes(addItemSearch.toLowerCase()) && p.stock > 0);

  // Render Helper for Edit Modal Payment Calculation
  const remainingBillEdit = tempTrx ? Math.max(0, tempTrx.totalPrice - (tempTrx.amountPaid || 0)) : 0;
  const inputTotalEdit = payCash + payTransfer;
  const changeEdit = inputTotalEdit - remainingBillEdit;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
      
      {/* --- HEADER & FILTER --- */}
      <div className="p-5 border-b border-gray-100 bg-nature-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari Transaksi / Pelanggan..." 
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
           </div>
           <select 
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white font-bold"
              value={filterStatus}
              onChange={(e) => onFilterChange(e.target.value)}
           >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="booked">Booked (Lunas)</option>
              <option value="rented">Sedang Sewa</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Batal</option>
           </select>
        </div>

        <button 
             onClick={() => setIsCreateModalOpen(true)}
             className="flex items-center gap-2 bg-nature-600 hover:bg-nature-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition w-full md:w-auto justify-center"
           >
             <PackagePlus size={18} /> Buat Transaksi (POS)
        </button>
      </div>

      {/* --- TRANSACTION TABLE --- */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <table className="w-full text-sm text-left text-gray-600 hidden md:table">
          <thead className="bg-white text-gray-700 font-bold uppercase text-xs border-b border-gray-200 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-4">ID & Tanggal</th>
              <th className="px-6 py-4">Pelanggan</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
                <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-nature-600"/></td></tr>
            ) : transactions.map(trx => (
                <tr key={trx.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => { setSelectedTransaction(trx); setIsEditModalOpen(true); setEditTab('status'); }}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">#{trx.id.slice(0,8)}</div>
                    <div className="text-xs text-gray-500">{new Date(trx.rentalDate).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{trx.customerName}</div>
                    <div className="text-xs text-gray-400">{trx.customerWhatsapp}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        trx.status === 'booked' ? 'bg-blue-100 text-blue-700' :
                        trx.status === 'rented' ? 'bg-purple-100 text-purple-700' :
                        trx.status === 'completed' ? 'bg-green-100 text-green-700' :
                        trx.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>{trx.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                    Rp{trx.totalPrice.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => printInvoice(trx)}
                        className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition"
                        title="Cetak Nota"
                      >
                        <Printer size={18}/>
                      </button>

                      <button onClick={() => { setSelectedTransaction(trx); setIsEditModalOpen(true); setEditTab('status'); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"><Eye size={18}/></button>
                      
                      {userRole !== 'staff' && (
                          <button onClick={() => onDeleteTransaction(trx.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button>
                      )}
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
        
        {/* Mobile View */}
        <div className="md:hidden p-4 space-y-4">
            {transactions.map(trx => (
                <div key={trx.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm" onClick={() => { setSelectedTransaction(trx); setIsEditModalOpen(true); setEditTab('status'); }}>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="font-bold text-gray-900">#{trx.id.slice(0,6)}</div>
                            <div className="text-xs text-gray-500">{trx.customerName}</div>
                        </div>
                        <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded uppercase">{trx.status}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-nature-700 mt-2">
                        <span>Rp{trx.totalPrice.toLocaleString('id-ID')}</span>
                        <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); printInvoice(trx); }} className="bg-gray-100 text-gray-700 p-2 rounded-lg">
                                <Printer size={16}/>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center text-sm">
         <span className="text-gray-500 hidden md:inline">Total {totalCount} Transaksi</span>
         <div className="flex gap-2">
            <button disabled={currentPage === 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">Prev</button>
            <span className="px-3 py-1 font-bold text-gray-700">{currentPage} / {totalPages || 1}</span>
            <button disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50">Next</button>
         </div>
      </div>

      {/* --- MODAL EDIT TRANSAKSI (THE BIG ONE) --- */}
      {isEditModalOpen && tempTrx && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-4xl h-[95vh] md:h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                
                {/* Header */}
                <div className="bg-nature-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            Edit Transaksi #{tempTrx.id.slice(0,8)}
                        </h3>
                        <p className="text-xs text-gray-500">Edit data, item, dan pembayaran secara realtime.</p>
                    </div>
                    <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white rounded-full transition"><X size={20}/></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white px-4">
                    <button onClick={() => setEditTab('status')} className={`px-4 py-3 text-sm font-bold border-b-2 transition ${editTab === 'status' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-500'}`}>1. Ringkasan & Bayar</button>
                    <button onClick={() => setEditTab('items')} className={`px-4 py-3 text-sm font-bold border-b-2 transition ${editTab === 'items' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-500'}`}>2. Edit Item & Durasi</button>
                    <button onClick={() => setEditTab('payment')} className={`px-4 py-3 text-sm font-bold border-b-2 transition ${editTab === 'payment' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-500'}`}>3. Info Pelanggan</button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    
                    {/* TAB 1: STATUS & PEMBAYARAN UTAMA */}
                    {editTab === 'status' && (
                        <div className="space-y-6">
                            {/* Status Card */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="w-full md:w-auto">
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Status Order</label>
                                    <select 
                                        className="w-full md:w-48 p-2 border border-gray-300 rounded-lg font-bold text-sm bg-gray-50"
                                        value={tempTrx.status}
                                        onChange={(e) => handleEditStatus(e.target.value)}
                                        disabled={isSaving}
                                    >
                                        <option value="pending">⏳ Pending (Belum DP)</option>
                                        <option value="booked">✅ Lunas / Booked</option>
                                        <option value="rented">⛺ Sedang Disewa</option>
                                        <option value="completed">🏁 Selesai</option>
                                        <option value="cancelled">❌ Dibatalkan</option>
                                    </select>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Total Tagihan</p>
                                    <p className="text-2xl font-black text-gray-900">Rp{tempTrx.totalPrice.toLocaleString('id-ID')}</p>
                                </div>
                            </div>

                            {/* Payment Section (Updated Logic) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
                                    <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-4"><DollarSign size={18}/> Input Pembayaran</h4>
                                    
                                    <div className="space-y-4">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Wallet size={12}/> Tunai (Cash)</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full p-2 border border-gray-300 rounded-lg font-bold text-gray-800"
                                                    placeholder="Rp 0"
                                                    value={payCash || ''}
                                                    onChange={(e) => setPayCash(Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><CreditCard size={12}/> Transfer</label>
                                                <input 
                                                    type="number" 
                                                    className="w-full p-2 border border-gray-300 rounded-lg font-bold text-gray-800"
                                                    placeholder="Rp 0"
                                                    value={payTransfer || ''}
                                                    onChange={(e) => setPayTransfer(Number(e.target.value))}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
                                            <div className="flex justify-between text-gray-600">
                                                <span>Sudah Masuk:</span>
                                                <span>Rp{(tempTrx.amountPaid || 0).toLocaleString('id-ID')}</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-blue-800 text-lg border-t border-blue-200 pt-1">
                                                <span>Sisa Tagihan:</span>
                                                <span>Rp{remainingBillEdit.toLocaleString('id-ID')}</span>
                                            </div>
                                            
                                            {/* Change Calculation Display */}
                                            {inputTotalEdit > 0 && (
                                                <div className={`flex justify-between font-bold mt-2 pt-2 border-t border-dashed border-blue-300 ${changeEdit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    <span>{changeEdit >= 0 ? 'Kembalian:' : 'Kurang Bayar:'}</span>
                                                    <span>Rp{Math.abs(changeEdit).toLocaleString('id-ID')}</span>
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={handleProcessPayment} 
                                            disabled={isSaving || inputTotalEdit <= 0} 
                                            className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin" size={16}/> : <ArrowRight size={16}/>} Proses Pembayaran
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm">
                                    <h4 className="font-bold text-red-900 flex items-center gap-2 mb-4"><AlertTriangle size={18}/> Denda / Charge</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Nominal Denda</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="number" 
                                                    className="flex-1 p-2 border border-gray-300 rounded-lg font-bold text-red-600"
                                                    value={tempTrx.fineAmount || 0}
                                                    onChange={(e) => setTempTrx({...tempTrx, fineAmount: Number(e.target.value)})}
                                                />
                                                <button onClick={() => handleApplyFine(tempTrx.fineAmount || 0)} disabled={isSaving} className="bg-red-600 text-white px-4 rounded-lg font-bold hover:bg-red-700 text-sm">Simpan</button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 italic">
                                            *Denda akan otomatis menambah total tagihan.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Print Actions */}
                            <div className="flex gap-3 pt-4">
                                <button onClick={() => printInvoice(tempTrx)} className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition">
                                    <Printer size={18}/> Cetak Nota Thermal
                                </button>
                                <button onClick={() => printInvoice(tempTrx, 'view', 'delivery')} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition">
                                    <CheckCircle size={18}/> Cetak Surat Jalan
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: EDIT ITEM & DURASI */}
                    {editTab === 'items' && (
                        <div className="space-y-6">
                            {/* Duration Control */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Durasi Sewa</label>
                                    <div className="flex items-center gap-2 mt-1">
                                        <button onClick={() => setTempTrx({...tempTrx, duration: Math.max(2, tempTrx.duration - 1)})} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Minus size={16}/></button>
                                        <span className="font-black text-lg w-8 text-center">{tempTrx.duration}</span>
                                        <button onClick={() => setTempTrx({...tempTrx, duration: tempTrx.duration + 1})} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Plus size={16}/></button>
                                        <span className="text-sm font-bold text-gray-600 ml-1">Hari</span>
                                    </div>
                                </div>
                                <button onClick={handleSaveInfo} disabled={isSaving} className="text-sm font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                                    Update Harga
                                </button>
                            </div>

                            {/* Add Item */}
                            <div className="relative">
                                <div className="flex gap-2">
                                    <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                                    <input 
                                        type="text" 
                                        placeholder="Cari alat untuk ditambahkan..." 
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-nature-500 outline-none"
                                        value={addItemSearch}
                                        onChange={(e) => setAddItemSearch(e.target.value)}
                                    />
                                </div>
                                {addItemSearch && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto z-20">
                                        {editAddProducts.map(p => (
                                            <button 
                                                key={p.id} 
                                                onClick={() => handleEditAddItem(p)}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 flex justify-between items-center"
                                            >
                                                <span className="font-bold text-sm text-gray-800">{p.name}</span>
                                                <span className="text-xs font-bold text-nature-600">Stok: {p.stock}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 font-bold text-gray-600 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3">Nama Alat</th>
                                            <th className="px-4 py-3 text-center">Qty</th>
                                            <th className="px-4 py-3 text-right">Harga</th>
                                            <th className="px-4 py-3 text-center">Hapus</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {tempTrx.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-3 font-medium">{item.name}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => handleEditItemQty(idx, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Minus size={12}/></button>
                                                        <span className="font-bold w-4">{item.quantity}</span>
                                                        <button onClick={() => handleEditItemQty(idx, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Plus size={12}/></button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    Rp{(calculateItemPriceForDuration(item, tempTrx.duration) * item.quantity).toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleEditRemoveItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <button onClick={handleSaveItems} disabled={isSaving} className="w-full py-3 bg-nature-600 text-white rounded-xl font-bold hover:bg-nature-700 shadow-lg flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>} Simpan Perubahan Item
                            </button>
                        </div>
                    )}

                    {/* TAB 3: INFO PELANGGAN */}
                    {editTab === 'payment' && (
                        <div className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><User size={18}/> Data Pelanggan</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Nama Lengkap</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={tempTrx.customerName} onChange={(e) => setTempTrx({...tempTrx, customerName: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">WhatsApp</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={tempTrx.customerWhatsapp} onChange={(e) => setTempTrx({...tempTrx, customerWhatsapp: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Jaminan (KTP/KTM)</label>
                                    <input type="text" className="w-full p-2 border rounded-lg" value={tempTrx.customerIdentity || ''} onChange={(e) => setTempTrx({...tempTrx, customerIdentity: e.target.value})} />
                                </div>
                            </div>
                            <button onClick={handleSaveInfo} disabled={isSaving} className="w-full py-3 mt-4 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 flex items-center justify-center gap-2">
                                <Save size={18}/> Simpan Data Pelanggan
                            </button>
                        </div>
                    )}

                </div>
             </div>
          </div>
      )}

      {/* --- CREATE TRANSACTION MODAL (POS) - Same as before --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-2xl w-full max-w-5xl h-[95vh] md:h-[90vh] shadow-2xl flex flex-col md:flex-row overflow-hidden animate-scale-up">
              {/* Left Panel: Catalog */}
              <div className="w-full md:w-3/5 bg-gray-50 flex flex-col border-r border-gray-200">
                 <div className="p-4 bg-white border-b border-gray-200">
                    <div className="relative">
                       <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
                       <input 
                         type="text" 
                         placeholder="Cari Barang (Ketik nama...)" 
                         className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-xl border-none outline-none focus:ring-2 focus:ring-nature-500"
                         value={newTrxSearch}
                         onChange={e => setNewTrxSearch(e.target.value)}
                         autoFocus
                       />
                    </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
                    {posFilteredProducts.map(product => (
                       <button 
                         key={product.id}
                         onClick={() => handleAddItemToNewTrx(product)}
                         disabled={product.stock <= 0}
                         className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-nature-500 transition text-left flex flex-col h-full disabled:opacity-60 disabled:cursor-not-allowed group"
                       >
                          <div className="relative w-full h-24 bg-gray-100 rounded-lg mb-2 overflow-hidden">
                             <ImageLoader src={product.image} alt={product.name} className="w-full h-full object-cover"/>
                             <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded font-bold">Stok {product.stock}</span>
                          </div>
                          <h4 className="font-bold text-gray-800 text-xs line-clamp-2 mb-auto group-hover:text-nature-600">{product.name}</h4>
                          <p className="text-nature-700 font-black text-xs mt-1">Rp{product.price2Days.toLocaleString('id-ID')}</p>
                       </button>
                    ))}
                 </div>
              </div>
              {/* Right Panel: Cart */}
              <div className="w-full md:w-2/5 bg-white flex flex-col h-full">
                 <div className="p-4 bg-nature-600 text-white flex justify-between items-center shadow-md shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2"><PackagePlus size={20}/> Kasir / POS</h3>
                    <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X size={20}/></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3">
                       <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2"><User size={14}/> Data Pelanggan</h4>
                       <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Nama Pelanggan" className="px-3 py-2 border rounded-lg text-sm" value={newTrxDetails.name} onChange={e => setNewTrxDetails({...newTrxDetails, name: e.target.value})} />
                          <input type="text" placeholder="WhatsApp (08...)" className="px-3 py-2 border rounded-lg text-sm" value={newTrxDetails.whatsapp} onChange={e => setNewTrxDetails({...newTrxDetails, whatsapp: e.target.value})} />
                       </div>
                       <div className="grid grid-cols-2 gap-2">
                          <input type="date" className="px-3 py-2 border rounded-lg text-sm" value={newTrxDetails.rentalDate} onChange={e => setNewTrxDetails({...newTrxDetails, rentalDate: e.target.value})} />
                          <div className="flex items-center bg-white border rounded-lg px-2">
                             <input type="number" min="2" className="w-full py-2 text-sm outline-none font-bold text-center" value={newTrxDetails.duration} onChange={e => setNewTrxDetails({...newTrxDetails, duration: Number(e.target.value)})} />
                             <span className="text-xs text-gray-500 mr-2">Hari</span>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-2">
                        {newTrxItems.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">Keranjang Kosong</div>
                        ) : (
                            newTrxItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-white border border-gray-100 rounded-lg shadow-sm">
                                    <div className="flex-1">
                                        <div className="font-bold text-xs text-gray-800 line-clamp-1">{item.name}</div>
                                        <div className="text-[10px] text-nature-600 font-medium">@ Rp{calculateItemPriceForDuration(item, newTrxDetails.duration).toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleUpdateItemQtyNewTrx(item.id, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Minus size={12}/></button>
                                        <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                                        <button onClick={() => handleUpdateItemQtyNewTrx(item.id, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Plus size={12}/></button>
                                        <button onClick={() => handleRemoveItemFromNewTrx(item.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                 </div>
                 <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-gray-600">Total Tagihan</span>
                        <span className="text-xl font-black text-nature-700">
                            Rp{newTrxItems.reduce((acc, item) => acc + (calculateItemPriceForDuration(item, newTrxDetails.duration) * item.quantity), 0).toLocaleString('id-ID')}
                        </span>
                    </div>
                    <button 
                        onClick={handleCreateTransaction} 
                        disabled={isSubmitting || newTrxItems.length === 0}
                        className="w-full py-3 bg-nature-600 text-white rounded-xl font-bold hover:bg-nature-700 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} Proses Transaksi
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
