import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Loader2, Calendar, Eye, Trash2, X, User, CreditCard, Banknote, ArrowRightLeft, Save, Calculator, CheckCircle, RotateCcw, Wallet, Edit, Plus, Minus, Search, ShoppingBag, Printer, Filter, DollarSign, Receipt, BarChart3, TrendingUp, Lightbulb, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Transaction, Product, CartItem } from '../types';
import { updateTransactionPayment, updateTransactionItems, updateTransactionDetails, printInvoice } from '../services/transactionService';

interface AdminTransactionManagerProps {
  transactions: Transaction[];
  isLoading: boolean;
  products?: Product[]; // Added prop to select products when editing
  onStatusUpdate: (id: string, status: string) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

const AdminTransactionManager: React.FC<AdminTransactionManagerProps> = ({
  transactions,
  isLoading,
  products = [],
  onStatusUpdate,
  onDeleteTransaction,
  onRefreshData
}) => {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  
  // Helper untuk format tanggal YYYY-MM-DD (Local Time)
  const getLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().split('T')[0];
  };

  // --- FILTER STATES ---
  const [searchTerm, setSearchTerm] = useState('');
  
  // Default: 1 Bulan kebelakang dari hari ini
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return getLocalISOString(d);
  });
  
  const [filterEndDate, setFilterEndDate] = useState(() => {
    return getLocalISOString(new Date());
  });

  const [filterStatus, setFilterStatus] = useState('all');

  // State: Nominal yang SEDANG diketik (Pembayaran Baru) - DIBAGI DUA
  const [cashInput, setCashInput] = useState<number>(0);
  const [transferInput, setTransferInput] = useState<number>(0);
  
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // --- EDIT ITEMS STATES ---
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editedItems, setEditedItems] = useState<CartItem[]>([]);
  const [isSavingItems, setIsSavingItems] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // --- EDIT CUSTOMER INFO STATES ---
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editWa, setEditWa] = useState('');
  const [editDuration, setEditDuration] = useState(2);
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // Reset input ke 0 setiap kali modal dibuka
  useEffect(() => {
    if (selectedTransaction) {
      setCashInput(0); 
      setTransferInput(0);
      setIsEditingItems(false);
      setIsEditingInfo(false);
      
      setEditedItems(selectedTransaction.items);
      setEditName(selectedTransaction.customerName);
      setEditWa(selectedTransaction.customerWhatsapp);
      setEditDuration(selectedTransaction.duration);
    }
  }, [selectedTransaction]);

  // --- FILTERING LOGIC ---
  const filteredTransactions = transactions.filter(t => {
    // 1. Search (ID or Name)
    const lowerSearch = searchTerm.toLowerCase();
    const matchSearch = t.customerName.toLowerCase().includes(lowerSearch) || 
                        t.id.toLowerCase().includes(lowerSearch);

    // 2. Date Range Filter (Rental Date)
    let matchDate = true;
    if (filterStartDate && filterEndDate) {
        matchDate = t.rentalDate >= filterStartDate && t.rentalDate <= filterEndDate;
    } else if (filterStartDate) {
        matchDate = t.rentalDate >= filterStartDate;
    } else if (filterEndDate) {
        matchDate = t.rentalDate <= filterEndDate;
    }

    // 3. Status Filter
    const matchStatus = filterStatus === 'all' ? true : t.status === filterStatus;

    return matchSearch && matchDate && matchStatus;
  });

  // --- ANALYTICS & INSIGHTS LOGIC (Memoized) ---
  const analyticsData = useMemo(() => {
    const dataMap: Record<string, { date: string; income: number; pending: number }> = {};
    let totalRealIncome = 0;
    let totalPotentialLost = 0; // Piutang
    let pendingCount = 0;

    filteredTransactions.forEach(t => {
        const date = t.rentalDate.split('T')[0];
        if (!dataMap[date]) dataMap[date] = { date, income: 0, pending: 0 };

        const paid = t.amountPaid || 0;
        const bill = t.totalPrice;
        const realIncome = Math.min(paid, bill);
        const pending = Math.max(0, bill - paid);

        dataMap[date].income += realIncome;
        dataMap[date].pending += pending;

        totalRealIncome += realIncome;
        totalPotentialLost += pending;
        
        if (t.status === 'pending' || t.status === 'partial_payment') pendingCount++;
    });

    // Chart Data (Sorted by Date)
    const chartData = Object.values(dataMap).sort((a, b) => a.date.localeCompare(b.date));
    
    // Scaling Insights Logic
    const insights = [];
    const totalCount = filteredTransactions.length || 1;
    const avgValue = totalRealIncome / totalCount;
    const pendingRatio = pendingCount / totalCount;

    // Insight 1: Volume & Expansion
    if (totalCount > 50) {
        insights.push({
            type: 'growth',
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-50',
            title: "Trafik Tinggi (Scale Up)",
            desc: "Volume transaksi tinggi! Pertimbangkan menambah stok alat 'Fast Moving' (Tenda/Carrier) atau rekrut admin part-time untuk operasional."
        });
    } else if (totalCount < 10 && totalCount > 0) {
        insights.push({
            type: 'marketing',
            icon: Lightbulb,
            color: 'text-yellow-600',
            bg: 'bg-yellow-50',
            title: "Butuh Marketing",
            desc: "Transaksi masih sepi. Coba buat promo 'Diskon Mahasiswa Baru' atau ajak kerjasama Open Trip lokal."
        });
    }

    // Insight 2: Pricing & Bundling
    if (avgValue < 40000 && totalCount > 0) {
        insights.push({
            type: 'pricing',
            icon: DollarSign,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            title: "Tingkatkan Nilai Transaksi",
            desc: "Rata-rata sewa kecil (<40rb). Buat 'Paket Hemat' (Tenda+Kompor+Nesting) agar pelanggan menyewa lebih banyak item sekaligus."
        });
    }

    // Insight 3: Cashflow & Risk
    if (pendingRatio > 0.3) {
        insights.push({
            type: 'risk',
            icon: AlertTriangle,
            color: 'text-red-600',
            bg: 'bg-red-50',
            title: "Waspada Cashflow Macet",
            desc: `30%+ transaksi belum lunas. Pertegas aturan: Wajib DP 50% di awal & Pelunasan saat ambil barang (No Bon).`
        });
    } else {
        insights.push({
            type: 'safe',
            icon: CheckCircle,
            color: 'text-nature-600',
            bg: 'bg-nature-50',
            title: "Keuangan Sehat",
            desc: "Mayoritas pembayaran lancar. Pertahankan sistem penagihan ini untuk menjaga arus kas tetap positif."
        });
    }

    return { chartData, totalRealIncome, totalPotentialLost, totalCount, pendingCount, insights };
  }, [filteredTransactions]);

  // Max value for Chart Scaling
  const maxChartValue = Math.max(...analyticsData.chartData.map(d => d.income + d.pending), 100000);

  // Fungsi Reset Filter ke Default
  const handleResetFilter = () => {
    setSearchTerm('');
    // Reset ke 1 bulan terakhir
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    setFilterStartDate(getLocalISOString(start));
    setFilterEndDate(getLocalISOString(end));
    setFilterStatus('all');
  };

  // Kalkulasi Realtime untuk Tampilan Kasir
  const calculateFinancials = () => {
    if (!selectedTransaction) return { total: 0, prevPaid: 0, finalPaid: 0, remaining: 0, change: 0, isLunas: false, isKembalian: false, currentInputTotal: 0 };

    const total = selectedTransaction.totalPrice;
    const prevPaid = selectedTransaction.amountPaid || 0;
    
    // Total Masuk Sesi Ini = Cash + Transfer
    const currentInputTotal = cashInput + transferInput;

    // Total Akhir = Uang yang sudah masuk duluan + Uang yang baru diinput sekarang
    const finalPaid = prevPaid + currentInputTotal;
    
    // Sisa Tagihan (Nilai positif) atau Kembalian (Nilai negatif jika dihitung raw)
    const rawRemaining = total - finalPaid;
    
    const remaining = Math.max(0, rawRemaining);
    const change = rawRemaining < 0 ? Math.abs(rawRemaining) : 0;
    
    const isLunas = rawRemaining <= 0;
    const isKembalian = rawRemaining < 0;

    return { total, prevPaid, finalPaid, remaining, change, isLunas, isKembalian, currentInputTotal };
  };

  const { total, prevPaid, remaining, change, isLunas, isKembalian, currentInputTotal } = calculateFinancials();

  const handleSavePayment = async () => {
    if (!selectedTransaction) return;
    setIsSavingPayment(true);
    
    // 1. Hitung Data Pembayaran Dasar
    const totalBill = selectedTransaction.totalPrice;
    const previousPaid = selectedTransaction.amountPaid || 0;
    const remainingDebt = Math.max(0, totalBill - previousPaid); // Sisa utang sebelum pembayaran ini
    
    const inputTotal = cashInput + transferInput;
    
    // 2. LOGIKA UANG MASUK RILL (Laporan Keuangan)
    // Jika input 20.000 (Cash) tapi utang 13.000, maka:
    // - Kembalian: 7.000
    // - Uang Masuk Laporan: 13.000
    // Kita kurangi kembalian dari input Cash (asumsi kembalian diberi cash)
    
    let logCash = cashInput;
    let logTransfer = transferInput;

    if (inputTotal > remainingDebt) {
        // Ada Kembalian
        const changeAmount = inputTotal - remainingDebt;
        
        // Asumsi: Kembalian diambil dari uang Cash yang baru masuk terlebih dahulu
        if (logCash >= changeAmount) {
            logCash = logCash - changeAmount; // Kurangi input cash dengan kembalian
        } else {
            // Jika cash tidak cukup (misal transfer kelebihan), potong dari nominal transfer
            // Ini jarang terjadi (refund transfer), tapi perlu dihandle
            const remainingChange = changeAmount - logCash;
            logCash = 0;
            logTransfer = Math.max(0, logTransfer - remainingChange);
        }
    }

    // 3. LOGIKA INVOICE/STRUK (Transaksi Database)
    // Di database transaksi tetap simpan TOTAL YANG DISERAHKAN (Misal 20.000)
    // Supaya di struk nanti bisa hitung: Bayar 20.000, Kembali 7.000.
    const finalPaidForRecord = previousPaid + inputTotal;
    
    // Tentukan Deskripsi untuk Log Keuangan
    const isDP = (previousPaid === 0 && remainingDebt > inputTotal);
    const descType = isDP ? "Pembayaran DP" : (inputTotal >= remainingDebt) ? "Pelunasan" : "Cicilan";
    const desc = `${descType} (${selectedTransaction.customerName})`;

    // Update Transaction & Create Payment Log (Real Revenue)
    const result = await updateTransactionPayment(
      selectedTransaction.id, 
      finalPaidForRecord,
      // Penting: Di sini kita kirim logCash/logTransfer yang SUDAH BERSIH (tanpa kembalian)
      {
        cashAmount: logCash,
        transferAmount: logTransfer,
        description: desc
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
        amountPaid: finalPaidForRecord,
        status: result.newStatus ? (result.newStatus as any) : selectedTransaction.status
      };
      
      setSelectedTransaction(updatedTrx);
      setCashInput(0);
      setTransferInput(0);
      
      // Alert Informatif
      alert(`Pembayaran tersimpan!\n\nInfo Laporan Keuangan:\nUang Masuk Rill: Rp${(logCash + logTransfer).toLocaleString('id-ID')}\n(Kembalian tidak dicatat sebagai pemasukan)`);
      
    } else {
      alert(`Gagal update pembayaran: ${result.error || 'Terjadi kesalahan sistem'}`);
    }
    setIsSavingPayment(false);
  };

  // --- ITEM EDITING FUNCTIONS ---
  
  const handleAddItem = (product: Product, variantKey?: string) => {
    // Check if item exists in editedItems (Match ID & Variant)
    let selectedSize = undefined;
    let selectedColor = undefined;
    
    if (variantKey) {
        const [color, size] = variantKey.split('|');
        selectedColor = color;
        selectedSize = size;
    }

    const existingIndex = editedItems.findIndex(i => 
       i.id === product.id && 
       i.selectedSize === selectedSize && 
       i.selectedColor === selectedColor
    );

    if (existingIndex >= 0) {
        // Increment Qty
        const newItems = [...editedItems];
        newItems[existingIndex].quantity += 1;
        setEditedItems(newItems);
    } else {
        // Add new item
        const newItem: CartItem = {
            ...product,
            quantity: 1,
            selectedSize,
            selectedColor
        };
        setEditedItems([...editedItems, newItem]);
    }
    setItemSearchTerm(''); // Clear search
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
      const newItems = [...editedItems];
      const newQty = newItems[index].quantity + delta;
      if (newQty > 0) {
          newItems[index].quantity = newQty;
          setEditedItems(newItems);
      }
  };

  const handleRemoveItem = (index: number) => {
      if (confirm('Hapus item ini dari transaksi?')) {
          setEditedItems(editedItems.filter((_, i) => i !== index));
      }
  };

  const handleSaveEditedItems = async () => {
      if (!selectedTransaction) return;
      if (editedItems.length === 0) return alert("Transaksi tidak boleh kosong item!");
      
      setIsSavingItems(true);
      const success = await updateTransactionItems(selectedTransaction.id, editedItems);
      
      if (success) {
          if (onRefreshData) await onRefreshData();
          setIsEditingItems(false);
          // Perlu refresh selectedTransaction karena total harga berubah
          // Kita tutup modal saja biar data refresh dari parent
          setSelectedTransaction(null);
          alert("Item transaksi berhasil diupdate! Stok telah disesuaikan & Harga dikalkulasi ulang.");
      } else {
          alert("Gagal mengupdate item transaksi.");
      }
      setIsSavingItems(false);
  };

  const handleSaveInfo = async () => {
    if (!selectedTransaction) return;
    if (editDuration < 2) return alert("Durasi minimal 2 hari");
    
    setIsSavingInfo(true);
    const success = await updateTransactionDetails(selectedTransaction.id, editName, editWa, editDuration);
    
    if (success) {
        if (onRefreshData) await onRefreshData();
        alert("Data penyewa & durasi berhasil diupdate! Total harga telah dihitung ulang.");
        setSelectedTransaction(null); // Tutup modal untuk refresh
    } else {
        alert("Gagal mengupdate data.");
    }
    setIsSavingInfo(false);
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
    <div className="space-y-6">
      
      {/* 1. SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card: Total Income */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
             <DollarSign size={24} />
          </div>
          <div>
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Masuk (Net)</p>
             <h4 className="text-xl font-black text-gray-900">Rp{analyticsData.totalRealIncome.toLocaleString('id-ID')}</h4>
          </div>
        </div>

        {/* Card: Pending (Potential) */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
             <AlertTriangle size={24} />
          </div>
          <div>
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Piutang (Belum Bayar)</p>
             <h4 className="text-xl font-black text-gray-900">Rp{analyticsData.totalPotentialLost.toLocaleString('id-ID')}</h4>
          </div>
        </div>

        {/* Card: Transaction Count */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
             <Receipt size={24} />
          </div>
          <div>
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Jml Transaksi</p>
             <h4 className="text-xl font-black text-gray-900">{analyticsData.totalCount} <span className="text-sm font-medium text-gray-400 font-normal">Nota</span></h4>
          </div>
        </div>

        {/* Card: Conversion/Analysis Mini */}
        <div className="bg-nature-50 p-4 rounded-xl border border-nature-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-white text-nature-600 rounded-lg border border-nature-100">
             <BarChart3 size={24} />
          </div>
          <div>
             <p className="text-[10px] text-nature-700 font-bold uppercase tracking-wider">Saran Sistem</p>
             <h4 className="text-sm font-bold text-gray-900">{analyticsData.insights.length} Insight Tersedia</h4>
          </div>
        </div>
      </div>

      {/* 2. ANALYTICS SECTION (GRAFIK & SARAN) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-in-right">
         {/* CHART: REVENUE TREND */}
         <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-80">
            <div className="flex justify-between items-center mb-4">
               <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp size={18} className="text-nature-600"/> Grafik Tren Transaksi
               </h4>
               <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-nature-500"></div>Pemasukan</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-300"></div>Piutang</span>
               </div>
            </div>
            
            {/* Chart Container */}
            <div className="flex-1 flex items-end gap-2 overflow-x-auto pb-2 custom-scrollbar">
               {analyticsData.chartData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm">
                     <BarChart3 size={40} className="mb-2 opacity-20"/>
                     Belum ada data untuk ditampilkan grafik.
                  </div>
               ) : (
                  analyticsData.chartData.map((d, i) => {
                     const total = d.income + d.pending;
                     const heightPercent = Math.max(15, Math.round((total / maxChartValue) * 100)); // Min 15% height for visibility
                     const incomePercent = total > 0 ? (d.income / total) * 100 : 0;
                     const pendingPercent = total > 0 ? (d.pending / total) * 100 : 0;

                     return (
                        <div key={i} className="flex flex-col justify-end items-center flex-1 min-w-[30px] h-full group relative">
                           {/* Tooltip */}
                           <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-[10px] p-2 rounded-lg pointer-events-none z-10 w-24 text-center">
                              <p className="font-bold border-b border-gray-700 pb-1 mb-1">{new Date(d.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</p>
                              <div className="text-green-400">In: Rp{(d.income/1000).toFixed(0)}k</div>
                              <div className="text-orange-400">Out: Rp{(d.pending/1000).toFixed(0)}k</div>
                           </div>

                           {/* Stacked Bar */}
                           <div className="w-full rounded-t-md overflow-hidden relative flex flex-col-reverse shadow-sm transition-all hover:brightness-110 cursor-pointer" style={{ height: `${heightPercent}%` }}>
                              <div className="bg-nature-500 w-full transition-all duration-500" style={{ height: `${incomePercent}%` }}></div>
                              <div className="bg-orange-300 w-full transition-all duration-500" style={{ height: `${pendingPercent}%` }}></div>
                           </div>
                           
                           {/* Label Date */}
                           <span className="text-[9px] text-gray-400 mt-2 font-medium truncate w-full text-center">
                              {new Date(d.date).getDate()}
                           </span>
                        </div>
                     )
                  })
               )}
            </div>
         </div>

         {/* INSIGHTS / SARAN BISNIS */}
         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col h-80 overflow-hidden">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
               <Lightbulb size={18} className="text-yellow-500"/> Saran Scale-Up Bisnis
            </h4>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
               {analyticsData.insights.map((insight, idx) => {
                  const Icon = insight.icon;
                  return (
                     <div key={idx} className={`p-3 rounded-xl border flex gap-3 items-start ${insight.bg} border-transparent`}>
                        <div className={`p-1.5 rounded-lg bg-white shrink-0 ${insight.color}`}>
                           <Icon size={16} />
                        </div>
                        <div>
                           <h5 className={`text-xs font-bold ${insight.color} uppercase tracking-wide mb-0.5`}>{insight.title}</h5>
                           <p className="text-xs text-gray-600 leading-relaxed">{insight.desc}</p>
                        </div>
                     </div>
                  );
               })}
               <div className="p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center">
                  <p className="text-[10px] text-gray-400">Analisis diperbarui otomatis berdasarkan data transaksi yang ditampilkan.</p>
               </div>
            </div>
         </div>
      </div>

      {/* 3. FILTER TOOLBAR (TIDY LAYOUT) */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            
            {/* Search */}
            <div className="lg:col-span-4 space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Cari Pelanggan</label>
               <div className="relative">
                 <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                 <input 
                   type="text" 
                   placeholder="Nama / ID Transaksi..." 
                   className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none transition"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
               </div>
            </div>

            {/* Date Range */}
            <div className="lg:col-span-5 space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Periode Sewa</label>
               <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-nature-500 focus-within:border-transparent transition">
                 <Calendar className="text-gray-400 ml-1" size={16} />
                 <input 
                   type="date" 
                   className="text-xs sm:text-sm border-none outline-none text-gray-700 font-bold bg-transparent flex-1 w-full"
                   value={filterStartDate}
                   onChange={(e) => setFilterStartDate(e.target.value)}
                 />
                 <span className="text-gray-300 font-light">|</span>
                 <input 
                   type="date" 
                   className="text-xs sm:text-sm border-none outline-none text-gray-700 font-bold bg-transparent flex-1 w-full"
                   value={filterEndDate}
                   onChange={(e) => setFilterEndDate(e.target.value)}
                 />
               </div>
            </div>

            {/* Status & Reset */}
            <div className="lg:col-span-3 flex gap-2">
               <div className="space-y-1 flex-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Status</label>
                  <div className="relative">
                     <select 
                       className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none transition appearance-none bg-white text-gray-700 font-bold cursor-pointer"
                       value={filterStatus}
                       onChange={(e) => setFilterStatus(e.target.value)}
                     >
                        <option value="all">Semua</option>
                        <option value="pending">Belum Bayar</option>
                        <option value="partial_payment">Cicilan</option>
                        <option value="booked">Lunas (Booking)</option>
                        <option value="rented">Sedang Sewa</option>
                        <option value="completed">Selesai</option>
                        <option value="cancelled">Dibatalkan</option>
                     </select>
                     <Filter className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={14} />
                  </div>
               </div>
               
               <div className="space-y-1">
                  <label className="invisible text-[10px] font-bold uppercase tracking-wide">Reset</label>
                  <button 
                    onClick={handleResetFilter}
                    className="h-[38px] px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition flex items-center justify-center border border-gray-200"
                    title="Reset Filter ke Default (1 Bulan)"
                  >
                     <RotateCcw size={16} />
                  </button>
               </div>
            </div>

         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={18} /> Daftar Transaksi
          </h3>
          <span className="text-xs text-gray-400">Menampilkan {filteredTransactions.length} data</span>
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
                {filteredTransactions.map(trx => {
                  const paid = trx.amountPaid || 0;
                  const totalTrx = trx.totalPrice;
                  const isPaidOffTrx = paid >= totalTrx;
                  
                  return (
                    <tr key={trx.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 align-middle">
                        <div className="font-mono text-xs text-gray-500">#{trx.id.slice(0, 6)}</div>
                        <div className="text-xs font-bold text-gray-700 mt-1">
                          {new Date(trx.rentalDate || '').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                {filteredTransactions.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-400">
                    <p className="mb-2">Tidak ada transaksi yang cocok.</p>
                    <button 
                      onClick={handleResetFilter}
                      className="text-nature-600 font-bold text-xs underline"
                    >
                      Reset Filter
                    </button>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL KASIR INTERAKTIF */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTransaction(null)}></div>
           <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-slide-in-right md:animate-none flex flex-col max-h-[95vh]">
              
              {/* Header */}
              <div className="bg-nature-900 px-6 py-4 flex justify-between items-center text-white shrink-0">
                 <div>
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20} /> Kasir & Detail Order</h3>
                    <p className="text-xs text-nature-200 font-mono mt-0.5">#{selectedTransaction.id.slice(0,8)} - {selectedTransaction.customerName}</p>
                 </div>
                 <button onClick={() => setSelectedTransaction(null)} className="hover:bg-white/10 p-1 rounded-full transition"><X size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    
                    {/* LEFT COLUMN: ITEM DETAILS (EDITABLE) */}
                    <div className="flex flex-col gap-4 order-2 xl:order-1">
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
                           <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                              <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2"><ShoppingBag size={16}/> Daftar Barang</h4>
                              {!isEditingItems ? (
                                 <button 
                                   onClick={() => setIsEditingItems(true)} 
                                   className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition flex items-center gap-1"
                                 >
                                    <Edit size={12}/> Ubah Order
                                 </button>
                              ) : (
                                 <div className="flex gap-2">
                                    <button 
                                      onClick={() => { setIsEditingItems(false); setEditedItems(selectedTransaction.items); }}
                                      className="text-xs bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-300"
                                    >
                                       Batal
                                    </button>
                                    <button 
                                      onClick={handleSaveEditedItems}
                                      disabled={isSavingItems}
                                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-green-700 flex items-center gap-1"
                                    >
                                       {isSavingItems ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>} Simpan
                                    </button>
                                 </div>
                              )}
                           </div>
                           
                           {/* Item List or Editor */}
                           <div className="p-4 flex-1">
                              {isEditingItems && (
                                 <div className="mb-4 relative z-20">
                                    <div className="relative">
                                       <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                                       <input 
                                         type="text" 
                                         placeholder="Cari barang untuk ditambah..." 
                                         className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                         value={itemSearchTerm}
                                         onChange={e => setItemSearchTerm(e.target.value)}
                                       />
                                    </div>
                                    {itemSearchTerm && (
                                       <div className="absolute w-full bg-white shadow-xl border border-gray-100 rounded-b-lg mt-1 max-h-48 overflow-y-auto">
                                          {products
                                            .filter(p => p.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                                            .map(p => {
                                               const hasVariants = p.variants && p.variants.length > 0;
                                               return (
                                                  <div key={p.id} className="p-2 hover:bg-gray-50 border-b border-gray-50 last:border-0 text-sm">
                                                     <div className="font-bold text-gray-800">{p.name}</div>
                                                     {hasVariants ? (
                                                         <div className="flex flex-wrap gap-1 mt-1">
                                                            {p.variants?.map((v, i) => (
                                                               <button 
                                                                 key={i} 
                                                                 onClick={() => handleAddItem(p, `${v.color}|${v.size}`)}
                                                                 className="text-[10px] bg-gray-100 hover:bg-blue-100 px-2 py-0.5 rounded border"
                                                               >
                                                                  {v.color} - {v.size}
                                                               </button>
                                                            ))}
                                                         </div>
                                                     ) : (
                                                         <button onClick={() => handleAddItem(p)} className="text-[10px] text-blue-600 font-bold mt-1 hover:underline">
                                                            + Tambah
                                                         </button>
                                                     )}
                                                  </div>
                                               );
                                            })}
                                       </div>
                                    )}
                                 </div>
                              )}

                              <div className="space-y-3">
                                 {(isEditingItems ? editedItems : selectedTransaction.items).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                                       <div>
                                          <div className="font-bold text-gray-800">{item.name}</div>
                                          <div className="text-[10px] text-gray-500 flex gap-2">
                                             {item.selectedSize && <span className="bg-gray-100 px-1 rounded">Size: {item.selectedSize}</span>}
                                             {item.selectedColor && <span className="bg-gray-100 px-1 rounded">Color: {item.selectedColor}</span>}
                                          </div>
                                       </div>
                                       
                                       <div className="flex items-center gap-3">
                                          {isEditingItems ? (
                                             <div className="flex items-center border rounded-lg bg-gray-50">
                                                <button onClick={() => handleUpdateItemQty(idx, -1)} className="p-1 hover:bg-gray-200 rounded-l-lg"><Minus size={12}/></button>
                                                <span className="w-8 text-center font-bold text-xs">{item.quantity}</span>
                                                <button onClick={() => handleUpdateItemQty(idx, 1)} className="p-1 hover:bg-gray-200 rounded-r-lg"><Plus size={12}/></button>
                                             </div>
                                          ) : (
                                             <span className="font-bold bg-gray-100 px-2 py-1 rounded text-xs">x{item.quantity}</span>
                                          )}
                                          
                                          {isEditingItems && (
                                             <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                                                <Trash2 size={14}/>
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>

                        {/* Customer Info (EDITABLE) */}
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                           <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2"><User size={14}/> Kontak & Durasi</h4>
                              {!isEditingInfo ? (
                                <button onClick={() => setIsEditingInfo(true)} className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold flex items-center gap-1">
                                  <Edit size={10} /> Edit Data
                                </button>
                              ) : (
                                <div className="flex gap-2">
                                  <button onClick={() => setIsEditingInfo(false)} className="text-[10px] bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold">Batal</button>
                                  <button onClick={handleSaveInfo} disabled={isSavingInfo} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1">
                                    {isSavingInfo ? <Loader2 size={10} className="animate-spin"/> : <Save size={10}/>} Simpan
                                  </button>
                                </div>
                              )}
                           </div>
                           
                           {isEditingInfo ? (
                             <div className="space-y-2">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500">Nama Penyewa</label>
                                  <input className="w-full border rounded px-2 py-1 text-sm" value={editName} onChange={e => setEditName(e.target.value)} />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500">WhatsApp</label>
                                  <input className="w-full border rounded px-2 py-1 text-sm" value={editWa} onChange={e => setEditWa(e.target.value)} />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500">Durasi (Hari)</label>
                                  <input type="number" min="2" className="w-full border rounded px-2 py-1 text-sm" value={editDuration} onChange={e => setEditDuration(parseInt(e.target.value)||2)} />
                                  <p className="text-[10px] text-orange-500 italic mt-0.5">*Total harga akan dihitung ulang otomatis.</p>
                                </div>
                             </div>
                           ) : (
                             <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-bold text-gray-800">{selectedTransaction.customerName}</p>
                                  <p className="text-sm text-gray-500">{selectedTransaction.customerWhatsapp}</p>
                                  <p className="text-xs font-bold text-nature-600 mt-1 bg-nature-50 inline-block px-2 py-0.5 rounded">Sewa {selectedTransaction.duration} Hari</p>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                      onClick={() => printInvoice(selectedTransaction)}
                                      className="text-nature-600 bg-nature-50 p-2 rounded-lg hover:bg-nature-100 transition border border-nature-200"
                                      title="Cetak Nota"
                                  >
                                      <Printer size={16} />
                                  </button>
                                  <a href={`https://wa.me/${selectedTransaction.customerWhatsapp}`} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 p-2 rounded-lg hover:bg-blue-100 transition border border-blue-200">
                                        <ArrowRightLeft size={16} />
                                  </a>
                                </div>
                             </div>
                           )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: FINANCIALS (PAYMENT) */}
                    <div className="order-1 xl:order-2">
                        <div className="bg-gray-50 border border-gray-200 p-5 rounded-2xl shadow-sm h-full">
                           <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
                              <Wallet size={16}/> Status Pembayaran
                           </h4>

                           <div className="space-y-4 mb-6">
                              <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-600">Total Tagihan</span>
                                 <span className="text-xl font-black text-gray-900">Rp{total.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-sm text-gray-600">Sudah Dibayar</span>
                                 <span className="text-base font-bold text-green-600">Rp{prevPaid.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-300">
                                 {isKembalian ? (
                                    <>
                                       <span className="text-xs font-bold text-gray-400 uppercase">Kembalian</span>
                                       <span className="text-lg font-bold text-blue-600">Rp{change.toLocaleString('id-ID')}</span>
                                    </>
                                 ) : (
                                    <>
                                       <span className="text-xs font-bold text-gray-400 uppercase">Kekurangan</span>
                                       <span className="text-lg font-bold text-red-600">Rp{remaining.toLocaleString('id-ID')}</span>
                                    </>
                                 )}
                              </div>
                           </div>

                           {/* Payment Inputs */}
                           <div className="space-y-3">
                              <label className="text-xs font-black text-gray-500 uppercase">Input Bayar Tambahan</label>
                              <div className="flex gap-2">
                                 <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Cash</span>
                                    <input 
                                      type="number" 
                                      className="w-full pl-12 pr-2 py-2 text-sm font-bold border rounded-lg outline-none focus:border-green-500"
                                      placeholder="0"
                                      value={cashInput === 0 ? '' : cashInput}
                                      onChange={(e) => setCashInput(Number(e.target.value))}
                                    />
                                 </div>
                                 <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">TF</span>
                                    <input 
                                      type="number" 
                                      className="w-full pl-10 pr-2 py-2 text-sm font-bold border rounded-lg outline-none focus:border-blue-500"
                                      placeholder="0"
                                      value={transferInput === 0 ? '' : transferInput}
                                      onChange={(e) => setTransferInput(Number(e.target.value))}
                                    />
                                 </div>
                              </div>
                              
                              <div className="flex gap-2">
                                 <button onClick={() => { setCashInput(0); setTransferInput(0); }} className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg"><RotateCcw size={16}/></button>
                                 <button 
                                   onClick={handleSavePayment}
                                   disabled={isSavingPayment || currentInputTotal === 0}
                                   className="flex-1 bg-nature-900 text-white font-bold py-2 rounded-lg hover:bg-nature-800 disabled:opacity-50 flex items-center justify-center gap-2"
                                 >
                                    {isSavingPayment ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} 
                                    Simpan Pembayaran
                                 </button>
                              </div>
                           </div>
                           
                           <div className={`mt-6 p-3 rounded-lg text-center text-sm font-bold border ${isLunas ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                              {isLunas ? 'STATUS: LUNAS' : 'STATUS: BELUM LUNAS'}
                           </div>
                        </div>
                    </div>
                 </div>

                 <div className="flex justify-end pt-6 border-t border-gray-100 mt-6">
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