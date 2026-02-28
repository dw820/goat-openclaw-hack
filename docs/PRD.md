# Product Requirements Document: EXO Broker Agent

**Project Name:** EXO Broker Agent (Internal Codename: "Lobster Compute Pimp 3000" 🦞)
**Version:** 1.0 (MVP for 4-Hour Hackathon)
**Date:** February 24, 2026
**Author:** Manus AI

---

## 1. Vision & Opportunity

### 1.1. Problem Statement

The vast majority of consumer computing power, such as personal laptops and smartphones, remains idle over 90% of the time. Concurrently, the demand for computational resources for training and running frontier Large Language Models (LLMs) is insatiable. Access to this compute is typically gatekept by centralized cloud providers, creating a costly and permissioned environment. There is no simple, decentralized mechanism for individuals to lease their idle hardware for meaningful yield.

### 1.2. Vision

We envision a decentralized physical infrastructure network (DePIN) for AI compute, orchestrated by an autonomous AI agent. This project, the EXO Broker Agent, will turn any group of consumer MacBooks into a Bitcoin-native compute cluster. Users will be able to join the network with a single command, allowing an AI agent to broker inference jobs, handle micropayments, and distribute rewards, all settled on-chain.

### 1.3. Hackathon Goal

Within a 4-hour timeframe, we will build and demonstrate a functional Minimum Viable Product (MVP) that showcases the core user flow: a contributor renting out their MacBook, a client paying for and running a 70B parameter LLM inference task, and an AI agent brokering the entire transaction with an on-chain identity.

## 2. Target Users (Hackathon Demo)

*   **Primary:** Hackathon judges and audience.
*   **Secondary (Actors):**
    *   **Client:** A user who wants to run a large model inference task cheaply.
    *   **Contributor:** A user who wants to earn rewards by renting out their idle MacBook.

## 3. Core MVP Features

This MVP is scoped exclusively for a successful 4-hour build and live demonstration. All features are considered critical for the happy path.

| Feature ID | Description | Time Est. | Priority |
| :--- | :--- | :--- | :--- |
| **AGENT-01** | **OpenClaw Agent Setup:** Initialize the agent on the Coral platform with a distinct "chaotic lobster" personality defined in `SOUL.md`. | 15 min | Must-Have |
| **COMP-01** | **EXO Cluster Setup:** Launch `exo` on 2-3 local MacBooks, allowing them to auto-discover each other on the LAN and form a compute cluster. | 30 min | Must-Have |
| **AGENT-02** | **Contributor Join Flow:** Create a custom OpenClaw skill (`join-cluster`) that instructs a new user how to run the `exo` command to join the cluster. | 15 min | Must-Have |
| **AGENT-03** | **Inference Routing Skill:** Create a skill (`route-inference`) that allows the agent to accept a user's prompt and forward it to the EXO cluster's OpenAI-compatible API endpoint (`/v1/chat/completions`). | 45 min | Must-Have |
| **PAY-01** | **x402 Payment Skill:** Create a skill (`demand-payment`) that returns an HTTP 402 response, demanding a micropayment before performing inference. **(See Section 4.1 for critical technical clarification)**. | 45 min | Must-Have |
| **ID-01** | **ERC-8004 Agent Identity:** Mint an ERC-8004 compliant NFT on the GOAT Testnet3 to serve as the agent's on-chain identity. | 20 min | Must-Have |
| **DEMO-01** | **Live Demo Script & Rehearsal:** Prepare and rehearse a concise, high-impact 60-second live demonstration script. | 60 min | Must-Have |

## 4. Technical Architecture & Implementation

### 4.1. Core Technology Stack

| Layer | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Orchestration** | **OpenClaw on Coral** | The central agent brain, using custom `SKILL.md` files to manage all workflows. [1] |
| **Compute** | **EXO (v1.0.67+)** | Forms a distributed inference cluster from local MacBooks. Provides an OpenAI-compatible API at `http://<coordinator-ip>:52415`. [2] |
| **Identity** | **ERC-8004 on GOAT Testnet** | An ERC-721 NFT will be minted on the GOAT Testnet3 to represent the agent's identity, verifiable on the explorer. [3] |
| **Payments** | **x402 on Base Sepolia** | An x402-enabled endpoint will demand a stablecoin micropayment. This will be handled by the public `x402.org` testnet facilitator. [4] |

### 4.2. Critical Technical Correction: x402 Payments

The initial concept specified using "testnet BTC on GOAT" for payments. However, the x402 protocol is designed for **stablecoin (e.g., USDC) payments**, not native Bitcoin. Furthermore, the public testnet facilitators for x402 primarily support EVM-compatible testnets like **Base Sepolia**. Attempting to force a BTC payment on GOAT via x402 is not feasible within the hackathon scope.

**MVP Solution:** We will proceed with the most direct and technically sound approach:

1.  **Identity on GOAT:** The agent's ERC-8004 identity NFT **will** be minted on the GOAT Testnet3 as planned, satisfying the hackathon track requirement.
2.  **Payments on Base Sepolia:** The x402 payment **will** be conducted using testnet USDC on the Base Sepolia testnet, utilizing the public and reliable `https://x402.org/facilitator`. This ensures the payment flow is functional and demonstrable.

This hybrid approach allows us to meet the spirit of the hackathon requirements while using the tools as intended, dramatically de-risking the project.

## 5. MVP Happy Path: Live Demo Flow (60 Seconds)

**Pre-Demo Setup (First 45 mins of hackathon):**
1.  Launch the OpenClaw agent with the lobster `SOUL.md`.
2.  Run `uv run exo` on 2-3 MacBooks on the same Wi-Fi. Note the coordinator IP.
3.  Deploy an ERC-8004 Identity Registry contract to GOAT Testnet3 and mint the agent's NFT.

**Live Demo Script:**

*   **(0-15s) Contributor Joins:**
    *   **Client:** "Hey Lobster, how can my friend rent out their MacBook?"
    *   **Agent:** "Peasant, run this command on your laptop: `git clone https://github.com/exo-explore/exo && cd exo && uv run exo`. Now, what's your IP? 🦞"
    *   *(Friend runs the command and provides their IP. EXO dashboard on the projector shows the cluster growing.)*
    *   **Agent:** "Welcome to the swarm. Your MacBook is now a money printer."

*   **(15-30s) Load Model:**
    *   **Client:** "Broker, load Llama-3.1-70B on the cluster."
    *   **Agent:** *(Hits the EXO API)* "70B model loaded across 3 devices. 3.2x speedup achieved. Ready to pimp."

*   **(30-45s) Pay for Inference:**
    *   **Client:** "Write a haiku about lobsters on Bitcoin."
    *   **Agent:** "HTTP 402 - Pay 0.01 USDC on Base Sepolia or get nothing. [x402 payment link appears]"
    *   *(Client clicks the link, which triggers a MetaMask transaction on the Base Sepolia testnet.)*

*   **(45-60s) Get Result & Flex:**
    *   *(Upon payment confirmation, the agent instantly forwards the prompt to the EXO `/v1/chat/completions` endpoint.)*
    *   *(The haiku streams back in real-time while the live TFLOPS dashboard is shown on screen.)*
    *   **Agent:** "Job complete. Contributor earned a simulated 30% yield. My ERC-8004 reputation just went +1. Next victim?"

## 6. Success Criteria

*   The agent has a verifiable ERC-8004 identity NFT on the GOAT Testnet3 explorer.
*   At least one real x402 payment is successfully processed on the Base Sepolia testnet.
*   A large language model (70B preferred, 8B as fallback) runs visibly faster with 2+ devices in the EXO cluster.
*   The entire user flow is demonstrated live within 60-90 seconds.
*   The agent's "unhinged lobster" personality is clearly conveyed.

## 7. Out of Scope (Post-Hackathon Wish List)

*   Global node discovery (libp2p relay, Tailscale).
*   Automated, on-chain yield distribution to contributors.
*   Support for model training (DiLoCo).
*   Mobile client for joining the EXO cluster.
*   On-chain reputation updates to the ERC-8004 token.

---

## 8. Appendix: MVP Code & Configs

### 8.1. GOAT Testnet3 Config

*   **RPC:** `https://rpc.testnet3.goat.network`
*   **Chain ID:** `48816`
*   **Explorer:** `https://explorer.testnet3.goat.network`

### 8.2. OpenClaw `SKILL.md` (Example: `demand-payment`)

```markdown
---
name: demand-payment
description: Returns an HTTP 402 response to demand payment before running inference.
---

# Instructions

When the user asks for inference but has not paid, you MUST return an HTTP 402 error. You will implement a simple Node.js Express server with the `@x402/express` middleware. This server will have one endpoint, `/inference`, that is protected by the payment requirement.

**Code Snippet for your x402 server:**

```javascript
import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';

const app = express();
const PORT = 4021;
const evmAddress = 'YOUR_WALLET_ADDRESS'; // Replace with your wallet address

// Use the public testnet facilitator
const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://x402.org/facilitator'
});

const server = new x402ResourceServer(facilitatorClient)
  .register('eip155:84532', new ExactEvmScheme()); // Base Sepolia

app.use(paymentMiddleware({
  'POST /inference': {
    accepts: [{
      scheme: 'exact',
      price: '$0.01', // Price in USDC
      network: 'eip155:84532',
      payTo: evmAddress,
    }],
    description: 'LLM Inference Request',
  }
}, server));

// This route is only reached after successful payment
app.post('/inference', (req, res) => {
  // The actual call to the EXO cluster would happen here
  console.log('Payment successful! Forwarding to EXO cluster...');
  res.send({ status: 'paid', message: 'Forwarding to EXO for inference.' });
});

app.listen(PORT, () => {
  console.log(`x402 server listening at http://localhost:${PORT}`);
});
```
```

### 8.3. ERC-8004 Registration File (`agent.json`)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Lobster Compute Pimp 3000",
  "description": "A chaotic lobster OpenClaw agent that turns any room full of Macs into a Bitcoin-native DePIN compute cluster using EXO.",
  "image": "ipfs://<YOUR_IMAGE_CID>",
  "services": [
    {
      "name": "A2A",
      "endpoint": "https://your-agent-url/.well-known/agent-card.json",
      "version": "0.3.0"
    }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [
    {
      "agentId": 1,
      "agentRegistry": "eip155:48816:0x..."
    }
  ],
  "supportedTrust": []
}
```

---

### References

[1] OpenClaw Documentation. (2026). *Skills*. [https://docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills)
[2] exo-explore on GitHub. (2026). *exo: Run frontier AI locally*. [https://github.com/exo-explore/exo](https://github.com/exo-explore/exo)
[3] Ethereum Improvement Proposals. (2025). *EIP-8004: Trustless Agents*. [https://eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004)
[4] x402 Protocol Documentation. (2026). *Quickstart for Sellers*. [https://docs.x402.org/getting-started/quickstart-for-sellers](https://docs.x402.org/getting-started/quickstart-for-sellers)
