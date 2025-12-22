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
      console.warn('No products found in Supabase, using mock data.');
      return PRODUCTS;
    }
    
    return data as Product[];
    
  } catch (err) {
    console.error('Unexpected error fetching products:', err);
    return PRODUCTS;
  }
};

export const addProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product; // Mock mode

  // Hapus ID jika itu digenerate oleh client (timestamp) agar Supabase yang mengurus ID (jika pakai UUID/Auto Increment)
  // Namun, jika table Anda pakai text ID manual, biarkan saja. 
  // Disini kita coba kirim apa adanya, tapi handle errornya.
  
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();

  if (error) {
    console.error('Error adding product:', error);
    alert('Gagal menambah produk ke Database: ' + error.message);
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
    alert('Gagal update produk: ' + error.message);
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
    alert('Gagal menghapus produk: ' + error.message);
    return false;
  }

  return true;
};