
import React, { useState, useMemo } from 'react';
import { Eye, Trash2, User, Save, CheckCircle, PackagePlus, Search, Plus, Minus, X, AlertTriangle, Loader2, Printer } from 'lucide-react';
import { Transaction, Product, CartItem, UserDetails, UserRole } from '../types';
import { createTransaction, updateTransactionStatus, updateTransactionPayment, recordPaymentLog, calculateItemPriceForDuration } from '../services/transactionService';
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
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // POS (Create Transaction) State
  const [newTrxDetails, setNewTrxDetails] = useState<UserDetails>({
    name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash'
  });
  const [newTrxItems, setNewTrxItems] = useState<CartItem[]>([]);
  const [newTrxSearch, setNewTrxSearch] = useState('');
  const [newTrxStatus, setNewTrxStatus] = useState('booked'); // Default Lunas/Booked
  const [newTrxPaid, setNewTrxPaid] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination Logic
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // --- POS LOGIC (CREATE) ---

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
        // Cek stok fisik
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
    setNewTrxItems(prev => prev.filter(i => i.id !== id));
  };

  const calculateNewTrxTotal = () => {
    return newTrxItems.reduce((acc, item) => {
        const price = calculateItemPriceForDuration(item, newTrxDetails.duration);
        return acc + (price * item.quantity);
    }, 0);
  };

  const handleCreateTransaction = async () => {
    if (!newTrxDetails.name || newTrxItems.length === 0) return alert("Data belum lengkap!");
    setIsSubmitting(true);

    const total = calculateNewTrxTotal();
    
    // Create Trx
    const created = await createTransaction(
        newTrxDetails, 
        newTrxItems, 
        total, 
        undefined, 
        newTrxStatus, 
        newTrxPaid
    );

    if (created) {
        // Reduce Stock if Status implies goods are reserved/taken
        if (newTrxStatus === 'booked' || newTrxStatus === 'rented') {
            await processStockReduction(newTrxItems);
        }
        
        alert("✅ Transaksi Berhasil Dibuat!");
        setIsCreateModalOpen(false);
        // Reset Form
        setNewTrxItems([]);
        setNewTrxDetails({ name: '', whatsapp: '', location: '', rentalDate: new Date().toISOString().split('T')[0], duration: 2, paymentMethod: 'cash' });
        setNewTrxPaid(0);
        await onRefreshData();
    } else {
        alert("Gagal membuat transaksi.");
    }
    setIsSubmitting(false);
  };

  // --- EDIT LOGIC ---
  const handleStatusChange = async (id: string, status: string) => {
      const success = await onStatusUpdate(id, status);
      if (success && selectedTransaction) {
          setSelectedTransaction({ ...selectedTransaction, status: status as any });
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
      
      {/* Header & Controls */}
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

      {/* Table Content */}
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
                <tr key={trx.id} className="hover:bg-gray-50 transition group cursor-pointer" onClick={() => { setSelectedTransaction(trx); setIsEditModalOpen(true); }}>
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
                      {/* TOMBOL CETAK NOTA DI TABEL */}
                      <button 
                        onClick={() => printInvoice(trx)}
                        className="p-2 hover:bg-gray-100 text-gray-600 rounded-lg transition"
                        title="Cetak Nota"
                      >
                        <Printer size={18}/>
                      </button>

                      <button onClick={() => { setSelectedTransaction(trx); setIsEditModalOpen(true); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg"><Eye size={18}/></button>
                      
                      {/* Only Admin/Owner can delete */}
                      {userRole !== 'staff' && (
                          <button onClick={() => onDeleteTransaction(trx.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button>
                      )}
                    </div>
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
        
        {/* Mobile List View */}
        <div className="md:hidden p-4 space-y-4">
            {transactions.map(trx => (
                <div key={trx.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm" onClick={() => { setSelectedTransaction(trx); setIsEditModalOpen(true); }}>
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
                            {/* TOMBOL CETAK MOBILE */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); printInvoice(trx); }}
                                className="bg-gray-100 text-gray-700 p-2 rounded-lg"
                            >
                                <Printer size={16}/>
                            </button>
                            {userRole !== 'staff' && (
                                <button onClick={(e) => { e.stopPropagation(); onDeleteTransaction(trx.id); }} className="bg-red-50 text-red-500 p-2 rounded-lg">
                                    <Trash2 size={16}/>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center text-sm">
         <span className="text-gray-500 hidden md:inline">Total {totalCount} Transaksi</span>
         <div className="flex gap-2">
            <button 
              disabled={currentPage === 1} 
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >Prev</button>
            <span className="px-3 py-1 font-bold text-gray-700">{currentPage} / {totalPages || 1}</span>
            <button 
              disabled={currentPage >= totalPages} 
              onClick={() => onPageChange(currentPage + 1)}
              className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >Next</button>
         </div>
      </div>

      {/* --- CREATE TRANSACTION MODAL (POS) --- */}
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

              {/* Right Panel: Cart & Details */}
              <div className="w-full md:w-2/5 bg-white flex flex-col h-full">
                 <div className="p-4 bg-nature-600 text-white flex justify-between items-center shadow-md shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2"><PackagePlus size={20}/> Kasir / POS</h3>
                    <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full"><X size={20}/></button>
                 </div>

                 <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Customer Form */}
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

                    {/* Cart Items */}
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

                 {/* Footer Actions */}
                 <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-gray-600">Total Tagihan</span>
                        <span className="text-xl font-black text-nature-700">Rp{calculateNewTrxTotal().toLocaleString('id-ID')}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Status Awal</label>
                            <select className="w-full p-2 text-xs font-bold rounded-lg border border-gray-300" value={newTrxStatus} onChange={e => setNewTrxStatus(e.target.value)}>
                                <option value="booked">LUNAS (Booked)</option>
                                <option value="pending">DP (Pending)</option>
                                <option value="rented">SEWA (Barang Keluar)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Bayar Sekarang</label>
                            <input type="number" className="w-full p-2 text-xs font-bold rounded-lg border border-gray-300" placeholder="Rp 0" value={newTrxPaid || ''} onChange={e => setNewTrxPaid(Number(e.target.value))} />
                        </div>
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

      {/* --- DETAIL/EDIT MODAL --- */}
      {isEditModalOpen && selectedTransaction && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
             <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                <h3 className="text-lg font-bold mb-4">Detail Transaksi #{selectedTransaction.id.slice(0,6)}</h3>
                
                <div className="space-y-4 mb-6">
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500 text-sm">Pelanggan</span>
                        <span className="font-bold">{selectedTransaction.customerName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-500 text-sm">Status</span>
                        <select 
                            className="bg-gray-100 border-none rounded p-1 text-sm font-bold"
                            value={selectedTransaction.status}
                            onChange={(e) => handleStatusChange(selectedTransaction.id, e.target.value)}
                        >
                            <option value="pending">Pending</option>
                            <option value="booked">Booked</option>
                            <option value="rented">Rented</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                        {selectedTransaction.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                                <span>{item.quantity}x {item.name}</span>
                                <span className="font-mono">Rp{(calculateItemPriceForDuration(item, selectedTransaction.duration) * item.quantity).toLocaleString('id-ID')}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total Tagihan</span>
                        <span>Rp{selectedTransaction.totalPrice.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-green-600">
                        <span>Sudah Bayar</span>
                        <span>Rp{(selectedTransaction.amountPaid || 0).toLocaleString('id-ID')}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50">Tutup</button>
                    {/* TOMBOL CETAK DI MODAL */}
                    <button 
                        onClick={() => printInvoice(selectedTransaction)} 
                        className="flex-1 py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 flex items-center justify-center gap-2"
                    >
                        <Printer size={18} /> Cetak Nota
                    </button>
                </div>
             </div>
          </div>
      )}

    </div>
  );
};

export default AdminTransactionManager;
