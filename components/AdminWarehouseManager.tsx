import React, { useState } from 'react';
import { Search, PlusCircle, MinusCircle, HeartCrack, Hammer, ArrowRightLeft, Layers, Save, X, FileText } from 'lucide-react';
import { Product, Category } from '../types';

interface AdminWarehouseManagerProps {
  products: Product[];
  categories: Category[];
  onUpdateProduct: (product: Product) => Promise<void>;
}

const AdminWarehouseManager: React.FC<AdminWarehouseManagerProps> = ({ products, categories, onUpdateProduct }) => {
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'rented' | 'damaged'>('all');
  const [catFilter, setCatFilter] = useState('Semua');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Return Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnProduct, setReturnProduct] = useState<Product | null>(null);
  const [returnVariantKey, setReturnVariantKey] = useState('');
  const [returnQty, setReturnQty] = useState(1);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = true;
    if (filter === 'low_stock') matchesStatus = p.stock <= 3;
    if (filter === 'rented') matchesStatus = (p.rented || 0) > 0;
    if (filter === 'damaged') matchesStatus = (p.damaged || 0) > 0;
    const matchesCat = catFilter === 'Semua' || p.category === catFilter;
    return matchesSearch && matchesStatus && matchesCat;
  });

  const handleRestock = async (product: Product) => {
    const qty = prompt(`Tambah stok baru untuk "${product.name}"?`, "1");
    if (!qty) return;
    const val = parseInt(qty);
    if (!isNaN(val) && val > 0) await onUpdateProduct({ ...product, stock: product.stock + val });
  };

  const handleManualRent = async (product: Product) => {
    if (product.stock <= 0) return;
    const qty = prompt(`Keluarkan manual "${product.name}"?`, "1");
    if (!qty) return;
    const val = parseInt(qty);
    if (!isNaN(val) && val > 0 && val <= product.stock) {
      await onUpdateProduct({ ...product, stock: product.stock - val, rented: (product.rented || 0) + val });
    }
  };

  const handleReportDamage = async (product: Product) => {
    if (product.stock <= 0) return;
    if (confirm(`Lapor 1 unit "${product.name}" RUSAK?`)) {
      await onUpdateProduct({ ...product, stock: product.stock - 1, damaged: (product.damaged || 0) + 1 });
    }
  };

  const handleRepairFinish = async (product: Product) => {
    if (!product.damaged || product.damaged <= 0) return;
    if (confirm(`1 unit "${product.name}" sudah DIPERBAIKI?`)) {
      await onUpdateProduct({ ...product, stock: product.stock + 1, damaged: product.damaged - 1 });
    }
  };

  const handleReturnFromRent = async (product: Product) => {
    if (!product.rented || product.rented <= 0) return;
    const isComplex = (product.variants && product.variants.length > 0) || (product.sizes && Object.keys(product.sizes).length > 0);
    
    if (isComplex) {
      setReturnProduct(product);
      setReturnQty(1);
      setReturnVariantKey('');
      setIsReturnModalOpen(true);
    } else {
      const qty = prompt(`Berapa unit "${product.name}" kembali?`, "1");
      if (!qty) return;
      const val = parseInt(qty);
      if (!isNaN(val) && val > 0 && val <= product.rented) {
        await onUpdateProduct({ ...product, stock: product.stock + val, rented: product.rented - val });
      }
    }
  };

  const handleComplexReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnProduct || !returnVariantKey) return;
    const updated = { ...returnProduct };
    const rentedCount = updated.rented || 0;
    
    if (returnQty > rentedCount) return alert('Jumlah melebihi barang sewa');
    
    updated.stock = (updated.stock || 0) + returnQty;
    updated.rented = rentedCount - returnQty;

    if (updated.variants?.length) {
       const [color, size] = returnVariantKey.split('|');
       const vars = [...updated.variants];
       const idx = vars.findIndex(v => v.color === color && v.size === size);
       if (idx !== -1) {
         vars[idx] = { ...vars[idx], stock: vars[idx].stock + returnQty };
         updated.variants = vars;
       }
    } else if (updated.sizes) {
      const sz = { ...updated.sizes };
      sz[returnVariantKey] = (sz[returnVariantKey] || 0) + returnQty;
      updated.sizes = sz;
    }

    await onUpdateProduct(updated);
    setIsReturnModalOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header & Filters */}
      <div className="p-5 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
           <h3 className="font-bold text-gray-800 flex items-center gap-2"><FileText size={18} /> Laporan Stok</h3>
           <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
              {['all', 'rented', 'damaged'].map(f => (
                <button key={f} onClick={() => setFilter(f as any)} 
                  className={`px-3 py-1 text-xs font-bold rounded-md transition capitalize ${filter === f ? 'bg-white shadow text-nature-700' : 'text-gray-500'}`}>
                  {f === 'all' ? 'Semua' : f === 'rented' ? 'Keluar' : 'Rusak'}
                </button>
              ))}
           </div>
           <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="text-xs font-bold p-1.5 rounded border">
              <option value="Semua">Semua Kategori</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
           </select>
        </div>
        <div className="relative">
           <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
           <input type="text" placeholder="Cari SKU / Nama..." className="pl-9 pr-4 py-2 text-sm border rounded-lg w-full" 
             value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
            <tr>
               <th className="px-6 py-4">Nama Barang</th>
               <th className="px-4 py-4 text-center bg-green-50 text-green-700">Ready</th>
               <th className="px-4 py-4 text-center bg-blue-50 text-blue-700">Keluar</th>
               <th className="px-4 py-4 text-center bg-red-50 text-red-700">Rusak</th>
               <th className="px-6 py-4 text-center">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map(p => {
              const isComplex = (p.variants && p.variants.length > 0) || (p.sizes && Object.keys(p.sizes).length > 0);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                     {p.name}
                     {isComplex && <span className="block text-[10px] text-purple-600 italic">Multi-Varian</span>}
                  </td>
                  <td className="text-center font-bold text-green-700 bg-green-50/30">{p.stock}</td>
                  <td className="text-center font-bold text-blue-600 bg-blue-50/30">{p.rented || '-'}</td>
                  <td className="text-center font-bold text-red-600 bg-red-50/30">{p.damaged || '-'}</td>
                  <td className="px-6 py-4 text-center flex justify-center gap-2">
                     <button onClick={() => handleRestock(p)} disabled={isComplex} className="p-1.5 hover:bg-green-100 text-gray-400 hover:text-green-600 rounded disabled:opacity-30"><PlusCircle size={18}/></button>
                     <button onClick={() => handleManualRent(p)} disabled={p.stock<=0 || isComplex} className="p-1.5 hover:bg-blue-100 text-gray-400 hover:text-blue-600 rounded disabled:opacity-30"><MinusCircle size={18}/></button>
                     <button onClick={() => handleReturnFromRent(p)} disabled={(p.rented||0)<=0} className="p-1.5 hover:bg-blue-100 text-blue-600 rounded disabled:opacity-30 border border-blue-200"><ArrowRightLeft size={18}/></button>
                     <button onClick={() => handleReportDamage(p)} disabled={p.stock<=0 || isComplex} className="p-1.5 hover:bg-red-100 text-gray-400 hover:text-red-600 rounded disabled:opacity-30"><HeartCrack size={18}/></button>
                     <button onClick={() => handleRepairFinish(p)} disabled={(p.damaged||0)<=0 || isComplex} className="p-1.5 hover:bg-green-100 text-gray-400 hover:text-green-600 rounded disabled:opacity-30"><Hammer size={18}/></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Return Modal for Complex Products */}
      {isReturnModalOpen && returnProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
           <div className="absolute inset-0 bg-black/50" onClick={() => setIsReturnModalOpen(false)}></div>
           <div className="relative bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <h3 className="font-bold text-lg mb-4">Pengembalian Barang Varian</h3>
              <p className="text-sm text-gray-600 mb-4">{returnProduct.name}</p>
              <form onSubmit={handleComplexReturnSubmit} className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold mb-1">Varian / Ukuran</label>
                    <select className="w-full border rounded p-2" value={returnVariantKey} onChange={e => setReturnVariantKey(e.target.value)} required>
                       <option value="">Pilih...</option>
                       {returnProduct.variants?.map((v, i) => (
                          <option key={i} value={`${v.color}|${v.size}`}>{v.color} - {v.size}</option>
                       ))}
                       {returnProduct.sizes && Object.keys(returnProduct.sizes).map(sz => (
                          <option key={sz} value={sz}>{sz}</option>
                       ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-bold mb-1">Jumlah Kembali</label>
                    <input type="number" min="1" max={returnProduct.rented} className="w-full border rounded p-2" value={returnQty} onChange={e => setReturnQty(parseInt(e.target.value))} />
                 </div>
                 <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsReturnModalOpen(false)} className="px-4 py-2 border rounded">Batal</button>
                    <button type="submit" className="px-4 py-2 bg-nature-600 text-white rounded font-bold">Simpan</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminWarehouseManager;