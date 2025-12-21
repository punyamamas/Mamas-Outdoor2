import { Product } from './types';

// Simulasi data dari Database (nantinya bisa diganti fetch dari Supabase)
export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Tenda Great Outdoor Java 4 Pro',
    category: 'Tenda',
    price: 45000,
    image: 'https://picsum.photos/400/300?random=1',
    description: 'Kapasitas 4-5 orang, double layer, waterproof, frame fiber.',
    stock: 10
  },
  {
    id: '2',
    name: 'Tenda Eiger Shira 2P',
    category: 'Tenda',
    price: 35000,
    image: 'https://picsum.photos/400/300?random=2',
    description: 'Kapasitas 2 orang, ringan, cocok untuk ultralight hiking.',
    stock: 5
  },
  {
    id: '3',
    name: 'Carrier Osprey Kestrel 48L',
    category: 'Carrier',
    price: 40000,
    image: 'https://picsum.photos/400/300?random=3',
    description: 'Backsystem nyaman, include raincover, cocok untuk 2-3 hari.',
    stock: 8
  },
  {
    id: '4',
    name: 'Carrier Consina Tarebbi 60L',
    category: 'Carrier',
    price: 30000,
    image: 'https://picsum.photos/400/300?random=4',
    description: 'Kapasitas besar, kuat, favorit mahasiswa.',
    stock: 15
  },
  {
    id: '5',
    name: 'Sleeping Bag Polar Bulu',
    category: 'Tidur',
    price: 10000,
    image: 'https://picsum.photos/400/300?random=5',
    description: 'Hangat, inner polar tebal, model mummy.',
    stock: 30
  },
  {
    id: '6',
    name: 'Matras Spon Karet',
    category: 'Tidur',
    price: 3000,
    image: 'https://picsum.photos/400/300?random=6',
    description: 'Standar pendakian, anti air.',
    stock: 50
  },
  {
    id: '7',
    name: 'Kompor Portable Kotak',
    category: 'Masak',
    price: 10000,
    image: 'https://picsum.photos/400/300?random=7',
    description: 'Praktis, menggunakan gas hicook, api stabil.',
    stock: 12
  },
  {
    id: '8',
    name: 'Cooking Set / Nesting DS-308',
    category: 'Masak',
    price: 10000,
    image: 'https://picsum.photos/400/300?random=8',
    description: 'Lengkap panci besar, kecil, wajan, untuk 3-4 orang.',
    stock: 12
  },
  {
    id: '9',
    name: 'Headlamp Led Lenser',
    category: 'Aksesoris',
    price: 15000,
    image: 'https://picsum.photos/400/300?random=9',
    description: 'Sangat terang, baterai awet, tahan air hujan ringan.',
    stock: 10
  },
  {
    id: '10',
    name: 'Trekking Pole',
    category: 'Aksesoris',
    price: 5000,
    image: 'https://picsum.photos/400/300?random=10',
    description: 'Membantu keseimbangan, antishock system.',
    stock: 20
  }
];

export const CATEGORIES = ['Semua', 'Tenda', 'Carrier', 'Tidur', 'Masak', 'Aksesoris'];

export const WA_NUMBER = '6281234567890'; // Ganti dengan nomor Admin Mamas Outdoor