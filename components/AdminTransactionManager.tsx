import React, { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Calendar, Phone, Eye, Trash2, X, User, FileText, CreditCard, Banknote, ArrowRightLeft, DollarSign, Save, Calculator, Percent, CheckCircle, RotateCcw, Wallet } from 'lucide-react';
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
  
  // State: Nominal yang SEDANG diketik (Pembayaran Baru) - DIBAGI DUA
  const [cashInput, setCashInput] = useState<number>(0);
  const [transferInput, setTransferInput] = useState<number>(0);
  
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Reset input ke 0 setiap kali modal dibuka
  useEffect(() => {
    if (selectedTransaction) {
      setCashInput(0); 
      setTransferInput(0);
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

  const { total, prevPaid, finalPaid, remaining, isLunas, isKembalian, currentInputTotal } = calculateFinancials();

  const handleSavePayment = async () => {
    if (!selectedTransaction) return;
    setIsSavingPayment(true);
    
    // KETERANGAN UNTUK LOG KEUANGAN
    const isDP = prevPaid === 0 && remaining > 0;
    const isPelunasan = remaining <= 0;
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
      
      alert(`Pembayaran tersimpan & tercatat di Keuangan! Sisa tagihan sekarang: Rp${Math.max(0, total - finalPaid).toLocaleString('id-ID')}`);
      
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
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-slide-in-right md:animate-none flex flex-col max-h-[95vh]">
              
              {/* Header */}
              <div className="bg-nature-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20} /> Kasir Pembayaran</h3>
                    <p className="text-xs text-nature-200 font-mono mt-0.5">#{selectedTransaction.id.slice(0,8)} - {selectedTransaction.customerName}</p>
                 </div>
                 <button onClick={() => setSelectedTransaction(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                 
                 {/* 1. SECTION SUMMARY TAGIHAN */}
                 <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl mb-6 shadow-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Kolom 1: History Tagihan */}
                      <div className="space-y-4 lg:border-r border-gray-200 lg:pr-8">
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                           <span className="text-sm font-bold text-gray-600">Total Tagihan</span>
                           <span className="text-lg font-black text-gray-900">Rp{total.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-sm font-bold text-gray-500">Sudah Dibayar</span>
                           <span className="text-base font-bold text-green-600 flex items-center gap-1">
                             {prevPaid > 0 && <CheckCircle size={14}/>}
                             Rp{prevPaid.toLocaleString('id-ID')}
                           </span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-dashed border-gray-300">
                           <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sisa Kekurangan</span>
                           <span className="text-base font-bold text-red-600">Rp{(total - prevPaid).toLocaleString('id-ID')}</span>
                        </div>
                      </div>

                      {/* Kolom 2: Input Pembayaran SPLIT */}
                      <div className="lg:col-span-2">
                         <label className="block text-xs font-black text-nature-700 uppercase mb-3 tracking-wide flex items-center gap-2">
                           <Banknote size={16}/> Masukan Pembayaran Baru
                         </label>
                         
                         <div className="grid grid-cols-2 gap-4">
                            {/* Input Cash */}
                            <div className="bg-white p-3 rounded-xl border-2 border-green-100 focus-within:border-green-500 transition shadow-sm">
                               <label className="flex items-center gap-2 text-xs font-bold text-green-700 mb-2">
                                  <Wallet size={14}/> Tunai (Cash)
                               </label>
                               <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                                  <input 
                                    type="number" 
                                    className="w-full pl-9 pr-2 py-2 text-lg font-bold outline-none text-gray-800 placeholder-gray-200"
                                    placeholder="0"
                                    value={cashInput === 0 ? '' : cashInput}
                                    onChange={(e) => setCashInput(Number(e.target.value))}
                                  />
                               </div>
                               <button 
                                 onClick={() => setCashInput(total - prevPaid - transferInput)}
                                 className="mt-2 w-full text-[10px] font-bold bg-green-50 text-green-600 py-1 rounded hover:bg-green-100"
                               >
                                 Lunasi Cash
                               </button>
                            </div>

                            {/* Input Transfer */}
                            <div className="bg-white p-3 rounded-xl border-2 border-blue-100 focus-within:border-blue-500 transition shadow-sm">
                               <label className="flex items-center gap-2 text-xs font-bold text-blue-700 mb-2">
                                  <CreditCard size={14}/> Transfer (TF)
                               </label>
                               <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">Rp</span>
                                  <input 
                                    type="number" 
                                    className="w-full pl-9 pr-2 py-2 text-lg font-bold outline-none text-gray-800 placeholder-gray-200"
                                    placeholder="0"
                                    value={transferInput === 0 ? '' : transferInput}
                                    onChange={(e) => setTransferInput(Number(e.target.value))}
                                  />
                               </div>
                               <button 
                                 onClick={() => setTransferInput(total - prevPaid - cashInput)}
                                 className="mt-2 w-full text-[10px] font-bold bg-blue-50 text-blue-600 py-1 rounded hover:bg-blue-100"
                               >
                                 Lunasi TF
                               </button>
                            </div>
                         </div>

                         {/* Total Input Summary */}
                         <div className="mt-4 flex justify-between items-center bg-gray-100 p-2 rounded-lg">
                            <div className="text-xs font-medium text-gray-500 flex gap-2">
                               <button onClick={() => { setCashInput(0); setTransferInput(0); }} className="hover:text-red-500"><RotateCcw size={14}/></button>
                               <span>Total Masuk (Sesi Ini):</span>
                            </div>
                            <div className="font-black text-gray-800 text-lg">Rp{currentInputTotal.toLocaleString('id-ID')}</div>
                         </div>
                      </div>
                    </div>

                    {/* Footer Result Calculation */}
                    <div className={`mt-6 p-4 rounded-xl flex items-center justify-between border-2 transition-all duration-300 ${isLunas ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'}`}>
                       <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                             Status Akhir
                          </p>
                          <div className={`text-xl font-black flex items-center gap-2 ${isLunas ? 'text-green-600' : 'text-orange-500'}`}>
                             {isLunas ? (
                                <>LUNAS {isKembalian && <span className="text-sm font-medium text-gray-500">(Kembali Rp{Math.abs(remaining).toLocaleString('id-ID')})</span>}</>
                             ) : (
                                <>BELUM LUNAS <span className="text-sm font-medium text-gray-500">(Kurang Rp{remaining.toLocaleString('id-ID')})</span></>
                             )}
                          </div>
                       </div>
                       <button 
                         onClick={handleSavePayment}
                         disabled={isSavingPayment || currentInputTotal === 0}
                         className="bg-nature-900 hover:bg-nature-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition transform active:scale-95"
                       >
                         {isSavingPayment ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                         Simpan
                       </button>
                    </div>
                 </div>

                 {/* 2. SECTION DETAIL ITEM */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                       <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2"><User size={14}/> Kontak Penyewa</h4>
                       <div className="space-y-3">
                          <div>
                            <p className="font-bold text-gray-800">{selectedTransaction.customerName}</p>
                            <a href={`https://wa.me/${selectedTransaction.customerWhatsapp}`} target="_blank" rel="noreferrer" className="text-blue-600 text-sm hover:underline font-bold flex items-center gap-1 mt-1">
                                {selectedTransaction.customerWhatsapp} <ArrowRightLeft size={12} className="-rotate-45"/>
                             </a>
                          </div>
                       </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                       <h4 className="text-xs font-bold uppercase text-gray-400 mb-3 flex items-center gap-2"><Calendar size={14}/> Status Sewa</h4>
                       <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                             <span className="text-gray-500">Tanggal Ambil:</span>
                             <span className="font-bold">{selectedTransaction.rentalDate}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                             <span className="text-gray-500">Durasi:</span>
                             <span className="font-bold">{selectedTransaction.duration} Hari</span>
                          </div>
                          <div className="pt-2">
                             <span className={`px-2 py-1 rounded text-xs font-bold uppercase border w-full block text-center ${getStatusBadge(selectedTransaction.status)}`}>
                                {selectedTransaction.status === 'completed' ? 'Barang Sudah Kembali' : 
                                 selectedTransaction.status === 'rented' ? 'Sedang Dipakai (Keluar)' :
                                 selectedTransaction.status === 'booked' ? 'Siap Ambil (Booking)' :
                                 selectedTransaction.status === 'partial_payment' ? 'Booking (DP / Cicil)' :
                                 selectedTransaction.status === 'cancelled' ? 'Batal' : 'Pending'}
                            </span>
                          </div>
                       </div>
                    </div>
                 </div>

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