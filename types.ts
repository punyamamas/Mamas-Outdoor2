export interface Product {
  id: string;
  name: string;
  category: 'Tenda' | 'Carrier' | 'Tidur' | 'Masak' | 'Aksesoris';
  price: number; // Harga sewa per 24 jam
  image: string;
  description: string;
  stock: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface UserDetails {
  name: string;
  whatsapp: string;
  campus: string; // Universitas Jenderal Soedirman, UMP, etc.
  rentalDate: string;
  duration: number; // Hari
}

export enum GeminiModel {
  FLASH = 'gemini-3-flash-preview',
}

export interface AiRecommendation {
  reason: string;
  suggestedItems: string[]; // List of product names or keywords
}