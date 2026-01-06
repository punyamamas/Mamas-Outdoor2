
import React, { useEffect, useState } from 'react';
import { X, Calendar, Package, Clock, History, CheckCircle, AlertCircle, Loader, Printer, Trash2, RotateCcw, Wallet, Star, Search, Smartphone, Upload, Image as ImageIcon, QrCode } from 'lucide-react';
import { Transaction } from '../types';
import { refreshTransactions, getTransactionsByPhone, uploadPaymentProof } from '../services/transactionService';
import { printInvoice } from '../services/bluetoothPrinterService';
import ReviewModal from './ReviewModal';
import QRCodeModal from './QRCodeModal';
import Toast from './Toast';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<Transaction[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Search History State
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Review Logic
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTrx, setReviewTrx] = useState<Transaction | null>(null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);

  // QR Logic
  const [qrTrx, setQrTrx] = useState<Transaction | null>(null);

  // Upload Logic
  const [isUploading, setIsUploading] = useState<string | null>(null); // Transaction ID yang sedang diupload

  // Load history whenever the drawer opens AND Sync with Database
  useEffect(() => {
    let intervalId: any;

    if (isOpen) {
      loadAndSyncHistory();
      
      // Load local reviewed IDs
      const localReviewed = localStorage.getItem('mamasReviewedIds');
      if (localReviewed) setReviewedIds(JSON.parse(localReviewed));

      // AUTO REFRESH: Setiap 5 detik, cek status terbaru ke server (Polling Sederhana)
      intervalId = setInterval(() => {
        loadAndSyncHistory(true); // true = silent refresh (tanpa loading spinner)
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOpen]);

  const loadAndSyncHistory = async (silent = false) => {
    const savedHistory = localStorage.getItem('mamasHistory');
    if (!savedHistory) {
      if (!silent) setHistory([]);
      return;
    }

    if (!silent) setIsSyncing(true);
    
    try {
      const parsedLocal = JSON.parse(savedHistory) as Transaction[];
      
      // 1. Load Local Data First (Instant Feedback)
      if (!silent) {
        setHistory(parsedLocal.sort((a, b) => new Date(b.rentalDate).getTime() - new Date(a.rentalDate).getTime()));
      }
      
      // 2. Sync WITH SERVER
      const localIds = parsedLocal.map(t => t.id);
      
      if (localIds.length > 0) {
        const result = await refreshTransactions(localIds);
        
        if (result.success) {
          const freshData = result.data;
          const sorted = freshData.sort((a, b) => new Date(b.rentalDate).getTime() - new Date(a.rentalDate).getTime());
          setHistory(sorted);
          localStorage.setItem('mamasHistory', JSON.stringify(sorted));
        }
      }

    } catch (e) {
      console.error("Failed to parse history", e);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const handleSearchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone || searchPhone.length < 8) return alert("Masukkan nomor WA yang valid!");
    
    setIsSearching(true);
    try {
        const foundTransactions = await getTransactionsByPhone(searchPhone);
        
        if (foundTransactions.length === 0) {
            alert("Tidak ditemukan riwayat sewa dengan nomor ini.");
        } else {
            // Merge logic: Tambahkan ke history lokal jika belum ada
            const currentHistory = [...history];
            let addedCount = 0;
            
            foundTransactions.forEach(ft => {
                if (!currentHistory.some(ch => ch.id === ft.id)) {
                    currentHistory.push(ft);
                    addedCount++;
                }
            });
            
            if (addedCount > 0) {
                const sorted = currentHistory.sort((a, b) => new Date(b.rentalDate).getTime() - new Date(a.rentalDate).getTime());
                setHistory(sorted);
                localStorage.setItem('mamasHistory', JSON.stringify(sorted));
                alert(`Berhasil memulihkan ${addedCount} transaksi lama!`);
            } else {
                alert("Semua riwayat sudah ada di list Anda.");
            }
        }
    } catch (err) {
        alert("Gagal mencari data. Coba lagi nanti.");
    } finally {
        setIsSearching(false);
        setSearchPhone('');
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>, trxId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Validasi ukuran (max 5MB)
    if (file.size > 5 * 1024 * 1024) return alert("Ukuran file maksimal 5MB");

    setIsUploading(trxId);
    
    try {
      const url = await uploadPaymentProof(trxId, file);
      if (url) {
        // Update local state immediately
        setHistory(prev => prev.map(t => t.id === trxId ? { ...t, paymentProofUrl: url } : t));
        alert("Bukti transfer berhasil diupload! Tunggu konfirmasi admin.");
      } else {
        alert("Gagal upload. Pastikan internet lancar.");
      }
    } catch (error) {
      console.error(error);
      alert("Error upload proof");
    } finally {
      setIsUploading(null);
    }
  };

  const deleteHistoryItem = (id: string) => {
    if (window.confirm("Hapus riwayat ini dari HP anda? (Data sewa di Admin tetap aman)")) {
      const updatedHistory = history.filter(t => t.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('mamasHistory', JSON.stringify(updatedHistory));
    }
  };

  const handleOpenReview = (trx: Transaction) => {
    setReviewTrx(trx);
    setIsReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    if (reviewTrx) {
        const newIds = [...reviewedIds, reviewTrx.id];
        setReviewedIds(newIds);
        localStorage.setItem('mamasReviewedIds', JSON.stringify(newIds));
        setShowToast(true);
    }
  };

  const getStatusDisplay = (trx: Transaction) => {
    const paid = trx.amountPaid || 0;
    const total = trx.totalPrice;
    
    if (trx.status === 'partial_payment' || (trx.status === 'pending' && paid > 0 && paid < total)) {
       return { label: 'Sudah DP (Belum Lunas)', color: 'bg-orange-100 text-orange-700', icon: Wallet };
    }

    switch(trx.status) {
      case 'pending': return { label: 'Belum Bayar', color: 'bg-red-100 text-red-700', icon: AlertCircle };
      case 'booked': return { label: 'Lunas (Siap Ambil)', color: 'bg-blue-100 text-blue-700', icon: CheckCircle };
      case 'rented': return { label: 'Sedang Disewa', color: 'bg-purple-100 text-purple-700', icon: Package };
      case 'completed': return { label: 'Selesai', color: 'bg-green-100 text-green-700', icon: CheckCircle };
      case 'cancelled': return { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-700', icon: X };
      default: return { label: trx.status, color: 'bg-gray-100 text-gray-700', icon: AlertCircle };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full animate-slide-in-right">
          
          {/* Toast */}
          <Toast message="Terima kasih ulasannya! ⭐" isVisible={showToast} onClose={() => setShowToast(false)} />

          {/* Review Modal */}
          {reviewTrx && (
            <ReviewModal 
              isOpen={isReviewModalOpen} 
              onClose={() => setIsReviewModalOpen(false)}
              transactionId={reviewTrx.id}
              customerName={reviewTrx.customerName}
              onSuccess={handleReviewSuccess}
            />
          )}

          {/* QR Modal */}
          {qrTrx && (
            <QRCodeModal 
              isOpen={!!qrTrx} 
              onClose={() => setQrTrx(null)}
              transaction={qrTrx}
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-nature-50">
            <div className="flex items-center gap-2">
              <History className="text-nature-700" size={24} />
              <h2 className="text-lg font-bold text-gray-900">
                Riwayat Sewa
              </h2>
            </div>
            <div className="flex items-center gap-2">
               <button 
                 onClick={() => loadAndSyncHistory(false)} 
                 className={`p-2 rounded-full hover:bg-white/50 text-nature-600 transition ${isSyncing ? 'animate-spin' : ''}`}
                 title="Refresh Status"
               >
                 <RotateCcw size={20} />
               </button>
               <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                 <X size={24} />
               </button>
            </div>
          </div>

          {/* RESTORE HISTORY SECTION */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
             <form onSubmit={handleSearchHistory} className="relative">
                <Smartphone className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Cek riwayat? Masukkan No WA..." 
                  className="w-full pl-9 pr-20 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-nature-500 outline-none transition bg-white"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
                <button 
                  type="submit"
                  disabled={isSearching || !searchPhone}
                  className="absolute right-1 top-1 bg-nature-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-nature-700 disabled:opacity-50 transition"
                >
                   {isSearching ? <Loader size={14} className="animate-spin"/> : 'Cari'}
                </button>
             </form>
             <p className="text-[10px] text-gray-400 mt-1 italic text-center">Gunakan fitur ini jika ganti HP atau history hilang.</p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
                <div className="bg-white p-4 rounded-full shadow-sm">
                   <Clock size={40} className="text-gray-300" />
                </div>
                <p>Belum ada riwayat penyewaan di perangkat ini.</p>
                <button onClick={onClose} className="text-nature-600 font-medium hover:underline">
                  Mulai petualanganmu sekarang!
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((trx) => {
                  const statusInfo = getStatusDisplay(trx);
                  const StatusIcon = statusInfo.icon;
                  const paid = trx.amountPaid || 0;
                  const total = trx.totalPrice;
                  const percentagePaid = Math.min(100, Math.max(0, (paid / total) * 100));
                  const remaining = Math.max(0, total - paid);
                  const isReviewed = reviewedIds.includes(trx.id);
                  const showUpload = (trx.status === 'pending' || trx.status === 'partial_payment') && remaining > 0;
                  
                  return (
                    <div key={trx.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition relative group">
                      
                      {/* Delete Button (Visible on Hover) */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteHistoryItem(trx.id); }}
                        className="absolute top-2 right-2 p-1.5 bg-white text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition shadow-sm border border-gray-100 opacity-100 sm:opacity-0 group-hover:opacity-100 z-10"
                        title="Hapus riwayat ini"
                      >
                        <Trash2 size={14} />
                      </button>

                      {/* Card Header */}
                      <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                        <div className="text-xs text-gray-500 font-medium">
                          #{trx.id.slice(0, 8)}
                        </div>
                        <div className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wide flex items-center gap-1 ${statusInfo.color}`}>
                          <StatusIcon size={10} /> {statusInfo.label}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Tanggal Sewa</p>
                            <div className="flex items-center gap-1.5 text-gray-800 font-semibold text-sm">
                              <Calendar size={14} className="text-nature-500" />
                              {new Date(trx.rentalDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">Durasi: {trx.duration} Hari</div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 mb-1">Total Biaya</p>
                            <p className="text-adventure-600 font-bold text-lg">Rp{total.toLocaleString('id-ID')}</p>
                          </div>
                        </div>

                        {/* Payment Progress Bar */}
                        <div className="mb-4">
                           <div className="flex justify-between text-[10px] font-bold mb-1">
                              <span className="text-gray-500">Pembayaran ({Math.round(percentagePaid)}%)</span>
                              <span className={remaining > 0 ? "text-red-500" : "text-green-500"}>
                                 {remaining > 0 ? `Kurang: Rp${remaining.toLocaleString('id-ID')}` : "LUNAS"}
                              </span>
                           </div>
                           <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${remaining <= 0 ? 'bg-green-500' : 'bg-orange-400'}`} 
                                style={{ width: `${percentagePaid}%` }}
                              ></div>
                           </div>
                           {paid > 0 && remaining > 0 && (
                              <p className="text-[10px] text-gray-400 mt-1 text-right">Sudah masuk: Rp{paid.toLocaleString('id-ID')}</p>
                           )}
                        </div>

                        {/* UPLOAD BUKTI BAYAR (NEW) */}
                        {showUpload && (
                           <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                              {trx.paymentProofUrl ? (
                                <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2 text-xs font-bold text-green-700">
                                      <CheckCircle size={14} /> Bukti Terkirim
                                   </div>
                                   <a href={trx.paymentProofUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 underline">Lihat</a>
                                </div>
                              ) : (
                                <div>
                                   <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-2 block flex items-center gap-1">
                                      <Upload size={12}/> Upload Bukti Transfer
                                   </label>
                                   <div className="relative">
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => handleUploadProof(e, trx.id)}
                                        className="hidden"
                                        id={`upload-${trx.id}`}
                                        disabled={isUploading === trx.id}
                                      />
                                      <label 
                                        htmlFor={`upload-${trx.id}`}
                                        className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-blue-200 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-100 cursor-pointer transition shadow-sm"
                                      >
                                         {isUploading === trx.id ? (
                                            <><Loader size={12} className="animate-spin"/> Mengupload...</>
                                         ) : (
                                            <><ImageIcon size={14}/> Pilih Gambar</>
                                         )}
                                      </label>
                                   </div>
                                </div>
                              )}
                           </div>
                        )}

                        {/* Items List */}
                        <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-4">
                          {trx.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                              <div className="flex items-center gap-2 text-gray-700">
                                <Package size={14} className="text-gray-400" />
                                <span className="line-clamp-1 max-w-[180px]">{item.name}</span>
                              </div>
                              <span className="font-medium text-gray-500">x{item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          {/* TOMBOL QR CODE (BARU) */}
                          <button 
                            onClick={() => setQrTrx(trx)}
                            className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white font-bold text-xs hover:bg-black transition flex items-center justify-center gap-2"
                          >
                            <QrCode size={14} /> QR Code
                          </button>

                          <button 
                            onClick={() => printInvoice(trx, 'view')}
                            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 hover:text-nature-600 transition flex items-center justify-center gap-2"
                          >
                            <Printer size={14} /> Nota
                          </button>
                          
                          {/* TOMBOL REVIEW (Hanya jika Completed dan Belum Review) */}
                          {trx.status === 'completed' && !isReviewed && (
                            <button 
                              onClick={() => handleOpenReview(trx)}
                              className="flex-1 py-2.5 rounded-lg bg-nature-600 text-white font-bold text-xs hover:bg-nature-700 transition flex items-center justify-center gap-2 shadow-sm animate-pulse"
                            >
                              <Star size={14} className="fill-current" /> Review
                            </button>
                          )}
                          
                          {isReviewed && (
                             <div className="flex-1 py-2.5 rounded-lg bg-green-50 text-green-700 font-bold text-xs border border-green-200 flex items-center justify-center gap-1 opacity-75 cursor-default">
                                <CheckCircle size={14} /> Reviewed
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryDrawer;
