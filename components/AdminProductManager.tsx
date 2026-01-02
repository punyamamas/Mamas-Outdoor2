
// ... existing imports ...
import React, { useState, useRef } from 'react';
import { Plus, Search, Edit, Trash2, X, Layers, Scissors, Palette, Image as ImageIcon, Save, Loader2, ShoppingBag, Upload, QrCode } from 'lucide-react';
import { Product, Category, ProductVariant, ColorImage, PackageItem } from '../types';
import { uploadProductImage } from '../services/productService';
import QRCode from 'qrcode'; // Need to import this for generating label

interface AdminProductManagerProps {
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Product) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
}

// ... Helper structure interfaces ...
interface TempVariantGroup {
  id: string; 
  colorName: string;
  imageUrl: string;
  sizes: { [size: string]: number }; 
}

const AdminProductManager: React.FC<AdminProductManagerProps> = ({
  products,
  categories,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct
}) => {
  // ... existing states ...
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null); 
  const [uploadingVariantId, setUploadingVariantId] = useState<string | null>(null); 

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', category: '', price2Days: 0, salePrice: 0, isSale: false, stock: 0, description: '', image: '', packageItems: []
  });

  const [useAdvancedVariants, setUseAdvancedVariants] = useState(false);
  const [tempVariantGroups, setTempVariantGroups] = useState<TempVariantGroup[]>([]);
  const [simpleSizes, setSimpleSizes] = useState<{ [key: string]: number }>({});
  
  const [isPackageMode, setIsPackageMode] = useState(false);
  const [packageSearchTerm, setPackageSearchTerm] = useState('');

  const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];

  // ... openModal, handleSubmit, handleImageUpload, handleVariantImageUpload, logic ...
  // Re-declare these functions from the previous implementation
  
  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({ ...product, packageItems: product.packageItems || [] });
      setIsPackageMode(product.category === 'Paketan Sewa' || (product.packageItems && product.packageItems.length > 0) ? true : false);

      if (product.variants && product.variants.length > 0) {
        setUseAdvancedVariants(true);
        const groups: { [color: string]: TempVariantGroup } = {};
        product.variants.forEach(v => {
          if (!groups[v.color]) {
            const colorImg = product.colorImages?.find(ci => ci.color === v.color);
            groups[v.color] = {
              id: Math.random().toString(), colorName: v.color, imageUrl: colorImg ? colorImg.url : '', sizes: {}
            };
          }
          groups[v.color].sizes[v.size] = v.stock;
        });
        setTempVariantGroups(Object.values(groups));
        setSimpleSizes({});
      } else {
        setUseAdvancedVariants(false);
        setSimpleSizes(product.sizes || {});
        setTempVariantGroups([]);
      }
    } else {
      setEditingProduct(null);
      setFormData({
        id: Date.now().toString(), name: '', category: categories[0]?.name || 'Tenda', 
        price2Days: 0, price3Days: 0, price4Days: 0, price5Days: 0, price6Days: 0, price7Days: 0,
        isSale: false, salePrice: 0,
        stock: 0, description: '', image: 'https://picsum.photos/400/300', packageItems: []
      });
      setUseAdvancedVariants(false);
      setTempVariantGroups([]);
      setSimpleSizes({});
      setIsPackageMode(false);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let finalVariants: ProductVariant[] = [];
    let finalColorImages: ColorImage[] = [];
    let finalSizes = {};
    let finalColors: string[] = [];
    let finalStock = 0;

    if (useAdvancedVariants) {
      tempVariantGroups.forEach(group => {
        if (group.imageUrl) finalColorImages.push({ color: group.colorName, url: group.imageUrl });
        finalColors.push(group.colorName);
        Object.entries(group.sizes).forEach(([size, stock]) => {
          const qty = Number(stock as unknown);
          if (qty > 0) {
            finalVariants.push({ color: group.colorName, size, stock: qty });
            finalStock += qty;
          }
        });
      });
      finalSizes = {};
    } else {
      finalSizes = simpleSizes;
      const sizeStock = Object.values(simpleSizes).reduce((a: number, b: number) => a + Number(b), 0);
      finalStock = sizeStock > 0 ? sizeStock : (formData.stock || 0);
    }

    const finalProduct = {
      ...formData,
      stock: finalStock,
      sizes: finalSizes,
      colors: finalColors,
      variants: finalVariants,
      colorImages: finalColorImages,
      packageItems: isPackageMode ? formData.packageItems : []
    } as Product;

    try {
      if (editingProduct) await onUpdateProduct(finalProduct);
      else await onAddProduct(finalProduct);
      setIsModalOpen(false);
    } catch (e) { console.error(e); alert('Error saving product'); }
    finally { setIsSubmitting(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) return alert("Ukuran gambar maksimal 2MB.");
    setIsUploading(true);
    try {
      const url = await uploadProductImage(file);
      if (url) setFormData({ ...formData, image: url });
    } catch (error) { console.error(error); alert("Gagal upload gambar."); } 
    finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !uploadingVariantId) return;
    const file = e.target.files[0];
    if (file.size > 2 * 1024 * 1024) return alert("Ukuran gambar maksimal 2MB.");
    setIsUploading(true);
    try {
      const url = await uploadProductImage(file);
      if (url) setTempVariantGroups(prev => prev.map(g => g.id === uploadingVariantId ? { ...g, imageUrl: url } : g));
    } catch (error) { console.error(error); alert("Gagal upload gambar varian."); }
    finally { setIsUploading(false); setUploadingVariantId(null); if (variantFileInputRef.current) variantFileInputRef.current.value = ''; }
  };

  const triggerVariantUpload = (groupId: string) => {
      setUploadingVariantId(groupId);
      variantFileInputRef.current?.click();
  };

  // --- NEW: PRINT LABEL QR ---
  const handlePrintLabel = async (product: Product) => {
    try {
        // Generate QR Data URL
        const qrUrl = await QRCode.toDataURL(product.id, { width: 150, margin: 1 });
        
        const printWindow = window.open('', '', 'width=400,height=400');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Label</title>
                    <style>
                        @page { size: 50mm 50mm; margin: 0; }
                        body { margin: 0; padding: 5px; text-align: center; font-family: monospace; }
                        .label { border: 2px solid black; padding: 5px; border-radius: 5px; }
                        img { width: 100px; height: 100px; }
                        .name { font-weight: bold; font-size: 12px; margin-bottom: 5px; line-height: 1.1; }
                        .id { font-size: 10px; }
                    </style>
                </head>
                <body>
                    <div class="label">
                        <div class="name">${product.name}</div>
                        <img src="${qrUrl}" />
                        <div class="id">ID: ${product.id.slice(0,8)}</div>
                        <div class="id">${product.category}</div>
                    </div>
                    <script>
                        window.onload = () => { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    } catch (e) {
        console.error("QR Error", e);
        alert("Gagal generate QR");
    }
  };

  // ... Package & Variant Helpers ...
  const addToPackage = (item: Product) => {
    if (formData.packageItems?.find(p => p.productId === item.id)) return;
    setFormData(prev => ({ ...prev, packageItems: [...(prev.packageItems || []), { productId: item.id, quantity: 1 }] }));
    setPackageSearchTerm('');
  };
  const removeFromPackage = (pid: string) => { setFormData(prev => ({ ...prev, packageItems: prev.packageItems?.filter(p => p.productId !== pid) })); };
  const updatePackageQty = (pid: string, qty: number) => { setFormData(prev => ({ ...prev, packageItems: prev.packageItems?.map(p => p.productId === pid ? { ...p, quantity: qty } : p) })); };
  const addVariantGroup = () => setTempVariantGroups([...tempVariantGroups, { id: Date.now().toString(), colorName: '', imageUrl: '', sizes: {} }]);
  const removeVariantGroup = (id: string) => setTempVariantGroups(tempVariantGroups.filter(g => g.id !== id));
  const updateVariantGroup = (id: string, f: keyof TempVariantGroup, v: any) => setTempVariantGroups(tempVariantGroups.map(g => g.id === id ? { ...g, [f]: v } : g));
  const updateVariantSizeStock = (gid: string, sz: string, qty: number) => {
    setTempVariantGroups(tempVariantGroups.map(g => {
      if (g.id === gid) {
        const newSizes = { ...g.sizes };
        if (qty > 0) newSizes[sz] = qty; else delete newSizes[sz];
        return { ...g, sizes: newSizes };
      }
      return g;
    }));
  };
  const updateSimpleSizeStock = (sz: string, qty: number) => {
    setSimpleSizes(prev => {
      const n = { ...prev };
      if (qty > 0) n[sz] = qty; else delete n[sz];
      return n;
    });
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
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
          onClick={() => openModal()}
          className="bg-nature-600 hover:bg-nature-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition"
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
              <th className="px-6 py-4">Harga</th>
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
                    <div>
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        {product.name}
                        {product.isSale && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 rounded font-bold uppercase border border-blue-200">JUAL</span>}
                      </div>
                      {product.packageItems?.length ? <span className="text-[10px] text-orange-600 font-bold flex gap-1"><Layers size={10}/> Paket</span> : null}
                      {product.variants?.length ? <span className="text-[10px] text-purple-600 font-bold flex gap-1"><Palette size={10}/> Varian</span> : null}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold">{product.category}</span></td>
                <td className="px-6 py-4 font-bold text-nature-600">
                    {product.isSale ? (
                        <span>Rp{(product.salePrice||0).toLocaleString('id-ID')}</span>
                    ) : (
                        <span>Rp{(product.price2Days).toLocaleString('id-ID')} <span className="text-[10px] text-gray-400 font-normal">/2hr</span></span>
                    )}
                </td>
                <td className="px-6 py-4 font-bold">{product.stock}</td>
                <td className="px-6 py-4 text-center">
                   <div className="flex justify-center gap-2">
                     <button onClick={() => handlePrintLabel(product)} className="text-gray-600 hover:bg-gray-100 p-2 rounded" title="Cetak QR Label"><QrCode size={16}/></button>
                     <button onClick={() => openModal(product)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={16}/></button>
                     <button onClick={() => onDeleteProduct(product.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL FORM (Same as before) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="font-bold text-xl">{editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-bold mb-1">Nama Produk</label>
                    <input required className="w-full border rounded-lg p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-1">Kategori</label>
                    <select className="w-full border rounded-lg p-2" value={formData.category} onChange={e => {
                      setFormData({...formData, category: e.target.value});
                      setIsPackageMode(e.target.value === 'Paketan Sewa');
                    }}>
                       {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                 </div>
               </div>

               {/* Sale vs Rent Toggle */}
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${formData.isSale ? 'bg-blue-500 text-white' : 'bg-white text-blue-500'}`}>
                        {formData.isSale ? <ShoppingBag size={20}/> : <Layers size={20}/>}
                     </div>
                     <div>
                        <h4 className="font-bold text-blue-900 text-sm">Mode: {formData.isSale ? 'Barang Dijual (Retail)' : 'Barang Disewa (Rental)'}</h4>
                        <p className="text-xs text-blue-600">{formData.isSale ? 'Stok berkurang permanen saat checkout' : 'Stok kembali saat transaksi selesai'}</p>
                     </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formData.isSale || false} onChange={e => setFormData({...formData, isSale: e.target.checked})} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
               </div>
               
               {/* Pricing */}
               {formData.isSale ? (
                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <label className="block text-sm font-bold text-blue-800 mb-1">Harga Jual (Satuan)</label>
                      <input type="number" required className="w-full border border-blue-300 rounded-lg p-2 text-lg font-bold" 
                        value={formData.salePrice || ''} onChange={e=>setFormData({...formData, salePrice: Number(e.target.value)})}/>
                   </div>
               ) : (
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><label className="text-xs font-bold">Harga 2 Hari</label><input type="number" className="w-full border rounded p-2" value={formData.price2Days} onChange={e=>setFormData({...formData, price2Days: Number(e.target.value)})}/></div>
                      <div><label className="text-xs font-bold">Harga 3 Hari</label><input type="number" className="w-full border rounded p-2" value={formData.price3Days} onChange={e=>setFormData({...formData, price3Days: Number(e.target.value)})}/></div>
                      <div><label className="text-xs font-bold">Harga 4 Hari</label><input type="number" className="w-full border rounded p-2" value={formData.price4Days} onChange={e=>setFormData({...formData, price4Days: Number(e.target.value)})}/></div>
                      <div><label className="text-xs font-bold">Harga 5 Hari</label><input type="number" className="w-full border rounded p-2" value={formData.price5Days} onChange={e=>setFormData({...formData, price5Days: Number(e.target.value)})}/></div>
                   </div>
               )}

               {/* Advanced Variants Toggle */}
               <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={useAdvancedVariants} onChange={e => setUseAdvancedVariants(e.target.checked)} className="w-5 h-5 text-nature-600"/>
                    <span className="font-bold text-gray-700">Gunakan Varian Warna & Gambar?</span>
                 </label>
               </div>

               {/* Variant Logic Area */}
               {useAdvancedVariants ? (
                 <div className="space-y-4 border p-4 rounded-lg">
                    <input 
                      type="file" 
                      ref={variantFileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleVariantImageUpload} 
                    />

                    {tempVariantGroups.map((group) => (
                      <div key={group.id} className="bg-gray-50 p-4 rounded-lg border relative">
                         <button type="button" onClick={() => removeVariantGroup(group.id)} className="absolute top-2 right-2 text-red-500"><Trash2 size={16}/></button>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                           <div>
                              <label className="text-xs font-bold block mb-1">Nama Warna</label>
                              <input placeholder="Contoh: Merah" className="border p-2 rounded w-full" value={group.colorName} onChange={e => updateVariantGroup(group.id, 'colorName', e.target.value)} />
                           </div>
                           <div>
                              <label className="text-xs font-bold block mb-1">URL Gambar (Manual / Upload)</label>
                              <div className="flex gap-2">
                                <input placeholder="https://..." className="border p-2 rounded flex-1 text-sm" value={group.imageUrl} onChange={e => updateVariantGroup(group.id, 'imageUrl', e.target.value)} />
                                <button 
                                  type="button" 
                                  onClick={() => triggerVariantUpload(group.id)}
                                  disabled={isUploading}
                                  className="p-2 border rounded bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600"
                                  title="Upload Gambar Varian"
                                >
                                  {isUploading && uploadingVariantId === group.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16}/>}
                                </button>
                              </div>
                           </div>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            {AVAILABLE_SIZES.map(sz => (
                              <div key={sz} className="flex flex-col items-center">
                                <span className="text-[10px] font-bold">{sz}</span>
                                <input type="number" className="w-12 text-center border rounded text-xs" min="0" 
                                  value={group.sizes[sz] || ''} 
                                  onChange={e => updateVariantSizeStock(group.id, sz, parseInt(e.target.value) || 0)} 
                                />
                              </div>
                            ))}
                         </div>
                      </div>
                    ))}
                    <button type="button" onClick={addVariantGroup} className="text-nature-600 font-bold flex items-center gap-2"><Plus size={16}/> Tambah Varian Warna</button>
                 </div>
               ) : (
                 <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="block text-sm font-bold mb-2">Stok per Ukuran (Opsional)</label>
                    <div className="flex flex-wrap gap-3">
                       {AVAILABLE_SIZES.map(sz => (
                          <div key={sz} className="flex flex-col items-center">
                            <span className="text-[10px] font-bold">{sz}</span>
                            <input type="number" className="w-12 text-center border rounded" min="0" placeholder="0"
                               value={simpleSizes[sz] || ''} onChange={e => updateSimpleSizeStock(sz, parseInt(e.target.value)||0)}
                            />
                          </div>
                       ))}
                    </div>
                    <div className="mt-4">
                       <label className="block text-sm font-bold">Stok Total (Manual jika tanpa size)</label>
                       <input type="number" className="border p-2 rounded w-32" value={formData.stock} onChange={e => setFormData({...formData, stock: Number(e.target.value)})} />
                    </div>
                 </div>
               )}
               
               {/* Image & Desc */}
               <div>
                  <label className="block text-sm font-bold mb-1">URL Gambar Utama</label>
                  <div className="flex gap-2">
                    <input className="flex-1 border rounded p-2" value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} placeholder="https://..." />
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                    />
                    
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 border rounded hover:bg-gray-50 flex items-center justify-center text-gray-600 w-12"
                      title="Upload Gambar dari Device"
                    >
                      {isUploading && !uploadingVariantId ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20}/>}
                    </button>
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold mb-1">Deskripsi</label>
                  <textarea rows={3} className="w-full border rounded p-2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
               </div>

               {/* Package Builder */}
               {isPackageMode && (
                 <div className="border border-purple-200 bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-3"><Layers size={16}/> Isi Paket Hemat</h4>
                    
                    {formData.packageItems?.map((item, idx) => {
                       const prod = products.find(p => p.id === item.productId);
                       return (
                         <div key={idx} className="flex justify-between items-center bg-white p-2 rounded mb-2 shadow-sm">
                            <span className="text-sm font-medium">{prod?.name || 'Produk Dihapus'}</span>
                            <div className="flex items-center gap-2">
                               <input type="number" min="1" className="w-16 border rounded text-center" value={item.quantity} onChange={e => updatePackageQty(item.productId, parseInt(e.target.value))} />
                               <button type="button" onClick={() => removeFromPackage(item.productId)} className="text-red-500"><Trash2 size={16}/></button>
                            </div>
                         </div>
                       );
                    })}

                    <div className="relative mt-2">
                       <input 
                         placeholder="Cari alat untuk ditambahkan..." 
                         className="w-full border p-2 rounded"
                         value={packageSearchTerm}
                         onChange={e => setPackageSearchTerm(e.target.value)}
                       />
                       {packageSearchTerm && (
                         <div className="absolute w-full bg-white border shadow-lg max-h-40 overflow-y-auto z-10 rounded-b-lg">
                            {products.filter(p => p.id !== formData.id && p.name.toLowerCase().includes(packageSearchTerm.toLowerCase())).slice(0,5).map(p => (
                               <button key={p.id} type="button" onClick={() => addToPackage(p)} className="w-full text-left p-2 hover:bg-gray-100 text-sm">
                                  {p.name}
                               </button>
                            ))}
                         </div>
                       )}
                    </div>
                 </div>
               )}

               <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 border rounded-lg font-bold text-gray-600">Batal</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-nature-600 text-white rounded-lg font-bold flex items-center gap-2">
                     {isSubmitting ? <Loader2 className="animate-spin"/> : <Save size={18}/>} Simpan Produk
                  </button>
               </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductManager;
