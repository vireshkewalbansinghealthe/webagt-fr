import HeroSection from '@/components/home/HeroSection';
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
