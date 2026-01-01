
import { supabase } from './supabase';

export const signIn = async (email: string, password: string) => {
  if (!supabase) {
    // Fallback JIKA Supabase belum dikonfigurasi sama sekali (Dev Mode Only)
    // Hapus blok ini di production untuk keamanan maksimal
    if (email === 'admin@demo.com' && password === 'admin123') {
        return { data: { user: { email } }, error: null };
    }
    return { data: null, error: { message: "Koneksi Supabase tidak ditemukan." } };
  }
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};
