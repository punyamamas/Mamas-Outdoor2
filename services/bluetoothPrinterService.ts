
import { Transaction } from '../types';
import { getStoreConfig } from '../utils/storeConfig';
import QRCode from 'qrcode';

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
    const logoUrl = "https://imgur.com/iC8ycHT.png"; 
    
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
