
import React, { useState } from 'react';
import { Tags, Plus, Edit, Trash2, Save, X, Loader2 } from 'lucide-react';
import { Category } from '../types';

interface AdminCategoryManagerProps {
  categories: Category[];
  onAddCategory: (name: string) => Promise<void>;
  onUpdateCategory: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const AdminCategoryManager: React.FC<AdminCategoryManagerProps> = ({
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCategoryAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSubmitting(true);
    await onAddCategory(newCategoryName);
    setNewCategoryName('');
    setIsSubmitting(false);
  };

  const startEditing = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
  };

  const saveEditCategory = async (id: string) => {
    if (!editCategoryName.trim()) return;
    await onUpdateCategory(id, editCategoryName);
    setEditingCategoryId(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-4xl">
      <div className="p-5 border-b border-gray-100 bg-nature-50">
        <h3 className="font-bold text-nature-800 flex items-center gap-2">
          <Tags size={18} /> Kelola Kategori
        </h3>
      </div>
      
      <div className="p-4 md:p-6">
        {/* Form Tambah - Responsif */}
        <form onSubmit={handleCategoryAdd} className="flex flex-col md:flex-row gap-3 mb-8">
          <input 
            type="text" 
            placeholder="Nama Kategori Baru..."
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <button 
            type="submit"
            disabled={!newCategoryName.trim() || isSubmitting}
            className="bg-nature-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-nature-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <Plus size={18} />} 
            Tambah
          </button>
        </form>

        {/* List Kategori */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
              {editingCategoryId === cat.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-1 text-sm border border-blue-300 rounded focus:outline-none"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                  />
                  <button onClick={() => saveEditCategory(cat.id)} className="p-1 text-green-600 bg-green-100 rounded hover:bg-green-200"><Save size={16}/></button>
                  <button onClick={() => setEditingCategoryId(null)} className="p-1 text-gray-500 bg-gray-200 rounded hover:bg-gray-300"><X size={16}/></button>
                </div>
              ) : (
                <span className="font-medium text-gray-700">{cat.name}</span>
              )}
              
              {editingCategoryId !== cat.id && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => startEditing(cat)}
                    className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => onDeleteCategory(cat.id)}
                    className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminCategoryManager;
