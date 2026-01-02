
import { Transaction, CartItem } from '../types';
import { getStoreConfig } from '../utils/storeConfig';

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

let printCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let connectedDevice: BluetoothDevice | null = null;

// --- HELPER: CALCULATE PRICE (Same as transactionService) ---
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
    // Jika lebih dari 7 hari: Harga 7 hari + (Kelebihan hari x 40% harga 2 hari)
    return p7 + ((days - 7) * (p2 * 0.4));
};

// --- HELPER: FORMAT ROW (Left --- Right) ---
// Standard 58mm printer has approx 32 chars width
// Standard 80mm printer has approx 48 chars width
// We default to 32 for safety on 58mm
const formatRow = (left: string, right: string, width: number = 32) => {
    const leftLen = left.length;
    const rightLen = right.length;
    const spaceLen = width - leftLen - rightLen;
    
    if (spaceLen < 1) {
        // If too long, just put a space and maybe wrap (simplified)
        return left.substring(0, width - rightLen - 1) + ' ' + right;
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
    await printCharacteristic.writeValue(encoder.encode(command));
};

const sendText = async (text: string) => {
    if (!printCharacteristic) throw new Error("Printer not connected");
    await printCharacteristic.writeValue(encoder.encode(text));
};

// Helper untuk membuat garis putus-putus
const createDivider = () => '-'.repeat(32) + LF;

export const printTestPage = async () => {
    if (!printCharacteristic) return alert("Printer belum terhubung!");
    try {
        await sendCommand(COMMANDS.INIT);
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendCommand(COMMANDS.TEXT_DOUBLE_HEIGHT);
        await sendText("TEST PRINT\n");
        await sendCommand(COMMANDS.TEXT_NORMAL);
        await sendText("Mamas Outdoor System\n");
        await sendText("Koneksi Bluetooth Berhasil!\n\n");
        await sendText(createDivider());
        await sendText("\n\n\n");
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
    const dateStr = dateObj.toLocaleDateString('id-ID');
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Hitung Periode
    const startDate = new Date(trx.rentalDate);
    const returnDate = new Date(startDate);
    returnDate.setDate(startDate.getDate() + (trx.duration - 1));
    const startStr = startDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
    const endStr = returnDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'});
    const periodeStr = `${startStr} s/d ${endStr} (${trx.duration}Hr)`;

    // Status Pembayaran
    const paid = trx.amountPaid || 0;
    const total = trx.totalPrice;
    const isLunas = paid >= total;
    const statusText = isLunas ? "LUNAS" : "BELUM LUNAS";

    // Judul Nota
    const title = trx.items.every(i => i.isSale) ? "NOTA PENJUALAN" : (isLunas ? "NOTA SEWA" : "NOTA TAGIHAN");

    try {
        // 1. HEADER
        await sendCommand(COMMANDS.INIT);
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendCommand(COMMANDS.BOLD_ON);
        await sendCommand(COMMANDS.TEXT_DOUBLE_HEIGHT);
        await sendText(config.storeName.toUpperCase() + LF);
        await sendCommand(COMMANDS.TEXT_NORMAL);
        await sendCommand(COMMANDS.BOLD_OFF);
        await sendText(config.storeAddress + LF);
        await sendText(`WA: ${config.adminWhatsapp}` + LF);
        await sendText(createDivider());

        // 2. METADATA (Format sama dengan HTML)
        await sendCommand(COMMANDS.ALIGN_LEFT);
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(title + LF); // Title
        await sendCommand(COMMANDS.BOLD_OFF);
        
        await sendText(formatRow("No Nota", `: TRX/${trx.id.slice(0, 6).toUpperCase()}`) + LF);
        await sendText(formatRow("Tgl", `: ${dateStr} ${timeStr}`) + LF);
        await sendText(formatRow("Plg", `: ${trx.customerName.slice(0, 20)}`) + LF);
        await sendText(formatRow("Jaminan", `: ${trx.customerIdentity || '-'}`) + LF);
        await sendText(formatRow("Periode", `: ${periodeStr}`) + LF);
        await sendText(formatRow("Kasir", `: Admin`) + LF);
        
        await sendText(createDivider());

        // 3. ITEMS (Format sama dengan HTML)
        // Line 1: [Durasi/Beli] Nama Barang (Varian)
        // Line 2: Qty x Harga @      Total
        
        for (const item of trx.items) {
            const unitPrice = calculateItemPriceForDuration(item, trx.duration);
            const lineTotal = unitPrice * item.quantity;
            
            const variantInfo = item.selectedSize || item.selectedColor 
                ? `(${[item.selectedSize, item.selectedColor].filter(Boolean).join('/')})` : '';
            
            const label = item.isSale ? '[BELI]' : `[${trx.duration}H]`;
            const nameLine = `${label} ${item.name} ${variantInfo}`;
            
            // Format angka
            const calcLine = `${item.quantity} x ${unitPrice.toLocaleString('id-ID')}`;
            const totalStr = lineTotal.toLocaleString('id-ID');

            await sendCommand(COMMANDS.ALIGN_LEFT);
            await sendCommand(COMMANDS.BOLD_ON);
            await sendText(nameLine + LF);
            await sendCommand(COMMANDS.BOLD_OFF);
            
            // Calc line with spacing
            await sendText(formatRow(calcLine, totalStr) + LF);
        }
        
        // Denda (Jika ada)
        if ((trx.fineAmount || 0) > 0) {
             await sendText(LF);
             await sendCommand(COMMANDS.BOLD_ON);
             await sendText("DENDA KETERLAMBATAN" + LF);
             await sendCommand(COMMANDS.BOLD_OFF);
             await sendText(formatRow("Extra Charge", trx.fineAmount!.toLocaleString('id-ID')) + LF);
        }

        await sendText(createDivider());

        // 4. TOTALS
        // Status Global (Big)
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(`*** ${statusText} ***` + LF);
        await sendCommand(COMMANDS.BOLD_OFF);
        await sendText(LF);

        // Detail Angka
        await sendCommand(COMMANDS.ALIGN_LEFT);
        await sendText(formatRow("TOTAL TAGIHAN", `Rp${trx.totalPrice.toLocaleString('id-ID')}`) + LF);
        
        if (paid > 0) {
            await sendText(formatRow("SUDAH BAYAR", `Rp${paid.toLocaleString('id-ID')}`) + LF);
            const diff = paid - trx.totalPrice;
            if (diff >= 0) {
                await sendText(formatRow("KEMBALI", `Rp${diff.toLocaleString('id-ID')}`) + LF);
            } else {
                await sendCommand(COMMANDS.BOLD_ON);
                await sendText(formatRow("KURANG", `Rp${Math.abs(diff).toLocaleString('id-ID')}`) + LF);
                await sendCommand(COMMANDS.BOLD_OFF);
            }
        }
        
        await sendText(createDivider());

        // 5. FOOTER
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendText(config.footerMessage + LF);
        await sendText(LF);
        await sendText("#SalamLestari" + LF);
        await sendText(LF + LF + LF);
        
        // 6. CUT
        await sendCommand(COMMANDS.CUT_PAPER);

    } catch (error) {
        console.error("Print Error", error);
        alert("Gagal mencetak struk. Cek koneksi printer.");
    }
};
