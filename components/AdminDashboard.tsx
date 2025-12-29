import React, { useState, useEffect } from 'react';
import { RotateCcw, Lock, LogOut } from 'lucide-react';
import { Product, Category, Transaction } from '../types';
import { getTransactions, updateTransactionStatus, deleteTransaction } from '../services/transactionService';

// Import Modular Components
import AdminSidebar from './AdminSidebar';
import AdminStats from './AdminStats';
import AdminCategoryManager from './AdminCategoryManager';
import AdminProductManager from './AdminProductManager';
import AdminWarehouseManager from './AdminWarehouseManager';
import AdminTransactionManager from './AdminTransactionManager';
import AdminFinanceManager from './AdminFinanceManager';

interface AdminDashboardProps {
  products: Product[];
  categories: Category[];
  onBackToHome: () => void;
  onAddProduct: (product: Product) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, 
  categories,
  onBackToHome,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onRefresh
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'warehouse' | 'categories' | 'transactions' | 'finance'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Transaction State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // Authentication Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Password salah!');
    }
  };

  // Fetch Transactions when tab changes
  useEffect(() => {
    if (isAuthenticated && activeTab === 'transactions') {
      fetchTransactions();
    }
  }, [isAuthenticated, activeTab]);

  const fetchTransactions = async () => {
    setIsLoadingTransactions(true);
    const data = await getTransactions();
    setTransactions(data);
    setIsLoadingTransactions(false);
  };

  const handleTransactionStatusUpdate = async (id: string, newStatus: string) => {
    const success = await updateTransactionStatus(id, newStatus);
    if (success) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: newStatus as any } : t));
      if (newStatus === 'completed' || newStatus === 'cancelled') onRefresh(); 
    } else {
      alert("Gagal update status transaksi.");
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const success = await deleteTransaction(id);
    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      onRefresh();
    } else {
      // Fallback: Inform user about RLS
      const sqlCommand = `create policy "Enable delete for anon" on "public"."transactions" for delete using (true);`;
      const tryCancel = window.confirm(`GAGAL MENGHAPUS (Database Policy).\nUbah ke status 'BATAL' saja? (Stok akan kembali).`);
      
      if (tryCancel) {
        await handleTransactionStatusUpdate(id, 'cancelled');
      } else {
        prompt("Copy SQL ini untuk mengaktifkan delete:", sqlCommand);
      }
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await onRefresh();
    if (activeTab === 'transactions') await fetchTransactions();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // LOCK SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
           <div className="w-20 h-20 bg-nature-100 rounded-full flex items-center justify-center mx-auto mb-6 text-nature-600">
             <Lock size={40} />
           </div>
           <h2 className="text-2xl font-black text-gray-900 mb-2">Admin Area</h2>
           <p className="text-gray-500 mb-6">Area terbatas khusus pasukan Mamas Outdoor.</p>
           
           <form onSubmit={handleLogin} className="space-y-4">
             <input 
               type="password" 
               placeholder="Masukkan Password..." 
               className="w-full px-5 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-nature-500 outline-none transition"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
             />
             <button type="submit" className="w-full py-3 bg-nature-600 hover:bg-nature-700 text-white font-bold rounded-xl shadow-lg transition">
               Buka Pintu
             </button>
           </form>
           
           <button onClick={onBackToHome} className="mt-6 text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center justify-center gap-2 w-full">
             <LogOut size={16} /> Kembali ke Beranda
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab as any} onLogout={onBackToHome} />

      <main className="flex-1 overflow-y-auto max-h-screen">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30">
          <h1 className="text-2xl font-bold text-gray-800 capitalize">
            {activeTab === 'warehouse' ? 'Laporan Inventaris' : 
             activeTab === 'finance' ? 'Keuangan & Kas' : `${activeTab} Overview`}
          </h1>
          <div className="flex items-center gap-4">
             <button onClick={handleRefreshData} disabled={isRefreshing} className="p-2 text-gray-500 hover:text-nature-600 hover:bg-gray-100 rounded-lg transition disabled:animate-spin" title="Refresh Data">
                <RotateCcw size={20} />
             </button>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && <AdminStats products={products} />}
          
          {activeTab === 'categories' && (
             <AdminCategoryManager 
                categories={categories} 
                onAddCategory={onAddCategory} 
                onUpdateCategory={onUpdateCategory} 
                onDeleteCategory={onDeleteCategory} 
             />
          )}

          {activeTab === 'products' && (
             <AdminProductManager 
                products={products} 
                categories={categories} 
                onAddProduct={onAddProduct} 
                onUpdateProduct={onUpdateProduct} 
                onDeleteProduct={onDeleteProduct} 
             />
          )}

          {activeTab === 'warehouse' && (
             <AdminWarehouseManager 
                products={products} 
                categories={categories} 
                onUpdateProduct={onUpdateProduct} 
             />
          )}

          {activeTab === 'transactions' && (
             <AdminTransactionManager 
                transactions={transactions} 
                isLoading={isLoadingTransactions} 
                products={products}
                onStatusUpdate={handleTransactionStatusUpdate}
                onDeleteTransaction={handleDeleteTransaction}
                onRefreshData={fetchTransactions}
             />
          )}

          {activeTab === 'finance' && (
             <AdminFinanceManager />
          )}
        </div>
      </main>
    </div>
  );
};