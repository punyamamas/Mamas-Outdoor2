import React from 'react';
import { MapPin, Phone, Instagram, Facebook, Mail, Clock, Mountain } from 'lucide-react';
import { getStoreConfig } from '../utils/storeConfig';

const Footer: React.FC = () => {
  const storeConfig = getStoreConfig();

  return (
    <footer id="contact" className="bg-gray-900 text-white pt-16 pb-28 md:pb-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <img src="https://imgur.com/iC8ycHT.png" alt="Logo" className="w-8 h-8 grayscale brightness-200" />
              <span className="text-xl font-black tracking-tight text-white">Mamas<span className="text-nature-500">Outdoor</span></span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Penyedia layanan sewa peralatan camping dan outdoor nomor 1 di Purwokerto. Sahabat terbaik untuk petualanganmu.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-nature-600 transition text-gray-400 hover:text-white"><Instagram size={18}/></a>
              <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-nature-600 transition text-gray-400 hover:text-white"><Facebook size={18}/></a>
              <a href="#" className="p-2 bg-gray-800 rounded-lg hover:bg-nature-600 transition text-gray-400 hover:text-white"><Mail size={18}/></a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Navigasi</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-nature-400 transition flex items-center gap-2"><Mountain size={14}/> Beranda</a></li>
              <li><a href="#katalog" className="hover:text-nature-400 transition flex items-center gap-2"><Mountain size={14}/> Katalog Alat</a></li>
              <li><a href="#event" className="hover:text-nature-400 transition flex items-center gap-2"><Mountain size={14}/> Event & Trip</a></li>
              <li><a href="#ai-guide" className="hover:text-nature-400 transition flex items-center gap-2"><Mountain size={14}/> Tanya AI</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold mb-6 text-white">Hubungi Kami</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li className="flex gap-3 items-start">
                <MapPin className="flex-shrink-0 text-nature-500 mt-1" size={18} />
                <span className="leading-relaxed">{storeConfig.storeAddress}</span>
              </li>
              <li className="flex gap-3 items-center">
                <Phone className="flex-shrink-0 text-nature-500" size={18} />
                <span className="font-mono font-bold tracking-wide">{storeConfig.adminWhatsapp}</span>
              </li>
              <li className="flex gap-3 items-center text-yellow-500 font-bold bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
                <Clock className="flex-shrink-0" size={18} />
                <span>Buka: 08.30 - 22.00 WIB</span>
              </li>
            </ul>
          </div>

          {/* Map Embed (Optional placeholder) */}
          <div className="rounded-xl overflow-hidden h-40 bg-gray-800 relative group">
             <div className="absolute inset-0 flex items-center justify-center bg-gray-800 group-hover:bg-gray-700 transition">
                <a 
                  href="https://maps.google.com/?q=Mamas+Outdoor+Purwokerto" 
                  target="_blank"
                  className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-white transition"
                >
                   <MapPin size={32} />
                   <span className="text-xs font-bold">Buka di Google Maps</span>
                </a>
             </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 text-center flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Mamas Outdoor Purwokerto. All rights reserved.</p>
          <p className="flex items-center gap-1">Made with <span className="text-red-500">♥</span> for Hikers</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;