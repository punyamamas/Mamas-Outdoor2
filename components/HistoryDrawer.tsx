import React, { useEffect, useState } from 'react';
import { X, Calendar, Package, Clock, History } from 'lucide-react';
import { Transaction } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<Transaction[]>([]);

  // Load history whenever the drawer opens
  useEffect(() => {
    if (isOpen) {
      const savedHistory = localStorage.getItem('mamasHistory');
      if (savedHistory) {
        try {
          // Sort by date descending (newest first)
          const parsed = JSON.parse(savedHistory) as Transaction[];
          setHistory(parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (e) {
          console.error("Failed to parse history", e);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-md bg-white shadow-xl flex flex-col h-full animate-slide-in-right">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-nature-50">
            <div className="flex items-center gap-2">
              <History className="text-nature-700" size={24} />
              <h2 className="text-lg font-bold text-gray-900">Riwayat Sewa</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
                <div className="bg-white p-4 rounded-full shadow-sm">
                   <Clock size={40} className="text-gray-300" />
                </div>
                <p>Belum ada riwayat penyewaan.</p>
                <button onClick={onClose} className="text-nature-600 font-medium hover:underline">
                  Mulai petualanganmu sekarang!
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((trx) => (
                  <div key={trx.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
                    {/* Card Header */}
                    <div className="px-5 py-3 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                      <div className="text-xs text-gray-500 font-medium">
                        Order ID: #{trx.id.slice(0, 8)}
                      </div>
                      <div className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded-full tracking-wide">
                        WhatsApp Sent
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
                          <p className="text-adventure-600 font-bold text-lg">Rp{trx.totalPrice.toLocaleString('id-ID')}</p>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryDrawer;