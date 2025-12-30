import React, { useState, useEffect } from 'react';
import { PieChart, Calendar, TrendingUp, TrendingDown, Package, Loader2, Printer, CheckCircle, XCircle, Download, BarChart3, Clock, Users, ArrowUpRight, AlertTriangle, MessageCircle, BellRing, Calculator } from 'lucide-react';
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
  
  // 1. Total Revenue (Nilai Transaksi)
  const totalRevenue = validTransactions.reduce((acc, t) => acc + t.totalPrice, 0);
  
  // 2. Real Income (Uang Masuk Rill)
  // FIX: Kita cap amountPaid dengan totalPrice. 
  // Jika tagihan 13.000 tapi di DB tercatat bayar 20.000 (karena input kasir),
  // yang diakui sebagai omset tetap 13.000. Sisa 7.000 adalah kembalian.
  const totalIncome = validTransactions.reduce((acc, t) => {
    const paid = t.amountPaid || 0;
    const bill = t.totalPrice;
    return acc + Math.min(paid, bill);
  }, 0);

  const totalReceivables = Math.max(0, totalRevenue - totalIncome);

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

  // 4. Daily Revenue Trend
  const dailyRevenueMap: { [date: string]: number } = {};
  validTransactions.forEach(t => {
    const date = t.rentalDate.split('T')[0]; // YYYY-MM-DD
    dailyRevenueMap[date] = (dailyRevenueMap[date] || 0) + t.totalPrice;
  });

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

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

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
        
        // Hitung Denda: Harga Harian x Jumlah Hari Terlambat
        const dailyRate = Math.ceil(t.totalPrice / t.duration);
        fineAmount = dailyRate * daysLate;

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

  // WA: TEMPLATE PENGINGAT (Lewat jam 19:00, belum ganti hari)
  const sendDeadlineReminder = (t: any) => {
    let phone = t.customerWhatsapp;
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    
    const itemList = t.items.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n');
    
    const message = `Halo Kak *${t.customerName}*,\n\nKami dari *Mamas Outdoor Purwokerto* menginformasikan bahwa saat ini sudah melewati pukul 19.00 WIB.\n\nMasa sewa alat berikut:\n${itemList}\n\n*Berakhir HARI INI*.\n\nMohon segera dikembalikan malam ini sebelum pergantian hari untuk menghindari perhitungan denda otomatis (1 hari sewa) mulai besok.\n\nJika sedang dalam perjalanan, mohon konfirmasinya.\nTerima kasih.`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // WA: TEMPLATE DENDA (Sudah ganti hari)
  const sendOverdueNotice = (t: any) => {
    let phone = t.customerWhatsapp;
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    
    const itemList = t.items.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n');
    
    const message = `Halo Kak *${t.customerName}*,\n\nKami dari *Mamas Outdoor Purwokerto*.\n\nStatus pengembalian alat:\n${itemList}\n\nSaat ini statusnya *TERLAMBAT ${t.daysLate} HARI*.\n\nSesuai ketentuan, keterlambatan dikenakan biaya sewa harian.\n*Estimasi Denda Saat Ini: Rp${t.fineAmount.toLocaleString('id-ID')}*\n\nMohon segera dikembalikan dan diselesaikan pembayarannya untuk menghentikan akumulasi denda.\n\nTerima kasih.`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
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
                            <p className="text-sm text-red-700 mb-2">
                               Transaksi berikut sudah ganti hari dan terkena denda otomatis.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                               {overdueItems.map(t => (
                                  <button 
                                    key={t.id}
                                    onClick={() => sendOverdueNotice(t)}
                                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition shadow-sm"
                                  >
                                     <Calculator size={12} /> {t.customerName.split(' ')[0]} (Denda: {t.daysLate} Hari)
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
                            <p className="text-sm text-orange-700 mb-2">
                               Sudah lewat jam 19:00. Segera ingatkan sebelum ganti hari (kena denda).
                            </p>
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

             {/* 2. REVENUE CHART */}
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
                </div>
             </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReportManager;