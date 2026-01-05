
import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, Plus, Calendar, Loader2, Save, Database, AlertTriangle, Copy, Check, BarChart3, PieChart, TrendingUp, HandCoins, Trash2, Download, Lock, Unlock, User, Clock, FileText } from 'lucide-react';
import { PaymentLog, ShiftLog } from '../types';
import { getPaymentLogs, recordPaymentLog, deletePaymentLog, getCurrentShift, openShift, closeShift, getShiftHistory } from '../services/transactionService';

const AdminFinanceManager: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [activeTab, setActiveTab] = useState<'cashflow' | 'shifts'>('cashflow');
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');
  
  // Daily Date State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });

  // Monthly Date State (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Error Handling State
  const [dbError, setDbError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Manual Entry State
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<'IN' | 'OUT'>('OUT');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // SHIFT MANAGEMENT STATE
  const [activeShift, setActiveShift] = useState<ShiftLog | null>(null);
  const [shiftHistory, setShiftHistory] = useState<ShiftLog[]>([]);
  const [isShiftLoading, setIsShiftLoading] = useState(true);
  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);
  
  // Start Shift Form
  const [shiftName, setShiftName] = useState<'Pagi' | 'Sore'>('Pagi');
  const [cashierName, setCashierName] = useState('');
  const [startCash, setStartCash] = useState<number>(200000); // Default 200rb

  // End Shift Form
  const [endCashPhysical, setEndCashPhysical] = useState<number>(0);
  const [closingNote, setClosingNote] = useState('');

  // --- EFFECT: FETCH DATA ---
  useEffect(() => {
    fetchData();
    checkActiveShift();
    fetchShiftHistory();
  }, [selectedDate, selectedMonth, viewMode, activeTab]);

  // Auto-detect shift based on time
  useEffect(() => {
      const hour = new Date().getHours();
      if (hour >= 8 && hour < 15) setShiftName('Pagi');
      else setShiftName('Sore');
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setDbError(null);
    
    let startDate, endDate;

    if (viewMode === 'daily') {
        startDate = selectedDate;
        endDate = selectedDate;
    } else {
        // Calculate First and Last day of selected Month
        const [year, month] = selectedMonth.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0); // Last day of month
        
        startDate = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
        endDate = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
    }

    const { data, error } = await getPaymentLogs(startDate, endDate);
    
    if (error) {
      if (error.code === '42P01') {
        setDbError('missing_table');
      } else {
        setDbError(error.message || 'Terjadi kesalahan saat mengambil data.');
      }
      setLogs([]);
    } else {
      setLogs(data);
    }
    
    setIsLoading(false);
  };

  const checkActiveShift = async () => {
      setIsShiftLoading(true);
      const shift = await getCurrentShift();
      setActiveShift(shift);
      setIsShiftLoading(false);
  };

  const fetchShiftHistory = async () => {
      const history = await getShiftHistory();
      setShiftHistory(history);
  };

  // --- HANDLERS ---
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualAmount <= 0 || !manualDesc) return;

    // Use selected manualDate and append current time for precise ordering
    const now = new Date();
    const dateTime = `${manualDate}T${now.toTimeString().split(' ')[0]}Z`;

    await recordPaymentLog({
      amount: manualAmount,
      payment_method: 'cash',
      type: manualType,
      description: manualDesc,
      category: manualType === 'OUT' ? 'Operasional' : 'Lain-lain',
      created_at: dateTime
    });

    setManualAmount(0);
    setManualDesc('');
    setIsManualEntryOpen(false);
    fetchData();
  };

  const handleDeleteLog = async (id: string) => {
    if (window.confirm("Yakin hapus catatan ini? Saldo akan dikalkulasi ulang.")) {
        const success = await deletePaymentLog(id);
        if (success) {
            setLogs(prev => prev.filter(l => l.id !== id));
        } else {
            alert("Gagal menghapus log.");
        }
    }
  };

  const handleStartShift = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!cashierName) return alert("Nama kasir wajib diisi!");
      
      const newShift = await openShift(cashierName, shiftName, startCash);
      if (newShift) {
          setActiveShift(newShift);
          setIsStartShiftModalOpen(false);
          alert("✅ Shift Berhasil Dibuka!");
      } else {
          alert("Gagal membuka shift. Coba lagi.");
      }
  };

  const handleEndShift = async () => {
      if (!activeShift) return;
      
      // Calculate System Cash (Modal Awal + Transaksi Cash IN - Transaksi Cash OUT SELAMA SHIFT)
      const shiftStartTime = new Date(activeShift.created_at);
      
      // Filter logs yang terjadi SETELAH shift dibuka
      const currentShiftLogs = logs.filter(l => new Date(l.created_at) >= shiftStartTime);
      
      const cashIn = currentShiftLogs.filter(l => l.payment_method === 'cash' && l.type === 'IN').reduce((acc, c) => acc + c.amount, 0);
      const cashOut = currentShiftLogs.filter(l => l.payment_method === 'cash' && l.type === 'OUT').reduce((acc, c) => acc + c.amount, 0);
      
      const systemExpectedCash = (activeShift.start_cash || 0) + cashIn - cashOut;
      const difference = endCashPhysical - systemExpectedCash;
      
      // LOGIKA REKAPITULASI:
      const withdrawalAmount = Math.max(0, endCashPhysical - (activeShift.start_cash || 0));
      
      const success = await closeShift(
          activeShift.id, 
          endCashPhysical, 
          systemExpectedCash, 
          difference, 
          withdrawalAmount,
          closingNote
      );
      
      if (success) {
          alert(`🔒 Shift Ditutup!\n\n💰 Uang Disetor (Rekap): Rp${withdrawalAmount.toLocaleString('id-ID')}\n📦 Tinggal di Laci: Rp${(activeShift.start_cash||0).toLocaleString('id-ID')}\n\nSelisih vs Sistem: Rp${difference.toLocaleString('id-ID')} (${difference === 0 ? 'Balance' : difference < 0 ? 'Minus' : 'Surplus'})`);
          setActiveShift(null);
          setIsEndShiftModalOpen(false);
          setEndCashPhysical(0);
          setClosingNote('');
          fetchShiftHistory(); // Refresh table
      } else {
          alert("Gagal menutup shift.");
      }
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Tanggal", "Jam", "Deskripsi", "Kategori", "Tipe", "Metode", "Nominal", "Ref TRX"];
    const rows = logs.map(l => {
      const dt = new Date(l.created_at);
      return [
        l.id,
        dt.toLocaleDateString('id-ID'),
        dt.toLocaleTimeString('id-ID'),
        `"${l.description}"`,
        l.category || '-',
        l.type,
        l.payment_method,
        l.amount,
        l.transaction_id || '-'
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FinanceLog_${viewMode}_${selectedDate || selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CALCULATIONS (MEMOIZED) ---
  const summary = useMemo(() => {
      const totalIn = logs.filter(l => l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
      const totalOut = logs.filter(l => l.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
      
      const rentalIncome = logs.filter(l => l.type === 'IN' && l.category === 'Sewa').reduce((acc, curr) => acc + curr.amount, 0);
      const fineIncome = logs.filter(l => l.type === 'IN' && l.category === 'Denda').reduce((acc, curr) => acc + curr.amount, 0);
      
      const cashIn = logs.filter(l => l.payment_method === 'cash' && l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
      const cashOut = logs.filter(l => l.payment_method === 'cash' && l.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
      const netCash = cashIn - cashOut;
      
      const transferIn = logs.filter(l => l.payment_method === 'transfer' && l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);

      return { totalIn, totalOut, netTotal: totalIn - totalOut, netCash, transferIn, rentalIncome, fineIncome, cashIn, cashOut };
  }, [logs]);

  // Daily Aggregates (For Monthly View Chart & Table)
  const dailyAggregates = useMemo(() => {
      if (viewMode === 'daily') return [];

      const map: Record<string, { date: string, in: number, out: number }> = {};
      
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for(let i=1; i<=daysInMonth; i++) {
          const dayStr = `${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          map[dayStr] = { date: dayStr, in: 0, out: 0 };
      }

      logs.forEach(log => {
          const dayStr = log.created_at.split('T')[0];
          if (map[dayStr]) {
              if (log.type === 'IN') map[dayStr].in += log.amount;
              else map[dayStr].out += log.amount;
          }
      });

      return Object.values(map).sort((a,b) => a.date.localeCompare(b.date));
  }, [logs, viewMode, selectedMonth]);

  const maxChartValue = Math.max(...dailyAggregates.map(d => d.in), 100000);

  if (dbError === 'missing_table') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-8 flex flex-col items-center text-center max-w-2xl mx-auto mt-10">
         <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-4 animate-bounce">
           <Database size={32} />
         </div>
         <h2 className="text-xl font-bold text-gray-900 mb-2">Setup Database Diperlukan</h2>
         <p className="text-gray-600 mb-6 text-sm leading-relaxed">
           Fitur keuangan memerlukan tabel baru. Silakan jalankan script berikut di Supabase SQL Editor.
         </p>
         <div className="mt-6">
            <button onClick={fetchData} className="bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition">
              <Loader2 size={16} className={isLoading ? 'animate-spin' : 'hidden'} /> Refresh Data
            </button>
         </div>
      </div>
    );
  }

  // CALCULATION FOR END SHIFT MODAL
  const estimatedWithdrawal = Math.max(0, endCashPhysical - (activeShift?.start_cash || 0));
  const estimatedLeftInDrawer = endCashPhysical - estimatedWithdrawal;
  const estimatedDiff = endCashPhysical - (activeShift ? (activeShift.start_cash || 0) + summary.cashIn - summary.cashOut : 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
      {/* Header & Controls - STACKED ON MOBILE */}
      <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col gap-4 bg-nature-50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
            <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
                <DollarSign size={20} /> Manajemen Keuangan
            </h3>
            <div className="flex gap-4 mt-2">
                <button 
                onClick={() => setActiveTab('cashflow')}
                className={`text-xs font-bold pb-1 border-b-2 transition ${activeTab === 'cashflow' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-500'}`}
                >
                Arus Kas
                </button>
                <button 
                onClick={() => setActiveTab('shifts')}
                className={`text-xs font-bold pb-1 border-b-2 transition ${activeTab === 'shifts' ? 'border-nature-600 text-nature-700' : 'border-transparent text-gray-500'}`}
                >
                Laporan Shift
                </button>
            </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                {activeTab === 'cashflow' && (
                    <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm w-full md:w-auto">
                        <button 
                            onClick={() => setViewMode('daily')}
                            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'daily' ? 'bg-nature-100 text-nature-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Harian
                        </button>
                        <button 
                            onClick={() => setViewMode('monthly')}
                            className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'monthly' ? 'bg-nature-100 text-nature-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            Bulanan
                        </button>
                    </div>
                )}

                <div className="flex items-center gap-2 w-full md:w-auto">
                    {activeTab === 'cashflow' && (
                        <div className="relative flex-1 md:flex-none">
                            <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            {viewMode === 'daily' ? (
                                <input 
                                type="date" 
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none text-sm font-bold text-gray-700"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            ) : (
                                <input 
                                type="month" 
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none text-sm font-bold text-gray-700"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                />
                            )}
                        </div>
                    )}
                    
                    <button 
                    onClick={handleExportCSV} 
                    disabled={logs.length === 0}
                    className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-sm transition disabled:opacity-50 flex-shrink-0"
                    title="Download Excel/CSV"
                    >
                    <Download size={20}/>
                    </button>
                </div>
            </div>
        </div>
      </div>

      <div className="p-4 md:p-6 flex-1 overflow-y-auto bg-gray-50">
        
        {/* SHIFT CONTROL SECTION */}
        <div className="mb-6 md:mb-8">
            {isShiftLoading ? (
                <div className="animate-pulse h-16 bg-gray-200 rounded-xl"></div>
            ) : activeShift ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-slide-in-right">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-2 md:p-3 bg-white rounded-full text-green-600 shadow-sm">
                            <Unlock size={20}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-green-900 text-sm">Shift {activeShift.shift_name} Aktif</h4>
                            <p className="text-xs text-green-700 mt-0.5">
                                Kasir: <strong>{activeShift.cashier_name}</strong>
                            </p>
                            <p className="text-xs text-green-600">Modal: Rp{activeShift.start_cash.toLocaleString('id-ID')}</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsEndShiftModalOpen(true)}
                        className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                        <Lock size={14}/> Tutup Kasir
                    </button>
                </div>
            ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm animate-slide-in-right">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-2 md:p-3 bg-white rounded-full text-blue-600 shadow-sm">
                            <Lock size={20}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-blue-900 text-sm">Kasir Belum Dibuka</h4>
                            <p className="text-xs text-blue-700 mt-0.5">
                                Silakan buka shift baru untuk mulai mencatat transaksi.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsStartShiftModalOpen(true)}
                        className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                        <Unlock size={14}/> Buka Shift Baru
                    </button>
                </div>
            )}
        </div>

        {activeTab === 'cashflow' && (
            <>
                {/* SUMMARY CARDS - RESPONSIVE GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <TrendingUp size={16} className="text-blue-500"/> Pendapatan Sewa
                        </p>
                        <h4 className="text-2xl font-black text-gray-800">Rp{summary.rentalIncome.toLocaleString('id-ID')}</h4>
                    </div>
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} className="text-red-500"/> Pendapatan Denda
                        </p>
                        <h4 className="text-2xl font-black text-gray-800">Rp{summary.fineIncome.toLocaleString('id-ID')}</h4>
                    </div>
                    <div className="bg-gradient-to-br from-nature-800 to-nature-900 p-4 md:p-5 rounded-2xl border border-nature-700 text-white shadow-lg">
                        <p className="text-xs font-bold text-nature-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <DollarSign size={16}/> Profit Bersih
                        </p>
                        <h4 className="text-2xl font-black">Rp{summary.netTotal.toLocaleString('id-ID')}</h4>
                    </div>
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <ArrowDownLeft size={16} className="text-red-500"/> Pengeluaran
                        </p>
                        <h4 className="text-2xl font-black text-gray-800">Rp{summary.totalOut.toLocaleString('id-ID')}</h4>
                    </div>
                </div>

                {viewMode === 'daily' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
                        <div className="bg-green-50 p-4 md:p-5 rounded-2xl border border-green-100">
                            <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Wallet size={16}/> Kasir (Cash Only)
                            </p>
                            <h4 className="text-xl font-black text-green-700">Rp{summary.netCash.toLocaleString('id-ID')}</h4>
                            <p className="text-xs text-green-600 mt-1 opacity-80">Uang tunai di tangan</p>
                        </div>
                        <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border border-blue-100">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <CreditCard size={16}/> Transfer Masuk
                            </p>
                            <h4 className="text-xl font-black text-blue-700">Rp{summary.transferIn.toLocaleString('id-ID')}</h4>
                            <p className="text-xs text-blue-600 mt-1 opacity-80">Mutasi rekening bank</p>
                        </div>
                    </div>
                )}

                {/* MONTHLY CHART */}
                {viewMode === 'monthly' && (
                    <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-4 md:p-6 shadow-sm overflow-hidden">
                        <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <BarChart3 size={20} className="text-nature-600"/> Tren Pendapatan
                        </h4>
                        <div className="h-48 flex items-end gap-2 overflow-x-auto pb-2 custom-scrollbar px-2">
                            {dailyAggregates.map((d, i) => {
                                const heightPercent = Math.round((d.in / maxChartValue) * 100);
                                const barHeight = d.in > 0 ? `${Math.max(heightPercent, 5)}%` : '2px';
                                return (
                                    <div key={i} className="flex flex-col justify-end items-center flex-1 min-w-[20px] group relative h-full">
                                        <div className={`w-full rounded-t transition-all ${d.in > 0 ? 'bg-nature-500' : 'bg-gray-100'}`} style={{ height: barHeight }}></div>
                                        <span className="text-[9px] text-gray-400 mt-1">{new Date(d.date).getDate()}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'daily' && (
                    <>
                        {/* Manual Entry Button */}
                        <div className="mb-6">
                            {!isManualEntryOpen ? (
                                <button 
                                onClick={() => setIsManualEntryOpen(true)}
                                className="w-full md:w-auto flex items-center justify-center gap-2 text-sm font-bold text-nature-700 bg-nature-50 px-4 py-3 md:py-2 rounded-lg hover:bg-nature-100 transition border border-nature-200"
                                >
                                <Plus size={16}/> Catat Kas Manual (Bensin/Makan/Lainnya)
                                </button>
                            ) : (
                                <form onSubmit={handleManualSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-slide-in-right">
                                    <h4 className="text-sm font-bold text-gray-800 mb-3">Input Transaksi Manual</h4>
                                    <div className="flex flex-col md:flex-row gap-3 items-end">
                                        <div className="w-full md:w-40">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Tanggal</label>
                                            <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm" value={manualDate} onChange={e => setManualDate(e.target.value)} required />
                                        </div>
                                        <div className="flex-1 w-full">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Keterangan</label>
                                            <input type="text" placeholder="Contoh: Beli Token Listrik" className="w-full px-3 py-2 border rounded-lg text-sm" value={manualDesc} onChange={e => setManualDesc(e.target.value)} autoFocus required />
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Nominal</label>
                                            <input type="number" className="w-full px-3 py-2 border rounded-lg text-sm" value={manualAmount === 0 ? '' : manualAmount} onChange={e => setManualAmount(Number(e.target.value))} required />
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="text-xs font-bold text-gray-500 mb-1 block">Jenis</label>
                                            <select className="w-full px-3 py-2 border rounded-lg text-sm font-bold" value={manualType} onChange={e => setManualType(e.target.value as 'IN' | 'OUT')}>
                                                <option value="OUT">Pengeluaran</option>
                                                <option value="IN">Pemasukan</option>
                                            </select>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <button type="submit" className="flex-1 md:flex-none bg-nature-600 text-white p-2 rounded-lg hover:bg-nature-700 flex justify-center items-center"><Save size={18} /></button>
                                            <button type="button" onClick={() => setIsManualEntryOpen(false)} className="flex-1 md:flex-none bg-gray-200 text-gray-600 p-2 rounded-lg hover:bg-gray-300 flex justify-center items-center"><Plus size={18} className="rotate-45" /></button>
                                        </div>
                                    </div>
                                </form>
                            )}
                        </div>

                        {/* Daily Logs List (Card View for Mobile) */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="hidden md:block">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3">Jam</th>
                                            <th className="px-6 py-3">Keterangan</th>
                                            <th className="px-6 py-3">Kategori</th>
                                            <th className="px-6 py-3">Metode</th>
                                            <th className="px-6 py-3 text-right">Nominal</th>
                                            <th className="px-6 py-3 text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                                                    {new Date(log.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className="font-bold text-gray-800">{log.description}</span>
                                                    {log.transaction_id && <span className="text-xs text-gray-400 block">Ref: #{log.transaction_id.slice(0,6)}</span>}
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase ${
                                                        log.category === 'Denda' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        log.category === 'Sewa' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                        {log.category || 'Umum'}
                                                    </span>
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
                                                <td className="px-6 py-3 text-center">
                                                    <button onClick={() => handleDeleteLog(log.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden">
                                {logs.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 italic">Belum ada transaksi.</div>
                                ) : (
                                    <div className="divide-y divide-gray-100">
                                        {logs.map(log => (
                                            <div key={log.id} className="p-4 flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 rounded">
                                                            {new Date(log.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                                            log.category === 'Denda' ? 'bg-red-50 text-red-600 border-red-100' :
                                                            log.category === 'Sewa' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                            'bg-gray-50 text-gray-600 border-gray-200'
                                                        }`}>
                                                            {log.category || 'Umum'}
                                                        </span>
                                                    </div>
                                                    <p className="font-bold text-gray-800 text-sm">{log.description}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {log.payment_method === 'cash' ? (
                                                            <span className="flex items-center gap-1 text-[10px] text-green-700 font-bold"><Wallet size={10}/> Cash</span>
                                                        ) : (
                                                            <span className="flex items-center gap-1 text-[10px] text-blue-700 font-bold"><CreditCard size={10}/> Transfer</span>
                                                        )}
                                                        {log.transaction_id && <span className="text-[10px] text-gray-400">Ref: #{log.transaction_id.slice(0,6)}</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-bold ${log.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                                                        {log.type === 'IN' ? '+' : '-'}Rp{log.amount.toLocaleString('id-ID')}
                                                    </div>
                                                    <button onClick={() => handleDeleteLog(log.id)} className="text-gray-300 hover:text-red-500 mt-2 p-1">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </>
        )}

        {activeTab === 'shifts' && (
            <div className="animate-slide-in-right">
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            <Clock size={18}/> Riwayat Shift
                        </h4>
                        <button onClick={fetchShiftHistory} className="p-2 bg-white rounded shadow-sm text-gray-600 hover:text-nature-600"><Loader2 size={16} className={isShiftLoading?'animate-spin':''}/></button>
                    </div>
                    
                    {/* Mobile Shift Cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {shiftHistory.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">Belum ada riwayat shift.</div>
                        ) : (
                            shiftHistory.map(shift => (
                                <div key={shift.id} className="p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-800">{new Date(shift.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${shift.shift_name === 'Pagi' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {shift.shift_name}
                                            </span>
                                        </div>
                                        {shift.status === 'open' ? (
                                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold animate-pulse">AKTIF</span>
                                        ) : (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">CLOSED</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center text-sm mb-1">
                                        <span className="text-gray-600">Kasir: {shift.cashier_name}</span>
                                        <span className="text-gray-500">Modal: Rp{shift.start_cash.toLocaleString('id-ID')}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg mt-2">
                                        <div className="text-center">
                                            <p className="text-[9px] text-gray-500 uppercase font-bold">Disetor</p>
                                            <p className="font-black text-green-700">Rp{(shift.cash_withdrawal || 0).toLocaleString('id-ID')}</p>
                                        </div>
                                        <div className="text-center border-l border-gray-200 pl-2">
                                            <p className="text-[9px] text-gray-500 uppercase font-bold">Selisih</p>
                                            <p className={`font-bold ${shift.difference === 0 ? 'text-green-600' : shift.difference < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                {shift.difference > 0 ? '+' : ''}{shift.difference?.toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Shift Table (Hidden on Mobile) */}
                    <div className="hidden md:block">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-bold">
                                <tr>
                                    <th className="px-6 py-3">Tanggal</th>
                                    <th className="px-6 py-3">Shift</th>
                                    <th className="px-6 py-3">Kasir</th>
                                    <th className="px-6 py-3 text-right">Modal Awal</th>
                                    <th className="px-6 py-3 text-right bg-green-50">Disetor (Rekap)</th>
                                    <th className="px-6 py-3 text-right">Selisih</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {shiftHistory.map(shift => (
                                    <tr key={shift.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3">
                                            {new Date(shift.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}
                                            <div className="text-xs text-gray-400">{new Date(shift.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${shift.shift_name === 'Pagi' ? 'bg-yellow-100 text-yellow-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                                {shift.shift_name}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-gray-800">{shift.cashier_name}</td>
                                        <td className="px-6 py-3 text-right text-gray-500">Rp{shift.start_cash.toLocaleString('id-ID')}</td>
                                        <td className="px-6 py-3 text-right font-black text-green-700 bg-green-50/50">
                                            Rp{(shift.cash_withdrawal || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <span className={`font-bold ${shift.difference === 0 ? 'text-green-600' : shift.difference < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                {shift.difference > 0 ? '+' : ''}{shift.difference?.toLocaleString('id-ID')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {shift.status === 'open' ? (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold animate-pulse">AKTIF</span>
                                            ) : (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold">CLOSED</span>
                                            )}
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

      {/* START SHIFT MODAL - Responsive Width */}
      {isStartShiftModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <form onSubmit={handleStartShift} className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-in-right">
                  <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><Unlock size={18}/> Buka Shift Baru</h3>
                      <button type="button" onClick={() => setIsStartShiftModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><Plus size={20} className="rotate-45"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Kasir</label>
                          <div className="relative">
                              <User className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                              <input required type="text" className="w-full pl-10 pr-4 py-2 border rounded-lg" placeholder="Nama Anda" value={cashierName} onChange={e => setCashierName(e.target.value)} />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pilih Shift</label>
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                              <button type="button" onClick={() => setShiftName('Pagi')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${shiftName === 'Pagi' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Pagi (08-15)</button>
                              <button type="button" onClick={() => setShiftName('Sore')} className={`flex-1 py-2 text-sm font-bold rounded-md transition ${shiftName === 'Sore' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Sore (15-22)</button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modal Awal (Uang di Laci)</label>
                          <input type="number" className="w-full px-4 py-2 border rounded-lg font-bold text-gray-800" value={startCash} onChange={e => setStartCash(Number(e.target.value))} />
                      </div>
                      <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-lg mt-2">Buka Kasir Sekarang</button>
                  </div>
              </form>
          </div>
      )}

      {/* END SHIFT MODAL - Responsive Width */}
      {isEndShiftModalOpen && activeShift && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-in-right">
                  <div className="bg-green-600 px-6 py-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2"><Lock size={18}/> Tutup Shift ({activeShift.shift_name})</h3>
                      <button onClick={() => setIsEndShiftModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full"><Plus size={20} className="rotate-45"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      
                      <div className="grid grid-cols-2 gap-3 mb-2">
                          <div className="bg-gray-50 p-2 rounded border border-gray-200">
                              <p className="text-[10px] text-gray-500 uppercase font-bold">Kasir</p>
                              <p className="text-sm font-bold text-gray-800">{activeShift.cashier_name}</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded border border-gray-200">
                              <p className="text-[10px] text-gray-500 uppercase font-bold">Modal Awal</p>
                              <p className="text-sm font-bold text-gray-800">Rp{(activeShift.start_cash||0).toLocaleString('id-ID')}</p>
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Uang Fisik (Hitung Manual)</label>
                          <input 
                            type="number" 
                            autoFocus
                            className="w-full px-4 py-3 border-2 border-green-500 rounded-lg font-black text-xl text-gray-800 text-center" 
                            placeholder="0"
                            value={endCashPhysical || ''} 
                            onChange={e => setEndCashPhysical(Number(e.target.value))} 
                          />
                          <p className="text-[10px] text-gray-400 mt-1 text-center">Masukkan total uang kertas & koin yang ada di laci saat ini.</p>
                      </div>

                      {/* REKAPITULASI DISPLAY */}
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between items-center border-b border-green-200 pb-2 mb-2">
                              <span className="text-xs font-bold text-green-800">Uang Disetor (Rekap)</span>
                              <span className="text-lg font-black text-green-700">Rp{estimatedWithdrawal.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between items-center">
                              <span className="text-xs text-green-700">Tinggal di Laci</span>
                              <span className="text-sm font-bold text-green-800">Rp{estimatedLeftInDrawer.toLocaleString('id-ID')}</span>
                          </div>
                          
                          {/* VARIANCE CHECK */}
                          {estimatedDiff !== 0 && (
                              <div className={`mt-2 pt-2 border-t border-dashed border-green-200 text-xs font-bold text-center ${estimatedDiff < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                  {estimatedDiff < 0 ? `KURANG (MINUS): Rp${Math.abs(estimatedDiff).toLocaleString('id-ID')}` : `LEBIH (SURPLUS): Rp${estimatedDiff.toLocaleString('id-ID')}`}
                              </div>
                          )}
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Catatan (Optional)</label>
                          <textarea 
                            rows={2} 
                            className="w-full px-3 py-2 border rounded-lg text-sm" 
                            placeholder="Contoh: Ada uang kembalian kurang 500"
                            value={closingNote}
                            onChange={e => setClosingNote(e.target.value)}
                          />
                      </div>

                      <button onClick={handleEndShift} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition shadow-lg mt-2">
                          Simpan & Tutup
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default AdminFinanceManager;
