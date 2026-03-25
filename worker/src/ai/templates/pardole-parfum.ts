import type { ProjectFile, Version } from "../../types/project";

/**
 * Koning Parfum template — luxury fragrance store with full routing,
 * cart, product pages, categories, reviews, and newsletter.
 * Source: https://github.com/Mobyte-27/pardole_parfum_vite
 */
export function getPardoleParfumFiles(): ProjectFile[] {
  return [
    { path: "index.html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Koning Parfum</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
` },
    { path: "src/main.tsx", content: `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
` },
    { path: "src/App.tsx", content: `import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '@/components/CartContext';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/CartDrawer';
import ExitIntentPopup from '@/components/ExitIntentPopup';
import HomePage from '@/pages/HomePage';
import CollectiePage from '@/pages/CollectiePage';
import ProductPage from '@/pages/ProductPage';
import CheckoutPage from '@/pages/CheckoutPage';
import ComingSoonPage from '@/pages/ComingSoonPage';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>{children}</main>
      <Footer />
      <CartDrawer />
      <ExitIntentPopup />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/collectie" element={<CollectiePage />} />
            <Route path="/collectie/:category" element={<CollectiePage />} />
            <Route path="/product/:id" element={<ProductPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/account" element={<ComingSoonPage title="Mijn Account" />} />
            <Route path="/wishlist" element={<ComingSoonPage title="Verlanglijst" />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </CartProvider>
    </BrowserRouter>
  );
}
` },
    { path: "src/index.css", content: `@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap");
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-cream: #FAF8F5;
    --color-beige: #F0EBE3;
    --color-warm-gray: #E8E2DA;
    --color-gold: #C9A96E;
    --color-gold-light: #DFC08A;
    --color-dark: #1A1714;
    --color-charcoal: #2C2825;
    --color-taupe: #6B5E52;
    --color-text: #3D3530;
    --color-text-muted: #8C7B72;
  }
  html { scroll-behavior: smooth; }
  body {
    background-color: var(--color-cream);
    color: var(--color-text);
    -webkit-font-smoothing: antialiased;
    font-family: 'Inter', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #FAF8F5; }
::-webkit-scrollbar-thumb { background: #C9A96E; border-radius: 3px; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
.mobile-menu-enter { animation: slideInLeft 0.3s ease forwards; }

.product-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
.product-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(26,23,20,0.12); }

.btn-primary {
  background-color: #1A1714; color: white;
  padding: 14px 32px; font-size: 13px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase;
  border: none; cursor: pointer; transition: all 0.3s ease;
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Inter', sans-serif;
}
.btn-primary:hover { background-color: #2C2825; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(26,23,20,0.2); }

.btn-gold {
  background-color: #C9A96E; color: white;
  padding: 14px 32px; font-size: 13px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase;
  border: none; cursor: pointer; transition: all 0.3s ease;
  font-family: 'Inter', sans-serif;
}
.btn-gold:hover { background-color: #DFC08A; transform: translateY(-1px); }

.btn-outline {
  background: transparent; color: #1A1714;
  padding: 13px 31px; font-size: 13px; font-weight: 600;
  letter-spacing: 0.12em; text-transform: uppercase;
  border: 1px solid #1A1714; cursor: pointer; transition: all 0.3s ease;
  font-family: 'Inter', sans-serif;
}
.btn-outline:hover { background: #1A1714; color: white; }

.category-tile { position: relative; overflow: hidden; }
.category-tile img { transition: transform 0.6s ease; }
.category-tile:hover img { transform: scale(1.05); }
.category-tile .overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(26,23,20,0.7) 0%, transparent 50%);
  transition: background 0.3s ease;
}
.category-tile:hover .overlay {
  background: linear-gradient(to top, rgba(26,23,20,0.8) 0%, rgba(26,23,20,0.1) 50%);
}

.line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
.line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.progress-bar-fill { transition: width 0.5s ease; }
.header-sticky { position: sticky; top: 0; z-index: 100; backdrop-filter: blur(12px); }
` },
    { path: "src/lib/data.ts", content: `export interface Product {
  id: string;
  name: string;
  inspiredBy: string;
  price: number;
  originalPrice?: number;
  category: 'dames' | 'heren' | 'unisex' | 'niche' | 'extract' | 'exclusive';
  isBestseller?: boolean;
  isNew?: boolean;
  isSoldOut?: boolean;
  rating: number;
  reviewCount: number;
  image: string;
  notes: {
    top: string[];
    heart: string[];
    base: string[];
  };
  description: string;
  size: string;
  longevity: string;
  sillage: string;
  isVirtual?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  count: number;
  description: string;
}

export const products: Product[] = [
  {
    id: '309',
    name: '309',
    inspiredBy: 'Libre – YSL',
    price: 24.95,
    category: 'dames',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 847,
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&q=80',
    notes: { top: ['Mandarin', 'Lavender'], heart: ['Jasmine', 'Orange Blossom'], base: ['Vanilla', 'Ambergris'] },
    description: 'Een vrijgevochten en sensuele geur die kracht en feminiteit combineert.',
    size: '50ml',
    longevity: '8-10 uur',
    sillage: 'Sterk',
  },
  {
    id: '307',
    name: '307',
    inspiredBy: 'Black Opium – YSL',
    price: 24.95,
    category: 'dames',
    isBestseller: true,
    rating: 4.8,
    reviewCount: 1203,
    image: '',
    notes: { top: ['Pink Pepper', 'Orange Blossom'], heart: ['Coffee', 'Jasmine'], base: ['Vanilla', 'Patchouli', 'Cedarwood'] },
    description: 'Verslavend, warm en diep — een geur die blijft hangen.',
    size: '50ml',
    longevity: '10-12 uur',
    sillage: 'Intens',
  },
  {
    id: '045',
    name: '045',
    inspiredBy: 'Coco Mademoiselle – Chanel',
    price: 24.95,
    category: 'dames',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 965,
    image: '',
    notes: { top: ['Orange', 'Bergamot'], heart: ['Rose', 'Jasmine', 'Ylang-Ylang'], base: ['Patchouli', 'Vetiver', 'Vanilla'] },
    description: 'Tijdloos elegant — een klassieker die generaties overstijgt.',
    size: '50ml',
    longevity: '8-10 uur',
    sillage: 'Matig tot sterk',
  },
  {
    id: '263',
    name: '263',
    inspiredBy: 'Paradoxe – Prada',
    price: 24.95,
    category: 'dames',
    isBestseller: true,
    rating: 4.8,
    reviewCount: 632,
    image: '',
    notes: { top: ['Neroli', 'Bergamot'], heart: ['White Musks', 'Iris'], base: ['Sandalwood', 'Amberwood'] },
    description: 'Modern, complex en onweerstaanbaar — een ode aan vrouwelijkheid.',
    size: '50ml',
    longevity: '8-10 uur',
    sillage: 'Matig',
  },
  {
    id: '105',
    name: '105',
    inspiredBy: 'Stronger With You – Armani',
    price: 24.95,
    category: 'heren',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 789,
    image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&q=80',
    notes: { top: ['Pink Pepper', 'Sage'], heart: ['Chestnut', 'Lavender'], base: ['Vanilla', 'Sandalwood', 'Cashmere Wood'] },
    description: 'Warm, kruidig en onweerstaanbaar maskulien. De geur van vertrouwen.',
    size: '50ml',
    longevity: '8-10 uur',
    sillage: 'Matig tot sterk',
  },
  {
    id: '210',
    name: '210',
    inspiredBy: 'Arabian Tonka – Initio',
    price: 24.95,
    category: 'unisex',
    isBestseller: true,
    rating: 5.0,
    reviewCount: 412,
    image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&q=80',
    notes: { top: ['Mandarine', 'Bergamot'], heart: ['Tonka Bean', 'Heliotrope'], base: ['Musk', 'Amber', 'Vanilla'] },
    description: 'Oosters rijkdom ontmoet moderne elegantie in deze exclusieve compositie.',
    size: '50ml',
    longevity: '10-12 uur',
    sillage: 'Intens',
  },
  {
    id: '272',
    name: '272',
    inspiredBy: 'Tobacco Vanille – Tom Ford',
    price: 24.95,
    category: 'niche',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 556,
    image: 'https://images.unsplash.com/photo-1542202229-7d93c33f5d07?w=600&q=80',
    notes: { top: ['Tobacco', 'Spicy Notes'], heart: ['Tonka Bean', 'Tobacco Flower'], base: ['Vanilla', 'Cacao', 'Wood Sap'] },
    description: 'Luxueus, warm en complex — een sensuele niche creatie voor kenners.',
    size: '50ml',
    longevity: '12+ uur',
    sillage: 'Zeer sterk',
  },
  {
    id: '203',
    name: '203',
    inspiredBy: 'Ombre Nomade – Louis Vuitton',
    price: 24.95,
    category: 'niche',
    isBestseller: true,
    rating: 4.8,
    reviewCount: 387,
    image: 'https://images.unsplash.com/photo-1590736704728-f4730bb30770?w=600&q=80',
    notes: { top: ['Birch Tar', 'Oud'], heart: ['Rose', 'Geranium'], base: ['Benzoin', 'Labdanum'] },
    description: 'Een diep rookachtig oud-parfum dat avontuur en luxe ademt.',
    size: '50ml',
    longevity: '12+ uur',
    sillage: 'Intens',
  },
  {
    id: 'enchant',
    name: 'Enchant',
    inspiredBy: 'Baccarat Rouge 540 – Maison Francis Kurkdjian',
    price: 42.49,
    category: 'exclusive',
    isBestseller: true,
    rating: 5.0,
    reviewCount: 1456,
    image: 'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?w=600&q=80',
    notes: { top: ['Saffron', 'Jasmine'], heart: ['Amberwood', 'Fir Resin'], base: ['Erythoxylum', 'Cedar'] },
    description: 'De iconische geur van onze tijd. Verblindend, warm, en onvergetelijk.',
    size: '50ml',
    longevity: '12+ uur',
    sillage: 'Zeer sterk',
  },
  {
    id: 'belong',
    name: 'Belong',
    inspiredBy: 'Angel Share – Kilian',
    price: 42.49,
    category: 'exclusive',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 892,
    image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80',
    notes: { top: ['Cognac', 'Cinnamon'], heart: ['Praline', 'Tonka Bean'], base: ['Sandalwood', 'Vanilla', 'Caramel'] },
    description: 'Warm en zoet als een omhelzing — een geur die raakt aan de ziel.',
    size: '50ml',
    longevity: '10-12 uur',
    sillage: 'Sterk',
  },
  {
    id: 'feel',
    name: 'Feel',
    inspiredBy: 'Erba Pura – Xerjoff',
    price: 42.49,
    category: 'exclusive',
    isBestseller: true,
    rating: 4.9,
    reviewCount: 743,
    image: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=600&q=80',
    notes: { top: ['Sicilian Mandarin', 'Lemon'], heart: ['White Musk', 'Sandalwood'], base: ['Ambroxan', 'Vanilla'] },
    description: 'Fris, bloemig en warm — een sinnelijke mediterrane odyssee.',
    size: '50ml',
    longevity: '10-12 uur',
    sillage: 'Sterk',
  },
  {
    id: 'cherry',
    name: 'Cherry',
    inspiredBy: 'Lost Cherry – Tom Ford',
    price: 42.49,
    category: 'exclusive',
    isBestseller: true,
    rating: 4.8,
    reviewCount: 621,
    image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=600&q=80',
    notes: { top: ['Cherry Liqueur', 'Bitter Almond'], heart: ['Turkish Rose', 'Jasmine'], base: ['Benzoin', 'Sandalwood', 'Tonka Bean'] },
    description: 'Speels en sensueel — een verleidelijke dans van kers en musk.',
    size: '50ml',
    longevity: '10-12 uur',
    sillage: 'Matig tot sterk',
  },
];

export const categories: Category[] = [
  {
    id: 'dames',
    name: 'Dames',
    slug: 'dames',
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80',
    count: 89,
    description: 'Elegante en vrouwelijke geuren',
  },
  {
    id: 'heren',
    name: 'Heren',
    slug: 'heren',
    image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80',
    count: 76,
    description: 'Krachtige en maskuliene geuren',
  },
  {
    id: 'unisex',
    name: 'Unisex',
    slug: 'unisex',
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683702?w=800&q=80',
    count: 45,
    description: 'Voor iedereen, zonder grenzen',
  },
  {
    id: 'niche',
    name: 'Niche',
    slug: 'niche',
    image: 'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=800&q=80',
    count: 32,
    description: 'Zeldzame en exclusieve composities',
  },
  {
    id: 'extract',
    name: 'Extract',
    slug: 'extract',
    image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800&q=80',
    count: 18,
    description: 'Maximale concentratie, ultiem genot',
  },
  {
    id: 'exclusive',
    name: 'Exclusive',
    slug: 'exclusive',
    image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80',
    count: 14,
    description: 'Onze premium collectie',
  },
  {
    id: 'home',
    name: 'Home & Lifestyle',
    slug: 'home-lifestyle',
    image: 'https://images.unsplash.com/photo-1616103570498-a7d34e7b4f49?w=800&q=80',
    count: 28,
    description: 'Luxe geurervaringen voor thuis',
  },
];

export const reviews = [
  {
    id: 1,
    name: 'Sophie V.',
    location: 'Amsterdam',
    rating: 5,
    date: '15 maart 2026',
    title: 'Absoluut geweldig!',
    text: 'Ik was sceptisch, maar dit parfum is echt ongelooflijk. Ruikt precies zoals het origineel maar voor een fractie van de prijs. Iedereen vraagt me welk parfum ik draag!',
    product: '309 – Geïnspireerd door Libre',
    verified: true,
  },
  {
    id: 2,
    name: 'Lars M.',
    location: 'Rotterdam',
    rating: 5,
    date: '8 maart 2026',
    title: 'Kwaliteit overtreft de prijs',
    text: 'Mijn derde bestelling al. De kwaliteit is consistent hoog, de houdbaarheid is geweldig — ik ruik de hele dag heerlijk. Aanrader voor iedereen die luxe geur zoekt zonder de luxe prijs.',
    product: '105 – Geïnspireerd door Stronger With You',
    verified: true,
  },
  {
    id: 3,
    name: 'Emma K.',
    location: 'Utrecht',
    rating: 5,
    date: '2 maart 2026',
    title: 'Precies wat ik zocht',
    text: 'Enchant is mijn absolute favoriet geworden. Warm, sensueel en zo langdurig. Ik krijg constant complimenten. De verpakking is ook erg mooi, ideaal als cadeautje!',
    product: 'Enchant – Geïnspireerd door Baccarat Rouge 540',
    verified: true,
  },
  {
    id: 4,
    name: 'Daan R.',
    location: 'Den Haag',
    rating: 5,
    date: '28 februari 2026',
    title: 'Snelle levering, top kwaliteit',
    text: 'Voor 17:30 besteld en de volgende dag al in huis! Het parfum zelf is prachtig. Ik heb Tobacco Vanille genomen en het is perfect. Rijkelijk, warm en echt premium.',
    product: '272 – Geïnspireerd door Tobacco Vanille',
    verified: true,
  },
  {
    id: 5,
    name: 'Mila S.',
    location: 'Eindhoven',
    rating: 5,
    date: '20 februari 2026',
    title: 'Echt een aanrader!',
    text: 'Ik ben zo blij dat ik dit ontdekt heb. De 2+1 aanbieding is geweldig — ik heb drie geuren mee kunnen nemen. Allemaal top kwaliteit en de houdbaarheid is echt indrukwekkend.',
    product: '045 – Geïnspireerd door Coco Mademoiselle',
    verified: true,
  },
];

export const announcementMessages = [
  'Gratis verzending vanaf €50',
  'Voor 17:30 besteld, morgen in huis',
  'Betaal achteraf met Klarna',
  'Alle parfums 2+1 gratis',
];
` },
    { path: "src/components/CartContext.tsx", content: `import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Product } from '@/lib/data';

interface CartItem { product: Product; quantity: number; }
interface CartContextType {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  totalItems: number;
  totalPrice: number;
  hasShippableItems: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
    setIsOpen(true);
  };
  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.product.id !== id));
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) { removeItem(id); return; }
    setItems(prev => prev.map(i => i.product.id === id ? { ...i, quantity } : i));
  };

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const hasShippableItems = useMemo(
    () => items.some((item) => !item.product.isVirtual),
    [items],
  );

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, totalItems, totalPrice, hasShippableItems, isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false), clearCart: () => setItems([]) }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
` },
    { path: "src/components/CartDrawer.tsx", content: `import { X, Plus, Minus, ShoppingBag, Truck, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from './CartContext';

const FREE_SHIPPING = 50;

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice, totalItems, hasShippableItems } = useCart();
  const progress = Math.min((totalPrice / FREE_SHIPPING) * 100, 100);
  const remaining = Math.max(FREE_SHIPPING - totalPrice, 0);
  const freeItems = Math.floor(totalItems / 2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeCart} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 h-16 border-b border-[#E8E2DA]">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} />
            <span className="text-sm font-semibold tracking-widest uppercase">Winkelwagen ({totalItems})</span>
          </div>
          <button onClick={closeCart}><X size={20} className="text-[#8C7B72]" /></button>
        </div>

        {hasShippableItems ? (
          <div className="px-6 py-3 bg-[#FAF8F5] border-b border-[#E8E2DA]">
            {remaining > 0 ? (
              <p className="text-xs text-[#6B5E52] mb-2">Nog <strong>€{remaining.toFixed(2)}</strong> voor gratis verzending</p>
            ) : (
              <p className="text-xs text-[#C9A96E] font-semibold mb-2 flex items-center gap-1"><Truck size={12} /> Gratis verzending actief!</p>
            )}
            <div className="h-1 bg-[#E8E2DA] rounded-full overflow-hidden">
              <div className="h-full bg-[#C9A96E] rounded-full progress-bar-fill" style={{ width: \`\${progress}%\` }} />
            </div>
          </div>
        ) : (
          <div className="px-6 py-3 bg-[#FAF8F5] border-b border-[#E8E2DA]">
            <p className="text-xs text-[#6B5E52] flex items-center gap-1"><Gift size={12} /> Alleen virtuele producten in je winkelwagen — geen verzending nodig</p>
          </div>
        )}

        {freeItems > 0 && (
          <div className="px-6 py-2.5 bg-[#C9A96E]/10 border-b border-[#C9A96E]/20 flex items-center gap-2">
            <Gift size={14} className="text-[#C9A96E]" />
            <p className="text-xs font-semibold text-[#6B5E52]">2+1 actief — {freeItems} gratis artikel{freeItems > 1 ? 'en' : ''} toegevoegd!</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <ShoppingBag size={40} className="text-[#E8E2DA]" />
              <div>
                <p className="font-semibold text-[#1A1714] mb-1">Je winkelwagen is leeg</p>
                <p className="text-sm text-[#8C7B72]">Ontdek onze premium parfumcollectie</p>
              </div>
              <button onClick={closeCart} className="btn-primary text-xs">Shop nu</button>
            </div>
          ) : (
            <div className="divide-y divide-[#E8E2DA]">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-4 p-5">
                  <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-[#FAF8F5] rounded">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#F5F1EC]">
                        <span className="text-lg font-bold text-[#D8D0C8]">{product.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#1A1714]">{product.name}</p>
                        <p className="text-xs text-[#8C7B72] mt-0.5 line-clamp-1">{product.inspiredBy}</p>
                        <p className="text-xs text-[#6B5E52] mt-0.5">{product.size}</p>
                      </div>
                      <button onClick={() => removeItem(product.id)} className="text-[#C8BCB4] hover:text-[#1A1714]"><X size={14} /></button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-[#E8E2DA] rounded">
                        <button onClick={() => updateQuantity(product.id, quantity - 1)} className="w-7 h-7 flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714]"><Minus size={12} /></button>
                        <span className="w-8 text-center text-sm font-semibold text-[#1A1714]">{quantity}</span>
                        <button onClick={() => updateQuantity(product.id, quantity + 1)} className="w-7 h-7 flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714]"><Plus size={12} /></button>
                      </div>
                      <p className="text-sm font-semibold text-[#1A1714]">€{(product.price * quantity).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-[#E8E2DA] px-6 py-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#6B5E52]">Subtotaal</span>
              <span className="text-lg font-bold text-[#1A1714]">€{totalPrice.toFixed(2)}</span>
            </div>
            <p className="text-xs text-[#8C7B72] text-center">
              {hasShippableItems ? 'Verzendgegevens worden gevraagd bij afrekenen' : 'Geen verzendgegevens nodig voor virtuele producten'}
            </p>
            <Link to="/checkout" onClick={closeCart} className="btn-primary w-full justify-center text-center block">Afrekenen</Link>
            <button onClick={closeCart} className="btn-outline w-full text-center">Verder winkelen</button>
            <div className="flex items-center justify-center gap-3 pt-1">
              {['iDEAL','Klarna','PayPal','Visa'].map(m => (
                <div key={m} className="h-6 px-2 bg-[#FAF8F5] border border-[#E8E2DA] rounded text-[9px] text-[#6B5E52] flex items-center font-medium">{m}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
` },
    { path: "src/components/ExitIntentPopup.tsx", content: `import { useState, useEffect } from 'react';
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
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: \`url('https://pardole-064724.dock.4esh.nl/images/hero-bg.png')\`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
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
` },
    { path: "src/components/home/BestsellersSection.tsx", content: `import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCatalog } from '@/lib/data';
import ProductCard from '@/components/ui/ProductCard';

const tabs = [{ id: 'dames', label: 'Dames' }, { id: 'heren', label: 'Heren' }, { id: 'unisex', label: 'Unisex' }, { id: 'niche', label: 'Niche' }];

export default function BestsellersSection() {
  const [activeTab, setActiveTab] = useState('dames');
  const { products } = useCatalog();
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
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={\`relative px-5 py-3 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-200 \${activeTab === tab.id ? 'text-[#1A1714]' : 'text-[#8C7B72] hover:text-[#3D3530]'}\`}>
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
` },
    { path: "src/components/home/BrandStorySection.tsx", content: `import { Link } from 'react-router-dom';

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
              <img src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=85" alt="Koning Parfum premium ingredients" className="w-full h-full object-cover" />
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
              Bij Koning Parfum ontdek je geuren met de intensiteit en verfijning van designermerken, maar dan eerlijk geprijsd. Onze parfums worden zorgvuldig samengesteld door meesterparfumeurs, met gebruik van dezelfde hoogwaardige ingrediënten.
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
` },
    { path: "src/components/home/CategoryGridSection.tsx", content: `import { Link } from 'react-router-dom';
import { useCatalog } from '@/lib/data';

export default function CategoryGridSection() {
  const { categories } = useCatalog();
  if (categories.length === 0) return null;
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Collecties</span>
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
          </div>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Shop per categorie</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
          {/* Large tile */}
          <Link to={\`/collectie/\${categories[0].slug}\`} className="category-tile col-span-2 block group" style={{ minHeight: '280px' }}>
            <div className="relative w-full overflow-hidden" style={{ minHeight: '280px' }}>
              <img src={categories[0].image} alt={categories[0].name} className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
              <div className="overlay" />
              <div className="absolute inset-0 flex flex-col justify-end p-6 lg:p-8">
                <span className="text-white/70 text-[10px] font-medium tracking-widest uppercase mb-1">{categories[0].count} geuren</span>
                <h3 className="text-white text-2xl lg:text-3xl font-bold tracking-wide" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{categories[0].name}</h3>
                <p className="text-white/70 text-xs mt-1 group-hover:text-white transition-colors">{categories[0].description}</p>
              </div>
            </div>
          </Link>

          {categories.slice(1).map(cat => (
            <Link key={cat.id} to={\`/collectie/\${cat.slug}\`} className="category-tile block group" style={{ aspectRatio: '1/1' }}>
              <div className="relative w-full h-full overflow-hidden">
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
                <div className="overlay" />
                <div className="absolute inset-0 flex flex-col justify-end p-4 lg:p-5">
                  <span className="text-white/60 text-[9px] font-medium tracking-widest uppercase mb-0.5">{cat.count} geuren</span>
                  <h3 className="text-white text-base lg:text-lg font-bold" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{cat.name}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
` },
    { path: "src/components/home/HeroSection.tsx", content: `import { Link } from 'react-router-dom';
import { ArrowRight, Check, Package, Clock, CreditCard, Leaf } from 'lucide-react';

const trustBadges = [
  { icon: Package, text: 'Gratis verzending v/a €50' },
  { icon: Clock, text: 'Voor 17:30 morgen in huis' },
  { icon: CreditCard, text: 'Achteraf betalen – Klarna' },
  { icon: Leaf, text: 'Dierproefvrij' },
];

export default function HeroSection() {
  return (
    <section className="relative flex items-center overflow-hidden bg-[#1A1714]" style={{ minHeight: '92vh' }}>
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: \`url('https://pardole-064724.dock.4esh.nl/images/hero-bg.png')\` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1714]/85 via-[#1A1714]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1714]/40 via-transparent to-transparent" />
      </div>
      <div className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-gradient-to-b from-transparent via-[#C9A96E] to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 w-full pt-8 pb-16">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-8 animate-fade-in-up">
            <div className="h-[1px] w-10 bg-[#C9A96E]" />
            <span className="text-[#C9A96E] text-[10px] font-semibold tracking-[0.3em] uppercase">Premium Inspired Fragrances</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.1] mb-6 animate-fade-in-up" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Het premium<br /><span className="italic text-[#C9A96E]">alternatief</span><br />voor designer&shy;geuren
          </h1>
          <p className="text-white/70 text-base lg:text-lg leading-relaxed mb-8 max-w-lg animate-fade-in-up">
            Ontdek geuren met de intensiteit van designermerken, maar eerlijk geprijsd. Dierproefvrij, 8+ uur ruikbaar en met hoogwaardige parfumoliën tot 30%.
          </p>
          <div className="flex flex-wrap gap-4 mb-10 animate-fade-in-up">
            {['8+ uur ruikbaar', 'Alle parfums 2+1 gratis', 'Premium ingrediënten'].map(item => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#C9A96E] flex items-center justify-center flex-shrink-0"><Check size={11} className="text-white" /></div>
                <span className="text-white/85 text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-14 animate-fade-in-up">
            <Link to="/collectie" className="inline-flex items-center gap-3 bg-[#C9A96E] text-white px-8 py-4 text-xs font-semibold tracking-[0.15em] uppercase hover:bg-[#DFC08A] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              Shop nu <ArrowRight size={14} />
            </Link>
            <a href="#bestsellers" className="inline-flex items-center gap-2 text-white/80 text-xs font-semibold tracking-[0.15em] uppercase hover:text-white transition-colors border-b border-white/30 hover:border-white pb-0.5">
              Bekijk bestsellers
            </a>
          </div>
          <div className="flex items-center gap-3 animate-fade-in-up">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-[#F59E0B] fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white/70 text-xs"><strong className="text-white">Uitstekend</strong> · 30.000+ tevreden klanten</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/10">
            {trustBadges.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center justify-center gap-2.5 py-3.5 px-4">
                <Icon size={14} className="text-[#C9A96E] flex-shrink-0" />
                <span className="text-white/80 text-[11px] font-medium tracking-wide">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
` },
    { path: "src/components/home/NewsletterSection.tsx", content: `import { useState } from 'react';
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
` },
    { path: "src/components/home/ReviewsSection.tsx", content: `import { useState } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { reviews } from '@/lib/data';

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={\`w-4 h-4 \${i < rating ? 'text-[#00B67A] fill-current' : 'text-[#E8E2DA] fill-current'}\`} viewBox="0 0 20 20">
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
            {[...Array(totalPages)].map((_, i) => <button key={i} onClick={() => setCurrent(i)} className={\`h-2.5 rounded-full transition-all \${i === current ? 'bg-[#C9A96E] w-6' : 'bg-[#E8E2DA] w-2.5'}\`} />)}
            <button onClick={() => setCurrent(Math.min(totalPages - 1, current + 1))} disabled={current === totalPages - 1} className="w-10 h-10 border border-[#E8E2DA] flex items-center justify-center text-[#6B5E52] hover:text-[#1A1714] hover:border-[#1A1714] disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </section>
  );
}
` },
    { path: "src/components/home/StoresSection.tsx", content: `import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';

const stores = [
  {
    city: 'Amsterdam', title: 'Koning Parfum Amsterdam', type: 'Flagship Store',
    description: 'Bezoek onze flagship store in hartje Amsterdam. Hier kun je al onze geuren ruiken, persoonlijk advies krijgen en exclusieve in-store bundles ontdekken.',
    image: 'https://pardole-064724.dock.4esh.nl/images/store-amsterdam.png', href: '/winkels/amsterdam',
  },
  {
    city: 'Haarlem', title: 'Koning Parfum Haarlem', type: 'Boutique',
    description: 'In onze Haarlemse boutique combineren we elegantie met een warme, persoonlijke sfeer. Laat je verrassen door onze bestsellers en proefmonsters.',
    image: 'https://pardole-064724.dock.4esh.nl/images/store-haarlem-2.png', href: '/winkels/haarlem',
  },
];

export default function StoresSection() {
  return (
    <section className="py-20 lg:py-28 bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Onze winkels</span>
            <div className="h-[1px] w-8 bg-[#C9A96E]" />
          </div>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Ervaar Koning in het echt</h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {stores.map(store => (
            <div key={store.city} className="group bg-white overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300">
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img src={store.image} alt={store.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1714]/20 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className="bg-[#C9A96E] text-white text-[9px] font-semibold tracking-widest uppercase px-3 py-1.5">{store.type}</span>
                </div>
              </div>
              <div className="p-6 lg:p-8">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={13} className="text-[#C9A96E]" />
                  <span className="text-xs text-[#8C7B72] font-medium tracking-wider uppercase">{store.city}</span>
                </div>
                <h3 className="text-xl lg:text-2xl font-bold text-[#1A1714] mb-3" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{store.title}</h3>
                <p className="text-sm text-[#6B5E52] leading-relaxed mb-6">{store.description}</p>
                <Link to={store.href} className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase text-[#1A1714] hover:text-[#C9A96E] transition-colors border-b border-[#1A1714] hover:border-[#C9A96E] pb-0.5">
                  Winkel bezoeken <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
` },
    { path: "src/components/home/USPSection.tsx", content: `import { Clock, Droplets, Leaf, Users, Package, Award } from 'lucide-react';

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
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#C9A96E]">Waarom Koning</span>
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
` },
    { path: "src/components/layout/AnnouncementBar.tsx", content: `import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { announcementMessages } from '@/lib/data';

export default function AnnouncementBar() {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setCurrent(p => (p + 1) % announcementMessages.length), 3500);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="bg-[#1A1714] text-white text-xs tracking-widest uppercase relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 h-10 flex items-center justify-center">
        <button onClick={() => setCurrent(c => (c - 1 + announcementMessages.length) % announcementMessages.length)} className="absolute left-4 text-white/50 hover:text-white transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span key={current} className="animate-fade-in-up font-medium tracking-[0.15em] text-[10px] text-center">
          {announcementMessages[current]}
        </span>
        <button onClick={() => setCurrent(c => (c + 1) % announcementMessages.length)} className="absolute right-4 text-white/50 hover:text-white transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
        {announcementMessages.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className={\`h-1 rounded-full transition-all duration-300 \${i === current ? 'bg-[#C9A96E] w-3' : 'bg-white/30 w-1'}\`} />
        ))}
      </div>
    </div>
  );
}
` },
    { path: "src/components/layout/Footer.tsx", content: `import { Link } from 'react-router-dom';
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
              <div className="text-2xl font-bold tracking-[0.3em] uppercase mb-1" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>KONING</div>
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
              <p>info@koning-parfum.nl</p>
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
            <p className="text-xs text-white/40">© Koning Parfum 2026</p>
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
` },
    { path: "src/components/layout/Header.tsx", content: `import { useState, useEffect } from 'react';
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
      <header className={\`header-sticky bg-white/95 transition-all duration-300 \${scrolled ? 'shadow-sm border-b border-[#E8E2DA]' : 'border-b border-[#E8E2DA]/60'}\`}>
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <button className="lg:hidden p-2 text-[#1A1714] hover:text-[#C9A96E] transition-colors" onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>

            <Link to="/" className="flex flex-col items-center lg:items-start">
              <span className="text-[22px] lg:text-[26px] font-bold tracking-[0.3em] text-[#1A1714] uppercase" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>KONING</span>
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
              <span className="text-xl font-bold tracking-[0.3em] text-[#1A1714] uppercase" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>KONING</span>
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
` },
    { path: "src/components/ui/ProductCard.tsx", content: `import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Plus } from 'lucide-react';
import type { Product } from '@/lib/data';
import { useCart } from '@/components/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);
  const { addItem } = useCart();

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    setAdding(true);
    addItem(product);
    setTimeout(() => setAdding(false), 1200);
  };

  return (
    <div className="product-card group relative bg-white rounded-sm overflow-hidden">
      <Link to={\`/product/\${product.id}\`} className="block relative overflow-hidden bg-[#F5F1EC]" style={{ aspectRatio: '3/4' }}>
        {product.image ? (
          <img src={product.image} alt={product.name} className={\`w-full h-full transition-transform duration-700 group-hover:scale-105 \${product.image.startsWith('/') ? 'object-contain p-4' : 'object-cover'}\`} />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#F5F1EC]">
            <span className="text-5xl font-bold text-[#D8D0C8]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{product.name}</span>
            <span className="text-xs tracking-widest text-[#C8BCB4] mt-2 uppercase">Eau de Parfum</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isBestseller && <span className="bg-[#1A1714] text-white text-[9px] font-semibold tracking-widest uppercase px-2.5 py-1">Bestseller</span>}
          {product.isNew && <span className="bg-[#C9A96E] text-white text-[9px] font-semibold tracking-widest uppercase px-2.5 py-1">Nieuw</span>}
          {product.isSoldOut && <span className="bg-[#8C7B72] text-white text-[9px] font-semibold tracking-widest uppercase px-2.5 py-1">Uitverkocht</span>}
        </div>

        <button onClick={e => { e.preventDefault(); setWishlisted(!wishlisted); }} className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm hover:bg-white">
          <Heart size={14} className={wishlisted ? 'fill-[#C9A96E] text-[#C9A96E]' : 'text-[#6B5E52]'} />
        </button>

        {!product.isSoldOut && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button onClick={handleAdd} className={\`w-full py-3 flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase transition-all duration-200 \${adding ? 'bg-[#C9A96E] text-white' : 'bg-[#1A1714] text-white hover:bg-[#2C2825]'}\`}>
              {adding ? <><Plus size={13} />Toegevoegd!</> : <><ShoppingBag size={13} />Snel toevoegen</>}
            </button>
          </div>
        )}
      </Link>

      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className={\`w-3 h-3 \${i < Math.round(product.rating) ? 'text-[#F59E0B] fill-current' : 'text-[#E8E2DA] fill-current'}\`} viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-[10px] text-[#8C7B72]">({product.reviewCount})</span>
        </div>
        <Link to={\`/product/\${product.id}\`}>
          <h3 className="text-sm font-bold text-[#1A1714] mb-0.5 hover:text-[#C9A96E] transition-colors">{product.name}</h3>
          <p className="text-xs text-[#8C7B72] mb-3 line-clamp-1">Geïnspireerd door {product.inspiredBy}</p>
        </Link>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-[#1A1714]">{product.isSoldOut ? <span className="text-sm text-[#8C7B72]">Uitverkocht</span> : \`€\${product.price.toFixed(2)}\`}</span>
          <span className="text-[10px] text-[#C9A96E] font-semibold tracking-wider">2+1 gratis</span>
        </div>
      </div>
    </div>
  );
}
` },
    { path: "src/pages/CollectiePage.tsx", content: `import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { useCatalog } from '@/lib/data';
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
  const { products } = useCatalog();
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
  }, [products, activeCategory, sortBy, priceMax]);

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="bg-[#1A1714] py-16 lg:py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: \`url('https://images.unsplash.com/photo-1541643600914-78b084683702?w=1200&q=60')\`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
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
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={\`relative px-5 py-3 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-200 \${activeCategory === cat.id ? 'text-[#1A1714]' : 'text-[#8C7B72] hover:text-[#3D3530]'}\`}>
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
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={\`w-full text-left text-sm py-2 px-3 transition-all rounded-sm \${activeCategory === cat.id ? 'bg-[#1A1714] text-white font-semibold' : 'text-[#3D3530] hover:bg-[#E8E2DA]'}\`}>{cat.label}</button>
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
                    <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setMobileFiltersOpen(false); }} className={\`w-full text-left text-sm py-2.5 px-3 rounded-sm transition-all \${activeCategory === cat.id ? 'bg-[#1A1714] text-white font-semibold' : 'text-[#3D3530] hover:bg-[#FAF8F5]'}\`}>{cat.label}</button>
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
` },
    { path: "src/pages/CheckoutPage.tsx", content: `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, ShieldCheck, Truck } from 'lucide-react';
import { useCart } from '../components/CartContext';
import { beginCheckout, getPaymentState } from '../lib/payments';

const FREE_SHIPPING = 50;

export default function CheckoutPage() {
  const { items, totalPrice, totalItems, hasShippableItems, clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentState = getPaymentState();
  const shippingCopy = useMemo(() => {
    if (!hasShippableItems) return 'Geen verzending nodig';
    return totalPrice >= FREE_SHIPPING ? 'Gratis verzending' : 'Verzending wordt berekend in Stripe Checkout';
  }, [hasShippableItems, totalPrice]);

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      clearCart();
    }
  }, [searchParams, clearCart]);

  async function handleCheckout() {
    setError(null);

    if (!paymentState.canCheckout) {
      setError(paymentState.message);
      return;
    }

    try {
      setIsSubmitting(true);
      const url = await beginCheckout({
        items: items.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          unitAmount: Math.round(product.price * 100),
          quantity,
          image: product.image,
          isVirtual: product.isVirtual,
        })),
        successUrl: \`\${window.location.origin}/checkout?checkout=success\`,
        cancelUrl: \`\${window.location.origin}/checkout?checkout=cancelled\`,
        requiresShipping: hasShippableItems,
      });
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Checkout starten mislukt.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] px-4 py-16">
        <div className="max-w-2xl mx-auto bg-white border border-[#E8E2DA] p-10 text-center">
          <h1 className="text-3xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Je winkelwagen is leeg</h1>
          <p className="text-[#6B5E52] mt-3 mb-8">Voeg eerst producten toe voordat je kunt afrekenen.</p>
          <Link to="/collectie" className="btn-primary inline-flex">Terug naar collectie</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] px-4 py-10 lg:py-14">
      <div className="max-w-6xl mx-auto">
        <Link to="/collectie" className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase text-[#6B5E52] hover:text-[#C9A96E] mb-8">
          <ArrowLeft size={14} /> Verder winkelen
        </Link>

        <div className="grid lg:grid-cols-[1.2fr,0.8fr] gap-8">
          <div className="bg-white border border-[#E8E2DA] p-6 lg:p-8">
            <div className="mb-8">
              <p className="text-[10px] font-semibold tracking-[0.24em] uppercase text-[#C9A96E] mb-3">Afrekenen</p>
              <h1 className="text-3xl lg:text-4xl font-bold text-[#1A1714]" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Controleer je bestelling</h1>
              <p className="text-[#6B5E52] mt-3">Stripe Checkout opent direct met beveiligde betaling en klantgegevens.</p>
            </div>

            <div className="space-y-4">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-4 border border-[#E8E2DA] p-4">
                  <div className="w-20 h-20 overflow-hidden bg-[#FAF8F5]">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#C8BCB4] font-bold">{product.name}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#1A1714]">{product.name}</p>
                        <p className="text-xs text-[#8C7B72] mt-1">{product.isVirtual ? 'Virtueel product' : 'Fysiek product'}</p>
                      </div>
                      <p className="font-semibold text-[#1A1714]">€{(product.price * quantity).toFixed(2)}</p>
                    </div>
                    <p className="text-sm text-[#6B5E52] mt-2">Aantal: {quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="bg-white border border-[#E8E2DA] p-6 lg:p-8 h-fit">
            <h2 className="text-xl font-bold text-[#1A1714] mb-6" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>Overzicht</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between text-[#6B5E52]">
                <span>Artikelen</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex items-center justify-between text-[#6B5E52]">
                <span>Subtotaal</span>
                <span>€{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-[#6B5E52]">
                <span>Verzending</span>
                <span>{shippingCopy}</span>
              </div>
              <div className="border-t border-[#E8E2DA] pt-3 flex items-center justify-between text-[#1A1714] font-semibold text-base">
                <span>Totaal</span>
                <span>€{totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {searchParams.get('checkout') === 'success' && (
                <div className="border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Je betaling is gelukt. Bedankt voor je bestelling.
                </div>
              )}
              {searchParams.get('checkout') === 'cancelled' && (
                <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Je checkout is afgebroken. Je producten staan nog in je winkelwagen.
                </div>
              )}
              {error && (
                <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <button onClick={handleCheckout} disabled={isSubmitting} className="btn-primary w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed">
                {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Even wachten...</> : paymentState.ctaLabel}
              </button>
            </div>

            <div className="mt-6 space-y-3 text-xs text-[#6B5E52]">
              <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#C9A96E]" /> Beveiligde betaling via Stripe</div>
              <div className="flex items-center gap-2"><Truck size={14} className="text-[#C9A96E]" /> {hasShippableItems ? 'Verzendadres wordt gevraagd tijdens checkout' : 'Geen verzendadres nodig voor deze bestelling'}</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
` },
    { path: "src/pages/ComingSoonPage.tsx", content: `import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
}

export default function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
      <div className="text-center px-6">
        <Construction size={48} className="text-[#C9A96E] mx-auto mb-6" />
        <h1
          className="text-3xl font-bold text-[#1A1714] mb-3"
          style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
        >
          {title}
        </h1>
        <p className="text-[#6B5E52] mb-8 max-w-sm mx-auto">
          Deze pagina is binnenkort beschikbaar.
        </p>
        <Link to="/" className="btn-primary inline-flex">
          Terug naar home
        </Link>
      </div>
    </div>
  );
}
` },
    { path: "src/pages/HomePage.tsx", content: `import HeroSection from '@/components/home/HeroSection';
import BestsellersSection from '@/components/home/BestsellersSection';
import USPSection from '@/components/home/USPSection';
import BrandStorySection from '@/components/home/BrandStorySection';
import CategoryGridSection from '@/components/home/CategoryGridSection';
import StoresSection from '@/components/home/StoresSection';
import ReviewsSection from '@/components/home/ReviewsSection';
import NewsletterSection from '@/components/home/NewsletterSection';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <BestsellersSection />
      <USPSection />
      <BrandStorySection />
      <CategoryGridSection />
      <StoresSection />
      <ReviewsSection />
      <NewsletterSection />
    </>
  );
}
` },
    { path: "src/pages/ProductPage.tsx", content: `import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingBag, Heart, Check, ChevronDown, ChevronUp, Truck, CreditCard, Gift, Clock, Shield, Star, ArrowRight } from 'lucide-react';
import { useCatalog } from '@/lib/data';
import { useCart } from '@/components/CartContext';
import ProductCard from '@/components/ui/ProductCard';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { products } = useCatalog();
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
    { q: 'Hoe lang houdt dit parfum?', a: \`\${product.name} is ontworpen voor een houdbaarheid van \${product.longevity}.\` },
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
                <img src={product.image} alt={product.name} className={\`w-full h-full \${product.image.startsWith('/') ? 'object-contain p-6' : 'object-cover'}\`} />
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
                <div key={i} className={\`relative overflow-hidden rounded-sm cursor-pointer ring-2 \${i === 0 ? 'ring-[#C9A96E]' : 'ring-transparent hover:ring-[#E8E2DA]'} bg-[#F0EBE3]\`} style={{ aspectRatio: '1/1' }}>
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
                  {[...Array(5)].map((_, i) => <svg key={i} className={\`w-4 h-4 \${i < Math.round(product.rating) ? 'text-[#F59E0B] fill-current' : 'text-[#E8E2DA] fill-current'}\`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
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
              <button onClick={handleAdd} disabled={product.isSoldOut} className={\`flex-1 flex items-center justify-center gap-2 h-12 text-xs font-semibold tracking-[0.12em] uppercase transition-all duration-300 \${adding ? 'bg-[#C9A96E] text-white' : product.isSoldOut ? 'bg-[#E8E2DA] text-[#8C7B72] cursor-not-allowed' : 'bg-[#1A1714] text-white hover:bg-[#2C2825]'}\`}>
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
                    <div className="h-full bg-gradient-to-r from-[#C9A96E] to-[#DFC08A] rounded-full" style={{ width: \`\${pct}%\` }} />
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
          <button onClick={handleAdd} disabled={product.isSoldOut} className={\`flex-1 flex items-center justify-center gap-2 h-12 text-xs font-semibold tracking-wider uppercase \${adding ? 'bg-[#C9A96E] text-white' : 'bg-[#1A1714] text-white'} transition-colors\`}>
            {adding ? <><Check size={14} />Toegevoegd</> : <><ShoppingBag size={14} />In winkelwagen</>}
          </button>
        </div>
      </div>
    </div>
  );
}
` },
    {
      path: "package.json",
      content: JSON.stringify({
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "react-router-dom": "^6.26.0",
          "lucide-react": "latest",
        },
        devDependencies: {
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          tailwindcss: "^3.4.0",
          typescript: "^5.0.0",
        },
      }, null, 2),
    },
  ];
}
