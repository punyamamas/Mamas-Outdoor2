
export interface Category {
  id: string; // Bisa number dari DB, tapi string aman untuk frontend
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
  category: string; // Changed from union type to string to support dynamic categories
  // Mengganti single price dengan tiered pricing
  price2Days: number; // Minimal sewa
  price3Days: number;
  price4Days: number;
  price5Days: number;
  price6Days: number;
  price7Days: number; // Weekly limit
  image: string;
  description: string;
  stock: number;
  packageItems?: PackageItem[]; // Optional: Hanya untuk kategori paket
  sizes?: { [key: string]: number }; // Legacy: Simple Key (S, M, L...) Value (Stock count)
  colors?: string[]; // Legacy: Array warna simpel
  variants?: ProductVariant[]; // New: Detailed combinatorics (Color + Size + Stock)
  colorImages?: ColorImage[]; // New: Specific image for a color
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize?: string; // Menyimpan ukuran yang dipilih user
  selectedColor?: string; // Menyimpan warna yang dipilih user
}

export interface UserDetails {
  name: string;
  whatsapp: string;
  campus: string; // Universitas Jenderal Soedirman, UMP, etc.
  rentalDate: string;
  duration: number; // Hari (Min 2)
}

export interface Transaction {
  id: string;
  date: string; // ISO string of when the booking was made
  rentalDate: string; // Date of pickup
  duration: number;
  totalPrice: number;
  items: CartItem[];
  status: 'pending' | 'completed'; // Visual indicator
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
}

export interface AiRecommendation {
  reason: string;
  suggestedItems: string[]; // List of product names or keywords
}
