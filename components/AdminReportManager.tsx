import React, { useState, useEffect } from 'react';
import { PieChart, Calendar, TrendingUp, TrendingDown, Package, Loader2, Printer, CheckCircle, XCircle } from 'lucide-react';
import { Transaction } from '../types';
import { getTransactionsByDateRange } from '../services/transactionService';

const AdminReportManager: React.FC = () => {
  // Date State: Default to Current Month
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // Today
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getTransactionsByDateRange(startDate, endDate);
    setTransactions(data);
    setIsLoading(false);
  };

  // --- REPORT LOGIC ---
  const validTransactions = transactions.filter(t => t.status !== 'cancelled');
  
  // 1. Total Revenue (Omset Kotor - Total Harga Sewa dari TRX valid)
  const totalRevenue = validTransactions.reduce((acc, t) => acc + t.totalPrice, 0);
  
  // 2. Total Actual Income (Uang yang benar-benar masuk / Amount Paid)
  const totalIncome = validTransactions.reduce((acc, t) => acc + (t.amountPaid || 0), 0);
  
  // 3. Receivables (Piutang / Uang yang belum dibayar)
  const totalReceivables = totalRevenue - totalIncome;

  // 4. Status Breakdown
  const completedCount = transactions.filter(t => t.status === 'completed' || t.status === 'rented').length;
  const cancelledCount = transactions.filter(t => t.status === 'cancelled').length;
  const bookingCount = transactions.filter(t => t.status === 'booked' || t.status === 'pending' || t.status === 'partial_payment').length;

  // 5. Top Products Logic
  const productFrequency: { [key: string]: number } = {};
  validTransactions.forEach(t => {
     t.items.forEach(item => {
        const key = item.name;
        productFrequency[key] = (productFrequency[key] || 0) + item.quantity;
     });
  });

  // Convert map to array and sort
  const topProducts = Object.entries(productFrequency)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-nature-50">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <PieChart size={20} /> Laporan & Analisis
          </h3>
          <p className="text-xs text-nature-600 mt-1">Rekap performa bisnis Mamas Outdoor</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 no-print">
           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200">
             <Calendar size={14} className="text-gray-400" />
             <input 
               type="date" 
               className="text-sm font-bold text-gray-700 outline-none"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
             />
             <span className="text-gray-400">-</span>
             <input 
               type="date" 
               className="text-sm font-bold text-gray-700 outline-none"
               value={endDate}
               onChange={(e) => setEndDate(e.target.value)}
             />
           </div>
           <button 
             onClick={handlePrint}
             className="bg-gray-800 hover:bg-gray-900 text-white p-2 rounded-lg transition flex items-center gap-2 text-sm font-bold"
           >
             <Printer size={16} /> Print
           </button>
        </div>
      </div>

      <div className="p-8 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
             <Loader2 className="animate-spin text-nature-600" size={32} />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Calendar size={32} />
             </div>
             <p>Tidak ada data transaksi pada rentang tanggal ini.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-slide-in-right">
             
             {/* 1. FINANCIAL SUMMARY CARDS */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <TrendingUp size={16} className="text-green-500"/> Pendapatan (Omset)
                   </p>
                   <h4 className="text-3xl font-black text-gray-900">Rp{totalRevenue.toLocaleString('id-ID')}</h4>
                   <p className="text-xs text-gray-400 mt-2">Total nilai sewa dari {validTransactions.length} transaksi valid</p>
                </div>
                
                <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
                   <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <CheckCircle size={16}/> Uang Masuk (Cash/TF)
                   </p>
                   <h4 className="text-3xl font-black text-green-700">Rp{totalIncome.toLocaleString('id-ID')}</h4>
                   <p className="text-xs text-green-600 mt-2 opacity-80">Realisasi pembayaran diterima</p>
                </div>

                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                   <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <TrendingDown size={16}/> Piutang (Belum Bayar)
                   </p>
                   <h4 className="text-3xl font-black text-orange-700">Rp{totalReceivables.toLocaleString('id-ID')}</h4>
                   <p className="text-xs text-orange-600 mt-2 opacity-80">Sisa tagihan pelanggan</p>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 2. TOP PRODUCTS TABLE */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                   <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <Package size={20} className="text-nature-600"/> 5 Produk Paling Laris
                   </h4>
                   <div className="space-y-4">
                      {topProducts.map((p, idx) => (
                         <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                  #{idx+1}
                               </div>
                               <span className="font-medium text-gray-700 text-sm">{p.name}</span>
                            </div>
                            <span className="font-bold text-nature-700 bg-nature-50 px-3 py-1 rounded-full text-xs">{p.count}x Sewa</span>
                         </div>
                      ))}
                   </div>
                </div>

                {/* 3. TRANSACTION STATUS SUMMARY */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                   <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <PieChart size={20} className="text-blue-600"/> Status Transaksi
                   </h4>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                         <div className="flex items-center gap-3">
                            <CheckCircle size={20} className="text-green-600" />
                            <span className="text-sm font-bold text-green-800">Selesai / Sedang Sewa</span>
                         </div>
                         <span className="text-lg font-black text-green-700">{completedCount}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                         <div className="flex items-center gap-3">
                            <Calendar size={20} className="text-blue-600" />
                            <span className="text-sm font-bold text-blue-800">Booking / Pending</span>
                         </div>
                         <span className="text-lg font-black text-blue-700">{bookingCount}</span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                         <div className="flex items-center gap-3">
                            <XCircle size={20} className="text-red-600" />
                            <span className="text-sm font-bold text-red-800">Dibatalkan</span>
                         </div>
                         <span className="text-lg font-black text-red-700">{cancelledCount}</span>
                      </div>
                   </div>
                </div>

             </div>

             {/* 4. RECENT TRANSACTIONS TABLE (Simple View) */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                   <h4 className="font-bold text-sm text-gray-700 uppercase tracking-widest">Detail Transaksi Periode Ini</h4>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-500 font-bold border-b border-gray-100">
                         <tr>
                            <th className="px-6 py-3">Tanggal</th>
                            <th className="px-6 py-3">Pelanggan</th>
                            <th className="px-6 py-3 text-right">Total</th>
                            <th className="px-6 py-3 text-center">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                         {transactions.slice(0, 10).map(t => (
                            <tr key={t.id} className="hover:bg-gray-50">
                               <td className="px-6 py-3 text-gray-600">{new Date(t.rentalDate).toLocaleDateString('id-ID')}</td>
                               <td className="px-6 py-3 font-bold text-gray-800">{t.customerName}</td>
                               <td className="px-6 py-3 text-right font-mono text-gray-700">Rp{t.totalPrice.toLocaleString('id-ID')}</td>
                               <td className="px-6 py-3 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                    t.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    t.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {t.status}
                                  </span>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                   {transactions.length > 10 && (
                      <div className="px-6 py-3 text-center text-xs text-gray-400 bg-gray-50 italic">
                         Menampilkan 10 transaksi terbaru dari total {transactions.length}
                      </div>
                   )}
                </div>
             </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReportManager;