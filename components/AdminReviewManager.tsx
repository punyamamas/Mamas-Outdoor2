
import React, { useState, useEffect } from 'react';
import { Star, Trash2, MessageSquare, Loader2, RefreshCcw, User } from 'lucide-react';
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
      <div className="p-4 md:p-6 border-b border-gray-100 bg-nature-50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-lg text-nature-800 flex items-center gap-2">
            <MessageSquare size={20} /> Manajemen Ulasan
          </h3>
          <p className="text-xs text-nature-600 mt-1">
            Ulasan pelanggan dari database.
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

      <div className="p-0 md:p-0">
        {reviews.length === 0 && !isLoading ? (
          <div className="p-10 text-center text-gray-400">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
            <p>Belum ada ulasan masuk di Database.</p>
          </div>
        ) : (
          <>
            {/* MOBILE CARD VIEW */}
            <div className="md:hidden divide-y divide-gray-100 bg-gray-50">
                {reviews.map((r) => (
                    <div key={r.id} className="p-4 bg-white mb-2 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                                    <User size={16} className="text-gray-500"/>
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-gray-800">{r.customer_name}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString('id-ID')}</p>
                                </div>
                            </div>
                            <div className="flex text-yellow-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={12} fill={i < r.rating ? "currentColor" : "none"} className={i >= r.rating ? "text-gray-200" : ""} />
                                ))}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 italic border border-gray-100 mb-3 relative">
                            <div className="absolute -top-1.5 left-4 w-3 h-3 bg-gray-50 border-t border-l border-gray-100 transform rotate-45"></div>
                            "{r.comment}"
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-400 font-mono">TRX: {r.transaction_id.slice(0,8)}</span>
                            <button onClick={() => handleDelete(r.id)} className="text-red-500 text-xs font-bold flex items-center gap-1">
                                <Trash2 size={12}/> Hapus
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
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
                            day: 'numeric', month: 'short', year: 'numeric'
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminReviewManager;
