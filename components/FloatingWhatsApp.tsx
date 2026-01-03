
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { getStoreConfig } from '../utils/storeConfig';

const FloatingWhatsApp: React.FC = () => {
  const config = getStoreConfig();
  
  // Format nomor HP (hapus karakter non-digit, pastikan format 62)
  let phone = config.adminWhatsapp.replace(/\D/g, '');
  if (phone.startsWith('0')) {
    phone = '62' + phone.slice(1);
  }

  const message = "Halo Mamas Outdoor, saya mau tanya sewa alat...";
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      // UPDATED: bottom-24 (96px) di mobile agar tidak menutupi BottomNav, bottom-6 di desktop
      className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 group flex items-center justify-end"
      aria-label="Chat WhatsApp Admin"
    >
      {/* Label Tooltip (Muncul saat Hover) - Hanya Desktop */}
      <span className="mr-3 bg-white text-gray-800 px-4 py-2 rounded-xl text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0 hidden sm:block border border-gray-100">
        Chat Admin
      </span>

      {/* Button Circle */}
      <div className="relative">
        {/* Pulse Animation Effect */}
        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20 duration-1000"></div>
        
        <div className="bg-[#25D366] hover:bg-[#20bd5a] text-white p-3 md:p-4 rounded-full shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-12 flex items-center justify-center relative z-10 border-2 border-white">
          <MessageCircle size={28} fill="white" className="text-[#25D366]" />
        </div>

        {/* Notification Badge (Fake) */}
        <span className="absolute -top-1 -right-1 bg-red-500 border-2 border-white text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full z-20 shadow-sm">
          1
        </span>
      </div>
    </a>
  );
};

export default FloatingWhatsApp;
