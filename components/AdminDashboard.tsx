import React, { useState } from 'react';
import { 
  LayoutDashboard, Package, LogOut, Plus, Search, 
  Edit, Trash2, Save, X, Image as ImageIcon,
  AlertTriangle, DollarSign, Loader2, RotateCcw
} from 'lucide-react';
import { Product } from '../types';
import { CATEGORIES } from '../constants';

interface AdminDashboardProps {
  products: Product[];
  onBackToHome: () => void;
  onAddProduct: (product: Product) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  products, 
  onBackToHome,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onRefresh
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: 'Tenda',
    price2Days: 0,
    price3Days: 0,
    price4Days: 0,
    price5Days: 0,
    price6Days: 0,
    price7Days: 0,
    stock: 0,
    description: '',
    image: ''
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin123') {
      setIsAuthenticated(true);
    } else {
      alert('Password salah!');
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
        id: Date.now().toString(),
        name: '',
        category: 'Tenda',
        price2Days: 0,
        price3Days: 0,
        price4Days: 0,
        price5Days: 0,
        price6Days: 0,
        price7Days: 0,
        stock: 0,
        description: '',
        image: 'https://picsum.photos/400/300'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await onUpdateProduct(formData as Product);
      } else {
        await onAddProduct(formData as Product);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error submitting form", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500); // Visual delay minimal
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const lowStockCount = products.filter(p => p.stock < 3).length;
  // Use Base Price (2 Days) for asset calculation approximation
  const totalValue = products.reduce((acc, curr) => acc + (curr.price2Days * curr.stock), 0);

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
          <div className="pt-8 mt-8 border-t border-white/10">
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
          {activeTab === 'dashboard' ? (
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
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Toolbar */}
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
                  onClick={() => openModal()}
                  className="bg-nature-600 hover:bg-nature-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition shadow-lg shadow-nature-200"
                >
                  <Plus size={18} /> Tambah Produk
                </button>
              </div>

              {/* Table */}
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
                            <span className="font-medium text-gray-900">{product.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold border border-gray-200">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-nature-600">
                          Rp{product.price2Days.toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4">
                           <span className={`font-bold ${product.stock < 3 ? 'text-red-600' : 'text-green-600'}`}>
                             {product.stock}
                           </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => openModal(product)}
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
        </div>
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden animate-slide-in-right max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-bold text-lg text-gray-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select 
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                    value={formData.category}
                    // @ts-ignore
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    {CATEGORIES.filter(c => c !== 'Semua').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Stok</label>
                   <input 
                    type="number" 
                    required
                    min="0"
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: parseInt(e.target.value)})}
                  />
                </div>
              </div>

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
                        value={formData.price2Days}
                        onChange={e => setFormData({...formData, price2Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">3 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={formData.price3Days}
                        onChange={e => setFormData({...formData, price3Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">4 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={formData.price4Days}
                        onChange={e => setFormData({...formData, price4Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">5 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={formData.price5Days}
                        onChange={e => setFormData({...formData, price5Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">6 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={formData.price6Days}
                        onChange={e => setFormData({...formData, price6Days: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">7 Hari</label>
                      <input 
                        type="number" 
                        required min="0"
                        className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded focus:ring-1 focus:ring-nature-500 outline-none text-sm"
                        value={formData.price7Days}
                        onChange={e => setFormData({...formData, price7Days: parseInt(e.target.value)})}
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
                      value={formData.image}
                      onChange={e => setFormData({...formData, image: e.target.value})}
                    />
                   </div>
                   {formData.image && (
                     <img src={formData.image} alt="Preview" className="w-10 h-10 rounded object-cover border border-gray-200" />
                   )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea 
                  rows={3}
                  required
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none text-sm"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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