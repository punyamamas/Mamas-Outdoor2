import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Calendar, Phone, Eye, Trash2, X, User, FileText, CreditCard, Banknote, ArrowRightLeft, DollarSign, Save } from 'lucide-react';
import { Transaction } from '../types';
import { updateTransactionPayment } from '../services/transactionService';

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  onStatusUpdate: (id: string, status: string) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>; // Prop baru
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({
  transactions,
  isLoading,
  onStatusUpdate,
  onDeleteTransaction,
  onRefreshData
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // State lokal untuk edit pembayaran di modal
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  useEffect(() => {
    if (selectedTransaction) {
      setEditPaymentAmount(selectedTransaction.amountPaid || 0);
    }
  }, [selectedTransaction]);

  const handleSavePayment = async () => {
    if (!selectedTransaction) return;
    setIsSavingPayment(true);
    
    // Panggil API
    const result = await updateTransactionPayment(selectedTransaction.id, editPaymentAmount);
    
    if (result.success) {
      // 1. Refresh Data Tabel Utama (Jika ada prop refresh)
      if (onRefreshData) {
        await onRefreshData();
      }

      // 2. Update Data di Modal saat ini agar terlihat perubahannya (Instant Feedback)
      const updatedTrx = { ...selectedTransaction, amountPaid: editPaymentAmount };
      
      // Update status lokal jika ada perubahan status otomatis dari backend
      if (result.newStatus) {
        updatedTrx.status = result.newStatus as any;
      }

      setSelectedTransaction(updatedTrx);
      
      alert("Pembayaran berhasil disimpan & Status diperbarui!");
    } else {
      alert(`Gagal update pembayaran: ${result.error || 'Terjadi kesalahan sistem'}`);
    }
    setIsSavingPayment(false);
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
                <th className="px-6 py-4">Status Sewa</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(trx => {
                const paid = trx.amountPaid || 0;
                const total = trx.totalPrice;
                const isPaidOff = paid >= total;
                
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
                      <div className="font-bold text-nature-700">Rp{total.toLocaleString('id-ID')}</div>
                      <div className="mt-1">
                        {isPaidOff ? (
                           <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold uppercase">Lunas</span>
                        ) : paid === 0 ? (
                           <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Belum Bayar</span>
                        ) : (
                           <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold uppercase">
                             Kurang Rp{(total - paid).toLocaleString('id-ID')}
                           </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <select
                        value={trx.status}
                        onChange={(e) => onStatusUpdate(trx.id, e.target.value)}
                        className={`text-xs border rounded px-2 py-1.5 focus:ring-nature-500 outline-none w-36 font-bold cursor-pointer transition
                          ${trx.status === 'completed' ? 'bg-green-50 border-green-200 text-green-700' :
                          trx.status === 'active' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          trx.status === 'cancelled' ? 'bg-red-50 border-red-200 text-red-700' :
                          'bg-yellow-50 border-yellow-200 text-yellow-700'}`}
                      >
                        <option value="pending">Belum Bayar</option>
                        <option value="active">Belum Lunas / Sewa</option>
                        <option value="completed">Selesai</option>
                        <option value="cancelled">Dibatalkan</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      <button
                        onClick={() => setSelectedTransaction(trx)}
                        className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                      >
                        <Eye size={14} /> Detail
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

      {/* MODAL DETAIL & PEMBAYARAN MANUAL */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)}></div>
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in-right md:animate-none">
              
              <div className="bg-nature-900 px-6 py-4 flex justify-between items-center text-white">
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={20} /> Detail & Pembayaran</h3>
                    <p className="text-xs text-nature-200 font-mono mt-0.5">#{selectedTransaction.id}</p>
                 </div>
                 <button onClick={() => setSelectedTransaction(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[75vh]">
                 
                 {/* UPDATE PEMBAYARAN MANUAL SECTION */}
                 <div className="bg-green-50 border border-green-100 p-4 rounded-xl mb-6">
                    <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                      <DollarSign size={16}/> Kelola Pembayaran Manual
                    </h4>
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                      <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Total Tagihan</label>
                        <div className="text-lg font-bold text-gray-800">Rp{selectedTransaction.totalPrice.toLocaleString('id-ID')}</div>
                      </div>
                      <div className="flex-1 w-full">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">Sudah Dibayar (Input Manual)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500 text-sm font-bold">Rp</span>
                          <input 
                            type="number" 
                            className="w-full pl-10 pr-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-800"
                            value={editPaymentAmount}
                            onChange={(e) => setEditPaymentAmount(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleSavePayment}
                        disabled={isSavingPayment}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        {isSavingPayment ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                        Update
                      </button>
                    </div>
                    <div className="mt-2 text-right">
                       <span className="text-xs font-bold text-gray-500">Sisa Tagihan: </span>
                       <span className={`text-sm font-bold ${selectedTransaction.totalPrice - editPaymentAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                         Rp{(selectedTransaction.totalPrice - editPaymentAmount).toLocaleString('id-ID')}
                       </span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <h4 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2"><User size={14}/> Data Penyewa</h4>
                       <div className="space-y-2 text-sm text-gray-800">
                          <p><span className="font-semibold w-24 inline-block">Nama:</span> {selectedTransaction.customerName}</p>
                          <p className="flex items-center">
                             <span className="font-semibold w-24 inline-block">WhatsApp:</span> 
                             <a href={`https://wa.me/${selectedTransaction.customerWhatsapp}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                {selectedTransaction.customerWhatsapp} <ArrowRightLeft size={10} className="-rotate-45"/>
                             </a>
                          </p>
                       </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <h4 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2"><Calendar size={14}/> Jadwal Sewa</h4>
                       <div className="space-y-2 text-sm text-gray-800">
                          <p><span className="font-semibold w-24 inline-block">Ambil:</span> {selectedTransaction.rentalDate}</p>
                          <p><span className="font-semibold w-24 inline-block">Durasi:</span> {selectedTransaction.duration} Hari</p>
                          <p>
                              <span className="font-semibold w-24 inline-block">Status:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
                                  ${selectedTransaction.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  selectedTransaction.status === 'active' ? 'bg-blue-100 text-blue-700' :
                                  selectedTransaction.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'}`}>
                                  {selectedTransaction.status === 'completed' ? 'Selesai' : 
                                   selectedTransaction.status === 'active' ? 'Sedang Sewa' : 
                                   selectedTransaction.status === 'cancelled' ? 'Batal' : 'Belum Bayar'}
                              </span>
                          </p>
                       </div>
                    </div>
                 </div>

                 <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-gray-100 text-gray-600 font-bold text-xs uppercase">
                          <tr>
                             <th className="px-4 py-3">Nama Alat</th>
                             <th className="px-4 py-3 text-center">Varian</th>
                             <th className="px-4 py-3 text-center">Qty</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                          {selectedTransaction.items.map((item, idx) => (
                             <tr key={idx} className="bg-white">
                                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                                <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                   {item.selectedSize && <span className="bg-gray-100 px-1.5 py-0.5 rounded mx-1">{item.selectedSize}</span>}
                                   {item.selectedColor && <span className="bg-gray-100 px-1.5 py-0.5 rounded mx-1">{item.selectedColor}</span>}
                                   {!item.selectedSize && !item.selectedColor && '-'}
                                </td>
                                <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>

                 <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <button 
                       onClick={() => {
                          const conf = window.confirm("Hapus transaksi ini?");
                          if (conf) {
                             onDeleteTransaction(selectedTransaction.id);
                             setSelectedTransaction(null);
                          }
                       }}
                       className="flex items-center gap-2 text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition text-sm font-bold"
                    >
                       <Trash2 size={16} /> Hapus Permanen
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