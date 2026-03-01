import type { IProviderStore } from "./interface";
import { createLogger } from "@/lib/logger";

const log = createLogger("store");

function createStore(): IProviderStore {
  if (process.env.DATABASE_URL) {
    log.info("Store: using Neon (PostgreSQL)");
    const { NeonProviderStore } = require("./neon");
    return new NeonProviderStore();
  }
  log.info("Store: using in-memory");
  const { MemoryProviderStore } = require("./memory");
  return new MemoryProviderStore();
}

export const store: IProviderStore = createStore();
