import { supabase } from './supabase';
import { PRODUCTS } from '../constants';
import { Product, CartItem, ProductVariant } from '../types';

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
        
        // NEW FIELDS MAPPING
        stock: item.stock || 0,
        rented: item.rented || 0,
        damaged: item.damaged || 0,

        packageItems: item.package_items || [], // Map kolom DB snake_case ke camelCase
        sizes: item.sizes || {}, 
        colors: item.colors || [],
        variants: item.variants || [], // New
        colorImages: item.color_images || [] // New (snake_case from DB)
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
  const { packageItems, sizes, colors, variants, colorImages, ...restProductData } = product;
  
  // Handle temporary IDs (timestamp-based from frontend)
  const payload: any = {
    ...restProductData,
    price: product.price2Days,
    package_items: packageItems,
    sizes: sizes || {}, 
    colors: colors || [],
    variants: variants || [],
    color_images: colorImages || [],
    rented: 0,
    damaged: 0
  };

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
    } else if (error.message.includes('variants')) {
      alert('Error Database: Kolom "variants" belum ada. Jalankan SQL: ALTER TABLE products ADD COLUMN variants jsonb DEFAULT \'[]\'::jsonb;');
    } else {
      alert('Gagal menambah produk: ' + error.message);
    }
    return null;
  }

  return {
    ...data,
    packageItems: data.package_items,
    colorImages: data.color_images
  } as Product;
};

export const updateProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product;

  const { packageItems, sizes, colors, variants, colorImages, ...restProductData } = product;

  const payload = {
    ...restProductData,
    price: product.price2Days,
    package_items: packageItems,
    sizes: sizes || {},
    colors: colors || [],
    variants: variants || [],
    color_images: colorImages || [],
    // Pastikan field status stok ikut terupdate
    stock: product.stock,
    rented: product.rented,
    damaged: product.damaged
  };

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', product.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    alert('Gagal update produk: ' + error.message);
    return null;
  }

  return {
    ...data,
    packageItems: data.package_items,
    colorImages: data.color_images
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
    return false;
  }

  return true;
};

// --- FUNGSI PENGURANGAN STOK SAAT CHECKOUT ---

export const processStockReduction = async (cartItems: CartItem[]): Promise<void> => {
  if (!supabase) return;

  try {
    // 1. Ambil data produk terbaru
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, stock, rented, package_items, sizes, variants');

    if (error || !allProducts) throw new Error("Gagal mengambil data stok terbaru");

    const productMap = new Map<string, any>(allProducts.map((p: any) => [p.id.toString(), p]));

    // 2. Loop setiap item di keranjang
    for (const item of cartItems) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) continue;

      // Note: Untuk varian kompleks, saat ini kita hanya mengurangi stok utama
      // karena tracking "Rented" per varian butuh struktur DB relasional yang lebih kompleks.
      
      // LOGIKA UTAMA: Pindahkan Stock -> Rented
      const currentStock = typeof dbProduct.stock === 'number' ? dbProduct.stock : 0;
      const currentRented = typeof dbProduct.rented === 'number' ? dbProduct.rented : 0;
      
      const quantityToRent = item.quantity;
      
      const newStock = Math.max(0, currentStock - quantityToRent);
      const newRented = currentRented + quantityToRent;

      // Update Database Utama
      await supabase.from('products').update({ 
        stock: newStock,
        rented: newRented
      }).eq('id', item.id);

      // Handle Sub-item jika Paket
      if (dbProduct.package_items && Array.isArray(dbProduct.package_items)) {
        for (const subItem of dbProduct.package_items) {
          const childProduct = productMap.get(subItem.productId);
          if (childProduct) {
            const deductionAmount = item.quantity * subItem.quantity;
            
            const childCurrentStock = typeof childProduct.stock === 'number' ? childProduct.stock : 0;
            const childCurrentRented = typeof childProduct.rented === 'number' ? childProduct.rented : 0;
            
            const newChildStock = Math.max(0, childCurrentStock - deductionAmount);
            const newChildRented = childCurrentRented + deductionAmount;
            
            await supabase.from('products').update({ 
              stock: newChildStock,
              rented: newChildRented
            }).eq('id', subItem.productId);
          }
        }
      }
      
      // Update specific variants stock if needed (Only reducing available stock)
      // Limitation: We don't track rented per variant size yet in this simple schema
      if (item.selectedSize && item.selectedColor && dbProduct.variants && dbProduct.variants.length > 0) {
        const variants: ProductVariant[] = dbProduct.variants;
        const variantIndex = variants.findIndex(v => v.color === item.selectedColor && v.size === item.selectedSize);
        if (variantIndex !== -1) {
          variants[variantIndex].stock = Math.max(0, variants[variantIndex].stock - item.quantity);
          await supabase.from('products').update({ variants: variants }).eq('id', item.id);
        }
      }
      else if (item.selectedSize && dbProduct.sizes) {
         const currentSizes = dbProduct.sizes || {};
         const currentSizeStock = currentSizes[item.selectedSize] || 0;
         const newSizeStock = Math.max(0, currentSizeStock - item.quantity);
         const newSizes = { ...currentSizes, [item.selectedSize]: newSizeStock };
         await supabase.from('products').update({ sizes: newSizes }).eq('id', item.id);
      }
    }
  } catch (err) {
    console.error("Error processing stock reduction:", err);
  }
};