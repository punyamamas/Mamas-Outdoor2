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
      .select('*');

    if (error) {
      console.error('Supabase error fetching products:', error);
      return PRODUCTS;
    }

    if (!data || data.length === 0) {
      console.warn('No products found in Supabase, using mock data.');
      return PRODUCTS;
    }
    
    // Mapping data jika nama kolom di database berbeda, atau langsung return jika sama
    return data as Product[];
    
  } catch (err) {
    console.error('Unexpected error fetching products:', err);
    return PRODUCTS;
  }
};