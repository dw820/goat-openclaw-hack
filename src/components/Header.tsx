"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Header({ onRegisterClick }: { onRegisterClick: () => void }) {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <h1 className="text-xl font-bold tracking-tight">
          Decentralized Inference Marketplace
        </h1>
        <Badge variant="secondary">Beta</Badge>
        <Button className="ml-auto" onClick={onRegisterClick}>
          Register Provider
        </Button>
      </div>
    </header>
  );
}
