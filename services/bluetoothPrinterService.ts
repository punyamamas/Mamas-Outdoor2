
import { Transaction } from '../types';
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
const formatRow = (left: string, right: string, width: number = 32) => {
    const leftLen = left.length;
    const rightLen = right.length;
    // Pastikan ada minimal 1 spasi
    const spaceLen = Math.max(1, width - leftLen - rightLen);
    
    // Jika teks kiri + kanan terlalu panjang, potong kiri atau wrap (disini kita potong agar rapi)
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
    await printCharacteristic.writeValue(encoder.encode(command));
};

const sendText = async (text: string) => {
    if (!printCharacteristic) throw new Error("Printer not connected");
    await printCharacteristic.writeValue(encoder.encode(text));
};

// Helper Garis Putus-putus
const createDivider = () => '-'.repeat(32) + LF;

export const printTestPage = async () => {
    if (!printCharacteristic) return alert("Printer belum terhubung!");
    try {
        await sendCommand(COMMANDS.INIT);
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendText("TEST CONNECTION OK\n");
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
    // Format tanggal: 2/1/2026 - 21.22
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`;
    const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');

    // Hitung Periode: 2 Jan s/d 3 Jan 26 (2 Hari)
    const startDate = new Date(trx.rentalDate);
    const returnDate = new Date(startDate);
    returnDate.setDate(startDate.getDate() + (trx.duration - 1));
    const startStr = startDate.toLocaleDateString('id-ID', {day:'numeric', month:'short'});
    const endStr = returnDate.toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'2-digit'});
    const periodeStr = `${startStr} s/d ${endStr} (${trx.duration} Hari)`;

    // Status Lunas
    const paid = trx.amountPaid || 0;
    const total = trx.totalPrice;
    const isLunas = paid >= total;
    const statusText = isLunas ? "LUNAS" : "BELUM LUNAS";
    const notaType = isLunas ? "NOTA TAGIHAN" : "NOTA SEWA"; // Sesuai screenshot

    // Pelanggan Format: MO-46 Ian
    const custId = `MO-${trx.id.slice(0,4)}`;
    const custName = trx.customerName.split(' ')[0]; // Ambil nama depan saja biar muat
    const pelangganStr = `${custId} ${custName}`;

    try {
        // 1. HEADER (LOGO TEXT & ALAMAT)
        await sendCommand(COMMANDS.INIT);
        await sendCommand(COMMANDS.ALIGN_CENTER);
        
        // "MAMAS OUTDOOR" (Bold, Double Height)
        await sendCommand(COMMANDS.BOLD_ON);
        await sendCommand(COMMANDS.TEXT_DOUBLE_HEIGHT);
        await sendText(config.storeName.toUpperCase() + LF);
        await sendCommand(COMMANDS.TEXT_NORMAL); // Reset size
        await sendCommand(COMMANDS.BOLD_OFF);
        
        // Alamat (Wrap text manual jika perlu, tapi printer usually wraps)
        await sendText("Jalan Cenderawasih, Grendeng, Purwokerto" + LF);
        await sendText("Utara" + LF);
        
        // WA (Bold)
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(`WA: ${config.adminWhatsapp}` + LF);
        await sendCommand(COMMANDS.BOLD_OFF);
        
        await sendText(createDivider());

        // 2. METADATA (Rata Kiri - Kanan)
        await sendCommand(COMMANDS.ALIGN_LEFT);
        
        // Jenis: NOTA TAGIHAN (Bold Right)
        // Kita manual bold bagian kanan agak susah di satu baris, jadi kita bold semua atau tidak.
        // Strategi: Print normal, alignment via spaces.
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(formatRow("Jenis", notaType) + LF);
        await sendCommand(COMMANDS.BOLD_OFF);

        await sendText(formatRow("No Nota", `TRX/${trx.id.slice(0,6).toUpperCase()}`) + LF);
        await sendText(formatRow("Pelanggan", pelangganStr) + LF);
        await sendText(formatRow("Jaminan", trx.customerIdentity || "-") + LF);
        
        // Tanggal: 2/1/2026 - 21.22
        await sendText(formatRow("Tanggal", `${dateStr} - ${timeStr}`) + LF);
        
        // Periode (Italic simulated by layout context, standard font)
        // Periode is usually slightly indented or full width in screenshot
        await sendText(`Periode: ${periodeStr}` + LF);
        
        await sendText(formatRow("Kasir", "Admin") + LF);
        
        await sendText(createDivider());

        // 3. ITEMS
        // Format Screenshot:
        // 2H TRIPOD (Bold)
        // 1 x 13.000 ................. 13.000
        
        for (const item of trx.items) {
            const unitPrice = calculateItemPriceForDuration(item, trx.duration);
            const lineTotal = unitPrice * item.quantity;
            
            const variantInfo = item.selectedSize || item.selectedColor 
                ? ` (${item.selectedSize || ''} ${item.selectedColor || ''})` : '';
            
            // Nama Barang (Bold)
            const prefix = item.isSale ? "" : `${trx.duration}H `;
            const itemName = `${prefix}${item.name.toUpperCase()}${variantInfo}`;
            
            await sendCommand(COMMANDS.BOLD_ON);
            await sendText(itemName + LF);
            await sendCommand(COMMANDS.BOLD_OFF);
            
            // Kalkulasi
            const calcLeft = `${item.quantity} x ${unitPrice.toLocaleString('id-ID')}`;
            const calcRight = lineTotal.toLocaleString('id-ID');
            await sendText(formatRow(calcLeft, calcRight) + LF);
        }
        
        // Denda jika ada
        if ((trx.fineAmount || 0) > 0) {
             await sendText(LF); // Spacer
             await sendCommand(COMMANDS.BOLD_ON);
             await sendText("DENDA KETERLAMBATAN" + LF);
             await sendCommand(COMMANDS.BOLD_OFF);
             await sendText(formatRow("Extra Charge", trx.fineAmount!.toLocaleString('id-ID')) + LF);
        }

        await sendText(createDivider());

        // 4. TOTAL & STATUS
        // Status Global ....... LUNAS (Bold)
        await sendText("Status Global" + ' '.repeat(32 - "Status Global".length - statusText.length) + statusText + LF);
        
        // Total Tagihan Ini ... 13.000 (Bold)
        await sendCommand(COMMANDS.BOLD_ON);
        const totalLabel = "Total Tagihan Ini";
        const totalVal = trx.totalPrice.toLocaleString('id-ID');
        await sendText(formatRow(totalLabel, totalVal) + LF);
        await sendCommand(COMMANDS.BOLD_OFF);
        
        // Spacer for visual separation
        await sendText(LF);

        // 5. QR CODE PLACEHOLDER & FOOTER
        // Note: Generic thermal printers need specific hex commands for QR. 
        // To be safe and fast, we use text or skip graphic QR.
        // We will center the text placeholder.
        await sendCommand(COMMANDS.ALIGN_CENTER);
        
        // Placeholder kotak QR (Text based art)
        await sendText("Scan untuk Cek Status" + LF);
        
        await sendCommand(COMMANDS.ALIGN_LEFT);
        await sendText(createDivider());
        
        // Footer Message (Italic-like)
        await sendCommand(COMMANDS.ALIGN_CENTER);
        // Split footer message nicely
        const msg = config.footerMessage || "Terima kasih telah menyewa";
        await sendText(msg + LF);
        await sendText("#SalamLestari" + LF);
        
        // Feed & Cut
        await sendText(LF + LF + LF);
        await sendCommand(COMMANDS.CUT_PAPER);

    } catch (error) {
        console.error("Print Error", error);
        alert("Gagal mencetak struk. Cek koneksi printer.");
    }
};
