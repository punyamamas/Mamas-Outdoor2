import React, { useState } from 'react';
import { Search, PlusCircle, MinusCircle, HeartCrack, Hammer, ArrowRightLeft, FileText, X, Save, AlertCircle, Package, Loader2, Printer } from 'lucide-react';
import { Product, Category } from '../types';
import { getStoreConfig } from '../utils/storeConfig';

interface AdminWarehouseManagerProps {
  products: Product[];
  categories: Category[];
  onUpdateProduct: (product: Product) => Promise<void>;
}

type ActionType = 'restock' | 'manual_rent' | 'return' | 'damage' | 'repair';

const AdminWarehouseManager: React.FC<AdminWarehouseManagerProps> = ({ products, categories, onUpdateProduct }) => {
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'rented' | 'damaged'>('all');
  const [catFilter, setCatFilter] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UNIFIED ACTION MODAL STATE
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType>('restock');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantKey, setVariantKey] = useState('');
  const [qty, setQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = true;
    if (filter === 'low_stock') matchesStatus = p.stock <= 3;
    if (filter === 'rented') matchesStatus = (p.rented || 0) > 0;
    if (filter === 'damaged') matchesStatus = (p.damaged || 0) > 0;
    const matchesCat = catFilter === 'Semua' || p.category === catFilter;
    return matchesSearch && matchesStatus && matchesCat;
  });

  const handlePrintStockOpname = () => {
    const printWindow = window.open('', '', 'width=800,height=800');
    if (!printWindow) return;

    const config = getStoreConfig();
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday:'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Group by Category for printing
    const grouped: Record<string, Product[]> = {};
    products.forEach(p => {
        const c = p.category || 'Lainnya';
        if(!grouped[c]) grouped[c] = [];
        grouped[c].push(p);
    });

    let tableContent = '';
    Object.keys(grouped).sort().forEach(cat => {
        tableContent += `<tr><td colspan="6" style="background:#eee; font-weight:bold; padding:5px;">KATEGORI: ${cat.toUpperCase()}</td></tr>`;
        grouped[cat].forEach((p, idx) => {
            // Cek varian untuk detail
            let variantInfo = '';
            if (p.variants && p.variants.length > 0) {
                variantInfo = '<br/><span style="font-size:10px; color:#666;">' + 
                    p.variants.map(v => `${v.color}-${v.size}: ${v.stock}`).join(', ') + 
                '</span>';
            } else if (p.sizes && Object.keys(p.sizes).length > 0) {
                variantInfo = '<br/><span style="font-size:10px; color:#666;">' + 
                    Object.entries(p.sizes).map(([k,v]) => `${k}: ${v}`).join(', ') + 
                '</span>';
            }

            tableContent += `
                <tr>
                    <td style="text-align:center;">${idx + 1}</td>
                    <td>${p.name} ${variantInfo}</td>
                    <td style="text-align:center; font-weight:bold;">${p.stock}</td>
                    <td style="text-align:center;">${p.rented || 0}</td>
                    <td style="text-align:center;">${p.damaged || 0}</td>
                    <td style="border-bottom:1px solid #ccc;"></td> 
                </tr>
            `;
        });
    });

    const html = `
        <html>
        <head>
            <title>Form Cek Stok - ${config.storeName}</title>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                h2, h4 { margin: 0; text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                th, td { border: 1px solid #999; padding: 6px; }
                th { background: #ddd; }
                .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; }
                .sign { text-align: center; width: 150px; }
                .sign br { display: block; margin-bottom: 50px; }
            </style>
        </head>
        <body>
            <h2>FORM STOCK OPNAME (CEK FISIK)</h2>
            <h4>${config.storeName}</h4>
            <p style="text-align:center; font-size:12px;">Tanggal Cek: ${dateStr}</p>
            
            <table>
                <thead>
                    <tr>
                        <th width="5%">No</th>
                        <th>Nama Barang</th>
                        <th width="10%">Sistem (Ready)</th>
                        <th width="10%">Sedang Sewa</th>
                        <th width="10%">Rusak</th>
                        <th width="15%">Fisik (Real)</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableContent}
                </tbody>
            </table>

            <div class="footer">
                <div class="sign">
                    Dihitung Oleh:<br/><br/>(_________________)
                </div>
                <div class="sign">
                    Diperiksa Oleh (Admin):<br/><br/>(_________________)
                </div>
            </div>
            <script>window.print();</script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const openActionModal = (product: Product, type: ActionType) => {
    setSelectedProduct(product);
    setActionType(type);
    setQty(1);
    setVariantKey(''); // Reset variant choice
    setIsModalOpen(true);
  };

  const getModalTitle = () => {
    switch(actionType) {
      case 'restock': return 'Tambah Stok Baru (Restock)';
      case 'manual_rent': return 'Keluarkan Barang Manual';
      case 'return': return 'Terima Barang Kembali';
      case 'damage': return 'Lapor Barang Rusak';
      case 'repair': return 'Selesai Perbaikan';
      default: return 'Update Stok';
    }
  };

  const getModalColor = () => {
    switch(actionType) {
      case 'restock': 
      case 'repair': return 'bg-green-600';
      case 'damage': return 'bg-red-600';
      case 'manual_rent': 
      case 'return': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  // Logic Validasi Stok Maksimal berdasarkan Action
  const getMaxQty = () => {
    if (!selectedProduct) return 9999;
    
    // Helper untuk ambil stok varian spesifik atau global
    const getVariantStock = (key: 'stock' | 'rented' | 'damaged') => {
        if (variantKey) {
            if (selectedProduct.variants && selectedProduct.variants.length > 0) {
                const [color, size] = variantKey.split('|');
                const v = selectedProduct.variants.find(item => item.color === color && item.size === size);
                if (key === 'stock') return v ? v.stock : 0;
            } else if (selectedProduct.sizes) {
                if (key === 'stock') return selectedProduct.sizes[variantKey] || 0;
            }
        }
        return selectedProduct[key] || 0;
    };

    switch(actionType) {
        case 'manual_rent': // Mengurangi Stock
        case 'damage':      // Mengurangi Stock
            return getVariantStock('stock');
        
        case 'return':      // Mengurangi Rented
            return selectedProduct.rented || 0; // Global limit
            
        case 'repair':      // Mengurangi Damaged
            return selectedProduct.damaged || 0; // Global limit
            
        case 'restock': 
        default: 
            return 9999;
    }
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    
    setIsSubmitting(true);
    const updatedProduct = { ...selectedProduct };
    const isVariant = (updatedProduct.variants && updatedProduct.variants.length > 0) || (updatedProduct.sizes && Object.keys(updatedProduct.sizes).length > 0);

    // 1. Update Global Counters
    if (actionType === 'restock') {
        updatedProduct.stock += qty;
    } else if (actionType === 'manual_rent') {
        updatedProduct.stock = Math.max(0, updatedProduct.stock - qty);
        updatedProduct.rented = (updatedProduct.rented || 0) + qty;
    } else if (actionType === 'return') {
        updatedProduct.stock += qty;
        updatedProduct.rented = Math.max(0, (updatedProduct.rented || 0) - qty);
    } else if (actionType === 'damage') {
        updatedProduct.stock = Math.max(0, updatedProduct.stock - qty);
        updatedProduct.damaged = (updatedProduct.damaged || 0) + qty;
    } else if (actionType === 'repair') {
        updatedProduct.stock += qty;
        updatedProduct.damaged = Math.max(0, (updatedProduct.damaged || 0) - qty);
    }

    // 2. Update Variant/Size Counters
    if (isVariant && variantKey) {
        if (updatedProduct.variants && updatedProduct.variants.length > 0) {
            const [color, size] = variantKey.split('|');
            const vars = [...updatedProduct.variants];
            const idx = vars.findIndex(v => v.color === color && v.size === size);
            
            if (idx !== -1) {
                let vStock = vars[idx].stock;
                // Logic perubahan stok varian
                if (['restock', 'return', 'repair'].includes(actionType)) {
                    vStock += qty;
                } else {
                    vStock = Math.max(0, vStock - qty);
                }
                vars[idx] = { ...vars[idx], stock: vStock };
                updatedProduct.variants = vars;
            }
        } else if (updatedProduct.sizes) {
            const sz = { ...updatedProduct.sizes };
            let sStock = sz[variantKey] || 0;
            
            if (['restock', 'return', 'repair'].includes(actionType)) {
                sStock += qty;
            } else {
                sStock = Math.max(0, sStock - qty);
            }
            sz[variantKey] = sStock;
            updatedProduct.sizes = sz;
        }
    }

    await onUpdateProduct(updatedProduct);
    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const hasVariants = selectedProduct && ((selectedProduct.variants?.length || 0) > 0 || (selectedProduct.sizes && Object.keys(selectedProduct.sizes).length > 0));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header & Filters */}
      <div className="p-5 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-4 bg-nature-50">
        <div className="flex flex-col md:flex-row items-center gap-3">
           <h3 className="font-bold text-nature-800 flex items-center gap-2"><FileText size={18} /> Laporan Stok Gudang</h3>
           <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200">
              {['all', 'rented', 'damaged'].map(f => (
                <button key={f} onClick={() => setFilter(f as any)} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition capitalize ${filter === f ? 'bg-nature-100 text-nature-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {f === 'all' ? 'Semua' : f === 'rented' ? 'Sedang Disewa' : 'Rusak / Maintenance'}
                </button>
              ))}
           </div>
           <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="text-xs font-bold p-2 rounded-lg border border-gray-200 outline-none focus:border-nature-500">
              <option value="Semua">Semua Kategori</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
           </select>
        </div>
        <div className="flex gap-2">
           <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input type="text" placeholder="Cari SKU / Nama..." className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-nature-500 outline-none" 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
           <button 
             onClick={handlePrintStockOpname} 
             className="bg-gray-900 hover:bg-black text-white p-2 rounded-lg transition shadow-sm"
             title="Cetak Form Stock Opname"
           >
             <Printer size={18}/>
           </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-white text-gray-700 font-bold uppercase text-xs border-b border-gray-200">
            <tr>
               <th className="px-6 py-4">Nama Barang</th>
               <th className="px-4 py-4 text-center bg-green-50 text-green-800">Ready</th>
               <th className="px-4 py-4 text-center bg-blue-50 text-blue-800">Keluar</th>
               <th className="px-4 py-4 text-center bg-red-50 text-red-800">Rusak</th>
               <th className="px-6 py-4 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map(p => {
              const isComplex = (p.variants && p.variants.length > 0) || (p.sizes && Object.keys(p.sizes).length > 0);
              return (
                <tr key={p.id} className="hover:bg-gray-50 transition group">
                  <td className="px-6 py-4">
                     <div className="font-bold text-gray-800">{p.name}</div>
                     {isComplex && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {p.variants?.map((v, i) => (
                                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 border border-gray-200">
                                    {v.color}-{v.size}: {v.stock}
                                </span>
                            ))}
                            {p.sizes && Object.entries(p.sizes).map(([k, v]) => (
                                <span key={k} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 border border-gray-200">
                                    {k}: {v}
                                </span>
                            ))}
                        </div>
                     )}
                  </td>
                  <td className="text-center font-bold text-green-700 bg-green-50/30">{p.stock}</td>
                  <td className="text-center font-bold text-blue-600 bg-blue-50/30">{p.rented || '-'}</td>
                  <td className="text-center font-bold text-red-600 bg-red-50/30">{p.damaged || '-'}</td>
                  <td className="px-6 py-4 text-center">
                     <div className="flex justify-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openActionModal(p, 'restock')} className="p-2 hover:bg-green-100 text-green-600 rounded-lg border border-transparent hover:border-green-200 transition" title="Tambah Stok">
                            <PlusCircle size={18}/>
                        </button>
                        <button onClick={() => openActionModal(p, 'manual_rent')} className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg border border-transparent hover:border-blue-200 transition" title="Barang Keluar Manual">
                            <MinusCircle size={18}/>
                        </button>
                        <button onClick={() => openActionModal(p, 'return')} disabled={(p.rented||0)<=0} className="p-2 hover:bg-indigo-100 text-indigo-600 rounded-lg border border-transparent hover:border-indigo-200 transition disabled:opacity-20" title="Barang Kembali">
                            <ArrowRightLeft size={18}/>
                        </button>
                        <button onClick={() => openActionModal(p, 'damage')} className="p-2 hover:bg-red-100 text-red-600 rounded-lg border border-transparent hover:border-red-200 transition" title="Lapor Rusak">
                            <HeartCrack size={18}/>
                        </button>
                        <button onClick={() => openActionModal(p, 'repair')} disabled={(p.damaged||0)<=0} className="p-2 hover:bg-orange-100 text-orange-600 rounded-lg border border-transparent hover:border-orange-200 transition disabled:opacity-20" title="Selesai Perbaikan">
                            <Hammer size={18}/>
                        </button>
                     </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* UNIFIED ACTION MODAL */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
           <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-in-right">
              
              {/* Modal Header */}
              <div className={`${getModalColor()} px-6 py-4 flex justify-between items-center text-white`}>
                 <h3 className="font-bold text-lg flex items-center gap-2">
                    <Package size={20} /> {getModalTitle()}
                 </h3>
                 <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition"><X size={20}/></button>
              </div>

              <form onSubmit={handleExecuteAction} className="p-6">
                 <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Produk</label>
                    <div className="font-bold text-gray-800 text-lg">{selectedProduct.name}</div>
                 </div>

                 {/* Variant Selector */}
                 {hasVariants && (
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Pilih Varian {actionType === 'restock' ? '(Yang Ditambah)' : '(Yang Diproses)'}
                        </label>
                        <select 
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-nature-500 outline-none"
                            value={variantKey}
                            onChange={(e) => setVariantKey(e.target.value)}
                            required
                        >
                            <option value="">-- Pilih Varian --</option>
                            {selectedProduct.variants?.map((v, i) => (
                                <option key={i} value={`${v.color}|${v.size}`}>
                                    {v.color} - {v.size} (Sisa: {v.stock})
                                </option>
                            ))}
                            {selectedProduct.sizes && Object.entries(selectedProduct.sizes).map(([sz, stock]) => (
                                <option key={sz} value={sz}>
                                    Size {sz} (Sisa: {stock})
                                </option>
                            ))}
                        </select>
                    </div>
                 )}

                 {/* Quantity Input */}
                 <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jumlah Unit</label>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setQty(Math.max(1, qty-1))} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200"><MinusCircle size={20}/></button>
                        <input 
                            type="number" 
                            min="1" 
                            max={getMaxQty()} 
                            className="flex-1 text-center font-black text-2xl border-none outline-none"
                            value={qty}
                            onChange={(e) => setQty(parseInt(e.target.value) || 1)}
                        />
                        <button type="button" onClick={() => setQty(Math.min(getMaxQty(), qty+1))} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200"><PlusCircle size={20}/></button>
                    </div>
                    {qty >= getMaxQty() && actionType !== 'restock' && (
                        <p className="text-xs text-red-500 mt-2 font-bold flex items-center gap-1 justify-center">
                            <AlertCircle size={12}/> Maksimal jumlah tersedia: {getMaxQty()}
                        </p>
                    )}
                 </div>

                 {/* Action Buttons */}
                 <div className="flex gap-3 pt-4 border-t border-gray-100">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition">
                        Batal
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSubmitting || (hasVariants && !variantKey) || qty <= 0}
                        className={`flex-1 py-3 font-bold text-white rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 ${getModalColor()} hover:brightness-110`}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        Konfirmasi
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminWarehouseManager;