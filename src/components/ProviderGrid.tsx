import type { Provider } from "@/lib/types";
import { ProviderCard } from "@/components/ProviderCard";

export function ProviderGrid({ providers }: { providers: Provider[] }) {
  if (providers.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-muted-foreground">
        No providers found.
      </p>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} />
      ))}
    </div>
  );
}
