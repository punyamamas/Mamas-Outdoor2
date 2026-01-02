import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardList, Loader2, Calendar, Eye, Trash2, X, User, CreditCard, Banknote, ArrowRightLeft, Save, Calculator, CheckCircle, RotateCcw, Wallet, Edit, Plus, Minus, Search, ShoppingBag, Printer, Filter, DollarSign, Receipt, BarChart3, TrendingUp, Lightbulb, AlertTriangle, ArrowUpRight, Share2, Image as ImageIcon, CreditCard as CardIcon, ExternalLink, QrCode, FileText, Clock, ShieldCheck, ChevronDown, ChevronUp, Upload, LogIn, LogOut, FileCheck } from 'lucide-react';
import { Transaction, Product, CartItem } from '../types';
import { updateTransactionPayment, updateTransactionItems, updateTransactionDetails, printInvoice, applyTransactionFine, calculateOverdueFine, copyInvoiceToClipboard, uploadPaymentProof } from '../services/transactionService';
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
  
  // Modal Edit States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
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

  const openEditModal = (trx: Transaction) => {
    setSelectedTransaction(trx);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setSelectedTransaction(null);
    setIsEditModalOpen(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
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

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTransaction || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const url = await uploadPaymentProof(selectedTransaction.id, file);
    if (url) {
      setSelectedTransaction({ ...selectedTransaction, paymentProofUrl: url });
      onRefreshData();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 bg-nature-50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
          <ClipboardList size={20} /> Manajemen Transaksi
        </h3>
        <div className="flex flex-wrap gap-2 items-center">
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
                     <ClipboardList className="text-nature-600"/> Detail Transaksi #{selectedTransaction.id.slice(0,8)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">Dibuat: {new Date(selectedTransaction.created_at || '').toLocaleString('id-ID')}</p>
               </div>
               <button onClick={closeEditModal} className="p-2 hover:bg-gray-200 rounded-full transition"><X size={20}/></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
               <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  
                  {/* LEFT: STATUS & ITEMS */}
                  <div className="xl:col-span-2 space-y-6">
                     
                     {/* Status Card */}
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
    </div>
  );
};

export default AdminTransactionManager;
