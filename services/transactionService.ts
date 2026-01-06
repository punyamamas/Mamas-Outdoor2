
import { supabase } from './supabase';
import { Transaction, CartItem, UserDetails, PaymentLog, ShiftLog } from '../types';
import { processStockReduction, processStockRestoration } from './productService';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { getStoreConfig } from '../utils/storeConfig';

const mapDbToTransaction = (dbItem: any): Transaction => {
  return {
    id: dbItem.id.toString(),
    created_at: dbItem.created_at,
    customerName: dbItem.customer_name,
    customerWhatsapp: dbItem.customer_whatsapp,
    customerCampus: dbItem.customer_campus || '-',
    customerLocation: dbItem.customer_location || undefined,
    customerIdentity: dbItem.customer_identity || undefined,
    identityPhotoUrl: dbItem.identity_photo_url || undefined,
    rentalDate: dbItem.rental_date,
    duration: dbItem.duration,
    totalPrice: dbItem.total_price,
    fineAmount: dbItem.fine_amount || 0,
    amountPaid: dbItem.amount_paid || 0,
    paymentProofUrl: dbItem.payment_proof_url || undefined,
    items: dbItem.items,
    status: dbItem.status,
    paymentMethod: dbItem.payment_method || 'cash',
    isReviewed: false
  };
};

export const calculateItemPriceForDuration = (item: any, days: number): number => {
    if (item.isSale) return item.salePrice || 0;

    const p2 = item.price2Days || 0;
    const p3 = item.price3Days || 0;
    const p4 = item.price4Days || 0;
    const p5 = item.price5Days || 0;
    const p6 = item.price6Days || 0;
    const p7 = item.price7Days || 0;

    let unitPrice = 0;
    if (days <= 2) unitPrice = p2;
    else if (days === 3) unitPrice = p3;
    else if (days === 4) unitPrice = p4;
    else if (days === 5) unitPrice = p5;
    else if (days === 6) unitPrice = p6;
    else unitPrice = p7 + ((days - 7) * (p2 * 0.4)); 

    return unitPrice;
};

export const recordPaymentLog = async (log: Partial<PaymentLog>): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('payment_logs').insert([log]);
  return !error;
};

export const createTransaction = async (
  userDetails: UserDetails, 
  items: CartItem[], 
  total: number, 
  location?: string,
  customStatus?: string, // NEW: Untuk Admin POS
  initialPaid?: number // NEW: Untuk Admin POS
): Promise<Transaction | null> => {
  
  // LOGIKA KEUANGAN: Cap payment agar tidak melebihi tagihan
  const realIncome = initialPaid !== undefined ? Math.min(initialPaid, total) : 0;

  const newTrx: any = {
    customer_name: userDetails.name,
    customer_whatsapp: userDetails.whatsapp,
    customer_location: location || userDetails.location,
    rental_date: userDetails.rentalDate,
    duration: userDetails.duration,
    items: items,
    total_price: total,
    amount_paid: realIncome, 
    status: customStatus || 'pending',
    payment_method: userDetails.paymentMethod,
    created_at: new Date().toISOString()
  };

  if (!supabase) {
    const mockId = `local-${Date.now()}`;
    return { ...mapDbToTransaction({ ...newTrx, id: mockId }), id: mockId };
  }

  const { data, error } = await supabase.from('transactions').insert([newTrx]).select().single();
  
  if (error) {
    console.error('Create transaction error:', error);
    return null;
  }

  // AUTO LOG TO FINANCE IF INITIAL PAID > 0
  if (data && realIncome > 0) {
      await recordPaymentLog({
          transaction_id: data.id,
          amount: realIncome,
          payment_method: userDetails.paymentMethod || 'cash',
          type: 'IN',
          description: `Pembayaran Awal / DP Sewa atas nama ${userDetails.name}`,
          category: 'Sewa'
      });
  }

  return mapDbToTransaction(data);
};

export const getTransactions = async (): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data.map(mapDbToTransaction);
};

export const getActiveTransactions = async (): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .in('status', ['booked', 'rented', 'pending', 'partial_payment']); 
  
  if (error) return [];
  return data.map(mapDbToTransaction);
};

export const getPaginatedTransactions = async (
  page: number, 
  limit: number, 
  search: string = '', 
  status: string = 'all'
): Promise<{ data: Transaction[], count: number }> => {
  if (!supabase) return { data: [], count: 0 };

  let query = supabase.from('transactions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_whatsapp.ilike.%${search}%,id.ilike.%${search}%`);
  }

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("Pagination Error", error);
    return { data: [], count: 0 };
  }

  return { 
    data: data.map(mapDbToTransaction), 
    count: count || 0 
  };
};

export const refreshTransactions = async (ids: string[]): Promise<{success: boolean, data: Transaction[]}> => {
  if (!supabase || ids.length === 0) return { success: false, data: [] };
  const { data, error } = await supabase.from('transactions').select('*').in('id', ids);
  if (error) return { success: false, data: [] };
  return { success: true, data: data.map(mapDbToTransaction) };
};

export const getTransactionsByPhone = async (phone: string): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('transactions').select('*').ilike('customer_whatsapp', `%${phone}%`);
  if (error) return [];
  return data.map(mapDbToTransaction);
};

export const getTransactionsByDateRange = async (startDate: string, endDate: string): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('transactions').select('*')
    .gte('rental_date', startDate)
    .lte('rental_date', endDate)
    .order('rental_date', { ascending: false });
  if (error) return [];
  return data.map(mapDbToTransaction);
};

export const updateTransactionStatus = async (id: string, status: string): Promise<boolean> => {
  if (!supabase) return true;
  
  // Jika Cancel/Selesai, stok harus dikembalikan (jika sebelumnya Rented/Booked)
  if (status === 'cancelled' || status === 'completed') {
     const { data } = await supabase.from('transactions').select('items, status').eq('id', id).single();
     // Hanya kembalikan stok jika status sebelumnya valid (bukan pending/cancel)
     if (data && data.items && (data.status === 'rented' || data.status === 'booked')) {
        await processStockRestoration(data.items);
     }
  }
  // Jika status berubah dari Pending ke Booked/Rented, stok harus dikurangi
  if (status === 'booked' || status === 'rented') {
      const { data } = await supabase.from('transactions').select('items, status').eq('id', id).single();
      if (data && data.items && (data.status === 'pending')) {
          await processStockReduction(data.items);
      }
  }

  const { error } = await supabase.from('transactions').update({ status }).eq('id', id);
  return !error;
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  if (!supabase) return true;
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  return !error;
};

export const uploadPaymentProof = async (transactionId: string, file: File): Promise<string | null> => {
  if (!supabase) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${transactionId}_proof_${Date.now()}.${fileExt}`;
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage.from('payment_proofs').upload(filePath, file);
  if (uploadError) return null;

  const { data: { publicUrl } } = supabase.storage.from('payment_proofs').getPublicUrl(filePath);
  
  await supabase.from('transactions').update({ payment_proof_url: publicUrl }).eq('id', transactionId);
  return publicUrl;
};

export const uploadIdentityProof = async (transactionId: string, file: File): Promise<string | null> => {
  if (!supabase) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${transactionId}_identity_${Date.now()}.${fileExt}`;
  const filePath = fileName;

  const { error: uploadError } = await supabase.storage.from('payment_proofs').upload(filePath, file);
  if (uploadError) return null;

  const { data: { publicUrl } } = supabase.storage.from('payment_proofs').getPublicUrl(filePath);
  
  await supabase.from('transactions').update({ identity_photo_url: publicUrl }).eq('id', transactionId);
  return publicUrl;
};

export const updateTransactionPayment = async (id: string, amount: number): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('transactions').update({ amount_paid: amount }).eq('id', id);
  return !error;
};

export const updateTransactionItems = async (id: string, items: CartItem[], total: number): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('transactions').update({ items: items, total_price: total }).eq('id', id);
  return !error;
};

export const updateTransactionDetails = async (id: string, details: Partial<Transaction>): Promise<boolean> => {
  if (!supabase) return false;
  const payload: any = {};
  if (details.customerName) payload.customer_name = details.customerName;
  if (details.customerWhatsapp) payload.customer_whatsapp = details.customerWhatsapp;
  if (details.customerIdentity) payload.customer_identity = details.customerIdentity;
  
  const { error } = await supabase.from('transactions').update(payload).eq('id', id);
  return !error;
};

export const applyTransactionFine = async (id: string, fineAmount: number): Promise<boolean> => {
  if (!supabase) return false;
  const { data } = await supabase.from('transactions').select('total_price, fine_amount').eq('id', id).single();
  if (!data) return false;
  
  const oldFine = data.fine_amount || 0;
  const newTotal = (data.total_price - oldFine) + fineAmount;

  const { error } = await supabase.from('transactions').update({ 
      fine_amount: fineAmount,
      total_price: newTotal
  }).eq('id', id);
  
  return !error;
};

export const calculateOverdueFine = (transaction: Transaction): number => {
    const returnDate = new Date(transaction.rentalDate);
    returnDate.setDate(returnDate.getDate() + transaction.duration);
    const now = new Date();
    
    if (now <= returnDate) return 0;
    
    const diffTime = Math.abs(now.getTime() - returnDate.getTime());
    const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let fine = 0;
    transaction.items.forEach(item => {
        if (!item.isSale) {
            fine += (item.price2Days || 0) * item.quantity * daysLate;
        }
    });
    return fine;
};

export const copyInvoiceToClipboard = async (transaction: Transaction, type: 'full' | 'simple') => {
    // Placeholder required for import compatibility, implementation moved to component logic
    console.log("Invoice copy logic");
};

export const getPaymentLogs = async (startDate?: string, endDate?: string): Promise<{ data: PaymentLog[], error: any }> => {
  if (!supabase) return { data: [], error: null };
  let query = supabase.from('payment_logs').select('*').order('created_at', { ascending: false });
  if (startDate) query = query.gte('created_at', startDate + 'T00:00:00');
  if (endDate) query = query.lte('created_at', endDate + 'T23:59:59');
  
  const { data, error } = await query;
  return { data: data || [], error };
};

export const deletePaymentLog = async (id: string): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('payment_logs').delete().eq('id', id);
  return !error;
};

// SHIFT
export const getCurrentShift = async (): Promise<ShiftLog | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('shift_logs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error || !data) return null;
  return data as ShiftLog;
};

export const getShiftHistory = async (): Promise<ShiftLog[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('shift_logs').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) return [];
  return data as ShiftLog[];
};

export const openShift = async (cashierName: string, shiftName: string, startCash: number): Promise<ShiftLog | null> => {
  if (!supabase) return null;
  const active = await getCurrentShift();
  if (active) return active;

  const { data, error } = await supabase.from('shift_logs').insert([{
    cashier_name: cashierName,
    shift_name: shiftName,
    start_cash: startCash,
    status: 'open',
    created_at: new Date().toISOString()
  }]).select().single();

  if (error) return null;
  return data as ShiftLog;
};

export const closeShift = async (
  shiftId: string, 
  endCash: number, 
  systemCash: number, 
  difference: number, 
  cashWithdrawal: number,
  notes: string
): Promise<boolean> => {
  if (!supabase) return false;
  const { error } = await supabase.from('shift_logs').update({
    end_cash: endCash,
    system_cash: systemCash,
    difference: difference,
    cash_withdrawal: cashWithdrawal,
    notes: notes,
    status: 'closed',
    ended_at: new Date().toISOString()
  }).eq('id', shiftId);
  return !error;
};

// ... Print functions exported from bluetoothPrinterService primarily, simplified here if needed for direct imports
export const sendWhatsAppInvoice = (trx: Transaction) => {
    // Logic same as previous
    const config = getStoreConfig();
    let phone = trx.customerWhatsapp.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    const url = `https://wa.me/${phone}?text=Nota%20Tagihan%20Ref%20${trx.id}`;
    window.open(url, '_blank');
};

export const sendImageInvoiceToWhatsapp = async (trx: Transaction) => {
    // Logic moved to component or kept in bluetoothPrinterService usually
};

export const printInvoice = async (trx: Transaction) => {
    // Logic moved to bluetoothPrinterService
};
