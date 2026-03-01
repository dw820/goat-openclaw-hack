### Goal

- You will have an **ERC-8004 identity** on GOAT that accepts **x402 payments**.
- You will see your identity on: [goat-dashboard.vercel.app](http://goat-dashboard.vercel.app)

- **You should probably just send below info to OpenClaw to code out  🦞**
- **What matters is, your idea and deliver it with quality** 💡

### Step 1: Understand the primitives

**ERC-8004 — Agent Identity**

A draft Ethereum standard for giving AI agents a portable, verifiable on-chain identity. Think of it like an on-chain LinkedIn profile for your agent.

- Each agent gets a unique `agentId` (ERC-721 NFT)
- Stores name, description, services, and an `x402Support: true` flag
- Lives on GOAT Testnet3 for this hackathon
- [📖 EIP-8004 spec](https://eips.ethereum.org/EIPS/eip-8004)

**x402 — Pay-per-use HTTP payments**

A payment standard for HTTP APIs.

- Server returns **402 Payment Required**
- Client pays on-chain
- Server verifies payment
- Server returns the paid response
- Native to GOAT Testnet3 (USDC or USDT, chain 48816)
- [📖 x402 repo](https://github.com/GOATNetwork/x402)

**How they combine**

- ERC-8004 is your agent’s **identity + reputation**.
- x402 is your agent’s **payment rail**.

Together: agents can discover each other on-chain, pay each other trustlessly, and build reputation from transactions.

<aside>
🧩

The [GOAT x402 SDK](https://github.com/GOATNetwork/x402) is recommended but not required. You can implement x402 yourself by serving a 402 with payment info, then verifying the on-chain transfer.

</aside>

### Step 2: Get credentials from **@goathackbot**

DM **@goathackbot** (or find it in the hackathon group) with:

- Your **project name**
- Your **Testnet3 wallet address** (`0x...`)
- One line: **what does your agent do?**

**@goathackbot** will:

1. Create your x402 merchant account
2. Register your ERC-8004 agent identity on Testnet3
3. Send your wallet test USDC, test USDT, and gas
4. Give you a ready-to-use `.env`

```bash
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_MERCHANT_ID=your_project
GOATX402_API_KEY=...
GOATX402_API_SECRET=... # backend only, never expose
```

<aside>
⚡

You do not need to know what you are building yet. Get credentials first. Setup takes about 5 minutes.

</aside>

### Step 3: Add x402 to your backend

**Install**

```bash
npm install goatx402-sdk-server
# or Go:
go get github.com/GOATNetwork/goatx402-go
```

**Express example**

```jsx
import { GoatX402 } from 'goatx402-sdk-server'
const x402 = new GoatX402({
	apiUrl: process.env.GOATX402_API_URL,
	apiKey: process.env.GOATX402_API_KEY,
	apiSecret: process.env.GOATX402_API_SECRET,
	merchantId: process.env.GOATX402_MERCHANT_ID,
})
```

```jsx
// Any route behind this requires payment
app.use('/api/generate', x402.middleware({ amount: '0.1', symbol: 'USDC' }))
```

<aside>
⚠️

HTTP **402 is expected** in x402. It means “please pay this amount.” Do not treat it as an error.

</aside>

### Step 4: ERC-8004 identity (usually done by **@goathackbot**)

If **@goathackbot** registered you, your agent identity is already on-chain. You can update it any time.

```jsx
// Update your agent description on-chain
await identityRegistry.setAgentURI(agentId, newMetadataURI)
```

To link x402 payments to reputation, include `proofOfPayment` in feedback:

```json
{
	"proofOfPayment": {
		"fromAddress": "0x...",
		"toAddress": "0x...",
		"chainId": 48816,
		"txHash": "0x..."
	}
}
```