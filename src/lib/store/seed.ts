import type { Provider } from "@/lib/types";

export function getSeedProviders(): Provider[] {
  const now = new Date().toISOString();

  return [
    {
      id: "mock-llama3",
      name: "alice-gpu-provider",
      model: "qwen3-vl:2b",
      endpoint: "http://localhost:4021",
      pricing: { amount: "0.10", symbol: "USDC" },
      walletAddress: "0x1111111111111111111111111111111111111111",
      models: ["qwen3-vl:2b"],
      status: "online",
      registeredAt: now,
    },
  ];
}
