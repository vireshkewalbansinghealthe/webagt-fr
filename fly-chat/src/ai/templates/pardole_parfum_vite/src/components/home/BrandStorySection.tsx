import { Link } from 'react-router-dom';

const stats = [
  { number: '200+', label: 'Verschillende parfums' },
  { number: '8+ uur', label: 'Langdurige geurbeleving' },
  { number: '30.000+', label: 'Tevreden klanten' },
];

export default function BrandStorySection() {
  return (
    <section className="py-20 lg:py-28 bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="relative">
            <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: '4/5' }}>
              <img src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=85" alt="Pardole Parfum premium ingredients" className="w-full h-full object-cover" />
              <div className="absolute inset-4 border border-[#C9A96E]/30 pointer-events-none" />
            </div>
            <div className="absolute -bottom-6 -right-4 lg:-right-8 bg-[#1A1714] text-white p-6 w-44">
              <div className="text-3xl font-bold text-[#C9A96E] mb-1" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>30%</div>
              <p className="text-xs text-white/70 leading-tight">Parfumoliën concentratie voor maximale houdbaarheid</p>
            </div>
            <div className="absolute -top-4 -left-4 w-20 h-20 border-l-2 border-t-2 border-[#C9A96E] opacity-60" />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-5"><div className="h-[1px] w-8 bg-[#C9A96E]" /><span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Ons verhaal</span></div>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714] mb-6 leading-tight" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Het premium alternatief voor designer&shy;geuren
            </h2>
            <p className="text-[#6B5E52] leading-relaxed mb-5">
              Bij Pardole Parfum ontdek je geuren met de intensiteit en verfijning van designermerken, maar dan eerlijk geprijsd. Onze parfums worden zorgvuldig samengesteld door meesterparfumeurs, met gebruik van dezelfde hoogwaardige ingrediënten.
            </p>
            <p className="text-[#6B5E52] leading-relaxed mb-10">
              Elke fles bevat tot 30% pure parfumoliën — daarmee overtreffen wij veelal de concentratie van gerenommeerde designerhuizen. Dierproefvrij, langdurig en ontworpen om de hele dag indruk te maken.
            </p>
            <div className="grid grid-cols-3 gap-6 mb-10 py-8 border-y border-[#E8E2DA]">
              {stats.map(({ number, label }) => (
                <div key={label}>
                  <div className="text-2xl lg:text-3xl font-bold text-[#1A1714] mb-1" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{number}</div>
                  <p className="text-xs text-[#8C7B72] leading-snug">{label}</p>
                </div>
              ))}
            </div>
            <Link to="/collectie" className="btn-primary inline-flex">Shop nu</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
