
import { supabase } from './supabase';
import { PRODUCTS } from '../constants';
import { Product, CartItem, ProductVariant, StockLog } from '../types';

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
      console.warn('Supabase error fetching products (Using Fallback Data):', error.message);
      return PRODUCTS;
    }

    if (!data || data.length === 0) {
      return []; 
    }
    
    // SAFETY CHECK: Mapping data untuk mencegah crash jika kolom database belum diupdate
    const sanitizedData = data.map((item: any) => {
      const basePrice = item.price2Days || item.price || 0;
      return {
        ...item,
        // RETAIL MAPPING
        isSale: item.is_sale || false,
        salePrice: item.sale_price || 0,

        price2Days: basePrice,
        price3Days: item.price3Days || Math.floor(basePrice * 1.4),
        price4Days: item.price4Days || Math.floor(basePrice * 1.8),
        price5Days: item.price5Days || Math.floor(basePrice * 2.2),
        price6Days: item.price6Days || Math.floor(basePrice * 2.5),
        price7Days: item.price7Days || Math.floor(basePrice * 3.0),
        
        // NEW FIELDS MAPPING - Ensure Numbers
        stock: Number(item.stock) || 0,
        rented: Number(item.rented) || 0,
        damaged: Number(item.damaged) || 0,

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

// NEW: FUNCTION TO UPLOAD PRODUCT IMAGE
export const uploadProductImage = async (file: File): Promise<string | null> => {
  if (!supabase) return null;

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}.${fileExt}`;
    const filePath = fileName;

    // Upload ke bucket 'product_images'
    const { error: uploadError } = await supabase.storage
      .from('product_images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload product image error:', uploadError);
      alert("Gagal upload gambar. Pastikan bucket 'product_images' sudah dibuat di menu System Setup.");
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product_images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error("Upload handler error:", err);
    return null;
  }
};

export const addProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product; 

  const { packageItems, sizes, colors, variants, colorImages, isSale, salePrice, ...restProductData } = product;
  
  // Handle temporary IDs (timestamp-based from frontend)
  const payload: any = {
    ...restProductData,
    price: product.price2Days,
    is_sale: isSale || false,
    sale_price: salePrice || 0,
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
    alert('Gagal menambah produk: ' + error.message);
    return null;
  }

  // Initial Stock Log
  await logStockMutation({
    product_id: data.id,
    product_name: data.name,
    type: 'IN',
    qty: data.stock,
    previous_stock: 0,
    current_stock: data.stock,
    reason: 'Initial Stock (New Product)'
  });

  return {
    ...data,
    isSale: data.is_sale,
    salePrice: data.sale_price,
    packageItems: data.package_items,
    colorImages: data.color_images
  } as Product;
};

export const updateProduct = async (product: Product): Promise<Product | null> => {
  if (!supabase) return product;

  const { packageItems, sizes, colors, variants, colorImages, isSale, salePrice, ...restProductData } = product;

  const payload = {
    ...restProductData,
    price: product.price2Days,
    is_sale: isSale || false,
    sale_price: salePrice || 0,
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
    isSale: data.is_sale,
    salePrice: data.sale_price,
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

// --- STOCK LOGGING SYSTEM ---

export const logStockMutation = async (log: Omit<StockLog, 'id' | 'created_at'>): Promise<boolean> => {
  if (!supabase) return false;
  
  try {
    const { error } = await supabase.from('stock_logs').insert([log]);
    if (error) {
      console.warn("Failed to log stock mutation:", error.message);
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
};

export const getStockLogs = async (productId: string): Promise<StockLog[]> => {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('stock_logs')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 entries per product

    if (error) return [];
    return data as StockLog[];
  } catch (e) {
    return [];
  }
};

// --- FUNGSI PENGURANGAN STOK SAAT CHECKOUT ---

export const processStockReduction = async (cartItems: CartItem[]): Promise<boolean> => {
  if (!supabase) {
    console.log("Mock Mode: Stock reduction skipped (No DB).");
    return true; 
  }

  try {
    // 1. Ambil data produk terbaru dari DB untuk menghindari race condition
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, name, stock, rented, package_items, sizes, variants, is_sale');

    if (error) {
       console.error("Database Error (Fetch Stock):", error.message);
       // Jika gagal fetch, kita biarkan user checkout tapi log error
       return false;
    }

    if (!allProducts) return true;

    // Map untuk lookup cepat
    const productMap = new Map<string, any>(allProducts.map((p: any) => [p.id.toString(), p]));

    // 2. Loop setiap item di keranjang
    for (const item of cartItems) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) continue;

      // Handle Main Stock
      const currentStock = Number(dbProduct.stock) || 0;
      const quantityToTake = item.quantity;
      
      // LOGIC SPLIT: JUAL vs SEWA
      const isSaleItem = dbProduct.is_sale === true;
      
      const newStock = Math.max(0, currentStock - quantityToTake);
      
      // Jika JUAL: Stock berkurang, Rented TETAP (Barang hilang permanen)
      // Jika SEWA: Stock berkurang, Rented BERTAMBAH (Barang pindah tangan sementara)
      const currentRented = Number(dbProduct.rented) || 0;
      const newRented = isSaleItem ? currentRented : (currentRented + quantityToTake);

      // Update Database Utama (Stock & Rented)
      const { error: updateError } = await supabase.from('products').update({ 
        stock: newStock,
        rented: newRented
      }).eq('id', item.id);

      if (!updateError) {
         // LOG STOCK MOVEMENT (Automatic)
         await logStockMutation({
            product_id: item.id,
            product_name: item.name,
            type: 'OUT',
            qty: quantityToTake,
            previous_stock: currentStock,
            current_stock: newStock,
            reason: isSaleItem ? 'Terjual Online' : 'Sewa Online (Checkout)'
         });
      }

      // Handle Sub-item jika ini adalah Paket
      if (dbProduct.package_items && Array.isArray(dbProduct.package_items)) {
        for (const subItem of dbProduct.package_items) {
          const childProduct = productMap.get(subItem.productId);
          if (childProduct) {
            const deductionAmount = item.quantity * subItem.quantity;
            
            const childCurrentStock = Number(childProduct.stock) || 0;
            const childCurrentRented = Number(childProduct.rented) || 0;
            
            const newChildStock = Math.max(0, childCurrentStock - deductionAmount);
            const newChildRented = isSaleItem ? childCurrentRented : (childCurrentRented + deductionAmount);
            
            await supabase.from('products').update({ 
              stock: newChildStock,
              rented: newChildRented
            }).eq('id', subItem.productId);
            
            // Log Child Movement
            await logStockMutation({
                product_id: subItem.productId,
                product_name: childProduct.name + ' (In Packet)',
                type: 'OUT',
                qty: deductionAmount,
                previous_stock: childCurrentStock,
                current_stock: newChildStock,
                reason: `Paket ${item.name} Tersewa`
             });
          }
        }
      }
      
      // Update Varians (JSONB)
      if (item.selectedSize && item.selectedColor && dbProduct.variants && Array.isArray(dbProduct.variants)) {
        const variants: ProductVariant[] = [...dbProduct.variants];
        const variantIndex = variants.findIndex(v => v.color === item.selectedColor && v.size === item.selectedSize);
        
        if (variantIndex !== -1) {
          const currentVarStock = Number(variants[variantIndex].stock) || 0;
          variants[variantIndex].stock = Math.max(0, currentVarStock - item.quantity);
          
          await supabase.from('products').update({ variants: variants }).eq('id', item.id);
        }
      }
      else if (item.selectedSize && dbProduct.sizes) {
         const currentSizes = { ...dbProduct.sizes };
         const currentSizeStock = Number(currentSizes[item.selectedSize]) || 0;
         const newSizeStock = Math.max(0, currentSizeStock - item.quantity);
         
         currentSizes[item.selectedSize] = newSizeStock;
         await supabase.from('products').update({ sizes: currentSizes }).eq('id', item.id);
      }
    }

    return true; // Sukses
  } catch (err) {
    console.error("Critical error in processStockReduction:", err);
    return false;
  }
};

// --- FUNGSI PENGEMBALIAN STOK (SAAT TRANSAKSI SELESAI / BATAL) ---

export const processStockRestoration = async (cartItems: CartItem[]): Promise<boolean> => {
  if (!supabase) return true;

  try {
    const { data: allProducts, error } = await supabase
      .from('products')
      .select('id, name, stock, rented, package_items, sizes, variants, is_sale');

    if (error) return false;
    if (!allProducts) return true;

    const productMap = new Map<string, any>(allProducts.map((p: any) => [p.id.toString(), p]));

    for (const item of cartItems) {
      const dbProduct = productMap.get(item.id);
      if (!dbProduct) continue;

      const currentStock = Number(dbProduct.stock) || 0;
      const currentRented = Number(dbProduct.rented) || 0;
      const quantityToRestore = item.quantity;
      
      // Hanya restore jika memang ada barang di 'Rented' (Logika Sewa)
      // Jika barang jual, Rented tidak naik, jadi tidak ada yang dikurangi.
      if (currentRented >= quantityToRestore) {
          const newStock = currentStock + quantityToRestore;
          const newRented = Math.max(0, currentRented - quantityToRestore);

          const {error: err} = await supabase.from('products').update({ 
            stock: newStock,
            rented: newRented
          }).eq('id', item.id);
          
          if(!err) {
             await logStockMutation({
                product_id: item.id,
                product_name: item.name,
                type: 'IN',
                qty: quantityToRestore,
                previous_stock: currentStock,
                current_stock: newStock,
                reason: 'Sewa Selesai / Batal'
             });
          }
      }

      // Restore Paket
      if (dbProduct.package_items && Array.isArray(dbProduct.package_items)) {
        for (const subItem of dbProduct.package_items) {
          const childProduct = productMap.get(subItem.productId);
          if (childProduct) {
            const childRented = Number(childProduct.rented) || 0;
            const restoreAmount = item.quantity * subItem.quantity;
            
            if (childRented >= restoreAmount) {
                const childStock = Number(childProduct.stock) || 0;
                await supabase.from('products').update({ 
                  stock: childStock + restoreAmount,
                  rented: Math.max(0, childRented - restoreAmount)
                }).eq('id', subItem.productId);
                
                await logStockMutation({
                    product_id: subItem.productId,
                    product_name: childProduct.name,
                    type: 'IN',
                    qty: restoreAmount,
                    previous_stock: childStock,
                    current_stock: childStock + restoreAmount,
                    reason: `Paket ${item.name} Kembali`
                 });
            }
          }
        }
      }
    }

    return true;
  } catch (err) {
    console.error("Critical error in processStockRestoration:", err);
    return false;
  }
};
