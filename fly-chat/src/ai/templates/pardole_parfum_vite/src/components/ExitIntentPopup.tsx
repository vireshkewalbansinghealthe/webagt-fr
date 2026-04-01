import { useState, useEffect } from 'react';
import { X, Gift } from 'lucide-react';

export default function ExitIntentPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const timer = setTimeout(() => {
      const handler = (e: MouseEvent) => { if (e.clientY <= 0) { setVisible(true); document.removeEventListener('mouseleave', handler); } };
      document.addEventListener('mouseleave', handler);
      const fallback = setTimeout(() => { setVisible(true); document.removeEventListener('mouseleave', handler); }, 30000);
      return () => { document.removeEventListener('mouseleave', handler); clearTimeout(fallback); };
    }, 5000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setVisible(false); setDismissed(true); }} />
      <div className="relative bg-white w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up">
        <button onClick={() => { setVisible(false); setDismissed(true); }} className="absolute top-4 right-4 text-[#8C7B72] hover:text-[#1A1714] z-10 transition-colors"><X size={20} /></button>
        <div className="bg-[#1A1714] px-8 py-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url('/images/hero-bg.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div className="relative">
            <div className="inline-flex w-12 h-12 rounded-full bg-[#C9A96E] items-center justify-center mb-4"><Gift size={20} className="text-white" /></div>
            <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E] mb-2">Exclusief aanbod</p>
            <h3 className="text-2xl lg:text-3xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Wacht! Je 10% korting<br /><span className="italic text-[#C9A96E]">staat nog klaar voor je</span>
            </h3>
          </div>
        </div>
        <div className="px-8 py-8">
          {done ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">🎁</div>
              <p className="font-semibold text-[#1A1714] mb-2">Gelukt! Check je inbox.</p>
              <p className="text-sm text-[#8C7B72]">Je 10% kortingscode is onderweg naar {email}</p>
              <button onClick={() => { setVisible(false); setDismissed(true); }} className="mt-6 btn-primary w-full justify-center">Nu shoppen</button>
            </div>
          ) : (
            <>
              <p className="text-sm text-[#6B5E52] text-center mb-6">Meld je aan en ontvang direct <strong className="text-[#1A1714]">10% korting</strong> op je eerste bestelling.</p>
              <form onSubmit={e => { e.preventDefault(); if (email) setDone(true); }} className="space-y-3">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jouw@email.nl" required className="w-full border border-[#E8E2DA] text-[#1A1714] placeholder-[#C8BCB4] text-sm px-4 py-3.5 outline-none focus:border-[#C9A96E] transition-colors" />
                <button type="submit" className="btn-gold w-full justify-center">Claim mijn 10% korting</button>
              </form>
              <button onClick={() => { setVisible(false); setDismissed(true); }} className="w-full text-center text-xs text-[#8C7B72] hover:text-[#3D3530] mt-4 transition-colors">Nee bedankt, ik betaal liever vol</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
