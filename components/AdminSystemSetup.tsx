
import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Check, Copy, Terminal, Shield, AlertTriangle, RefreshCw, Settings, Save, Clock, Printer, Bluetooth, Bot, Zap, Server, BellRing, PlayCircle, UserCheck, UserPlus, Key } from 'lucide-react';
import { getStoreConfig, saveStoreConfig, DEFAULT_CONFIG } from '../utils/storeConfig';
import { StoreConfig } from '../types';
import { connectPrinter, printTestPage, getPrinterStatus, disconnectPrinter } from '../services/bluetoothPrinterService';
import { playNotificationSound } from '../services/audioService';
import { getCurrentUser, getUserRole } from '../services/authService';

const AdminSystemSetup: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'database' | 'hardware' | 'automation'>('config');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // Config Form State
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [isSaved, setIsSaved] = useState(false);

  // Printer State
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);

  // Role Generator State
  const [newRoleEmail, setNewRoleEmail] = useState('');
  const [newRoleType, setNewRoleType] = useState('staff');
  
  // Current User State
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');

  useEffect(() => {
    setConfig(getStoreConfig());
    setIsPrinterConnected(getPrinterStatus());
    
    // Get Current User Info
    const fetchUser = async () => {
        const user = await getCurrentUser();
        if (user && user.email) {
            setCurrentUserEmail(user.email);
            const role = await getUserRole(user.email);
            setCurrentUserRole(role);
        }
    };
    fetchUser();
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

  const handleConnectPrinter = async () => {
      const success = await connectPrinter();
      setIsPrinterConnected(success);
  };

  const handleDisconnectPrinter = () => {
      disconnectPrinter();
      setIsPrinterConnected(false);
  };

  // NEW: TEST NOTIFICATION FUNCTION
  const handleTestNotification = async () => {
    if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            return alert("❌ Izin notifikasi ditolak oleh Browser/HP.");
        }
    }

    try {
        playNotificationSound();
    } catch (e) {
        console.error("Audio error:", e);
    }

    const title = "🔔 Cek Suara Ting!";
    const options: any = {
        body: "Jika Anda mendengar suara, sistem berjalan normal!",
        icon: 'https://image2url.com/r2/default/images/1767518643928-dd5a63dc-ddb0-4fdf-85e9-084b12f9c036.png',
        vibrate: [200, 100, 200],
        tag: 'test-notification'
    };

    try {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            if (registration && registration.showNotification) {
                await registration.showNotification(title, options);
                return; 
            }
        }
        new Notification(title, options);
    } catch (e: any) {
        console.warn("Visual notification skipped on this device:", e.message);
    }
  };

  // Generate Role SQL dynamically
  const generatedRoleSQL = `insert into public.user_roles (email, role)
values ('${newRoleEmail || 'email@karyawan.com'}', '${newRoleType}');`;

  const promoteSelfSQL = `insert into public.user_roles (email, role)
values ('${currentUserEmail}', 'super_admin')
on conflict (email) do update set role = 'super_admin';`;

// BAGIAN 7: USER ROLES (RBAC)
const userRolesSQL = `-- BAGIAN 7: User Roles (RBAC)
create table if not exists public.user_roles (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  role text not null check (role in ('super_admin', 'staff', 'owner')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_roles enable row level security;

-- Policy: Allow read for authenticated users (to check their own role)
drop policy if exists "Read User Roles" on public.user_roles;
create policy "Read User Roles" on public.user_roles for select using (auth.role() = 'authenticated');
`;

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

drop policy if exists "Public Insert Stock Log" on public.stock_logs;
create policy "Public Insert Stock Log" on public.stock_logs for insert with check (true);

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
  cash_withdrawal numeric default 0, -- NEW: Uang disetor (Rekapitulasi)
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
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-fit overflow-x-auto">
        <button 
          onClick={() => setActiveSubTab('config')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'config' ? 'bg-nature-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Settings size={16} /> Pengaturan Toko
        </button>
        <button 
          onClick={() => setActiveSubTab('hardware')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'hardware' ? 'bg-nature-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Printer size={16} /> Hardware
        </button>
        <button 
          onClick={() => setActiveSubTab('automation')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'automation' ? 'bg-nature-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Bot size={16} /> Bot & Automasi
        </button>
        <button 
          onClick={() => setActiveSubTab('database')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${activeSubTab === 'database' ? 'bg-nature-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Database size={16} /> Database
        </button>
      </div>

      {activeSubTab === 'config' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl animate-slide-in-right">
           <h3 className="text-lg font-bold text-gray-800 mb-1">Informasi Bisnis</h3>
           <p className="text-sm text-gray-500 mb-6">Data ini akan muncul otomatis di Kop Nota, Pesan WhatsApp, dan Footer web.</p>
           
           <form onSubmit={handleSaveConfig} className="space-y-5">
              {/* ... (Form Config Sama) ... */}
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

      {/* ... (TABS HARDWARE & AUTOMATION SAMA) ... */}
      {activeSubTab === 'automation' && (
          <div className="space-y-8 animate-slide-in-right">
              {/* ... (Isi Automation Sama) ... */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-4xl">
                  <div className="flex items-start gap-4 mb-4">
                      <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                          <BellRing size={32}/>
                      </div>
                      <div>
                          <h3 className="text-xl font-bold text-gray-900">Tes Suara & Notifikasi</h3>
                          <p className="text-sm text-gray-500">Cek apakah HP Anda sudah diizinkan membunyikan "Ting!" saat order masuk.</p>
                      </div>
                  </div>
                  <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center justify-between">
                      <div className="text-sm text-red-800">
                          <strong>Penting:</strong> Pastikan volume HP besar dan tidak di mode silent.
                      </div>
                      <button 
                        onClick={handleTestNotification}
                        className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md transition flex items-center gap-2"
                      >
                          <PlayCircle size={18}/> Coba Bunyikan
                      </button>
                  </div>
              </div>
              {/* ... (Sisanya sama) ... */}
          </div>
      )}

      {activeSubTab === 'hardware' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-3xl animate-slide-in-right">
              {/* ... (Isi Hardware Sama) ... */}
              <div className="flex items-center gap-4 mb-6">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-full">
                      <Printer size={32} />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-gray-900">Setup Printer Thermal (Bluetooth)</h3>
                      <p className="text-sm text-gray-500">Hubungkan printer kasir 58mm/80mm tanpa kabel.</p>
                  </div>
              </div>
              <div className="space-y-6">
                  <div className={`p-4 rounded-xl border ${isPrinterConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                              <Bluetooth size={24} className={isPrinterConnected ? 'text-green-600' : 'text-gray-400'} />
                              <div>
                                  <h4 className="font-bold text-gray-800">{isPrinterConnected ? 'Printer Terhubung' : 'Printer Belum Terhubung'}</h4>
                                  <p className="text-xs text-gray-500">{isPrinterConnected ? 'Siap mencetak struk' : 'Pastikan Bluetooth perangkat nyala'}</p>
                              </div>
                          </div>
                          {isPrinterConnected ? (
                              <button onClick={handleDisconnectPrinter} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded font-bold hover:bg-red-200">
                                  Putuskan
                              </button>
                          ) : (
                              <button onClick={handleConnectPrinter} className="text-xs bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2">
                                  <Bluetooth size={14}/> Cari Printer
                              </button>
                          )}
                      </div>
                  </div>
                  {/* ... */}
                  {isPrinterConnected && (
                      <button onClick={printTestPage} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition flex items-center justify-center gap-2">
                          <Printer size={18}/> Cetak Test Page
                      </button>
                  )}
              </div>
          </div>
      )}

      {activeSubTab === 'database' && (
        <div className="space-y-8 animate-slide-in-right">
            
            {/* Database Setup */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-4xl">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                        <Database size={32}/>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Konfigurasi Database (SQL)</h3>
                        <p className="text-sm text-gray-500">Salin skrip SQL di bawah dan jalankan di SQL Editor Supabase.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    
                    {/* BAGIAN 1: TABEL UTAMA */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Terminal size={16}/> Tabel Utama (Produk & Transaksi)</h4>
                            <button onClick={() => copyToClipboard(coreSQL, 'core')} className="text-xs flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                {copiedSection === 'core' ? <Check size={14}/> : <Copy size={14}/>} 
                                {copiedSection === 'core' ? 'Disalin' : 'Salin SQL'}
                            </button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-40">
                            {coreSQL}
                        </pre>
                    </div>

                    {/* BAGIAN 7: USER ROLES (NEW) & GENERATOR */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden border-l-4 border-l-blue-500">
                        <div className="bg-blue-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><UserCheck size={16}/> Manajemen Akses Role</h4>
                            <div className="text-[10px] bg-white px-2 py-1 rounded font-mono text-blue-600 border border-blue-200">
                                Current: <span className="font-bold">{currentUserRole.toUpperCase()}</span>
                            </div>
                        </div>
                        
                        {/* MY ACCESS & PROMOTE */}
                        <div className="p-4 bg-white border-b border-gray-200">
                            <h5 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-2"><Key size={14}/> Akses Saya (Emergency Promote)</h5>
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between mb-4">
                                <div className="text-xs text-yellow-800">
                                    <p>Email: <strong>{currentUserEmail}</strong></p>
                                    <p className="mt-1">Ingin menjadikan akun ini <strong>Super Admin</strong>?</p>
                                </div>
                                <button onClick={() => copyToClipboard(promoteSelfSQL, 'promote')} className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-700 shadow-sm">
                                    {copiedSection === 'promote' ? 'SQL Disalin!' : 'Copy Script Promote'}
                                </button>
                            </div>
                        </div>

                        {/* HELPER GENERATOR */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <h5 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-2"><UserPlus size={14}/> Generator Akses Karyawan</h5>
                            <div className="flex flex-col md:flex-row gap-3 items-end">
                                <div className="flex-1 w-full">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email User</label>
                                    <input 
                                        type="email" 
                                        placeholder="karyawan@mamas.com"
                                        className="w-full px-3 py-2 border rounded-lg text-sm"
                                        value={newRoleEmail}
                                        onChange={(e) => setNewRoleEmail(e.target.value)}
                                    />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role</label>
                                    <select 
                                        className="w-full px-3 py-2 border rounded-lg text-sm font-bold"
                                        value={newRoleType}
                                        onChange={(e) => setNewRoleType(e.target.value)}
                                    >
                                        <option value="staff">Staff</option>
                                        <option value="super_admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                </div>
                                <button onClick={() => copyToClipboard(generatedRoleSQL, 'gen_role')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 whitespace-nowrap">
                                    {copiedSection === 'gen_role' ? 'Disalin!' : 'Copy Script'}
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-blue-600">Script Tabel Utama</span>
                            <button onClick={() => copyToClipboard(userRolesSQL, 'roles')} className="text-xs flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                {copiedSection === 'roles' ? <Check size={14}/> : <Copy size={14}/>} 
                                {copiedSection === 'roles' ? 'Disalin' : 'Salin SQL'}
                            </button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-32">
                            {userRolesSQL}
                        </pre>
                    </div>

                    {/* BAGIAN 2: FITUR */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Terminal size={16}/> Tabel Fitur (Reviews & Payment Log)</h4>
                            <button onClick={() => copyToClipboard(featuresSQL, 'features')} className="text-xs flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                {copiedSection === 'features' ? <Check size={14}/> : <Copy size={14}/>} 
                                {copiedSection === 'features' ? 'Disalin' : 'Salin SQL'}
                            </button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-40">
                            {featuresSQL}
                        </pre>
                    </div>

                    {/* BAGIAN 3: STORAGE */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><HardDrive size={16}/> Storage Buckets</h4>
                            <button onClick={() => copyToClipboard(storageSQL, 'storage')} className="text-xs flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                {copiedSection === 'storage' ? <Check size={14}/> : <Copy size={14}/>} 
                                {copiedSection === 'storage' ? 'Disalin' : 'Salin SQL'}
                            </button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-32">
                            {storageSQL}
                        </pre>
                    </div>

                    {/* BAGIAN 4 & 5: STOK & SHIFT */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Shield size={16}/> Manajemen Stok & Shift Kasir</h4>
                            <button onClick={() => copyToClipboard(stockLogSQL + '\n\n' + shiftLogSQL, 'advanced')} className="text-xs flex items-center gap-1 text-blue-600 hover:underline font-bold">
                                {copiedSection === 'advanced' ? <Check size={14}/> : <Copy size={14}/>} 
                                {copiedSection === 'advanced' ? 'Disalin' : 'Salin SQL'}
                            </button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-40">
                            {stockLogSQL}
                            {'\n\n'}
                            {shiftLogSQL}
                        </pre>
                    </div>

                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemSetup;
