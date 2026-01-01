
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Download, ShieldCheck, User } from 'lucide-react';
import { Transaction } from '../types';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, transaction }) => {
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (transaction && isOpen) {
      generateQR(transaction.id);
    }
  }, [transaction, isOpen]);

  const generateQR = async (text: string) => {
    try {
      const url = await QRCode.toDataURL(text, { width: 400, margin: 2 });
      setQrUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl animate-float">
        {/* Ticket Header */}
        <div className="bg-nature-600 p-6 text-center text-white relative overflow-hidden">
           <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '10px 10px'}}></div>
           <h3 className="text-xl font-black uppercase tracking-widest relative z-10">Mamas Pass</h3>
           <p className="text-xs text-nature-200 mt-1 relative z-10">Tunjukkan ke Admin saat Ambil/Kembali</p>
           <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white"><X size={24}/></button>
        </div>

        {/* QR Body */}
        <div className="p-8 flex flex-col items-center bg-white relative">
           {/* Perforated Line Effect */}
           <div className="absolute -top-3 left-0 w-full h-6 flex justify-between px-2">
              {[...Array(12)].map((_,i) => <div key={i} className="w-4 h-4 bg-nature-600 rounded-full"></div>)}
           </div>

           <div className="w-full flex justify-between items-center mb-6 border-b border-dashed border-gray-200 pb-4">
              <div>
                 <p className="text-[10px] text-gray-400 uppercase font-bold">Pelanggan</p>
                 <p className="font-bold text-gray-800 text-sm flex items-center gap-1"><User size={12}/> {transaction.customerName.split(' ')[0]}</p>
              </div>
              <div className="text-right">
                 <p className="text-[10px] text-gray-400 uppercase font-bold">ID Transaksi</p>
                 <p className="font-mono text-sm font-bold text-nature-600">#{transaction.id.slice(0,6)}</p>
              </div>
           </div>

           <div className="p-3 bg-white border-2 border-gray-900 rounded-xl shadow-lg mb-4">
              {qrUrl ? (
                <img src={qrUrl} alt="QR Code" className="w-48 h-48 object-contain" />
              ) : (
                <div className="w-48 h-48 bg-gray-100 animate-pulse rounded-lg"></div>
              )}
           </div>
           
           <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full text-xs font-bold border border-green-100">
              <ShieldCheck size={14} /> Transaksi Valid
           </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-gray-50 border-t border-gray-100">
           <a 
             href={qrUrl} 
             download={`MamasTicket-${transaction.id.slice(0,6)}.png`}
             className="flex items-center justify-center gap-2 w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-xl transition"
           >
              <Download size={18} /> Simpan Gambar
           </a>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
