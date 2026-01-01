
import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, AlertCircle } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Tunggu DOM render
      const timer = setTimeout(() => {
        initializeScanner();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      cleanupScanner();
    }
  }, [isOpen]);

  const initializeScanner = () => {
    // Pastikan elemen ada
    if (!document.getElementById('reader')) return;

    // Bersihkan instance lama jika ada (safety)
    if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
    }

    try {
        const scanner = new Html5QrcodeScanner(
            "reader",
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
            },
            false
        );
        
        scanner.render(
            (decodedText) => {
                cleanupScanner();
                onScanSuccess(decodedText);
            },
            (errorMessage) => {
                // Ignore errors mostly
            }
        );
        scannerRef.current = scanner;
    } catch (e) {
        console.error("Scanner Error", e);
        setErrorMsg("Gagal mengakses kamera. Pastikan izin diberikan.");
    }
  };

  const cleanupScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch((error) => console.error("Failed to clear scanner", error));
      scannerRef.current = null;
    }
  };

  const handleClose = () => {
      cleanupScanner();
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="bg-nature-900 p-4 flex justify-between items-center text-white">
           <h3 className="font-bold">Scan QR Transaksi</h3>
           <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-full transition"><X size={20}/></button>
        </div>
        
        <div className="p-4 bg-black flex-1 flex flex-col items-center justify-center min-h-[300px]">
           {errorMsg ? (
               <div className="text-white text-center p-4">
                   <AlertCircle className="mx-auto mb-2 text-red-500" size={32} />
                   <p>{errorMsg}</p>
                   <button onClick={handleClose} className="mt-4 px-4 py-2 bg-white text-black rounded font-bold">Tutup</button>
               </div>
           ) : (
               <div id="reader" className="w-full h-full border-none"></div>
           )}
        </div>

        <div className="p-4 text-center text-sm text-gray-500 bg-white">
           Arahkan kamera ke QR Code pelanggan.
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
