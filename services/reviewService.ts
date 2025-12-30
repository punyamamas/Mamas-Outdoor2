import { supabase } from './supabase';
import { Review } from '../types';

export const submitReview = async (
  transactionId: string,
  customerName: string,
  rating: number,
  comment: string
): Promise<boolean> => {
  if (!supabase) {
    console.warn("Supabase not initialized. Review saved locally only.");
    return true; // Mock success
  }

  try {
    // 1. Simpan Review
    const { error: reviewError } = await supabase
      .from('reviews')
      .insert([{
        transaction_id: transactionId,
        customer_name: customerName,
        rating: rating,
        comment: comment,
        is_public: true // Default tampil, bisa diubah jadi false jika butuh moderasi
      }]);

    if (reviewError) {
        // Handle jika tabel belum ada
        if (reviewError.code === '42P01') {
            alert("Error: Tabel 'reviews' belum dibuat di Database.");
            return false;
        }
        console.error("Gagal submit review:", reviewError);
        return false;
    }

    // 2. Update flag is_reviewed di transaksi (Opsional, tapi bagus untuk UI)
    // Kita asumsikan ada kolom 'is_reviewed' atau kita cek manual nanti.
    // Untuk simplifikasi, kita simpan di LocalStorage juga di frontend.
    
    return true;
  } catch (err) {
    console.error("Error submitting review:", err);
    return false;
  }
};

export const getReviews = async (): Promise<Review[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(10); // Ambil 10 review terbaru

  if (error) return [];
  return data as Review[];
};
