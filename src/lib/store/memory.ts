import type { Provider, RegisterProviderRequest } from "@/lib/types";
import type { IProviderStore } from "./interface";
import { getSeedProviders } from "./seed";
import { createLogger } from "@/lib/logger";

const log = createLogger("store");

export class MemoryProviderStore implements IProviderStore {
  private providers = new Map<string, Provider>();

  constructor(opts?: { seed?: boolean }) {
    if (opts?.seed !== false && process.env.SEED_PROVIDERS !== "false") {
      const seeds = getSeedProviders();
      for (const p of seeds) {
        this.providers.set(p.id, p);
      }
      log.debug(`Seeded ${seeds.length} providers`);
    }
  }

  getAll(modelFilter?: string): Provider[] {
    const all = Array.from(this.providers.values());
    if (!modelFilter) return all;
    const lower = modelFilter.toLowerCase();
    return all.filter((p) =>
      p.models?.some((m) => m.toLowerCase().includes(lower)) ??
      p.model.toLowerCase().includes(lower),
    );
  }

  getById(id: string): Provider | undefined {
    return this.providers.get(id);
  }

  add(req: RegisterProviderRequest, models?: string[]): Provider {
    const id = crypto.randomUUID();
    const provider: Provider = {
      ...req,
      id,
      model: req.model!,
      models,
      status: "online",
      registeredAt: new Date().toISOString(),
    };
    this.providers.set(id, provider);
    log.debug("Provider added", { id, name: provider.name });
    return provider;
  }

  remove(id: string): boolean {
    const found = this.providers.delete(id);
    log.debug("Provider removed", { id, found });
    return found;
  }
}
