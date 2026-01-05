
import React, { useState } from 'react';
import { Search, PlusCircle, MinusCircle, HeartCrack, Hammer, ArrowRightLeft, FileText, X, Save, AlertCircle, Package, Loader2, Printer, Camera, History, ArrowRight } from 'lucide-react';
import { Product, Category, StockLog } from '../types';
import { getStoreConfig } from '../utils/storeConfig';
import { logStockMutation, getStockLogs } from '../services/productService';
import QRScannerModal from './QRScannerModal';

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
  const [actionNote, setActionNote] = useState(''); // NEW: Reason Note
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const filteredProducts = products.filter(p => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchLower) || p.id.toLowerCase().includes(searchLower);
    let matchesStatus = true;
    if (filter === 'low_stock') matchesStatus = p.stock <= 3;
    if (filter === 'rented') matchesStatus = (p.rented || 0) > 0;
    if (filter === 'damaged') matchesStatus = (p.damaged || 0) > 0;
    const matchesCat = catFilter === 'Semua' || p.category === catFilter;
    return matchesSearch && matchesStatus && matchesCat;
  });

  const handleScanSuccess = (decodedText: string) => {
      setSearchTerm(decodedText); 
      setIsScannerOpen(false); 
  };

  const handleViewHistory = async (product: Product) => {
      setSelectedProduct(product);
      setIsHistoryOpen(true);
      setIsLoadingLogs(true);
      const logs = await getStockLogs(product.id);
      setStockLogs(logs);
      setIsLoadingLogs(false);
  };

  const handlePrintStockOpname = () => {
    // ... (Logika cetak tidak berubah)
    const printWindow = window.open('', '', 'width=800,height=800');
    if (!printWindow) return;

    const config = getStoreConfig();
    const dateStr = new Date().toLocaleDateString('id-ID', { weekday:'long', year: 'numeric', month: 'long', day: 'numeric' });

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
    setVariantKey(''); 
    setActionNote(''); // Reset Note
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

  const getMaxQty = () => {
    if (!selectedProduct) return 9999;
    
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
        case 'manual_rent': 
        case 'damage':      
            return getVariantStock('stock');
        case 'return':      
            return selectedProduct.rented || 0; 
        case 'repair':      
            return selectedProduct.damaged || 0; 
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
    const prevStock = updatedProduct.stock;

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

    // 3. LOGGING (Kartu Stok)
    await logStockMutation({
       product_id: updatedProduct.id,
       product_name: updatedProduct.name + (variantKey ? ` (${variantKey})` : ''),
       type: actionType === 'restock' || actionType === 'return' || actionType === 'repair' ? 'IN' : 'OUT',
       qty: qty,
       previous_stock: prevStock,
       current_stock: updatedProduct.stock,
       reason: `Manual Action: ${actionType.toUpperCase()}${actionNote ? ' - ' + actionNote : ''}`
    });

    await onUpdateProduct(updatedProduct);
    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const hasVariants = selectedProduct && ((selectedProduct.variants?.length || 0) > 0 || (selectedProduct.sizes && Object.keys(selectedProduct.sizes).length > 0));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      
      <QRScannerModal 
         isOpen={isScannerOpen} 
         onClose={() => setIsScannerOpen(false)} 
         onScanSuccess={handleScanSuccess} 
      />

      {/* Header & Filters - STACKED ON MOBILE */}
      <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-4 bg-nature-50">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
           <h3 className="font-bold text-nature-800 flex items-center gap-2"><FileText size={18} /> Stok Gudang</h3>
           <div className="flex gap-2 bg-white p-1 rounded-lg border border-gray-200 w-full md:w-auto overflow-x-auto">
              {['all', 'rented', 'damaged'].map(f => (
                <button key={f} onClick={() => setFilter(f as any)} 
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition capitalize whitespace-nowrap ${filter === f ? 'bg-nature-100 text-nature-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {f === 'all' ? 'Semua' : f === 'rented' ? 'Sedang Disewa' : 'Rusak'}
                </button>
              ))}
           </div>
           <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="text-xs font-bold p-2 rounded-lg border border-gray-200 outline-none focus:border-nature-500 w-full md:w-auto">
              <option value="Semua">Semua Kategori</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
           </select>
        </div>
        <div className="flex gap-2">
           <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input type="text" placeholder="Cari SKU / Nama..." className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full focus:ring-2 focus:ring-nature-500 outline-none" 
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
           <button onClick={() => setIsScannerOpen(true)} className="bg-gray-800 hover:bg-gray-900 text-white p-2 rounded-lg transition shadow-sm"><Camera size={18}/></button>
           <button onClick={handlePrintStockOpname} className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg transition shadow-sm border border-gray-200"><Printer size={18}/></button>
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden p-4 space-y-3 bg-gray-50">
          {filteredProducts.length === 0 ? (
              <div className="text-center p-8 text-gray-400">Tidak ada barang.</div>
          ) : (
              filteredProducts.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                          <div>
                              <h4 className="font-bold text-gray-800">{p.name}</h4>
                              <button onClick={() => handleViewHistory(p)} className="text-xs text-nature-600 flex items-center gap-1 mt-1 font-bold"><History size={12}/> Kartu Stok</button>
                          </div>
                          <div className="text-right">
                              <span className="text-lg font-black text-green-700">{p.stock}</span>
                              <span className="text-[10px] text-gray-400 block">Ready</span>
                          </div>
                      </div>
                      
                      <div className="flex gap-2 mb-3">
                          <div className="flex-1 bg-blue-50 rounded p-2 text-center">
                              <span className="block text-blue-700 font-bold">{p.rented || 0}</span>
                              <span className="text-[9px] text-blue-600 uppercase">Sewa</span>
                          </div>
                          <div className="flex-1 bg-red-50 rounded p-2 text-center">
                              <span className="block text-red-600 font-bold">{p.damaged || 0}</span>
                              <span className="text-[9px] text-red-500 uppercase">Rusak</span>
                          </div>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                            <button onClick={() => openActionModal(p, 'restock')} className="flex-1 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100">+ Stok</button>
                            <button onClick={() => openActionModal(p, 'return')} disabled={(p.rented||0)<=0} className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100 disabled:opacity-50">Kembali</button>
                            <button onClick={() => openActionModal(p, 'damage')} className="flex-1 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-100">Rusak</button>
                            <button onClick={() => openActionModal(p, 'repair')} disabled={(p.damaged||0)<=0} className="flex-1 py-2 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold border border-orange-100 disabled:opacity-50">Fix</button>
                      </div>
                  </div>
              ))
          )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-x-auto min-h-[400px]">
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
            {filteredProducts.length === 0 ? (
                <tr>
                    <td colSpan={5} className="text-center p-8 text-gray-400">Barang tidak ditemukan. Coba scan atau cari dengan nama lain.</td>
                </tr>
            ) : (
                filteredProducts.map(p => {
                const isComplex = (p.variants && p.variants.length > 0) || (p.sizes && Object.keys(p.sizes).length > 0);
                return (
                    <tr key={p.id} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4">
                        <div className="font-bold text-gray-800 flex items-center gap-2">
                            {p.name}
                            <button 
                                onClick={() => handleViewHistory(p)}
                                className="text-gray-400 hover:text-nature-600 p-1 rounded-full hover:bg-nature-50 transition"
                                title="Lihat Kartu Stok"
                            >
                                <History size={14}/>
                            </button>
                        </div>
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
                })
            )}
          </tbody>
        </table>
      </div>

      {/* UNIFIED ACTION MODAL - FIXED WIDTH FOR MOBILE */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
           <div className="relative bg-white rounded-2xl w-full max-w-sm md:max-w-md shadow-2xl overflow-hidden animate-slide-in-right">
              
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
                            Pilih Varian
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
                 <div className="mb-4">
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
                            <AlertCircle size={12}/> Maksimal: {getMaxQty()}
                        </p>
                    )}
                 </div>

                 <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Catatan</label>
                    <input 
                        type="text"
                        placeholder="Contoh: Beli di Toko X, Rusak Frame, dll"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-nature-500 outline-none"
                        value={actionNote}
                        onChange={(e) => setActionNote(e.target.value)}
                    />
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

      {/* STOCK HISTORY MODAL */}
      {isHistoryOpen && selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHistoryOpen(false)}></div>
             <div className="relative bg-white rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-slide-in-right">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                   <div>
                      <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                         <History size={20} className="text-nature-600"/> Kartu Stok
                      </h3>
                      <p className="text-sm font-bold text-gray-600">{selectedProduct.name}</p>
                   </div>
                   <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                   {isLoadingLogs ? (
                      <div className="flex justify-center items-center h-40">
                         <Loader2 className="animate-spin text-nature-600" size={32}/>
                      </div>
                   ) : stockLogs.length === 0 ? (
                      <div className="p-10 text-center text-gray-400 italic">Belum ada riwayat mutasi stok.</div>
                   ) : (
                      <table className="w-full text-sm text-left">
                         <thead className="bg-gray-100 text-gray-600 font-bold text-xs sticky top-0">
                            <tr>
                               <th className="px-4 py-3">Tanggal</th>
                               <th className="px-4 py-3">Tipe</th>
                               <th className="px-4 py-3">Ket</th>
                               <th className="px-4 py-3 text-right">Jumlah</th>
                               <th className="px-4 py-3 text-right">Saldo</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {stockLogs.map((log) => (
                               <tr key={log.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                     {new Date(log.created_at).toLocaleString('id-ID')}
                                  </td>
                                  <td className="px-4 py-3">
                                     <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                                        log.type === 'IN' ? 'bg-green-50 text-green-700 border-green-200' :
                                        log.type === 'OUT' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        log.type === 'DAMAGE' ? 'bg-red-50 text-red-700 border-red-200' :
                                        'bg-gray-100 text-gray-700'
                                     }`}>
                                        {log.type}
                                     </span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={log.reason}>
                                     {log.reason}
                                  </td>
                                  <td className={`px-4 py-3 text-right font-bold ${log.type === 'IN' ? 'text-green-600' : 'text-red-500'}`}>
                                     {log.type === 'IN' ? '+' : '-'}{log.qty}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">
                                     {log.current_stock}
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   )}
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default AdminWarehouseManager;
