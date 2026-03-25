import { X, Plus, Minus, ShoppingBag, Truck, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from './CartContext';

const FREE_SHIPPING = 50;

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
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

        <div className="px-6 py-3 bg-[#FAF8F5] border-b border-[#E8E2DA]">
          {remaining > 0 ? (
            <p className="text-xs text-[#6B5E52] mb-2">Nog <strong>€{remaining.toFixed(2)}</strong> voor gratis verzending</p>
          ) : (
            <p className="text-xs text-[#C9A96E] font-semibold mb-2 flex items-center gap-1"><Truck size={12} /> Gratis verzending actief!</p>
          )}
          <div className="h-1 bg-[#E8E2DA] rounded-full overflow-hidden">
            <div className="h-full bg-[#C9A96E] rounded-full progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

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
            <p className="text-xs text-[#8C7B72] text-center">Verzendkosten berekend bij afrekenen</p>
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
