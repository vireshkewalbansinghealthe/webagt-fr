import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from '@/components/CartContext';
import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartDrawer from '@/components/CartDrawer';
import ExitIntentPopup from '@/components/ExitIntentPopup';
import HomePage from '@/pages/HomePage';
import CollectiePage from '@/pages/CollectiePage';
import ProductPage from '@/pages/ProductPage';
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
            <Route path="/checkout" element={<ComingSoonPage title="Afrekenen" />} />
            <Route path="/account" element={<ComingSoonPage title="Mijn Account" />} />
            <Route path="/wishlist" element={<ComingSoonPage title="Verlanglijst" />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
        </Layout>
      </CartProvider>
    </BrowserRouter>
  );
}
