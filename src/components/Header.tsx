import { Badge } from "@/components/ui/badge";

export function Header() {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          Decentralized Inference Marketplace
        </h1>
        <Badge variant="secondary">Beta</Badge>
      </div>
    </header>
  );
}
