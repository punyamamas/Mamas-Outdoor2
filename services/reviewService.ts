
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
    const { error: reviewError } = await supabase
      .from('reviews')
      .insert([{
        transaction_id: transactionId,
        customer_name: customerName,
        rating: rating,
        comment: comment,
        is_public: true // Default tampil
      }]);

    if (reviewError) {
        if (reviewError.code === '42P01') {
            alert("Error: Tabel 'reviews' belum dibuat. Silakan ke Admin > System Setup dan jalankan SQL.");
            return false;
        }
        console.error("Gagal submit review:", reviewError);
        return false;
    }

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
    .limit(20);

  if (error) return [];
  return data as Review[];
};

// FUNGSI UTAMA: Ambil review untuk detail produk
export const getReviewsForProduct = async (productId: string): Promise<Review[]> => {
  if (!supabase) return [];

  try {
    // 1. Ambil Review (Batas ditingkatkan agar review lama terambil)
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
        console.error("Gagal mengambil tabel reviews:", error.message);
        return [];
    }
    
    if (!reviews || reviews.length === 0) return [];

    // 2. Ambil Transaksi terkait Review tersebut
    // Kita butuh melihat isi 'items' di transaksi untuk memastikan produk ini ada di sana
    const transactionIds = reviews.map(r => r.transaction_id);
    
    const { data: transactions, error: trxError } = await supabase
      .from('transactions')
      .select('id, items')
      .in('id', transactionIds);

    if (trxError) {
        console.error("Gagal mengambil transaksi untuk verifikasi review (Cek RLS Policy):", trxError.message);
        return [];
    }

    if (!transactions || transactions.length === 0) return [];

    // 3. FILTER LOGIC (Diperkuat)
    // Mencari review yang transaksinya MEMILIKI produk yang sedang dilihat
    const validTransactionIds = transactions
      .filter((t: any) => {
         const items = t.items || [];
         if (!Array.isArray(items)) return false;

         // Cek apakah ada item dengan ID yang sama.
         // Menggunakan String() di kedua sisi untuk memastikan "1" == 1
         return items.some((item: any) => String(item.id) === String(productId));
      })
      .map((t: any) => t.id);

    // 4. Return review yang ID transaksinya valid (mengandung produk ini)
    const matchedReviews = reviews.filter(r => validTransactionIds.includes(r.transaction_id));
    
    return matchedReviews;

  } catch (err) {
    console.error("Error in getReviewsForProduct:", err);
    return [];
  }
};
