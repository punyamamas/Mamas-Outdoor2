
// ... existing imports ...
import { supabase } from './supabase';
import { Transaction, CartItem, UserDetails, PaymentLog } from '../types';
import { processStockReduction, processStockRestoration } from './productService';
import html2canvas from 'html2canvas';

// ... (Existing functions: createTransaction, getTransactions, getTransactionsByDateRange, refreshTransactions, recordPaymentLog, getPaymentLogs) ...

// Existing createTransaction function (Preserved)
export const createTransaction = async (
  userDetails: UserDetails, 
  cartItems: CartItem[], 
  totalPrice: number,
  location?: string 
): Promise<Transaction | null> => {
  if (!supabase) return null;

  const payload = {
    customer_name: userDetails.name,
    customer_whatsapp: userDetails.whatsapp,
    customer_campus: '-', 
    customer_location: location || null, 
    rental_date: userDetails.rentalDate,
    duration: userDetails.duration,
    total_price: totalPrice,
    fine_amount: 0, 
    amount_paid: 0, 
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

// Existing getTransactions function (Preserved)
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

// Existing getTransactionsByDateRange function (Preserved)
export const getTransactionsByDateRange = async (startDate: string, endDate: string): Promise<Transaction[]> => {
  if (!supabase) return [];

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('rental_date', start.toISOString().split('T')[0]) 
    .lte('rental_date', end.toISOString().split('T')[0])
    .order('rental_date', { ascending: false });

  if (error) {
    console.error('Error fetching report transactions:', error);
    return [];
  }

  return data.map(mapDbToTransaction);
};

// Existing refreshTransactions function (Preserved)
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

// NEW FUNCTION: Get Transactions By Phone Number (Untuk Fitur Restore History Tanpa Login)
export const getTransactionsByPhone = async (phoneNumber: string): Promise<Transaction[]> => {
  if (!supabase || !phoneNumber) return [];

  // Normalisasi input user (hapus karakter aneh)
  const cleanInput = phoneNumber.replace(/\D/g, '');
  if (cleanInput.length < 8) return [];

  // Kita perlu strategi pencarian yang fleksibel karena format di DB bisa 08xxx, 628xxx, atau +628xxx
  // Cara termudah: Ambil semua transaksi, lalu filter di client (jika data sedikit)
  // Atau query menggunakan 'ilike' dengan wildcard (jika data banyak)
  
  // Strategi Query: Cari yang mengandung nomor tersebut (tanpa 0 atau 62 di depan untuk keamanan)
  // Misal user input 0812345, kita cari %812345%
  
  // Ambil substring unik (misal 8 digit terakhir) untuk pencarian
  const searchKey = cleanInput.length > 4 ? cleanInput.slice(-8) : cleanInput;

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .ilike('customer_whatsapp', `%${searchKey}%`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching history by phone:', error);
    return [];
  }

  return data.map(mapDbToTransaction);
};

// Existing recordPaymentLog function (Preserved)
export const recordPaymentLog = async (log: Omit<PaymentLog, 'id' | 'created_at'>): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('payment_logs')
    .insert([log]);

  if (error) {
    console.error('Error recording payment log:', error);
    return false;
  }
  return true;
};

// Existing getPaymentLogs function (Preserved)
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
    return { data: [], error };
  }
  
  return { data: data as PaymentLog[], error: null };
};

// Existing updateTransactionPayment function (Preserved)
export const updateTransactionPayment = async (
  id: string, 
  newTotalPaid: number,
  logDetails?: { cashAmount: number; transferAmount: number; description: string },
  fineAllocation: number = 0 
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
    const totalInput = cashAmount + transferAmount;
    const cashRatio = totalInput > 0 ? cashAmount / totalInput : 0;
    const amountForFine = Math.min(fineAllocation, totalInput);
    const amountForRent = totalInput - amountForFine;

    const createLog = async (amount: number, category: string, suffixDesc: string) => {
        if (amount <= 0) return;
        const cAmount = Math.round(amount * cashRatio);
        const tAmount = amount - cAmount; 

        if (cAmount > 0) {
            await recordPaymentLog({
                transaction_id: id,
                amount: cAmount,
                payment_method: 'cash',
                type: 'IN',
                description: `Cash: ${description} ${suffixDesc}`,
                category: category 
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

    await createLog(amountForRent, 'Sewa', '');
    await createLog(amountForFine, 'Denda', '(Bayar Denda)');
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

// Existing applyTransactionFine function (Preserved)
export const applyTransactionFine = async (
  id: string, 
  fineAmount: number
): Promise<{ success: boolean; newTotal?: number }> => {
  if (!supabase) return { success: false };

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

  const { error } = await supabase
    .from('transactions')
    .update({ 
      total_price: newTotal,
      fine_amount: newFine
    })
    .eq('id', id);

  if (error) {
    if (error.message.includes('fine_amount')) {
       await supabase.from('transactions').update({ total_price: newTotal }).eq('id', id);
       return { success: true, newTotal };
    }
    return { success: false };
  }

  return { success: true, newTotal };
};

// Existing updateTransactionStatus function (Preserved)
export const updateTransactionStatus = async (id: string, newStatus: string): Promise<boolean> => {
  if (!supabase) return false;

  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('status, items')
    .eq('id', id)
    .single();

  if (fetchError || !trx) return false;

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

// Existing calculateItemPriceForDuration function (Preserved)
export const calculateItemPriceForDuration = (item: CartItem, duration: number): number => {
    if (item.isSale) return item.salePrice || 0;

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

// Existing calculateOverdueFine function (Preserved)
export const calculateOverdueFine = (transaction: Transaction): { daysLate: number; fineAmount: number } => {
  if (transaction.status !== 'rented') return { daysLate: 0, fineAmount: 0 };

  const now = new Date();
  const rentalDate = new Date(transaction.rentalDate);
  const returnDate = new Date(rentalDate);
  returnDate.setDate(rentalDate.getDate() + (transaction.duration - 1));

  const overdueDeadline = new Date(returnDate);
  overdueDeadline.setHours(23, 59, 59, 999);

  if (now <= overdueDeadline) return { daysLate: 0, fineAmount: 0 };

  const diffTime = Math.abs(now.getTime() - overdueDeadline.getTime());
  const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const calculationDuration = daysLate + 1;

  const fineAmount = transaction.items.reduce((total, item) => {
      if (item.isSale) return total;
      const price = calculateItemPriceForDuration(item, calculationDuration);
      return total + (price * item.quantity);
  }, 0);

  return { daysLate, fineAmount };
};

// Existing updateTransactionDetails function (Preserved)
export const updateTransactionDetails = async (
  id: string, 
  name: string, 
  whatsapp: string, 
  duration: number,
  identity: string 
): Promise<boolean> => {
  if (!supabase) return false;

  const { data: trx, error: fetchError } = await supabase
    .from('transactions')
    .select('items, fine_amount')
    .eq('id', id)
    .single();

  if (fetchError || !trx) return false;

  const items = trx.items as CartItem[];
  const currentFine = Number(trx.fine_amount) || 0;
  
  let rentalPrice = 0;
  for (const item of items) {
      const unitPrice = calculateItemPriceForDuration(item, duration);
      rentalPrice += (unitPrice * item.quantity);
  }

  const newTotalPrice = rentalPrice + currentFine;

  const { error } = await supabase
    .from('transactions')
    .update({
      customer_name: name,
      customer_whatsapp: whatsapp,
      duration: duration,
      customer_identity: identity, 
      total_price: newTotalPrice
    })
    .eq('id', id);

  if (error) {
    if(error.message.includes('customer_identity')) {
       await supabase.from('transactions').update({
          customer_name: name,
          customer_whatsapp: whatsapp,
          duration: duration,
          total_price: newTotalPrice
        }).eq('id', id);
       return true;
    }
    return false;
  }

  return true;
};

// Existing updateTransactionItems function (Preserved)
export const updateTransactionItems = async (
  transactionId: string,
  newItems: CartItem[]
): Promise<boolean> => {
  if (!supabase) return false;

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

  let rentalPrice = 0;
  for (const item of newItems) {
      const unitPrice = calculateItemPriceForDuration(item, duration);
      rentalPrice += (unitPrice * item.quantity);
  }

  const newTotalPrice = rentalPrice + currentFine;

  const isActive = ['pending', 'partial_payment', 'booked', 'rented'].includes(status);
  
  if (isActive) {
      await processStockRestoration(oldItems);
      await processStockReduction(newItems);
  }

  const { error } = await supabase
    .from('transactions')
    .update({
        items: newItems,
        total_price: newTotalPrice
    })
    .eq('id', transactionId);

  if (error) return false;

  return true;
};

// Existing deleteTransaction function (Preserved)
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

// Existing copyInvoiceToClipboard function (Preserved)
export const copyInvoiceToClipboard = async (
  trx: Transaction, 
  invoiceType: 'full' | 'rental' | 'fine' = 'full'
) => {
  // ... (Full implementation of copyInvoiceToClipboard as provided previously)
  // Re-pasting the exact implementation to ensure file completeness
  const dateObj = new Date(trx.created_at || new Date());
  const dateStr = dateObj.toLocaleDateString('id-ID'); 
  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); 
  const fine = trx.fineAmount || 0;
  const rentalTotal = trx.totalPrice - fine; 
  const paidGlobal = trx.amountPaid || 0;
  const totalGlobal = trx.totalPrice;
  const isGlobalPaid = paidGlobal >= totalGlobal;
  const statusLabel = isGlobalPaid ? 'LUNAS' : 'BELUM LUNAS';
  const stampColor = isGlobalPaid ? '#000000' : '#DC0000'; 
  const fmt = (val: number) => val.toLocaleString('id-ID');
  const logoUrl = "https://imgur.com/iC8ycHT.png";

  let displayedItemsHtml = '';
  let displayedTotal = 0;
  let titleText = 'Struk Pembayaran';
  let showFineRow = false;

  if (invoiceType === 'fine') {
      titleText = 'NOTA DENDA';
      displayedTotal = fine;
      displayedItemsHtml = `
        <div style="margin-bottom:8px; border-bottom:1px dotted #ccc; padding-bottom:5px;">
          <div style="font-weight:700; color:red;">DENDA / CHARGE KETERLAMBATAN</div>
          <div style="display:flex; justify-content:space-between; font-size:12px;">
            <span>Ref Trx: #${trx.id.slice(0,6)}</span>
            <span>${fmt(fine)}</span>
          </div>
        </div>
      `;
  } else {
      displayedItemsHtml = trx.items.map((item) => {
        const unitPrice = calculateItemPriceForDuration(item, trx.duration);
        const totalPrice = unitPrice * item.quantity;
        const variantInfo = item.selectedSize || item.selectedColor 
          ? `(${[item.selectedSize, item.selectedColor].filter(Boolean).join('/')})` : '';
        const label = item.isSale ? 'BELI' : `${trx.duration}H`;

        return `
        <div style="margin-bottom:8px;">
          <div style="font-weight:700; font-size:12px; margin-bottom:2px;">${label} ${item.name.toUpperCase()} ${variantInfo}</div>
          <div style="display:flex; justify-content:space-between; font-size:12px; color:#000;">
            <span>${item.quantity} x ${fmt(unitPrice)}</span>
            <span>${fmt(totalPrice)}</span>
          </div>
        </div>`;
      }).join('');

      if (invoiceType === 'rental') {
          titleText = 'NOTA SEWA';
          displayedTotal = rentalTotal;
      } else {
          titleText = 'NOTA TAGIHAN';
          displayedTotal = trx.totalPrice;
          showFineRow = fine > 0;
      }
  }

  const fineHtml = showFineRow ? `
    <div style="margin-top:5px; border-top:1px dotted #ccc; padding-top:5px;">
      <div style="font-weight:700; font-size:12px; margin-bottom:2px; color:red;">DENDA KETERLAMBATAN</div>
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#000;">
        <span>Extra Charge</span>
        <span>${fmt(fine)}</span>
      </div>
    </div>` : '';

  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.top = '-9999px';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '350px'; 
  tempDiv.style.backgroundColor = '#fff';
  tempDiv.style.padding = '15px';
  tempDiv.style.fontFamily = "'Roboto Mono', monospace, sans-serif";
  tempDiv.style.color = '#000';
  tempDiv.style.boxSizing = 'border-box';
  
  tempDiv.innerHTML = `
    <div style="position:relative; overflow:hidden;">
        <div style="position:absolute; top:40%; left:50%; transform:translate(-50%, -50%) rotate(-15deg); border:4px solid ${stampColor}; color:${stampColor}; padding:5px 15px; font-size:24px; font-weight:900; text-transform:uppercase; border-radius:8px; opacity:0.25; pointer-events:none;">
            ${statusLabel}
        </div>
        <div style="text-align:center; margin-bottom:10px;">
          <img src="${logoUrl}" style="width:60px; display:block; margin:0 auto 5px; filter:grayscale(100%);" crossorigin="anonymous" />
          <div style="font-size:16px; font-weight:900; margin-bottom:2px; text-transform:uppercase;">MAMAS OUTDOOR</div>
          <div style="font-size:10px;">Jl. Cenderawasih, Grendeng, Purwokerto</div>
          <div style="font-size:10px; font-weight:bold;">WA: 085137411145</div>
        </div>
        <div style="border-bottom:1px dashed #000; margin:10px 0;"></div>
        <table style="width:100%; font-size:11px;">
          <tr><td style="width:35%;">Jenis</td><td style="text-align:right; font-weight:900;">${titleText}</td></tr>
          <tr><td>No Nota</td><td style="text-align:right;">TRX/${trx.id.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td>Pelanggan</td><td style="text-align:right;">${trx.customerName.slice(0,15)}</td></tr>
          <tr><td>Tanggal</td><td style="text-align:right;">${dateStr}</td></tr>
        </table>
        <div style="border-bottom:1px dashed #000; margin:10px 0;"></div>
        <div>
          ${displayedItemsHtml}
          ${fineHtml}
        </div>
        <div style="border-bottom:1px dashed #000; margin:10px 0;"></div>
        <table style="width:100%; font-size:12px; margin-top:5px;">
          <tr><td>Status</td><td style="text-align:right; font-weight:bold;">${statusLabel}</td></tr>
          <tr><td style="padding-top:5px;">Total Tagihan</td><td style="text-align:right; font-weight:bold; padding-top:5px;">${fmt(displayedTotal)}</td></tr>
        </table>
        <div style="border-bottom:1px dashed #000; margin:10px 0;"></div>
        <div style="text-align:center; font-size:10px; font-style:italic; margin-top:10px;">
           Terima kasih telah menyewa di Mamas Outdoor.
        </div>
    </div>
  `;

  document.body.appendChild(tempDiv);

  try {
    const canvas = await html2canvas(tempDiv, { 
        useCORS: true, 
        scale: 2, 
        backgroundColor: '#ffffff'
    });
    
    canvas.toBlob(async (blob) => {
        if (blob) {
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                
                let phone = trx.customerWhatsapp.replace(/\D/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.slice(1);
                const waUrl = `https://wa.me/${phone}`;
                window.open(waUrl, '_blank');
                
                alert("✅ Nota berhasil disalin sebagai GAMBAR! Silakan Paste di WA.");
            } catch (err) {
                console.error("Clipboard write failed:", err);
                alert("Gagal menyalin gambar otomatis.");
            }
        }
    }, 'image/png');

  } catch (error) {
      console.error("HTML2Canvas Error:", error);
      alert("Gagal membuat gambar nota.");
  } finally {
      document.body.removeChild(tempDiv);
  }
};

// Existing printInvoice function (Preserved)
export const printInvoice = (
  trx: Transaction, 
  mode: 'print' | 'view' = 'print',
  invoiceType: 'full' | 'rental' | 'fine' = 'full'
) => {
  const printWindow = window.open('', '', 'width=800,height=800');
  if (!printWindow) return alert('Izinkan pop-up untuk mencetak nota');

  const dateObj = new Date(trx.created_at || new Date());
  const dateStr = dateObj.toLocaleDateString('id-ID'); 
  const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); 
  const fine = trx.fineAmount || 0;
  const rentalTotal = trx.totalPrice - fine; 

  let displayedItemsHtml = '';
  let displayedTotal = 0;
  let titleText = 'Struk Pembayaran';
  let showFineRow = false;
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

        return `
        <div class="item-row">
          <div class="item-name">${label} ${item.name.toUpperCase()} ${variantInfo}</div>
          <div class="item-calc">
            <span>${item.quantity} x ${fmt(unitPrice)}</span>
            <span>${fmt(totalPrice)}</span>
          </div>
        </div>
        `;
      }).join('');

      if (invoiceType === 'rental') {
          titleText = 'NOTA SEWA';
          displayedTotal = rentalTotal;
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
  const statusLabel = isGlobalPaid ? 'LUNAS' : 'BELUM LUNAS';
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
          <tr><td class="meta-label">Jenis</td><td class="meta-val" style="font-weight:900">${titleText}</td></tr>
          <tr><td class="meta-label">No Nota</td><td class="meta-val">TRX/${trx.id.slice(0, 8).toUpperCase()}</td></tr>
          <tr><td class="meta-label">Pelanggan</td><td class="meta-val">MO-${trx.id.slice(0,4)} ${trx.customerName}</td></tr>
          <tr><td class="meta-label">Tanggal</td><td class="meta-val">${dateStr} - ${timeStr}</td></tr>
          <tr><td class="meta-label">Kasir</td><td class="meta-val">Admin Mamas Outdoor</td></tr>
        </table>
        <div class="dashed-line"></div>
        <div class="items-container">
          ${displayedItemsHtml}
          ${fineHtml}
        </div>
        <div class="dashed-line"></div>
        <table class="summary-table">
          <tr><td class="sum-label">Status Global</td><td class="sum-val">${statusLabel}</td></tr>
          <tr><td class="sum-label" style="padding-top:10px;">Total Tagihan Ini</td><td class="sum-val" style="padding-top:10px;">${fmt(displayedTotal)}</td></tr>
        </table>
        <div class="dashed-line"></div>
        <div class="footer-text">
           Terima kasih atas kepercayaan Anda telah memilih kami sebagai mitra petualangan outdoor Anda. 
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

// Existing mapDbToTransaction function (Preserved)
const mapDbToTransaction = (dbItem: any): Transaction => {
  return {
    id: dbItem.id.toString(),
    created_at: dbItem.created_at,
    customerName: dbItem.customer_name,
    customerWhatsapp: dbItem.customer_whatsapp,
    customerCampus: dbItem.customer_campus || '-', 
    customerLocation: dbItem.customer_location || undefined, 
    customerIdentity: dbItem.customer_identity || undefined, 
    rentalDate: dbItem.rental_date,
    duration: dbItem.duration,
    totalPrice: dbItem.total_price,
    fineAmount: dbItem.fine_amount || 0, 
    amountPaid: dbItem.amount_paid || 0, 
    items: dbItem.items,
    status: dbItem.status,
    paymentMethod: dbItem.payment_method || 'cash' 
  };
};
