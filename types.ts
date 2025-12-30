
export interface Category {
  id: string; 
  name: string;
}

export interface PackageItem {
  productId: string;
  quantity: number;
}

export interface ProductVariant {
  color: string;
  size: string;
  stock: number;
}

export interface ColorImage {
  color: string;
  url: string;
}

export interface Product {
  id: string;
  name: string;
  category: string; 
  price2Days: number; 
  price3Days: number;
  price4Days: number;
  price5Days: number;
  price6Days: number;
  price7Days: number; 
  image: string;
  description: string;
  stock: number; 
  rented?: number; 
  damaged?: number; 
  
  packageItems?: PackageItem[]; 
  sizes?: { [key: string]: number }; 
  colors?: string[]; 
  variants?: ProductVariant[]; 
  colorImages?: ColorImage[]; 
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize?: string; 
  selectedColor?: string; 
}

export interface UserDetails {
  name: string;
  whatsapp: string;
  // campus removed
  rentalDate: string;
  duration: number;
  paymentMethod: 'transfer' | 'cash'; 
}

// Updated Transaction Interface
export interface Transaction {
  id: string; // ID dari Supabase
  created_at?: string;
  customerName: string; // Mapped from customer_name
  customerWhatsapp: string; // Mapped from customer_whatsapp
  customerCampus: string; // Mapped from customer_campus
  customerLocation?: string; // New Field: Lokasi dari IP Geolocation
  rentalDate: string; // Mapped from rental_date
  duration: number;
  totalPrice: number; // Mapped from total_price
  amountPaid: number; // New Field: Total yang sudah dibayar
  items: CartItem[];
  // Status Update: 
  // pending (Belum Bayar) -> partial_payment (Cicil) -> booked (Lunas/Booking) -> rented (Sedang Sewa) -> completed (Selesai)
  status: 'pending' | 'partial_payment' | 'booked' | 'rented' | 'completed' | 'cancelled'; 
  paymentMethod?: 'transfer' | 'cash'; 
}

// NEW: Interface untuk mencatat log keuangan (Kas Kecil / Arus Kas Harian)
export interface PaymentLog {
  id: string;
  created_at: string;
  transaction_id?: string; // Optional, bisa null jika transaksi manual (misal: beli bensin)
  amount: number;
  payment_method: 'cash' | 'transfer';
  type: 'IN' | 'OUT'; // Pemasukan atau Pengeluaran
  description: string; // Contoh: "DP Sewa Tenda #123" atau "Beli Token Listrik"
  category?: string; // Operasional, Sewa, Lain-lain
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
}

export interface AiRecommendation {
  reason: string;
  suggestedItems: string[]; 
}