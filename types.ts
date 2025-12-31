
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
  // Rental Prices
  price2Days: number; 
  price3Days: number;
  price4Days: number;
  price5Days: number;
  price6Days: number;
  price7Days: number; 
  
  // RETAIL FIELDS
  isSale?: boolean; // True jika barang dijual (bukan disewa)
  salePrice?: number; // Harga jual lepas

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
  location: string; // Added location to state
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
  customerIdentity?: string; // NEW: No KTP/KTM/SIM
  rentalDate: string; // Mapped from rental_date
  duration: number;
  totalPrice: number; // Mapped from total_price (Rental + Fine)
  fineAmount?: number; // NEW: Khusus menyimpan nominal denda
  amountPaid: number; // New Field: Total yang sudah dibayar
  items: CartItem[];
  // Status Update: 
  // pending (Belum Bayar) -> partial_payment (Cicil) -> booked (Lunas/Booking) -> rented (Sedang Sewa) -> completed (Selesai)
  status: 'pending' | 'partial_payment' | 'booked' | 'rented' | 'completed' | 'cancelled'; 
  paymentMethod?: 'transfer' | 'cash'; 
  isReviewed?: boolean; // New Field: Penanda sudah direview atau belum
}

// NEW: Interface Review
export interface Review {
  id: string;
  created_at: string;
  transaction_id: string;
  customer_name: string;
  rating: number; // 1-5
  comment: string;
  is_public: boolean; // Untuk moderasi admin nanti
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
