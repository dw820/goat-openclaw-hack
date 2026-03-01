"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RegisterProviderDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [pricingAmount, setPricingAmount] = useState("");
  const [pricingSymbol, setPricingSymbol] = useState("USDC");
  const [agentId, setAgentId] = useState("");
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDetectModels = async () => {
    setError("");
    setDetectedModels([]);
    setDetecting(true);

    try {
      const res = await fetch(
        `/api/providers/detect-models?endpoint=${encodeURIComponent(endpoint)}`,
      );
      const data = await res.json();

      if (data.models && data.models.length > 0) {
        setDetectedModels(data.models);
      } else {
        setError(data.error || "No models detected");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDetecting(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!name || !endpoint || !walletAddress || !pricingAmount || !pricingSymbol) {
      setError("Please fill in all required fields.");
      return;
    }

    if (detectedModels.length === 0) {
      setError("Please detect models before registering.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          endpoint,
          walletAddress,
          pricing: { amount: pricingAmount, symbol: pricingSymbol },
          ...(agentId ? { agentId } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Request failed (${res.status})`);
        return;
      }

      // Reset form
      setName("");
      setEndpoint("");
      setWalletAddress("");
      setPricingAmount("");
      setPricingSymbol("USDC");
      setAgentId("");
      setDetectedModels([]);

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register Provider</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input
              placeholder="My GPU Provider"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Endpoint *</label>
            <Input
              placeholder="https://my-host:8080"
              value={endpoint}
              onChange={(e) => {
                setEndpoint(e.target.value);
                setDetectedModels([]);
              }}
            />
          </div>

          {endpoint && (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDetectModels}
                disabled={detecting}
              >
                {detecting ? "Detecting…" : "Detect Models"}
              </Button>

              {detectedModels.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {detectedModels.map((m) => (
                    <Badge key={m} variant="secondary">
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Wallet Address *</label>
            <Input
              placeholder="0x..."
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Price per Request *</label>
              <Input
                placeholder="0.001"
                value={pricingAmount}
                onChange={(e) => setPricingAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Token Symbol *</label>
              <Input
                placeholder="USDC"
                value={pricingSymbol}
                onChange={(e) => setPricingSymbol(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Agent ID (optional)</label>
            <Input
              placeholder="ERC-8004 agent ID for Verified badge"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={loading || detectedModels.length === 0}
          >
            {loading ? "Registering…" : "Register"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
