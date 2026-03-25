import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';

const stores = [
  {
    city: 'Amsterdam', title: 'Pardole Parfum Amsterdam', type: 'Flagship Store',
    description: 'Bezoek onze flagship store in hartje Amsterdam. Hier kun je al onze geuren ruiken, persoonlijk advies krijgen en exclusieve in-store bundles ontdekken.',
    image: '/images/store-amsterdam.png', href: '/winkels/amsterdam',
  },
  {
    city: 'Haarlem', title: 'Pardole Parfum Haarlem', type: 'Boutique',
    description: 'In onze Haarlemse boutique combineren we elegantie met een warme, persoonlijke sfeer. Laat je verrassen door onze bestsellers en proefmonsters.',
    image: '/images/store-haarlem-2.png', href: '/winkels/haarlem',
  },
];

export default function StoresSection() {
  return (
    <section className="py-20 lg:py-28 bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Onze winkels</span>
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
          </div>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Ervaar Pardole in het echt</h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {stores.map(store => (
            <div key={store.city} className="group bg-white overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300">
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img src={store.image} alt={store.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1714]/20 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="bg-[#C9A96E] text-white text-[9px] font-semibold tracking-widest uppercase px-3 py-1.5">{store.type}</span>
                </div>
              </div>
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={13} className="text-[#C9A96E]" />
                  <span className="text-xs text-[#8C7B72] font-medium tracking-wider uppercase">{store.city}</span>
                </div>
                <h3 className="text-xl lg:text-2xl font-bold text-[#1A1714] mb-3" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{store.title}</h3>
                <p className="text-sm text-[#6B5E52] leading-relaxed mb-6">{store.description}</p>
                <Link to={store.href} className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase text-[#1A1714] hover:text-[#C9A96E] transition-colors border-b border-[#1A1714] hover:border-[#C9A96E] pb-0.5">
                  Winkel bezoeken <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
