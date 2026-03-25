import { useState } from 'react';
import { Mail, ArrowRight, Check } from 'lucide-react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="py-20 lg:py-28 bg-[#1A1714] relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/50 to-transparent" />
      <div className="relative max-w-3xl mx-auto px-4 lg:px-8 text-center">
        <div className="inline-flex w-14 h-14 rounded-full border border-[#C9A96E]/30 items-center justify-center mb-6"><Mail size={22} className="text-[#C9A96E]" /></div>
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="h-[1px] w-8 bg-[#C9A96E]/50" />
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Nieuwsbrief</span>
          <div className="h-[1px] w-8 bg-[#C9A96E]/50" />
        </div>
        <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-white mb-4" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
          Ontvang 10% korting<br /><span className="italic text-[#C9A96E]">op je eerste bestelling</span>
        </h2>
        <p className="text-white/60 text-sm lg:text-base leading-relaxed mb-10">Meld je aan voor onze nieuwsbrief en ontvang exclusieve aanbiedingen, nieuwe collecties en parfumtips rechtstreeks in je inbox.</p>

        {submitted ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#C9A96E] flex items-center justify-center"><Check size={24} className="text-white" /></div>
            <p className="text-white font-semibold text-lg">Bedankt! Je kortingscode is onderweg.</p>
            <p className="text-white/50 text-sm">Controleer je inbox voor je 10% kortingscode.</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true); }} className="flex flex-col sm:flex-row gap-0 max-w-lg mx-auto">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jouw@email.nl" required className="flex-1 bg-white/10 text-white placeholder-white/30 text-sm px-5 py-4 outline-none border border-white/20 border-r-0 focus:border-[#C9A96E]/50 transition-colors" />
            <button type="submit" className="bg-[#C9A96E] text-white text-xs font-semibold tracking-[0.15em] uppercase px-8 py-4 hover:bg-[#DFC08A] transition-colors flex items-center justify-center gap-2 whitespace-nowrap border border-[#C9A96E]">
              Aanmelden <ArrowRight size={14} />
            </button>
          </form>
        )}
        <p className="text-white/30 text-xs mt-5">Geen spam. Uitschrijven kan altijd.</p>
      </div>
    </section>
  );
}
