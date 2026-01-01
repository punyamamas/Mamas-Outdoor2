
import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Wallet, CreditCard, ArrowUpRight, ArrowDownLeft, Plus, Calendar, Loader2, Save, Database, AlertTriangle, Copy, Check, BarChart3, PieChart, TrendingUp, HandCoins, Trash2, Download } from 'lucide-react';
import { PaymentLog } from '../types';
import { getPaymentLogs, recordPaymentLog, deletePaymentLog } from '../services/transactionService';

const AdminFinanceManager: React.FC = () => {
  // --- STATE MANAGEMENT ---
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

  // --- EFFECT: FETCH DATA ---
  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedMonth, viewMode]);

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
        
        // Format to YYYY-MM-DD ignoring timezone issues for simplicity (using local components)
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

  // --- HANDLERS ---
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualAmount <= 0 || !manualDesc) return;

    await recordPaymentLog({
      amount: manualAmount,
      payment_method: 'cash',
      type: manualType,
      description: manualDesc,
      category: manualType === 'OUT' ? 'Operasional' : 'Lain-lain'
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

  const copySQL = () => {
    const sql = `create table public.payment_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id text,
  amount numeric not null,
  payment_method text not null,
  type text not null,
  description text,
  category text
);

alter table public.payment_logs enable row level security;

create policy "Enable all access for anon" on public.payment_logs
for all using (true) with check (true);`;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- CALCULATIONS (MEMOIZED) ---
  
  // 1. Total Summaries
  const summary = useMemo(() => {
      const totalIn = logs.filter(l => l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
      const totalOut = logs.filter(l => l.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
      
      // NEW: Breakdown by Category
      const rentalIncome = logs.filter(l => l.type === 'IN' && l.category === 'Sewa').reduce((acc, curr) => acc + curr.amount, 0);
      const fineIncome = logs.filter(l => l.type === 'IN' && l.category === 'Denda').reduce((acc, curr) => acc + curr.amount, 0);
      
      // Breakdown Payment Method (Only for Daily usually, but good to have)
      const cashIn = logs.filter(l => l.payment_method === 'cash' && l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
      const cashOut = logs.filter(l => l.payment_method === 'cash' && l.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
      const netCash = cashIn - cashOut;
      
      const transferIn = logs.filter(l => l.payment_method === 'transfer' && l.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);

      return { totalIn, totalOut, netTotal: totalIn - totalOut, netCash, transferIn, rentalIncome, fineIncome };
  }, [logs]);

  // 2. Daily Aggregates (For Monthly View Chart & Table)
  const dailyAggregates = useMemo(() => {
      if (viewMode === 'daily') return [];

      const map: Record<string, { date: string, in: number, out: number }> = {};
      
      // Initialize all days in month
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      
      for(let i=1; i<=daysInMonth; i++) {
          const dayStr = `${year}-${String(month).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
          map[dayStr] = { date: dayStr, in: 0, out: 0 };
      }

      // Fill Data
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

  // --- RENDER HELPERS ---
  
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
         <div className="bg-gray-900 rounded-xl p-4 w-full text-left relative group border border-gray-700">
           <pre className="text-gray-300 text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
{`create table public.payment_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id text,
  amount numeric not null,
  payment_method text not null, -- 'cash' or 'transfer'
  type text not null, -- 'IN' or 'OUT'
  description text,
  category text
);
alter table public.payment_logs enable row level security;
create policy "Enable all access for anon" on public.payment_logs
for all using (true) with check (true);`}
           </pre>
           <button onClick={copySQL} className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold">
             {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? 'Copied' : 'Copy'}
           </button>
         </div>
         <div className="mt-6">
            <button onClick={fetchData} className="bg-nature-600 hover:bg-nature-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition">
              <Loader2 size={16} className={isLoading ? 'animate-spin' : 'hidden'} /> Refresh Data
            </button>
         </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
      {/* Header & Controls */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-nature-50">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <DollarSign size={20} /> Manajemen Keuangan
          </h3>
          <p className="text-xs text-nature-600 mt-1">
             {viewMode === 'daily' ? 'Laporan detail arus kas harian' : 'Rekapitulasi omset & profit bulanan'}
          </p>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
            <button 
                onClick={() => setViewMode('daily')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'daily' ? 'bg-nature-100 text-nature-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Harian
            </button>
            <button 
                onClick={() => setViewMode('monthly')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${viewMode === 'monthly' ? 'bg-nature-100 text-nature-700' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Bulanan
            </button>
        </div>

        <div className="flex items-center gap-2">
            <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-gray-400" size={16} />
                {viewMode === 'daily' ? (
                    <input 
                    type="date" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none text-sm font-bold text-gray-700"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    />
                ) : (
                    <input 
                    type="month" 
                    className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none text-sm font-bold text-gray-700"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                )}
            </div>
            
            <button 
              onClick={handleExportCSV} 
              disabled={logs.length === 0}
              className="p-2 bg-green-600 text-white rounded-xl hover:bg-green-700 shadow-sm transition disabled:opacity-50"
              title="Download Excel/CSV"
            >
               <Download size={20}/>
            </button>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          
          {/* CARD 1: PENDAPATAN SEWA (RENTAL) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500"/> Pendapatan Sewa
             </p>
             <h4 className="text-2xl font-black text-gray-800">Rp{summary.rentalIncome.toLocaleString('id-ID')}</h4>
             <p className="text-xs text-gray-400 mt-1">Uang masuk sewa alat murni</p>
          </div>

          {/* CARD 2: PENDAPATAN DENDA (FINE) */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-500"/> Pendapatan Denda
             </p>
             <h4 className="text-2xl font-black text-gray-800">Rp{summary.fineIncome.toLocaleString('id-ID')}</h4>
             <p className="text-xs text-gray-400 mt-1">Uang masuk dari keterlambatan</p>
          </div>

          {/* CARD 3: CASHFLOW NETTO */}
          <div className="bg-gradient-to-br from-nature-800 to-nature-900 p-5 rounded-2xl border border-nature-700 text-white shadow-lg">
             <p className="text-xs font-bold text-nature-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                <DollarSign size={16}/> Profit Bersih
             </p>
             <h4 className="text-2xl font-black">Rp{summary.netTotal.toLocaleString('id-ID')}</h4>
             <p className="text-xs text-nature-200 mt-1">Total Masuk - Pengeluaran</p>
          </div>

          {/* CARD 4: PENGELUARAN */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
             <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <ArrowDownLeft size={16} className="text-red-500"/> Pengeluaran
             </p>
             <h4 className="text-2xl font-black text-gray-800">Rp{summary.totalOut.toLocaleString('id-ID')}</h4>
             <p className="text-xs text-gray-400 mt-1">Operasional & Kas Kecil</p>
          </div>
        </div>

        {/* DETAILS FOR DAILY VIEW */}
        {viewMode === 'daily' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                    <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Wallet size={16}/> Kasir (Cash Only)
                    </p>
                    <h4 className="text-xl font-black text-green-700">Rp{summary.netCash.toLocaleString('id-ID')}</h4>
                    <p className="text-xs text-green-600 mt-1 opacity-80">Uang tunai di tangan saat ini</p>
                </div>
                
                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CreditCard size={16}/> Transfer Masuk
                    </p>
                    <h4 className="text-xl font-black text-blue-700">Rp{summary.transferIn.toLocaleString('id-ID')}</h4>
                    <p className="text-xs text-blue-600 mt-1 opacity-80">Mutasi rekening bank</p>
                </div>
            </div>
        )}

        {/* MONTHLY CHART & TABLE */}
        {viewMode === 'monthly' && (
            <div className="mb-8 space-y-6">
                {/* CHART */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <BarChart3 size={20} className="text-nature-600"/> Tren Pendapatan Harian ({new Date(selectedMonth).toLocaleDateString('id-ID', {month:'long', year:'numeric'})})
                    </h4>
                    <div className="h-48 flex items-end gap-2 overflow-x-auto pb-2 custom-scrollbar px-2">
                        {dailyAggregates.map((d, i) => {
                            const heightPercent = Math.round((d.in / maxChartValue) * 100);
                            const barHeight = d.in > 0 ? `${Math.max(heightPercent, 5)}%` : '2px';
                            return (
                                <div key={i} className="flex flex-col justify-end items-center flex-1 min-w-[20px] group relative h-full">
                                    {/* Tooltip */}
                                    <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] p-2 rounded z-10 w-28 text-center pointer-events-none transition-opacity">
                                        <div className="font-bold mb-1">{new Date(d.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</div>
                                        <div className="text-green-300">In: {d.in.toLocaleString('id-ID')}</div>
                                        <div className="text-red-300">Out: {d.out.toLocaleString('id-ID')}</div>
                                    </div>
                                    <div className={`w-full rounded-t transition-all ${d.in > 0 ? 'bg-nature-500 group-hover:bg-nature-600' : 'bg-gray-100'}`} style={{ height: barHeight }}></div>
                                    <span className="text-[9px] text-gray-400 mt-1">{new Date(d.date).getDate()}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* AGGREGATE TABLE */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h4 className="font-bold text-gray-700 text-sm">Rincian Per Tanggal</h4>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white text-gray-500 font-bold sticky top-0 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3">Tanggal</th>
                                    <th className="px-6 py-3 text-right text-green-600">Pemasukan</th>
                                    <th className="px-6 py-3 text-right text-red-500">Pengeluaran</th>
                                    <th className="px-6 py-3 text-right">Bersih</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {dailyAggregates.slice().reverse().map((d, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 font-medium text-gray-700">
                                            {new Date(d.date).toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long'})}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-green-700">
                                            {d.in > 0 ? `+${d.in.toLocaleString('id-ID')}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-red-500">
                                            {d.out > 0 ? `-${d.out.toLocaleString('id-ID')}` : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-900">
                                            Rp{(d.in - d.out).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* DAILY VIEW: ACTION & TABLE */}
        {viewMode === 'daily' && (
            <>
                {/* Manual Entry Button */}
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
                            <h4 className="text-sm font-bold text-gray-800 mb-3">Input Transaksi Manual ({new Date(selectedDate).toLocaleDateString('id-ID')})</h4>
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

                {/* Daily Transaction Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-gray-400"/></td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Belum ada transaksi hari ini.</td></tr>
                            ) : (
                                logs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 transition group">
                                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                                        {new Date(log.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="font-bold text-gray-800">{log.description}</span>
                                        {log.transaction_id && <span className="text-xs text-gray-400 block">Ref: #{log.transaction_id.slice(0,6)}</span>}
                                    </td>
                                    <td className="px-6 py-3">
                                        {/* Kategori Badge */}
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
                                        <button 
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                            title="Hapus Catatan"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default AdminFinanceManager;
