
# 🏔️ Mamas Outdoor - Sistem Manajemen Sewa Alat Outdoor

![App Status](https://img.shields.io/badge/status-production_ready-green)
![Tech Stack](https://img.shields.io/badge/stack-React_Vite_Supabase-blue)
![PWA](https://img.shields.io/badge/PWA-Supported-orange)

Aplikasi web Progressive Web App (PWA) untuk manajemen penyewaan alat camping dan mendaki gunung. Didesain khusus untuk **Mamas Outdoor Purwokerto** dengan target pasar mahasiswa. Menggabungkan kemudahan pemesanan via WhatsApp dengan dashboard admin yang powerful untuk manajemen stok dan keuangan.

---

## 📋 Daftar Isi
1. [Fitur Unggulan](#-fitur-unggulan)
2. [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
3. [Instalasi & Setup (Developer)](#-instalasi--setup-developer)
4. [Konfigurasi Database (Supabase)](#-konfigurasi-database-supabase)
5. [Panduan Operasional (Admin/Staff)](#-panduan-operasional-adminstaff)
6. [Integrasi Hardware (Printer & Scanner)](#-integrasi-hardware)
7. [Deployment](#-deployment)

---

## 🌟 Fitur Unggulan

### Untuk Pelanggan (Frontend)
*   **No-Login Checkout:** Pelanggan tidak perlu mendaftar akun. Cukup pilih barang -> Checkout -> Terhubung ke WhatsApp Admin dengan format pesanan otomatis.
*   **Mamas AI Guide (Gemini):** Asisten virtual cerdas yang memberikan rekomendasi alat mendaki berdasarkan tujuan (misal: "Ke Slamet butuh apa aja?").
*   **Dynamic Pricing:** Harga sewa otomatis menyesuaikan durasi (2 hari, 3 hari, dst).
*   **PWA Installable:** Bisa diinstall di HP layaknya aplikasi native.

### Untuk Manajemen (Admin Dashboard)
*   **Manajemen Stok Real-time:** Stok otomatis berkurang saat booking/sewa dan kembali saat retur. Mendukung varian (Warna/Ukuran) dan Paket Bundling.
*   **Manajemen Shift Kasir:** Sistem Buka/Tutup kasir untuk memantau uang fisik di laci dan mencegah kecurangan (fraud).
*   **Bluetooth Thermal Printer:** Cetak struk langsung dari browser (Android/PC) ke printer thermal bluetooth tanpa kabel.
*   **QR Code Scanner:** Scan QR pada nota untuk mempercepat proses pengembalian barang.
*   **Laporan Keuangan:** Grafik pendapatan harian/bulanan, breakdown metode bayar (Cash vs Transfer), dan laporan denda.

---

## 🛠 Teknologi yang Digunakan

*   **Frontend Framework:** React 18 (Vite)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Backend / Database:** Supabase (PostgreSQL, Auth, Storage, Realtime)
*   **AI:** Google Gemini API (`@google/genai`)
*   **Icons:** Lucide React
*   **Hardware Integration:**
    *   Web Bluetooth API (Printer Thermal)
    *   HTML5-QRCode (Camera Scanner)
    *   HTML2Canvas (Generate Image Nota)

---

## 💻 Instalasi & Setup (Developer)

### 1. Clone Repository
```bash
git clone https://github.com/username/mamas-outdoor.git
cd mamas-outdoor
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Buat file `.env` di root folder dan isi dengan kredensial Anda:

```env
# Supabase Configuration (Wajib)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Google Gemini AI (Wajib untuk fitur AI Advisor)
VITE_API_KEY=your-gemini-api-key
```

### 4. Jalankan Server Development
```bash
npm run dev
```
Akses aplikasi di `http://localhost:5173`.

---

## 🗄 Konfigurasi Database (Supabase)

Aplikasi ini membutuhkan struktur tabel tertentu agar berjalan. 

**Cara Cepat Setup Database:**
1.  Jalankan aplikasi secara lokal (`npm run dev`).
2.  Login ke halaman Admin (klik ikon Gembok di Navbar).
    *   *Note: Jika belum bisa login, lihat bagian "Membuat Admin Pertama" di bawah.*
3.  Masuk ke menu **System Setup** (Ikon Gear).
4.  Pilih Tab **Database**.
5.  Copy script SQL yang tersedia dan jalankan di **SQL Editor** pada Dashboard Supabase Anda.

**Urutan Eksekusi Script SQL:**
1.  **Core Tables:** Membuat tabel `products`, `transactions`, `categories`.
2.  **Features:** Membuat tabel `reviews`, `payment_logs`.
3.  **Storage:** Setup bucket untuk upload gambar produk & bukti transfer.
4.  **Advanced:** Setup tabel `stock_logs` dan `shift_logs`.
5.  **User Roles:** Setup tabel role management.

**Membuat Admin Pertama (Manual via Supabase):**
Karena tabel `user_roles` kosong di awal, Anda harus inject manual admin pertama lewat SQL Editor Supabase:

```sql
-- Ganti email dengan email akun Supabase Auth Anda
INSERT INTO public.user_roles (email, role)
VALUES ('email_anda@gmail.com', 'super_admin');
```

---

## 📖 Panduan Operasional (Admin/Staff)

### 1. Memulai Shift (Buka Toko)
*   Login ke Dashboard Admin.
*   Jika Shift belum aktif, klik tombol **"Buka Shift Baru"** di menu Keuangan/Kasir.
*   Input nama kasir dan **Uang Modal** yang ada di laci.

### 2. Transaksi Sewa (Booking Online)
*   Pesanan masuk via WhatsApp.
*   Admin cek ketersediaan di menu **Kalender Sewa**.
*   Buat transaksi baru di menu **Transaksi** atau edit transaksi jika user sudah input data.
*   Ubah status ke **"Lunas (Booked)"** jika DP sudah masuk.

### 3. Pengambilan Barang (Check-in)
*   Cari transaksi berdasarkan Nama.
*   Verifikasi KTP/Identitas.
*   Ubah status ke **"Sedang Disewa (Rented)"**.
*   Cetak Nota Struk atau Kirim Nota Digital via WA.

### 4. Pengembalian Barang (Return)
*   Scan QR Code pada nota pelanggan atau cari nama.
*   Klik tombol **Edit/Lihat**.
*   Cek kondisi barang. Jika ada kerusakan, input denda.
*   Sistem otomatis menghitung keterlambatan. Jika telat, klik **"Terapkan Denda"**.
*   Ubah status ke **"Selesai (Completed)"**. Stok otomatis kembali.

### 5. Menutup Shift (Tutup Toko)
*   Klik **"Tutup Kasir"** di menu Keuangan.
*   Hitung total uang fisik (kertas & koin) di laci. Input ke sistem.
*   Sistem akan menghitung selisih (jika ada uang hilang/lebih) dan total setoran bersih.

---

## 🖨 Integrasi Hardware

### Printer Thermal Bluetooth
*   **Support:** Hanya browser berbasis Chromium (Chrome, Edge, Opera) di Android & PC/Laptop.
*   **Tidak Support:** iOS (iPhone/iPad) karena limitasi Apple pada Web Bluetooth API.
*   **Cara Pakai:**
    1.  Nyalakan Printer & Bluetooth HP/PC.
    2.  Di menu **System Setup** > **Hardware**, klik "Cari Printer".
    3.  Pilih printer (misal: RPP02N, MT-58).
    4.  Setelah terhubung, tombol "Cetak Nota" di transaksi akan langsung mencetak struk.

### Scanner Kamera
*   Menggunakan kamera HP/Webcam laptop.
*   Klik ikon **Kamera** di menu Gudang atau Transaksi untuk scan QR Code nota.

---

## 🚀 Deployment

Aplikasi ini siap dideploy ke **Vercel** atau **Netlify**.

1.  Push kode ke GitHub/GitLab.
2.  Import project di Vercel.
3.  Masukkan Environment Variables (`VITE_SUPABASE_URL`, dll) di setting Vercel.
4.  Deploy!

---

*Dibuat dengan ❤️ untuk Pecinta Alam Indonesia.*
