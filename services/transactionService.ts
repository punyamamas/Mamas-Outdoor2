
import { supabase } from './supabase';
import { Transaction, CartItem, UserDetails, PaymentLog } from '../types';
import { processStockReduction, processStockRestoration } from './productService';

// Create new transaction (Checkout)
export const createTransaction = async (
  userDetails: UserDetails, 
  cartItems: CartItem[], 
  totalPrice: number,
  location?: string // Optional location param
): Promise<Transaction | null> => {
  if (!supabase) return null;

  const payload = {
    customer_name: userDetails.name,
    customer_whatsapp: userDetails.whatsapp,
    customer_campus: '-', 
    customer_location: location || null, // Simpan lokasi
    rental_date: userDetails.rentalDate,
    duration: userDetails.duration,
    total_price: totalPrice,
    fine_amount: 0, // Inisialisasi denda 0
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

// NEW: Get Transactions by Date Range for Reporting
export const getTransactionsByDateRange = async (startDate: string, endDate: string): Promise<Transaction[]> => {
  if (!supabase) return [];

  // Setup time to cover full day
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('rental_date', start.toISOString().split('T')[0]) // Filter berdasarkan tanggal sewa
    .lte('rental_date', end.toISOString().split('T')[0])
    .order('rental_date', { ascending: false });

  if (error) {
    console.error('Error fetching report transactions:', error);
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


// Update Nominal Pembayaran (Manual) & Auto Status & RECORD LOG (SPLIT RENT vs FINE)
export const updateTransactionPayment = async (
  id: string, 
  newTotalPaid: number,
  logDetails?: { cashAmount: number; transferAmount: number; description: string },
  fineAllocation: number = 0 // Parameter baru untuk memecah log denda
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

  // LOGIKA PENCATATAN LOG KEUANGAN (SPLIT SEWA & DENDA)
  if (logDetails) {
    const { cashAmount, transferAmount, description } = logDetails;
    const totalInput = cashAmount + transferAmount;
    
    // Hitung proporsi Cash vs Transfer
    const cashRatio = totalInput > 0 ? cashAmount / totalInput : 0;
    
    // Hitung berapa untuk Denda, berapa untuk Sewa
    // fineAllocation adalah jumlah dari totalInput yang dialokasikan untuk bayar denda
    const amountForFine = Math.min(fineAllocation, totalInput);
    const amountForRent = totalInput - amountForFine;

    // Helper untuk record log
    const createLog = async (amount: number, category: string, suffixDesc: string) => {
        if (amount <= 0) return;
        
        // Split lagi berdasarkan metode bayar (proposional)
        // Jika bayar 100rb (50k cash, 50k trf), dan 20rb untuk denda:
        // Denda: 10rb Cash, 10rb Trf. Sewa: 40rb Cash, 40rb Trf.
        const cAmount = Math.round(amount * cashRatio);
        const tAmount = amount - cAmount; // Sisa masuk transfer agar genap

        if (cAmount > 0) {
            await recordPaymentLog({
                transaction_id: id,
                amount: cAmount,
                payment_method: 'cash',
                type: 'IN',
                description: `Cash: ${description} ${suffixDesc}`,
                category: category // 'Sewa' atau 'Denda'
            });
        }
        if (tAmount > 0) {
            await recordPaymentLog({
                transaction_id: id,
                amount: tAmount,
                payment_method: 'transfer',
                type: 'IN',
                description: `Transfer: ${description} ${suffixDesc}`,
                category: category
            });
        }
    };

    // 1. Catat Log Sewa
    await createLog(amountForRent, 'Sewa', '');

    // 2. Catat Log Denda
    await createLog(amountForFine, 'Denda', '(Bayar Denda)');
  }

  // UPDATE STATUS DATABASE
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

// NEW: Apply Fine (Menambah Total Tagihan & Mencatat Nominal Denda Terpisah)
export const applyTransactionFine = async (
  id: string, 
  fineAmount: number
): Promise<{ success: boolean; newTotal?: number }> => {
  if (!supabase) return { success: false };

  // 1. Get current totals
  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('total_price, fine_amount')
    .eq('id', id)
    .single();

  if (fetchError || !trx) return { success: false };

  const currentFine = Number(trx.fine_amount) || 0;
  const currentTotal = Number(trx.total_price) || 0;

  const newFine = currentFine + fineAmount;
  const newTotal = currentTotal + fineAmount;

  // 2. Update database (Update both Total and Fine columns)
  const { error } = await supabase
    .from('transactions')
    .update({ 
      total_price: newTotal,
      fine_amount: newFine
    })
    .eq('id', id);

  if (error) {
    console.error("Error applying fine:", error);
    // Fallback: Jika kolom fine_amount belum ada, update total_price saja
    if (error.message.includes('fine_amount')) {
       await supabase.from('transactions').update({ total_price: newTotal }).eq('id', id);
       return { success: true, newTotal };
    }
    return { success: false };
  }

  return { success: true, newTotal };
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
export const calculateItemPriceForDuration = (item: CartItem, duration: number): number => {
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

// NEW: Calculate Overdue Fine based on Report Logic
export const calculateOverdueFine = (transaction: Transaction): { daysLate: number; fineAmount: number } => {
  if (transaction.status !== 'rented') return { daysLate: 0, fineAmount: 0 };

  const now = new Date();
  const rentalDate = new Date(transaction.rentalDate);
  const returnDate = new Date(rentalDate);
  returnDate.setDate(rentalDate.getDate() + (transaction.duration - 1));

  // Deadline Overdue: 23:59:59 on Return Date
  const overdueDeadline = new Date(returnDate);
  overdueDeadline.setHours(23, 59, 59, 999);

  if (now <= overdueDeadline) return { daysLate: 0, fineAmount: 0 };

  const diffTime = Math.abs(now.getTime() - overdueDeadline.getTime());
  const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Logic: Fine duration = daysLate + 1
  const calculationDuration = daysLate + 1;

  const fineAmount = transaction.items.reduce((total, item) => {
      const price = calculateItemPriceForDuration(item, calculationDuration);
      return total + (price * item.quantity);
  }, 0);

  return { daysLate, fineAmount };
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
    .select('items, fine_amount')
    .eq('id', id)
    .single();

  if (fetchError || !trx) return false;

  const items = trx.items as CartItem[];
  const currentFine = Number(trx.fine_amount) || 0;
  
  // 2. Recalculate Base Rental Price
  let rentalPrice = 0;
  for (const item of items) {
      const unitPrice = calculateItemPriceForDuration(item, duration);
      rentalPrice += (unitPrice * item.quantity);
  }

  // 3. New Total = New Rental Price + Existing Fine
  const newTotalPrice = rentalPrice + currentFine;

  // 4. Update Database
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
  const currentFine = Number(trx.fine_amount) || 0;

  // 2. Calculate New Base Rental Price
  let rentalPrice = 0;
  for (const item of newItems) {
      const unitPrice = calculateItemPriceForDuration(item, duration);
      rentalPrice += (unitPrice * item.quantity);
  }

  // 3. New Total = Rental + Fine
  const newTotalPrice = rentalPrice + currentFine;

  // 4. Handle Stock Rotation if active transaction
  const isActive = ['pending', 'partial_payment', 'booked', 'rented'].includes(status);
  
  if (isActive) {
      await processStockRestoration(oldItems);
      await processStockReduction(newItems);
  }

  // 5. Update Transaction
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
export const printInvoice = (trx: Transaction, mode: 'print' | 'view' = 'print') => {
  // Buka window baru, ukuran disesuaikan tapi browser akan handle print preview
  const printWindow = window.open('', '', 'width=800,height=800');
  if (!printWindow) return alert('Izinkan pop-up untuk mencetak nota');

  // Format Tanggal dan Waktu
  const dateObj = new Date(trx.created_at || new Date());
  const dateStr = dateObj.toLocaleDateString('id-ID'); 
  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); 

  // Hitung Tanggal Pinjam (Rental Date) & Kembali
  const rentalDateObj = new Date(trx.rentalDate);
  const rentalDateStr = rentalDateObj.toLocaleDateString('id-ID');

  const returnDateObj = new Date(trx.rentalDate);
  returnDateObj.setDate(returnDateObj.getDate() + (trx.duration - 1)); 
  const returnDateStr = returnDateObj.toLocaleDateString('id-ID');

  const paid = trx.amountPaid || 0;
  const remaining = Math.max(0, trx.totalPrice - paid);
  const change = Math.max(0, paid - trx.totalPrice);
  const fine = trx.fineAmount || 0; // Tampilkan denda di struk jika ada
  
  // Status Logic & Cap Text
  const isLunas = remaining <= 0;
  const statusLabel = isLunas ? 'LUNAS' : 'BELUM LUNAS';
  const stampColor = isLunas ? '#000000' : '#000000'; 
  const paymentMethodDisplay = trx.paymentMethod === 'transfer' ? 'Transfer' : 'Cash';
  
  // Format Mata Uang Helper
  const fmt = (val: number) => val.toLocaleString('id-ID');

  // URL Logo yang Anda berikan (Imgur)
  const logoUrl = "https://imgur.com/iC8ycHT.png";

  const itemsHtml = trx.items.map((item) => {
    const unitPrice = calculateItemPriceForDuration(item, trx.duration);
    const totalPrice = unitPrice * item.quantity;
    
    // Check if variant info exists
    const variantInfo = item.selectedSize || item.selectedColor 
      ? `(${[item.selectedSize, item.selectedColor].filter(Boolean).join('/')})` 
      : '';

    return `
    <div class="item-row">
      <div class="item-name">${trx.duration}H ${item.name.toUpperCase()} ${variantInfo}</div>
      <div class="item-calc">
        <span>${item.quantity} x ${fmt(unitPrice)}</span>
        <span>${fmt(totalPrice)}</span>
      </div>
    </div>
    `;
  }).join('');

  // Row Denda jika ada
  const fineHtml = fine > 0 ? `
    <div class="item-row" style="margin-top:5px; border-top:1px dotted #ccc; padding-top:5px;">
      <div class="item-name" style="color:red;">DENDA KETERLAMBATAN</div>
      <div class="item-calc">
        <span>Extra Charge</span>
        <span>${fmt(fine)}</span>
      </div>
    </div>
  ` : '';

  // Tombol Manual Print hanya muncul jika mode = 'view'
  const manualPrintButton = mode === 'view' ? `
    <div class="no-print" style="margin-top: 30px; text-align: center; padding-bottom: 20px;">
       <button onclick="window.print()" style="background: #DC0000; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: sans-serif; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          🖨️ Cetak / Simpan PDF
       </button>
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Struk Pembayaran #${trx.id.slice(0,6)}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700;900&display=swap');
          @page { size: 80mm auto; margin: 0mm; }
          body { font-family: 'Roboto Mono', monospace, sans-serif; padding: 5px; width: 78mm; margin: 0 auto; color: #000; background: #fff; font-size: 12px; line-height: 1.4; position: relative; }
          .header { text-align: center; margin-bottom: 10px; }
          .logo-img { width: 70px; height: auto; margin: 15px auto 5px; display: block; filter: grayscale(100%) contrast(150%); }
          .brand-name { font-size: 18px; font-weight: 900; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;}
          .address { font-size: 11px; color: #000; margin-bottom: 2px; }
          .wa { font-size: 11px; font-weight: bold; margin-top: 4px;}
          .dashed-line { border-bottom: 1px dashed #000; margin: 10px 0; width: 100%; }
          .meta-table { width: 100%; font-size: 11px; }
          .meta-table td { padding: 1px 0; vertical-align: top; }
          .meta-label { width: 35%; }
          .meta-val { text-align: right; font-weight: 500; }
          .items-container { margin-top: 10px; margin-bottom: 10px; }
          .item-row { margin-bottom: 8px; }
          .item-name { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
          .item-calc { display: flex; justify-content: space-between; font-size: 12px; color: #000; }
          .summary-table { width: 100%; font-size: 12px; margin-top: 5px; }
          .summary-table td { padding: 2px 0; }
          .sum-label { text-align: left; }
          .sum-val { text-align: right; font-weight: bold; }
          .footer-info { margin-top: 10px; margin-bottom: 10px; font-size: 11px; }
          .footer-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .footer-label { font-weight: 500; }
          .footer-val { font-weight: bold; }
          .footer-text { text-align: justify; margin-top: 15px; font-size: 11px; color: #000; line-height: 1.3; font-style: italic; }
          .stamp-container { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); z-index: 10; pointer-events: none; opacity: 0.25; }
          .stamp { border: 5px solid ${stampColor}; color: ${stampColor}; padding: 10px 20px; font-size: 32px; font-weight: 900; text-transform: uppercase; border-radius: 8px; letter-spacing: 2px; text-align: center; display: inline-block; }
          @media print { body { margin: 0; width: 80mm; padding: 0 2mm; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="stamp-container"><div class="stamp">${statusLabel}</div></div>
        <div class="header">
          <img src="${logoUrl}" alt="Mamas Outdoor Logo" class="logo-img" id="invoiceLogo" />
          <div class="brand-name">MAMAS OUTDOOR</div>
          <div class="address">Jalan Cenderawasih, RT 3/RW 7, Dukuhbandong,</div>
          <div class="address">Grendeng, Kec. Purwokerto Utara, Banyumas</div>
          <div class="address">Jawa Tengah, Indonesia 53122</div>
          <div class="wa">No. WhatsApp 085137411145</div>
        </div>
        <div class="dashed-line"></div>
        <table class="meta-table">
          <tr><td class="meta-label">No Nota</td><td class="meta-val">TRX/${trx.id.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td class="meta-label">Antrian</td><td class="meta-val">5</td></tr>
          <tr><td class="meta-label">Pelanggan</td><td class="meta-val">MO-${trx.id.slice(0,4)} ${trx.customerName}</td></tr>
          <tr><td class="meta-label">Lokasi</td><td class="meta-val">${trx.customerLocation || '-'}</td></tr>
          <tr><td class="meta-label">Tanggal</td><td class="meta-val">${dateStr} - ${timeStr}</td></tr>
          <tr><td class="meta-label">Kasir</td><td class="meta-val">Admin Mamas Outdoor</td></tr>
        </table>
        <div class="dashed-line"></div>
        <div class="items-container">
          ${itemsHtml}
          ${fineHtml}
        </div>
        <div class="dashed-line"></div>
        <table class="summary-table">
          <tr><td class="sum-label">Status</td><td class="sum-val">${statusLabel}</td></tr>
          <tr><td class="sum-label">Metode Bayar</td><td class="sum-val">${paymentMethodDisplay}</td></tr>
          <tr><td class="sum-label" style="padding-top:10px;">Total Tagihan</td><td class="sum-val" style="padding-top:10px;">${fmt(trx.totalPrice)}</td></tr>
          <tr><td class="sum-label">DiBayar</td><td class="sum-val">${fmt(paid)}</td></tr>
          <tr><td class="sum-label">Kembalian</td><td class="sum-val">${fmt(change)}</td></tr>
        </table>
        <div class="dashed-line"></div>
        <div class="footer-info">
           <div class="footer-row"><span class="footer-label">Tanggal Pinjam :</span><span class="footer-val">${rentalDateStr}</span></div>
           <div class="footer-row"><span class="footer-label">Tanggal Kembali :</span><span class="footer-val">${returnDateStr}</span></div>
           <div class="footer-row" style="margin-top: 8px;"><span class="footer-label">Identitas Jaminan :</span></div>
           <div style="border-bottom: 1px dotted #000; height: 24px; width: 100%; margin-bottom: 4px;"></div>
        </div>
        <div class="footer-text">
           Terima kasih atas kepercayaan Anda telah memilih kami sebagai mitra petualangan outdoor Anda. 
           Kami harap perlengkapan yang Anda sewa dapat menunjang kegiatan Anda dengan optimal.
        </div>
        ${manualPrintButton}
        <script>
          window.onload = function() {
            var img = document.getElementById('invoiceLogo');
            var shouldAutoPrint = ${mode === 'print' ? 'true' : 'false'};
            function doPrint() { if (shouldAutoPrint) { window.focus(); setTimeout(function(){ window.print(); }, 500); } }
            if (img.complete) { doPrint(); } else { img.onload = doPrint; img.onerror = doPrint; }
          }
          window.onafterprint = function() { if (${mode === 'print' ? 'true' : 'false'}) { window.close(); } }
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
    customerLocation: dbItem.customer_location || undefined, 
    rentalDate: dbItem.rental_date,
    duration: dbItem.duration,
    totalPrice: dbItem.total_price,
    fineAmount: dbItem.fine_amount || 0, // MAP FINE COLUMN
    amountPaid: dbItem.amount_paid || 0, 
    items: dbItem.items,
    status: dbItem.status,
    paymentMethod: dbItem.payment_method || 'cash' 
  };
};
