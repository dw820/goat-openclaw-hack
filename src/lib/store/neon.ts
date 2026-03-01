import { neon } from "@neondatabase/serverless";
import type { Provider, RegisterProviderRequest } from "@/lib/types";
import type { IProviderStore } from "./interface";
import { createLogger } from "@/lib/logger";

const log = createLogger("store");

interface ProviderRow {
  id: string;
  name: string;
  model: string;
  endpoint: string;
  pricing_amount: string;
  pricing_symbol: string;
  wallet_address: string;
  agent_id: string | null;
  models: string[] | null;
  status: "online" | "offline";
  registered_at: string;
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    model: row.model,
    endpoint: row.endpoint,
    pricing: { amount: row.pricing_amount, symbol: row.pricing_symbol },
    walletAddress: row.wallet_address,
    agentId: row.agent_id ?? undefined,
    models: row.models ?? undefined,
    status: row.status,
    registeredAt: row.registered_at,
  };
}

export class NeonProviderStore implements IProviderStore {
  private sql = neon(process.env.DATABASE_URL!);

  async getAll(modelFilter?: string): Promise<Provider[]> {
    log.debug("DB query: getAll", { filter: modelFilter });
    let rows: ProviderRow[];
    if (modelFilter) {
      rows = (await this.sql`
        SELECT * FROM providers
        WHERE ${modelFilter.toLowerCase()} = ANY (SELECT lower(unnest(models)))
           OR lower(model) LIKE ${"%" + modelFilter.toLowerCase() + "%"}
      `) as ProviderRow[];
    } else {
      rows = (await this.sql`SELECT * FROM providers`) as ProviderRow[];
    }
    return rows.map(rowToProvider);
  }

  async getById(id: string): Promise<Provider | undefined> {
    log.debug("DB query: getById", { id });
    const rows = (await this.sql`
      SELECT * FROM providers WHERE id = ${id}
    `) as ProviderRow[];
    return rows[0] ? rowToProvider(rows[0]) : undefined;
  }

  async add(req: RegisterProviderRequest, models?: string[]): Promise<Provider> {
    log.info("DB insert: provider", { name: req.name });
    const rows = (await this.sql`
      INSERT INTO providers (name, model, endpoint, pricing_amount, pricing_symbol, wallet_address, agent_id, models)
      VALUES (
        ${req.name},
        ${req.model!},
        ${req.endpoint},
        ${req.pricing.amount},
        ${req.pricing.symbol},
        ${req.walletAddress},
        ${req.agentId ?? null},
        ${models ?? null}
      )
      RETURNING *
    `) as ProviderRow[];
    return rowToProvider(rows[0]);
  }

  async remove(id: string): Promise<boolean> {
    log.info("DB delete: provider", { id });
    const rows = (await this.sql`
      DELETE FROM providers WHERE id = ${id} RETURNING id
    `) as { id: string }[];
    return rows.length > 0;
  }
}
