
import React, { useState, useEffect } from 'react';
import { Star, Trash2, MessageSquare, Loader2, RefreshCcw } from 'lucide-react';
import { getAllReviewsAdmin, deleteReview } from '../services/reviewService';
import { Review } from '../types';

const AdminReviewManager: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReviews = async () => {
    setIsLoading(true);
    const data = await getAllReviewsAdmin();
    setReviews(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Yakin hapus ulasan ini permanen?")) {
      const success = await deleteReview(id);
      if (success) {
        setReviews(prev => prev.filter(r => r.id !== id));
      } else {
        alert("Gagal menghapus. Cek koneksi.");
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 bg-nature-50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <MessageSquare size={20} /> Manajemen Ulasan
          </h3>
          <p className="text-xs text-nature-600 mt-1">
            Daftar ulasan yang berhasil tersimpan di Database Supabase.
          </p>
        </div>
        <button 
          onClick={fetchReviews} 
          className="p-2 bg-white text-nature-600 rounded-lg shadow-sm hover:bg-nature-50 transition border border-nature-100"
          title="Refresh Data"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20}/> : <RefreshCcw size={20}/>}
        </button>
      </div>

      <div className="overflow-x-auto">
        {reviews.length === 0 && !isLoading ? (
          <div className="p-10 text-center text-gray-400">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
            <p>Belum ada ulasan masuk di Database.</p>
            <p className="text-xs mt-1">(Jika user sudah review tapi tidak muncul disini, berarti hanya tersimpan di HP user karena masalah koneksi/RLS)</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Pelanggan</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Komentar</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviews.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-800">
                    {r.customer_name}
                    <div className="text-[10px] text-gray-400 font-mono font-normal mt-0.5">TRX: {r.transaction_id.slice(0,8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} fill={i < r.rating ? "currentColor" : "none"} className={i >= r.rating ? "text-gray-200" : ""} />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-md">
                    <p className="line-clamp-2 italic">"{r.comment}"</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleDelete(r.id)}
                      className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition"
                      title="Hapus Ulasan"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminReviewManager;
