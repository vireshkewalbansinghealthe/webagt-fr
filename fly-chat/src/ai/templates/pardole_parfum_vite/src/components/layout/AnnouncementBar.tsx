import { useState, useEffect } from 'react';
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
          <button key={i} onClick={() => setCurrent(i)} className={`h-1 rounded-full transition-all duration-300 ${i === current ? 'bg-[#C9A96E] w-3' : 'bg-white/30 w-1'}`} />
        ))}
      </div>
    </div>
  );
}
