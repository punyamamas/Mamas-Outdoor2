
import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Check, Copy, Terminal, Shield, AlertTriangle, RefreshCw, Settings, Save, Clock } from 'lucide-react';
import { getStoreConfig, saveStoreConfig, DEFAULT_CONFIG } from '../utils/storeConfig';
import { StoreConfig } from '../types';

const AdminSystemSetup: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'database'>('config');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // Config Form State
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setConfig(getStoreConfig());
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreConfig(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const copyToClipboard = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // SQL Stock Logs
  const stockLogSQL = `-- BAGIAN 4: Stock Logs (Kartu Stok)
create table if not exists public.stock_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  product_id text,
  product_name text,
  type text, -- 'IN', 'OUT', 'DAMAGE', 'REPAIR'
  qty numeric,
  previous_stock numeric,
  current_stock numeric,
  reason text,
  actor text
);

alter table public.stock_logs enable row level security;

-- POLICY: Public boleh Insert (untuk log otomatis saat checkout)
drop policy if exists "Public Insert Stock Log" on public.stock_logs;
create policy "Public Insert Stock Log" on public.stock_logs for insert with check (true);

-- POLICY: Admin boleh Select, Update & Delete (untuk audit)
drop policy if exists "Admin Select Stock Log" on public.stock_logs;
create policy "Admin Select Stock Log" on public.stock_logs for select using (auth.role() = 'authenticated');

drop policy if exists "Admin Update Stock Log" on public.stock_logs;
create policy "Admin Update Stock Log" on public.stock_logs for update using (auth.role() = 'authenticated');

drop policy if exists "Admin Delete Stock Log" on public.stock_logs;
create policy "Admin Delete Stock Log" on public.stock_logs for delete using (auth.role() = 'authenticated');`;

// BAGIAN 5: SHIFT LOGS (Kasir)
const shiftLogSQL = `-- BAGIAN 5: Shift Logs (Kasir)
create table if not exists public.shift_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  shift_name text, -- 'Pagi', 'Sore'
  cashier_name text,
  start_cash numeric default 0,
  end_cash numeric default 0,
  system_cash numeric default 0,
  difference numeric default 0,
  status text default 'open', -- 'open', 'closed'
  notes text
);

alter table public.shift_logs enable row level security;

-- Policy: Admin Full Access
drop policy if exists "Admin Manage Shifts" on public.shift_logs;
create policy "Admin Manage Shifts" on public.shift_logs for all using (auth.role() = 'authenticated');
`;

  // BAGIAN 1: TABEL UTAMA (SECURED)
  const coreSQL = `-- BAGIAN 1: Core Tables & Policies (SECURED)

-- 1. TRANSACTIONS
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  customer_name text,
  customer_whatsapp text,
  customer_campus text,
  customer_location text,
  customer_identity text,
  rental_date date,
  duration numeric,
  items jsonb,
  total_price numeric,
  fine_amount numeric default 0,
  amount_paid numeric default 0,
  payment_method text,
  payment_proof_url text,
  identity_photo_url text,
  status text default 'pending'
);
alter table public.transactions enable row level security;

-- Public Access (Read/Write/Update): Dibutuhkan untuk Checkout & Upload Bukti Bayar
drop policy if exists "Public Select Trx" on public.transactions;
create policy "Public Select Trx" on public.transactions for select using (true);

drop policy if exists "Public Insert Trx" on public.transactions;
create policy "Public Insert Trx" on public.transactions for insert with check (true);

drop policy if exists "Public Update Trx" on public.transactions;
create policy "Public Update Trx" on public.transactions for update using (true);

-- Admin Only (Delete): Mencegah penghapusan data oleh pihak luar
drop policy if exists "Admin Delete Trx" on public.transactions;
create policy "Admin Delete Trx" on public.transactions for delete using (auth.role() = 'authenticated');


-- 2. PRODUCTS
create table if not exists public.products (
  id text primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  category text,
  price numeric default 0,
  "price3Days" numeric default 0,
  "price4Days" numeric default 0,
  "price5Days" numeric default 0,
  "price6Days" numeric default 0,
  "price7Days" numeric default 0,
  is_sale boolean default false,
  sale_price numeric default 0,
  stock numeric default 0,
  rented numeric default 0,
  damaged numeric default 0,
  image text,
  description text,
  package_items jsonb default '[]'::jsonb,
  sizes jsonb default '{}'::jsonb,
  colors text[],
  variants jsonb default '[]'::jsonb,
  color_images jsonb default '[]'::jsonb
);
alter table public.products enable row level security;

-- Public Read & Update: Update dibutuhkan agar stock berkurang otomatis saat checkout (Client-side logic)
drop policy if exists "Public Read Prod" on public.products;
create policy "Public Read Prod" on public.products for select using (true);

drop policy if exists "Public Update Prod" on public.products;
create policy "Public Update Prod" on public.products for update using (true);

-- Admin Only (Insert & Delete): Mencegah orang asing menambah/menghapus produk
drop policy if exists "Admin Insert Prod" on public.products;
create policy "Admin Insert Prod" on public.products for insert with check (auth.role() = 'authenticated');

drop policy if exists "Admin Delete Prod" on public.products;
create policy "Admin Delete Prod" on public.products for delete using (auth.role() = 'authenticated');


-- 3. CATEGORIES
create table if not exists public.categories (
  id bigint generated by default as identity primary key,
  name text not null
);
alter table public.categories enable row level security;

-- Public Read Only
drop policy if exists "Public Read Cat" on public.categories;
create policy "Public Read Cat" on public.categories for select using (true);

-- Admin Manage (Insert/Update/Delete)
drop policy if exists "Admin Insert Cat" on public.categories;
create policy "Admin Insert Cat" on public.categories for insert with check (auth.role() = 'authenticated');

drop policy if exists "Admin Update Cat" on public.categories;
create policy "Admin Update Cat" on public.categories for update using (auth.role() = 'authenticated');

drop policy if exists "Admin Delete Cat" on public.categories;
create policy "Admin Delete Cat" on public.categories for delete using (auth.role() = 'authenticated');`;

  // BAGIAN 2: FITUR TAMBAHAN (SECURED)
  const featuresSQL = `-- BAGIAN 2: Features (Reviews & Logs) - SECURED

-- 1. REVIEWS
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

-- Public Read & Insert
drop policy if exists "Public Read Reviews" on public.reviews;
create policy "Public Read Reviews" on public.reviews for select using (true);

drop policy if exists "Public Insert Reviews" on public.reviews;
create policy "Public Insert Reviews" on public.reviews for insert with check (true);

-- Admin Delete Only
drop policy if exists "Admin Delete Reviews" on public.reviews;
create policy "Admin Delete Reviews" on public.reviews for delete using (auth.role() = 'authenticated');


-- 2. PAYMENT LOGS (Keuangan)
create table if not exists public.payment_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id text,
  amount numeric not null,
  payment_method text,
  type text,
  description text,
  category text
);
alter table public.payment_logs enable row level security;

-- Public Insert (Untuk mencatat DP otomatis saat checkout)
drop policy if exists "Public Insert PayLog" on public.payment_logs;
create policy "Public Insert PayLog" on public.payment_logs for insert with check (true);

-- Admin Read/Update/Delete (Data keuangan bersifat rahasia)
drop policy if exists "Admin Select PayLog" on public.payment_logs;
create policy "Admin Select PayLog" on public.payment_logs for select using (auth.role() = 'authenticated');

drop policy if exists "Admin Update PayLog" on public.payment_logs;
create policy "Admin Update PayLog" on public.payment_logs for update using (auth.role() = 'authenticated');

drop policy if exists "Admin Delete PayLog" on public.payment_logs;
create policy "Admin Delete PayLog" on public.payment_logs for delete using (auth.role() = 'authenticated');`;

  // BAGIAN 3: STORAGE
  const storageSQL = `-- BAGIAN 3: Storage Buckets (Payment Proofs & Product Images)
-- Bucket: payment_proofs
insert into storage.buckets (id, name, public) 
values ('payment_proofs', 'payment_proofs', true)
on conflict (id) do nothing;

-- Bucket: product_images (NEW)
insert into storage.buckets (id, name, public) 
values ('product_images', 'product_images', true)
on conflict (id) do nothing;

-- Policies
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Select" on storage.objects;
drop policy if exists "Public Insert" on storage.objects;

-- Allow Public Read for All
create policy "Public Select" on storage.objects for select using ( true );

-- Allow Public Insert (Upload) for specified buckets
create policy "Public Insert" on storage.objects for insert with check ( 
  bucket_id in ('payment_proofs', 'product_images')
);`;

  return (
    <div className="space-y-6 pb-10">
      
      {/* Sub Tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-fit">
        <button 
          onClick={() => setActiveSubTab('config')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'config' ? 'bg-nature-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Settings size={16} /> Pengaturan Toko
        </button>
        <button 
          onClick={() => setActiveSubTab('database')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'database' ? 'bg-nature-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Database size={16} /> Database & SQL
        </button>
      </div>

      {activeSubTab === 'config' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl animate-slide-in-right">
           <h3 className="text-lg font-bold text-gray-800 mb-1">Informasi Bisnis</h3>
           <p className="text-sm text-gray-500 mb-6">Data ini akan muncul otomatis di Kop Nota, Pesan WhatsApp, dan Footer web.</p>
           
           <form onSubmit={handleSaveConfig} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nama Toko / Brand</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nature-500 outline-none font-medium"
                      value={config.storeName}
                      onChange={e => setConfig({...config, storeName: e.target.value})}
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nomor WhatsApp Admin</label>
                    <input 
                      type="text" 
                      placeholder="628..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nature-500 outline-none font-medium"
                      value={config.adminWhatsapp}
                      onChange={e => setConfig({...config, adminWhatsapp: e.target.value.replace(/\D/g,'')})}
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Gunakan format 628... (tanpa + atau 0 di depan)</p>
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Alamat Lengkap (Muncul di Nota)</label>
                 <textarea 
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nature-500 outline-none font-medium resize-none"
                    value={config.storeAddress}
                    onChange={e => setConfig({...config, storeAddress: e.target.value})}
                 />
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                 <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><Settings size={14}/> Rekening Pembayaran DP</h4>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-blue-600 mb-1">Nama Bank</label>
                        <input 
                          type="text" 
                          placeholder="BCA / BRI / BSI"
                          className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm"
                          value={config.bankName}
                          onChange={e => setConfig({...config, bankName: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-600 mb-1">Nomor Rekening</label>
                        <input 
                          type="text" 
                          className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm font-mono"
                          value={config.bankAccount}
                          onChange={e => setConfig({...config, bankAccount: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-blue-600 mb-1">Atas Nama</label>
                        <input 
                          type="text" 
                          className="w-full border border-blue-200 rounded px-2 py-1.5 text-sm"
                          value={config.bankHolder}
                          onChange={e => setConfig({...config, bankHolder: e.target.value})}
                        />
                    </div>
                 </div>
              </div>

              <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Pesan Footer Nota</label>
                 <input 
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nature-500 outline-none"
                    value={config.footerMessage}
                    onChange={e => setConfig({...config, footerMessage: e.target.value})}
                 />
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end">
                 <button 
                   type="submit"
                   className={`px-6 py-2.5 rounded-xl font-bold text-white transition flex items-center gap-2 ${isSaved ? 'bg-green-600' : 'bg-nature-600 hover:bg-nature-700'}`}
                 >
                    {isSaved ? <Check size={18}/> : <Save size={18}/>}
                    {isSaved ? 'Tersimpan!' : 'Simpan Perubahan'}
                 </button>
              </div>
           </form>
        </div>
      )}

      {activeSubTab === 'database' && (
        <div className="space-y-8 animate-slide-in-right">
          
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 flex gap-4 items-start">
             <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                <Terminal size={24} />
             </div>
             <div>
                <h3 className="text-lg font-bold text-blue-900">Setup Database (Security Patched)</h3>
                <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                   Script di bawah ini sudah diperbarui dengan <strong>Row Level Security (RLS)</strong> yang ketat. 
                   Pastikan Anda menjalankan ulang script ini di Supabase SQL Editor untuk mengamankan database.
                </p>
             </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
             {/* STEP 1: CORE */}
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden border-l-4 border-l-green-500">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                   <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <Database size={18} className="text-nature-600"/> Bagian 1: Core Tables (Protected)
                   </h4>
                   <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Admin Delete Only</span>
                </div>
                <div className="p-6">
                   <div className="relative group">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700 max-h-64">
                         {coreSQL}
                      </pre>
                      <button 
                         onClick={() => copyToClipboard(coreSQL, 'core')}
                         className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                      >
                         {copiedSection === 'core' ? <Check size={14}/> : <Copy size={14}/>} 
                         {copiedSection === 'core' ? 'Disalin!' : 'Copy SQL'}
                      </button>
                   </div>
                </div>
             </div>

             {/* STEP 2: FEATURES */}
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden border-l-4 border-l-blue-500">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                   <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <Shield size={18} className="text-blue-600"/> Bagian 2: Reviews & Finance (Protected)
                   </h4>
                   <span className="text-xs text-gray-500">Data keuangan hanya bisa dilihat Admin</span>
                </div>
                <div className="p-6">
                   <div className="relative group">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700 max-h-64">
                         {featuresSQL}
                      </pre>
                      <button 
                         onClick={() => copyToClipboard(featuresSQL, 'features')}
                         className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                      >
                         {copiedSection === 'features' ? <Check size={14}/> : <Copy size={14}/>} 
                         {copiedSection === 'features' ? 'Disalin!' : 'Copy SQL'}
                      </button>
                   </div>
                </div>
             </div>

             {/* STEP 3: STOCK LOGS */}
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden border-l-4 border-l-orange-500">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                   <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <RefreshCw size={18} className="text-orange-600"/> Bagian 3: Kartu Stok
                   </h4>
                </div>
                <div className="p-6">
                   <div className="relative group">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700 max-h-64">
                         {stockLogSQL}
                      </pre>
                      <button 
                         onClick={() => copyToClipboard(stockLogSQL, 'stock')}
                         className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                      >
                         {copiedSection === 'stock' ? <Check size={14}/> : <Copy size={14}/>} 
                         {copiedSection === 'stock' ? 'Disalin!' : 'Copy SQL'}
                      </button>
                   </div>
                </div>
             </div>

             {/* STEP 4: STORAGE */}
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                   <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <HardDrive size={18} className="text-gray-600"/> Bagian 4: Storage
                   </h4>
                </div>
                <div className="p-6">
                   <div className="relative group">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700 max-h-64">
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

             {/* STEP 5: SHIFT LOGS (NEW) */}
             <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden border-l-4 border-l-purple-500">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                   <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      <Clock size={18} className="text-purple-600"/> Bagian 5: Manajemen Shift Kasir
                   </h4>
                </div>
                <div className="p-6">
                   <div className="relative group">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto whitespace-pre-wrap border border-gray-700 max-h-64">
                         {shiftLogSQL}
                      </pre>
                      <button 
                         onClick={() => copyToClipboard(shiftLogSQL, 'shift')}
                         className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-2 text-xs font-bold backdrop-blur-sm"
                      >
                         {copiedSection === 'shift' ? <Check size={14}/> : <Copy size={14}/>} 
                         {copiedSection === 'shift' ? 'Disalin!' : 'Copy SQL'}
                      </button>
                   </div>
                </div>
             </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemSetup;
