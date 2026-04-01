import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag, User, Menu, X, ChevronDown, Heart } from 'lucide-react';
import { useCart } from '@/components/CartContext';

const navItems = [
  { label: 'Dames', href: '/collectie/dames' },
  { label: 'Heren', href: '/collectie/heren' },
  { label: 'Unisex', href: '/collectie/unisex' },
  { label: 'Niche', href: '/collectie/niche' },
  { label: 'Extract', href: '/collectie/extract' },
  { label: 'Exclusive', href: '/collectie/exclusive' },
  { label: 'Home & Lifestyle', href: '/collectie/home-lifestyle' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { openCart, totalItems } = useCart();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <>
      <header className={`header-sticky bg-white/95 transition-all duration-300 ${scrolled ? 'shadow-sm border-b border-[#E8E2DA]' : 'border-b border-[#E8E2DA]/60'}`}>
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button className="lg:hidden p-2 text-[#1A1714] hover:text-[#C9A96E] transition-colors" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>

            <Link to="/" className="flex flex-col items-center lg:items-start">
              <span className="text-[22px] lg:text-[26px] font-bold tracking-[0.3em] text-[#1A1714] uppercase" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>PARDOLE</span>
              <span className="text-[9px] tracking-[0.4em] text-[#C9A96E] uppercase -mt-0.5">PARFUM</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-0">
              {navItems.map(item => (
                <Link key={item.href} to={item.href} className="px-4 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#3D3530] hover:text-[#C9A96E] transition-colors whitespace-nowrap">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-1 lg:gap-2">
              <button onClick={() => setSearchOpen(!searchOpen)} className="p-2 text-[#1A1714] hover:text-[#C9A96E] transition-colors"><Search size={18} /></button>
              <Link to="/wishlist" className="p-2 text-[#1A1714] hover:text-[#C9A96E] transition-colors hidden lg:block"><Heart size={18} /></Link>
              <Link to="/account" className="p-2 text-[#1A1714] hover:text-[#C9A96E] transition-colors hidden lg:block"><User size={18} /></Link>
              <button onClick={openCart} className="p-2 text-[#1A1714] hover:text-[#C9A96E] transition-colors relative">
                <ShoppingBag size={20} />
                {totalItems > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#C9A96E] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{totalItems}</span>}
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="border-t border-[#E8E2DA] py-3 flex items-center gap-3">
              <Search size={16} className="text-[#8C7B72] flex-shrink-0" />
              <input autoFocus type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Zoek op parfumnummer of geur..." className="flex-1 text-sm text-[#1A1714] placeholder-[#8C7B72] bg-transparent outline-none" />
              <button onClick={() => setSearchOpen(false)} className="text-[#8C7B72] hover:text-[#1A1714]"><X size={16} /></button>
            </div>
          )}
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 bg-white shadow-2xl mobile-menu-enter flex flex-col">
            <div className="flex items-center justify-between px-6 h-16 border-b border-[#E8E2DA]">
              <span className="text-xl font-bold tracking-[0.3em] text-[#1A1714] uppercase" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>PARDOLE</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto py-6">
              {navItems.map(item => (
                <Link key={item.href} to={item.href} onClick={() => setMobileOpen(false)} className="flex items-center justify-between px-6 py-4 text-sm font-semibold tracking-widest uppercase text-[#3D3530] hover:text-[#C9A96E] hover:bg-[#FAF8F5] border-b border-[#E8E2DA]/50 transition-colors">
                  {item.label}<ChevronDown size={14} className="-rotate-90" />
                </Link>
              ))}
            </div>
            <div className="px-6 py-6 border-t border-[#E8E2DA] space-y-3">
              <Link to="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 text-sm text-[#3D3530] hover:text-[#C9A96E] transition-colors"><User size={16} /><span>Mijn account</span></Link>
              <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 text-sm text-[#3D3530] hover:text-[#C9A96E] transition-colors"><Heart size={16} /><span>Verlanglijst</span></Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
