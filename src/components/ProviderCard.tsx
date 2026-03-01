"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Provider } from "@/lib/types";
import { InferencePanel } from "@/components/InferencePanel";

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const [open, setOpen] = useState(false);
  const dashboardUrl = process.env.NEXT_PUBLIC_GOAT_DASHBOARD;

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{provider.name}</h3>
            <Badge
              variant={provider.status === "online" ? "default" : "secondary"}
            >
              {provider.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {provider.models && provider.models.length > 0
              ? provider.models.map((m) => (
                  <Badge key={m} variant="outline" className="text-xs">
                    {m}
                  </Badge>
                ))
              : (
                  <Badge variant="outline" className="text-xs">
                    {provider.model}
                  </Badge>
                )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span>
              {provider.pricing.amount} {provider.pricing.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Endpoint</span>
            <span className="font-mono text-xs truncate max-w-[180px]" title={provider.endpoint}>
              {provider.endpoint}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono text-xs">
              {truncateAddress(provider.walletAddress)}
            </span>
          </div>
          {provider.agentId && (
            <div className="pt-1">
              <a
                href={`${dashboardUrl}/agent/${provider.agentId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Badge className="bg-green-600 hover:bg-green-700 text-white">
                  Verified
                </Badge>
              </a>
            </div>
          )}
        </CardContent>

        <CardFooter>
          <Button className="w-full" onClick={() => setOpen(true)}>
            Try it
          </Button>
        </CardFooter>
      </Card>

      <InferencePanel
        provider={provider}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
