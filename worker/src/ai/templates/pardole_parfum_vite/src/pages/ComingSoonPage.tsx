import { Link } from 'react-router-dom';
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
