export interface Pricing {
  amount: string;
  symbol: string;
}

export interface Provider {
  id: string;
  name: string;
  model: string;
  endpoint: string;
  pricing: Pricing;
  walletAddress: string;
  agentId?: string;
  status: "online" | "offline";
  registeredAt: string;
}

export interface RegisterProviderRequest {
  name: string;
  model: string;
  endpoint: string;
  pricing: Pricing;
  walletAddress: string;
  agentId?: string;
}
