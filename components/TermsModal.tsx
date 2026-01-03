
import React from 'react';
import { X, FileText, AlertCircle, Clock, CreditCard, ShieldAlert, Calendar, UserCheck, Scale, Gavel } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

        {/* Modal Panel */}
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-xl animate-slide-in-right">
          
          {/* Header */}
          <div className="bg-nature-600 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText size={20} />
              Syarat & Ketentuan Sewa
            </h3>
            <button onClick={onClose} className="text-white/80 hover:text-white transition">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-8">
              
              {/* HAL YANG PERLU DIKETAHUI */}
              <div>
                <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                  <AlertCircle size={16} className="text-nature-600"/> Hal Yang Perlu Diketahui
                </h4>
                
                <div className="space-y-4">
                  {/* Poin 1: Harga & Durasi */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Calendar size={16} />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      <p className="font-bold text-gray-800">Hitungan Sewa</p>
                      Harga terhitung mulai <strong>2 hari sewa</strong>. Contoh: Diambil Sabtu, kembali Minggu = 2 hari sewa.
                    </div>
                  </div>

                  {/* Poin 2: Jam Operasional */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                        <Clock size={16} />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      <p className="font-bold text-gray-800">Jam Operasional (08.30 — 22.00)</p>
                      Tidak harus per 24 jam. Kamu bebas ambil & kembali jam berapapun selama di jam operasional.
                      <br/>
                      <span className="text-red-500 font-medium text-xs italic">*Tidak melayani di luar jam operasional.</span>
                    </div>
                  </div>

                  {/* Poin 3: Denda & Refund */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                        <Scale size={16} />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      <p className="font-bold text-gray-800">Denda & Refund</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Terlambat mengembalikan dianggap menambah hari sewa.</li>
                        <li>Alat yang sudah dibawa tetap terhitung sewa meski tidak terpakai.</li>
                        <li>Uang tidak bisa direfund walaupun alat dikembalikan sebelum jadwal.</li>
                      </ul>
                    </div>
                  </div>

                  {/* Poin 4: Booking & Kerusakan */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                        <ShieldAlert size={16} />
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed">
                      <p className="font-bold text-gray-800">Booking & Tanggung Jawab</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Pilih warna/merk/model dilayani <strong>H-3</strong>. Sebelum H-3 hanya booking alat/size.</li>
                        <li>Alat yang sudah dipilih saat hari H <strong>tidak bisa ditukar/dibatalkan</strong>.</li>
                        <li className="font-bold text-red-600">Kerusakan & kehilangan menjadi tanggung jawab penyewa.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* APA SAJA YANG DIBUTUHKAN */}
              <div>
                <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                  <UserCheck size={16} className="text-nature-600"/> Syarat Jaminan (Wajib Asli)
                </h4>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4 text-sm">
                  <div>
                    <span className="font-bold text-gray-800 block mb-1">🎓 Pelajar / Mahasiswa</span>
                    Kartu OSIS / Kartu Tanda Mahasiswa (KTM) dari sekolah/kampus di Banyumas.
                  </div>
                  <div>
                    <span className="font-bold text-gray-800 block mb-1">🏢 Umum</span>
                    SIM/KTP (2 orang berbeda) <strong>ATAU</strong> KTP + Uang Jaminan senilai harga sewa.
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-red-100 text-red-600 text-xs font-bold flex gap-2 items-start">
                    <AlertCircle size={14} className="mt-0.5 shrink-0"/>
                    Pemilik identitas jaminan WAJIB HADIR ke basecamp saat pengambilan & tidak dapat diwakilkan.
                  </div>
                </div>
              </div>

              {/* LEGAL */}
              <div className="text-center space-y-2 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Poin-poin di atas adalah kesepakatan mutlak. Segala bentuk penipuan akan dilaporkan ke pihak berwajib <Gavel size={12} className="inline"/>.
                </p>
                <p className="text-xs text-gray-500">
                  Kurang jelas? Hubungi admin Mamas Outdoor.
                </p>
                <div className="bg-nature-50 text-nature-800 p-2 rounded-lg text-xs font-bold">
                  Menyewa berarti SEPAKAT dengan semua syarat & ketentuan di atas.
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse shadow-inner">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-xl bg-nature-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:bg-nature-700 hover:scale-[1.02] transition-all sm:w-auto"
              onClick={onClose}
            >
              Saya Mengerti & Sepakat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
