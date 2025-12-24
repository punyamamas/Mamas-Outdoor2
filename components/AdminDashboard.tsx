import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Package, LogOut, Plus, Search, 
  Edit, Trash2, Save, X, Image as ImageIcon,
  AlertTriangle, DollarSign, Loader2, RotateCcw,
  Database, Wifi, WifiOff, Tags, CheckSquare, Layers, Scissors, Footprints, Palette, ChevronDown, ChevronUp
} from 'lucide-react';
import { Product, Category, PackageItem, ProductVariant, ColorImage } from '../types';
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

// Helper structure for the detailed variant form
interface TempVariantGroup {
  id: string; // unique temp id
  colorName: string;
  imageUrl: string;
  sizes: { [size: string]: number }; // e.g., { 'XL': 2, 'L': 1 }
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
  
  const [isConnected, setIsConnected] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Basic Product Data
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
  });

  // Advanced Variant State
  const [useAdvancedVariants, setUseAdvancedVariants] = useState(false);
  const [tempVariantGroups, setTempVariantGroups] = useState<TempVariantGroup[]>([]);
  const [simpleSizes, setSimpleSizes] = useState<{ [key: string]: number }>({});
  
  // Constants
  const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'];
  const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
  
  // Categories State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

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
      });

      // Check if product uses Advanced Variants (has variants array)
      if (product.variants && product.variants.length > 0) {
        setUseAdvancedVariants(true);
        // Reconstruct TempVariantGroups from variants array
        const groups: { [color: string]: TempVariantGroup } = {};
        
        product.variants.forEach(v => {
          if (!groups[v.color]) {
            // Find image for this color
            const colorImg = product.colorImages?.find(ci => ci.color === v.color);
            groups[v.color] = {
              id: Date.now().toString() + Math.random(),
              colorName: v.color,
              imageUrl: colorImg ? colorImg.url : '',
              sizes: {}
            };
          }
          groups[v.color].sizes[v.size] = v.stock;
        });
        setTempVariantGroups(Object.values(groups));
        setSimpleSizes({});
      } else {
        // Fallback to simple sizes
        setUseAdvancedVariants(false);
        setSimpleSizes(product.sizes || {});
        setTempVariantGroups([]);
      }

    } else {
      // New Product
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
      });
      setUseAdvancedVariants(false);
      setTempVariantGroups([]);
      setSimpleSizes({});
    }
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let finalVariants: ProductVariant[] = [];
    let finalColorImages: ColorImage[] = [];
    let finalSizes = {};
    let finalColors: string[] = [];
    let finalStock = 0;

    if (useAdvancedVariants) {
      // Convert TempVariantGroups to ProductVariant[] and ColorImage[]
      tempVariantGroups.forEach(group => {
        if (group.imageUrl) {
          finalColorImages.push({ color: group.colorName, url: group.imageUrl });
        }
        finalColors.push(group.colorName);
        
        (Object.entries(group.sizes) as [string, number][]).forEach(([size, stock]) => {
          if (stock > 0) {
            finalVariants.push({
              color: group.colorName,
              size: size,
              stock: stock
            });
            finalStock += stock;
          }
        });
      });
      // Clear simple sizes if using advanced
      finalSizes = {};
    } else {
      // Use Simple Sizes
      finalSizes = simpleSizes;
      // Calculate stock from simple sizes if present, else use manually input stock
      const sizeStock = (Object.values(simpleSizes) as number[]).reduce((a, b) => a + b, 0);
      finalStock = sizeStock > 0 ? sizeStock : (productFormData.stock || 0);
      finalColors = []; // Or from basic color input if we kept it (omitted for simplicity here)
    }

    const finalProductData = {
      ...productFormData,
      stock: finalStock,
      sizes: finalSizes,
      colors: finalColors,
      variants: finalVariants,
      colorImages: finalColorImages
    } as Product;

    try {
      if (editingProduct) {
        await onUpdateProduct(finalProductData);
      } else {
        await onAddProduct(finalProductData);
      }
      setIsProductModalOpen(false);
    } catch (error) {
      console.error("Error submitting form", error);
      alert("Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Logic for Advanced Variants ---
  const addVariantGroup = () => {
    setTempVariantGroups(prev => [
      ...prev,
      { id: Date.now().toString(), colorName: '', imageUrl: '', sizes: {} }
    ]);
  };

  const removeVariantGroup = (id: string) => {
    setTempVariantGroups(prev => prev.filter(g => g.id !== id));
  };

  const updateVariantGroup = (id: string, field: keyof TempVariantGroup, value: any) => {
    setTempVariantGroups(prev => prev.map(g => 
      g.id === id ? { ...g, [field]: value } : g
    ));
  };

  const updateVariantSizeStock = (groupId: string, size: string, qty: number) => {
    setTempVariantGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        const newSizes = { ...g.sizes };
        if (qty > 0) newSizes[size] = qty;
        else delete newSizes[size];
        return { ...g, sizes: newSizes };
      }
      return g;
    }));
  };

  // --- Logic for Simple Sizes ---
  const updateSimpleSizeStock = (size: string, count: number) => {
    setSimpleSizes(prev => {
      const newSizes = { ...prev };
      if (count > 0) newSizes[size] = count;
      else delete newSizes[size];
      return newSizes;
    });
  };

  // --- Logic for Categories ---
  const handleCategoryAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSubmitting(true);
    await onAddCategory(newCategoryName);
    setNewCategoryName('');
    setIsSubmitting(false);
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
                      <th className="px-6 py-4">Harga 2 Hari</th>
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
                              {product.variants && product.variants.length > 0 ? (
                                <span className="text-xs text-purple-600 flex items-center gap-1">
                                  <Palette size={10} /> Multi Varian ({product.variants.length})
                                </span>
                              ) : (
                                product.sizes && Object.keys(product.sizes).length > 0 && (
                                  <span className="text-xs text-blue-600 flex items-center gap-1">
                                    <Scissors size={10} /> {Object.keys(product.sizes).join(', ')}
                                  </span>
                                )
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
                           <button onClick={() => setEditingCategoryId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                             <X size={18} />
                           </button>
                         </div>
                       ) : (
                         <span className="font-medium text-gray-800">{cat.name}</span>
                       )}
                       
                       <div className="flex gap-2">
                         <button 
                           onClick={() => {
                             setEditingCategoryId(cat.id);
                             setEditCategoryName(cat.name);
                           }}
                           className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                         >
                           <Edit size={16} />
                         </button>
                         <button 
                           onClick={() => onDeleteCategory(cat.id)}
                           className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     </li>
                   ))}
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative z-10 overflow-hidden animate-slide-in-right max-h-[95vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h3 className="font-bold text-lg text-gray-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleProductSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              {/* Price Section */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                   <DollarSign size={16} /> Atur Harga Paket (Rupiah)
                 </h4>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">2 Hari (Min)</label>
                      <input type="number" required min="0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" value={productFormData.price2Days} onChange={e => setProductFormData({...productFormData, price2Days: parseInt(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">3 Hari</label>
                      <input type="number" required min="0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" value={productFormData.price3Days} onChange={e => setProductFormData({...productFormData, price3Days: parseInt(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">4 Hari</label>
                      <input type="number" required min="0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" value={productFormData.price4Days} onChange={e => setProductFormData({...productFormData, price4Days: parseInt(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">5 Hari</label>
                      <input type="number" required min="0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" value={productFormData.price5Days} onChange={e => setProductFormData({...productFormData, price5Days: parseInt(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">6 Hari</label>
                      <input type="number" required min="0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" value={productFormData.price6Days} onChange={e => setProductFormData({...productFormData, price6Days: parseInt(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">7 Hari</label>
                      <input type="number" required min="0" className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm" value={productFormData.price7Days} onChange={e => setProductFormData({...productFormData, price7Days: parseInt(e.target.value)})} />
                    </div>
                 </div>
              </div>

              {/* Main Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gambar Utama (URL)</label>
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

              {/* VARIANT MODE TOGGLE */}
              <div className="flex items-center justify-between bg-gray-100 p-3 rounded-lg border border-gray-200">
                <span className="text-sm font-bold text-gray-700">Produk punya banyak warna & ukuran? (Jaket/Sepatu)</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={useAdvancedVariants} onChange={(e) => setUseAdvancedVariants(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nature-600"></div>
                </label>
              </div>

              {/* COMPLEX VARIANTS UI */}
              {useAdvancedVariants ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-gray-800">Varian Warna & Stok</h4>
                    <button type="button" onClick={addVariantGroup} className="text-xs bg-nature-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 hover:bg-nature-700">
                      <Plus size={14} /> Tambah Warna
                    </button>
                  </div>
                  
                  {tempVariantGroups.map((group, idx) => (
                    <div key={group.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative animate-slide-in-right">
                      <button type="button" onClick={() => removeVariantGroup(group.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                        <X size={18} />
                      </button>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">Nama Warna (e.g. Pink, Biru)</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-nature-500 outline-none"
                            value={group.colorName}
                            onChange={(e) => updateVariantGroup(group.id, 'colorName', e.target.value)}
                            placeholder="Warna"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 mb-1">URL Gambar Khusus Warna Ini</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-nature-500 outline-none"
                              value={group.imageUrl}
                              onChange={(e) => updateVariantGroup(group.id, 'imageUrl', e.target.value)}
                              placeholder="https://..."
                            />
                            {group.imageUrl && <img src={group.imageUrl} className="w-8 h-8 rounded object-cover border" alt="" />}
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs font-bold text-gray-500 mb-2">Stok per Ukuran untuk Warna {group.colorName || '...'}</p>
                        <div className="grid grid-cols-5 gap-2">
                          {CLOTHING_SIZES.map(size => (
                            <div key={size} className="text-center">
                              <span className="block text-[10px] text-gray-400 font-bold mb-0.5">{size}</span>
                              <input 
                                type="number" 
                                min="0" 
                                className="w-full text-center border border-gray-300 rounded py-1 text-sm focus:border-nature-500 outline-none"
                                placeholder="0"
                                value={group.sizes[size] || ''}
                                onChange={(e) => updateVariantSizeStock(group.id, size, parseInt(e.target.value) || 0)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {tempVariantGroups.length === 0 && <p className="text-center text-sm text-gray-400 italic py-4">Belum ada varian warna. Klik Tambah Warna.</p>}
                </div>
              ) : (
                /* SIMPLE SIZES UI (Fallback) */
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                   <h4 className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                     <Scissors size={16} /> Stok Sederhana (Tanpa Warna Spesifik)
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
                           value={simpleSizes[size] || ''}
                           onChange={(e) => updateSimpleSizeStock(size, parseInt(e.target.value) || 0)}
                         />
                       </div>
                     ))}
                   </div>
                   <div className="mt-3 pt-3 border-t border-orange-200">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Stok Manual (Jika tanpa ukuran)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full px-3 py-1.5 bg-white border border-orange-200 rounded focus:ring-1 focus:ring-orange-500 outline-none text-sm"
                        value={productFormData.stock}
                        onChange={e => setProductFormData({...productFormData, stock: parseInt(e.target.value)})}
                        disabled={Object.keys(simpleSizes).length > 0}
                      />
                   </div>
                </div>
              )}

              {/* Description */}
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