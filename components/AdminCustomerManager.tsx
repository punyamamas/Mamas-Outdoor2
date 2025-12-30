import React, { useState, useMemo } from 'react';
import { Users, Search, MessageCircle, TrendingUp, History, Star, ArrowUpRight, Crown, MapPin, Globe, Navigation, Target, Layers, Info, AlertTriangle } from 'lucide-react';
import { Transaction } from '../types';

interface AdminCustomerManagerProps {
  transactions: Transaction[];
}

interface CustomerStats {
  name: string;
  whatsapp: string;
  location: string; // New
  totalRentals: number;
  totalSpent: number;
  lastRentalDate: string;
  firstRentalDate: string;
  status: 'New' | 'Regular' | 'Loyal' | 'VIP';
}

interface CohortData {
  cohortMonth: string; // YYYY-MM
  totalCustomers: number;
  retentionCounts: number[]; // Index 0 = Month 0, Index 1 = Month 1, dst.
}

const AdminCustomerManager: React.FC<AdminCustomerManagerProps> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // AGGREGATION LOGIC: Mengubah daftar transaksi menjadi daftar pelanggan unik
  const customers = useMemo(() => {
    const customerMap: Record<string, CustomerStats> = {};

    transactions.forEach(trx => {
      // Gunakan Nomor WA sebagai Unique Identifier (bersihkan format)
      const rawPhone = trx.customerWhatsapp || '';
      const phoneKey = rawPhone.replace(/\D/g, ''); // Hanya angka

      if (!phoneKey) return;

      if (!customerMap[phoneKey]) {
        customerMap[phoneKey] = {
          name: trx.customerName,
          whatsapp: trx.customerWhatsapp, 
          location: trx.customerLocation || '-', // Default
          totalRentals: 0,
          totalSpent: 0,
          lastRentalDate: trx.rentalDate,
          firstRentalDate: trx.rentalDate,
          status: 'New'
        };
      }

      const customer = customerMap[phoneKey];
      
      // Update Stats
      customer.totalRentals += 1;
      customer.totalSpent += trx.totalPrice;
      
      // Update Location jika tersedia di transaksi terbaru (dan bukan strip)
      // Prioritaskan lokasi yang lebih detail jika ada
      if (trx.customerLocation && trx.customerLocation !== '-' && trx.customerLocation.length > 3) {
         customer.location = trx.customerLocation;
      }
      
      // Check Dates
      if (new Date(trx.rentalDate) > new Date(customer.lastRentalDate)) {
        customer.lastRentalDate = trx.rentalDate;
        // Update nama ke yang terbaru jika ada perubahan
        customer.name = trx.customerName; 
      }
      if (new Date(trx.rentalDate) < new Date(customer.firstRentalDate)) {
        customer.firstRentalDate = trx.rentalDate;
      }

      // Determine Status
      if (customer.totalSpent > 1000000) customer.status = 'VIP';
      else if (customer.totalRentals > 3) customer.status = 'Loyal';
      else if (customer.totalRentals > 1) customer.status = 'Regular';
      else customer.status = 'New';
    });

    return Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent); // Sort by Spend
  }, [transactions]);

  // GEOSPATIAL ANALYSIS LOGIC
  const locationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let validCount = 0;

    customers.forEach(c => {
        let loc = c.location;
        // Cleaning: Ambil kata pertama/kedua sebelum koma (biasanya Kecamatan/Kota)
        // Contoh: "Purwokerto Utara, Banyumas" -> "Purwokerto Utara"
        if (loc && loc !== '-') {
            // Hapus kata "(IP Detected)" agar bersih
            loc = loc.replace('(IP Detected)', '').trim();
            // Ambil bagian depan sebelum koma
            loc = loc.split(',')[0].trim();
            
            if (loc) {
                stats[loc] = (stats[loc] || 0) + 1;
                validCount++;
            }
        } else {
            stats['Tidak Terdeteksi'] = (stats['Tidak Terdeteksi'] || 0) + 1;
        }
    });

    // Convert to array and sort
    const sorted = Object.entries(stats)
        .map(([name, count]) => ({ name, count, percentage: validCount > 0 ? (count / customers.length) * 100 : 0 }))
        .sort((a, b) => b.count - a.count);

    return { data: sorted, total: customers.length, validLocations: validCount };
  }, [customers]);

  // COHORT ANALYSIS LOGIC
  const cohortStats = useMemo(() => {
    // 1. Map setiap customer ke "Cohort Month" (Bulan pertama mereka transaksi)
    const customerCohorts: Record<string, string> = {}; // Phone -> '2024-01'
    const customerActivity: Record<string, Set<string>> = {}; // Phone -> Set('2024-01', '2024-02')

    // Helper: Get YYYY-MM
    const getMonthStr = (dateStr: string) => dateStr.slice(0, 7);
    
    // Helper: Month Difference
    const getMonthDiff = (start: string, current: string) => {
        const d1 = new Date(start + '-01');
        const d2 = new Date(current + '-01');
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    };

    // Build Maps
    transactions.forEach(trx => {
        const phone = trx.customerWhatsapp.replace(/\D/g, '');
        if (!phone) return;
        
        const trxMonth = getMonthStr(trx.rentalDate);

        // Tentukan Cohort (Bulan Pertama)
        if (!customerCohorts[phone]) {
            customerCohorts[phone] = trxMonth; // Set first seen
        } else {
            // Jika data tidak urut, pastikan kita ambil bulan paling awal
            if (trxMonth < customerCohorts[phone]) {
                customerCohorts[phone] = trxMonth;
            }
        }

        // Catat Aktivitas
        if (!customerActivity[phone]) customerActivity[phone] = new Set();
        customerActivity[phone].add(trxMonth);
    });

    // 2. Aggregate Data into Grid
    // Map: CohortMonth -> { size: 0, retention: { 0: 0, 1: 0, ... } }
    const grid: Record<string, { size: number, retention: Record<number, number> }> = {};

    Object.keys(customerCohorts).forEach(phone => {
        const cohortMonth = customerCohorts[phone];
        if (!grid[cohortMonth]) grid[cohortMonth] = { size: 0, retention: {} };
        
        // Tambah ukuran cohort
        grid[cohortMonth].size += 1;

        // Cek aktivitas di bulan-bulan berikutnya
        customerActivity[phone].forEach(activeMonth => {
            const diff = getMonthDiff(cohortMonth, activeMonth);
            if (diff >= 0) {
                if (!grid[cohortMonth].retention[diff]) grid[cohortMonth].retention[diff] = 0;
                grid[cohortMonth].retention[diff] += 1;
            }
        });
    });

    // 3. Convert to Array & Sort by Date Descending (Terbaru diatas)
    const result: CohortData[] = Object.entries(grid)
        .map(([month, data]) => {
            // Convert map retention to array
            const retentionArr: number[] = [];
            const maxMonth = Math.max(...Object.keys(data.retention).map(Number), 0);
            
            for (let i = 0; i <= Math.min(maxMonth, 11); i++) { // Limit 12 bulan
                retentionArr[i] = data.retention[i] || 0;
            }
            
            return {
                cohortMonth: month,
                totalCustomers: data.size,
                retentionCounts: retentionArr
            };
        })
        .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth)); // Sort Descending

    return result;
  }, [transactions]);

  // Filtering
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.whatsapp.includes(searchTerm) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper WA
  const openWa = (phone: string) => {
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    window.open(`https://wa.me/${p}`, '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VIP': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Loyal': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Regular': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Helper Heatmap Color for Location
  const getHeatmapColor = (index: number) => {
      if (index === 0) return 'bg-red-500 text-white border-red-600 scale-110 shadow-lg shadow-red-200'; 
      if (index === 1) return 'bg-orange-500 text-white border-orange-600 shadow-md'; 
      if (index === 2) return 'bg-yellow-400 text-yellow-900 border-yellow-500';
      if (index < 5) return 'bg-blue-400 text-white border-blue-500';
      return 'bg-gray-200 text-gray-600 border-gray-300';
  };

  const getHeatmapSize = (count: number, max: number) => {
      const minSize = 60; 
      const variableSize = 60;
      const percent = count / max;
      return minSize + (variableSize * percent);
  };

  // Helper Heatmap Color for Cohort Cell (Based on Percentage)
  const getCohortCellColor = (percent: number) => {
      if (percent >= 50) return 'bg-green-600 text-white';
      if (percent >= 30) return 'bg-green-400 text-white';
      if (percent >= 15) return 'bg-green-200 text-green-800';
      if (percent >= 5) return 'bg-green-50 text-green-800';
      return 'bg-white text-gray-400';
  };

  // COHORT INSIGHT GENERATOR
  const getCohortInsight = () => {
      if (cohortStats.length < 2) return null;
      
      let totalM1Retention = 0;
      let m1Count = 0;
      
      cohortStats.forEach(c => {
          if (c.retentionCounts[1] !== undefined && c.totalCustomers > 0) {
              totalM1Retention += (c.retentionCounts[1] / c.totalCustomers);
              m1Count++;
          }
      });
      
      const avgM1Retention = m1Count > 0 ? (totalM1Retention / m1Count) * 100 : 0;

      if (avgM1Retention < 10) {
          return {
              type: 'danger',
              title: 'Retensi Awal Rendah (<10%)',
              desc: 'Banyak pelanggan hilang setelah sewa pertama. Cek kualitas alat atau keramahan pelayanan saat pengambilan barang.'
          };
      } else if (avgM1Retention > 30) {
          return {
              type: 'success',
              title: 'Customer Sangat Setia (>30%)',
              desc: 'Retensi bulan ke-1 sangat bagus! Pelanggan suka dengan layanan Mamas Outdoor. Pertahankan!'
          };
      }
      return {
          type: 'neutral',
          title: 'Retensi Normal (10-30%)',
          desc: 'Performa standar rental. Coba tawarkan diskon khusus untuk penyewaan kedua agar mereka kembali.'
      };
  };

  const cohortInsight = getCohortInsight();

  return (
    <div className="space-y-8">
        
      {/* 1. ANALISIS GEOSPASIAL (HEATMAP) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Top Locations List */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
            <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
               <Target size={20} className="text-nature-600"/> Top 5 Basis Pelanggan
            </h4>
            <div className="space-y-4 flex-1">
               {locationStats.data.slice(0, 5).map((loc, idx) => (
                  <div key={idx} className="relative">
                     <div className="flex justify-between text-xs font-bold mb-1 text-gray-700">
                        <span>{idx+1}. {loc.name}</span>
                        <span>{loc.count} Orang</span>
                     </div>
                     <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                           className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-nature-600' : 'bg-nature-400'}`} 
                           style={{ width: `${(loc.count / locationStats.data[0].count) * 100}%` }}
                        ></div>
                     </div>
                  </div>
               ))}
               {locationStats.data.length === 0 && <p className="text-gray-400 text-sm italic">Belum ada data lokasi.</p>}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
               Total {locationStats.validLocations} pelanggan terdeteksi lokasinya dari {locationStats.total} total pelanggan.
            </div>
         </div>

         {/* Visual Heatmap / Cluster */}
         <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
            <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
               <Globe size={20} className="text-blue-600"/> Peta Sebaran (Heatmap Cluster)
            </h4>
            
            {locationStats.validLocations > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-4 min-h-[200px]">
                    {locationStats.data.filter(l => l.name !== 'Tidak Terdeteksi').slice(0, 10).map((loc, idx) => {
                        const size = getHeatmapSize(loc.count, locationStats.data[0].count);
                        return (
                            <div 
                                key={idx}
                                className={`rounded-full flex flex-col items-center justify-center text-center p-2 border-2 transition-transform hover:scale-110 cursor-default animate-float ${getHeatmapColor(idx)}`}
                                style={{ 
                                    width: `${size}px`, 
                                    height: `${size}px`,
                                    animationDelay: `${idx * 0.5}s` 
                                }}
                                title={`${loc.name}: ${loc.count} Pelanggan`}
                            >
                                <span className="font-bold leading-tight line-clamp-2 text-[10px] md:text-xs">
                                    {loc.name}
                                </span>
                                <span className="text-[10px] font-black opacity-80 mt-0.5">
                                    {loc.count}
                                </span>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                    <MapPin size={40} className="mb-2 opacity-20"/>
                    <p>Belum cukup data lokasi untuk membuat Heatmap.</p>
                </div>
            )}
            
            <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-10 -mb-10 w-40 h-40 bg-nature-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
         </div>
      </div>

      {/* 2. ANALISIS KOHORT (RETENTION) - NEW FEATURE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
               <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Layers size={20} className="text-purple-600"/> Analisis Kohort (Retensi Pelanggan)
               </h3>
               <p className="text-xs text-gray-500 mt-1 max-w-xl">
                  Membaca pola kesetiaan pelanggan. Kolom "Bulan 1" menunjukkan berapa % pelanggan yang kembali menyewa di bulan berikutnya.
               </p>
            </div>
            
            {/* Business Insight Box */}
            {cohortInsight && (
               <div className={`px-4 py-3 rounded-xl border flex items-start gap-3 max-w-md ${
                  cohortInsight.type === 'danger' ? 'bg-red-50 border-red-100 text-red-800' :
                  cohortInsight.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' :
                  'bg-blue-50 border-blue-100 text-blue-800'
               }`}>
                  <div className="mt-0.5"><Info size={16}/></div>
                  <div>
                     <h5 className="font-bold text-xs uppercase mb-0.5">{cohortInsight.title}</h5>
                     <p className="text-xs leading-relaxed opacity-90">{cohortInsight.desc}</p>
                  </div>
               </div>
            )}
         </div>

         <div className="overflow-x-auto p-6">
            {cohortStats.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                   Belum cukup data transaksi untuk membuat analisis kohort.
                </div>
            ) : (
                <table className="w-full text-xs text-center border-separate border-spacing-1">
                   <thead>
                      <tr>
                         <th className="p-2 text-left w-32 font-bold text-gray-700 bg-gray-100 rounded">Angkatan (Cohort)</th>
                         <th className="p-2 w-20 font-bold text-gray-700 bg-gray-100 rounded">Pelanggan</th>
                         {Array.from({length: 12}).map((_, i) => (
                            <th key={i} className="p-2 w-16 font-medium text-gray-500 bg-gray-50 rounded">Bulan {i}</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody>
                      {cohortStats.map((row, idx) => (
                         <tr key={idx}>
                            <td className="p-2 text-left font-bold text-gray-800 bg-gray-50 rounded">
                               {new Date(row.cohortMonth + '-01').toLocaleDateString('id-ID', {month: 'long', year: 'numeric'})}
                            </td>
                            <td className="p-2 font-mono text-gray-600 bg-gray-50 rounded border border-gray-100">
                               {row.totalCustomers} org
                            </td>
                            {Array.from({length: 12}).map((_, i) => {
                               const count = row.retentionCounts[i];
                               const percent = row.totalCustomers > 0 ? Math.round((count / row.totalCustomers) * 100) : 0;
                               // Month 0 is always 100% basically, keep it distinct
                               const cellColor = i === 0 ? 'bg-white text-gray-300' : getCohortCellColor(percent);
                               
                               return (
                                  <td key={i} className={`p-2 rounded transition hover:scale-105 cursor-default ${cellColor} border border-gray-100`}>
                                     {count > 0 ? (
                                        <div className="flex flex-col">
                                           <span className="font-bold">{percent}%</span>
                                           {i > 0 && <span className="text-[9px] opacity-70">({count})</span>}
                                        </div>
                                     ) : (
                                        <span className="text-gray-200">-</span>
                                     )}
                                  </td>
                               )
                            })}
                         </tr>
                      ))}
                   </tbody>
                </table>
            )}
         </div>
      </div>

      {/* 3. TABEL PELANGGAN (EXISTING) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-nature-50">
            <div>
            <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
                <Users size={20} /> Data Pelanggan Lengkap
            </h3>
            <p className="text-xs text-nature-600 mt-1">
                Database {customers.length} pelanggan unik
            </p>
            </div>
            
            <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
                type="text" 
                placeholder="Cari Nama / WA / Kota..." 
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
        </div>

        <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs border-b border-gray-200">
                <tr>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Domisili</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Total Sewa</th>
                <th className="px-6 py-4 text-right">Total Belanja (CLV)</th>
                <th className="px-6 py-4 text-right">Terakhir Sewa</th>
                <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredCustomers.length === 0 ? (
                <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                    Belum ada data pelanggan yang cocok.
                    </td>
                </tr>
                ) : (
                filteredCustomers.map((cust, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-600'
                        }`}>
                            {cust.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-gray-900 flex items-center gap-1">
                            {cust.name}
                            {cust.status === 'VIP' && <Crown size={12} className="text-yellow-500 fill-current"/>}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">{cust.whatsapp}</div>
                        </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-gray-600 text-xs font-medium bg-gray-50 px-2 py-1 rounded w-fit">
                            <MapPin size={12} className={cust.location === '-' ? 'text-gray-300' : 'text-nature-500'} />
                            {cust.location.replace('(IP Detected)', '')}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(cust.status)}`}>
                        {cust.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="font-bold text-gray-700">{cust.totalRentals}x</div>
                        <div className="text-[10px] text-gray-400">Transaksi</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="font-black text-nature-700">Rp{cust.totalSpent.toLocaleString('id-ID')}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="text-xs font-medium text-gray-600">
                        {new Date(cust.lastRentalDate).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'})}
                        </div>
                        <div className="text-[10px] text-gray-400">
                        Sejak {new Date(cust.firstRentalDate).toLocaleDateString('id-ID', {month: 'short', year: '2-digit'})}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <button 
                        onClick={() => openWa(cust.whatsapp)}
                        className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition border border-green-200"
                        title="Chat WhatsApp"
                        >
                        <MessageCircle size={16} />
                        </button>
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

export default AdminCustomerManager;