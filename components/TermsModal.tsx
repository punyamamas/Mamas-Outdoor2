import React from 'react';
import { X, FileText, AlertCircle, Clock, CreditCard, ShieldAlert } from 'lucide-react';

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
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg animate-slide-in-right">
          
          {/* Header */}
          <div className="bg-nature-600 px-6 py-4 flex justify-between items-center">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText size={20} />
              Syarat & Ketentuan Sewa
            </h3>
            <button onClick={onClose} className="text-white/80 hover:text-white transition">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              
              {/* Point 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">1. Jaminan Sewa</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Wajib meninggalkan kartu identitas asli yang masih berlaku (E-KTP / SIM / KTM Asli). Satu identitas berlaku untuk satu nota transaksi.
                  </p>
                </div>
              </div>

              {/* Point 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">2. Durasi & Denda</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Hitungan sewa adalah <strong>24 jam</strong> sejak pengambilan. Keterlambatan pengembalian dikenakan denda sebesar biaya sewa harian per alat.
                  </p>
                </div>
              </div>

              {/* Point 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                    <ShieldAlert size={20} />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">3. Kerusakan & Kehilangan</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Penyewa wajib mengecek kondisi alat saat pengambilan. Kerusakan atau kehilangan selama masa sewa menjadi tanggung jawab penyewa sepenuhnya (ganti barang / uang senilai harga barang).
                  </p>
                </div>
              </div>

              {/* Point 4 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                    <AlertCircle size={20} />
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide">4. Kebersihan</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Alat dikembalikan dalam kondisi kering. Jika kotor berlebih (lumpur basah), akan dikenakan biaya cuci (cleaning fee) mulai Rp 10.000.
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-8 bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
              <p className="text-xs text-gray-500 font-medium italic">
                "Dengan menyewa, Anda dianggap telah membaca dan menyetujui ketentuan di atas."
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-xl bg-nature-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-nature-700 sm:w-auto"
              onClick={onClose}
            >
              Saya Paham, Siap Nanjak!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;