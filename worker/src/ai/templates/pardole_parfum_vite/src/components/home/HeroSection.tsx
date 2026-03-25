import { Link } from 'react-router-dom';
import { ArrowRight, Check, Package, Clock, CreditCard, Leaf } from 'lucide-react';

const trustBadges = [
  { icon: Package, text: 'Gratis verzending v/a €50' },
  { icon: Clock, text: 'Voor 17:30 morgen in huis' },
  { icon: CreditCard, text: 'Achteraf betalen – Klarna' },
  { icon: Leaf, text: 'Dierproefvrij' },
];

export default function HeroSection() {
  return (
    <section className="relative flex items-center overflow-hidden bg-[#1A1714]" style={{ minHeight: '92vh' }}>
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url('/images/hero-bg.png')` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1714]/85 via-[#1A1714]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1714]/40 via-transparent to-transparent" />
      </div>
      <div className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-gradient-to-b from-transparent via-[#C9A96E] to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 w-full pt-8 pb-16">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-8 animate-fade-in-up">
            <div className="h-[1px] w-10 bg-[#C9A96E]" />
            <span className="text-[#C9A96E] text-[10px] font-semibold tracking-[0.3em] uppercase">Premium Inspired Fragrances</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-6 animate-fade-in-up" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Het premium<br /><span className="italic text-[#C9A96E]">alternatief</span><br />voor designer&shy;geuren
          </h1>
          <p className="text-white/70 text-base lg:text-lg leading-relaxed mb-8 max-w-lg animate-fade-in-up">
            Ontdek geuren met de intensiteit van designermerken, maar eerlijk geprijsd. Dierproefvrij, 8+ uur ruikbaar en met hoogwaardige parfumoliën tot 30%.
          </p>
          <div className="flex flex-wrap gap-4 mb-10 animate-fade-in-up">
            {['8+ uur ruikbaar', 'Alle parfums 2+1 gratis', 'Premium ingrediënten'].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#C9A96E] flex items-center justify-center flex-shrink-0"><Check size={11} className="text-white" /></div>
                <span className="text-white/85 text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-14 animate-fade-in-up">
            <Link to="/collectie" className="inline-flex items-center gap-3 bg-[#C9A96E] text-white px-8 py-4 text-xs font-semibold tracking-[0.15em] uppercase hover:bg-[#DFC08A] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              Shop nu <ArrowRight size={14} />
            </Link>
            <a href="#bestsellers" className="inline-flex items-center gap-2 text-white/80 text-xs font-semibold tracking-[0.15em] uppercase hover:text-white transition-colors border-b border-white/30 hover:border-white pb-0.5">
              Bekijk bestsellers
            </a>
          </div>
          <div className="flex items-center gap-3 animate-fade-in-up">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-[#F59E0B] fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white/70 text-xs"><strong className="text-white">Uitstekend</strong> · 30.000+ tevreden klanten</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
            {trustBadges.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center justify-center gap-2.5 py-3.5 px-4">
                <Icon size={14} className="text-[#C9A96E] flex-shrink-0" />
                <span className="text-white/80 text-[11px] font-medium tracking-wide">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
