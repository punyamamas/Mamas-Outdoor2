import React from 'react';
import { Package, Database, AlertCircle } from 'lucide-react';
import { Product } from '../types';

interface AdminStatsProps {
  products: Product[];
}

const AdminStats: React.FC<AdminStatsProps> = ({ products }) => {
  const totalAvailable = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter(p => p.stock <= 3).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Produk</p>
            <h3 className="text-2xl font-bold text-gray-900">{products.length} SKU</h3>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <Database size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Stok Ready</p>
            <h3 className="text-2xl font-bold text-gray-900">{totalAvailable} Unit</h3>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Stok Menipis</p>
            <h3 className="text-2xl font-bold text-gray-900">{lowStockCount} Item</h3>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;