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
          persona: 'Mahasiswa Hemat' 
        };
      }

      const customer = customerMap[phoneKey];
      
      customer.totalRentals += 1;
      customer.totalSpent += trx.totalPrice;
      
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

  // 2. MARKET BASKET ANALYSIS LOGIC (New Feature)
  const basketAnalysis = useMemo(() => {
      const pairCounts: Record<string, number> = {};
      const itemCounts: Record<string, number> = {};
      let totalTrx = 0;

      transactions.forEach(t => {
          if(t.status === 'cancelled') return;
          totalTrx++;
          // Get unique item names in this transaction (avoid self-pairing)
          // Simple cleaning: remove extra spaces
          const uniqueItems = Array.from(new Set(t.items.map(i => i.name.trim())));

          // Count Individual Items
          uniqueItems.forEach(item => {
              itemCounts[item] = (itemCounts[item] || 0) + 1;
          });

          // Count Pairs
          for (let i = 0; i < uniqueItems.length; i++) {
              for (let j = i + 1; j < uniqueItems.length; j++) {
                  // Sort alphabetically to ensure A|B is same as B|A
                  const pair = [uniqueItems[i], uniqueItems[j]].sort();
                  const key = pair.join('|');
                  pairCounts[key] = (pairCounts[key] || 0) + 1;
              }
          }
      });

      // Process Results
      const topPairs = Object.entries(pairCounts)
          .map(([key, count]) => {
              const [itemA, itemB] = key.split('|');
              
              // Confidence Calculation: P(B|A)
              // Likelihood of buying B if A is bought
              const confAtoB = itemCounts[itemA] ? (count / itemCounts[itemA]) * 100 : 0;
              const confBtoA = itemCounts[itemB] ? (count / itemCounts[itemB]) * 100 : 0;

              // Determine Driver (Trigger) vs Follower
              // The Item with HIGHER individual count is usually the "Anchor", 
              // but higher confidence tells us the direction of strong association.
              // Let's assume Driver is the one that implies the other most strongly.
              
              const isStrongerAtoB = confAtoB >= confBtoA;

              return {
                  driver: isStrongerAtoB ? itemA : itemB,
                  follower: isStrongerAtoB ? itemB : itemA,
                  count,
                  confidence: isStrongerAtoB ? confAtoB : confBtoA
              };
          })
          .filter(p => p.count > 1) // Filter out single coincidences
          .sort((a, b) => b.count - a.count) // Sort by frequency first
          .slice(0, 6); // Top 6

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

  // 5. LOCATION & COHORT LOGIC (Existing)
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
    <div className="space-y-8">
        
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
         <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Share2 size={20} className="text-indigo-600"/> Analisis Jejaring Sosial & Komunitas
            </h3>
            <p className="text-xs text-gray-500 mt-1">
                Profil komunitas pelanggan Anda berdasarkan pola sewa (Behavioral Profiling). Gunakan ini untuk strategi kemitraan B2B.
            </p>
         </div>
         
         <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-indigo-600 shadow-sm"><Briefcase size={18}/></div>
                            <span className="text-2xl font-black text-indigo-700">{communityStats.organizer}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-sm">Organizer / B2B</h5>
                        <p className="text-[10px] text-gray-500 leading-tight mt-1">Belanja besar (&gt;300rb/sewa). Potensi kerjasama tetap.</p>
                    </div>
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm"><TrendingUp size={18}/></div>
                            <span className="text-2xl font-black text-emerald-700">{communityStats.mapala}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-sm">Mapala / Pro</h5>
                        <p className="text-[10px] text-gray-500 leading-tight mt-1">Sewa alat teknis. Influencer komunitas.</p>
                    </div>
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-orange-600 shadow-sm"><Zap size={18}/></div>
                            <span className="text-2xl font-black text-orange-700">{communityStats.camper}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-sm">Camper Ceria</h5>
                        <p className="text-[10px] text-gray-500 leading-tight mt-1">Wisata keluarga/pemula. Alat nyaman & mudah.</p>
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-white rounded-lg text-slate-600 shadow-sm"><Users size={18}/></div>
                            <span className="text-2xl font-black text-slate-700">{communityStats.student}</span>
                        </div>
                        <h5 className="font-bold text-gray-800 text-sm">Mahasiswa Hemat</h5>
                        <p className="text-[10px] text-gray-500 leading-tight mt-1">Sensitif harga. Butuh paket promo.</p>
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
                            <h5 className="font-bold text-yellow-400 text-sm mb-1">🎯 Kemitraan B2B (High Priority)</h5>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                Terdeteksi <strong>{communityStats.organizer} pelanggan tipe Organizer</strong>. Hubungi & tawarkan "Member Card Prioritas".
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                            <h5 className="font-bold text-blue-300 text-sm mb-1">📢 Akuisisi Komunitas Kampus</h5>
                            <p className="text-xs text-gray-300 leading-relaxed">
                                Data B2B masih rendah. Coba datangi Sekretariat Mapala dan ajukan proposal kerjasama.
                            </p>
                        </div>
                    )}
                </div>
            </div>
         </div>
      </div>

      {/* 3. MARKET BASKET ANALYSIS (NEW FEATURE) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 bg-nature-50">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <GitMerge size={20} className="text-nature-600"/> Analisis Keranjang Belanja (Market Basket)
            </h3>
            <p className="text-xs text-nature-700 mt-1">
                Menemukan pola kombinasi barang yang sering disewa bersamaan. Gunakan data ini untuk <strong>Bundling Paket</strong> & <strong>Optimasi Gudang</strong>.
            </p>
         </div>

         <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* List Pasangan Produk */}
            <div>
               <h4 className="font-bold text-sm text-gray-500 uppercase tracking-widest mb-4">Pola Kombinasi Tertinggi</h4>
               <div className="space-y-3">
                  {basketAnalysis.length === 0 ? (
                     <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-400 italic text-sm border border-dashed border-gray-200">
                        Belum cukup data transaksi untuk menemukan pola.
                     </div>
                  ) : (
                     basketAnalysis.map((pair, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition group">
                           <div className="flex items-center gap-3 flex-1">
                              <div className="flex flex-col items-end min-w-[30%] text-right">
                                 <span className="font-bold text-gray-800 text-xs md:text-sm">{pair.driver}</span>
                                 <span className="text-[9px] bg-nature-100 text-nature-700 px-1.5 rounded font-bold mt-0.5">Pemicu</span>
                              </div>
                              <div className="flex flex-col items-center px-2">
                                 <ArrowUpRight size={16} className="text-gray-400 group-hover:text-nature-500 transition"/>
                              </div>
                              <div className="flex flex-col items-start min-w-[30%]">
                                 <span className="font-bold text-gray-800 text-xs md:text-sm">{pair.follower}</span>
                                 <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 rounded font-bold mt-0.5">Ikutan</span>
                              </div>
                           </div>
                           <div className="pl-4 border-l border-gray-100 text-center min-w-[80px]">
                              <span className="block text-lg font-black text-nature-700">{Math.round(pair.confidence)}%</span>
                              <span className="text-[9px] text-gray-400 uppercase font-bold">Peluang</span>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>

            {/* Actionable Insight Box */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 flex flex-col h-full">
               <h4 className="font-bold text-sm text-gray-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Megaphone size={16} className="text-orange-500"/> Rekomendasi Bisnis
               </h4>
               
               <div className="space-y-4 flex-1">
                  <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                     <div className="flex items-start gap-3">
                        <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><PackagePlus size={20}/></div>
                        <div>
                           <h5 className="font-bold text-blue-800 text-sm mb-1">Ide Paket Bundling Baru</h5>
                           <p className="text-xs text-gray-600 leading-relaxed">
                              {basketAnalysis.length > 0 
                                ? `Data menunjukkan pelanggan yang menyewa "${basketAnalysis[0].driver}" hampir pasti menyewa "${basketAnalysis[0].follower}". Buatlah paket bundling mereka berdua dengan diskon 5% untuk meningkatkan nilai transaksi.`
                                : "Tunggu data transaksi lebih banyak untuk melihat pola bundling yang potensial."}
                           </p>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                     <div className="flex items-start gap-3">
                        <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Warehouse size={20}/></div>
                        <div>
                           <h5 className="font-bold text-orange-800 text-sm mb-1">Optimasi Tata Letak Gudang</h5>
                           <p className="text-xs text-gray-600 leading-relaxed">
                              {basketAnalysis.length > 0 
                                ? `Simpan rak "${basketAnalysis[0].follower}" bersebelahan dengan "${basketAnalysis[0].driver}". Ini akan mempercepat proses pengambilan barang oleh karyawan saat packing.`
                                : "Pantau terus pola ini untuk mengatur ulang posisi rak di gudang agar efisien."}
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* 4. ANALISIS CLV (CUSTOMER LIFETIME VALUE) */}
      {clvStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Crown size={20} className="text-yellow-500" /> Analisis CLV (Nilai Pelanggan)
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Rata-rata uang yang dihabiskan 1 pelanggan: <span className="font-bold text-nature-700">Rp{clvStats.avgClv.toLocaleString('id-ID', {maximumFractionDigits:0})}</span>
                        </p>
                    </div>
                    <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                        <Award className="text-yellow-600" size={24}/>
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    <div className="relative p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-yellow-800 flex items-center gap-2"><Crown size={14} fill="currentColor"/> Sultan Outdoor (Top 20%)</span>
                            <span className="text-xs font-bold text-yellow-700 bg-white px-2 py-1 rounded-full shadow-sm">{clvStats.whales.count} Org</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] text-yellow-700 uppercase tracking-wide">Kontribusi Omset</p>
                                <p className="text-xl font-black text-yellow-900">Rp{clvStats.whales.revenue.toLocaleString('id-ID')}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-yellow-800">{Math.round((clvStats.whales.revenue / clvStats.totalRevenue) * 100)}%</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* ... Dolphins & Minnows blocks omitted for brevity but preserved in output ... */}
                    <div className="relative p-4 rounded-xl bg-blue-50 border border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-blue-800 flex items-center gap-2"><Star size={14} className="text-blue-500"/> Juragan (Middle 30%)</span>
                            <span className="text-xs font-bold text-blue-700 bg-white px-2 py-1 rounded-full shadow-sm">{clvStats.dolphins.count} Org</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xl font-black text-blue-900">Rp{clvStats.dolphins.revenue.toLocaleString('id-ID')}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-blue-800">{Math.round((clvStats.dolphins.revenue / clvStats.totalRevenue) * 100)}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative p-4 rounded-xl bg-gray-50 border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-700 flex items-center gap-2"><Users size={14} className="text-gray-400"/> Pendaki Hemat (Bottom 50%)</span>
                            <span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded-full border">{clvStats.minnows.count} Org</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-lg font-black text-gray-800">Rp{clvStats.minnows.revenue.toLocaleString('id-ID')}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-base font-bold text-gray-600">{Math.round((clvStats.minnows.revenue / clvStats.totalRevenue) * 100)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <Gift size={20} className="text-red-500" /> Action: Personal Touch
                </h3>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                    Pelanggan "Sultan" adalah aset terbesar. Jaga hubungan personal dengan mereka. 
                    Kirim pesan WA manual berisi ucapan terima kasih atau diskon eksklusif.
                </p>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                    {clvStats.whales.list.slice(0, 5).map((whale, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-yellow-100 bg-yellow-50/50 hover:bg-yellow-50 transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold border border-yellow-200">
                                    #{idx+1}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 text-sm">{whale.name}</p>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold">Total: Rp{whale.totalSpent.toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => openWa(whale.whatsapp)}
                                className="p-2 bg-white text-green-600 rounded-lg shadow-sm border border-green-100 hover:bg-green-50 transition text-xs font-bold flex items-center gap-1"
                            >
                                <MessageCircle size={14} /> Sapa
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* 5. ANALISIS KOHORT (RETENTION) */}
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

      {/* 6. TABEL PELANGGAN (EXISTING) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
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
                <th className="px-6 py-4">Persona/Komunitas</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Total Sewa</th>
                <th className="px-6 py-4 text-right">Total Belanja (CLV)</th>
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