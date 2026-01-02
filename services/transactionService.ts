
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
    identityPhotoUrl: dbItem.identity_photo_url || undefined, // Mapped
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
  
  // LOGIKA KEUANGAN (CRUCIAL FIX): 
  // Cap initialPaid agar tidak melebihi total tagihan.
  // Contoh: Tagihan 20rb, Bayar 50rb -> Database MURNI catat 20rb sebagai income. 
  // 30rb sisanya adalah kembalian fisik dan tidak boleh masuk record keuangan.
  // Math.max(0, ...) untuk mencegah nilai negatif jika ada kesalahan kalkulasi.
  const realIncome = initialPaid ? Math.max(0, Math.min(initialPaid, total)) : 0;

  const newTrx: any = {
    customer_name: userDetails.name,
    customer_whatsapp: userDetails.whatsapp,
    customer_location: location || userDetails.location,
    rental_date: userDetails.rentalDate,
    duration: userDetails.duration,
    items: items,
    total_price: total,
    amount_paid: realIncome, // Gunakan realIncome, bukan raw input
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
          amount: realIncome, // Catat yang benar-benar masuk kas (netto)
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

// NEW: Optimized for App Availability Check (Only Active Transactions)
export const getActiveTransactions = async (): Promise<Transaction[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .in('status', ['booked', 'rented', 'pending', 'partial_payment']); // Exclude completed/cancelled to save bandwidth
  
  if (error) return [];
  return data.map(mapDbToTransaction);
};

// NEW: Server-side Pagination for Admin
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
  
  if (status === 'cancelled') {
     const { data } = await supabase.from('transactions').select('items').eq('id', id).single();
     if (data && data.items) {
        await processStockRestoration(data.items);
     }
  }
  
  if (status === 'completed') {
     const { data } = await supabase.from('transactions').select('items').eq('id', id).single();
     if (data && data.items) {
        await processStockRestoration(data.items);
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
  if (uploadError) {
      console.error('Upload proof error:', uploadError);
      return null;
  }

  const { data: { publicUrl } } = supabase.storage.from('payment_proofs').getPublicUrl(filePath);
  
  await supabase.from('transactions').update({ payment_proof_url: publicUrl }).eq('id', transactionId);
  
  return publicUrl;
};

// NEW: Upload Identity Proof (Foto KTP)
export const uploadIdentityProof = async (transactionId: string, file: File): Promise<string | null> => {
  if (!supabase) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${transactionId}_identity_${Date.now()}.${fileExt}`;
  const filePath = fileName;

  // Use payment_proofs bucket or create a new 'identity_proofs' bucket if preferred. 
  // Reusing payment_proofs for simplicity as per user request context.
  const { error: uploadError } = await supabase.storage.from('payment_proofs').upload(filePath, file);
  if (uploadError) {
      console.error('Upload identity error:', uploadError);
      return null;
  }

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
            // Denda per hari = Harga 2 hari (Simplifikasi)
            fine += (item.price2Days || 0) * item.quantity * daysLate;
        }
    });
    return fine;
};

export const copyInvoiceToClipboard = async (transaction: Transaction, type: 'full' | 'simple') => {
    console.log("Copy invoice feature requires component context.");
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

// --- SHIFT MANAGEMENT SERVICE ---

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

export const openShift = async (cashierName: string, shiftName: string, startCash: number): Promise<ShiftLog | null> => {
  if (!supabase) return null;
  
  // Close any existing open shift first (safety measure)
  const active = await getCurrentShift();
  if (active) return active;

  const { data, error } = await supabase.from('shift_logs').insert([{
    cashier_name: cashierName,
    shift_name: shiftName,
    start_cash: startCash,
    status: 'open',
    created_at: new Date().toISOString()
  }]).select().single();

  if (error) {
    console.error("Failed to open shift:", error);
    return null;
  }
  return data as ShiftLog;
};

export const closeShift = async (
  shiftId: string, 
  endCash: number, 
  systemCash: number, 
  difference: number, 
  notes: string
): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase.from('shift_logs').update({
    end_cash: endCash,
    system_cash: systemCash,
    difference: difference,
    notes: notes,
    status: 'closed',
    ended_at: new Date().toISOString()
  }).eq('id', shiftId);

  return !error;
};

// ... (Rest of invoice generation code remains unchanged)
// NEW FUNCTION: Send Text Invoice to WhatsApp
export const sendWhatsAppInvoice = (trx: Transaction) => {
  const config = getStoreConfig();
  
  const dateObj = new Date(trx.created_at || new Date());
  const dateStr = dateObj.toLocaleDateString('id-ID'); 
  
  const returnDate = new Date(trx.rentalDate);
  returnDate.setDate(returnDate.getDate() + (trx.duration - 1));
  const returnStr = returnDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'});

  // Helper untuk format mata uang
  const fmt = (val: number) => val.toLocaleString('id-ID');
  
  // Format items using monospace block
  // Limit name length to keep alignment
  const itemsText = trx.items.map(item => {
      const name = item.name.substring(0, 15).padEnd(15, ' ');
      const qty = `${item.quantity}x`.padStart(3, ' ');
      const price = fmt(calculateItemPriceForDuration(item, trx.duration)).padStart(9, ' ');
      return `${name} ${qty} ${price}`;
  }).join('\n');

  // Status Lunas/Belum
  const paid = trx.amountPaid || 0;
  const total = trx.totalPrice;
  const statusBayar = paid >= total ? "LUNAS" : `KURANG: Rp${fmt(total - paid)}`;

  const message = `*NOTA DIGITAL - ${config.storeName.toUpperCase()}*
--------------------------------
No  : #${trx.id.slice(0,8)}
Tgl : ${dateStr}
Yth : ${trx.customerName}
--------------------------------
\`\`\`
${itemsText}
\`\`\`
--------------------------------
*Total : Rp ${fmt(total)}*
Bayar : Rp ${fmt(paid)}
${(trx.fineAmount||0) > 0 ? `Denda : Rp ${fmt(trx.fineAmount||0)}\n` : ''}
*Status: ${statusBayar}*
--------------------------------
Ambil   : ${new Date(trx.rentalDate).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}
Kembali : ${returnStr} (${trx.duration} Hari)
--------------------------------
${config.footerMessage}
Simpan struk ini sebagai bukti.`;

  let phone = trx.customerWhatsapp.replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '62' + phone.slice(1);

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

// FEATURE: Generate Image IDENTICAL TO PRINT, COPY TO CLIPBOARD, Open WA
export const sendImageInvoiceToWhatsapp = async (trx: Transaction) => {
  const storeConfig = getStoreConfig();
  const dateObj = new Date(trx.created_at || new Date());
  const dateStr = dateObj.toLocaleDateString('id-ID'); 
  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  
  const startDate = new Date(trx.rentalDate);
  const returnDate = new Date(startDate);
  returnDate.setDate(startDate.getDate() + (trx.duration - 1));
  const rentalPeriodStr = `${startDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'})} s/d ${returnDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'})} (${trx.duration} Hari)`;

  const fine = trx.fineAmount || 0;
  const paidGlobal = trx.amountPaid || 0;
  const totalGlobal = trx.totalPrice;
  const isGlobalPaid = paidGlobal >= totalGlobal;
  const statusLabel = isGlobalPaid ? 'LUNAS' : 'BELUM LUNAS';
  const stampColor = isGlobalPaid ? '#000000' : '#000000';
  const logoUrl = "https://imgur.com/iC8ycHT.png";
  const fmt = (val: number) => val.toLocaleString('id-ID');

  // Create hidden container matching Print Styles (Thermal 80mm mimic)
  const container = document.createElement('div');
  container.style.width = '350px'; // Approx 80mm with padding
  container.style.padding = '15px';
  container.style.backgroundColor = 'white';
  container.style.color = 'black';
  container.style.fontFamily = "'Roboto Mono', monospace";
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '0';
  container.style.zIndex = '-1000';
  container.style.lineHeight = '1.4';
  container.style.fontSize = '11px';

  // Generate QR
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(trx.id, { width: 100, margin: 0 });
  } catch (e) { console.error(e); }

  const itemsHtml = trx.items.map((item) => {
    const unitPrice = calculateItemPriceForDuration(item, trx.duration);
    const totalPrice = unitPrice * item.quantity;
    const variantInfo = item.selectedSize || item.selectedColor 
      ? `(${[item.selectedSize, item.selectedColor].filter(Boolean).join('/')})` : '';
    const label = item.isSale ? 'BELI' : `${trx.duration}H`;

    return `
    <div style="margin-bottom: 8px;">
      <div style="font-weight: 700; font-size: 11px; margin-bottom: 2px;">${label} ${item.name.toUpperCase()} ${variantInfo}</div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #000;">
        <span>${item.quantity} x ${fmt(unitPrice)}</span>
        <span>${fmt(totalPrice)}</span>
      </div>
    </div>
    `;
  }).join('');

  const fineHtml = fine > 0 ? `
    <div style="margin-top:5px; border-top:1px dotted #ccc; padding-top:5px;">
      <div style="color:red; font-weight:700;">DENDA KETERLAMBATAN</div>
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span>Extra Charge</span>
        <span>${fmt(fine)}</span>
      </div>
    </div>
  ` : '';

  // HTML Structure Identical to printInvoice
  container.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700;900&display=swap');
    </style>
    <div style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); z-index: 10; pointer-events: none; opacity: 0.15;">
        <div style="border: 4px solid ${stampColor}; color: ${stampColor}; padding: 8px 15px; font-size: 24px; font-weight: 900; text-transform: uppercase; border-radius: 8px; letter-spacing: 2px; text-align: center;">
            ${statusLabel}
        </div>
    </div>
    <div style="text-align: center; margin-bottom: 10px;">
      <img src="${logoUrl}" style="width: 60px; height: auto; margin: 5px auto; display: block; filter: grayscale(100%) contrast(150%);" />
      <div style="font-size: 16px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">${storeConfig.storeName}</div>
      <div style="font-size: 10px; margin-bottom: 2px; white-space: pre-wrap;">${storeConfig.storeAddress}</div>
      <div style="font-size: 10px; font-weight: bold;">WA: ${storeConfig.adminWhatsapp}</div>
    </div>
    
    <div style="border-bottom: 1px dashed #000; margin: 10px 0; width: 100%;"></div>
    
    <table style="width: 100%; font-size: 10px;">
      <tr><td style="width: 35%;">Jenis</td><td style="text-align: right; font-weight: 900;">NOTA TAGIHAN</td></tr>
      <tr><td>No Nota</td><td style="text-align: right;">TRX/${trx.id.slice(0, 8).toUpperCase()}</td></tr>
      <tr><td>Pelanggan</td><td style="text-align: right;">MO-${trx.id.slice(0,4)} ${trx.customerName.slice(0,12)}</td></tr>
      <tr><td>Jaminan</td><td style="text-align: right;">${trx.customerIdentity || '-'}</td></tr>
      <tr><td>Tanggal</td><td style="text-align: right;">${dateStr} - ${timeStr}</td></tr>
      <tr><td colspan="2" style="padding-top:4px; font-style:italic; font-size:9px;">Periode: ${rentalPeriodStr}</td></tr>
      <tr><td>Kasir</td><td style="text-align: right;">Admin</td></tr>
    </table>

    <div style="border-bottom: 1px dashed #000; margin: 10px 0; width: 100%;"></div>

    <div style="margin-top: 10px; margin-bottom: 10px;">
      ${itemsHtml}
      ${fineHtml}
    </div>

    <div style="border-bottom: 1px dashed #000; margin: 10px 0; width: 100%;"></div>

    <table style="width: 100%; font-size: 11px; margin-top: 5px;">
      <tr><td style="text-align: left;">Status Global</td><td style="text-align: right; font-weight: bold;">${statusLabel}</td></tr>
      <tr><td style="text-align: left; padding-top:5px;">Total Tagihan Ini</td><td style="text-align: right; padding-top:5px; font-weight:bold;">${fmt(trx.totalPrice)}</td></tr>
    </table>

    <div style="text-align:center; margin-top:15px;">
       <img src="${qrDataUrl}" style="width: 80px; height: 80px; display:block; margin: 0 auto;" />
       <div style="font-size: 8px; margin-top: 2px; font-weight:bold;">Scan untuk Cek Status</div>
    </div>

    <div style="border-bottom: 1px dashed #000; margin: 10px 0; width: 100%;"></div>
    <div style="text-align: justify; margin-top: 10px; font-size: 9px; color: #000; line-height: 1.3; font-style: italic;">
       ${storeConfig.footerMessage}
    </div>
  `;

  document.body.appendChild(container);

  // Helper to ensure image loads
  const waitForImage = (src: string) => new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); 
      img.src = src;
  });

  try {
      await waitForImage(logoUrl);

      // Use higher scale for better text resolution (mimic 203dpi thermal)
      const canvas = await html2canvas(container, { 
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff'
      });
      
      canvas.toBlob(async (blob) => {
          if (!blob) throw new Error("Canvas is empty");

          let isCopied = false;
          try {
              // Copy to Clipboard (primary goal)
              await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': blob })
              ]);
              isCopied = true;
          } catch (err) {
              console.warn("Clipboard write failed (browser block), falling back to download", err);
              // Fallback: Download file
              const imgData = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              link.href = imgData;
              link.download = `Nota_${trx.customerName.replace(/\s+/g,'_')}_${trx.id.slice(0,6)}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }

          // Open WhatsApp
          let phone = trx.customerWhatsapp.replace(/\D/g, '');
          if (phone.startsWith('0')) phone = '62' + phone.slice(1);
          
          const caption = `Halo Kak *${trx.customerName}*,\n\nTerlampir nota digital resmi (gambar) untuk transaksi #${trx.id.slice(0,6)}.\n\nTotal: Rp${trx.totalPrice.toLocaleString('id-ID')}\nStatus: ${statusLabel}\n\nTerima kasih!`;
          
          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(caption)}`, '_blank');

          // Notify User
          if (isCopied) {
              alert("✅ Gambar Nota (Format Cetak) telah disalin ke Clipboard!\n\nWhatsApp akan terbuka, silakan tekan 'Ctrl + V' (Paste) di kolom chat.");
          } else {
              alert("⚠️ Gagal menyalin otomatis. Gambar telah didownload.\n\nSilakan lampirkan file gambar secara manual di WhatsApp.");
          }

          document.body.removeChild(container);
      }, 'image/png');

  } catch (error) {
      console.error("Error generating invoice image:", error);
      alert("Gagal membuat gambar nota.");
      if (document.body.contains(container)) document.body.removeChild(container);
  }
};

export const printInvoice = async (
  trx: Transaction, 
  mode: 'print' | 'view' = 'print',
  invoiceType: 'full' | 'rental' | 'fine' | 'delivery' = 'full'
) => {
  const storeConfig = getStoreConfig(); 

  const printWindow = window.open('', '', 'width=800,height=800');
  if (!printWindow) return alert('Izinkan pop-up untuk mencetak nota');

  const dateObj = new Date(trx.created_at || new Date());
  const dateStr = dateObj.toLocaleDateString('id-ID'); 
  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); 
  
  const startDate = new Date(trx.rentalDate);
  const returnDate = new Date(startDate);
  returnDate.setDate(startDate.getDate() + (trx.duration - 1));
  const rentalPeriodStr = `${startDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'})} s/d ${returnDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'})} (${trx.duration} Hari)`;

  const fine = trx.fineAmount || 0;
  const rentalTotal = trx.totalPrice - fine; 

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(trx.id, { width: 120, margin: 0 });
  } catch (e) { console.error(e); }

  let displayedItemsHtml = '';
  let displayedTotal = 0;
  let titleText = 'Struk Pembayaran';
  let showFineRow = false;
  let isDeliveryNote = invoiceType === 'delivery';
  
  const fmt = (val: number) => val.toLocaleString('id-ID');

  if (invoiceType === 'fine') {
      titleText = 'NOTA DENDA';
      displayedTotal = fine;
      displayedItemsHtml = `
        <div class="item-row" style="margin-top:5px; border-bottom:1px dotted #ccc; padding-bottom:5px;">
          <div class="item-name" style="color:red;">DENDA / CHARGE KETERLAMBATAN</div>
          <div class="item-calc">
            <span>Ref Trx: #${trx.id.slice(0,6)}</span>
            <span>${fmt(fine)}</span>
          </div>
        </div>
      `;
      showFineRow = false; 
  } 
  else {
      displayedItemsHtml = trx.items.map((item) => {
        const unitPrice = calculateItemPriceForDuration(item, trx.duration);
        const totalPrice = unitPrice * item.quantity;
        const variantInfo = item.selectedSize || item.selectedColor 
          ? `(${[item.selectedSize, item.selectedColor].filter(Boolean).join('/')})` : '';
        const label = item.isSale ? 'BELI' : `${trx.duration}H`;

        if (isDeliveryNote) {
            return `
            <div class="item-row" style="border-bottom:1px dashed #eee; padding-bottom:4px; margin-bottom:4px;">
              <div style="display:flex; gap:10px; align-items:center;">
                 <div style="width:15px; height:15px; border:1px solid #000; display:inline-block;"></div>
                 <div class="item-name" style="flex:1;">${item.name.toUpperCase()} ${variantInfo}</div>
                 <div style="font-weight:bold; font-size:14px;">x${item.quantity}</div>
              </div>
            </div>
            `;
        } else {
            return `
            <div class="item-row">
              <div class="item-name">${label} ${item.name.toUpperCase()} ${variantInfo}</div>
              <div class="item-calc">
                <span>${item.quantity} x ${fmt(unitPrice)}</span>
                <span>${fmt(totalPrice)}</span>
              </div>
            </div>
            `;
        }
      }).join('');

      if (invoiceType === 'rental') {
          titleText = 'NOTA SEWA';
          displayedTotal = rentalTotal;
          showFineRow = false; 
      } else if (invoiceType === 'delivery') {
          titleText = 'SURAT JALAN / CEK LIST';
          showFineRow = false;
      } else {
          titleText = 'NOTA TAGIHAN';
          displayedTotal = trx.totalPrice;
          showFineRow = fine > 0;
      }
  }

  const fineHtml = showFineRow ? `
    <div class="item-row" style="margin-top:5px; border-top:1px dotted #ccc; padding-top:5px;">
      <div class="item-name" style="color:red;">DENDA KETERLAMBATAN</div>
      <div class="item-calc">
        <span>Extra Charge</span>
        <span>${fmt(fine)}</span>
      </div>
    </div>
  ` : '';

  const paidGlobal = trx.amountPaid || 0;
  const totalGlobal = trx.totalPrice;
  const isGlobalPaid = paidGlobal >= totalGlobal;
  const statusLabel = isDeliveryNote ? 'CHECKLIST' : isGlobalPaid ? 'LUNAS' : 'BELUM LUNAS';
  const stampColor = isGlobalPaid ? '#000000' : '#000000'; 
  const logoUrl = "https://imgur.com/iC8ycHT.png";

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
        <title>${titleText} #${trx.id.slice(0,6)}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;700;900&display=swap');
          @page { size: 80mm auto; margin: 0mm; }
          body { font-family: 'Roboto Mono', monospace, sans-serif; padding: 5px; width: 78mm; margin: 0 auto; color: #000; background: #fff; font-size: 12px; line-height: 1.4; position: relative; }
          .header { text-align: center; margin-bottom: 10px; }
          .logo-img { width: 70px; height: auto; margin: 15px auto 5px; display: block; filter: grayscale(100%) contrast(150%); }
          .brand-name { font-size: 18px; font-weight: 900; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;}
          .address { font-size: 11px; color: #000; margin-bottom: 2px; white-space: pre-wrap; }
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
          .footer-text { text-align: justify; margin-top: 15px; font-size: 11px; color: #000; line-height: 1.3; font-style: italic; }
          .stamp-container { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); z-index: 10; pointer-events: none; opacity: 0.25; }
          .stamp { border: 5px solid ${stampColor}; color: ${stampColor}; padding: 10px 20px; font-size: 32px; font-weight: 900; text-transform: uppercase; border-radius: 8px; letter-spacing: 2px; text-align: center; display: inline-block; }
          
          .qr-container { text-align:center; margin-top:20px; }
          .qr-img { width: 100px; height: 100px; display:block; margin: 0 auto; }
          .qr-label { font-size: 9px; margin-top: 4px; font-weight:bold; }

          @media print { body { margin: 0; width: 80mm; padding: 0 2mm; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="stamp-container"><div class="stamp">${statusLabel}</div></div>
        <div class="header">
          <img src="${logoUrl}" alt="Mamas Outdoor Logo" class="logo-img" id="invoiceLogo" />
          <div class="brand-name">${storeConfig.storeName}</div>
          <div class="address">${storeConfig.storeAddress}</div>
          <div class="wa">WA: ${storeConfig.adminWhatsapp}</div>
        </div>
        <div class="dashed-line"></div>
        <table class="meta-table">
          <tr><td class="meta-label">Jenis</td><td class="meta-val" style="font-weight:900">${titleText}</td></tr>
          <tr><td class="meta-label">No Nota</td><td class="meta-val">TRX/${trx.id.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td class="meta-label">Pelanggan</td><td class="meta-val">MO-${trx.id.slice(0,4)} ${trx.customerName.slice(0,15)}</td></tr>
          <tr><td class="meta-label">Jaminan</td><td class="meta-val">${trx.customerIdentity || '-'}</td></tr>
          <tr><td class="meta-label">Tanggal</td><td class="meta-val">${dateStr} - ${timeStr}</td></tr>
          <tr><td colspan="2" style="padding-top:4px; font-style:italic;">Periode: ${rentalPeriodStr}</td></tr>
          <tr><td class="meta-label">Kasir</td><td class="meta-val">Admin</td></tr>
        </table>
        <div class="dashed-line"></div>
        
        ${isDeliveryNote ? '<div style="text-align:center; font-weight:bold; margin-bottom:5px;">CEK KONDISI (✓)</div>' : ''}

        <div class="items-container">
          ${displayedItemsHtml}
          ${fineHtml}
        </div>
        <div class="dashed-line"></div>
        
        ${!isDeliveryNote ? `
        <table class="summary-table">
          <tr><td class="sum-label">Status Global</td><td class="sum-val">${isGlobalPaid ? 'LUNAS' : 'BELUM LUNAS'}</td></tr>
          <tr><td class="sum-label" style="padding-top:10px;">Total Tagihan Ini</td><td class="sum-val" style="padding-top:10px;">${fmt(displayedTotal)}</td></tr>
        </table>
        ` : `
        <div style="font-size:10px; margin-top:5px;">
           <p><strong>Catatan Kondisi:</strong></p>
           <div style="height:40px; border-bottom:1px dotted #000; margin-bottom:10px;"></div>
           <div style="display:flex; justify-content:space-between; margin-top:20px;">
              <div style="text-align:center; width:45%;">
                 <br/><br/><br/>
                 ( Admin )
              </div>
              <div style="text-align:center; width:45%;">
                 <br/><br/><br/>
                 ( Penyewa )
              </div>
           </div>
        </div>
        `}
        
        ${!isDeliveryNote ? `
        <div class="qr-container">
           <img src="${qrDataUrl}" class="qr-img" />
           <div class="qr-label">Scan untuk Cek Status</div>
        </div>
        ` : ''}

        <div class="dashed-line"></div>
        <div class="footer-text">
           ${storeConfig.footerMessage}
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
