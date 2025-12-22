
export interface Category {
  id: string; // Bisa number dari DB, tapi string aman untuk frontend
  name: string;
}

export interface PackageItem {
  productId: string;
  quantity: number;
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
}

export interface CartItem extends Product {
  quantity: number;
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
