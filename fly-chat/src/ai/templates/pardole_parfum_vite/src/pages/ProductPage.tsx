import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag, Heart, Check, ChevronDown, ChevronUp, Truck, CreditCard, Gift, Clock, Shield, Star, ArrowRight } from 'lucide-react';
import { products } from '@/lib/data';
import { useCart } from '@/components/CartContext';
import ProductCard from '@/components/ui/ProductCard';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();
  const product = products.find(p => p.id === id);
  const [quantity, setQuantity] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
      <div className="text-center">
        <p className="text-[#6B5E52] mb-4">Product niet gevonden</p>
        <Link to="/collectie" className="btn-primary">Terug naar collectie</Link>
      </div>
    </div>
  );

  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);

  const handleAdd = () => {
    setAdding(true);
    for (let i = 0; i < quantity; i++) addItem(product);
    setTimeout(() => setAdding(false), 1500);
  };

  const faqs = [
    { q: 'Hoe lang houdt dit parfum?', a: `${product.name} is ontworpen voor een houdbaarheid van ${product.longevity}.` },
    { q: 'Is dit parfum dierproefvrij?', a: 'Ja, al onze parfums zijn 100% dierproefvrij (cruelty-free).' },
    { q: 'Wat is de concentratie parfumoliën?', a: 'Onze parfums bevatten tot 30% pure parfumoliën.' },
    { q: 'Hoe werkt de 2+1 aanbieding?', a: 'Voeg 3 of meer parfums toe — het goedkoopste artikel is automatisch gratis.' },
    { q: 'Kan ik retourneren?', a: 'Je kunt binnen 30 dagen retourneren als het product ongebruikt en ongeopend is.' },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="border-b border-[#E8E2DA] bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-2 text-xs text-[#8C7B72]">
          <Link to="/" className="hover:text-[#C9A96E] transition-colors">Home</Link>
          <span>/</span>
          <Link to="/collectie" className="hover:text-[#C9A96E] transition-colors">Collectie</Link>
          <span>/</span>
          <span className="text-[#1A1714] font-medium">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div className="space-y-4">
            <div className="relative overflow-hidden bg-[#F0EBE3] rounded-sm" style={{ aspectRatio: '4/5' }}>
              {product.image ? (
                <img src={product.image} alt={product.name} className={`w-full h-full ${product.image.startsWith('/') ? 'object-contain p-6' : 'object-cover'}`} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <span className="text-7xl font-bold text-[#D8D0C8]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{product.name}</span>
                  <span className="text-xs tracking-widest text-[#C8BCB4] mt-3 uppercase">Eau de Parfum · {product.size}</span>
                </div>
              )}
              {product.isBestseller && <div className="absolute top-5 left-5"><span className="bg-[#1A1714] text-white text-[9px] font-semibold tracking-widest uppercase px-3 py-1.5">Bestseller</span></div>}
              <button onClick={() => setWishlisted(!wishlisted)} className="absolute top-5 right-5 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                <Heart size={16} className={wishlisted ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-[#6B5E52]'} />
              </button>
              <div className="absolute inset-4 border border-[#C9A96E]/15 pointer-events-none" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`relative overflow-hidden rounded-sm cursor-pointer ring-2 ${i === 0 ? 'ring-[#C9A96E]' : 'ring-transparent hover:ring-[#E8E2DA]'} bg-[#F0EBE3]`} style={{ aspectRatio: '1/1' }}>
                  {product.image && <img src={product.image} alt="" className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-6">
              <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E] mb-3">Geïnspireerd door {product.inspiredBy}</p>
              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714] mb-3" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{product.name}</h1>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => <svg key={i} className={`w-4 h-4 ${i < Math.round(product.rating) ? 'text-[#F59E0B] fill-current' : 'text-[#E8E2DA] fill-current'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
                </div>
                <span className="text-xs text-[#6B5E52]">{product.rating} ({product.reviewCount} beoordelingen)</span>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-[#E8E2DA]">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>€{product.price.toFixed(2)}</span>
                <span className="text-sm text-[#C9A96E] font-semibold">· 2+1 gratis</span>
              </div>
              <p className="text-xs text-[#6B5E52] mt-1.5 flex items-center gap-1.5"><CreditCard size={12} className="text-[#C9A96E]" />Achteraf betalen via Klarna — rente-vrij</p>
            </div>

            <p className="text-[#6B5E52] leading-relaxed mb-6">{product.description}</p>

            <div className="flex items-center gap-2 mb-6 p-3 bg-[#F0F9F4] border border-[#C3E6CB] rounded-sm">
              <Truck size={14} className="text-[#2D7D4D] flex-shrink-0" />
              <p className="text-xs text-[#2D7D4D] font-medium">Vandaag voor 17:30 besteld → morgen in huis</p>
            </div>

            <div className="flex items-center gap-2 mb-6 p-3 bg-[#C9A96E]/10 border border-[#C9A96E]/30 rounded-sm">
              <Gift size={14} className="text-[#C9A96E] flex-shrink-0" />
              <p className="text-xs text-[#6B5E52] font-medium"><strong className="text-[#1A1714]">Alle parfums 2+1 gratis</strong> — voeg 3 toe en betaal er 2</p>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-[#8C7B72] mb-3">Formaat</p>
              <div className="flex gap-2">
                <div className="border-2 border-[#1A1714] px-5 py-2.5 text-sm font-semibold text-[#1A1714] cursor-pointer">{product.size}</div>
              </div>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex items-center border border-[#E8E2DA] rounded-sm">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-12 flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714] transition-colors text-lg">−</button>
                <span className="w-10 text-center text-sm font-semibold text-[#1A1714]">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-11 h-12 flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714] transition-colors text-lg">+</button>
              </div>
              <button onClick={handleAdd} disabled={product.isSoldOut} className={`flex-1 flex items-center justify-center gap-2 h-12 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-300 ${adding ? 'bg-[#C9A96E] text-white' : product.isSoldOut ? 'bg-[#E8E2DA] text-[#8C7B72] cursor-not-allowed' : 'bg-[#1A1714] text-white hover:bg-[#2C2825]'}`}>
                {adding ? <><Check size={14} />Toegevoegd!</> : product.isSoldOut ? 'Uitverkocht' : <><ShoppingBag size={14} />In winkelwagen</>}
              </button>
            </div>

            {!product.isSoldOut && <button className="btn-outline w-full flex items-center justify-center gap-2 mb-6">Direct afrekenen</button>}

            <div className="grid grid-cols-3 gap-3">
              {[{ icon: Shield, text: '30 dagen retour' }, { icon: Clock, text: '8+ uur ruikbaar' }, { icon: Check, text: 'Dierproefvrij' }].map(({ icon: Icon, text }) => (
                <div key={text} className="flex flex-col items-center gap-1.5 p-3 bg-[#FAF8F5] border border-[#E8E2DA] text-center">
                  <Icon size={16} className="text-[#C9A96E]" />
                  <span className="text-[10px] text-[#6B5E52] font-medium leading-tight">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scent notes & performance */}
        <div className="mt-20 grid md:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-3 mb-6"><div className="h-[1px] w-8 bg-[#C9A96E]" /><h2 className="text-2xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Geurprofiel</h2></div>
            <div className="space-y-4">
              {[{ label: 'Top noten', notes: product.notes.top, delay: '0s' }, { label: 'Hart noten', notes: product.notes.heart, delay: '2s' }, { label: 'Basis noten', notes: product.notes.base, delay: '4h+' }].map(({ label, notes, delay }) => (
                <div key={label} className="flex items-start gap-4 p-4 bg-white border border-[#E8E2DA] hover:border-[#C9A96E]/30 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#C9A96E] mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold tracking-widest uppercase text-[#8C7B72]">{label}</p>
                      <span className="text-[9px] text-[#C9A96E] font-medium">{delay}</span>
                    </div>
                    <p className="text-sm text-[#3D3530]">{notes.join(' · ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-6"><div className="h-[1px] w-8 bg-[#C9A96E]" /><h2 className="text-2xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Prestaties</h2></div>
            <div className="space-y-4">
              {[{ label: 'Houdbaarheid', value: product.longevity, pct: 85 }, { label: 'Sillage', value: product.sillage, pct: 70 }, { label: 'Intensiteit', value: 'Matig tot sterk', pct: 75 }].map(({ label, value, pct }) => (
                <div key={label} className="p-4 bg-white border border-[#E8E2DA]">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-xs font-semibold text-[#3D3530] tracking-wide">{label}</p>
                    <p className="text-xs text-[#C9A96E] font-semibold">{value}</p>
                  </div>
                  <div className="h-1.5 bg-[#E8E2DA] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#C9A96E] to-[#DFC08A] rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-5 bg-[#1A1714] rounded-sm">
              <div className="flex items-start gap-3">
                <Star size={16} className="text-[#C9A96E] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Premium kwaliteitsgarantie</p>
                  <p className="text-white/60 text-xs leading-relaxed">Dit parfum bevat tot 30% parfumoliën — waarmee het de concentratie van de meeste designer EDP&apos;s overtreft.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <div className="flex items-center gap-3 mb-8"><div className="h-[1px] w-8 bg-[#C9A96E]" /><h2 className="text-2xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Veelgestelde vragen</h2></div>
          <div className="max-w-2xl space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-[#E8E2DA] bg-white overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-semibold text-[#1A1714]">{faq.q}</span>
                  {openFaq === i ? <ChevronUp size={16} className="text-[#C9A96E] flex-shrink-0" /> : <ChevronDown size={16} className="text-[#8C7B72] flex-shrink-0" />}
                </button>
                {openFaq === i && <div className="px-5 pb-4"><p className="text-sm text-[#6B5E52] leading-relaxed">{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3"><div className="h-[1px] w-8 bg-[#C9A96E]" /><h2 className="text-2xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Combineer met</h2></div>
              <Link to="/collectie" className="inline-flex items-center gap-1 text-xs font-semibold tracking-widest uppercase text-[#6B5E52] hover:text-[#C9A96E] transition-colors">Bekijk alles <ArrowRight size={12} /></Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
              {related.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-[#E8E2DA] px-4 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-bold text-[#1A1714]">{product.name}</p>
            <p className="text-sm font-bold text-[#1A1714]">€{product.price.toFixed(2)}</p>
          </div>
          <button onClick={handleAdd} disabled={product.isSoldOut} className={`flex-1 flex items-center justify-center gap-2 h-12 text-xs font-semibold tracking-wider uppercase ${adding ? 'bg-[#C9A96E] text-white' : 'bg-[#1A1714] text-white'} transition-colors`}>
            {adding ? <><Check size={14} />Toegevoegd</> : <><ShoppingBag size={14} />In winkelwagen</>}
          </button>
        </div>
      </div>
    </div>
  );
}
