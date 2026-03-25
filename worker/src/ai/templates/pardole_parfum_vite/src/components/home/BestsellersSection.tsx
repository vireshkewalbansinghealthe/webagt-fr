import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { products } from '@/lib/data';
import ProductCard from '@/components/ui/ProductCard';

const tabs = [{ id: 'dames', label: 'Dames' }, { id: 'heren', label: 'Heren' }, { id: 'unisex', label: 'Unisex' }, { id: 'niche', label: 'Niche' }];

export default function BestsellersSection() {
  const [activeTab, setActiveTab] = useState('dames');
  const filtered = products.filter(p => p.category === activeTab).slice(0, 4);

  return (
    <section id="bestsellers" className="py-20 lg:py-28 bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-6">
          <div>
            <div className="flex items-center gap-3 mb-3"><div className="h-[1px] w-8 bg-[#C9A96E]" /><span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Top picks</span></div>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Onze Bestsellers</h2>
          </div>
          <Link to="/collectie" className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase text-[#6B5E52] hover:text-[#C9A96E] transition-colors border-b border-[#E8E2DA] hover:border-[#C9A96E] pb-0.5">
            Bekijk alles <ArrowRight size={13} />
          </Link>
        </div>

        <div className="flex gap-0 mb-10 border-b border-[#E8E2DA]">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`relative px-5 py-3 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${activeTab === tab.id ? 'text-[#1A1714]' : 'text-[#8C7B72] hover:text-[#3D3530]'}`}>
              {tab.label}
              {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A96E]" />}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {filtered.map(p => <ProductCard key={p.id} product={p} />)}
        </div>

        <div className="mt-12 bg-[#1A1714] rounded-sm p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E] mb-2">Speciale actie</p>
            <h3 className="text-xl lg:text-2xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Alle parfums 2+1 gratis</h3>
            <p className="text-white/60 text-sm mt-1">Voeg 3 parfums toe — betaal er slechts 2. Automatisch berekend.</p>
          </div>
          <Link to="/collectie" className="btn-gold whitespace-nowrap flex-shrink-0">Profiteer nu</Link>
        </div>
      </div>
    </section>
  );
}
