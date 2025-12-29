import { supabase } from './supabase';
import { Transaction, CartItem, UserDetails, PaymentLog } from '../types';
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

// NEW: Record Payment Log (Mencatat arus uang masuk/keluar ke tabel logs)
export const recordPaymentLog = async (log: Omit<PaymentLog, 'id' | 'created_at'>): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('payment_logs')
    .insert([log]);

  if (error) {
    console.error('Error recording payment log:', error);
    // Jika error karena tabel belum ada, alert admin (Dev mode only info)
    if (error.code === '42P01') { 
      // Error akan ditangkap UI AdminFinanceManager juga
      console.warn("Tabel payment_logs belum dibuat.");
    }
    return false;
  }
  return true;
};

// NEW: Get Payment Logs by Date Range (Fixed Timezone Issue)
export const getPaymentLogs = async (startDate: string, endDate: string): Promise<{ data: PaymentLog[], error: any }> => {
  if (!supabase) return { data: [], error: null };

  // Parse YYYY-MM-DD string to Local Date Objects explicitly
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);

  // Construct Local Midnight for Start (00:00:00)
  const startLocal = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  
  // Construct Local End of Day for End (23:59:59)
  const endLocal = new Date(ey, em - 1, ed, 23, 59, 59, 999);

  const { data, error } = await supabase
    .from('payment_logs')
    .select('*')
    .gte('created_at', startLocal.toISOString())
    .lte('created_at', endLocal.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching logs:', error);
    return { data: [], error };
  }
  
  return { data: data as PaymentLog[], error: null };
};


// Update Nominal Pembayaran (Manual) & Auto Status & RECORD LOG
export const updateTransactionPayment = async (
  id: string, 
  newTotalPaid: number,
  logDetails?: { cashAmount: number; transferAmount: number; description: string }
): Promise<{ success: boolean; error?: string; newStatus?: string }> => {
  if (!supabase) return { success: false, error: "Supabase client not initialized" };

  // 1. Ambil data transaksi saat ini
  const { data: currentTrx, error: fetchError } = await supabase
    .from('transactions')
    .select('status, total_price, amount_paid')
    .eq('id', id)
    .single();

  if (fetchError || !currentTrx) {
    return { success: false, error: "Transaksi tidak ditemukan" };
  }

  // 2. RECORD LOG KEUANGAN (Jika ada detail log)
  if (logDetails) {
    const { cashAmount, transferAmount, description } = logDetails;
    
    if (cashAmount > 0) {
      await recordPaymentLog({
        transaction_id: id,
        amount: cashAmount,
        payment_method: 'cash',
        type: 'IN',
        description: `Cash: ${description}`,
        category: 'Sewa'
      });
    }

    if (transferAmount > 0) {
      await recordPaymentLog({
        transaction_id: id,
        amount: transferAmount,
        payment_method: 'transfer',
        type: 'IN',
        description: `Transfer: ${description}`,
        category: 'Sewa'
      });
    }
  }

  // 3. Tentukan Status Baru secara Otomatis
  let newStatus = currentTrx.status;
  const manualPhysicalStatuses = ['rented', 'completed', 'cancelled'];
  
  if (!manualPhysicalStatuses.includes(currentTrx.status)) {
    if (newTotalPaid <= 0) {
      newStatus = 'pending'; 
    } else if (newTotalPaid < currentTrx.total_price) {
      newStatus = 'partial_payment';
    } else {
      newStatus = 'booked';  
    }
  }

  // 4. Update ke Database Transaksi
  const { error } = await supabase
    .from('transactions')
    .update({ 
      amount_paid: newTotalPaid,
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

  const { error } = await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    console.error('Error updating transaction status:', error);
    return false;
  }

  const isFinalStatus = (s: string) => s === 'completed' || s === 'cancelled';
  const isActiveStatus = (s: string) => ['pending', 'partial_payment', 'booked', 'rented'].includes(s);

  if (isActiveStatus(oldStatus) && isFinalStatus(newStatus)) {
      await processStockRestoration(items);
  }
  else if (isFinalStatus(oldStatus) && isActiveStatus(newStatus)) {
      await processStockReduction(items);
  }

  return true;
};

// HELPER: Hitung harga item berdasarkan durasi
const calculateItemPriceForDuration = (item: CartItem, duration: number): number => {
    const p2 = item.price2Days || 0;
    const p3 = item.price3Days || 0;
    const p4 = item.price4Days || 0;
    const p5 = item.price5Days || 0;
    const p6 = item.price6Days || 0;
    const p7 = item.price7Days || 0;

    let unitPrice = 0;
    if (duration <= 2) unitPrice = p2;
    else if (duration === 3) unitPrice = p3;
    else if (duration === 4) unitPrice = p4;
    else if (duration === 5) unitPrice = p5;
    else if (duration === 6) unitPrice = p6;
    else unitPrice = p7 + ((duration - 7) * (p2 * 0.4)); 

    return unitPrice;
};

// NEW: Edit Transaction Items (Change Qty, Add/Remove)
export const updateTransactionItems = async (
  transactionId: string,
  newItems: CartItem[]
): Promise<boolean> => {
  if (!supabase) return false;

  // 1. Get current transaction details
  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .single();

  if (fetchError || !trx) return false;

  const oldItems = trx.items as CartItem[];
  const duration = trx.duration;
  const status = trx.status;

  // 2. Calculate New Total Price
  let newTotalPrice = 0;
  for (const item of newItems) {
      const unitPrice = calculateItemPriceForDuration(item, duration);
      newTotalPrice += (unitPrice * item.quantity);
  }

  // 3. Handle Stock Rotation if active transaction
  // Logic: Restore all OLD stock -> Deduct all NEW stock
  // This handles removal, addition, and quantity changes cleanly
  const isActive = ['pending', 'partial_payment', 'booked', 'rented'].includes(status);
  
  if (isActive) {
      await processStockRestoration(oldItems);
      await processStockReduction(newItems);
  }

  // 4. Update Transaction
  // Note: We do not change amount_paid here, just the items and total obligation
  const { error } = await supabase
    .from('transactions')
    .update({
        items: newItems,
        total_price: newTotalPrice
    })
    .eq('id', transactionId);

  if (error) {
      console.error("Error updating transaction items:", error);
      return false;
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

  const { error: logsError } = await supabase
    .from('payment_logs')
    .delete()
    .eq('transaction_id', id);
  
  if (logsError) {
      console.warn("Gagal menghapus log keuangan terkait:", logsError);
  }

  const { data: deletedData, error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .select();

  if (deleteError || !deletedData || deletedData.length === 0) return false;

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