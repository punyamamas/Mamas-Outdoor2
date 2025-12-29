import React, { useState, useEffect } from 'react';
import { PieChart, Calendar, TrendingUp, TrendingDown, Package, Loader2, Printer, CheckCircle, XCircle, Download, BarChart3, Clock, Users, ArrowUpRight } from 'lucide-react';
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
  
  // 1. Total Revenue
  const totalRevenue = validTransactions.reduce((acc, t) => acc + t.totalPrice, 0);
  const totalIncome = validTransactions.reduce((acc, t) => acc + (t.amountPaid || 0), 0);
  const totalReceivables = totalRevenue - totalIncome;

  // 2. Status Breakdown
  const completedCount = transactions.filter(t => t.status === 'completed' || t.status === 'rented').length;
  const cancelledCount = transactions.filter(t => t.status === 'cancelled').length;
  const bookingCount = transactions.filter(t => t.status === 'booked' || t.status === 'pending' || t.status === 'partial_payment').length;

  // 3. Top Products Logic
  const productFrequency: { [key: string]: number } = {};
  validTransactions.forEach(t => {
     t.items.forEach(item => {
        const key = item.name;
        productFrequency[key] = (productFrequency[key] || 0) + item.quantity;
     });
  });

  const topProducts = Object.entries(productFrequency)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 4. NEW: Daily Revenue Trend (Grafik Harian)
  const dailyRevenueMap: { [date: string]: number } = {};
  validTransactions.forEach(t => {
    const date = t.rentalDate.split('T')[0]; // YYYY-MM-DD
    dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + t.totalPrice;
  });

  // Isi tanggal kosong dengan 0 agar grafik rapi
  const getDatesInRange = (start: string, end: string) => {
    const arr = [];
    const dt = new Date(start);
    const endDt = new Date(end);
    while (dt <= endDt) {
      arr.push(new Date(dt).toISOString().split('T')[0]);
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };

  const datesInRange = getDatesInRange(startDate, endDate);
  const chartData = datesInRange.map(date => ({
    date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    fullDate: date,
    revenue: dailyRevenueMap[date] || 0
  }));

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1); // Avoid div by zero

  // 5. NEW: Top Customers
  const customerFrequency: { [key: string]: { count: number, totalSpent: number } } = {};
  validTransactions.forEach(t => {
    const name = t.customerName;
    if (!customerFrequency[name]) {
      customerFrequency[name] = { count: 0, totalSpent: 0 };
    }
    customerFrequency[name].count += 1;
    customerFrequency[name].totalSpent += t.totalPrice;
  });

  const topCustomers = Object.entries(customerFrequency)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.totalSpent - a.totalSpent) // Sort by spending
    .slice(0, 5);

  // 6. NEW: Return Schedule (Jadwal Pengembalian di range tanggal ini)
  const returnsInPeriod = validTransactions.map(t => {
    const rentalDate = new Date(t.rentalDate);
    const returnDate = new Date(rentalDate);
    returnDate.setDate(rentalDate.getDate() + (t.duration - 1));
    return { ...t, returnDateStr: returnDate.toISOString().split('T')[0] };
  }).filter(t => {
    // Filter yang tanggal kembalinya ada di range selectedDate
    return t.returnDateStr >= startDate && t.returnDateStr <= endDate;
  }).sort((a, b) => a.returnDateStr.localeCompare(b.returnDateStr));


  // --- ACTIONS ---
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // Header
    const headers = ["ID Transaksi", "Tanggal Sewa", "Nama Pelanggan", "WhatsApp", "Item Sewa", "Total Harga", "Sudah Bayar", "Status", "Tanggal Kembali"];
    
    // Rows
    const rows = transactions.map(t => {
      const rentalDate = new Date(t.rentalDate);
      const returnDate = new Date(rentalDate);
      returnDate.setDate(rentalDate.getDate() + (t.duration - 1));
      
      const itemsList = t.items.map(i => `${i.quantity}x ${i.name}`).join('; ');

      return [
        `"${t.id}"`,
        t.rentalDate.split('T')[0],
        `"${t.customerName}"`,
        `'${t.customerWhatsapp}`, // Force string for Excel
        `"${itemsList}"`,
        t.totalPrice,
        t.amountPaid || 0,
        t.status,
        returnDate.toISOString().split('T')[0]
      ];
    });

    const csvContent = [
      headers.join(','), 
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_MamasOutdoor_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
           <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
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
           
           <div className="flex items-center gap-2">
             <button 
               onClick={handleExportCSV}
               disabled={transactions.length === 0}
               className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition flex items-center gap-2 text-sm font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
               title="Download Excel/CSV"
             >
               <Download size={16} /> <span className="hidden sm:inline">CSV</span>
             </button>
             <button 
               onClick={handlePrint}
               className="bg-gray-800 hover:bg-gray-900 text-white p-2 rounded-lg transition flex items-center gap-2 text-sm font-bold shadow-sm"
               title="Cetak Laporan"
             >
               <Printer size={16} /> <span className="hidden sm:inline">Print</span>
             </button>
           </div>
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

             {/* 2. REVENUE CHART (Simple Bar Chart) */}
             <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                   <BarChart3 size={20} className="text-nature-600"/> Tren Pendapatan Harian
                </h4>
                <div className="h-48 flex items-end gap-2 overflow-x-auto pb-2">
                   {chartData.map((d, i) => {
                      const heightPercent = (d.revenue / maxRevenue) * 100;
                      return (
                         <div key={i} className="flex flex-col justify-end items-center flex-1 min-w-[40px] group relative">
                            <div className="mb-2 opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-[10px] px-2 py-1 rounded transition-opacity pointer-events-none whitespace-nowrap z-10">
                               {d.fullDate}: Rp{d.revenue.toLocaleString('id-ID')}
                            </div>
                            <div 
                              className={`w-full rounded-t-lg transition-all duration-500 ${d.revenue > 0 ? 'bg-nature-500 hover:bg-nature-600' : 'bg-gray-100 h-1'}`}
                              style={{ height: d.revenue > 0 ? `${Math.max(heightPercent, 5)}%` : '4px' }}
                            ></div>
                            <span className="text-[10px] text-gray-500 font-medium mt-2 whitespace-nowrap">{d.date}</span>
                         </div>
                      )
                   })}
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 3. TOP PRODUCTS */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full">
                   <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <Package size={20} className="text-purple-600"/> 5 Produk Paling Laris
                   </h4>
                   <div className="space-y-4">
                      {topProducts.length === 0 ? <p className="text-sm text-gray-400 italic">Belum ada data</p> : 
                      topProducts.map((p, idx) => (
                         <div key={idx} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                  #{idx+1}
                               </div>
                               <span className="font-medium text-gray-700 text-sm group-hover:text-nature-600 transition">{p.name}</span>
                            </div>
                            <span className="font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full text-xs">{p.count}x Sewa</span>
                         </div>
                      ))}
                   </div>
                </div>

                {/* 4. TOP CUSTOMERS */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm h-full">
                   <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <Users size={20} className="text-blue-600"/> Top 5 Pelanggan Sultan
                   </h4>
                   <div className="space-y-4">
                      {topCustomers.length === 0 ? <p className="text-sm text-gray-400 italic">Belum ada data</p> : 
                      topCustomers.map((c, idx) => (
                         <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${idx===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                  #{idx+1}
                               </div>
                               <div>
                                  <div className="font-medium text-gray-700 text-sm">{c.name}</div>
                                  <div className="text-[10px] text-gray-400">{c.count}x Transaksi</div>
                               </div>
                            </div>
                            <div className="text-right">
                               <span className="block font-bold text-blue-700 text-xs">Rp{c.totalSpent.toLocaleString('id-ID')}</span>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>

             </div>

             {/* 5. RETURN SCHEDULE (Jadwal Pengembalian) */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                   <h4 className="font-bold text-sm text-orange-800 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={16} /> Jadwal Pengembalian (Periode Ini)
                   </h4>
                   <span className="text-xs bg-white px-2 py-1 rounded font-bold text-orange-600">{returnsInPeriod.length} Item</span>
                </div>
                {returnsInPeriod.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm italic">Tidak ada jadwal pengembalian di rentang tanggal ini.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 font-bold border-b border-gray-100">
                          <tr>
                              <th className="px-6 py-3">Tgl Kembali</th>
                              <th className="px-6 py-3">Pelanggan</th>
                              <th className="px-6 py-3">Barang</th>
                              <th className="px-6 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {returnsInPeriod.map(t => {
                              const isLate = new Date() > new Date(t.returnDateStr) && t.status === 'rented';
                              return (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3">
                                      <span className={`font-bold ${isLate ? 'text-red-600' : 'text-gray-700'}`}>
                                        {new Date(t.returnDateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                      </span>
                                      {isLate && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded ml-2">TERLAMBAT</span>}
                                    </td>
                                    <td className="px-6 py-3 font-medium text-gray-800">
                                      {t.customerName} <br/>
                                      <span className="text-xs text-gray-400 font-mono">{t.customerWhatsapp}</span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-600 max-w-xs truncate">
                                      {t.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                        t.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        t.status === 'rented' ? 'bg-purple-100 text-purple-700' :
                                        'bg-gray-100 text-gray-600'
                                      }`}>
                                        {t.status === 'rented' ? 'Sedang Sewa' : t.status === 'completed' ? 'Kembali' : t.status}
                                      </span>
                                    </td>
                                </tr>
                              )
                          })}
                        </tbody>
                    </table>
                  </div>
                )}
             </div>

             {/* 6. RECENT TRANSACTIONS TABLE */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                   <h4 className="font-bold text-sm text-gray-700 uppercase tracking-widest">Detail Transaksi Terbaru</h4>
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