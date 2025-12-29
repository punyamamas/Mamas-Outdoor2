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
    customer_campus: '-', 
    rental_date: userDetails.rentalDate,
    duration: userDetails.duration,
    total_price: totalPrice,
    amount_paid: 0, // Default belum bayar
    items: cartItems, 
    status: 'pending',
    payment_method: userDetails.paymentMethod 
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

// Update Nominal Pembayaran (Manual) & Auto Status
export const updateTransactionPayment = async (id: string, amount: number): Promise<{ success: boolean; error?: string; newStatus?: string }> => {
  if (!supabase) return { success: false, error: "Supabase client not initialized" };

  // 1. Ambil data transaksi saat ini
  const { data: currentTrx, error: fetchError } = await supabase
    .from('transactions')
    .select('status, total_price')
    .eq('id', id)
    .single();

  if (fetchError || !currentTrx) {
    return { success: false, error: "Transaksi tidak ditemukan" };
  }

  // 2. Tentukan Status Baru secara Otomatis
  let newStatus = currentTrx.status;

  // RULE: 
  // Kita HANYA ubah status otomatis jika status saat ini adalah:
  // 'pending' (Belum Bayar), 'partial_payment' (Cicil), atau 'booked' (Lunas/Booking).
  // 
  // JANGAN ubah status jika barang sudah 'rented' (Sedang Sewa), 'completed' (Selesai), atau 'cancelled' (Batal).
  // Karena status 'rented' dan 'completed' itu penanda fisik barang, bukan sekedar keuangan.
  
  const manualPhysicalStatuses = ['rented', 'completed', 'cancelled'];
  
  if (!manualPhysicalStatuses.includes(currentTrx.status)) {
    if (amount <= 0) {
      newStatus = 'pending'; // 1. Belum Bayar
    } else if (amount < currentTrx.total_price) {
      newStatus = 'partial_payment'; // 2. Cicil / Belum Lunas
    } else {
      newStatus = 'booked';  // 3. Lunas / Booking (Siap Ambil)
    }
  }

  // 3. Update ke Database
  const { error } = await supabase
    .from('transactions')
    .update({ 
      amount_paid: amount,
      status: newStatus 
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating payment amount:', error);
    return { success: false, error: error.message };
  }

  return { success: true, newStatus };
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
  // Logic: 
  // - Barang keluar gudang (checkout/pending/booked/rented) -> Stok Berkurang (Sudah terjadi saat createTransaction)
  // - Barang kembali ke gudang (completed/cancelled) -> Stok Kembali
  
  const isFinalStatus = (s: string) => s === 'completed' || s === 'cancelled';
  const isActiveStatus = (s: string) => ['pending', 'partial_payment', 'booked', 'rented'].includes(s);

  // Jika berubah DARI status aktif KE status final (Selesai/Batal) -> KEMBALIKAN STOK
  if (isActiveStatus(oldStatus) && isFinalStatus(newStatus)) {
      await processStockRestoration(items);
  }
  // Jika berubah DARI status final (Selesai/Batal) KE status aktif (salah pencet batal, dibalikin ke sewa) -> KURANGI STOK LAGI
  else if (isFinalStatus(oldStatus) && isActiveStatus(newStatus)) {
      await processStockReduction(items);
  }

  return true;
};

// Delete Transaction & Restore Stock if applicable
export const deleteTransaction = async (id: string): Promise<boolean> => {
  if (!supabase) return false;

  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !trx) return false;

  const { data: deletedData, error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .select();

  if (deleteError || !deletedData || deletedData.length === 0) return false;

  // Jika menghapus transaksi yang statusnya masih 'sewa/booking' (bukan selesai/batal), stok harus dikembalikan
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
    customerCampus: dbItem.customer_campus || '-', 
    rentalDate: dbItem.rental_date,
    duration: dbItem.duration,
    totalPrice: dbItem.total_price,
    amountPaid: dbItem.amount_paid || 0, // Map amount_paid
    items: dbItem.items,
    status: dbItem.status,
    paymentMethod: dbItem.payment_method || 'cash' 
  };
};