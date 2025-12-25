import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Hilang otomatis setelah 3 detik

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-24 right-4 z-[100] animate-slide-in-right">
      <div className="bg-white/90 backdrop-blur-md border-l-4 border-nature-600 shadow-2xl rounded-lg p-4 flex items-start gap-3 max-w-sm w-full transform transition-all hover:scale-105">
        <div className="flex-shrink-0 text-nature-600 mt-0.5">
          <CheckCircle size={20} fill="currentColor" className="text-white" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-gray-900">Berhasil Ditambahkan!</h4>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{message}</p>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;