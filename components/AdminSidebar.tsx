
import React, { useState } from 'react';
import { LayoutDashboard, ClipboardList, Warehouse, Package, Tags, LogOut, DollarSign, PieChart, Users, Settings, MessageSquare, Calendar, Menu, X } from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: 'dashboard' | 'products' | 'warehouse' | 'categories' | 'transactions' | 'finance' | 'reports' | 'customers' | 'system' | 'reviews' | 'calendar') => void;
  onLogout: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabClick = (tab: any) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false); // Tutup menu otomatis setelah klik di mobile
  };

  return (
    <>
      {/* Mobile Header Toggle */}
      <div className="md:hidden bg-nature-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md">
         <h2 className="text-lg font-bold tracking-tight">Mamas<span className="text-nature-400">Admin</span></h2>
         <button 
           onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
           className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition"
         >
            {isMobileMenuOpen ? <X size={24}/> : <Menu size={24}/>}
         </button>
      </div>

      {/* Sidebar Container */}
      <aside className={`
        bg-nature-900 text-white flex-shrink-0 flex flex-col 
        md:w-64 md:h-auto md:static
        fixed inset-0 z-40 pt-16 md:pt-0 transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-white/10 hidden md:block">
          <h2 className="text-xl font-bold tracking-tight">Mamas<span className="text-nature-400">Admin</span></h2>
        </div>
        
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          <button 
            onClick={() => handleTabClick('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            onClick={() => handleTabClick('calendar')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'calendar' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <Calendar size={20} /> Kalender Sewa
          </button>
          <button 
            onClick={() => handleTabClick('transactions')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'transactions' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <ClipboardList size={20} /> Transaksi
          </button>
          <button 
            onClick={() => handleTabClick('customers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'customers' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <Users size={20} /> Pelanggan
          </button>
          <button 
            onClick={() => handleTabClick('finance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'finance' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <DollarSign size={20} /> Keuangan
          </button>
          <button 
            onClick={() => handleTabClick('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'reports' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <PieChart size={20} /> Laporan
          </button>
          <button 
            onClick={() => handleTabClick('reviews')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'reviews' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <MessageSquare size={20} /> Ulasan
          </button>
          <button 
            onClick={() => handleTabClick('warehouse')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'warehouse' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <Warehouse size={20} /> Gudang
          </button>
          <button 
            onClick={() => handleTabClick('products')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'products' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <Package size={20} /> Produk
          </button>
          <button 
            onClick={() => handleTabClick('categories')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'categories' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <Tags size={20} /> Kategori
          </button>
          <div className="pt-4 border-t border-white/10 mt-4">
            <button 
              onClick={() => handleTabClick('system')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'system' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
            >
              <Settings size={20} /> System Setup
            </button>
          </div>
        </nav>
        
        <div className="p-4 mt-auto border-t border-white/10">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-nature-200 hover:bg-white/5 transition"
          >
            <LogOut size={20} /> Keluar
          </button>
        </div>
      </aside>
      
      {/* Overlay for mobile when menu is open */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </>
  );
};

export default AdminSidebar;
