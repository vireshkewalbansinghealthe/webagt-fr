import { useState } from 'react';
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
      <Link to={`/product/${product.id}`} className="block relative overflow-hidden bg-[#F5F1EC]" style={{ aspectRatio: '3/4' }}>
        {product.image ? (
          <img src={product.image} alt={product.name} className={`w-full h-full transition-transform duration-700 group-hover:scale-105 ${product.image.startsWith('/') ? 'object-contain p-4' : 'object-cover'}`} />
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
            <button onClick={handleAdd} className={`w-full py-3 flex items-center justify-center gap-2 text-xs font-semibold tracking-widest uppercase transition-all duration-200 ${adding ? 'bg-[#C9A96E] text-white' : 'bg-[#1A1714] text-white hover:bg-[#2C2825]'}`}>
              {adding ? <><Plus size={13} />Toegevoegd!</> : <><ShoppingBag size={13} />Snel toevoegen</>}
            </button>
          </div>
        )}
      </Link>

      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <svg key={i} className={`w-3 h-3 ${i < Math.round(product.rating) ? 'text-[#F59E0B] fill-current' : 'text-[#E8E2DA] fill-current'}`} viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-[10px] text-[#8C7B72]">({product.reviewCount})</span>
        </div>
        <Link to={`/product/${product.id}`}>
          <h3 className="text-sm font-bold text-[#1A1714] mb-0.5 hover:text-[#C9A96E] transition-colors">{product.name}</h3>
          <p className="text-xs text-[#8C7B72] mb-3 line-clamp-1">Geïnspireerd door {product.inspiredBy}</p>
        </Link>
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-[#1A1714]">{product.isSoldOut ? <span className="text-sm text-[#8C7B72]">Uitverkocht</span> : `€${product.price.toFixed(2)}`}</span>
          <span className="text-[10px] text-[#C9A96E] font-semibold tracking-wider">2+1 gratis</span>
        </div>
      </div>
    </div>
  );
}
