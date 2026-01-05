
import React, { useState, useMemo } from 'react';
import { Users, Search, MessageCircle, TrendingUp, History, Star, ArrowUpRight, Crown, MapPin, Globe, Navigation, Target, Layers, Info, AlertTriangle, Award, Gift, DollarSign, PieChart, Share2, Megaphone, Briefcase, Zap, GitMerge, PackagePlus, Warehouse } from 'lucide-react';
import { Transaction } from '../types';

interface AdminCustomerManagerProps {
  transactions: Transaction[];
}

interface CustomerStats {
  name: string;
  whatsapp: string;
  location: string; 
  totalRentals: number;
  totalSpent: number;
  lastRentalDate: string;
  firstRentalDate: string;
  avgItemsPerRent: number; 
  preferredCategory: string; 
  status: 'New' | 'Regular' | 'Loyal' | 'VIP';
  persona: 'Organizer (B2B)' | 'Mapala/Pro' | 'Camper Ceria' | 'Mahasiswa Hemat'; 
  lateCount: number; // NEW FIELD
}

interface CohortData {
  cohortMonth: string; 
  totalCustomers: number;
  retentionCounts: number[]; 
}

const AdminCustomerManager: React.FC<AdminCustomerManagerProps> = ({ transactions }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // 1. AGGREGATION LOGIC (Customer Profiling)
  const customers = useMemo(() => {
    const customerMap: Record<string, CustomerStats> = {};

    const determinePersona = (avgSpend: number, avgItems: number, items: any[]): CustomerStats['persona'] => {
        const isBulkRenter = avgItems >= 4 || avgSpend > 150000;
        const hasTechnicalGear = items.some((i: any) => i.name.toLowerCase().includes('carrier') || i.name.toLowerCase().includes('trekking'));
        
        if (isBulkRenter && avgSpend > 300000) return 'Organizer (B2B)'; 
        if (hasTechnicalGear) return 'Mapala/Pro'; 
        if (avgSpend > 100000) return 'Camper Ceria'; 
        return 'Mahasiswa Hemat'; 
    };

    transactions.forEach(trx => {
      const rawPhone = trx.customerWhatsapp || '';
      const phoneKey = rawPhone.replace(/\D/g, ''); 

      if (!phoneKey) return;

      if (!customerMap[phoneKey]) {
        customerMap[phoneKey] = {
          name: trx.customerName,
          whatsapp: trx.customerWhatsapp, 
          location: trx.customerLocation || '-', 
          totalRentals: 0,
          totalSpent: 0,
          lastRentalDate: trx.rentalDate,
          firstRentalDate: trx.rentalDate,
          avgItemsPerRent: 0,
          preferredCategory: 'General',
          status: 'New',
          persona: 'Mahasiswa Hemat',
          lateCount: 0 // Init
        };
      }

      const customer = customerMap[phoneKey];
      
      customer.totalRentals += 1;
      customer.totalSpent += trx.totalPrice;
      
      // Hitung keterlambatan jika ada denda
      if (trx.fineAmount && trx.fineAmount > 0) {
          customer.lateCount += 1;
      }
      
      if (trx.customerLocation && trx.customerLocation !== '-' && trx.customerLocation.length > 3) {
         customer.location = trx.customerLocation;
      }
      
      if (new Date(trx.rentalDate) > new Date(customer.lastRentalDate)) {
        customer.lastRentalDate = trx.rentalDate;
        customer.name = trx.customerName; 
      }
      if (new Date(trx.rentalDate) < new Date(customer.firstRentalDate)) {
        customer.firstRentalDate = trx.rentalDate;
      }

      if (customer.totalSpent > 1000000) customer.status = 'VIP';
      else if (customer.totalRentals > 3) customer.status = 'Loyal';
      else if (customer.totalRentals > 1) customer.status = 'Regular';
      else customer.status = 'New';

      const currentItemsCount = trx.items.reduce((acc, i) => acc + i.quantity, 0);
      const newAvgItems = ((customer.avgItemsPerRent * (customer.totalRentals - 1)) + currentItemsCount) / customer.totalRentals;
      customer.avgItemsPerRent = newAvgItems;
      
      const avgSpend = customer.totalSpent / customer.totalRentals;
      customer.persona = determinePersona(avgSpend, newAvgItems, trx.items);
    });

    return Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [transactions]);

  // 2. MARKET BASKET ANALYSIS LOGIC
  const basketAnalysis = useMemo(() => {
      const pairCounts: Record<string, number> = {};
      const itemCounts: Record<string, number> = {};
      let totalTrx = 0;

      transactions.forEach(t => {
          if(t.status === 'cancelled') return;
          totalTrx++;
          const uniqueItems = Array.from(new Set(t.items.map(i => i.name.trim()))) as string[];

          // Count Individual Items
          uniqueItems.forEach(item => {
              itemCounts[item] = (itemCounts[item] || 0) + 1;
          });

          // Count Pairs
          for (let i = 0; i < uniqueItems.length; i++) {
              for (let j = i + 1; j < uniqueItems.length; j++) {
                  const pair = [uniqueItems[i], uniqueItems[j]].sort();
                  const key = pair.join('|');
                  pairCounts[key] = (pairCounts[key] || 0) + 1;
              }
          }
      });

      // Process Results
      const topPairs = Object.entries(pairCounts)
          .map(([key, val]) => {
              const count = Number(val);
              const parts = key.split('|');
              const itemA = String(parts[0]);
              const itemB = String(parts[1]);
              
              const countA = itemCounts[itemA] || 0;
              const countB = itemCounts[itemB] || 0;

              const confAtoB = countA ? (count / countA) * 100 : 0;
              const confBtoA = countB ? (count / countB) * 100 : 0;

              const isStrongerAtoB = confAtoB >= confBtoA;

              return {
                  driver: isStrongerAtoB ? itemA : itemB,
                  follower: isStrongerAtoB ? itemB : itemA,
                  count,
                  confidence: isStrongerAtoB ? confAtoB : confBtoA
              };
          })
          .filter(p => p.count > 1) 
          .sort((a, b) => b.count - a.count) 
          .slice(0, 6); 

      return topPairs;
  }, [transactions]);

  // 3. PSYCHOGRAPHIC & COMMUNITY STATS
  const communityStats = useMemo(() => {
      const stats = { organizer: 0, mapala: 0, camper: 0, student: 0 };
      customers.forEach(c => {
          if (c.persona === 'Organizer (B2B)') stats.organizer++;
          else if (c.persona === 'Mapala/Pro') stats.mapala++;
          else if (c.persona === 'Camper Ceria') stats.camper++;
          else stats.student++;
      });
      return stats;
  }, [customers]);

  // 4. CLV LOGIC
  const clvStats = useMemo(() => {
      if (customers.length === 0) return null;
      const sortedBySpend = [...customers].sort((a, b) => b.totalSpent - a.totalSpent);
      const totalRevenue = sortedBySpend.reduce((acc, c) => acc + c.totalSpent, 0);
      const totalCount = sortedBySpend.length;
      const whaleLimit = Math.ceil(totalCount * 0.2);
      const dolphinLimit = Math.ceil(totalCount * 0.5); 
      const whales = sortedBySpend.slice(0, whaleLimit);
      const dolphins = sortedBySpend.slice(whaleLimit, dolphinLimit);
      const minnows = sortedBySpend.slice(dolphinLimit);
      const whaleRevenue = whales.reduce((acc, c) => acc + c.totalSpent, 0);
      const dolphinRevenue = dolphins.reduce((acc, c) => acc + c.totalSpent, 0);
      const minnowRevenue = minnows.reduce((acc, c) => acc + c.totalSpent, 0);
      const avgClv = totalRevenue / totalCount;

      return {
          whales: { count: whales.length, revenue: whaleRevenue, list: whales },
          dolphins: { count: dolphins.length, revenue: dolphinRevenue },
          minnows: { count: minnows.length, revenue: minnowRevenue },
          totalRevenue,
          totalCount,
          avgClv
      };
  }, [customers]);

  // 5. LOCATION & COHORT LOGIC
  const locationStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let validCount = 0;
    customers.forEach(c => {
        let loc = c.location;
        if (loc && loc !== '-') {
            loc = loc.replace('(IP Detected)', '').trim();
            loc = loc.split(',')[0].trim();
            if (loc) { stats[loc] = (stats[loc] || 0) + 1; validCount++; }
        } else { stats['Tidak Terdeteksi'] = (stats['Tidak Terdeteksi'] || 0) + 1; }
    });
    const sorted = Object.entries(stats).map(([name, count]) => ({ name, count, percentage: validCount > 0 ? (count / customers.length) * 100 : 0 })).sort((a, b) => b.count - a.count);
    return { data: sorted, total: customers.length, validLocations: validCount };
  }, [customers]);

  const cohortStats = useMemo(() => {
    const customerCohorts: Record<string, string> = {}; 
    const customerActivity: Record<string, Set<string>> = {}; 
    const getMonthStr = (dateStr: string) => dateStr.slice(0, 7);
    const getMonthDiff = (start: string, current: string) => {
        const d1 = new Date(start + '-01');
        const d2 = new Date(current + '-01');
        return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    };
    transactions.forEach(trx => {
        const phone = trx.customerWhatsapp.replace(/\D/g, '');
        if (!phone) return;
        const trxMonth = getMonthStr(trx.rentalDate);
        if (!customerCohorts[phone]) { customerCohorts[phone] = trxMonth; } else { if (trxMonth < customerCohorts[phone]) { customerCohorts[phone] = trxMonth; } }
        if (!customerActivity[phone]) customerActivity[phone] = new Set();
        customerActivity[phone].add(trxMonth);
    });
    const grid: Record<string, { size: number, retention: Record<number, number> }> = {};
    Object.keys(customerCohorts).forEach(phone => {
        const cohortMonth = customerCohorts[phone];
        if (!grid[cohortMonth]) grid[cohortMonth] = { size: 0, retention: {} };
        grid[cohortMonth].size += 1;
        customerActivity[phone].forEach(activeMonth => {
            const diff = getMonthDiff(cohortMonth, activeMonth);
            if (diff >= 0) { if (!grid[cohortMonth].retention[diff]) grid[cohortMonth].retention[diff] = 0; grid[cohortMonth].retention[diff] += 1; }
        });
    });
    return Object.entries(grid).map(([month, data]) => {
        const retentionArr: number[] = [];
        const maxMonth = Math.max(...Object.keys(data.retention).map(Number), 0);
        for (let i = 0; i <= Math.min(maxMonth, 11); i++) { retentionArr[i] = data.retention[i] || 0; }
        return { cohortMonth: month, totalCustomers: data.size, retentionCounts: retentionArr };
    }).sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth));
  }, [transactions]);

  // Filtering
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.whatsapp.includes(searchTerm) ||
    c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helpers
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

  const getPersonaColor = (persona: string) => {
      switch (persona) {
          case 'Organizer (B2B)': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
          case 'Mapala/Pro': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'Camper Ceria': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

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

  const getCohortCellColor = (percent: number) => {
      if (percent >= 50) return 'bg-green-600 text-white';
      if (percent >= 30) return 'bg-green-400 text-white';
      if (percent >= 15) return 'bg-green-200 text-green-800';
      if (percent >= 5) return 'bg-green-50 text-green-800';
      return 'bg-white text-gray-400';
  };

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
      if (avgM1Retention < 10) return { type: 'danger', title: 'Retensi Awal Rendah (<10%)', desc: 'Banyak pelanggan hilang setelah sewa pertama.' };
      else if (avgM1Retention > 30) return { type: 'success', title: 'Customer Setia (>30%)', desc: 'Retensi bulan ke-1 sangat bagus! Pertahankan.' };
      return { type: 'neutral', title: 'Retensi Normal (10-30%)', desc: 'Performa standar rental.' };
  };

  const cohortInsight = getCohortInsight();

  return (
    <div className="space-y-8 pb-10">
        
      {/* 1. ANALISIS GEOSPASIAL (HEATMAP) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
               Total {locationStats.validLocations} pelanggan terdeteksi lokasinya.
            </div>
         </div>

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

      {/* 2. ANALISIS PSIKOGRAFIS & KOMUNITAS */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-4 md:p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Share2 size={20} className="text-indigo-600"/> Analisis Komunitas
            </h3>
            <p className="text-xs text-gray-500 mt-1">
                Profil komunitas pelanggan Anda berdasarkan pola sewa.
            </p>
         </div>
         
         <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm"><Briefcase size={18}/></div>
                            <span className="text-2xl font-black text-indigo-700">{communityStats.organizer}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-xs md:text-sm">Organizer (B2B)</h5>
                    </div>
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm"><TrendingUp size={18}/></div>
                            <span className="text-2xl font-black text-emerald-700">{communityStats.mapala}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-xs md:text-sm">Mapala / Pro</h5>
                    </div>
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-orange-600 shadow-sm"><Zap size={18}/></div>
                            <span className="text-2xl font-black text-orange-700">{communityStats.camper}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-xs md:text-sm">Camper Ceria</h5>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-slate-600 shadow-sm"><Users size={18}/></div>
                            <span className="text-2xl font-black text-slate-700">{communityStats.student}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-xs md:text-sm">Mahasiswa Hemat</h5>
                    </div>
                </div>
            </div>

            <div className="flex flex-col h-full bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2 relative z-10">
                    <Megaphone size={20} className="text-yellow-400"/> Strategic Actions
                </h4>
                <div className="space-y-4 relative z-10 flex-1">
                    {communityStats.organizer > 2 ? (
                        <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                            <h5 className="font-bold text-yellow-400 text-sm mb-1">🎯 Kemitraan B2B</h5>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                Terdeteksi <strong>{communityStats.organizer} pelanggan tipe Organizer</strong>. Hubungi & tawarkan "Member Card Prioritas".
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                            <h5 className="font-bold text-blue-300 text-sm mb-1">📢 Akuisisi Kampus</h5>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                Data B2B masih rendah. Coba datangi Sekretariat Mapala dan ajukan proposal kerjasama.
                            </p>
                        </div>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* 6. TABEL PELANGGAN (Mobile Card View + Desktop Table) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-nature-50">
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

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden p-4 space-y-4 bg-gray-50">
            {filteredCustomers.length === 0 ? (
                <div className="text-center p-8 text-gray-400 italic">Belum ada data pelanggan yang cocok.</div>
            ) : (
                filteredCustomers.map((cust, idx) => (
                    <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                                    idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
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
                            <button 
                                onClick={() => openWa(cust.whatsapp)}
                                className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition border border-green-200"
                            >
                                <MessageCircle size={18} />
                            </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wider ${getPersonaColor(cust.persona)}`}>
                                {cust.persona}
                            </span>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border uppercase tracking-wider ${getStatusColor(cust.status)}`}>
                                {cust.status}
                            </span>
                            {cust.location !== '-' && (
                                <div className="flex items-center gap-1 text-gray-500 text-[10px] font-medium bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                    <MapPin size={10} /> {cust.location.replace('(IP Detected)', '').split(',')[0]}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm border-t border-gray-100 pt-3">
                            <div>
                                <p className="text-[10px] text-gray-400">Total Sewa</p>
                                <p className="font-bold text-gray-700">{cust.totalRentals}x Transaksi</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400">Total Belanja</p>
                                <p className="font-black text-nature-700">Rp{cust.totalSpent.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                        {cust.lateCount > 0 && (
                            <div className="mt-2 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded text-center">
                                Pernah Terlambat {cust.lateCount}x
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block p-0 overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs border-b border-gray-200">
                <tr>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Domisili</th>
                <th className="px-6 py-4">Persona/Komunitas</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Total Sewa</th>
                <th className="px-6 py-4 text-center">Terlambat</th>
                <th className="px-6 py-4 text-right">Total Belanja (CLV)</th>
                <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {filteredCustomers.length === 0 ? (
                <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
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
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getPersonaColor(cust.persona)}`}>
                        {cust.persona}
                        </span>
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
                    <td className="px-6 py-4 text-center">
                        {cust.lateCount > 0 ? (
                            <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs border border-red-100">
                                {cust.lateCount}x
                            </span>
                        ) : (
                            <span className="text-green-500 font-bold text-xs">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <div className="font-black text-nature-700">Rp{cust.totalSpent.toLocaleString('id-ID')}</div>
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
