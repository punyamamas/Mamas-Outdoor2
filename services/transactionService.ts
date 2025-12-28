import { supabase } from './supabase';
import { Transaction, CartItem, UserDetails } from '../types';
import { processStockReduction, processStockRestoration } from './productService';

// Create new transaction (Checkout)
export const createTransaction = async (
  userDetails: UserDetails, 
  cartItems: CartItem[], 
  totalPrice: number
): Promise<Transaction | null> => {
  if (!supabase) return null;

  const payload = {
    customer_name: userDetails.name,
    customer_whatsapp: userDetails.whatsapp,
    customer_campus: userDetails.campus,
    rental_date: userDetails.rentalDate,
    duration: userDetails.duration,
    total_price: totalPrice,
    items: cartItems, // JSONB
    status: 'pending',
    payment_method: userDetails.paymentMethod // Store payment choice
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error creating transaction:', error);
    return null;
  }

  return mapDbToTransaction(data);
};

// Get all transactions (For Admin)
export const getTransactions = async (): Promise<Transaction[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data.map(mapDbToTransaction);
};

// Update transaction status & Handle Stock Logic
export const updateTransactionStatus = async (id: string, newStatus: string): Promise<boolean> => {
  if (!supabase) return false;

  // 1. Get current status & items
  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('status, items')
    .eq('id', id)
    .single();

  if (fetchError || !trx) {
     console.error("Error fetching transaction for status update", fetchError);
     return false;
  }

  const oldStatus = trx.status;
  const items = trx.items as CartItem[];

  // 2. Update status in Database
  const { error } = await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    console.error('Error updating transaction status:', error);
    return false;
  }

  // 3. Handle Stock Logic based on status change
  // Case A: Marking as Completed (Selesai) OR Cancelled (Batal) -> Restore Stock (Return to Ready)
  // Syarat: Status sebelumnya BUKAN 'completed' atau 'cancelled' (supaya tidak restore double)
  const isFinalStatus = (s: string) => s === 'completed' || s === 'cancelled';
  
  if (isFinalStatus(newStatus) && !isFinalStatus(oldStatus)) {
      await processStockRestoration(items);
  }
  // Case B: Reverting FROM Final Status (Completed/Cancelled) TO Active/Pending -> Reduce Stock again
  else if (isFinalStatus(oldStatus) && !isFinalStatus(newStatus)) {
      await processStockReduction(items);
  }

  return true;
};

// Delete Transaction & Restore Stock if applicable
export const deleteTransaction = async (id: string): Promise<boolean> => {
  if (!supabase) return false;

  // 1. Ambil data transaksi (Snapshot) sebelum dihapus untuk cek status & items
  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !trx) {
    console.error('Error fetching transaction to delete:', fetchError);
    return false;
  }

  // 2. Hapus data dari database
  // PENTING: Gunakan .select() untuk memastikan baris benar-benar terhapus (mengatasi silent fail RLS)
  const { data: deletedData, error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .select();

  if (deleteError) {
    console.error('Error deleting transaction:', deleteError);
    return false;
  }

  // Jika deletedData kosong atau null, berarti tidak ada baris yang terhapus 
  // (Mungkin karena ID salah atau Policy RLS memblokir delete)
  if (!deletedData || deletedData.length === 0) {
    console.error('Delete failed: No rows were deleted. Check Supabase RLS policies.');
    return false;
  }

  // 3. Logika Pengembalian Stok
  // Dijalankan hanya jika delete BERHASIL (deletedData ada isinya)
  // Jika status BUKAN 'completed'/'cancelled', berarti barang masih dihitung keluar, jadi harus dikembalikan.
  if (trx.status !== 'completed' && trx.status !== 'cancelled') {
    await processStockRestoration(trx.items as CartItem[]);
  }

  return true;
};

// Helper Mapper
const mapDbToTransaction = (dbItem: any): Transaction => {
  return {
    id: dbItem.id.toString(),
    created_at: dbItem.created_at,
    customerName: dbItem.customer_name,
    customerWhatsapp: dbItem.customer_whatsapp,
    customerCampus: dbItem.customer_campus,
    rentalDate: dbItem.rental_date,
    duration: dbItem.duration,
    totalPrice: dbItem.total_price,
    items: dbItem.items,
    status: dbItem.status,
    paymentMethod: dbItem.payment_method || 'cash' // Fallback to cash if null
  };
};