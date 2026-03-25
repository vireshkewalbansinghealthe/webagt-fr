import { Link } from 'react-router-dom';
import { categories } from '@/lib/data';

export default function CategoryGridSection() {
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
          <Link to={`/collectie/${categories[0].slug}`} className="category-tile col-span-2 block group" style={{ minHeight: '280px' }}>
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
            <Link key={cat.id} to={`/collectie/${cat.slug}`} className="category-tile block group" style={{ aspectRatio: '1/1' }}>
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
