import React, { useState, useEffect } from 'react';
import { PieChart, Calendar, TrendingUp, TrendingDown, Package, Loader2, Printer, CheckCircle, XCircle, Download, BarChart3, Clock, Users, ArrowUpRight, AlertTriangle, MessageCircle, BellRing, Calculator, Tent, Backpack, Flame, Map, Trophy } from 'lucide-react';
import { Transaction } from '../types';
import { getTransactionsByDateRange } from '../services/transactionService';

const AdminReportManager: React.FC = () => {
  // Date State: Default to Current Month
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of month
    // Format YYYY-MM-DD in Local Time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // Today
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

  // Helper: Hitung Harga Item Berdasarkan Durasi (Logika Pricing Mamas)
  const getItemPriceForDuration = (item: any, days: number): number => {
    const p2 = item.price2Days || 0;
    const p3 = item.price3Days || 0;
    const p4 = item.price4Days || 0;
    const p5 = item.price5Days || 0;
    const p6 = item.price6Days || 0;
    const p7 = item.price7Days || 0;

    if (days <= 2) return p2;
    if (days === 3) return p3;
    if (days === 4) return p4;
    if (days === 5) return p5;
    if (days === 6) return p6;
    // Jika lebih dari 7 hari: Harga 7 hari + (Kelebihan hari x 40% harga 2 hari)
    return p7 + ((days - 7) * (p2 * 0.4));
  };

  // --- REPORT LOGIC ---
  const validTransactions = transactions.filter(t => t.status !== 'cancelled');
  
  // 1. Total Revenue (Nilai Transaksi)
  const totalRevenue = validTransactions.reduce((acc, t) => acc + t.totalPrice, 0);
  
  // 2. Real Income (Uang Masuk Rill)
  const totalIncome = validTransactions.reduce((acc, t) => {
    const paid = t.amountPaid || 0;
    const bill = t.totalPrice;
    return acc + Math.min(paid, bill);
  }, 0);

  const totalReceivables = Math.max(0, totalRevenue - totalIncome);

  // 3. PRODUCT & CATEGORY ANALYSIS LOGIC
  const productStats: { [key: string]: { name: string, category: string, totalQty: number, trxCount: number } } = {};
  const categoryStats: { [key: string]: number } = {};

  validTransactions.forEach(t => {
     t.items.forEach(item => {
        // Product Stats
        // Gunakan kombinasi Nama sebagai key jika ID berubah-ubah di mock, idealnya pakai ID
        const key = item.id; 
        if (!productStats[key]) {
            productStats[key] = { 
                name: item.name, 
                category: item.category || 'Lainnya', 
                totalQty: 0, 
                trxCount: 0 
            };
        }
        productStats[key].totalQty += item.quantity;
        productStats[key].trxCount += 1; // Dihitung 1 kali per transaksi (nota)

        // Category Stats
        const cat = item.category || 'Lainnya';
        if (!categoryStats[cat]) categoryStats[cat] = 0;
        categoryStats[cat] += item.quantity;
     });
  });

  // Sort Products by Total Quantity Rented
  const sortedProductStats = Object.values(productStats).sort((a, b) => b.totalQty - a.totalQty);
  
  // Sort Categories by Volume
  const sortedCategoryStats = Object.entries(categoryStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Top 5 for Summary Card
  const topProducts = sortedProductStats.slice(0, 5);

  // 4. Daily Revenue Trend (FIXED LOGIC)
  const dailyRevenueMap: { [date: string]: number } = {};
  validTransactions.forEach(t => {
    // Normalize date string (just in case)
    const dateStr = t.rentalDate.includes('T') ? t.rentalDate.split('T')[0] : t.rentalDate;
    dailyRevenueMap[dateStr] = (dailyRevenueMap[dateStr] || 0) + t.totalPrice;
  });

  // Safe Date Range Generation (Local Timezone)
  const getDatesInRange = (startStr: string, endStr: string) => {
    const arr = [];
    const [sY, sM, sD] = startStr.split('-').map(Number);
    const [eY, eM, eD] = endStr.split('-').map(Number);
    
    const dt = new Date(sY, sM - 1, sD);
    const endDt = new Date(eY, eM - 1, eD);

    while (dt <= endDt) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      arr.push(`${y}-${m}-${d}`);
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };

  const datesInRange = getDatesInRange(startDate, endDate);
  const chartData = datesInRange.map(date => ({
    dateShort: new Date(date.split('-').map(Number).join('/')).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), // Force generic parser
    fullDate: date,
    revenue: dailyRevenueMap[date] || 0
  }));

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 100000); // Min scale 100k

  // 5. Top Customers
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
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // 6. Return Schedule & LATE DETECTION LOGIC
  const now = new Date();

  const returnsInPeriod = validTransactions.map(t => {
    const rentalDate = new Date(t.rentalDate);
    const returnDate = new Date(rentalDate);
    returnDate.setDate(rentalDate.getDate() + (t.duration - 1));
    
    // Deadline Reminder: Jam 19:00 Hari H
    const reminderDeadline = new Date(returnDate);
    reminderDeadline.setHours(19, 0, 0, 0); 

    // Deadline Overdue: Jam 23:59:59 Hari H (Besoknya telat)
    const overdueDeadline = new Date(returnDate);
    overdueDeadline.setHours(23, 59, 59, 999);

    let statusType = 'normal'; // normal | reminder | overdue
    let daysLate = 0;
    let fineAmount = 0;

    if (t.status === 'rented') {
      if (now > overdueDeadline) {
        // SUDAH GANTI HARI -> DENDA
        statusType = 'overdue';
        
        // Hitung selisih hari (pembulatan ke atas)
        const diffTime = Math.abs(now.getTime() - overdueDeadline.getTime());
        daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        // LOGIKA DENDA BARU:
        const calculationDuration = daysLate + 1;

        // Hitung total denda berdasarkan harga item
        fineAmount = t.items.reduce((totalFine, item) => {
           const priceForFineDuration = getItemPriceForDuration(item, calculationDuration);
           return totalFine + (priceForFineDuration * item.quantity);
        }, 0);

      } else if (now > reminderDeadline) {
        // LEWAT JAM 19:00 TAPI MASIH HARI YANG SAMA -> REMINDER
        statusType = 'reminder';
      }
    }

    return { 
      ...t, 
      returnDateObj: returnDate,
      returnDateStr: returnDate.toISOString().split('T')[0],
      statusType,
      daysLate,
      fineAmount
    };
  }).filter(t => {
    const inRange = t.returnDateStr >= startDate && t.returnDateStr <= endDate;
    // Tampilkan jika dalam range tanggal ATAU jika sedang bermasalah (reminder/overdue)
    return inRange || t.statusType !== 'normal';
  }).sort((a, b) => {
    // Prioritaskan yang Overdue paling atas, lalu Reminder
    if (a.statusType === 'overdue' && b.statusType !== 'overdue') return -1;
    if (b.statusType === 'overdue' && a.statusType !== 'overdue') return 1;
    if (a.statusType === 'reminder' && b.statusType !== 'reminder') return -1;
    if (b.statusType === 'reminder' && a.statusType !== 'reminder') return 1;
    return a.returnDateStr.localeCompare(b.returnDateStr);
  });

  // Filter Items for Alert Boxes
  const overdueItems = returnsInPeriod.filter(t => t.statusType === 'overdue');
  const reminderItems = returnsInPeriod.filter(t => t.statusType === 'reminder');

  // --- ACTIONS ---
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ["ID Transaksi", "Tanggal Sewa", "Nama Pelanggan", "WhatsApp", "Item Sewa", "Total Harga", "Status", "Tanggal Kembali", "Status Keterlambatan", "Denda Estimasi"];
    const rows = returnsInPeriod.map(t => {
      const itemsList = t.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
      const statusKet = t.statusType === 'overdue' ? `Terlambat ${t.daysLate} Hari` : t.statusType === 'reminder' ? 'Lewat Jam 19:00' : 'Aman';
      
      return [
        `"${t.id}"`,
        t.rentalDate.split('T')[0],
        `"${t.customerName}"`,
        `'${t.customerWhatsapp}`, 
        `"${itemsList}"`,
        t.totalPrice,
        t.status,
        t.returnDateStr,
        statusKet,
        t.fineAmount
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_MamasOutdoor_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendDeadlineReminder = (t: any) => {
    let phone = t.customerWhatsapp;
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    
    const itemList = t.items.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n');
    const message = `Halo Kak *${t.customerName}*,\n\nKami dari *Mamas Outdoor Purwokerto* menginformasikan bahwa saat ini sudah melewati pukul 19.00 WIB.\n\nMasa sewa alat berikut:\n${itemList}\n\n*Berakhir HARI INI*.\n\nMohon segera dikembalikan malam ini sebelum pergantian hari untuk menghindari perhitungan denda otomatis (1 hari sewa) mulai besok.\n\nJika sedang dalam perjalanan, mohon konfirmasinya.\nTerima kasih.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendOverdueNotice = (t: any) => {
    let phone = t.customerWhatsapp;
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    
    const itemList = t.items.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n');
    const message = `Halo Kak *${t.customerName}*,\n\nKami dari *Mamas Outdoor Purwokerto*.\n\nStatus pengembalian alat:\n${itemList}\n\nSaat ini statusnya *TERLAMBAT ${t.daysLate} HARI*.\n\n*Estimasi Denda Saat Ini: Rp${t.fineAmount.toLocaleString('id-ID')}*\n\nMohon segera dikembalikan dan diselesaikan pembayarannya untuk menghentikan akumulasi denda.\n\nTerima kasih.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Helper Icon Kategori
  const getCategoryIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('tenda')) return <Tent size={18} />;
    if (n.includes('carrier') || n.includes('tas')) return <Backpack size={18} />;
    if (n.includes('masak') || n.includes('kompor')) return <Flame size={18} />;
    if (n.includes('jalan') || n.includes('trekking')) return <Map size={18} />;
    return <Package size={18} />;
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
        ) : transactions.length === 0 && chartData.every(d => d.revenue === 0) ? (
          <div className="text-center py-20 text-gray-400">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Calendar size={32} />
             </div>
             <p>Tidak ada data transaksi pada rentang tanggal ini.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-slide-in-right">
             
             {/* ALERT BOXES */}
             {(overdueItems.length > 0 || reminderItems.length > 0) && (
               <div className="flex flex-col gap-4">
                 {/* 1. TERLAMBAT (FINE) */}
                 {overdueItems.length > 0 && (
                   <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl shadow-sm">
                      <div className="flex items-start gap-3">
                         <AlertTriangle className="text-red-600 mt-0.5" size={24} />
                         <div className="flex-1">
                            <h4 className="font-bold text-red-800 text-lg">Terlambat & Kena Denda ({overdueItems.length})</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                               {overdueItems.map(t => (
                                  <button 
                                    key={t.id}
                                    onClick={() => sendOverdueNotice(t)}
                                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition shadow-sm"
                                  >
                                     <Calculator size={12} /> {t.customerName.split(' ')[0]} (Lat: {t.daysLate} Hari)
                                  </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* 2. REMINDER (LEWAT 19:00) */}
                 {reminderItems.length > 0 && (
                   <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm">
                      <div className="flex items-start gap-3">
                         <BellRing className="text-orange-500 mt-0.5" size={24} />
                         <div className="flex-1">
                            <h4 className="font-bold text-orange-800 text-lg">Pengingat Batas Waktu ({reminderItems.length})</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                               {reminderItems.map(t => (
                                  <button 
                                    key={t.id}
                                    onClick={() => sendDeadlineReminder(t)}
                                    className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition shadow-sm"
                                  >
                                     <MessageCircle size={12} /> Ingatkan {t.customerName.split(' ')[0]}
                                  </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                 )}
               </div>
             )}

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
                     <CheckCircle size={16}/> Uang Masuk (Net)
                   </p>
                   <h4 className="text-3xl font-black text-green-700">Rp{totalIncome.toLocaleString('id-ID')}</h4>
                   <p className="text-xs text-green-600 mt-2 opacity-80">Cash + Transfer (Tanpa Kembalian)</p>
                </div>

                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                   <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <TrendingDown size={16}/> Piutang (Belum Bayar)
                   </p>
                   <h4 className="text-3xl font-black text-orange-700">Rp{totalReceivables.toLocaleString('id-ID')}</h4>
                   <p className="text-xs text-orange-600 mt-2 opacity-80">Sisa tagihan pelanggan</p>
                </div>
             </div>

             {/* 2. CATEGORY BREAKDOWN STATS */}
             <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <Package size={20} className="text-nature-600"/> Statistik Kategori (Unit Keluar)
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                   {sortedCategoryStats.map((cat, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                         <div className="p-2 bg-gray-100 rounded-lg text-gray-600 mb-2">
                            {getCategoryIcon(cat.name)}
                         </div>
                         <span className="text-xs font-bold text-gray-500 uppercase tracking-wide truncate w-full">{cat.name}</span>
                         <span className="text-xl font-black text-nature-700">{cat.count}</span>
                         <span className="text-[10px] text-gray-400">Unit</span>
                      </div>
                   ))}
                </div>
             </div>

             {/* 3. DETAILED PRODUCT RANKING TABLE */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center">
                   <h4 className="font-bold text-purple-800 flex items-center gap-2">
                      <Trophy size={18} /> Peringkat Produk Paling Sering Disewa
                   </h4>
                   <span className="text-xs bg-white px-2 py-1 rounded font-bold text-purple-600">Top 100</span>
                </div>
                <div className="overflow-x-auto max-h-96">
                   <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-600 font-bold border-b border-gray-200 sticky top-0 shadow-sm">
                         <tr>
                            <th className="px-6 py-3 w-16 text-center">#</th>
                            <th className="px-6 py-3">Nama Produk</th>
                            <th className="px-6 py-3">Kategori</th>
                            <th className="px-6 py-3 text-center">Frekuensi Sewa</th>
                            <th className="px-6 py-3 text-center bg-purple-50/50">Total Unit Keluar</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                         {sortedProductStats.length === 0 ? (
                            <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada data produk keluar.</td></tr>
                         ) : (
                            sortedProductStats.map((p, idx) => (
                               <tr key={idx} className="hover:bg-gray-50 transition">
                                  <td className="px-6 py-3 text-center font-bold text-gray-400">
                                     {idx + 1}
                                  </td>
                                  <td className="px-6 py-3 font-bold text-gray-800">
                                     {p.name}
                                  </td>
                                  <td className="px-6 py-3">
                                     <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium">
                                        {p.category}
                                     </span>
                                  </td>
                                  <td className="px-6 py-3 text-center text-gray-600">
                                     {p.trxCount}x <span className="text-[10px] text-gray-400">Nota</span>
                                  </td>
                                  <td className="px-6 py-3 text-center font-bold text-purple-700 bg-purple-50/30">
                                     {p.totalQty} Unit
                                  </td>
                               </tr>
                            ))
                         )}
                      </tbody>
                   </table>
                </div>
             </div>

             {/* 4. REVENUE CHART */}
             <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                   <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <BarChart3 size={20} className="text-nature-600"/> Tren Pendapatan Harian
                   </h4>
                   <div className="text-xs text-gray-400">
                      Omset berdasarkan Tanggal Sewa
                   </div>
                </div>
                
                {/* Scrollable Container for Chart */}
                <div className="overflow-x-auto pb-4 custom-scrollbar">
                   <div className="h-64 flex items-end gap-3 min-w-full w-max px-2">
                      {chartData.map((d, i) => {
                         const heightPercent = Math.round((d.revenue / maxRevenue) * 100);
                         const barHeight = d.revenue > 0 ? `${Math.max(heightPercent, 2)}%` : '2px';
                         const isToday = d.fullDate === new Date().toISOString().split('T')[0];

                         return (
                            <div key={i} className="flex flex-col justify-end items-center flex-1 min-w-[32px] group relative h-full">
                               {/* Hover Tooltip */}
                               <div className="mb-2 opacity-0 group-hover:opacity-100 absolute bottom-full bg-gray-900 text-white text-[10px] px-3 py-1.5 rounded-lg shadow-xl transition-all pointer-events-none whitespace-nowrap z-20 transform translate-y-2 group-hover:translate-y-0">
                                  <div className="font-bold">{d.fullDate}</div>
                                  <div className="text-green-300">Rp{d.revenue.toLocaleString('id-ID')}</div>
                                  {/* Triangle pointer */}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                               </div>
                               
                               {/* Bar */}
                               <div className="w-full relative flex items-end justify-center h-full">
                                  <div 
                                    className={`w-full rounded-t-md transition-all duration-700 ease-out relative ${
                                       d.revenue > 0 
                                          ? isToday ? 'bg-nature-600' : 'bg-nature-400 group-hover:bg-nature-500' 
                                          : 'bg-gray-100'
                                    }`}
                                    style={{ height: barHeight }}
                                  >
                                     {d.revenue > 0 && (
                                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                           {heightPercent}%
                                        </div>
                                     )}
                                  </div>
                               </div>
                               
                               {/* Label */}
                               <div className={`text-[9px] font-medium mt-3 whitespace-nowrap -rotate-45 origin-top-left translate-y-2 ${isToday ? 'text-nature-700 font-bold' : 'text-gray-400'}`}>
                                  {d.dateShort}
                               </div>
                            </div>
                         )
                      })}
                   </div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 5. TOP CUSTOMERS */}
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

             {/* 6. RETURN SCHEDULE (Jadwal Pengembalian) */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                   <h4 className="font-bold text-sm text-orange-800 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={16} /> Jadwal Pengembalian & Status
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
                              <th className="px-6 py-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {returnsInPeriod.map(t => {
                              const isOverdue = t.statusType === 'overdue';
                              const isReminder = t.statusType === 'reminder';
                              
                              let rowClass = 'hover:bg-gray-50';
                              if (isOverdue) rowClass = 'bg-red-50 hover:bg-red-100 transition';
                              else if (isReminder) rowClass = 'bg-orange-50 hover:bg-orange-100 transition';

                              return (
                                <tr key={t.id} className={rowClass}>
                                    <td className="px-6 py-3">
                                      <span className={`font-bold ${isOverdue ? 'text-red-700' : isReminder ? 'text-orange-700' : 'text-gray-700'}`}>
                                        {new Date(t.returnDateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                      </span>
                                      {isOverdue && (
                                        <div className="mt-1">
                                          <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-black">LAT {t.daysLate} HARI</span>
                                          <div className="text-[10px] text-red-600 font-bold mt-0.5">Denda: Rp{t.fineAmount.toLocaleString('id-ID')}</div>
                                        </div>
                                      )}
                                      {isReminder && (
                                        <span className="block mt-1 text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-black w-fit">
                                          LEWAT JAM 19:00
                                        </span>
                                      )}
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
                                    <td className="px-6 py-3 text-center">
                                      {t.status === 'rented' && (
                                        <>
                                          {isOverdue ? (
                                             <button 
                                              onClick={() => sendOverdueNotice(t)}
                                              className="p-2 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-sm border border-red-700 transition"
                                              title="Tagih Denda"
                                             >
                                                <Calculator size={16} />
                                             </button>
                                          ) : isReminder ? (
                                             <button 
                                              onClick={() => sendDeadlineReminder(t)}
                                              className="p-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 shadow-sm border border-orange-600 transition animate-pulse"
                                              title="Ingatkan Deadline"
                                             >
                                                <BellRing size={16} />
                                             </button>
                                          ) : (
                                             <button 
                                              onClick={() => sendDeadlineReminder(t)}
                                              className="p-2 rounded-full bg-white text-green-600 hover:bg-green-50 shadow-sm border border-gray-200 transition"
                                              title="Chat WA Biasa"
                                             >
                                                <MessageCircle size={16} />
                                             </button>
                                          )}
                                        </>
                                      )}
                                    </td>
                                </tr>
                              )
                          })}
                        </tbody>
                    </table>
                  </div>
                )}
             </div>

             {/* 7. RECENT TRANSACTIONS TABLE */}
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
                </div>
             </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReportManager;