import React, { useState, useEffect } from 'react';
import { DollarSign, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, Plus, Calendar, Loader2, Save } from 'lucide-react';
import { PaymentLog } from '../types';
import { getPaymentLogs, recordPaymentLog } from '../services/transactionService';

const AdminFinanceManager: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Manual Entry State
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<'IN' | 'OUT'>('OUT'); // Default Pengeluaran (Kas Kecil)

  useEffect(() => {
    fetchLogs();
  }, [selectedDate]);

  const fetchLogs = async () => {
    setIsLoading(true);
    const data = await getPaymentLogs(selectedDate, selectedDate);
    setLogs(data);
    setIsLoading(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualAmount <= 0 || !manualDesc) return;

    await recordPaymentLog({
      amount: manualAmount,
      payment_method: 'cash', // Manual entry biasanya cash
      type: manualType,
      description: manualDesc,
      category: manualType === 'OUT' ? 'Operasional' : 'Lain-lain'
    });

    setManualAmount(0);
    setManualDesc('');
    setIsManualEntryOpen(false);
    fetchLogs();
  };

  // Calculations
  const totalIn = logs.filter(l => l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
  const totalOut = logs.filter(l => l.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
  const netTotal = totalIn - totalOut;

  const totalCash = logs.filter(l => l.payment_method === 'cash' && l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0)
                  - logs.filter(l => l.payment_method === 'cash' && l.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
  
  const totalTransfer = logs.filter(l => l.payment_method === 'transfer' && l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-nature-50">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <DollarSign size={20} /> Laporan Keuangan Harian
          </h3>
          <p className="text-xs text-nature-600 mt-1">Rekap kas masuk & keluar per hari</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="date" 
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none text-sm font-bold text-gray-700"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
            <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-2">
               <Wallet size={16}/> Total Uang Cash (Net)
            </p>
            <h4 className="text-2xl font-black text-green-700">Rp{totalCash.toLocaleString('id-ID')}</h4>
            <p className="text-xs text-green-600 mt-1 opacity-80">Ada di laci kasir</p>
          </div>
          
          <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
               <CreditCard size={16}/> Total Transfer Masuk
            </p>
            <h4 className="text-2xl font-black text-blue-700">Rp{totalTransfer.toLocaleString('id-ID')}</h4>
            <p className="text-xs text-blue-600 mt-1 opacity-80">Cek mutasi bank</p>
          </div>

          <div className="bg-gray-800 p-5 rounded-2xl border border-gray-700 text-white">
             <div className="flex justify-between items-start">
               <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                     Omset Harian (Net)
                  </p>
                  <h4 className="text-2xl font-black">Rp{netTotal.toLocaleString('id-ID')}</h4>
               </div>
               <div className="text-right text-xs space-y-1">
                 <div className="text-green-400">Masuk: +{totalIn.toLocaleString('id-ID')}</div>
                 <div className="text-red-400">Keluar: -{totalOut.toLocaleString('id-ID')}</div>
               </div>
             </div>
          </div>
        </div>

        {/* Action Button: Manual Entry */}
        <div className="mb-6">
           {!isManualEntryOpen ? (
             <button 
               onClick={() => setIsManualEntryOpen(true)}
               className="flex items-center gap-2 text-sm font-bold text-nature-700 bg-nature-50 px-4 py-2 rounded-lg hover:bg-nature-100 transition border border-nature-200"
             >
               <Plus size={16}/> Catat Kas Manual (Bensin/Makan/Lainnya)
             </button>
           ) : (
             <form onSubmit={handleManualSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-slide-in-right">
                <h4 className="text-sm font-bold text-gray-800 mb-3">Input Transaksi Manual</h4>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                   <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Keterangan</label>
                      <input 
                        type="text" 
                        placeholder="Contoh: Beli Token Listrik" 
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        value={manualDesc}
                        onChange={e => setManualDesc(e.target.value)}
                        autoFocus
                      />
                   </div>
                   <div className="w-full md:w-40">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Nominal</label>
                      <input 
                        type="number" 
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        value={manualAmount === 0 ? '' : manualAmount}
                        onChange={e => setManualAmount(Number(e.target.value))}
                      />
                   </div>
                   <div className="w-full md:w-32">
                      <label className="text-xs font-bold text-gray-500 mb-1 block">Jenis</label>
                      <select 
                        className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                        value={manualType}
                        onChange={e => setManualType(e.target.value as 'IN' | 'OUT')}
                      >
                         <option value="OUT">Pengeluaran</option>
                         <option value="IN">Pemasukan</option>
                      </select>
                   </div>
                   <div className="flex gap-2">
                      <button type="submit" className="bg-nature-600 text-white p-2 rounded-lg hover:bg-nature-700">
                         <Save size={18} />
                      </button>
                      <button type="button" onClick={() => setIsManualEntryOpen(false)} className="bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300">
                         <Plus size={18} className="rotate-45" />
                      </button>
                   </div>
                </div>
             </form>
           )}
        </div>

        {/* Transaction Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
           <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                 <tr>
                    <th className="px-6 py-3">Jam</th>
                    <th className="px-6 py-3">Keterangan</th>
                    <th className="px-6 py-3">Metode</th>
                    <th className="px-6 py-3 text-right">Nominal</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {isLoading ? (
                    <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400"/></td></tr>
                 ) : logs.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Belum ada transaksi hari ini.</td></tr>
                 ) : (
                    logs.map(log => (
                       <tr key={log.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                             {new Date(log.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="px-6 py-3">
                             <span className="font-bold text-gray-800">{log.description}</span>
                             {log.transaction_id && <span className="text-xs text-gray-400 block">Ref: #{log.transaction_id.slice(0,6)}</span>}
                          </td>
                          <td className="px-6 py-3">
                             {log.payment_method === 'cash' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 text-xs font-bold uppercase border border-green-100"><Wallet size={10}/> Cash</span>
                             ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold uppercase border border-blue-100"><CreditCard size={10}/> Transfer</span>
                             )}
                          </td>
                          <td className={`px-6 py-3 text-right font-bold ${log.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                             {log.type === 'IN' ? '+' : '-'} Rp{log.amount.toLocaleString('id-ID')}
                          </td>
                       </tr>
                    ))
                 )}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinanceManager;