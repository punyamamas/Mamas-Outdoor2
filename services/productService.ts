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
    color_images: colorImages || []
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
    color_images: colorImages || []
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

// --- FUNGSI BARU UNTUK PENGURANGAN STOK PAKET & VARIAN ---

export const processStockReduction = async (cartItems: CartItem[]): Promise<void> => {
  if (!supabase) return;

  try {
    // 1. Ambil data produk terbaru
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, stock, package_items, sizes, variants');

    if (error || !allProducts) throw new Error("Gagal mengambil data stok terbaru");

    const productMap = new Map<string, any>(allProducts.map((p: any) => [p.id.toString(), p]));

    // 2. Loop setiap item di keranjang
    for (const item of cartItems) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) continue;

      // A. Jika produk punya VARIAN KOMPLEKS (Warna + Size + Stok spesifik)
      if (item.selectedSize && item.selectedColor && dbProduct.variants && dbProduct.variants.length > 0) {
        const variants: ProductVariant[] = dbProduct.variants;
        
        // Cari varian yang cocok
        const variantIndex = variants.findIndex(v => v.color === item.selectedColor && v.size === item.selectedSize);
        
        if (variantIndex !== -1) {
          // Kurangi stok varian
          const currentVariantStock = variants[variantIndex].stock;
          const newVariantStock = Math.max(0, currentVariantStock - item.quantity);
          
          variants[variantIndex].stock = newVariantStock;
          
          // Hitung ulang total stok master
          const newTotalStock = variants.reduce((acc, v) => acc + v.stock, 0);

          await supabase.from('products').update({
            variants: variants,
            stock: newTotalStock
          }).eq('id', item.id);
          
          continue; // Lanjut ke item berikutnya
        }
      }

      // B. Jika produk punya SIZE SIMPLE (Legacy, hanya key size)
      if (item.selectedSize && dbProduct.sizes && (!dbProduct.variants || dbProduct.variants.length === 0)) {
         const currentSizes = dbProduct.sizes || {};
         const currentSizeStock = currentSizes[item.selectedSize] || 0;
         const newSizeStock = Math.max(0, currentSizeStock - item.quantity);
         
         const newSizes = { ...currentSizes, [item.selectedSize]: newSizeStock };
         const newTotalStock = Object.values(newSizes).reduce((a: any, b: any) => a + b, 0);

         await supabase.from('products').update({ 
           sizes: newSizes,
           stock: newTotalStock 
         }).eq('id', item.id);
         
         continue;
      }

      // C. Kurangi stok item utama (tanpa varian)
      const currentStock = typeof dbProduct.stock === 'number' ? dbProduct.stock : 0;
      const newStock = Math.max(0, currentStock - item.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

      // D. Jika item ini adalah PAKET
      if (dbProduct.package_items && Array.isArray(dbProduct.package_items)) {
        for (const subItem of dbProduct.package_items) {
          const childProduct = productMap.get(subItem.productId);
          if (childProduct) {
            const deductionAmount = item.quantity * subItem.quantity;
            const childCurrentStock = typeof childProduct.stock === 'number' ? childProduct.stock : 0;
            const newChildStock = Math.max(0, childCurrentStock - deductionAmount);
            
            await supabase.from('products').update({ stock: newChildStock }).eq('id', subItem.productId);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error processing stock reduction:", err);
  }
};
