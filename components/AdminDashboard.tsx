import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, LogOut, Plus, Search, 
  Edit, Trash2, Save, X, Image as ImageIcon,
  AlertTriangle, DollarSign, Loader2, RotateCcw,
  Database, Wifi, WifiOff, Tags, CheckSquare, Layers, Scissors
} from 'lucide-react';
import { Product, Category, PackageItem } from '../types';
import { supabase } from '../services/supabase';

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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'categories'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Connection Status State
  const [isConnected, setIsConnected] = useState(false);
  
  // Modal State for Products
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form State for Products
  const [productFormData, setProductFormData] = useState<Partial<Product>>({
    name: '',
    category: '', 
    price2Days: 0,
    price3Days: 0,
    price4Days: 0,
    price5Days: 0,
    price6Days: 0,
    price7Days: 0,
    stock: 0,
    description: '',
    image: '',
    packageItems: [],
    sizes: {}
  });

  // State for Categories Management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

  useEffect(() => {
    setIsConnected(!!supabase);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Password salah!');
    }
  };

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        ...product,
        packageItems: product.packageItems || [],
        sizes: product.sizes || {}
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        id: Date.now().toString(),
        name: '',
        category: categories.length > 0 ? categories[0].name : 'Tenda', 
        price2Days: 0,
        price3Days: 0,
        price4Days: 0,
        price5Days: 0,
        price6Days: 0,
        price7Days: 0,
        stock: 0,
        description: '',
        image: 'https://picsum.photos/400/300',
        packageItems: [],
        sizes: {}
      });
    }
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await onUpdateProduct(productFormData as Product);
      } else {
        await onAddProduct(productFormData as Product);
      }
      setIsProductModalOpen(false);
    } catch (error) {
      console.error("Error submitting form", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper untuk Package Items
  const addPackageItem = () => {
    setProductFormData(prev => ({
      ...prev,
      packageItems: [...(prev.packageItems || []), { productId: products[0]?.id || '', quantity: 1 }]
    }));
  };

  const removePackageItem = (index: number) => {
    setProductFormData(prev => ({
      ...prev,
      packageItems: (prev.packageItems || []).filter((_, i) => i !== index)
    }));
  };

  const updatePackageItem = (index: number, field: keyof PackageItem, value: any) => {
    setProductFormData(prev => {
      const newItems = [...(prev.packageItems || [])];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, packageItems: newItems };
    });
  };

  // Helper untuk Size Management
  const updateSizeStock = (size: string, count: number) => {
    setProductFormData(prev => {
      const newSizes: Record<string, number> = { ...(prev.sizes || {}) };
      if (count > 0) {
        newSizes[size] = count;
      } else {
        delete newSizes[size];
      }
      
      // Hitung total stok otomatis
      const totalStock = Object.values(newSizes).reduce((a: number, b: number) => a + b, 0);

      return { 
        ...prev, 
        sizes: newSizes,
        stock: totalStock > 0 ? totalStock : (prev.stock || 0) // Update main stock if sizes exist
      };
    });
  };

  const handleCategoryAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSubmitting(true);
    await onAddCategory(newCategoryName);
    setNewCategoryName('');
    setIsSubmitting(false);
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
  };

  const saveEditCategory = async (id: string) => {
    if (!editCategoryName.trim()) return;
    await onUpdateCategory(id, editCategoryName);
    setEditingCategoryId(null);
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockCount = products.filter(p => p.stock < 3).length;
  const totalValue = products.reduce((acc, curr) => acc + ((curr.price2Days || 0) * curr.stock), 0);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-100">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
            <p className="text-gray-500 text-sm mt-2">Mamas Outdoor Management</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none transition"
                placeholder="Enter admin password"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-nature-600 hover:bg-nature-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-nature-200"
            >
              Login Dashboard
            </button>
            <button 
              type="button"
              onClick={onBackToHome}
              className="w-full text-gray-500 text-sm hover:text-gray-700 font-medium"
            >
              Kembali ke Website
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
             <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {isConnected ? 'Supabase Connected' : 'Running on Mock Data'}
             </div>
             {!isConnected && (
               <p className="text-xs text-red-500 mt-2">
                 *Cek VITE_SUPABASE_URL di .env atau Vercel Settings
               </p>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-nature-900 text-white flex-shrink-0">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-bold tracking-tight">Mamas<span className="text-nature-400">Admin</span></h2>
        </div>
        <nav className="p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${activeTab === 'dashboard' ? 'bg-white/10 text-white font-bold' : 'text-nature-200 hover:bg-white/5'}`}
          >
            <LayoutDashboard size={20} /> Dashboard
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
          
          <div className="mt-8 mx-2 p-4 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-nature-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-nature-200">System Status</span>
            </div>
            <div className={`text-xs font-bold flex items-center gap-2 ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
               <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
               {isConnected ? 'DB Connected' : 'Local Mock Data'}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10">
            <button 
              onClick={onBackToHome}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-nature-200 hover:bg-white/5 transition"
            >
              <LogOut size={20} /> Keluar
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto max-h-screen">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center sticky top-0 z-30">
          <h1 className="text-2xl font-bold text-gray-800 capitalize">{activeTab} Overview</h1>
          <div className="flex items-center gap-4">
             <button 
                onClick={handleRefreshData}
                disabled={isRefreshing}
                className="p-2 text-gray-500 hover:text-nature-600 hover:bg-gray-100 rounded-lg transition disabled:animate-spin"
                title="Refresh Data"
             >
                <RotateCcw size={20} />
             </button>
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-nature-100 text-nature-600 flex items-center justify-center font-bold">A</div>
               <span className="text-sm font-medium text-gray-600">Admin</span>
             </div>
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Package size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Total Produk</p>
                    <h3 className="text-2xl font-bold text-gray-900">{products.length} Item</h3>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Stok Menipis</p>
                    <h3 className="text-2xl font-bold text-gray-900">{lowStockCount} Item</h3>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Estimasi Aset (Min 2 Hari)</p>
                    <h3 className="text-2xl font-bold text-gray-900">Rp{totalValue.toLocaleString('id-ID')}</h3>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Cari produk..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => openProductModal()}
                  className="bg-nature-600 hover:bg-nature-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-nature-200"
                >
                  <Plus size={18} /> Tambah Produk
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4">Produk</th>
                      <th className="px-6 py-4">Kategori</th>
                      <th className="px-6 py-4">Harga Min. (2 Hari)</th>
                      <th className="px-6 py-4">Stok</th>
                      <th className="px-6 py-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredProducts.map(product => (
                      <tr key={product.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={product.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-200" />
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{product.name}</span>
                              {product.packageItems && product.packageItems.length > 0 && (
                                <span className="text-xs text-adventure-600 flex items-center gap-1">
                                  <Layers size={10} /> {product.packageItems.length} Komponen
                                </span>
                              )}
                              {product.sizes && Object.keys(product.sizes).length > 0 && (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                  <Scissors size={10} /> {Object.keys(product.sizes).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-nature-600">
                          Rp{(product.price2Days || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`font-bold ${product.stock < 3 ? 'text-red-600' : 'text-green-600'}`}>
                             {product.stock}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => openProductModal(product)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => onDeleteProduct(product.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Hapus"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
             <div className="max-w-2xl mx-auto">
               {/* Add Category */}
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
                 <h3 className="font-bold text-gray-900 mb-4">Tambah Kategori Baru</h3>
                 <form onSubmit={handleCategoryAdd} className="flex gap-4">
                   <input 
                      type="text"
                      required
                      placeholder="Nama Kategori (misal: Sepatu, Jaket)"
                      className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-nature-500 outline-none"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                   />
                   <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-nature-600 hover:bg-nature-700 text-white px-6 py-2 rounded-xl font-bold transition disabled:opacity-50"
                   >
                     {isSubmitting ? '...' : 'Tambah'}
                   </button>
                 </form>
               </div>

               {/* List Categories */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                 <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                   <h3 className="font-bold text-gray-700">Daftar Kategori</h3>
                 </div>
                 <ul className="divide-y divide-gray-100">
                   {categories.map(cat => (
                     <li key={cat.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                       {editingCategoryId === cat.id ? (
                         <div className="flex items-center gap-2 flex-1 mr-4">
                           <input 
                             type="text"
                             className="w-full px-3 py-1.5 bg-white border border-nature-300 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none text-sm"
                             value={editCategoryName}
                             onChange={e => setEditCategoryName(e.target.value)}
                           />
                           <button onClick={() => saveEditCategory(cat.id)} className="p-1.5 text-green-600 hover:bg-green-100 rounded">
                             <CheckSquare size={18} />
                           </button>
                           <button onClick={cancelEditCategory} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                             <X size={18} />
                           </button>
                         </div>
                       ) : (
                         <span className="font-medium text-gray-800">{cat.name}</span>
                       )}
                       
                       <div className="flex gap-2">
                         {editingCategoryId !== cat.id && (
                           <button 
                             onClick={() => startEditCategory(cat)}
                             className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                           >
                             <Edit size={16} />
                           </button>
                         )}
                         <button 
                           onClick={() => onDeleteCategory(cat.id)}
                           className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </li>
                   ))}
                   {categories.length === 0 && (
                     <li className="px-6 py-8 text-center text-gray-500">
                       Belum ada kategori. Tambahkan di atas.
                     </li>
                   )}
                 </ul>
               </div>
             </div>
          )}
        </div>
      </main>

      {/* Add/Edit Product Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProductModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden animate-slide-in-right max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-bold text-lg text-gray-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleProductSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                  value={productFormData.name}
                  onChange={e => setProductFormData({...productFormData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                    value={productFormData.category}
                    onChange={e => setProductFormData({...productFormData, category: e.target.value})}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    {categories.length === 0 && <option value="Umum">Umum</option>}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Stok Total {Object.keys(productFormData.sizes || {}).length > 0 && '(Otomatis)'}
                   </label>
                   <input 
                    type="number" 
                    required
                    min="0"
                    // Disable manual stock input if sizes are defined
                    readOnly={Object.keys(productFormData.sizes || {}).length > 0}
                    className={`w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none ${Object.keys(productFormData.sizes || {}).length > 0 ? 'bg-gray-100 text-gray-500' : 'bg-gray-50'}`}
                    value={productFormData.stock}
                    onChange={e => setProductFormData({...productFormData, stock: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              {/* SECTION SIZE MANAGEMENT: For Pakaian/Jaket/Celana */}
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                 <h4 className="text-sm font-bold text-orange-800 mb-3 flex items-center gap-2">
                   <Scissors size={16} /> Stok per Ukuran (Pakaian/Sepatu)
                 </h4>
                 <div className="grid grid-cols-5 gap-2">
                   {CLOTHING_SIZES.map(size => (
                     <div key={size} className="text-center">
                       <label className="block text-xs font-bold text-gray-500 mb-1">{size}</label>
                       <input 
                         type="number"
                         min="0"
                         placeholder="0"
                         className="w-full px-1 py-1 text-center bg-white border border-orange-200 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                         value={productFormData.sizes?.[size] || ''}
                         onChange={(e) => updateSizeStock(size, parseInt(e.target.value) || 0)}
                       />
                     </div>
                   ))}
                 </div>
                 <p className="text-[10px] text-orange-600 mt-2">
                   *Mengisi stok ukuran akan otomatis mengupdate Stok Total. Kosongkan jika bukan produk pakaian.
                 </p>
              </div>

              {/* SECTION PACKAGE ITEMS: Only show if category contains 'Paketan' or similar logic */}
              {(productFormData.category?.toLowerCase().includes('paket') || productFormData.category?.toLowerCase().includes('bundling')) && (
                 <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                    <div className="flex justify-between items-center mb-3">
                       <h4 className="text-sm font-bold text-purple-800 flex items-center gap-2">
                         <Layers size={16} /> Isi Paket (Komponen)
                       </h4>
                       <button type="button" onClick={addPackageItem} className="text-xs bg-purple-200 hover:bg-purple-300 text-purple-800 px-2 py-1 rounded font-bold">
                         + Tambah Alat
                       </button>
                    </div>
                    
                    <div className="space-y-2">
                       {productFormData.packageItems?.map((item, index) => (
                         <div key={index} className="flex gap-2 items-center">
                            <select 
                              className="flex-1 text-xs px-2 py-2 rounded border border-purple-200 focus:outline-none"
                              value={item.productId}
                              onChange={(e) => updatePackageItem(index, 'productId', e.target.value)}
                            >
                               <option value="">Pilih Alat...</option>
                               {products.filter(p => p.id !== productFormData.id).map(p => (
                                 <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>
                               ))}
                            </select>
                            <input 
                              type="number"
                              min="1"
                              className="w-16 text-xs px-2 py-2 rounded border border-purple-200 text-center"
                              value={item.quantity}
                              onChange={(e) => updatePackageItem(index, 'quantity', parseInt(e.target.value))}
                            />
                            <button 
                              type="button" 
                              onClick={() => removePackageItem(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X size={14} />
                            </button>
                         </div>
                       ))}
                       {(!productFormData.packageItems || productFormData.packageItems.length === 0) && (
                         <p className="text-xs text-purple-400 italic text-center">Belum ada alat dalam paket ini.</p>
                       )}
                    </div>
                    <p className="text-[10px] text-purple-600 mt-2">
                      *Saat paket ini disewa, stok alat-alat di atas akan otomatis berkurang.
                    </p>
                 </div>
              )}

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                   <DollarSign size={16} /> Atur Harga Paket (Rupiah)
                 </h4>
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">2 Hari (Minimal)</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={productFormData.price2Days}
                        onChange={e => setProductFormData({...productFormData, price2Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">3 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={productFormData.price3Days}
                        onChange={e => setProductFormData({...productFormData, price3Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">4 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={productFormData.price4Days}
                        onChange={e => setProductFormData({...productFormData, price4Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">5 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={productFormData.price5Days}
                        onChange={e => setProductFormData({...productFormData, price5Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">6 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={productFormData.price6Days}
                        onChange={e => setProductFormData({...productFormData, price6Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">7 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={productFormData.price7Days}
                        onChange={e => setProductFormData({...productFormData, price7Days: parseInt(e.target.value)})}
                      />
                    </div>
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link Gambar (URL)</label>
                <div className="flex gap-2">
                   <div className="relative flex-1">
                    <ImageIcon className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input 
                      type="url" 
                      required
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none text-sm"
                      value={productFormData.image}
                      onChange={e => setProductFormData({...productFormData, image: e.target.value})}
                    />
                   </div>
                   {productFormData.image && (
                     <img src={productFormData.image} alt="Preview" className="w-10 h-10 rounded object-cover border border-gray-200" />
                   )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea 
                  rows={3}
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none text-sm"
                  value={productFormData.description}
                  onChange={e => setProductFormData({...productFormData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-nature-600 hover:bg-nature-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-nature-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={18} /> Simpan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;