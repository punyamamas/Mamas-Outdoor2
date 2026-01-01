
import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Search, Package, User, AlertCircle } from 'lucide-react';
import { Product, Transaction } from '../types';

interface AdminCalendarManagerProps {
  products: Product[];
  transactions: Transaction[];
}

const AdminCalendarManager: React.FC<AdminCalendarManagerProps> = ({ products, transactions }) => {
  // State: Tanggal Mulai View (Default: Hari ini)
  const [startDate, setStartDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [viewDays, setViewDays] = useState(14); // Default lihat 2 minggu ke depan

  // --- HELPER FUNCTIONS ---
  const getDates = (start: Date, days: number) => {
    const dates = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  };

  const shiftDate = (days: number) => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + days);
    setStartDate(newDate);
  };

  // --- DATA PROCESSING ---
  const dateRange = useMemo(() => getDates(startDate, viewDays), [startDate, viewDays]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Proses Data untuk Gantt Chart
  // Output: Map<ProductId, Map<DateString, { booked: number, transactions: Array<{name, qty, status}> }>>
  const allocationMap = useMemo(() => {
    const map: Record<string, Record<string, { booked: number, details: any[] }>> = {};

    transactions.forEach(trx => {
      if (trx.status === 'cancelled' || trx.status === 'completed') return;

      const start = new Date(trx.rentalDate);
      const end = new Date(trx.rentalDate);
      end.setDate(end.getDate() + (trx.duration - 1)); // -1 karena duration include hari pertama

      // Loop setiap hari dalam durasi sewa
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        
        trx.items.forEach(item => {
          if (!map[item.id]) map[item.id] = {};
          if (!map[item.id][dateStr]) map[item.id][dateStr] = { booked: 0, details: [] };

          map[item.id][dateStr].booked += item.quantity;
          map[item.id][dateStr].details.push({
            customer: trx.customerName,
            qty: item.quantity,
            status: trx.status,
            id: trx.id
          });
        });
      }
    });
    return map;
  }, [transactions]);

  // --- RENDER ---
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-150px)]">
      
      {/* Header Controls */}
      <div className="p-5 border-b border-gray-100 bg-nature-50 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <Calendar size={20} /> Kalender Ketersediaan (Gantt Chart)
          </h3>
          <p className="text-xs text-nature-600 mt-1">
            Visualisasi jadwal sewa untuk mencegah bentrok jadwal.
          </p>
        </div>

        <div className="flex items-center gap-3">
           {/* Navigation */}
           <div className="flex items-center bg-white rounded-lg border border-nature-200 shadow-sm p-1">
              <button onClick={() => shiftDate(-7)} className="p-2 hover:bg-gray-100 rounded-md text-gray-600"><ChevronLeft size={18}/></button>
              <button onClick={() => setStartDate(new Date())} className="px-3 py-1 text-xs font-bold text-nature-700 hover:bg-nature-50 rounded-md">Hari Ini</button>
              <button onClick={() => shiftDate(7)} className="p-2 hover:bg-gray-100 rounded-md text-gray-600"><ChevronRight size={18}/></button>
           </div>

           {/* Search */}
           <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari Alat..." 
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
        </div>
      </div>

      {/* GANTT CHART CONTAINER */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        <table className="w-full border-collapse">
          {/* Table Head (Sticky Dates) */}
          <thead className="bg-white sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="p-4 text-left min-w-[200px] w-[250px] bg-gray-50 border-b border-r border-gray-200 sticky left-0 z-30">
                Alat Outdoor
              </th>
              {dateRange.map((date, i) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = isSameDay(date, new Date());
                return (
                  <th key={i} className={`p-2 text-center min-w-[100px] border-b border-gray-100 ${isWeekend ? 'bg-orange-50' : 'bg-white'} ${isToday ? 'bg-nature-100 border-nature-200' : ''}`}>
                    <div className="text-[10px] text-gray-500 uppercase font-bold">{date.toLocaleDateString('id-ID', { weekday: 'short' })}</div>
                    <div className={`text-sm font-black ${isToday ? 'text-nature-700' : 'text-gray-800'}`}>
                      {date.getDate()} {date.toLocaleDateString('id-ID', { month: 'short' })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map(product => {
              const rowData = allocationMap[product.id] || {};
              const stockTotal = product.stock;

              return (
                <tr key={product.id} className="hover:bg-gray-50 transition">
                  {/* Product Column (Sticky Left) */}
                  <td className="p-4 bg-white border-r border-gray-200 sticky left-0 z-10">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                          <img src={product.image} alt="" className="w-full h-full object-cover" />
                       </div>
                       <div>
                          <div className="font-bold text-sm text-gray-800 line-clamp-1">{product.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold border border-gray-200">
                                Stok: {stockTotal}
                             </span>
                             <span className="text-[10px] text-gray-400">{product.category}</span>
                          </div>
                       </div>
                    </div>
                  </td>

                  {/* Date Cells */}
                  {dateRange.map((date, i) => {
                    const dateStr = formatDate(date);
                    const dayData = rowData[dateStr];
                    const bookedQty = dayData ? dayData.booked : 0;
                    const remaining = stockTotal - bookedQty;
                    
                    // Logic Warna Sel
                    let cellBg = 'bg-white';
                    if (remaining === 0) cellBg = 'bg-red-50'; // Habis
                    else if (remaining < 0) cellBg = 'bg-red-200'; // Overbooked! (Bahaya)
                    else if (remaining <= 2) cellBg = 'bg-yellow-50'; // Menipis

                    return (
                      <td key={i} className={`p-1 border-r border-b border-gray-100 relative h-24 align-top ${cellBg}`}>
                        
                        {/* Indikator Stok Sisa (Kecil di pojok) */}
                        <div className="absolute top-1 right-1 text-[9px] font-mono text-gray-300">
                           {remaining}/{stockTotal}
                        </div>

                        {/* Bars Transaksi */}
                        <div className="flex flex-col gap-1 mt-3">
                           {dayData && dayData.details.map((detail: any, idx: number) => (
                              <div 
                                key={idx} 
                                className={`
                                  text-[9px] px-1.5 py-1 rounded border shadow-sm truncate cursor-help group relative
                                  ${detail.status === 'booked' ? 'bg-blue-100 border-blue-200 text-blue-800' : 
                                    detail.status === 'rented' ? 'bg-purple-100 border-purple-200 text-purple-800' :
                                    detail.status === 'pending' ? 'bg-orange-100 border-orange-200 text-orange-800' :
                                    'bg-gray-100 text-gray-600'}
                                `}
                              >
                                 <span className="font-bold">{detail.customer.split(' ')[0]}</span> ({detail.qty})
                                 
                                 {/* Tooltip on Hover */}
                                 <div className="opacity-0 group-hover:opacity-100 absolute left-0 bottom-full mb-1 w-max bg-gray-900 text-white text-[10px] p-2 rounded z-50 pointer-events-none transition-opacity">
                                    <div className="font-bold">{detail.customer}</div>
                                    <div>Status: {detail.status}</div>
                                    <div>Sewa: {detail.qty} Unit</div>
                                 </div>
                              </div>
                           ))}
                           
                           {/* Overbooking Alert */}
                           {remaining < 0 && (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 px-1 rounded animate-pulse">
                                 <AlertCircle size={10}/> Over -{Math.abs(remaining)}
                              </div>
                           )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Legend Footer */}
      <div className="p-4 bg-white border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div> Booking (Lunas)</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div> Sedang Sewa</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-orange-100 border border-orange-200 rounded"></div> Pending (Belum Lunas)</div>
         <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-50 border border-red-100 rounded"></div> Stok Habis</div>
      </div>
    </div>
  );
};

export default AdminCalendarManager;
