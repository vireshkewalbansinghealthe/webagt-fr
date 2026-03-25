import { Clock, Droplets, Leaf, Users, Package, Award } from 'lucide-react';

const usps = [
  { icon: Clock, title: '8+ uur ruikbaar', text: 'Langdurige geurbeleving dankzij hoogwaardige parfumoliën tot 30%.' },
  { icon: Droplets, title: 'Premium ingrediënten', text: 'Zorgvuldig samengestelde formules met de fijnste grondstoffen.' },
  { icon: Leaf, title: 'Dierproefvrij', text: '100% cruelty-free — geen dierproeven, altijd en zonder compromis.' },
  { icon: Users, title: '30.000+ klanten', text: 'Een groeiende community van parfumliefhebbers door heel Europa.' },
  { icon: Package, title: 'Gratis verzending v/a €50', text: 'Snel geleverd, mooi verpakt. Voor 17:30 besteld, morgen in huis.' },
  { icon: Award, title: 'Eerlijk geprijsd', text: 'Designerkwaliteit zonder het designerprijskaartje. Altijd €24,95.' },
];

export default function USPSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Waarom Pardole</span>
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
          </div>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Kwaliteit zonder concessies</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-[#E8E2DA]">
          {usps.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white p-8 lg:p-10 flex flex-col items-start gap-4 group hover:bg-[#FAF8F5] transition-colors duration-200">
              <div className="w-12 h-12 rounded-full bg-[#FAF8F5] group-hover:bg-white border border-[#E8E2DA] flex items-center justify-center transition-colors">
                <Icon size={20} className="text-[#C9A96E]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1A1714] mb-1.5 tracking-wide">{title}</h3>
                <p className="text-sm text-[#6B5E52] leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
