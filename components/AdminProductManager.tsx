
import React, { useState, useRef } from 'react';
import { Plus, Search, Edit, Trash2, X, Layers, Scissors, Palette, Save, Loader2, ShoppingBag, Upload, QrCode } from 'lucide-react';
import { Product, Category, ProductVariant, ColorImage, UserRole } from '../types';
import { uploadProductImage } from '../services/productService';
import QRCode from 'qrcode';

interface AdminProductManagerProps {
  products: Product[];
  categories: Category[];
  onAddProduct: (product: Product) => Promise<void>;
  onUpdateProduct: (product: Product) => Promise<void>;
  onDeleteProduct: (id: string) => Promise<void>;
  userRole?: UserRole; // NEW PROP
}

const AdminProductManager: React.FC<AdminProductManagerProps> = ({
  products,
  categories,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  userRole = 'super_admin'
}) => {
  // ... (State logic sama) ...
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // ... other states

  // ... (Handlers sama) ...
  const openModal = (product?: Product) => { /*...*/ setIsModalOpen(true); };
  const handleDelete = (id: string) => {
      if (userRole === 'staff') return alert("Akses Ditolak: Staff tidak boleh menghapus produk.");
      onDeleteProduct(id);
  }

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px] flex flex-col">
      <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between gap-4 bg-nature-50">
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
          className="bg-nature-600 hover:bg-nature-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition"
        >
          <Plus size={18} /> Tambah Produk
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 md:bg-white">
        <table className="w-full text-left text-sm text-gray-600 hidden md:table">
          <thead className="bg-white text-gray-700 font-bold uppercase text-xs border-b border-gray-200">
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
                  {product.name}
                </td>
                <td className="px-6 py-4">{product.category}</td>
                <td className="px-6 py-4 font-bold text-nature-600">
                    Rp{(product.price2Days).toLocaleString('id-ID')}
                </td>
                <td className="px-6 py-4 font-bold">{product.stock}</td>
                <td className="px-6 py-4 text-center">
                   <div className="flex justify-center gap-2">
                     <button onClick={() => openModal(product)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit size={16}/></button>
                     
                     {/* HIDE DELETE BUTTON FOR STAFF */}
                     {userRole !== 'staff' && (
                        <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                     )}
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Mobile View logic similar... hide delete button */}
      </div>
      
      {isModalOpen && (
          <div></div> // Modal form placeholder (Logika sama)
      )}
    </div>
  );
};

export default AdminProductManager;
