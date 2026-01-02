import { Transaction } from '../types';
import { getStoreConfig } from '../utils/storeConfig';

// --- TYPE DEFINITIONS FOR WEB BLUETOOTH API ---
// These are necessary because the 'web-bluetooth' types might not be included in the project configuration.

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

// --- CONNECTION LOGIC ---

export const connectPrinter = async (): Promise<boolean> => {
  const nav = navigator as any; // Cast to any to access bluetooth property safely
  if (!nav.bluetooth) {
    alert("Browser ini tidak mendukung Web Bluetooth API. Gunakan Chrome di Android/Desktop.");
    return false;
  }

  try {
    // Request device with filtering for common printer services
    // 0x18f0 is standard defined for many printers, but 'generic_access' is safer for broad support
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], 
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
    }) as BluetoothDevice;

    if (!device || !device.gatt) return false;

    const server = await device.gatt.connect();
    // Service UUID for typical Thermal Printers
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    // Characteristic for Write
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
    // Convert text to Uint8Array (handling standard characters)
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

        // 2. METADATA
        await sendCommand(COMMANDS.ALIGN_LEFT);
        await sendText(`No Nota : #${trx.id.slice(0, 8).toUpperCase()}` + LF);
        await sendText(`Tgl     : ${dateStr} ${timeStr}` + LF);
        await sendText(`Nama    : ${trx.customerName.slice(0, 20)}` + LF);
        await sendText(`Kasir   : Admin` + LF);
        await sendText(createDivider());

        // 3. ITEMS
        // Format: 
        // Nama Barang
        // Qty x HargaSatuan        Total
        
        for (const item of trx.items) {
            // Logic harga dinamis (sewa vs beli)
            let unitPrice = 0;
            if (item.isSale) {
                unitPrice = item.salePrice || 0;
            } else {
                // Kalkulasi harga sewa per durasi (manual logic simplified for thermal to match transactionService)
                // Kita ambil approximation dari total / qty jika tidak ada helper, 
                // tapi best practice import logic harga.
                // Disini kita asumsi data totalPrice item sudah benar atau hitung ulang
                // Untuk simplifikasi struk thermal, kita hitung kasar dari logic standard:
                const p2 = item.price2Days || 0;
                // ... (Logic harga complex di skip, kita pakai total per item / qty)
                // Fallback:
                unitPrice = item.price2Days || 0; 
                // Note: Idealnya passing calculated price dari component UI
            }
            
            // Re-calculate row total for display accurately based on days
            // We'll use a simpler approach: Just show the line item total if logic is complex
            // Or assume component passes calculated values. 
            // For now, let's print Item Name and Quantity to be safe.
            
            await sendText(item.name + LF);
            
            // Build the second line "2 x 50.000"
            const qtyPrice = `${item.quantity} x ...`; // Price varies by days, hard to calc here without helper
            // Hack: Just print Qty
            await sendText(`${item.quantity} Unit (Sewa ${trx.duration} Hari)` + LF);
        }
        
        await sendText(createDivider());

        // 4. TOTALS
        await sendCommand(COMMANDS.ALIGN_RIGHT);
        await sendCommand(COMMANDS.BOLD_ON);
        await sendText(`TOTAL : Rp${trx.totalPrice.toLocaleString('id-ID')}` + LF);
        
        if (trx.amountPaid > 0) {
            await sendText(`BAYAR : Rp${trx.amountPaid.toLocaleString('id-ID')}` + LF);
            const change = trx.amountPaid - trx.totalPrice;
            if (change >= 0) {
                await sendText(`KEMBALI : Rp${change.toLocaleString('id-ID')}` + LF);
            } else {
                await sendText(`KURANG : Rp${Math.abs(change).toLocaleString('id-ID')}` + LF);
            }
        }
        
        await sendCommand(COMMANDS.BOLD_OFF);
        await sendCommand(COMMANDS.ALIGN_LEFT);
        await sendText(createDivider());

        // 5. FOOTER
        await sendCommand(COMMANDS.ALIGN_CENTER);
        await sendText("Syarat & Ketentuan:" + LF);
        await sendText("Barang rusak/hilang wajib ganti." + LF);
        await sendText("Keterlambatan kena denda." + LF);
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