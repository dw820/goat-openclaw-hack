"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { FilterBar } from "@/components/FilterBar";
import { ProviderGrid } from "@/components/ProviderGrid";
import { RegisterProviderDialog } from "@/components/RegisterProviderDialog";
import type { Provider } from "@/lib/types";

export default function Home() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);

  const fetchProviders = useCallback(async (model?: string) => {
    const url = model
      ? `/api/providers?model=${encodeURIComponent(model)}`
      : "/api/providers";
    const res = await fetch(url);
    const data = await res.json();
    setProviders(data);
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onRegisterClick={() => setRegisterOpen(true)} />
      <FilterBar onFilter={(model) => fetchProviders(model || undefined)} />
      <ProviderGrid providers={providers} />
      <RegisterProviderDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSuccess={() => fetchProviders()}
      />
    </div>
  );
}
