import React, { useState } from 'react';
import { ClipboardList, Loader2, Calendar, Phone, School, Eye, Trash2, X, User, FileText, CreditCard, Banknote, ArrowRightLeft } from 'lucide-react';
import { Transaction } from '../types';

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  onStatusUpdate: (id: string, status: string) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({
  transactions,
  isLoading,
  onStatusUpdate,
  onDeleteTransaction
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

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
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Penyewa</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Metode</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(trx => (
                <tr key={trx.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 align-middle font-mono text-xs text-gray-500">
                    #{trx.id.slice(0, 6)}
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="text-xs font-bold text-gray-700">
                      {new Date(trx.created_at || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="font-bold text-gray-900">{trx.customerName}</div>
                    <div className="text-xs text-gray-500">{trx.customerCampus}</div>
                  </td>
                  <td className="px-6 py-4 align-middle font-bold text-nature-700">
                    Rp{trx.totalPrice.toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 align-middle">
                     <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${trx.paymentMethod === 'transfer' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                        {trx.paymentMethod === 'transfer' ? 'Transfer' : 'Cash'}
                     </span>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <select
                      value={trx.status}
                      onChange={(e) => onStatusUpdate(trx.id, e.target.value)}
                      className={`text-xs border rounded px-2 py-1 focus:ring-nature-500 outline-none w-32 font-bold cursor-pointer
                        ${trx.status === 'completed' ? 'bg-green-50 border-green-200 text-green-700' :
                        trx.status === 'active' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        trx.status === 'cancelled' ? 'bg-red-50 border-red-200 text-red-700' :
                        'bg-yellow-50 border-yellow-200 text-yellow-700'}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Sedang Sewa</option>
                      <option value="completed">Selesai</option>
                      <option value="cancelled">Batal</option>
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
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada transaksi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DETAIL */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)}></div>
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in-right md:animate-none">
              
              <div className="bg-nature-900 px-6 py-4 flex justify-between items-center text-white">
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><FileText size={20} /> Detail Transaksi</h3>
                    <p className="text-xs text-nature-200 font-mono mt-0.5">#{selectedTransaction.id}</p>
                 </div>
                 <button onClick={() => setSelectedTransaction(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                       <h4 className="text-xs font-bold uppercase text-gray-500 mb-3 flex items-center gap-2"><User size={14}/> Data Penyewa</h4>
                       <div className="space-y-2 text-sm text-gray-800">
                          <p><span className="font-semibold w-24 inline-block">Nama:</span> {selectedTransaction.customerName}</p>
                          <p><span className="font-semibold w-24 inline-block">Kampus:</span> {selectedTransaction.customerCampus}</p>
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
                          <p><span className="font-semibold w-24 inline-block">Total:</span> <span className="font-bold text-nature-600">Rp{selectedTransaction.totalPrice.toLocaleString('id-ID')}</span></p>
                       </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h4 className="text-xs font-bold uppercase text-blue-800 mb-2 flex items-center gap-2">
                           {selectedTransaction.paymentMethod === 'transfer' ? <CreditCard size={14}/> : <Banknote size={14}/>} 
                           Metode Pembayaran
                        </h4>
                        <p className="text-sm font-bold text-gray-800">
                          {selectedTransaction.paymentMethod === 'transfer' ? 'TRANSFER BANK (DP)' : 'CASH DI OUTLET'}
                        </p>
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