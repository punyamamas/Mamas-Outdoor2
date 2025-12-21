import { createClient } from '@supabase/supabase-js';

// Menggunakan environment variables untuk konfigurasi (kompatibel dengan Vite/Next.js di Vercel)
// Pastikan Anda mengatur variable ini di dashboard Vercel atau .env lokal
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;