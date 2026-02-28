# Product Requirements Document: Decentralized Inference Broker

**Project Name:** Decentralized Inference Broker
**Version:** 2.0 (MVP for 4-Hour Hackathon)
**Date:** February 27, 2026
**Author:** Manus AI

---

## 1. Vision & Opportunity

### 1.1. Problem Statement

Access to powerful Large Language Models (LLMs) is often controlled by a few large companies, creating centralized points of failure and high costs. While many individuals and smaller entities run their own open-source models on local hardware (using tools like Ollama, LM Studio, etc.), there is no simple, decentralized way for them to monetize their idle compute and offer their models to a wider audience.

### 1.2. Vision

We envision a **decentralized marketplace for AI inference**, orchestrated by an autonomous AI agent. This project, the Decentralized Inference Broker, allows anyone with a running LLM and an OpenAI-compatible API endpoint to register as a provider. The broker agent handles discovery, pricing, and payment gating, creating a permissionless and censorship-resistant network for AI services, with identity and reputation anchored on-chain.

### 1.3. Hackathon Goal

Within a 4-hour timeframe, we will build and demonstrate a functional Minimum Viable Product (MVP) that showcases the core user flow: a **contributor** registering their local Ollama endpoint, a **client** paying for and running an inference task against it, and the **broker agent** managing the entire transaction with an on-chain identity.

## 2. Target Users (Hackathon Demo)

*   **Primary:** Hackathon judges and audience.
*   **Secondary (Actors):**
    *   **Client:** A user who wants to access a specific LLM cheaply.
    *   **Contributor:** A user running a local LLM (e.g., via Ollama) who wants to monetize it.

## 3. Core MVP Features

This MVP is scoped exclusively for a successful 4-hour build and live demonstration.

| Feature ID | Description | Time Est. | Priority |
| :--- | :--- | :--- | :--- |
| **AGENT-01** | **OpenClaw Agent Setup:** Initialize the agent on the Coral platform with a distinct "broker" personality. | 15 min | Must-Have |
| **AGENT-02** | **Provider Registration Skill:** Create a skill (`register-endpoint`) that allows a contributor to provide their OpenAI-compatible endpoint URL and the model they are serving. | 30 min | Must-Have |
| **AGENT-03** | **Inference Proxy Skill:** Create a skill (`route-inference`) that accepts a user's prompt, demands payment, and upon success, proxies the request to the registered contributor's endpoint. | 60 min | Must-Have |
| **PAY-01** | **x402 Payment Gating:** The `route-inference` skill will return an HTTP 402 response, demanding a micropayment before proxying the request. | 45 min | Must-Have |
| **ID-01** | **ERC-8004 Agent Identity:** Mint an ERC-8004 compliant NFT on the GOAT Testnet3 to serve as the agent's on-chain identity. | 20 min | Must-Have |
| **DEMO-01** | **Live Demo Script & Rehearsal:** Prepare and rehearse a concise, high-impact 60-second live demonstration script. | 60 min | Must-Have |

## 4. Technical Architecture & Implementation

### 4.1. Core Technology Stack

| Layer | Technology | Implementation Details |
| :--- | :--- | :--- |
| **Orchestration** | **OpenClaw on Coral** | The central agent brain, using custom `SKILL.md` files to manage all workflows. [1] |
| **Compute** | **Any OpenAI-Compatible Endpoint** | Contributors can use Ollama, LM Studio, vLLM, etc. The agent only needs the endpoint URL (e.g., `http://<ip>:11434`). |
| **Identity** | **ERC-8004 on GOAT Testnet** | An ERC-721 NFT will be minted on the GOAT Testnet3 to represent the agent's identity, verifiable on the explorer. [2] |
| **Payments** | **x402 on Base Sepolia** | An x402-enabled endpoint will demand a stablecoin micropayment, handled by the public `x402.org` testnet facilitator. [3] |

### 4.2. Technical Note: Testnet Selection

To ensure a smooth and successful demo, we will use the most appropriate testnet for each component:

1.  **Identity on GOAT:** The agent's ERC-8004 identity NFT **will** be minted on the GOAT Testnet3 as planned, satisfying the hackathon track requirement.
2.  **Payments on Base Sepolia:** The x402 payment **will** be conducted using testnet USDC on the Base Sepolia testnet, utilizing the public and reliable `https://x402.org/facilitator`. This is the standard, documented way to test x402.

## 5. MVP Happy Path: Live Demo Flow (60 Seconds)

**Pre-Demo Setup:**
1.  Launch the OpenClaw agent.
2.  On a contributor's laptop, start Ollama and pull a model (e.g., `ollama run llama3`).
3.  Mint the agent's ERC-8004 identity NFT on GOAT Testnet3.

**Live Demo Script:**

*   **(0-15s) Contributor Registers Endpoint:**
    *   **Contributor:** "Hey Broker, I'm running Llama 3 on my laptop. Here's my Ollama endpoint: `http://192.168.1.10:11434`."
    *   **Agent:** "Endpoint registered. You are now live in the decentralized inference market. Awaiting a client to make you some money."

*   **(15-30s) Client Requests Inference:**
    *   **Client:** "Broker, I need to use Llama 3. Write a haiku about decentralized AI."
    *   **Agent:** "I have a provider for that model. But first, you must pay. HTTP 402 - Pay 0.01 USDC on Base Sepolia. [x402 payment link appears]"

*   **(30-45s) Client Pays:**
    *   *(Client clicks the link, which triggers a MetaMask transaction on the Base Sepolia testnet.)*
    *   *(The agent's x402 server receives the payment confirmation.)*

*   **(45-60s) Inference is Proxied & Returned:**
    *   **Agent:** "Payment received. Proxying your request to the provider..."
    *   *(The agent's backend makes a POST request to the contributor's Ollama endpoint: `http://192.168.1.10:11434/v1/chat/completions`)*
    *   *(The haiku streams back in real-time from the contributor's machine, through the agent, to the client.)*
    *   **Agent:** "Job complete. My on-chain reputation grows. Next?"

## 6. Success Criteria

*   The agent successfully registers a contributor's OpenAI-compatible endpoint.
*   The agent successfully gates a request with an x402 payment on Base Sepolia.
*   Upon payment, the agent successfully proxies the request to the contributor's endpoint and returns the result.
*   The agent has a verifiable ERC-8004 identity NFT on the GOAT Testnet3 explorer.
*   The entire user flow is demonstrated live within 60-90 seconds.

## 7. Out of Scope (Post-Hackathon Wish List)

*   Automated discovery of providers (e.g., via a registry contract).
*   Dynamic pricing based on supply/demand or model size.
*   On-chain revenue splitting and settlement to contributors.
*   Support for multiple providers and load balancing.
*   On-chain reputation updates to the ERC-8004 token.

---

### References

[1] OpenClaw Documentation. (2026). *Skills*. [https://docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills)
[2] Ethereum Improvement Proposals. (2025). *EIP-8004: Trustless Agents*. [https://eips.ethereum.org/EIPS/eip-8004](https://eips.ethereum.org/EIPS/eip-8004)
[3] x402 Protocol Documentation. (2026). *Quickstart for Sellers*. [https://docs.x402.org/getting-started/quickstart-for-sellers](https://docs.x402.org/getting-started/quickstart-for-sellers)