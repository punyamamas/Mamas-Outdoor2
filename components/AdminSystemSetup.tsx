
import React, { useState } from 'react';
import { Database, HardDrive, Check, Copy, Terminal, Shield } from 'lucide-react';

const AdminSystemSetup: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const storageSQL = `-- 1. Buat Bucket Storage 'payment_proofs'
insert into storage.buckets (id, name, public) 
values ('payment_proofs', 'payment_proofs', true)
on conflict (id) do nothing;

-- 2. Atur Policy agar Public bisa Upload (Insert) dan Lihat (Select)
-- Hapus policy lama jika ada untuk menghindari duplikat error
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Upload" on storage.objects;
drop policy if exists "Public Select" on storage.objects;
drop policy if exists "Public Insert" on storage.objects;

create policy "Public Select" on storage.objects 
for select using ( bucket_id = 'payment_proofs' );

create policy "Public Insert" on storage.objects 
for insert with check ( bucket_id = 'payment_proofs' );`;

  const logsSQL = `-- Tabel untuk mencatat arus kas (Pemasukan/Pengeluaran)
create table if not exists public.payment_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id text,
  amount numeric not null,
  payment_method text not null, -- 'cash' or 'transfer'
  type text not null, -- 'IN' or 'OUT'
  description text,
  category text
);

-- Policy Keamanan (Buka akses untuk Anonim/Public agar app jalan tanpa login Auth Supabase)
alter table public.payment_logs enable row level security;

-- Hapus policy lama untuk mencegah error 'policy already exists'
drop policy if exists "Enable all access for anon" on public.payment_logs;
drop policy if exists "Enable all access logs" on public.payment_logs;

create policy "Enable all access logs" on public.payment_logs
for all using (true) with check (true);`;

  const reviewsSQL = `-- Tabel untuk Ulasan Pelanggan
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id text,
  customer_name text,
  rating numeric,
  comment text,
  is_public boolean default true
);

alter table public.reviews enable row level security;

-- Hapus policy lama untuk mencegah error 'policy already exists'
drop policy if exists "Enable all access for anon" on public.reviews;
drop policy if exists "Enable all access reviews" on public.reviews;

create policy "Enable all access reviews" on public.reviews
for all using (true) with check (true);`;

  return (
    <div className="space-y-8 animate-slide-in-right">
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex gap-4 items-start">
         <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Terminal size={24} />
         </div>
         <div>
            <h3 className="text-lg font-bold text-blue-900">Setup Database Supabase</h3>
            <p className="text-sm text-blue-700 mt-1 leading-relaxed">
               Aplikasi ini membutuhkan beberapa tabel dan storage bucket agar fitur <strong>Upload Bukti Bayar</strong>, <strong>Keuangan</strong>, dan <strong>Review</strong> berjalan lancar.
               <br/>Salin kode SQL di bawah ini dan jalankan di <strong>Supabase Dashboard &rarr; SQL Editor</strong>.
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* STORAGE SETUP */}
         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
               <h4 className="font-bold text-gray-800 flex items-center gap-2">
                  <HardDrive size={18} className="text-nature-600"/> Storage Bucket (Penting!)
               </h4>
               <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded">Prioritas</span>
            </div>
            <div className="p-6">
               <p className="text-sm text-gray-600 mb-4">
                  Gunakan script ini untuk membuat bucket <code>payment_proofs</code> otomatis.
                  Ini mengatasi error "Bucket not found" saat upload bukti transfer.
               </p>
               <div className="relative group">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700">
                     {storageSQL}
                  </pre>
                  <button 
                     onClick={() => copyToClipboard(storageSQL, 'storage')}
                     className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                  >
                     {copiedSection === 'storage' ? <Check size={14}/> : <Copy size={14}/>} 
                     {copiedSection === 'storage' ? 'Disalin!' : 'Copy SQL'}
                  </button>
               </div>
            </div>
         </div>

         {/* TABLES SETUP */}
         <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
               <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                     <Database size={18} className="text-blue-600"/> Tabel Keuangan (Payment Logs)
                  </h4>
               </div>
               <div className="p-6">
                  <div className="relative group">
                     <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700">
                        {logsSQL}
                     </pre>
                     <button 
                        onClick={() => copyToClipboard(logsSQL, 'logs')}
                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                     >
                        {copiedSection === 'logs' ? <Check size={14}/> : <Copy size={14}/>} 
                        {copiedSection === 'logs' ? 'Disalin!' : 'Copy SQL'}
                     </button>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
               <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                  <h4 className="font-bold text-gray-800 flex items-center gap-2">
                     <Shield size={18} className="text-yellow-600"/> Tabel Review & Ulasan
                  </h4>
               </div>
               <div className="p-6">
                  <div className="relative group">
                     <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700">
                        {reviewsSQL}
                     </pre>
                     <button 
                        onClick={() => copyToClipboard(reviewsSQL, 'reviews')}
                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                     >
                        {copiedSection === 'reviews' ? <Check size={14}/> : <Copy size={14}/>} 
                        {copiedSection === 'reviews' ? 'Disalin!' : 'Copy SQL'}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AdminSystemSetup;
