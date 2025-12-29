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

// NEW: Sync Local History with Server Data
export const refreshTransactions = async (localIds: string[]): Promise<{ success: boolean, data: Transaction[] }> => {
  if (!supabase || localIds.length === 0) return { success: true, data: [] };

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .in('id', localIds);

  if (error) {
    console.error('Error refreshing history:', error);
    return { success: false, data: [] };
  }

  return { 
    success: true, 
    data: data.map(mapDbToTransaction) 
  };
};

// NEW: Record Payment Log 
export const recordPaymentLog = async (log: Omit<PaymentLog, 'id' | 'created_at'>): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('payment_logs')
    .insert([log]);

  if (error) {
    console.error('Error recording payment log:', error);
    if (error.code === '42P01') { 
      console.warn("Tabel payment_logs belum dibuat.");
    }
    return false;
  }
  return true;
};

// NEW: Get Payment Logs by Date Range
export const getPaymentLogs = async (startDate: string, endDate: string): Promise<{ data: PaymentLog[], error: any }> => {
  if (!supabase) return { data: [], error: null };

  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const startLocal = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
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

  const { data: currentTrx, error: fetchError } = await supabase
    .from('transactions')
    .select('status, total_price, amount_paid')
    .eq('id', id)
    .single();

  if (fetchError || !currentTrx) {
    return { success: false, error: "Transaksi tidak ditemukan" };
  }

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
     return false;
  }

  const oldStatus = trx.status;
  const items = trx.items as CartItem[];

  const { error } = await supabase
    .from('transactions')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) return false;

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

// NEW: Update Customer Data & Duration (Recalculate Price)
export const updateTransactionDetails = async (
  id: string, 
  name: string, 
  whatsapp: string, 
  duration: number
): Promise<boolean> => {
  if (!supabase) return false;

  // 1. Get current items to recalculate price
  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('items')
    .eq('id', id)
    .single();

  if (fetchError || !trx) return false;

  const items = trx.items as CartItem[];
  
  // 2. Recalculate Total Price based on new Duration
  let newTotalPrice = 0;
  for (const item of items) {
      const unitPrice = calculateItemPriceForDuration(item, duration);
      newTotalPrice += (unitPrice * item.quantity);
  }

  // 3. Update Database
  const { error } = await supabase
    .from('transactions')
    .update({
      customer_name: name,
      customer_whatsapp: whatsapp,
      duration: duration,
      total_price: newTotalPrice
    })
    .eq('id', id);

  if (error) {
    console.error("Error updating transaction details:", error);
    return false;
  }

  return true;
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
  const isActive = ['pending', 'partial_payment', 'booked', 'rented'].includes(status);
  
  if (isActive) {
      await processStockRestoration(oldItems);
      await processStockReduction(newItems);
  }

  // 4. Update Transaction
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
  
  if (logsError) console.warn("Gagal menghapus log keuangan terkait:", logsError);

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

// FUNCTION TO PRINT INVOICE
export const printInvoice = (trx: Transaction) => {
  const printWindow = window.open('', '', 'width=800,height=600');
  if (!printWindow) return alert('Izinkan pop-up untuk mencetak nota');

  const returnDate = new Date(trx.rentalDate);
  returnDate.setDate(returnDate.getDate() + (trx.duration - 1));
  const returnDateStr = returnDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const rentalDateStr = new Date(trx.rentalDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const paid = trx.amountPaid || 0;
  const remaining = Math.max(0, trx.totalPrice - paid);
  const statusLabel = remaining <= 0 ? 'LUNAS' : paid > 0 ? 'BELUM LUNAS (DP)' : 'BELUM BAYAR';

  const itemsHtml = trx.items.map((item, idx) => `
    <tr class="item-row">
      <td style="padding: 8px 0; border-bottom: 1px dashed #eee;">
        <div style="font-weight: bold; font-size: 14px;">${item.name}</div>
        <div style="font-size: 11px; color: #666;">
          ${item.selectedSize ? `Size: ${item.selectedSize} ` : ''} 
          ${item.selectedColor ? `| Warna: ${item.selectedColor}` : ''}
        </div>
      </td>
      <td style="text-align: center; padding: 8px 0; border-bottom: 1px dashed #eee;">${item.quantity}</td>
      <td style="text-align: right; padding: 8px 0; border-bottom: 1px dashed #eee;">
         Rp${(calculateItemPriceForDuration(item, trx.duration) * item.quantity).toLocaleString('id-ID')}
      </td>
    </tr>
  `).join('');

  const htmlContent = `
    <html>
      <head>
        <title>Nota Sewa #${trx.id.slice(0,6)} - Mamas Outdoor</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 400px; margin: 0 auto; color: #333; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .brand { font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
          .sub-brand { font-size: 12px; margin-top: 5px; }
          .info-table { width: 100%; font-size: 12px; margin-bottom: 15px; }
          .info-table td { padding: 2px 0; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { text-align: left; border-bottom: 1px solid #333; padding-bottom: 5px; font-size: 12px; text-transform: uppercase; }
          .total-section { border-top: 2px solid #333; padding-top: 10px; font-size: 14px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .grand-total { font-weight: bold; font-size: 16px; margin-top: 5px; border-top: 1px dashed #333; pt-2; }
          .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
          .stamp { border: 2px solid #333; display: inline-block; padding: 5px 10px; font-weight: bold; transform: rotate(-5deg); margin-top: 10px; font-size: 18px; }
          @media print {
            body { max-width: 100%; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Mamas Outdoor</div>
          <div class="sub-brand">Jl. Kampus Grendeng No. 123, Purwokerto</div>
          <div class="sub-brand">WA: 0812-3456-7890</div>
        </div>

        <table class="info-table">
          <tr><td><strong>No. Nota:</strong></td><td style="text-align:right">#${trx.id.slice(0,8)}</td></tr>
          <tr><td><strong>Tanggal:</strong></td><td style="text-align:right">${new Date().toLocaleDateString('id-ID')}</td></tr>
          <tr><td><strong>Penyewa:</strong></td><td style="text-align:right">${trx.customerName}</td></tr>
          <tr><td><strong>WhatsApp:</strong></td><td style="text-align:right">${trx.customerWhatsapp}</td></tr>
          <tr><td><strong>Durasi:</strong></td><td style="text-align:right">${trx.duration} Hari</td></tr>
        </table>

        <div style="border: 1px dashed #333; padding: 10px; margin-bottom: 20px; background: #f9f9f9;">
           <div style="font-size: 12px; font-weight: bold; margin-bottom: 5px;">Jadwal Sewa:</div>
           <div class="row" style="font-size: 12px;"><span>Ambil:</span> <span>${rentalDateStr}</span></div>
           <div class="row" style="font-size: 12px;"><span>Kembali:</span> <span>${returnDateStr}</span></div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th width="60%">Barang</th>
              <th width="15%" style="text-align: center;">Qty</th>
              <th width="25%" style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-section">
          <div class="row"><span>Subtotal:</span> <span>Rp${trx.totalPrice.toLocaleString('id-ID')}</span></div>
          <div class="row grand-total"><span>TOTAL:</span> <span>Rp${trx.totalPrice.toLocaleString('id-ID')}</span></div>
          <div class="row" style="margin-top: 10px; color: #444;"><span>Bayar:</span> <span>Rp${paid.toLocaleString('id-ID')}</span></div>
          <div class="row" style="font-weight: bold; color: ${remaining > 0 ? 'red' : 'green'};">
            <span>SISA TAGIHAN:</span> <span>Rp${remaining.toLocaleString('id-ID')}</span>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
           <div class="stamp" style="color: ${remaining <= 0 ? '#000' : 'red'}; border-color: ${remaining <= 0 ? '#000' : 'red'};">
             ${statusLabel}
           </div>
        </div>

        <div class="footer">
          <p>Syarat & Ketentuan:</p>
          <p>1. Wajib meningalkan kartu identitas asli.</p>
          <p>2. Denda keterlambatan berlaku harian.</p>
          <p>3. Simpan nota ini sebagai bukti pengambilan & pengembalian.</p>
          <br/>
          <p>~ Terima Kasih & Salam Lestari ~</p>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
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