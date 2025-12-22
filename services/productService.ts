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
      // Jangan return PRODUCTS mock jika database kosong tapi koneksi sukses
      // Biarkan return array kosong agar admin tau database benar-benar kosong
      return []; 
    }
    
    return data as Product[];
    
  } catch (err) {
    console.error('Unexpected error fetching products:', err);
    return PRODUCTS;
  }
};

export const addProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product; // Mock mode

  // Hapus ID jika itu digenerate oleh client (timestamp) agar Supabase yang mengurus ID
  // Kita buat object baru tanpa ID agar Auto-Increment database bekerja (jika disetting demikian)
  // Atau gunakan ID yang dikirim jika table anda settingannya manual input ID.
  const { id, ...productData } = product;
  
  // Jika ID-nya angka panjang (timestamp dari Date.now()), kita asumsikan itu temporary
  // dan biarkan Supabase generate ID baru.
  // Jika table Supabase anda butuh ID manual, kirimkan `product` utuh.
  const payload = id.length > 10 ? productData : product;

  const { data, error } = await supabase
    .from('products')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error adding product:', error);
    if (error.code === '42501') {
      alert('Gagal Menambah: Izin Ditolak (RLS). Cek Policy di Supabase.');
    } else {
      alert('Gagal menambah produk: ' + error.message);
    }
    return null;
  }

  return data as Product;
};

export const updateProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product; // Mock mode

  const { data, error } = await supabase
    .from('products')
    .update(product)
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
  if (!supabase) return true; // Mock mode

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    // Error code 42501 adalah Permission Denied (RLS)
    if (error.code === '42501') {
        alert('Gagal Menghapus: Izin Ditolak. Pastikan RLS Policy untuk DELETE sudah aktif di Supabase.');
    } else {
        alert('Gagal menghapus produk: ' + error.message);
    }
    return false;
  }

  return true;
};