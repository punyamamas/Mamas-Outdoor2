
import React, { useState, useEffect } from 'react';
import { RotateCcw, Lock, LogOut, Mail, Key } from 'lucide-react';
import { Product, Category, Transaction } from '../types';
import { getTransactions, updateTransactionStatus, deleteTransaction } from '../services/transactionService';
import { signIn, signOut, getCurrentUser } from '../services/authService';

// Import Modular Components
import AdminSidebar from './AdminSidebar';
import AdminStats from './AdminStats';
import AdminCategoryManager from './AdminCategoryManager';
import AdminProductManager from './AdminProductManager';
import AdminWarehouseManager from './AdminWarehouseManager';
import AdminTransactionManager from './AdminTransactionManager';
import AdminFinanceManager from './AdminFinanceManager';
import AdminReportManager from './AdminReportManager';
import AdminCustomerManager from './AdminCustomerManager';
import AdminSystemSetup from './AdminSystemSetup';
import AdminReviewManager from './AdminReviewManager';
import AdminCalendarManager from './AdminCalendarManager'; // Import Baru

interface AdminDashboardProps {
  products: Product[];
  categories: Category[];
  transactions: Transaction[]; // NEW PROP
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
  transactions: propTransactions, // Rename prop to avoid conflict
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Update Type State Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'warehouse' | 'categories' | 'transactions' | 'finance' | 'reports' | 'customers' | 'system' | 'reviews' | 'calendar'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Transaction State (Use prop if available, otherwise fallback to local)
  const [transactions, setTransactions] = useState<Transaction[]>(propTransactions);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // Sync prop changes to local state
  useEffect(() => {
    setTransactions(propTransactions);
  }, [propTransactions]);

  // Check Session on Mount
  useEffect(() => {
    const checkSession = async () => {
      const user = await getCurrentUser();
      if (user) {
        setIsAuthenticated(true);
      }
      setIsAuthChecking(false);
    };
    checkSession();
  }, []);

  // Authentication Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setLoginError(error.message === 'Invalid login credentials' ? 'Email atau Password salah.' : error.message);
      } else {
        setIsAuthenticated(true);
      }
    } catch (err) {
      setLoginError('Terjadi kesalahan koneksi.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    onBackToHome();
  };

  // Fetch Transactions when tab changes (Legacy: kept for manual refresh behavior)
  useEffect(() => {
    if (isAuthenticated && (activeTab === 'transactions' || activeTab === 'customers' || activeTab === 'reports' || activeTab === 'calendar')) {
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
    await fetchTransactions(); // Force fresh fetch
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // LOCK SCREEN
  if (!isAuthenticated) {
    if (isAuthChecking) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nature-600"></div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
           <div className="w-20 h-20 bg-nature-100 rounded-full flex items-center justify-center mx-auto mb-6 text-nature-600">
             <Lock size={40} />
           </div>
           <h2 className="text-2xl font-black text-gray-900 mb-2">Admin Portal</h2>
           <p className="text-gray-500 mb-6 text-sm">Silakan login menggunakan akun terdaftar.</p>
           
           <form onSubmit={handleLogin} className="space-y-4 text-left">
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-gray-400" size={18}/>
                  <input 
                    type="email" 
                    placeholder="admin@mamas.com" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-nature-500 outline-none transition"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
             </div>
             
             <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">Password</label>
                <div className="relative">
                  <Key className="absolute left-3 top-3 text-gray-400" size={18}/>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-nature-500 outline-none transition"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
             </div>

             {loginError && (
                <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-100 font-medium">
                   {loginError}
                </div>
             )}

             <button 
               type="submit" 
               disabled={isLoggingIn}
               className="w-full py-3 bg-nature-600 hover:bg-nature-700 text-white font-bold rounded-xl shadow-lg transition disabled:opacity-70 flex justify-center items-center gap-2"
             >
               {isLoggingIn ? 'Memproses...' : 'Masuk Dashboard'}
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
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab as any} onLogout={handleLogout} />

      <main className="flex-1 overflow-y-auto max-h-screen">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30">
          <h1 className="text-2xl font-bold text-gray-800 capitalize">
            {activeTab === 'warehouse' ? 'Laporan Inventaris' : 
             activeTab === 'finance' ? 'Keuangan & Kas' : 
             activeTab === 'reports' ? 'Analisis Bisnis' : 
             activeTab === 'customers' ? 'Database Pelanggan' :
             activeTab === 'reviews' ? 'Moderasi Ulasan' :
             activeTab === 'calendar' ? 'Kalender Ketersediaan' :
             activeTab === 'system' ? 'System Configuration' :
             `${activeTab} Overview`}
          </h1>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Admin Session Active
             </div>
             <button onClick={handleRefreshData} disabled={isRefreshing} className="p-2 text-gray-500 hover:text-nature-600 hover:bg-gray-100 rounded-lg transition disabled:animate-spin" title="Refresh Data">
                <RotateCcw size={20} />
             </button>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && <AdminStats products={products} transactions={transactions} />}
          
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

          {activeTab === 'calendar' && (
             <AdminCalendarManager 
                products={products}
                transactions={transactions}
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

          {activeTab === 'customers' && (
             <AdminCustomerManager 
                transactions={transactions} 
             />
          )}

          {activeTab === 'finance' && (
             <AdminFinanceManager />
          )}

          {activeTab === 'reports' && (
             <AdminReportManager />
          )}

          {activeTab === 'reviews' && (
             <AdminReviewManager />
          )}

          {activeTab === 'system' && (
             <AdminSystemSetup />
          )}
        </div>
      </main>
    </div>
  );
};
