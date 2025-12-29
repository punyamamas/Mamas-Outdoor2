import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Calendar, Phone, Eye, Trash2, X, User, FileText, CreditCard, Banknote, ArrowRightLeft, DollarSign, Save, Calculator, Percent, CheckCircle } from 'lucide-react';
import { Transaction } from '../types';
import { updateTransactionPayment } from '../services/transactionService';

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  onStatusUpdate: (id: string, status: string) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
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
    
    // 1. Panggil API untuk update ke Supabase
    const result = await updateTransactionPayment(selectedTransaction.id, editPaymentAmount);
    
    if (result.success) {
      // 2. Refresh Data Tabel Utama
      if (onRefreshData) {
        await onRefreshData();
      }

      // 3. Update Tampilan di Modal saat ini
      const updatedTrx = { ...selectedTransaction, amountPaid: editPaymentAmount };
      
      // Update status jika ada perubahan otomatis dari backend
      if (result.newStatus) {
        updatedTrx.status = result.newStatus as any;
      }

      setSelectedTransaction(updatedTrx);
      alert("Pembayaran berhasil disimpan!");
      
    } else {
      alert(`Gagal update pembayaran: ${result.error || 'Terjadi kesalahan sistem'}`);
    }
    setIsSavingPayment(false);
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

  // Helper Calculations for Cashier View
  const remainingBill = selectedTransaction ? selectedTransaction.totalPrice - editPaymentAmount : 0;
  const isPaidOff = remainingBill <= 0;

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
                           <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold uppercase">
                             Cicil: Rp{paid.toLocaleString('id-ID')}
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

      {/* MODAL DETAIL & KASIR */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)}></div>
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-slide-in-right md:animate-none flex flex-col max-h-[90vh]">
              
              <div className="bg-nature-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20} /> Kasir & Detail</h3>
                    <p className="text-xs text-nature-200 font-mono mt-0.5">TRX ID: #{selectedTransaction.id.slice(0,8)}</p>
                 </div>
                 <button onClick={() => setSelectedTransaction(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                 
                 {/* BAGIAN KASIR (CASHIER SECTION) */}
                 <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl mb-8 shadow-sm">
                    <div className="flex items-center gap-2 mb-4 text-gray-700 font-bold uppercase text-xs tracking-wider">
                      <Banknote size={16}/> Input Pembayaran
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Kolom Kiri: Input */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Nominal Masuk (Rp)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                            <input 
                              type="number" 
                              className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:border-nature-500 focus:ring-0 outline-none font-bold text-xl text-gray-800 transition"
                              value={editPaymentAmount}
                              onChange={(e) => setEditPaymentAmount(Number(e.target.value))}
                              onFocus={(e) => e.target.select()} // Auto block saat diklik
                            />
                          </div>
                        </div>

                        {/* Tombol Cepat (Quick Actions) */}
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                             onClick={() => setEditPaymentAmount(Math.ceil(selectedTransaction.totalPrice * 0.5))}
                             className="flex items-center justify-center gap-1 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 py-2 rounded-lg text-xs font-bold transition"
                           >
                             <Percent size={12}/> DP 50%
                           </button>
                           <button 
                             onClick={() => setEditPaymentAmount(selectedTransaction.totalPrice)}
                             className="flex items-center justify-center gap-1 bg-white border border-gray-200 hover:border-green-400 hover:text-green-600 py-2 rounded-lg text-xs font-bold transition"
                           >
                             <CheckCircle size={12}/> LUNAS
                           </button>
                        </div>
                      </div>

                      {/* Kolom Kanan: Summary (Realtime Calc) */}
                      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col justify-between">
                         <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                            <span className="text-xs text-gray-500 font-medium">Total Tagihan</span>
                            <span className="font-bold text-gray-800">Rp{selectedTransaction.totalPrice.toLocaleString('id-ID')}</span>
                         </div>
                         
                         <div className="text-center py-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">
                              {isPaidOff ? 'Status Lunas' : 'Sisa Tagihan'}
                            </span>
                            <span className={`text-3xl font-black tracking-tight ${isPaidOff ? 'text-green-600' : 'text-red-600'}`}>
                              {isPaidOff ? 'LUNAS' : `Rp${remainingBill.toLocaleString('id-ID')}`}
                            </span>
                         </div>

                         {/* Tombol Simpan */}
                         <button 
                           onClick={handleSavePayment}
                           disabled={isSavingPayment}
                           className="mt-2 w-full bg-nature-900 hover:bg-nature-800 text-white py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-nature-900/20 transition flex items-center justify-center gap-2"
                         >
                           {isSavingPayment ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                           Simpan Pembayaran
                         </button>
                      </div>
                    </div>
                 </div>

                 {/* INFORMASI DETAIL TRANSAKSI */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                       <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2"><User size={14}/> Penyewa</h4>
                       <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500">Nama Lengkap</p>
                            <p className="font-bold text-gray-800">{selectedTransaction.customerName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Kontak WhatsApp</p>
                            <a href={`https://wa.me/${selectedTransaction.customerWhatsapp}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold flex items-center gap-1">
                                {selectedTransaction.customerWhatsapp} <ArrowRightLeft size={12} className="-rotate-45"/>
                             </a>
                          </div>
                       </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                       <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2"><Calendar size={14}/> Jadwal</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Tgl Ambil</p>
                            <p className="font-bold text-gray-800">{selectedTransaction.rentalDate}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Durasi</p>
                            <p className="font-bold text-gray-800">{selectedTransaction.duration} Hari</p>
                          </div>
                          <div className="col-span-2">
                             <p className="text-xs text-gray-500 mb-1">Status Fisik Barang</p>
                             <span className={`px-2 py-1 rounded text-xs font-bold uppercase border w-full block text-center ${getStatusBadge(selectedTransaction.status)}`}>
                                {selectedTransaction.status === 'completed' ? 'Barang Kembali' : 
                                 selectedTransaction.status === 'rented' ? 'Sedang dibawa' :
                                 selectedTransaction.status === 'booked' ? 'Siap Ambil' :
                                 selectedTransaction.status === 'partial_payment' ? 'Booking (DP)' :
                                 selectedTransaction.status === 'cancelled' ? 'Batal' : 'Pending'}
                            </span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* TABEL ITEM */}
                 <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                    <table className="w-full text-sm text-left">
                       <thead className="bg-gray-50 text-gray-600 font-bold text-xs uppercase">
                          <tr>
                             <th className="px-4 py-3">Nama Alat</th>
                             <th className="px-4 py-3 text-center">Spec</th>
                             <th className="px-4 py-3 text-center">Qty</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                          {selectedTransaction.items.map((item, idx) => (
                             <tr key={idx} className="bg-white">
                                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                                <td className="px-4 py-3 text-center text-gray-500 text-xs">
                                   {item.selectedSize && <span className="bg-gray-100 px-1.5 py-0.5 rounded mx-1 border border-gray-200">{item.selectedSize}</span>}
                                   {item.selectedColor && <span className="bg-gray-100 px-1.5 py-0.5 rounded mx-1 border border-gray-200">{item.selectedColor}</span>}
                                   {!item.selectedSize && !item.selectedColor && '-'}
                                </td>
                                <td className="px-4 py-3 text-center font-bold bg-gray-50/50">{item.quantity}</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>

                 <div className="flex justify-end pt-2">
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