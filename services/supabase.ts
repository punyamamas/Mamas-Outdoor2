import { createClient } from '@supabase/supabase-js';

// Helper function to safely get env variables in various environments (Vite, Next, or Raw)
const getEnv = (key: string, viteKey: string) => {
  // Try Vite/modern standard first
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[viteKey]) {
    // @ts-ignore
    return import.meta.env[viteKey];
  }
  // Try standard process.env (Node/Webpack) safely
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;