import { supabase } from './supabase';
import { PRODUCTS } from '../constants';
import { Product } from '../types';

export const getProducts = async (): Promise<Product[]> => {
  // Jika Supabase belum dikonfigurasi, gunakan data mock
  if (!supabase) {
    console.log('Supabase client not initialized, using mock data.');
    return PRODUCTS;
  }
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: false }); // Urutkan dari yang terbaru

    if (error) {
      console.error('Supabase error fetching products:', error);
      return PRODUCTS;
    }

    if (!data || data.length === 0) {
      return []; 
    }
    
    // SAFETY CHECK: Mapping data untuk mencegah crash jika kolom database belum diupdate
    // Jika kolom price2Days tidak ada, kita gunakan logika fallback
    const sanitizedData = data.map((item: any) => {
      const basePrice = item.price2Days || item.price || 0;
      return {
        ...item,
        price2Days: basePrice,
        price3Days: item.price3Days || Math.floor(basePrice * 1.4),
        price4Days: item.price4Days || Math.floor(basePrice * 1.8),
        price5Days: item.price5Days || Math.floor(basePrice * 2.2),
        price6Days: item.price6Days || Math.floor(basePrice * 2.5),
        price7Days: item.price7Days || Math.floor(basePrice * 3.0),
      };
    });

    return sanitizedData as Product[];
    
  } catch (err) {
    console.error('Unexpected error fetching products:', err);
    return PRODUCTS;
  }
};

export const addProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product; 

  const { id, ...productData } = product;
  
  // Handle temporary IDs (timestamp-based from frontend)
  // If ID is long (timestamp), exclude it so DB generates one
  const basePayload = id.length > 10 ? productData : product;

  // FIX: Include legacy 'price' column to satisfy DB NOT NULL constraint
  // We map price2Days to price
  const payload = {
    ...basePayload,
    price: product.price2Days
  };

  const { data, error } = await supabase
    .from('products')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error adding product:', error);
    if (error.code === '42501') {
      alert('Gagal Menambah: Izin Ditolak (RLS). Cek Policy di Supabase.');
    } else if (error.message.includes('null value in column "price"')) {
      alert('Error Database: Kolom "price" wajib diisi. Script update otomatis sudah dijalankan, coba lagi.');
    } else {
      alert('Gagal menambah produk: ' + error.message);
    }
    return null;
  }

  return data as Product;
};

export const updateProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product;

  // Update legacy 'price' column as well to keep data consistent
  const payload = {
    ...product,
    price: product.price2Days
  };

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', product.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    if (error.code === '42501') {
      alert('Gagal Update: Izin Ditolak (RLS). Cek Policy di Supabase.');
    } else {
      alert('Gagal update produk: ' + error.message);
    }
    return null;
  }

  return data as Product;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  if (!supabase) return true;

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    if (error.code === '42501') {
        alert('Gagal Menghapus: Izin Ditolak. Pastikan RLS Policy untuk DELETE sudah aktif di Supabase.');
    } else {
        alert('Gagal menghapus produk: ' + error.message);
    }
    return false;
  }

  return true;
};