
import { supabase } from './supabase';
import { UserRole } from '../types';

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

// NEW: Get User Role with Smart Fallback
export const getUserRole = async (email: string): Promise<UserRole> => {
  // 1. Dev Mode (No Supabase) -> Always Super Admin
  if (!supabase) return 'super_admin'; 

  try {
    // 2. Cek tabel user_roles di database
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('email', email)
      .single();

    if (error) {
        // ERROR HANDLING KHUSUS:
        // Jika tabel belum ada (Postgres Error Code 42P01 = undefined_table), 
        // Berarti ini adalah instalasi baru. Berikan akses Super Admin agar user bisa masuk ke System Setup.
        if (error.code === '42P01') {
            console.warn("Table user_roles not found. Defaulting to Super Admin for Initial Setup.");
            return 'super_admin';
        }
        // Jika error lain (misal row not found), lanjut ke fallback
    }

    if (data && data.role) return data.role as UserRole;
  } catch (e) {
    console.warn("User role fetch failed, falling back to heuristic.");
  }

  // 3. Fallback Logic (Jika data kosong/belum diinsert)
  // Email mengandung 'admin', 'owner', atau 'boss' dianggap Super Admin
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes('admin') || lowerEmail.includes('owner') || lowerEmail.includes('boss')) {
    return 'super_admin';
  }

  // Default untuk email lain adalah Staff (Restricted)
  return 'staff';
};
