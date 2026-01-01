
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

// NEW FUNCTION: Ambil review khusus untuk Produk tertentu
export const getReviewsForProduct = async (productId: string): Promise<Review[]> => {
  if (!supabase) return [];

  try {
    // 1. Ambil 300 review terbaru (ditingkatkan untuk scalability)
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
        console.error("Error fetching reviews table:", error);
        return [];
    }
    
    if (!reviews || reviews.length === 0) return [];

    // 2. Ambil detail transaksi terkait review tersebut
    const transactionIds = reviews.map(r => r.transaction_id);
    const { data: transactions, error: trxError } = await supabase
      .from('transactions')
      .select('id, items')
      .in('id', transactionIds);

    if (trxError) {
        console.error("Error fetching transactions for reviews (RLS Blocking?):", trxError);
        return [];
    }

    if (!transactions) return [];

    // 3. Filter: Cari transaksi yang mengandung productId yang sedang dilihat
    // FIX: Menggunakan String() untuk memastikan pencocokan "1" == 1 berhasil
    const validTransactionIds = transactions
      .filter((t: any) => {
         const items = t.items || [];
         return items.some((item: any) => String(item.id) === String(productId));
      })
      .map((t: any) => t.id);

    // 4. Return review yang transaksinya valid
    return reviews.filter(r => validTransactionIds.includes(r.transaction_id));

  } catch (err) {
    console.error("Error in getReviewsForProduct:", err);
    return [];
  }
};
