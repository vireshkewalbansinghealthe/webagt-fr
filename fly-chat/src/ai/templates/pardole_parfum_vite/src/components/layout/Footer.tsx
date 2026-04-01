import { Link } from 'react-router-dom';
import { Share2, ExternalLink, Link2 } from 'lucide-react';

const footerLinks = {
  klantenservice: [
    { label: 'FAQ', href: '/faq' }, { label: 'Contact', href: '/contact' },
    { label: 'Verzending', href: '/verzending' }, { label: 'Retourneren', href: '/retourneren' },
    { label: 'Over ons', href: '/over-ons' },
  ],
  beleid: [
    { label: 'Algemene voorwaarden', href: '/algemene-voorwaarden' },
    { label: 'Privacyverklaring', href: '/privacyverklaring' },
    { label: 'Retourbeleid', href: '/retourbeleid' },
    { label: 'Cookiebeleid', href: '/cookiebeleid' },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[#1A1714] text-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="mb-6">
              <div className="text-2xl font-bold tracking-[0.3em] uppercase mb-1" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>PARDOLE</div>
              <div className="text-[9px] tracking-[0.4em] text-[#C9A96E] uppercase">PARFUM</div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed mb-6">Premium geïnspireerde parfums. Dierproefvrij, langdurig en eerlijk geprijsd.</p>
            <div className="flex gap-3">
              {[Share2, Link2, ExternalLink].map((Icon, i) => (
                <a key={i} href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/60 transition-all">
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-5">Contact</h3>
            <div className="space-y-2 text-sm text-white/60">
              <p>info@pardole-parfum.nl</p>
              <p>Reactietijd: binnen 24 uur</p>
            </div>
            <div className="mt-6">
              <h4 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-3">Winkels</h4>
              <div className="space-y-1 text-sm text-white/60">
                <p>Amsterdam – Flagship Store</p>
                <p>Haarlem – Boutique</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-5">Klantenservice</h3>
            <ul className="space-y-2.5">
              {footerLinks.klantenservice.map(l => (
                <li key={l.href}><Link to={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#C9A96E] mb-5">Beleid</h3>
            <ul className="space-y-2.5 mb-8">
              {footerLinks.beleid.map(l => (
                <li key={l.href}><Link to={l.href} className="text-sm text-white/60 hover:text-white transition-colors">{l.label}</Link></li>
              ))}
            </ul>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-[#C9A96E] mb-2">Nieuwsbrief – 10% korting</p>
              <div className="flex">
                <input type="email" placeholder="jouw@email.nl" className="flex-1 bg-white/10 text-white placeholder-white/30 text-xs px-3 py-2.5 outline-none border border-white/20 border-r-0" />
                <button className="bg-[#C9A96E] text-white text-[10px] font-semibold tracking-wider uppercase px-4 py-2.5 hover:bg-[#DFC08A] transition-colors">OK</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-5 flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <p className="text-xs text-white/40">© Pardole Parfum 2026</p>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">🇳🇱 Nederlands</span>
              <span className="text-white/20">|</span>
              <span className="text-white/40 text-xs">EUR €</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {['Visa','Mastercard','iDEAL','Klarna','PayPal','Apple Pay'].map(m => (
              <div key={m} className="h-7 px-2.5 bg-white/10 rounded text-[9px] text-white/60 flex items-center font-medium">{m}</div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
