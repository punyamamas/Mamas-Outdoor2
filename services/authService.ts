
import { supabase } from './supabase';

export const signIn = async (email: string, password: string) => {
  if (!supabase) {
    return { data: null, error: { message: "Koneksi Supabase tidak ditemukan. Pastikan Environment Variable sudah diset." } };
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
