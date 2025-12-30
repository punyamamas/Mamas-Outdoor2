import React, { useState, useMemo } from 'react';
import { Users, Search, MessageCircle, TrendingUp, History, Star, ArrowUpRight, Crown, MapPin } from 'lucide-react';
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
      
      // Update Location jika tersedia di transaksi terbaru
      if (trx.customerLocation && trx.customerLocation !== '-') {
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-nature-50">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <Users size={20} /> Data Pelanggan
          </h3>
          <p className="text-xs text-nature-600 mt-1">
            Total {customers.length} pelanggan unik dari riwayat transaksi
          </p>
        </div>
        
        <div className="relative w-full md:w-64">
           <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
           <input 
             type="text" 
             placeholder="Cari Nama / WA..." 
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
              <th className="px-6 py-4">Domisili (IP)</th>
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
                     <div className="flex items-center gap-1 text-gray-600 text-xs">
                        <MapPin size={12} className="text-nature-500" />
                        {cust.location}
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
  );
};

export default AdminCustomerManager;