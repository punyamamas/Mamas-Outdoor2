
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardList, Loader2, Calendar, Eye, Trash2, X, User, CreditCard, Banknote, ArrowRightLeft, Save, Calculator, CheckCircle, RotateCcw, Wallet, Edit, Plus, Minus, Search, ShoppingBag, Printer, Filter, DollarSign, Receipt, BarChart3, TrendingUp, Lightbulb, AlertTriangle, ArrowUpRight, Share2, Image as ImageIcon, CreditCard as CardIcon, ExternalLink, QrCode, FileText, Clock, ShieldCheck, ChevronDown, ChevronUp, Upload, LogIn, LogOut, FileCheck, PackagePlus, Camera, RefreshCw } from 'lucide-react';
import { Transaction, Product, CartItem, UserDetails } from '../types';
import { updateTransactionPayment, updateTransactionItems, updateTransactionDetails, printInvoice, applyTransactionFine, calculateOverdueFine, copyInvoiceToClipboard, uploadPaymentProof, createTransaction, calculateItemPriceForDuration } from '../services/transactionService';
import { processStockReduction } from '../services/productService';
import QRScannerModal from './QRScannerModal'; 

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  products: Product[];
  onStatusUpdate: (id: string, newStatus: string) => Promise<boolean>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({ 
  transactions, 
  isLoading, 
  products, 
  onStatusUpdate, 
  onDeleteTransaction,
  onRefreshData 
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // --- EDIT MODE STATES ---
  const [isEditingData, setIsEditingData] = useState(false);
  const [editForm, setEditForm] = useState<{
    customerName: string;
    customerWhatsapp: string;
    rentalDate: string;
    duration: number;
    fineAmount: number;
  }>({ customerName: '', customerWhatsapp: '', rentalDate: '', duration: 0, fineAmount: 0 });

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // POS (Create Transaction) States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTrxDetails, setNewTrxDetails] = useState<UserDetails>({
    name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash'
  });
  const [newTrxItems, setNewTrxItems] = useState<CartItem[]>([]);
  const [newTrxSearch, setNewTrxSearch] = useState('');
  const [newTrxStatus, setNewTrxStatus] = useState('booked');
  const [newTrxPaid, setNewTrxPaid] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);

  // --- Filter Logic ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        t.customerName.toLowerCase().includes(searchLower) || 
        t.id.toLowerCase().includes(searchLower) ||
        (t.customerWhatsapp && t.customerWhatsapp.includes(searchLower));
      return matchesStatus && matchesSearch;
    });
  }, [transactions, filterStatus, searchTerm]);

  // --- Handlers ---
  const openEditModal = (trx: Transaction) => {
    setSelectedTransaction(trx);
    setIsEditingData(false); // Reset edit mode
    // Init form data
    setEditForm({
        customerName: trx.customerName,
        customerWhatsapp: trx.customerWhatsapp,
        rentalDate: trx.rentalDate.split('T')[0],
        duration: trx.duration,
        fineAmount: trx.fineAmount || 0
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedTransaction(null);
    setIsEditModalOpen(false);
  };

  // SMART RETURN LOGIC (Auto Detect Fine)
  const handleStatusChange = async (id: string, status: string) => {
    if (!selectedTransaction) return;

    // Logic Cek Denda Otomatis saat klik 'Completed'
    if (status === 'completed' && selectedTransaction.status === 'rented') {
        const potentialFine = calculateOverdueFine(selectedTransaction);
        
        // Jika ada potensi denda DAN belum ada denda tercatat di DB
        if (potentialFine > 0 && (selectedTransaction.fineAmount || 0) === 0) {
            const confirmFine = window.confirm(
                `⚠️ PERINGATAN KETERLAMBATAN!\n\n` +
                `Sistem mendeteksi keterlambatan pengembalian.\n` +
                `Estimasi Denda: Rp${potentialFine.toLocaleString('id-ID')}\n\n` +
                `Klik OK untuk MENERAPKAN denda otomatis & selesaikan.\n` +
                `Klik Cancel untuk mengabaikan denda (hanya selesaikan).`
            );

            if (confirmFine) {
                // Terapkan denda dulu
                await applyTransactionFine(id, potentialFine);
                // Update local state agar UI sync
                setSelectedTransaction(prev => prev ? { 
                    ...prev, 
                    fineAmount: potentialFine, 
                    totalPrice: prev.totalPrice + potentialFine 
                } : null);
            }
        }
    }

    // Lanjut update status
    await onStatusUpdate(id, status);
    if (selectedTransaction && selectedTransaction.id === id) {
        setSelectedTransaction({ ...selectedTransaction, status: status as any });
    }
  };

  const handlePaymentUpdate = async (amount: number) => {
    if (!selectedTransaction) return;
    const success = await updateTransactionPayment(selectedTransaction.id, amount);
    if (success) {
      setSelectedTransaction({ ...selectedTransaction, amountPaid: amount });
      onRefreshData();
    }
  };

  // NEW: Save Detail Changes
  const handleSaveDetails = async () => {
    if (!selectedTransaction) return;

    // 1. Cek apakah durasi berubah? Jika ya, recalculate harga
    let newTotalPrice = selectedTransaction.totalPrice;
    
    if (editForm.duration !== selectedTransaction.duration) {
        const newItemsPrice = selectedTransaction.items.reduce((acc, item) => {
            const price = calculateItemPriceForDuration(item, editForm.duration);
            return acc + (price * item.quantity);
        }, 0);
        // Total baru = Harga Barang Baru + Denda (jika ada)
        // Note: fineAmount di DB terpisah atau include? di createTransaction servicenya: total_price = item_price. Fine ditambah manual.
        // Jadi kita reset total price based on duration, lalu tambah fine yang diinput.
        newTotalPrice = newItemsPrice + editForm.fineAmount;
    } else {
        // Jika durasi sama, cuma update fine amount adjustment
        // Total Lama - Fine Lama + Fine Baru
        const oldFine = selectedTransaction.fineAmount || 0;
        newTotalPrice = (selectedTransaction.totalPrice - oldFine) + editForm.fineAmount;
    }

    // 2. Call Service Update Details
    // Kita perlu update 'fine_amount' dan 'total_price' manual di service updateTransactionDetails?
    // Service updateTransactionDetails saat ini hanya update customer info. Kita perlu update manual via applyTransactionFine untuk fine.
    
    // Update Info Dasar
    await updateTransactionDetails(selectedTransaction.id, {
        customerName: editForm.customerName,
        customerWhatsapp: editForm.customerWhatsapp,
        rentalDate: editForm.rentalDate,
        duration: editForm.duration,
        // Hack: kirim properti lain jika service mendukung, atau panggil multiple service
    });

    // Update Denda & Total Price (Khusus)
    await applyTransactionFine(selectedTransaction.id, editForm.fineAmount);
    
    // Update Total Price jika durasi berubah (Harus update items price juga sebenarnya di DB, tapi karena struktur JSONB items menyimpan harga statis atau dinamis?
    // Di sistem ini harga dihitung on-the-fly display, tapi total_price disimpan di kolom terpisah.
    // Jadi kita harus update kolom total_price di tabel transactions.
    // Mari gunakan applyTransactionFine karena dia update total_price juga. 
    // Tapi applyTransactionFine logikanya: total = (total - old_fine) + new_fine.
    // Jika durasi berubah, base price berubah. Jadi kita butuh update total_price manual.
    // Workaround: Panggil updateTransactionItems dengan items yang sama tapi total baru.
    await updateTransactionItems(selectedTransaction.id, selectedTransaction.items, newTotalPrice);

    // Refresh UI
    setSelectedTransaction({
        ...selectedTransaction,
        customerName: editForm.customerName,
        customerWhatsapp: editForm.customerWhatsapp,
        rentalDate: editForm.rentalDate,
        duration: editForm.duration,
        fineAmount: editForm.fineAmount,
        totalPrice: newTotalPrice
    });
    
    setIsEditingData(false);
    onRefreshData();
    alert("Data berhasil diperbarui!");
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTransaction || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = await uploadPaymentProof(selectedTransaction.id, file);
    if (url) {
      setSelectedTransaction({ ...selectedTransaction, paymentProofUrl: url });
      onRefreshData();
    }
  };

  // --- SCANNER HANDLER ---
  const handleScanSuccess = (decodedText: string) => {
      setIsScannerOpen(false);
      const found = transactions.find(t => t.id === decodedText || t.id.includes(decodedText));
      if (found) {
          openEditModal(found);
          setSearchTerm(found.id);
      } else {
          alert(`Transaksi dengan ID: ${decodedText} tidak ditemukan.`);
      }
  };

  // --- POS FUNCTIONS ---
  const handleAddItemToNewTrx = (product: Product) => {
    const existing = newTrxItems.find(i => i.id === product.id);
    if (existing) {
        setNewTrxItems(prev => prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
        setNewTrxItems(prev => [...prev, { ...product, quantity: 1 }]);
    }
    setNewTrxSearch('');
  };

  const handleRemoveItemFromNewTrx = (idx: number) => {
    setNewTrxItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItemQtyNewTrx = (idx: number, delta: number) => {
    setNewTrxItems(prev => prev.map((item, i) => {
        if (i === idx) {
            const newQty = Math.max(1, item.quantity + delta);
            return { ...item, quantity: newQty };
        }
        return item;
    }));
  };

  const calculateNewTrxTotal = () => {
    return newTrxItems.reduce((acc, item) => {
        const price = calculateItemPriceForDuration(item, newTrxDetails.duration);
        return acc + (price * item.quantity);
    }, 0);
  };

  const handleCreateTransaction = async () => {
    if (!newTrxDetails.name || newTrxItems.length === 0) return alert("Lengkapi data pelanggan dan barang!");
    
    setIsCreating(true);
    const total = calculateNewTrxTotal();
    
    const newTrx = await createTransaction(
        newTrxDetails, 
        newTrxItems, 
        total, 
        newTrxDetails.location,
        newTrxStatus,
        newTrxPaid
    );

    if (newTrx) {
        if (newTrxStatus !== 'cancelled' && newTrxStatus !== 'completed') {
            await processStockReduction(newTrxItems);
        }
        await onRefreshData();
        setIsCreateModalOpen(false);
        setNewTrxDetails({ name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash' });
        setNewTrxItems([]);
        setNewTrxPaid(0);
        setSelectedTransaction(newTrx);
        setIsEditModalOpen(true);
    } else {
        alert("Gagal membuat transaksi.");
    }
    setIsCreating(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
      
      {/* SCANNER MODAL */}
      <QRScannerModal 
         isOpen={isScannerOpen} 
         onClose={() => setIsScannerOpen(false)} 
         onScanSuccess={handleScanSuccess} 
      />

      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-nature-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
          <ClipboardList size={20} /> Manajemen Transaksi
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
           <button 
             onClick={() => setIsScannerOpen(true)}
             className="p-2 bg-gray-900 text-white rounded-lg hover:bg-black transition flex items-center gap-2 shadow-sm"
             title="Scan QR Pelanggan"
           >
             <Camera size={18} /> <span className="hidden sm:inline text-xs font-bold">Scan QR</span>
           </button>

           <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari Nama / ID..." 
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           
           <select 
             className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none font-bold text-gray-600"
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value)}
           >
             <option value="all">Semua Status</option>
             <option value="pending">Pending</option>
             <option value="booked">Booked (Lunas)</option>
             <option value="rented">Sedang Sewa</option>
             <option value="completed">Selesai</option>
             <option value="cancelled">Batal</option>
           </select>

           <button onClick={onRefreshData} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
             <RotateCcw size={18} />
           </button>

           <button 
             onClick={() => setIsCreateModalOpen(true)}
             className="flex items-center gap-2 bg-nature-600 hover:bg-nature-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition"
           >
             <PackagePlus size={18} /> Buat Transaksi
           </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left text-gray-600">
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
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-nature-600"/></td></tr>
            ) : filteredTransactions.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400">Tidak ada data transaksi.</td></tr>
            ) : (
              filteredTransactions.map(trx => (
                <tr key={trx.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => openEditModal(trx)}>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">#{trx.id.slice(0,8)}</div>
                    <div className="text-xs text-gray-500">{new Date(trx.rentalDate).toLocaleDateString('id-ID')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{trx.customerName}</div>
                    <div className="text-xs text-gray-400">{trx.customerWhatsapp}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${
                      trx.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                      trx.status === 'booked' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                      trx.status === 'rented' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                      trx.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                      'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {trx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-gray-800">
                    Rp{trx.totalPrice.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openEditModal(trx)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition"><Eye size={18}/></button>
                      <button onClick={() => onDeleteTransaction(trx.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition"><Trash2 size={18}/></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* DETAIL MODAL */}
      {isEditModalOpen && selectedTransaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEditModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-slide-in-right">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
               <div>
                  <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                     <ClipboardList className="text-nature-600"/> 
                     {isEditingData ? 'Edit Data Transaksi' : `Detail Transaksi #${selectedTransaction.id.slice(0,8)}`}
                  </h3>
                  {!isEditingData && <p className="text-xs text-gray-500 mt-1">Dibuat: {new Date(selectedTransaction.created_at || '').toLocaleString('id-ID')}</p>}
               </div>
               <div className="flex items-center gap-2">
                   {!isEditingData ? (
                       <button onClick={() => setIsEditingData(true)} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50">
                           <Edit size={14}/> Edit Data
                       </button>
                   ) : (
                       <button onClick={() => setIsEditingData(false)} className="flex items-center gap-1 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200">
                           <X size={14}/> Batal
                       </button>
                   )}
                   <button onClick={closeEditModal} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
               <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  
                  {/* LEFT: STATUS & ITEMS */}
                  <div className="xl:col-span-2 space-y-6">
                     
                     {/* EDIT FORM (Conditionally Rendered) */}
                     {isEditingData ? (
                         <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm animate-slide-in-right">
                             <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2"><Edit size={16}/> Form Edit Data</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 block mb-1">Nama Pelanggan</label>
                                     <input className="w-full border rounded p-2 text-sm" value={editForm.customerName} onChange={e => setEditForm({...editForm, customerName: e.target.value})} />
                                 </div>
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 block mb-1">WhatsApp</label>
                                     <input className="w-full border rounded p-2 text-sm" value={editForm.customerWhatsapp} onChange={e => setEditForm({...editForm, customerWhatsapp: e.target.value})} />
                                 </div>
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 block mb-1">Tanggal Sewa</label>
                                     <input type="date" className="w-full border rounded p-2 text-sm" value={editForm.rentalDate} onChange={e => setEditForm({...editForm, rentalDate: e.target.value})} />
                                 </div>
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 block mb-1">Durasi (Hari)</label>
                                     <div className="flex items-center gap-2">
                                        <input type="number" min="1" className="w-20 border rounded p-2 text-sm text-center font-bold" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: parseInt(e.target.value) || 1})} />
                                        <span className="text-xs text-gray-400 italic">Total harga akan dihitung ulang otomatis</span>
                                     </div>
                                 </div>
                                 <div className="md:col-span-2 bg-red-50 p-3 rounded-lg border border-red-100">
                                     <label className="text-xs font-bold text-red-700 block mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Biaya Tambahan / Denda Manual (Rp)</label>
                                     <input 
                                        type="number" 
                                        className="w-full border border-red-200 rounded p-2 text-sm font-bold text-red-600" 
                                        value={editForm.fineAmount} 
                                        onChange={e => setEditForm({...editForm, fineAmount: parseInt(e.target.value) || 0})} 
                                        placeholder="0"
                                     />
                                     <p className="text-[10px] text-red-500 mt-1">Isi jika ada biaya kerusakan, cuci, atau keterlambatan manual.</p>
                                 </div>
                             </div>
                             <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                 <button onClick={handleSaveDetails} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm">
                                     <Save size={16}/> Simpan Perubahan
                                 </button>
                             </div>
                         </div>
                     ) : (
                         /* Status Card (Read Only) */
                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><CheckCircle size={16}/> Update Status</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {['pending', 'booked', 'rented', 'completed', 'cancelled'].map(s => (
                                <button 
                                    key={s}
                                    onClick={() => handleStatusChange(selectedTransaction.id, s)}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition border ${
                                    selectedTransaction.status === s 
                                    ? 'bg-nature-600 text-white border-nature-600 shadow-md' 
                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                            </div>
                         </div>
                     )}

                     {/* Items Card */}
                     <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><ShoppingBag size={16}/> Barang Sewaan</h4>
                        <div className="space-y-3">
                           {selectedTransaction.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                                 <div>
                                    <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                                    <div className="text-xs text-gray-500">
                                       Size: {item.selectedSize || '-'} | Warna: {item.selectedColor || '-'}
                                    </div>
                                 </div>
                                 <div className="font-bold text-nature-600">x{item.quantity}</div>
                              </div>
                           ))}
                        </div>
                     </div>

                  </div>

                  {/* RIGHT: PAYMENT & ACTIONS */}
                  <div className="space-y-6">
                     <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Wallet size={16}/> Pembayaran</h4>
                        
                        <div className="space-y-4">
                           <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Tagihan</span>
                              <span className="font-bold text-gray-900">Rp{selectedTransaction.totalPrice.toLocaleString('id-ID')}</span>
                           </div>
                           <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Sudah Bayar</span>
                              <span className="font-bold text-green-600">Rp{selectedTransaction.amountPaid.toLocaleString('id-ID')}</span>
                           </div>
                           
                           {/* INFO DENDA DISPLAY */}
                           {(selectedTransaction.fineAmount || 0) > 0 && !isEditingData && (
                               <div className="flex justify-between text-sm bg-red-50 p-2 rounded text-red-700 border border-red-100">
                                  <span>Denda / Charge</span>
                                  <span className="font-bold">Rp{selectedTransaction.fineAmount?.toLocaleString('id-ID')}</span>
                               </div>
                           )}

                           <div className="pt-3 border-t border-gray-100">
                              <label className="text-xs font-bold text-gray-500 mb-1 block">Update Nominal Bayar</label>
                              <div className="flex gap-2">
                                 <input 
                                   type="number" 
                                   className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                   defaultValue={selectedTransaction.amountPaid}
                                   onBlur={(e) => handlePaymentUpdate(Number(e.target.value))}
                                 />
                              </div>
                           </div>

                           <div className="pt-3 border-t border-gray-100">
                              <label className="text-xs font-bold text-gray-500 mb-2 block">Bukti Transfer</label>
                              {selectedTransaction.paymentProofUrl ? (
                                 <div className="relative group">
                                    <img src={selectedTransaction.paymentProofUrl} alt="Bukti" className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                                    <a href={selectedTransaction.paymentProofUrl} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 text-white font-bold text-xs rounded-lg transition">Lihat Full</a>
                                 </div>
                              ) : (
                                 <div className="flex items-center gap-2">
                                    <label className="cursor-pointer bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-100 transition flex-1 text-center">
                                       Upload Bukti
                                       <input type="file" className="hidden" accept="image/*" onChange={handleUploadProof}/>
                                    </label>
                                 </div>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><Printer size={16}/> Cetak Dokumen</h4>
                        <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => printInvoice(selectedTransaction, 'view', 'full')} className="bg-nature-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-nature-700">Nota Lengkap</button>
                           <button onClick={() => printInvoice(selectedTransaction, 'view', 'delivery')} className="bg-white border border-gray-200 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-50">Surat Jalan</button>
                           <button onClick={() => printInvoice(selectedTransaction, 'view', 'rental')} className="bg-white border border-gray-200 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-100">Nota Sewa</button>
                           <button onClick={() => printInvoice(selectedTransaction, 'view', 'fine')} className="bg-red-50 text-red-600 border border-red-100 py-2 rounded-lg text-xs font-bold hover:bg-red-100">Nota Denda</button>
                        </div>
                     </div>
                  </div>

               </div>
            </div>
          </div>
        </div>
      )}

      {/* POS MODAL: CREATE TRANSACTION */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden animate-slide-in-right">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <h3 className="font-bold text-xl text-gray-900 flex items-center gap-2">
                    <PackagePlus className="text-nature-600"/> Buat Transaksi Baru (POS)
                 </h3>
                 <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* LEFT: CUSTOMER & SETTINGS */}
                    <div className="space-y-4">
                       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                          <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><User size={16}/> Data Pelanggan</h4>
                          <div className="space-y-3">
                             <input className="w-full border rounded p-2 text-sm" placeholder="Nama Lengkap" value={newTrxDetails.name} onChange={e => setNewTrxDetails({...newTrxDetails, name: e.target.value})} />
                             <input className="w-full border rounded p-2 text-sm" placeholder="No WhatsApp (08...)" value={newTrxDetails.whatsapp} onChange={e => setNewTrxDetails({...newTrxDetails, whatsapp: e.target.value})} />
                             <input className="w-full border rounded p-2 text-sm" placeholder="Domisili / Alamat" value={newTrxDetails.location} onChange={e => setNewTrxDetails({...newTrxDetails, location: e.target.value})} />
                          </div>
                       </div>

                       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                          <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><Clock size={16}/> Waktu Sewa</h4>
                          <div className="flex gap-3">
                             <div className="flex-1">
                                <label className="text-xs font-bold text-gray-500 block mb-1">Tgl Ambil</label>
                                <input type="date" className="w-full border rounded p-2 text-sm" value={newTrxDetails.rentalDate} onChange={e => setNewTrxDetails({...newTrxDetails, rentalDate: e.target.value})} />
                             </div>
                             <div className="w-24">
                                <label className="text-xs font-bold text-gray-500 block mb-1">Durasi</label>
                                <input type="number" min="1" className="w-full border rounded p-2 text-sm" value={newTrxDetails.duration} onChange={e => setNewTrxDetails({...newTrxDetails, duration: parseInt(e.target.value)||1})} />
                             </div>
                          </div>
                       </div>

                       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                          <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><Wallet size={16}/> Pembayaran & Status</h4>
                          <div className="space-y-3">
                             <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">Status Awal</label>
                                <select className="w-full border rounded p-2 text-sm font-bold" value={newTrxStatus} onChange={e => setNewTrxStatus(e.target.value)}>
                                   <option value="booked">Booked (Lunas/Siap Ambil)</option>
                                   <option value="rented">Rented (Barang Keluar)</option>
                                   <option value="pending">Pending (Belum Lunas)</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">Uang Muka (DP) / Bayar</label>
                                <div className="relative">
                                   <span className="absolute left-3 top-2 text-gray-400 text-sm">Rp</span>
                                   <input type="number" className="w-full border rounded p-2 pl-8 text-sm font-bold" value={newTrxPaid} onChange={e => setNewTrxPaid(parseInt(e.target.value)||0)} />
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* RIGHT: ITEMS & TOTAL */}
                    <div className="flex flex-col h-full">
                       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 flex flex-col">
                          <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2"><ShoppingBag size={16}/> Daftar Barang</h4>
                          
                          {/* Search Product */}
                          <div className="relative mb-3">
                             <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                             <input 
                               placeholder="Cari & Tambah Barang..." 
                               className="w-full border rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-nature-500 outline-none"
                               value={newTrxSearch}
                               onChange={e => setNewTrxSearch(e.target.value)}
                             />
                             {newTrxSearch && (
                                <div className="absolute w-full bg-white border shadow-lg max-h-48 overflow-y-auto z-10 rounded-b-lg mt-1">
                                   {products.filter(p => p.name.toLowerCase().includes(newTrxSearch.toLowerCase())).map(p => (
                                      <button 
                                        key={p.id} 
                                        onClick={() => handleAddItemToNewTrx(p)}
                                        className="w-full text-left p-2 hover:bg-gray-50 text-sm flex justify-between border-b last:border-0"
                                      >
                                         <span>{p.name}</span>
                                         <span className="text-xs font-bold text-nature-600">Stok: {p.stock}</span>
                                      </button>
                                   ))}
                                </div>
                             )}
                          </div>

                          {/* Item List */}
                          <div className="flex-1 overflow-y-auto space-y-2 mb-4 border rounded-lg p-2 bg-gray-50 min-h-[150px]">
                             {newTrxItems.length === 0 && <p className="text-center text-gray-400 text-xs mt-10">Belum ada barang dipilih</p>}
                             {newTrxItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                                   <div className="text-sm font-bold text-gray-700 truncate w-32">{item.name}</div>
                                   <div className="flex items-center gap-2">
                                      <button onClick={() => handleUpdateItemQtyNewTrx(idx, -1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Minus size={12}/></button>
                                      <span className="text-xs w-6 text-center font-bold">{item.quantity}</span>
                                      <button onClick={() => handleUpdateItemQtyNewTrx(idx, 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200"><Plus size={12}/></button>
                                      <button onClick={() => handleRemoveItemFromNewTrx(idx)} className="text-red-500 ml-2"><Trash2 size={14}/></button>
                                   </div>
                                </div>
                             ))}
                          </div>

                          {/* Total Summary */}
                          <div className="border-t pt-4">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-600 text-sm">Total Estimasi</span>
                                <span className="text-xl font-black text-gray-900">Rp{calculateNewTrxTotal().toLocaleString('id-ID')}</span>
                             </div>
                             <button 
                                onClick={handleCreateTransaction}
                                disabled={isCreating || newTrxItems.length === 0}
                                className="w-full bg-nature-600 text-white font-bold py-3 rounded-xl hover:bg-nature-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                             >
                                {isCreating ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                                Simpan Transaksi
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactionManager;
