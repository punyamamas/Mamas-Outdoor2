
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

  // Helper: Hitung Harga Item Berdasarkan Durasi
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
    return p7 + ((days - 7) * (p2 * 0.4));
  };

  // --- REPORT LOGIC ---
  const validTransactions = transactions.filter(t => t.status !== 'cancelled');
  
  const totalRevenue = validTransactions.reduce((acc, t) => acc + t.totalPrice, 0);
  const totalFineRevenue = validTransactions.reduce((acc, t) => acc + (t.fineAmount || 0), 0);
  const totalRentalRevenue = totalRevenue - totalFineRevenue;

  const totalIncome = validTransactions.reduce((acc, t) => {
    const paid = t.amountPaid || 0;
    const bill = t.totalPrice;
    return acc + Math.min(paid, bill);
  }, 0);

  const totalReceivables = Math.max(0, totalRevenue - totalIncome);

  // PRODUCT & CATEGORY ANALYSIS
  const productStats: { [key: string]: { name: string, category: string, totalQty: number, trxCount: number } } = {};
  const categoryStats: { [key: string]: number } = {};

  validTransactions.forEach(t => {
     t.items.forEach(item => {
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
        productStats[key].trxCount += 1;

        const cat = item.category || 'Lainnya';
        if (!categoryStats[cat]) categoryStats[cat] = 0;
        categoryStats[cat] += item.quantity;
     });
  });

  const sortedProductStats = Object.values(productStats).sort((a, b) => b.totalQty - a.totalQty);
  
  const sortedCategoryStats = Object.entries(categoryStats)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topProducts = sortedProductStats.slice(0, 5);

  const dailyRevenueMap: { [date: string]: number } = {};
  validTransactions.forEach(t => {
    const dateStr = t.rentalDate.includes('T') ? t.rentalDate.split('T')[0] : t.rentalDate;
    dailyRevenueMap[dateStr] = (dailyRevenueMap[dateStr] || 0) + t.totalPrice;
  });

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
    dateShort: new Date(date.split('-').map(Number).join('/')).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    fullDate: date,
    revenue: dailyRevenueMap[date] || 0
  }));

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 100000);

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

  const now = new Date();

  const returnsInPeriod = validTransactions.map(t => {
    const rentalDate = new Date(t.rentalDate);
    const returnDate = new Date(rentalDate);
    returnDate.setDate(rentalDate.getDate() + (t.duration - 1));
    
    const reminderDeadline = new Date(returnDate);
    reminderDeadline.setHours(19, 0, 0, 0); 

    const overdueDeadline = new Date(returnDate);
    overdueDeadline.setHours(23, 59, 59, 999);

    let statusType = 'normal';
    let daysLate = 0;
    let fineAmount = 0;

    if (t.status === 'rented') {
      if (now > overdueDeadline) {
        statusType = 'overdue';
        const diffTime = Math.abs(now.getTime() - overdueDeadline.getTime());
        daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        const calculationDuration = daysLate + 1;
        fineAmount = t.items.reduce((totalFine, item) => {
           const priceForFineDuration = getItemPriceForDuration(item, calculationDuration);
           return totalFine + (priceForFineDuration * item.quantity);
        }, 0);

      } else if (now > reminderDeadline) {
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
    return inRange || t.statusType !== 'normal';
  }).sort((a, b) => {
    if (a.statusType === 'overdue' && b.statusType !== 'overdue') return -1;
    if (b.statusType === 'overdue' && a.statusType !== 'overdue') return 1;
    if (a.statusType === 'reminder' && b.statusType !== 'reminder') return -1;
    if (b.statusType === 'reminder' && a.statusType !== 'reminder') return 1;
    return a.returnDateStr.localeCompare(b.returnDateStr);
  });

  const overdueItems = returnsInPeriod.filter(t => t.statusType === 'overdue');
  const reminderItems = returnsInPeriod.filter(t => t.statusType === 'reminder');

  // --- ACTIONS ---
  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const headers = ["ID Transaksi", "Tanggal Sewa", "Nama Pelanggan", "WhatsApp", "Item Sewa", "Total Harga", "Status", "Tanggal Kembali", "Status Keterlambatan", "Denda Estimasi"];
    const rows = returnsInPeriod.map(t => {
      const itemsList = t.items.map(i => `${i.quantity}x ${i.name}`).join('; ');
      const statusKet = t.statusType === 'overdue' ? `Terlambat ${t.daysLate} Hari` : t.statusType === 'reminder' ? 'Lewat Jam 19:00' : 'Aman';
      return [`"${t.id}"`, t.rentalDate.split('T')[0], `"${t.customerName}"`, `'${t.customerWhatsapp}`, `"${itemsList}"`, t.totalPrice, t.status, t.returnDateStr, statusKet, t.fineAmount];
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
    const message = `Halo Kak *${t.customerName}*,\n\nKami dari *Mamas Outdoor* mengingatkan masa sewa alat berikut:\n${itemList}\n\n*Berakhir HARI INI*. Mohon segera dikembalikan malam ini.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sendOverdueNotice = (t: any) => {
    let phone = t.customerWhatsapp;
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    const itemList = t.items.map((i: any) => `- ${i.quantity}x ${i.name}`).join('\n');
    const message = `Halo Kak *${t.customerName}*,\n\nStatus pengembalian alat:\n${itemList}\n\n*TERLAMBAT ${t.daysLate} HARI*.\n*Estimasi Denda: Rp${t.fineAmount.toLocaleString('id-ID')}*\n\nMohon segera diselesaikan.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

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
      {/* Header - Stacked on Mobile */}
      <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col gap-4 bg-nature-50">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <PieChart size={20} /> Laporan & Analisis
          </h3>
          <p className="text-xs text-nature-600 mt-1">Rekap performa bisnis</p>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 no-print w-full md:w-auto">
           <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
             <Calendar size={14} className="text-gray-400 flex-shrink-0" />
             <input 
               type="date" 
               className="text-sm font-bold text-gray-700 outline-none w-full md:w-auto"
               value={startDate}
               onChange={(e) => setStartDate(e.target.value)}
             />
             <span className="text-gray-400">-</span>
             <input 
               type="date" 
               className="text-sm font-bold text-gray-700 outline-none w-full md:w-auto"
               value={endDate}
               onChange={(e) => setEndDate(e.target.value)}
             />
           </div>
           
           <div className="flex items-center gap-2 w-full md:w-auto">
             <button 
               onClick={handleExportCSV}
               disabled={transactions.length === 0}
               className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition flex justify-center items-center gap-2 text-sm font-bold shadow-sm disabled:opacity-50"
             >
               <Download size={16} /> <span className="md:hidden lg:inline">CSV</span>
             </button>
             <button 
               onClick={handlePrint}
               className="flex-1 md:flex-none bg-gray-800 hover:bg-gray-900 text-white p-2 rounded-lg transition flex justify-center items-center gap-2 text-sm font-bold shadow-sm"
             >
               <Printer size={16} /> <span className="md:hidden lg:inline">Print</span>
             </button>
           </div>
        </div>
      </div>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
             <Loader2 className="animate-spin text-nature-600" size={32} />
          </div>
        ) : transactions.length === 0 && chartData.every(d => d.revenue === 0) ? (
          <div className="text-center py-20 text-gray-400">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Calendar size={32} />
             </div>
             <p>Tidak ada data transaksi.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-slide-in-right">
             
             {/* ALERT BOXES (Mobile Friendly) */}
             {(overdueItems.length > 0 || reminderItems.length > 0) && (
               <div className="flex flex-col gap-4">
                 {overdueItems.length > 0 && (
                   <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-r-xl shadow-sm">
                      <div className="flex items-start gap-3">
                         <AlertTriangle className="text-red-600 mt-0.5" size={24} />
                         <div className="flex-1">
                            <h4 className="font-bold text-red-800 text-base md:text-lg">Terlambat & Denda ({overdueItems.length})</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                               {overdueItems.map(t => (
                                  <button key={t.id} onClick={() => sendOverdueNotice(t)} className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                                     <Calculator size={12} /> {t.customerName.split(' ')[0]} (Lat: {t.daysLate})
                                  </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                 )}
                 {reminderItems.length > 0 && (
                   <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl shadow-sm">
                      <div className="flex items-start gap-3">
                         <BellRing className="text-orange-500 mt-0.5" size={24} />
                         <div className="flex-1">
                            <h4 className="font-bold text-orange-800 text-base md:text-lg">Pengingat ({reminderItems.length})</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                               {reminderItems.map(t => (
                                  <button key={t.id} onClick={() => sendDeadlineReminder(t)} className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                                     <MessageCircle size={12} /> {t.customerName.split(' ')[0]}
                                  </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                 )}
               </div>
             )}

             {/* 1. FINANCIAL CARDS - Grid 1 on mobile */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                   <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <TrendingUp size={16} className="text-green-500"/> Total Omset
                   </p>
                   <h4 className="text-3xl font-black text-gray-900">Rp{totalRevenue.toLocaleString('id-ID')}</h4>
                   <div className="mt-3 flex justify-between text-xs text-gray-500">
                      <span>Sewa: Rp{totalRentalRevenue.toLocaleString('id-ID')}</span>
                      <span className="text-red-500 font-bold">+ Denda: Rp{totalFineRevenue.toLocaleString('id-ID')}</span>
                   </div>
                </div>
                
                <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                   <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <CheckCircle size={16}/> Uang Masuk
                   </p>
                   <h4 className="text-3xl font-black text-green-700">Rp{totalIncome.toLocaleString('id-ID')}</h4>
                </div>

                <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100">
                   <p className="text-xs font-bold text-orange-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                     <TrendingDown size={16}/> Piutang
                   </p>
                   <h4 className="text-3xl font-black text-orange-700">Rp{totalReceivables.toLocaleString('id-ID')}</h4>
                </div>
             </div>

             {/* 2. CATEGORY BREAKDOWN */}
             <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <Package size={20} className="text-nature-600"/> Statistik Kategori
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                   {sortedCategoryStats.map((cat, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                         <div className="p-2 bg-gray-100 rounded-lg text-gray-600 mb-2">
                            {getCategoryIcon(cat.name)}
                         </div>
                         <span className="text-xs font-bold text-gray-500 uppercase truncate w-full">{cat.name}</span>
                         <span className="text-lg font-black text-nature-700">{cat.count}</span>
                      </div>
                   ))}
                </div>
             </div>

             {/* 6. RETURN SCHEDULE (Mobile Card View) */}
             <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                   <h4 className="font-bold text-sm text-orange-800 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={16} /> Jadwal Kembali
                   </h4>
                   <span className="text-xs bg-white px-2 py-1 rounded font-bold text-orange-600">{returnsInPeriod.length} Item</span>
                </div>
                
                {/* Mobile View */}
                <div className="md:hidden divide-y divide-gray-100">
                    {returnsInPeriod.length === 0 ? (
                        <div className="p-6 text-center text-gray-400 text-sm">Tidak ada jadwal.</div>
                    ) : (
                        returnsInPeriod.map(t => (
                            <div key={t.id} className={`p-4 ${t.statusType === 'overdue' ? 'bg-red-50' : t.statusType === 'reminder' ? 'bg-orange-50' : ''}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`font-bold ${t.statusType === 'overdue' ? 'text-red-700' : 'text-gray-700'}`}>
                                        {new Date(t.returnDateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                                    </span>
                                    <span className="text-xs font-bold bg-white px-2 py-1 rounded border uppercase">{t.status}</span>
                                </div>
                                <p className="font-bold text-gray-800 text-sm">{t.customerName}</p>
                                <p className="text-xs text-gray-500 truncate mb-2">{t.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                                
                                <div className="flex justify-between items-center">
                                    {t.statusType === 'overdue' ? (
                                        <span className="text-[10px] bg-red-200 text-red-800 px-2 py-1 rounded font-black">LAT {t.daysLate} HARI</span>
                                    ) : t.statusType === 'reminder' ? (
                                        <span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-1 rounded font-black">LEWAT 19:00</span>
                                    ) : <span></span>}
                                    
                                    <div className="flex gap-2">
                                        {t.statusType === 'overdue' && (
                                            <button onClick={() => sendOverdueNotice(t)} className="p-2 bg-red-600 text-white rounded-full"><Calculator size={14}/></button>
                                        )}
                                        <button onClick={() => sendDeadlineReminder(t)} className="p-2 bg-white border border-gray-200 text-green-600 rounded-full"><MessageCircle size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
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
                              return (
                                <tr key={t.id} className={isOverdue ? 'bg-red-50' : isReminder ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                                    <td className="px-6 py-3 font-bold text-gray-700">{new Date(t.returnDateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</td>
                                    <td className="px-6 py-3">{t.customerName}</td>
                                    <td className="px-6 py-3 max-w-xs truncate">{t.items.map(i => i.name).join(', ')}</td>
                                    <td className="px-6 py-3 text-center">{t.status}</td>
                                    <td className="px-6 py-3 text-center">
                                      {isOverdue && <button onClick={() => sendOverdueNotice(t)} className="text-red-600"><Calculator/></button>}
                                    </td>
                                </tr>
                              )
                          })}
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
