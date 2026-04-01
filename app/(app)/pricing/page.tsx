import { PricingTable } from "@clerk/nextjs";

export const metadata = {
  title: "Pricing — WebAGT",
  description: "Start free, upgrade when you need more power.",
};

export default function PricingPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start free, upgrade when you need more power.
        </p>
      </div>

      <PricingTable newSubscriptionRedirectUrl="/dashboard" />

      <p className="text-center text-sm text-muted-foreground">
        All plans include: Live preview · Code editor · Version control · Dark mode
      </p>
    </div>
  );
}
