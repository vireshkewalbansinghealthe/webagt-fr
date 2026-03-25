import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { reviews } from '@/lib/data';

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < rating ? 'text-[#00B67A] fill-current' : 'text-[#E8E2DA] fill-current'}`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  const [current, setCurrent] = useState(0);
  const perPage = 3;
  const totalPages = Math.ceil(reviews.length / perPage);
  const visible = reviews.slice(current * perPage, (current + 1) * perPage);

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Klantbeoordelingen</span>
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
          </div>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714] mb-8" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Wat onze klanten zeggen</h2>
          <div className="inline-flex flex-col items-center gap-2 bg-[#FAF8F5] border border-[#E8E2DA] rounded-sm px-8 py-5">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => <svg key={i} className="w-6 h-6 text-[#00B67A] fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
            </div>
            <div>
              <span className="text-xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Uitstekend</span>
              <span className="text-[#6B5E52] text-sm ml-2">4.9 / 5 · 5.000+ beoordelingen</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {visible.map(r => (
            <div key={r.id} className="bg-[#FAF8F5] p-6 lg:p-7 border border-[#E8E2DA] hover:border-[#C9A96E]/30 hover:shadow-md transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <StarRow rating={r.rating} />
                {r.verified && <div className="flex items-center gap-1 text-[#00B67A]"><CheckCircle size={12} /><span className="text-[9px] font-medium tracking-wide">Geverifieerd</span></div>}
              </div>
              <h4 className="text-sm font-bold text-[#1A1714] mb-2">{r.title}</h4>
              <p className="text-sm text-[#6B5E52] leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
              <p className="text-[10px] text-[#C9A96E] font-medium tracking-wide border-t border-[#E8E2DA] pt-3 mt-3">{r.product}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-[#1A1714]">{r.name} · {r.location}</span>
                <span className="text-[10px] text-[#8C7B72]">{r.date}</span>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} className="w-10 h-10 border border-[#E8E2DA] flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714] hover:border-[#1A1714] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft size={16} /></button>
            {[...Array(totalPages)].map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={`h-2.5 rounded-full transition-all ${i === current ? 'bg-[#C9A96E] w-6' : 'bg-[#E8E2DA] w-2.5'}`} />)}
            <button onClick={() => setCurrent(Math.min(totalPages - 1, current + 1))} disabled={current === totalPages - 1} className="w-10 h-10 border border-[#E8E2DA] flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714] hover:border-[#1A1714] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </section>
  );
}
