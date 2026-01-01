
import React, { useMemo } from 'react';
import { Package, Database, AlertCircle, ShoppingBag, ArrowRightLeft, Clock, CalendarCheck } from 'lucide-react';
import { Product, Transaction } from '../types';

interface AdminStatsProps {
  products: Product[];
  transactions: Transaction[]; // New Prop
}

const AdminStats: React.FC<AdminStatsProps> = ({ products, transactions }) => {
  const totalAvailable = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter(p => p.stock <= 3).length;

  // --- OPERATIONAL AGENDA LOGIC ---
  const today = new Date().toISOString().split('T')[0];

  const agenda = useMemo(() => {
    let pickups = 0;
    let returns = 0;
    let overdue = 0;
    let income = 0;

    transactions.forEach(trx => {
        // 1. Pickups (Booking -> Rented Today)
        if (trx.status === 'booked' && trx.rentalDate === today) {
            pickups++;
        }

        // 2. Calculate Return Date
        const returnDate = new Date(trx.rentalDate);
        returnDate.setDate(returnDate.getDate() + (trx.duration - 1));
        const returnDateStr = returnDate.toISOString().split('T')[0];

        // 3. Returns (Rented -> Completed Today)
        if (trx.status === 'rented' && returnDateStr === today) {
            returns++;
        }

        // 4. Overdue (Rented -> Late)
        if (trx.status === 'rented' && returnDateStr < today) {
            overdue++;
        }
        
        // 5. Today's Transactions Income (Simulasi, idealnya dari PaymentLog)
        if (trx.rentalDate === today) {
            income += (trx.amountPaid || 0);
        }
    });

    return { pickups, returns, overdue, income };
  }, [transactions, today]);

  return (
    <div className="space-y-8 animate-slide-in-right">
        {/* SECTION 1: AGENDA HARI INI (OPERATIONAL DASHBOARD) */}
        <div>
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                <CalendarCheck size={20} className="text-nature-600" /> Agenda Hari Ini ({new Date().toLocaleDateString('id-ID', {weekday: 'long', day:'numeric', month:'long'})})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* CARD 1: BARANG KELUAR (PICKUP) */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between hover:shadow-md transition cursor-pointer">
                    <div>
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Jadwal Ambil</p>
                        <h4 className="text-3xl font-black text-blue-900">{agenda.pickups}</h4>
                        <p className="text-xs text-blue-700 mt-1">Transaksi 'Booked' hari ini</p>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm">
                        <ShoppingBag size={24} />
                    </div>
                </div>

                {/* CARD 2: BARANG MASUK (RETURN) */}
                <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 flex items-center justify-between hover:shadow-md transition cursor-pointer">
                    <div>
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Jadwal Kembali</p>
                        <h4 className="text-3xl font-black text-purple-900">{agenda.returns}</h4>
                        <p className="text-xs text-purple-700 mt-1">Deadline sewa hari ini</p>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-purple-500 shadow-sm">
                        <ArrowRightLeft size={24} />
                    </div>
                </div>

                {/* CARD 3: TERLAMBAT (OVERDUE) */}
                <div className={`${agenda.overdue > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} p-6 rounded-2xl border flex items-center justify-between hover:shadow-md transition cursor-pointer`}>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${agenda.overdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {agenda.overdue > 0 ? 'Telat Kembali' : 'Status Aman'}
                        </p>
                        <h4 className={`text-3xl font-black ${agenda.overdue > 0 ? 'text-red-900' : 'text-green-900'}`}>{agenda.overdue}</h4>
                        <p className={`text-xs mt-1 ${agenda.overdue > 0 ? 'text-red-700 font-bold' : 'text-green-700'}`}>
                            {agenda.overdue > 0 ? 'Perlu ditagih denda!' : 'Tidak ada keterlambatan'}
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                        {agenda.overdue > 0 ? <Clock size={24} className="text-red-500" /> : <Clock size={24} className="text-green-500" />}
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 2: STATISTIK GUDANG (EXISTING) */}
        <div>
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                <Database size={20} className="text-gray-500" /> Ringkasan Inventaris
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-50 text-gray-600 rounded-xl">
                        <Package size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Jenis Produk</p>
                        <h3 className="text-2xl font-bold text-gray-900">{products.length} SKU</h3>
                    </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                        <Database size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Total Stok Unit</p>
                        <h3 className="text-2xl font-bold text-gray-900">{totalAvailable} Unit</h3>
                    </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Stok Menipis</p>
                        <h3 className="text-2xl font-bold text-gray-900">{lowStockCount} Item</h3>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AdminStats;
