import assert from "node:assert";
import type { IProviderStore } from "./interface";
import type { RegisterProviderRequest } from "@/lib/types";
import { MemoryProviderStore } from "./memory";

const testReq: RegisterProviderRequest = {
  name: "test-provider",
  model: "gpt-4o",
  endpoint: "http://localhost:3001",
  pricing: { amount: "0.01", symbol: "USDC" },
  walletAddress: "0xTEST",
};

async function runSuite(label: string, store: IProviderStore) {
  console.log(`\n--- ${label} ---`);

  // add
  const added = await store.add(testReq, ["gpt-4o", "gpt-4o-mini"]);
  assert.ok(added.id, "add: should return an id");
  assert.strictEqual(added.status, "online");
  assert.ok(added.registeredAt, "add: should have registeredAt");
  console.log("  ✓ add");

  // getAll
  const all = await store.getAll();
  assert.ok(all.some((p) => p.id === added.id), "getAll: should include added");
  console.log("  ✓ getAll");

  // getAll (filter)
  const filtered = await store.getAll("gpt-4o-mini");
  assert.ok(
    filtered.some((p) => p.id === added.id),
    "getAll(filter): should match model",
  );
  const noMatch = await store.getAll("nonexistent-model-xyz");
  assert.ok(
    !noMatch.some((p) => p.id === added.id),
    "getAll(filter): should not match wrong model",
  );
  console.log("  ✓ getAll (filter)");

  // getById
  const found = await store.getById(added.id);
  assert.ok(found, "getById: should find added provider");
  assert.strictEqual(found!.name, testReq.name);
  console.log("  ✓ getById");

  // getById (not found)
  const notFound = await store.getById("nonexistent-id");
  assert.strictEqual(notFound, undefined, "getById: unknown id → undefined");
  console.log("  ✓ getById (not found)");

  // remove
  const removed = await store.remove(added.id);
  assert.strictEqual(removed, true, "remove: should return true");
  const afterRemove = await store.getById(added.id);
  assert.strictEqual(afterRemove, undefined, "remove: getById should return undefined");
  console.log("  ✓ remove");

  // remove (not found)
  const removedAgain = await store.remove(added.id);
  assert.strictEqual(removedAgain, false, "remove: unknown id → false");
  console.log("  ✓ remove (not found)");
}

async function main() {
  // Always test memory store (no seed data to keep assertions simple)
  await runSuite("MemoryProviderStore", new MemoryProviderStore({ seed: false }));

  // Conditionally test Neon store
  if (process.env.DATABASE_URL) {
    const { NeonProviderStore } = await import("./neon");
    await runSuite("NeonProviderStore", new NeonProviderStore());
  } else {
    console.log("\n--- NeonProviderStore ---");
    console.log("  ⏭ skipped (DATABASE_URL not set)");
  }

  console.log("\nAll tests passed.");
}

main().catch((err) => {
  console.error("\nTest failed:", err);
  process.exit(1);
});
