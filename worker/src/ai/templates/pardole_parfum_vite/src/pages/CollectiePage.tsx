import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { products } from '@/lib/data';
import ProductCard from '@/components/ui/ProductCard';

const categories = [
  { id: 'all', label: 'Alles' }, { id: 'dames', label: 'Dames' }, { id: 'heren', label: 'Heren' },
  { id: 'unisex', label: 'Unisex' }, { id: 'niche', label: 'Niche' }, { id: 'extract', label: 'Extract' },
  { id: 'exclusive', label: 'Exclusive' }, { id: 'home-lifestyle', label: 'Home & Lifestyle' },
];
const sortOptions = [
  { id: 'bestselling', label: 'Bestsellers' }, { id: 'price-asc', label: 'Prijs: Laag naar hoog' },
  { id: 'price-desc', label: 'Prijs: Hoog naar laag' }, { id: 'rating', label: 'Hoogst beoordeeld' },
];

export default function CollectiePage() {
  const { category: urlCategory } = useParams<{ category: string }>();
  const [activeCategory, setActiveCategory] = useState(urlCategory || 'all');

  useEffect(() => {
    setActiveCategory(urlCategory || 'all');
  }, [urlCategory]);
  const [sortBy, setSortBy] = useState('bestselling');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [priceMax, setPriceMax] = useState(100);

  const filtered = useMemo(() => {
    let r = [...products];
    if (activeCategory !== 'all') r = r.filter(p => p.category === activeCategory);
    r = r.filter(p => p.price <= priceMax);
    if (sortBy === 'price-asc') r.sort((a, b) => a.price - b.price);
    else if (sortBy === 'price-desc') r.sort((a, b) => b.price - a.price);
    else if (sortBy === 'rating') r.sort((a, b) => b.rating - a.rating);
    else r.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
    return r;
  }, [activeCategory, sortBy, priceMax]);

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="bg-[#1A1714] py-16 lg:py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1541643600914-78b084683702?w=1200&q=60')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="relative max-w-3xl mx-auto px-4">
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase text-[#C9A96E] mb-3">Alle parfums · 2+1 gratis</p>
          <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Onze Collectie</h1>
          <p className="text-white/60 mt-4 text-sm">{products.length}+ premium geïnspireerde parfums — dierproefvrij & eerlijk geprijsd</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="hidden lg:flex gap-0 border-b border-[#E8E2DA]">
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`relative px-5 py-3 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-200 ${activeCategory === cat.id ? 'text-[#1A1714]' : 'text-[#8C7B72] hover:text-[#3D3530]'}`}>
                {cat.label}
                {activeCategory === cat.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#C9A96E]" />}
              </button>
            ))}
          </div>
          <button onClick={() => setMobileFiltersOpen(true)} className="lg:hidden btn-outline text-xs py-2.5 px-4 flex items-center gap-2"><SlidersHorizontal size={14} />Filters</button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8C7B72]">{filtered.length} producten</span>
            <div className="relative">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="appearance-none bg-white border border-[#E8E2DA] text-xs text-[#3D3530] px-4 py-2.5 pr-8 outline-none cursor-pointer hover:border-[#C9A96E] transition-colors">
                {sortOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8C7B72] pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 space-y-8">
              <div>
                <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-4">Categorie</h3>
                <div className="space-y-1">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`w-full text-left text-sm py-2 px-3 transition-all rounded-sm ${activeCategory === cat.id ? 'bg-[#1A1714] text-white font-semibold' : 'text-[#3D3530] hover:bg-[#E8E2DA]'}`}>{cat.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-4">Max. prijs: €{priceMax}</h3>
                <input type="range" min={20} max={100} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} className="w-full accent-[#C9A96E]" />
                <div className="flex justify-between text-xs text-[#8C7B72] mt-1"><span>€20</span><span>€100</span></div>
              </div>
              <div className="bg-[#1A1714] p-4 rounded-sm">
                <p className="text-white text-xs font-bold mb-1">2+1 gratis</p>
                <p className="text-white/60 text-xs leading-relaxed">Voeg 3 artikelen toe — betaal er slechts 2.</p>
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[#8C7B72] text-lg mb-4">Geen producten gevonden</p>
                <button onClick={() => { setActiveCategory('all'); setPriceMax(100); }} className="btn-outline">Filters wissen</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-5">
                {filtered.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 h-14 border-b border-[#E8E2DA]">
              <span className="text-sm font-semibold">Filters</span>
              <button onClick={() => setMobileFiltersOpen(false)}><X size={20} className="text-[#6B5E52]" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[#C9A96E] mb-4">Categorie</h3>
                <div className="space-y-1">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setMobileFiltersOpen(false); }} className={`w-full text-left text-sm py-2.5 px-3 rounded-sm transition-all ${activeCategory === cat.id ? 'bg-[#1A1714] text-white font-semibold' : 'text-[#3D3530] hover:bg-[#FAF8F5]'}`}>{cat.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-semibold tracking-widest uppercase text-[#C9A96E] mb-4">Max. prijs: €{priceMax}</h3>
                <input type="range" min={20} max={100} value={priceMax} onChange={e => setPriceMax(Number(e.target.value))} className="w-full accent-[#C9A96E]" />
              </div>
            </div>
            <div className="p-6 border-t border-[#E8E2DA]">
              <button onClick={() => setMobileFiltersOpen(false)} className="btn-primary w-full justify-center">Resultaten tonen ({filtered.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
