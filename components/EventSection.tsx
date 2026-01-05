
import React from 'react';
import { Calendar, MapPin, Users, ArrowRight, Mountain, Flame } from 'lucide-react';
import { getStoreConfig } from '../utils/storeConfig';

const EventSection: React.FC = () => {
  const config = getStoreConfig();

  const events = [
    {
      id: 1,
      title: "Tek-Tok Summit Slamet via Bambangan",
      date: "Minggu, 25 Juni 2024",
      price: 350000,
      location: "Gn. Slamet, Purbalingga",
      difficulty: "Hard",
      slots: 5,
      image: "https://images.unsplash.com/photo-1650634629471-a4675765954a?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: 2,
      title: "Camp Ceria & Sunrise Prau",
      date: "Sabtu-Minggu, 1-2 Juli 2024",
      price: 185000,
      location: "Gn. Prau via Patak Banteng",
      difficulty: "Easy",
      slots: 12,
      image: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: 3,
      title: "Workshop Navigasi Darat & Survival",
      date: "Sabtu, 15 Juli 2024",
      price: 50000,
      location: "Hutan Pinus Limpakuwus",
      difficulty: "Beginner",
      slots: 20,
      image: "https://images.unsplash.com/photo-1533240332313-0dbdd31c99a3?q=80&w=1000&auto=format&fit=crop"
    }
  ];

  const handleJoin = (eventTitle: string) => {
    let phone = config.adminWhatsapp.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.slice(1);
    const msg = `Halo Admin Mamas Outdoor, saya mau daftar event: *${eventTitle}*. Masih ada slot?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <section id="event" className="py-16 bg-white scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-4">
          <div>
            <span className="text-nature-600 font-black tracking-widest uppercase text-xs md:text-sm mb-2 block flex items-center gap-2">
              <Flame size={16} /> INFO KEGIATAN
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
              Open Trip & Event
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl">
              Gabung pendakian bareng Mamas Outdoor. Tambah teman, tambah pengalaman, budget mahasiswa!
            </p>
          </div>
          <button className="hidden md:flex items-center gap-2 text-nature-600 font-bold hover:text-nature-700 transition">
            Lihat Semua Jadwal <ArrowRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((evt) => (
            <div key={evt.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full hover:-translate-y-1">
              <div className="relative h-48 overflow-hidden">
                <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
                <img 
                  src={evt.image} 
                  alt={evt.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 relative z-10"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 z-20 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm">
                  Sisa {evt.slots} Slot
                </div>
                <div className="absolute bottom-3 left-3 z-20 flex gap-2">
                   <span className={`px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm ${
                     evt.difficulty === 'Hard' ? 'bg-red-500' : evt.difficulty === 'Easy' ? 'bg-green-500' : 'bg-blue-500'
                   }`}>
                     {evt.difficulty}
                   </span>
                </div>
              </div>
              
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                  <Calendar size={14} /> {evt.date}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-tight group-hover:text-nature-600 transition">
                  {evt.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <MapPin size={16} className="text-gray-300" /> {evt.location}
                </div>
                
                <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Harga / Pax</p>
                    <p className="text-lg font-black text-nature-700">Rp{evt.price.toLocaleString('id-ID')}</p>
                  </div>
                  <button 
                    onClick={() => handleJoin(evt.title)}
                    className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-nature-600 transition shadow-lg flex items-center gap-2"
                  >
                    Daftar <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 text-center md:hidden">
           <button className="inline-flex items-center gap-2 text-nature-600 font-bold hover:text-nature-700 transition bg-nature-50 px-6 py-3 rounded-xl w-full justify-center">
            Lihat Semua Jadwal <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default EventSection;
