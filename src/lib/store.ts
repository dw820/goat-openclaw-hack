import type { Provider, RegisterProviderRequest } from "@/lib/types";

class ProviderStore {
  private providers = new Map<string, Provider>();

  constructor() {
    this.seed();
  }

  private seed() {
    const now = new Date().toISOString();

    this.providers.set("mock-llama3", {
      id: "mock-llama3",
      name: "alice-llama3",
      model: "llama3",
      endpoint: "http://localhost:11434/v1/chat/completions",
      pricing: { amount: "0.01", symbol: "USDC" },
      walletAddress: "0x1111111111111111111111111111111111111111",
      status: "online",
      registeredAt: now,
    });

    this.providers.set("mock-mistral", {
      id: "mock-mistral",
      name: "bob-mistral",
      model: "mistral",
      endpoint: "http://localhost:11434/v1/chat/completions",
      pricing: { amount: "0.005", symbol: "USDC" },
      walletAddress: "0x2222222222222222222222222222222222222222",
      status: "online",
      registeredAt: now,
    });
  }

  getAll(modelFilter?: string): Provider[] {
    const all = Array.from(this.providers.values());
    if (!modelFilter) return all;
    const lower = modelFilter.toLowerCase();
    return all.filter((p) => p.model.toLowerCase().includes(lower));
  }

  getById(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  add(req: RegisterProviderRequest): Provider {
    const id = crypto.randomUUID();
    const provider: Provider = {
      ...req,
      id,
      status: "online",
      registeredAt: new Date().toISOString(),
    };
    this.providers.set(id, provider);
    return provider;
  }

  remove(id: string): boolean {
    return this.providers.delete(id);
  }
}

export const store = new ProviderStore();
