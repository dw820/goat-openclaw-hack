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
  models?: string[];
  status: "online" | "offline";
  registeredAt: string;
}

export interface RegisterProviderRequest {
  name: string;
  model?: string;
  endpoint: string;
  pricing: Pricing;
  walletAddress: string;
  agentId?: string;
}

export interface Order {
  orderId: string;
  flow: string;
  tokenSymbol: string;
  tokenContract: string;
  fromAddress: string;
  payToAddress: string;
  fromChainId: number;
  amountWei: string;
  expiresAt: number;
}

export interface OrderStatus {
  orderId: string;
  status:
    | "CHECKOUT_VERIFIED"
    | "PAYMENT_CONFIRMED"
    | "INVOICED"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED";
  txHash?: string;
  confirmedAt?: string;
}
