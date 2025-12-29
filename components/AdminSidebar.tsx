import React from 'react';
import { LayoutDashboard, ClipboardList, Warehouse, Package, Tags, LogOut, DollarSign, PieChart } from 'lucide-react';

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: 'dashboard' | 'products' | 'warehouse' | 'categories' | 'transactions' | 'finance' | 'reports') => void;
  onLogout: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <aside className="w-full md:w-64 bg-nature-900 text-white flex-shrink-0 flex flex-col h-full min-h-screen md:h-auto">
      <div className="p-6 border-b border-white/10">
        <h2 className="text-xl font-bold tracking-tight">Mamas<span className="text-nature-400">Admin</span></h2>
      </div>
      <nav className="p-4 space-y-2 flex-1">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <LayoutDashboard size={20} /> Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('transactions')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'transactions' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <ClipboardList size={20} /> Transaksi
        </button>
        <button 
          onClick={() => setActiveTab('finance')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'finance' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <DollarSign size={20} /> Keuangan
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'reports' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <PieChart size={20} /> Laporan
        </button>
        <button 
          onClick={() => setActiveTab('warehouse')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'warehouse' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <Warehouse size={20} /> Gudang
        </button>
        <button 
          onClick={() => setActiveTab('products')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'products' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <Package size={20} /> Produk
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'categories' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
        >
          <Tags size={20} /> Kategori
        </button>
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
  );
};

export default AdminSidebar;