import React from 'react';
import { ShieldCheck, Clock, MapPin, Wallet, Sparkles } from 'lucide-react';

const WhyChooseUs: React.FC = () => {
  const features = [
    {
      icon: <ShieldCheck size={32} className="text-nature-600" />,
      title: "Alat Terawat & Bersih",
      desc: "Setiap alat dicuci dan dicek fungsinya setelah disewa. Jaminan alat wangi dan siap pakai naik gunung."
    },
    {
      icon: <Wallet size={32} className="text-nature-600" />,
      title: "Harga Mahasiswa",
      desc: "Tarif sewa sangat bersahabat untuk kantong mahasiswa Purwokerto. Banyak diskon untuk penyewaan kelompok."
    },
    {
      icon: <Clock size={32} className="text-nature-600" />,
      title: "Durasi Fleksibel",
      desc: "Sewa dihitung per 2 hari (bukan 24 jam). Ambil pagi, kembalikan malam besoknya tetap dihitung standar."
    },
    {
      icon: <MapPin size={32} className="text-nature-600" />,
      title: "Lokasi Strategis",
      desc: "Basecamp di Grendeng, sangat dekat dengan kampus UNSOED. Mudah dijangkau dan parkir luas."
    }
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-nature-50 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-12">
          <span className="text-nature-600 font-black tracking-widest uppercase text-xs md:text-sm mb-2 block flex items-center justify-center gap-2">
            <Sparkles size={14}/> KENAPA HARUS MAMAS?
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900">
            Partner Terbaik Petualanganmu
          </h2>
          <p className="text-gray-500 mt-3 max-w-2xl mx-auto">
            Kami mengerti kebutuhan pendaki. Bukan sekadar sewa, tapi memastikan keamanan dan kenyamananmu di alam bebas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, idx) => (
            <div 
              key={idx} 
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group hover:-translate-y-1"
            >
              <div className="w-14 h-14 bg-nature-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-nature-600 group-hover:text-white transition-colors duration-300">
                {/* Clone element to change color on hover if needed, or rely on CSS */}
                <div className="group-hover:text-white transition-colors">
                  {feature.icon}
                </div>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;