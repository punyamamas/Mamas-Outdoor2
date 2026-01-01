
import { supabase } from './supabase';
import { Review, Transaction } from '../types';

// Key untuk LocalStorage
const LOCAL_REVIEW_KEY = 'mamasReviews';
const LOCAL_TRX_KEY = 'mamasHistory';

export const submitReview = async (
  transactionId: string,
  customerName: string,
  rating: number,
  comment: string
): Promise<boolean> => {
  const newReview: Review = {
    id: `local-${Date.now()}`, // ID sementara
    created_at: new Date().toISOString(),
    transaction_id: transactionId,
    customer_name: customerName,
    rating: rating,
    comment: comment,
    is_public: true
  };

  // 1. SIMPAN KE LOCALSTORAGE (Jaminan Data Muncul di HP User)
  try {
    const savedReviews = localStorage.getItem(LOCAL_REVIEW_KEY);
    const localReviews: Review[] = savedReviews ? JSON.parse(savedReviews) : [];
    localReviews.push(newReview);
    localStorage.setItem(LOCAL_REVIEW_KEY, JSON.stringify(localReviews));
  } catch (e) {
    console.error("Gagal simpan review local:", e);
  }

  // 2. SIMPAN KE SUPABASE (Cloud Backup)
  if (supabase) {
    try {
      // Hapus ID 'local-' agar digenerate oleh Postgres
      const { id, ...payload } = newReview;
      const { error } = await supabase
        .from('reviews')
        .insert([payload]);

      if (error) {
        console.warn("Gagal sync review ke Supabase:", error.message);
        // Kita return true karena sudah tersimpan di Local, tapi log error
      }
    } catch (err) {
      console.error("Error submitting review to Supabase:", err);
    }
  }

  return true;
};

// ... (Fungsi getReviews dan getReviewsForProduct TETAP SAMA seperti sebelumnya, jangan diubah) ...
export const getReviews = async (): Promise<Review[]> => {
  let combinedReviews: Review[] = [];
  try {
    const savedReviews = localStorage.getItem(LOCAL_REVIEW_KEY);
    if (savedReviews) combinedReviews = JSON.parse(savedReviews);
  } catch (e) {}

  if (supabase) {
    const { data, error } = await supabase.from('reviews').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(20);
    if (!error && data) {
      const localTrxIds = new Set(combinedReviews.map(r => r.transaction_id));
      const newCloudReviews = data.filter((r: any) => !localTrxIds.has(r.transaction_id));
      combinedReviews = [...combinedReviews, ...newCloudReviews];
    }
  }
  return combinedReviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const getReviewsForProduct = async (productId: string): Promise<Review[]> => {
  try {
    let allReviews: Review[] = [];
    const savedReviews = localStorage.getItem(LOCAL_REVIEW_KEY);
    if (savedReviews) allReviews = JSON.parse(savedReviews);

    if (supabase) {
        const { data: cloudReviews, error } = await supabase.from('reviews').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(100);
        if (!error && cloudReviews) {
            const existingIds = new Set(allReviews.map(r => r.transaction_id));
            const newOnes = cloudReviews.filter((r: any) => !existingIds.has(r.transaction_id));
            allReviews = [...allReviews, ...newOnes];
        }
    }
    if (allReviews.length === 0) return [];

    let allTransactions: Transaction[] = [];
    const savedHistory = localStorage.getItem(LOCAL_TRX_KEY);
    if (savedHistory) allTransactions = JSON.parse(savedHistory);

    const reviewTrxIds = allReviews.map(r => r.transaction_id);
    const localTrxIds = new Set(allTransactions.map(t => t.id));
    const missingTrxIds = reviewTrxIds.filter(id => !localTrxIds.has(id));

    if (supabase && missingTrxIds.length > 0) {
        const { data: cloudTrx } = await supabase.from('transactions').select('id, items').in('id', missingTrxIds);
        if (cloudTrx) {
            const mappedCloudTrx = cloudTrx.map((t: any) => ({
                id: t.id, items: t.items || [], customerName: '', customerWhatsapp: '', rentalDate: '', duration: 0, totalPrice: 0, status: 'completed', amountPaid: 0
            } as Transaction));
            allTransactions = [...allTransactions, ...mappedCloudTrx];
        }
    }

    const validTransactionIds = new Set();
    allTransactions.forEach(t => {
        const items = t.items || [];
        const hasProduct = items.some((item: any) => String(item.id) === String(productId));
        if (hasProduct) validTransactionIds.add(t.id);
    });

    return allReviews.filter(r => validTransactionIds.has(r.transaction_id)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error("Error in getReviewsForProduct:", err);
    return [];
  }
};

// --- FUNGSI BARU KHUSUS ADMIN ---

export const getAllReviewsAdmin = async (): Promise<Review[]> => {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Admin fetch reviews error:", error);
      return [];
    }
    return data as Review[];
  } catch (e) {
    return [];
  }
};

export const deleteReview = async (id: string): Promise<boolean> => {
  if (!supabase) return false;
  
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', id);

  return !error;
};
