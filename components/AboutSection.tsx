
import React from 'react';
import { CheckCircle, MapPin, Instagram } from 'lucide-react';
import ImageLoader from './ImageLoader';

const AboutSection: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          
          {/* Left: Image Composition */}
          <div className="w-full lg:w-1/2 relative">
            <div className="relative h-[300px] md:h-[450px] w-full rounded-3xl overflow-hidden shadow-2xl">
              {/* Updated Image URL to a reliable Unsplash source */}
              <ImageLoader 
                src="https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1080&q=80" 
                alt="Basecamp Mamas Outdoor" 
                className="w-full h-full object-cover transform hover:scale-105 transition duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <p className="font-bold text-lg">Basecamp Grendeng</p>
                <p className="text-sm text-gray-200">Siap melayani 08.30 - 22.00 WIB</p>
              </div>
            </div>
            
            {/* Floating Badge */}
            <div className="absolute -bottom-6 -right-6 md:bottom-10 md:-right-10 bg-white p-4 md:p-6 rounded-2xl shadow-xl border border-gray-100 max-w-[200px] hidden sm:block animate-float">
              <p className="text-3xl font-black text-nature-600">5+ Thn</p>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mt-1">Pengalaman Melayani Pendaki</p>
            </div>
          </div>

          {/* Right: Content */}
          <div className="w-full lg:w-1/2 space-y-6">
            <div>
              <span className="text-nature-600 font-black tracking-widest uppercase text-xs md:text-sm mb-2 block">
                TENTANG MAMAS OUTDOOR
              </span>
              <h2 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight">
                Lebih Dari Sekadar <br/> <span className="text-nature-600">Tempat Sewa.</span>
              </h2>
            </div>

            <div className="prose prose-lg text-gray-600 text-sm md:text-base leading-relaxed">
              <p>
                Berawal dari hobi mendaki, <strong>Mamas Outdoor</strong> hadir untuk memfasilitasi teman-teman mahasiswa dan pegiat alam di Purwokerto yang ingin menikmati keindahan Gunung Slamet, Prau, Sindoro, dan Sumbing tanpa harus pusing memikirkan mahalnya harga peralatan.
              </p>
              <p>
                Kami berkomitmen menyediakan alat <strong>branded, bersih, dan aman</strong>. Karena kami tahu, peralatan yang baik adalah kunci keselamatan di gunung.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-nature-600 shrink-0" size={20} />
                <span className="font-bold text-gray-700">Koleksi Tenda & Carrier Terlengkap</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="text-nature-600 shrink-0" size={20} />
                <span className="font-bold text-gray-700">Garansi Alat Bersih & Wangi</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="text-nature-600 shrink-0" size={20} />
                <span className="font-bold text-gray-700">Konsultasi Pendakian Gratis</span>
              </div>
            </div>

            <div className="pt-4 flex gap-4">
               <a 
                 href="https://maps.google.com/?q=Mamas+Outdoor+Purwokerto" 
                 target="_blank"
                 className="px-6 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition flex items-center gap-2 shadow-lg"
               >
                 <MapPin size={18} /> Lokasi Gmaps
               </a>
               <a 
                 href="https://www.instagram.com/mamas.outdoor/" 
                 target="_blank"
                 className="px-6 py-3 bg-white text-gray-900 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition flex items-center gap-2"
               >
                 <Instagram size={18} /> @mamas.outdoor
               </a>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default AboutSection;
