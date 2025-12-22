import { Product } from './types';

// Simulasi data dari Database
export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Tenda Great Outdoor Java 4 Pro',
    category: 'Tenda',
    price2Days: 60000,
    price3Days: 85000,
    price4Days: 110000,
    price5Days: 135000,
    price6Days: 160000,
    price7Days: 180000,
    image: 'https://picsum.photos/400/300?random=1',
    description: 'Kapasitas 4-5 orang, double layer, waterproof, frame fiber.',
    stock: 10
  },
  {
    id: '2',
    name: 'Tenda Eiger Shira 2P',
    category: 'Tenda',
    price2Days: 50000,
    price3Days: 70000,
    price4Days: 90000,
    price5Days: 110000,
    price6Days: 130000,
    price7Days: 150000,
    image: 'https://picsum.photos/400/300?random=2',
    description: 'Kapasitas 2 orang, ringan, cocok untuk ultralight hiking.',
    stock: 5
  },
  {
    id: '3',
    name: 'Carrier Osprey Kestrel 48L',
    category: 'Carrier',
    price2Days: 50000,
    price3Days: 70000,
    price4Days: 90000,
    price5Days: 110000,
    price6Days: 130000,
    price7Days: 150000,
    image: 'https://picsum.photos/400/300?random=3',
    description: 'Backsystem nyaman, include raincover, cocok untuk 2-3 hari.',
    stock: 8
  },
  {
    id: '4',
    name: 'Carrier Consina Tarebbi 60L',
    category: 'Carrier',
    price2Days: 40000,
    price3Days: 55000,
    price4Days: 70000,
    price5Days: 85000,
    price6Days: 100000,
    price7Days: 115000,
    image: 'https://picsum.photos/400/300?random=4',
    description: 'Kapasitas besar, kuat, favorit mahasiswa.',
    stock: 15
  },
  {
    id: '5',
    name: 'Sleeping Bag Polar Bulu',
    category: 'Tidur', // Maps to Alat Pribadi or Tidur based on DB
    price2Days: 15000,
    price3Days: 20000,
    price4Days: 25000,
    price5Days: 30000,
    price6Days: 35000,
    price7Days: 40000,
    image: 'https://picsum.photos/400/300?random=5',
    description: 'Hangat, inner polar tebal, model mummy.',
    stock: 30
  },
  {
    id: '6',
    name: 'Matras Spon Karet',
    category: 'Alat Jalan',
    // Sesuai Request User: 2h=5k, 3h=8k, 4h=10k, 5h=13k, 6h=15k
    price2Days: 5000,
    price3Days: 8000,
    price4Days: 10000,
    price5Days: 13000,
    price6Days: 15000,
    price7Days: 17000,
    image: 'https://picsum.photos/400/300?random=6',
    description: 'Standar pendakian, anti air, wajib punya.',
    stock: 50
  },
  {
    id: '7',
    name: 'Kompor Portable Kotak',
    category: 'Alat Masak',
    price2Days: 15000,
    price3Days: 20000,
    price4Days: 25000,
    price5Days: 30000,
    price6Days: 35000,
    price7Days: 40000,
    image: 'https://picsum.photos/400/300?random=7',
    description: 'Praktis, menggunakan gas hicook, api stabil.',
    stock: 12
  },
  {
    id: '8',
    name: 'Cooking Set / Nesting DS-308',
    category: 'Alat Masak',
    price2Days: 15000,
    price3Days: 20000,
    price4Days: 25000,
    price5Days: 30000,
    price6Days: 35000,
    price7Days: 40000,
    image: 'https://picsum.photos/400/300?random=8',
    description: 'Lengkap panci besar, kecil, wajan, untuk 3-4 orang.',
    stock: 12
  },
  {
    id: '9',
    name: 'Headlamp Led Lenser',
    category: 'Penerangan',
    price2Days: 20000,
    price3Days: 25000,
    price4Days: 30000,
    price5Days: 35000,
    price6Days: 40000,
    price7Days: 45000,
    image: 'https://picsum.photos/400/300?random=9',
    description: 'Sangat terang, baterai awet, tahan air hujan ringan.',
    stock: 10
  },
  {
    id: '10',
    name: 'Trekking Pole',
    category: 'Alat Jalan',
    price2Days: 10000,
    price3Days: 15000,
    price4Days: 20000,
    price5Days: 25000,
    price6Days: 30000,
    price7Days: 35000,
    image: 'https://picsum.photos/400/300?random=10',
    description: 'Membantu keseimbangan, antishock system.',
    stock: 20
  }
];

// Daftar kategori fallback sesuai urutan yang diinginkan user
export const CATEGORIES = [
  'Semua',
  'Paketan Sewa',
  'Tenda',
  'Carrier',
  'Tas',
  'Pakaian',
  'Alat Jalan',
  'Alat Pribadi',
  'Alat Masak',
  'Penerangan',
  'Survival',
  'Alat Event',
  'Koper'
];

export const WA_NUMBER = '6281234567890'; // Ganti dengan nomor Admin Mamas Outdoor
