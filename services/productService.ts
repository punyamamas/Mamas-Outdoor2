import { supabase } from './supabase';
import { PRODUCTS } from '../constants';
import { Product, CartItem } from '../types';

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
        packageItems: item.package_items || [], // Map kolom DB snake_case ke camelCase
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

  // FIX: Pisahkan 'packageItems' (camelCase) dari object agar tidak dikirim mentah ke DB
  // karena DB tidak punya kolom 'packageItems', adanya 'package_items'
  const { packageItems, ...restProductData } = product;
  
  // Handle temporary IDs (timestamp-based from frontend)
  // If ID is long (timestamp), exclude it so DB generates one
  const payload: any = {
    ...restProductData,
    price: product.price2Days,
    package_items: packageItems // Map camelCase ke snake_case DB
  };

  // Hapus ID jika itu adalah temporary ID (timestamp) agar DB yang membuat ID serial
  if (payload.id && payload.id.length > 10) {
    delete payload.id;
  }

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
      alert('Error Database: Kolom "price" wajib diisi.');
    } else {
      alert('Gagal menambah produk: ' + error.message);
    }
    return null;
  }

  return {
    ...data,
    packageItems: data.package_items
  } as Product;
};

export const updateProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product;

  // FIX: Pisahkan 'packageItems' (camelCase)
  const { packageItems, ...restProductData } = product;

  // Update legacy 'price' column as well to keep data consistent
  const payload = {
    ...restProductData,
    price: product.price2Days,
    package_items: packageItems // Map ke snake_case
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

  return {
    ...data,
    packageItems: data.package_items
  } as Product;
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

// --- FUNGSI BARU UNTUK PENGURANGAN STOK PAKET ---

export const processStockReduction = async (cartItems: CartItem[]): Promise<void> => {
  if (!supabase) return;

  try {
    // 1. Ambil data produk terbaru dari DB untuk memastikan kita punya data packageItems yang valid
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, stock, package_items');

    if (error || !allProducts) throw new Error("Gagal mengambil data stok terbaru");

    // Map untuk memudahkan akses
    const productMap = new Map(allProducts.map((p: any) => [p.id.toString(), p]));

    // 2. Loop setiap item di keranjang
    for (const item of cartItems) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) continue;

      // A. Kurangi stok item utama (paket itu sendiri atau produk biasa)
      const newStock = Math.max(0, dbProduct.stock - item.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

      // B. Jika item ini adalah PAKET, kurangi stok komponen di dalamnya
      if (dbProduct.package_items && Array.isArray(dbProduct.package_items)) {
        for (const subItem of dbProduct.package_items) {
          const childProduct = productMap.get(subItem.productId);
          
          if (childProduct) {
            // Jumlah pengurangan = Jumlah Paket yang dibeli * Jumlah item per paket
            const deductionAmount = item.quantity * subItem.quantity;
            const newChildStock = Math.max(0, childProduct.stock - deductionAmount);
            
            // Update stok anak
            await supabase.from('products').update({ stock: newChildStock }).eq('id', subItem.productId);
            console.log(`Updated stock for child item ${subItem.productId}: ${childProduct.stock} -> ${newChildStock}`);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error processing stock reduction:", err);
  }
};
