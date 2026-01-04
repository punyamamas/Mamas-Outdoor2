
import { Transaction } from '../types';
import { getStoreConfig } from '../utils/storeConfig';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

// --- TYPE DEFINITIONS FOR WEB BLUETOOTH API ---
interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
  disconnect(): void;
}

interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

// --- ESC/POS COMMANDS CONSTANTS ---
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

const COMMANDS = {
  INIT: ESC + '@',
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  TEXT_NORMAL: GS + '!' + '\x00',
  TEXT_DOUBLE_HEIGHT: GS + '!' + '\x10',
  TEXT_DOUBLE_WIDTH: GS + '!' + '\x20',
  TEXT_QUAD: GS + '!' + '\x30',
  CUT_PAPER: GS + 'V' + '\x41' + '\x03', // Partial cut
};

// KONFIGURASI UKURAN KERTAS 80MM
const PRINTER_WIDTH = 48; // 80mm biasanya 48 karakter (Font A). Untuk 58mm gunakan 32.

let printCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let connectedDevice: BluetoothDevice | null = null;

// --- IMAGE PROCESSING UTILS (Convert Image/QR to ESC/POS Bitmap) ---
const processImageForPrinter = async (src: string, targetWidth: number = 384): Promise<Uint8Array | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = src;
        img.onload = () => {
            // Create Canvas
            const canvas = document.createElement('canvas');
            // Calculate height ensuring aspect ratio
            const height = Math.floor((img.height * targetWidth) / img.width);
            canvas.width = targetWidth;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            
            // Draw image white background first (for transparent PNGs like Logo/QR)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, targetWidth, height);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imgData.data;
            
            // Convert to ESC/POS Raster Bit Image (GS v 0)
            // Format: GS v 0 m xL xH yL yH d1...dk
            const xL = (canvas.width / 8) % 256;
            const xH = Math.floor((canvas.width / 8) / 256);
            const yL = canvas.height % 256;
            const yH = Math.floor(canvas.height / 256);
            
            // Header Command
            const header = [0x1D, 0x76, 0x30, 0, xL, xH, yL, yH];
            const bytes: number[] = [];
            
            // Process Pixels
            for (let y = 0; y < canvas.height; y++) {
                for (let x = 0; x < canvas.width; x += 8) {
                    let byte = 0;
                    for (let b = 0; b < 8; b++) {
                        if (x + b < canvas.width) {
                            const offset = (y * canvas.width + (x + b)) * 4;
                            // Calculate luminance (grayscale)
                            const r = pixels[offset];
                            const g = pixels[offset + 1];
                            const b_val = pixels[offset + 2];
                            const brightness = (r * 0.299 + g * 0.587 + b_val * 0.114);
                            
                            // Thresholding (Black if dark, White if light)
                            if (brightness < 128) {
                                byte |= (1 << (7 - b)); // Set bit to 1 for black
                            }
                        }
                    }
                    bytes.push(byte);
                }
            }
            
            // Combine Header + Data
            const finalData = new Uint8Array(header.length + bytes.length);
            finalData.set(header);
            finalData.set(bytes, header.length);
            resolve(finalData);
        };
        img.onerror = () => resolve(null);
    });
};

// --- HELPER: CALCULATE PRICE ---
const calculateItemPriceForDuration = (item: any, days: number): number => {
    if (item.isSale) return item.salePrice || 0;

    const p2 = item.price2Days || 0;
    const p3 = item.price3Days || 0;
    const p4 = item.price4Days || 0;
    const p5 = item.price5Days || 0;
    const p6 = item.price6Days || 0;
    const p7 = item.price7Days || 0;

    if (days <= 2) return p2;
    if (days === 3) return p3;
    if (days === 4) return p4;
    if (days === 5) return p5;
    if (days === 6) return p6;
    return p7 + ((days - 7) * (p2 * 0.4));
};

// --- HELPER: FORMAT ROW (JUSTIFY BETWEEN) ---
// Membuat format: "Label .......... Value"
const formatRow = (left: string, right: string, width: number = PRINTER_WIDTH) => {
    const leftLen = left.length;
    const rightLen = right.length;
    // Pastikan ada minimal 1 spasi
    const spaceLen = Math.max(1, width - leftLen - rightLen);
    
    // Jika teks kiri + kanan terlalu panjang, potong kiri agar rapi
    if (leftLen + rightLen > width) {
        const cutLeft = left.substring(0, width - rightLen - 1);
        return cutLeft + ' ' + right;
    }
    
    return left + ' '.repeat(spaceLen) + right;
};

// --- CONNECTION LOGIC ---

export const connectPrinter = async (): Promise<boolean> => {
  const nav = navigator as any; 
  if (!nav.bluetooth) {
    alert("Browser ini tidak mendukung Web Bluetooth API. Gunakan Chrome di Android/Desktop.");
    return false;
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], 
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    }) as BluetoothDevice;

    if (!device || !device.gatt) return false;

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    printCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    
    connectedDevice = device;
    
    device.addEventListener('gattserverdisconnected', () => {
        printCharacteristic = null;
        connectedDevice = null;
        alert("Printer Terputus!");
    });

    return true;
  } catch (error) {
    console.error("Bluetooth Error:", error);
    alert("Gagal koneksi: " + (error as any).message);
    return false;
  }
};

export const disconnectPrinter = () => {
    if (connectedDevice && connectedDevice.gatt) {
        connectedDevice.gatt.disconnect();
    }
    printCharacteristic = null;
    connectedDevice = null;
};

export const getPrinterStatus = () => {
    return !!printCharacteristic;
};

// --- PRINTING LOGIC ---

const encoder = new TextEncoder();

const sendCommand = async (command: string) => {
    if (!printCharacteristic) throw new Error("Printer not connected");
    // Pecah command panjang (seperti gambar) menjadi chunk kecil (max 512 bytes)
    // karena Bluetooth Low Energy (BLE) punya limitasi paket data
    const maxChunk = 512;
    const data = encoder.encode(command);
    for (let i = 0; i < data.length; i += maxChunk) {
        await printCharacteristic.writeValue(data.slice(i, i + maxChunk));
    }
};

const sendText = async (text: string) => {
    if (!printCharacteristic) throw new Error("Printer not connected");
    const data = encoder.encode(text);
    const maxChunk = 512;
    for (let i = 0; i < data.length; i += maxChunk) {
        await printCharacteristic.writeValue(data.slice(i, i + maxChunk));
    }
};

const sendBytes = async (data: Uint8Array) => {
    if (!printCharacteristic) throw new Error("Printer not connected");
    const maxChunk = 512;
    for (let i = 0; i < data.length; i += maxChunk) {
        await printCharacteristic.writeValue(data.slice(i, i + maxChunk));
    }
};

// Helper Garis Putus-putus (Sesuai lebar kertas)
const createDivider = () => '-'.repeat(PRINTER_WIDTH) + LF;

export const printTestPage = async () => {
    if (!printCharacteristic) return alert("Printer belum terhubung!");
    try {
        await sendCommand(COMMANDS.INIT);
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendText("TEST 80MM PRINTER OK\n");
        await sendText(createDivider());
        await sendCommand(COMMANDS.CUT_PAPER);
    } catch (e) {
        alert("Gagal mencetak test page.");
    }
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
  const logoUrl = "https://image2url.com/r2/default/images/1767518643928-dd5a63dc-ddb0-4fdf-85e9-084b12f9c036.png"; 
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

export const printTransactionReceipt = async (trx: Transaction) => {
    if (!printCharacteristic) {
        const reconnect = await connectPrinter();
        if(!reconnect) return;
    }

    const config = getStoreConfig();
    const dateObj = new Date(trx.created_at || new Date());
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`;
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

    // Periode
    const startDate = new Date(trx.rentalDate);
    const returnDate = new Date(startDate);
    returnDate.setDate(startDate.getDate() + (trx.duration - 1));
    const startStr = startDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
    const endStr = returnDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'});
    const periodeStr = `${startStr} s/d ${endStr} (${trx.duration} Hari)`;

    // Status
    const paid = trx.amountPaid || 0;
    const total = trx.totalPrice;
    const isLunas = paid >= total;
    const statusText = isLunas ? "LUNAS" : "BELUM LUNAS";
    const notaType = isLunas ? "NOTA TAGIHAN" : "NOTA SEWA";

    // Pelanggan
    const custId = `MO-${trx.id.slice(0,4)}`;
    const custName = trx.customerName.split(' ')[0];
    const pelangganStr = `${custId} ${custName}`;

    // --- PREPARE IMAGES (LOGO & QR) ---
    // Gunakan URL Logo Mamas Outdoor
    const logoUrl = "https://image2url.com/r2/default/images/1767518643928-dd5a63dc-ddb0-4fdf-85e9-084b12f9c036.png"; 
    
    // Generate QR Data URL
    let qrDataUrl = '';
    try {
        qrDataUrl = await QRCode.toDataURL(trx.id, { margin: 0, width: 200 });
    } catch (e) { console.error("QR Fail", e); }

    try {
        await sendCommand(COMMANDS.INIT);
        
        // 1. HEADER (LOGO)
        await sendCommand(COMMANDS.ALIGN_CENTER);
        
        // Process & Print Logo (Width ~300px agar pas di tengah)
        const logoBytes = await processImageForPrinter(logoUrl, 350);
        if (logoBytes) {
            await sendBytes(logoBytes);
            await sendText(LF); // Spacer after logo
        }

        // TEXT HEADER
        await sendCommand(COMMANDS.BOLD_ON);
        await sendCommand(COMMANDS.TEXT_DOUBLE_HEIGHT);
        await sendText(config.storeName.toUpperCase() + LF);
        await sendCommand(COMMANDS.TEXT_NORMAL);
        await sendCommand(COMMANDS.BOLD_OFF);
        
        await sendText("Jalan Cenderawasih, Grendeng, Purwokerto" + LF);
        await sendText("Utara" + LF);
        
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(`WA: ${config.adminWhatsapp}` + LF);
        await sendCommand(COMMANDS.BOLD_OFF);
        
        await sendText(createDivider());

        // 2. METADATA (80mm Layout)
        await sendCommand(COMMANDS.ALIGN_LEFT);
        
        // Jenis (Right Align Hack using formatRow)
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(formatRow("Jenis", notaType) + LF);
        await sendCommand(COMMANDS.BOLD_OFF);

        await sendText(formatRow("No Nota", `TRX/${trx.id.slice(0,6).toUpperCase()}`) + LF);
        await sendText(formatRow("Pelanggan", pelangganStr) + LF);
        await sendText(formatRow("Jaminan", trx.customerIdentity || "-") + LF);
        await sendText(formatRow("Tanggal", `${dateStr} - ${timeStr}`) + LF);
        await sendText(`Periode: ${periodeStr}` + LF);
        await sendText(formatRow("Kasir", "Admin") + LF);
        
        await sendText(createDivider());

        // 3. ITEMS
        for (const item of trx.items) {
            const unitPrice = calculateItemPriceForDuration(item, trx.duration);
            const lineTotal = unitPrice * item.quantity;
            
            const variantInfo = item.selectedSize || item.selectedColor 
                ? ` (${item.selectedSize || ''} ${item.selectedColor || ''})` : '';
            
            const prefix = item.isSale ? "" : `${trx.duration}H `;
            const itemName = `${prefix}${item.name.toUpperCase()}${variantInfo}`;
            
            await sendCommand(COMMANDS.BOLD_ON);
            await sendText(itemName + LF);
            await sendCommand(COMMANDS.BOLD_OFF);
            
            const calcLeft = `${item.quantity} x ${unitPrice.toLocaleString('id-ID')}`;
            const calcRight = lineTotal.toLocaleString('id-ID');
            await sendText(formatRow(calcLeft, calcRight) + LF);
        }
        
        if ((trx.fineAmount || 0) > 0) {
             await sendText(LF);
             await sendCommand(COMMANDS.BOLD_ON);
             await sendText("DENDA KETERLAMBATAN" + LF);
             await sendCommand(COMMANDS.BOLD_OFF);
             await sendText(formatRow("Extra Charge", trx.fineAmount!.toLocaleString('id-ID')) + LF);
        }

        await sendText(createDivider());

        // 4. TOTAL & STATUS
        await sendText(formatRow("Status Global", statusText) + LF);
        
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(formatRow("Total Tagihan Ini", trx.totalPrice.toLocaleString('id-ID')) + LF);
        await sendCommand(COMMANDS.BOLD_OFF);
        
        await sendText(LF);

        // 5. QR CODE (BITMAP) & FOOTER
        await sendCommand(COMMANDS.ALIGN_CENTER);
        
        if (qrDataUrl) {
            // Process & Print QR Code (Width ~200px)
            const qrBytes = await processImageForPrinter(qrDataUrl, 250);
            if (qrBytes) {
                await sendBytes(qrBytes);
                await sendText(LF);
            }
        }
        
        await sendText("Scan untuk Cek Status" + LF);
        await sendCommand(COMMANDS.ALIGN_LEFT);
        await sendText(createDivider());
        
        await sendCommand(COMMANDS.ALIGN_CENTER);
        const msg = config.footerMessage || "Terima kasih telah menyewa";
        await sendText(msg + LF);
        await sendText("#SalamLestari" + LF);
        
        await sendText(LF + LF + LF);
        await sendCommand(COMMANDS.CUT_PAPER);

    } catch (error) {
        console.error("Print Error", error);
        alert("Gagal mencetak struk. Cek koneksi printer.");
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
  const logoUrl = "https://image2url.com/r2/default/images/1767518643928-dd5a63dc-ddb0-4fdf-85e9-084b12f9c036.png";

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
