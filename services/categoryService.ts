import { supabase } from './supabase';
import { Category } from '../types';

// Default fallback jika DB kosong/error
const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Tenda' },
  { id: '2', name: 'Carrier' },
  { id: '3', name: 'Tidur' },
  { id: '4', name: 'Masak' },
  { id: '5', name: 'Aksesoris' }
];

export const getCategories = async (): Promise<Category[]> => {
  if (!supabase) return DEFAULT_CATEGORIES;

  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return DEFAULT_CATEGORIES;
    }

    if (!data || data.length === 0) return DEFAULT_CATEGORIES;

    return data.map((item: any) => ({
      id: item.id.toString(),
      name: item.name
    }));
  } catch (err) {
    console.error('Unexpected error fetching categories:', err);
    return DEFAULT_CATEGORIES;
  }
};

export const addCategory = async (name: string): Promise<Category | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('categories')
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    alert('Gagal menambah kategori: ' + error.message);
    return null;
  }

  return { id: data.id.toString(), name: data.name };
};

export const updateCategory = async (id: string, name: string): Promise<Category | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('categories')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    alert('Gagal update kategori: ' + error.message);
    return null;
  }

  return { id: data.id.toString(), name: data.name };
};

export const deleteCategory = async (id: string): Promise<boolean> => {
  if (!supabase) return false;

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Gagal menghapus kategori: ' + error.message);
    return false;
  }

  return true;
};
