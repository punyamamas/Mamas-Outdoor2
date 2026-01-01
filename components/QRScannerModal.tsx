
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, AlertCircle, Camera, Loader2 } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setErrorMsg('');
      
      // Delay sedikit untuk memastikan modal sudah render di DOM
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  const startScanner = async () => {
    // Pastikan elemen ada
    if (!document.getElementById('reader')) return;

    // Bersihkan instance lama jika ada (safety check)
    if (scannerRef.current) {
        await stopScanner();
    }

    try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
        };

        // Menggunakan "environment" agar otomatis pakai kamera belakang
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Success callback
                if (isRunningRef.current) {
                    onScanSuccess(decodedText);
                    stopScanner();
                }
            },
            (errorMessage) => {
                // Ignore scanning errors (biasa terjadi saat mencari QR)
            }
        );
        
        isRunningRef.current = true;
        setIsLoading(false);

    } catch (err) {
        console.error("Gagal memulai kamera:", err);
        setErrorMsg("Gagal mengakses kamera. Pastikan izin diberikan di browser.");
        setIsLoading(false);
    }
  };

  const stopScanner = async () => {
    isRunningRef.current = false;
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        console.warn("Error stopping scanner", e);
      }
      scannerRef.current = null;
    }
  };

  const handleClose = () => {
      stopScanner();
      onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-black rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-gray-800">
        
        {/* Header */}
        <div className="bg-nature-900/80 backdrop-blur-md p-4 flex justify-between items-center text-white absolute top-0 left-0 right-0 z-20">
           <h3 className="font-bold flex items-center gap-2"><Camera size={18}/> Scan QR Transaksi</h3>
           <button onClick={handleClose} className="p-1 hover:bg-white/20 rounded-full transition"><X size={20}/></button>
        </div>
        
        {/* Camera Area */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center min-h-[400px]">
           
           {/* Scanner Container */}
           <div id="reader" className="w-full h-full overflow-hidden"></div>

           {/* Loading State */}
           {isLoading && !errorMsg && (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10 bg-black/50">
                <Loader2 className="animate-spin mb-2" size={32} />
                <p className="text-xs">Menyiapkan kamera...</p>
             </div>
           )}

           {/* Error State */}
           {errorMsg && (
               <div className="absolute inset-0 z-30 flex items-center justify-center p-6 bg-black">
                   <div className="text-white text-center">
                       <AlertCircle className="mx-auto mb-3 text-red-500" size={40} />
                       <p className="text-sm font-medium mb-4">{errorMsg}</p>
                       <button onClick={handleClose} className="px-5 py-2 bg-white text-black rounded-full font-bold text-sm hover:bg-gray-200 transition">
                         Tutup
                       </button>
                   </div>
               </div>
           )}

           {/* Overlay Visuals (Reticle) */}
           {!isLoading && !errorMsg && (
             <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                {/* Kotak Fokus */}
                <div className="w-64 h-64 border-2 border-nature-500/50 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    {/* Sudut-sudut */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-nature-500 -mt-1 -ml-1 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-nature-500 -mt-1 -mr-1 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-nature-500 -mb-1 -ml-1 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-nature-500 -mb-1 -mr-1 rounded-br-lg"></div>
                    
                    {/* Laser Scan Animation */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_red] animate-[scan_2s_infinite_linear]"></div>
                </div>
                <p className="absolute bottom-10 text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full">
                   Arahkan kamera ke QR Code
                </p>
             </div>
           )}
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        /* Hide default html5-qrcode elements if any leak through */
        #reader video { object-fit: cover; width: 100% !important; height: 100% !important; }
      `}</style>
    </div>
  );
};

export default QRScannerModal;
