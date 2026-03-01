"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Provider, Order, OrderStatus } from "@/lib/types";
import { ethers } from "ethers";
import { PaymentHelper, formatUnits } from "goatx402-sdk";
import type { Order as SdkOrder } from "goatx402-sdk";

type PaymentPhase =
  | null
  | "payment_required"
  | "paying"
  | "awaiting_confirmation"
  | "payment_confirmed"
  | "payment_failed"
  | "payment_expired";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000;

function baseUrl(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export function InferencePanel({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const abortRef = useRef<AbortController>(null);
  const pollStartRef = useRef<number>(0);
  const signerRef = useRef<ethers.Signer | null>(null);

  const connectWallet = useCallback(async (): Promise<ethers.Signer | null> => {
    if (signerRef.current) return signerRef.current;

    if (!window.ethereum) {
      setPaymentError("MetaMask not detected. Please install MetaMask.");
      return null;
    }

    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send("eth_requestAccounts", []);
    const signer = await browserProvider.getSigner();
    const address = await signer.getAddress();
    signerRef.current = signer;
    setWalletAddress(address);
    return signer;
  }, []);

  const streamResponse = useCallback(async (res: Response) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            setOutput((prev) => prev + token);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || loading) return;

    setOutput("");
    setLoading(true);
    setPaymentPhase(null);
    setOrder(null);
    setPaymentError(null);
    setTxHash(null);

    // Connect wallet to get address for order creation
    const signer = await connectWallet();
    if (!signer) {
      setLoading(false);
      return;
    }

    const address = await signer.getAddress();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${baseUrl(provider.endpoint)}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": address,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
        signal: controller.signal,
      });

      if (res.status === 402) {
        try {
          const json = await res.json();
          const orderData: Order = json.order;
          if (!orderData?.orderId) {
            setOutput("Error: 402 Payment Required but no order returned");
            setLoading(false);
            return;
          }
          setOrder(orderData);
          setPaymentPhase("payment_required");
        } catch {
          setOutput("Error: 402 Payment Required (malformed response)");
        }
        setLoading(false);
        return;
      }

      if (!res.ok || !res.body) {
        setOutput(`Error: ${res.status} ${res.statusText}`);
        setLoading(false);
        return;
      }

      await streamResponse(res);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setOutput((prev) => prev + `\n\nError: ${(err as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, provider, streamResponse, connectWallet]);

  const handlePay = useCallback(async () => {
    if (!order || !signerRef.current) return;

    setPaymentPhase("paying");
    setPaymentError(null);

    try {
      // Ensure MetaMask is on the correct chain
      const targetChainId = `0x${order.fromChainId.toString(16)}`;
      try {
        await window.ethereum?.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainId }],
        });
      } catch (switchError: unknown) {
        // Chain not added to MetaMask — try adding it
        if ((switchError as { code?: number })?.code === 4902) {
          await window.ethereum?.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetChainId,
                chainName: "GOAT Testnet3",
                nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
                rpcUrls: ["https://rpc.testnet3.goat.network"],
                blockExplorerUrls: ["https://explorer.testnet3.goat.network"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      // Re-create signer after chain switch
      const browserProvider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await browserProvider.getSigner();
      signerRef.current = signer;

      const payment = new PaymentHelper(signer);
      const result = await payment.pay(order as unknown as SdkOrder);

      if (!result.success) {
        setPaymentPhase("payment_failed");
        setPaymentError(result.error ?? "Payment failed");
        return;
      }

      setTxHash(result.txHash ?? null);
      setPaymentPhase("awaiting_confirmation");
      pollStartRef.current = Date.now();
    } catch (err) {
      setPaymentPhase("payment_failed");
      setPaymentError((err as Error).message);
    }
  }, [order]);

  const retryWithOrder = useCallback(
    async (orderId: string) => {
      setOutput("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${baseUrl(provider.endpoint)}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goat-Order-Id": orderId,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: "user", content: prompt }],
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setOutput(`Error: ${res.status} ${res.statusText}`);
          setLoading(false);
          setPaymentPhase(null);
          return;
        }

        setPaymentPhase(null);
        await streamResponse(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setOutput((prev) => prev + `\n\nError: ${(err as Error).message}`);
        }
        setPaymentPhase(null);
      } finally {
        setLoading(false);
      }
    },
    [prompt, provider, streamResponse]
  );

  // Poll for payment confirmation after on-chain tx
  useEffect(() => {
    if (paymentPhase !== "awaiting_confirmation" || !order) return;

    const interval = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        setPaymentPhase("payment_expired");
        setPaymentError("Payment confirmation timed out");
        return;
      }

      try {
        const res = await fetch(
          `${baseUrl(provider.endpoint)}/api/orders/${order.orderId}/status`
        );
        if (!res.ok) return;

        const data: OrderStatus = await res.json();

        if (data.status === "PAYMENT_CONFIRMED" || data.status === "INVOICED") {
          setPaymentPhase("payment_confirmed");
          retryWithOrder(order.orderId);
        } else if (
          data.status === "FAILED" ||
          data.status === "EXPIRED" ||
          data.status === "CANCELLED"
        ) {
          setPaymentPhase("payment_expired");
          setPaymentError(`Order ${data.status.toLowerCase()}`);
        }
      } catch {
        // Silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [paymentPhase, order, provider.endpoint, retryWithOrder]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (abortRef.current) abortRef.current.abort();
      setPaymentPhase(null);
      setOrder(null);
      setPaymentError(null);
      setTxHash(null);
      setOutput("");
    }
    onOpenChange(nextOpen);
  };

  const handleTryAgain = () => {
    setPaymentPhase(null);
    setOrder(null);
    setPaymentError(null);
    setTxHash(null);
  };

  const formatAmount = (amountWei: string) => {
    try {
      return formatUnits(BigInt(amountWei), 6);
    } catch {
      return amountWei;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Inference — {provider.model} ({provider.name})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment card */}
          {paymentPhase && order && (
            <Card className="border-amber-500">
              <CardContent className="space-y-3">
                {paymentPhase === "payment_required" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-600"
                      >
                        Payment Required
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Amount:</span>{" "}
                        <span className="font-semibold">
                          {formatAmount(order.amountWei)} {order.tokenSymbol}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Chain ID:</span>{" "}
                        {order.fromChainId}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Order:</span>{" "}
                        <code className="text-xs">
                          {order.orderId.slice(0, 12)}…
                        </code>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handlePay}>Pay with Wallet</Button>
                      <Button variant="outline" onClick={handleTryAgain}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {paymentPhase === "paying" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-600"
                      >
                        Confirm in Wallet
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Please confirm the transaction in MetaMask…
                    </p>
                    <Button disabled>Waiting for wallet…</Button>
                  </>
                )}

                {paymentPhase === "awaiting_confirmation" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="border-blue-500 text-blue-600"
                      >
                        Transaction Submitted
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">
                        Waiting for on-chain confirmation…
                      </p>
                      {txHash && (
                        <p>
                          <span className="text-muted-foreground">Tx:</span>{" "}
                          <code className="text-xs">
                            {txHash.slice(0, 12)}…
                          </code>
                        </p>
                      )}
                    </div>
                    <Button disabled>Confirming…</Button>
                  </>
                )}

                {paymentPhase === "payment_confirmed" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">Paid</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Starting inference…
                    </p>
                  </>
                )}

                {paymentPhase === "payment_failed" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Failed</Badge>
                    </div>
                    <p className="text-sm text-destructive">
                      {paymentError ?? "Payment failed."}
                    </p>
                    <Button variant="outline" onClick={handleTryAgain}>
                      Try Again
                    </Button>
                  </>
                )}

                {paymentPhase === "payment_expired" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Expired</Badge>
                    </div>
                    <p className="text-sm text-destructive">
                      {paymentError ?? "Payment order has expired."}
                    </p>
                    <Button variant="outline" onClick={handleTryAgain}>
                      Try Again
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Wallet connection error (no MetaMask) */}
          {!paymentPhase && paymentError && (
            <Card className="border-destructive">
              <CardContent>
                <p className="text-sm text-destructive">{paymentError}</p>
              </CardContent>
            </Card>
          )}

          {/* Input area — hidden while payment flow is active */}
          {!paymentPhase && (
            <>
              <Textarea
                placeholder="Enter your prompt…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSend}
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? "Streaming…" : "Send"}
                </Button>
                {walletAddress && (
                  <span className="text-xs text-muted-foreground">
                    Wallet: {walletAddress.slice(0, 6)}…
                    {walletAddress.slice(-4)}
                  </span>
                )}
              </div>
            </>
          )}

          {output && (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-muted p-4 font-mono text-sm whitespace-pre-wrap">
              {output}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
