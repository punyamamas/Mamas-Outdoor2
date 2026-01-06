
import React, { useState, useEffect } from 'react';
import { Database, HardDrive, Check, Copy, Terminal, Shield, AlertTriangle, RefreshCw, Settings, Save, Clock, Printer, Bluetooth, Bot, Zap, Server, BellRing, PlayCircle, UserCheck, UserPlus, Key } from 'lucide-react';
import { getStoreConfig, saveStoreConfig, DEFAULT_CONFIG } from '../utils/storeConfig';
import { StoreConfig } from '../types';
import { connectPrinter, printTestPage, getPrinterStatus, disconnectPrinter } from '../services/bluetoothPrinterService';
import { playNotificationSound } from '../services/audioService';
import { getCurrentUser, getUserRole } from '../services/authService';

const AdminSystemSetup: React.FC = () => {
  // ... (State logic unchanged)
  const [activeSubTab, setActiveSubTab] = useState<'config' | 'database' | 'hardware' | 'automation'>('config');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [config, setConfig] = useState<StoreConfig>(DEFAULT_CONFIG);
  const [isSaved, setIsSaved] = useState(false);
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [newRoleEmail, setNewRoleEmail] = useState('');
  const [newRoleType, setNewRoleType] = useState('staff');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState('');

  useEffect(() => {
    setConfig(getStoreConfig());
    setIsPrinterConnected(getPrinterStatus());
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

  const handleTestNotification = async () => {
    // ... (Logic unchanged)
    playNotificationSound();
  };

  const generatedRoleSQL = `insert into public.user_roles (email, role)
values ('${newRoleEmail || 'email@karyawan.com'}', '${newRoleType}');`;

  const promoteSelfSQL = `insert into public.user_roles (email, role)
values ('${currentUserEmail || 'mamasoutdoor.rent@gmail.com'}', 'super_admin')
on conflict (email) do update set role = 'super_admin';`;

// UPDATE: Core SQL Updated for better RLS
  const coreSQL = `-- BAGIAN 1: Core Tables & Policies (UPDATED)

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

-- Allow Public to Insert (Checkout)
drop policy if exists "Public Insert Trx" on public.transactions;
create policy "Public Insert Trx" on public.transactions for insert with check (true);

-- Allow Public to Read own transaction (by UUID knowledge) - Simplified to True for now
drop policy if exists "Public Select Trx" on public.transactions;
create policy "Public Select Trx" on public.transactions for select using (true);

-- Allow Public to Update (Upload Proof)
drop policy if exists "Public Update Trx" on public.transactions;
create policy "Public Update Trx" on public.transactions for update using (true);

-- Admin/Staff Full Access (Explicit)
drop policy if exists "Staff Manage Trx" on public.transactions;
create policy "Staff Manage Trx" on public.transactions for all using (auth.role() = 'authenticated');


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

-- Public Read & Update (Stock deduction)
drop policy if exists "Public Read Prod" on public.products;
create policy "Public Read Prod" on public.products for select using (true);

drop policy if exists "Public Update Prod" on public.products;
create policy "Public Update Prod" on public.products for update using (true);

-- Staff/Admin Full Access
drop policy if exists "Staff Manage Prod" on public.products;
create policy "Staff Manage Prod" on public.products for all using (auth.role() = 'authenticated');


-- 3. CATEGORIES
create table if not exists public.categories (
  id bigint generated by default as identity primary key,
  name text not null
);
alter table public.categories enable row level security;

-- Public Read
drop policy if exists "Public Read Cat" on public.categories;
create policy "Public Read Cat" on public.categories for select using (true);

-- Staff/Admin Manage
drop policy if exists "Staff Manage Cat" on public.categories;
create policy "Staff Manage Cat" on public.categories for all using (auth.role() = 'authenticated');
`;

  // ... (Other SQL strings unchanged) ...
  const userRolesSQL = `-- BAGIAN 7: User Roles
create table if not exists public.user_roles (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  role text not null check (role in ('super_admin', 'staff', 'owner')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.user_roles enable row level security;
drop policy if exists "Read User Roles" on public.user_roles;
create policy "Read User Roles" on public.user_roles for select using (auth.role() = 'authenticated');
`;

  const featuresSQL = `-- BAGIAN 2: Features (Logs)
-- PAYMENT LOGS
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

-- Public Insert (DP)
drop policy if exists "Public Insert PayLog" on public.payment_logs;
create policy "Public Insert PayLog" on public.payment_logs for insert with check (true);

-- Staff/Admin Full Access
drop policy if exists "Staff Manage PayLog" on public.payment_logs;
create policy "Staff Manage PayLog" on public.payment_logs for all using (auth.role() = 'authenticated');

-- REVIEWS (Unchanged)
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
drop policy if exists "Public Read Reviews" on public.reviews;
create policy "Public Read Reviews" on public.reviews for select using (true);
drop policy if exists "Public Insert Reviews" on public.reviews;
create policy "Public Insert Reviews" on public.reviews for insert with check (true);
drop policy if exists "Admin Manage Reviews" on public.reviews;
create policy "Admin Manage Reviews" on public.reviews for all using (auth.role() = 'authenticated');
`;

const storageSQL = `-- BAGIAN 3: Storage
insert into storage.buckets (id, name, public) values ('payment_proofs', 'payment_proofs', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('product_images', 'product_images', true) on conflict (id) do nothing;
drop policy if exists "Public Select" on storage.objects;
create policy "Public Select" on storage.objects for select using ( true );
drop policy if exists "Public Insert" on storage.objects;
create policy "Public Insert" on storage.objects for insert with check ( bucket_id in ('payment_proofs', 'product_images') );
`;

const stockLogSQL = `-- BAGIAN 4: Advanced
create table if not exists public.stock_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  product_id text,
  product_name text,
  type text,
  qty numeric,
  previous_stock numeric,
  current_stock numeric,
  reason text,
  actor text
);
alter table public.stock_logs enable row level security;
drop policy if exists "Public Insert Stock" on public.stock_logs;
create policy "Public Insert Stock" on public.stock_logs for insert with check (true);
drop policy if exists "Staff Manage Stock" on public.stock_logs;
create policy "Staff Manage Stock" on public.stock_logs for all using (auth.role() = 'authenticated');
`;

const shiftLogSQL = `-- BAGIAN 5: Shift Logs
create table if not exists public.shift_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  shift_name text,
  cashier_name text,
  start_cash numeric default 0,
  end_cash numeric default 0,
  system_cash numeric default 0,
  difference numeric default 0,
  cash_withdrawal numeric default 0,
  status text default 'open',
  notes text
);
alter table public.shift_logs enable row level security;
drop policy if exists "Staff Manage Shift" on public.shift_logs;
create policy "Staff Manage Shift" on public.shift_logs for all using (auth.role() = 'authenticated');
`;

  // ... (Render Logic Same) ...
  return (
    <div className="space-y-6 pb-10">
      
      {/* Sub Tabs */}
      <div className="flex bg-white p-1 rounded-xl border border-gray-200 w-fit overflow-x-auto">
        <button onClick={() => setActiveSubTab('config')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'config' ? 'bg-nature-600 text-white' : 'text-gray-500'}`}>
          <Settings size={16} /> Pengaturan
        </button>
        <button onClick={() => setActiveSubTab('database')} className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeSubTab === 'database' ? 'bg-nature-600 text-white' : 'text-gray-500'}`}>
          <Database size={16} /> Database
        </button>
        {/* ... others ... */}
      </div>

      {activeSubTab === 'config' && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-slide-in-right">
              {/* Form Config content same as before */}
              <h3 className="font-bold text-lg text-gray-800">Konfigurasi Toko</h3>
              <form onSubmit={handleSaveConfig} className="mt-4 space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase">Nama Toko</label>
                      <input type="text" className="w-full border rounded p-2" value={config.storeName} onChange={e=>setConfig({...config, storeName:e.target.value})}/>
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase">WA Admin</label>
                      <input type="text" className="w-full border rounded p-2" value={config.adminWhatsapp} onChange={e=>setConfig({...config, adminWhatsapp:e.target.value})}/>
                  </div>
                  <button type="submit" className="bg-nature-600 text-white px-4 py-2 rounded font-bold">Simpan</button>
              </form>
          </div>
      )}

      {activeSubTab === 'database' && (
        <div className="space-y-8 animate-slide-in-right">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-4xl">
                <div className="flex items-start gap-4 mb-6">
                    <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Database size={32}/></div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Konfigurasi Database (SQL)</h3>
                        <p className="text-sm text-gray-500">Update Permission agar Staff bisa akses.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* CORE */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Terminal size={16}/> Tabel Utama (Produk & Transaksi)</h4>
                            <button onClick={() => copyToClipboard(coreSQL, 'core')} className="text-xs flex items-center gap-1 text-blue-600 font-bold">{copiedSection === 'core' ? 'Disalin' : 'Salin SQL'}</button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-40">{coreSQL}</pre>
                    </div>

                    {/* ROLE GENERATOR */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden border-l-4 border-l-blue-500">
                        <div className="bg-blue-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2"><UserCheck size={16}/> Manajemen Akses Role</h4>
                            <div className="text-[10px] bg-white px-2 py-1 rounded font-mono text-blue-600 border border-blue-200">
                                Current: <span className="font-bold">{currentUserRole.toUpperCase()}</span>
                            </div>
                        </div>
                        
                        <div className="p-4 bg-white border-b border-gray-200">
                            <h5 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-2"><Key size={14}/> Akses Saya (Emergency Promote)</h5>
                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center justify-between mb-4">
                                <div className="text-xs text-yellow-800">
                                    <p>Email: <strong>{currentUserEmail || 'mamasoutdoor.rent@gmail.com'}</strong></p>
                                    <p className="mt-1">Ingin menjadikan akun ini <strong>Super Admin</strong>?</p>
                                </div>
                                <button onClick={() => copyToClipboard(promoteSelfSQL, 'promote')} className="bg-yellow-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-700 shadow-sm">
                                    {copiedSection === 'promote' ? 'SQL Disalin!' : 'Copy Script Promote'}
                                </button>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <h5 className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-2"><UserPlus size={14}/> Generator Akses Karyawan</h5>
                            <div className="flex flex-col md:flex-row gap-3 items-end">
                                <div className="flex-1 w-full">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email User</label>
                                    <input type="email" placeholder="karyawan@mamas.com" className="w-full px-3 py-2 border rounded-lg text-sm" value={newRoleEmail} onChange={(e) => setNewRoleEmail(e.target.value)} />
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role</label>
                                    <select className="w-full px-3 py-2 border rounded-lg text-sm font-bold" value={newRoleType} onChange={(e) => setNewRoleType(e.target.value)}>
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
                            <span className="text-[10px] font-bold text-blue-600">Script Tabel User Role</span>
                            <button onClick={() => copyToClipboard(userRolesSQL, 'roles')} className="text-xs flex items-center gap-1 text-blue-600 font-bold">{copiedSection === 'roles' ? 'Disalin' : 'Salin SQL'}</button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-32">{userRolesSQL}</pre>
                    </div>

                    {/* FEATURES */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Terminal size={16}/> Tabel Fitur (Reviews & Payment Log)</h4>
                            <button onClick={() => copyToClipboard(featuresSQL, 'features')} className="text-xs flex items-center gap-1 text-blue-600 font-bold">{copiedSection === 'features' ? 'Disalin' : 'Salin SQL'}</button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-40">{featuresSQL}</pre>
                    </div>

                    {/* ADVANCED */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Shield size={16}/> Manajemen Stok & Shift Kasir</h4>
                            <button onClick={() => copyToClipboard(stockLogSQL + '\n\n' + shiftLogSQL, 'advanced')} className="text-xs flex items-center gap-1 text-blue-600 font-bold">{copiedSection === 'advanced' ? 'Disalin' : 'Salin SQL'}</button>
                        </div>
                        <pre className="p-4 text-[10px] md:text-xs font-mono bg-white overflow-x-auto text-gray-600 h-40">{stockLogSQL}{'\n\n'}{shiftLogSQL}</pre>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminSystemSetup;
