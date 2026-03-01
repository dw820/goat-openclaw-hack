import { neon } from "@neondatabase/serverless";
import { getSeedProviders } from "../store/seed";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const providers = getSeedProviders();

  for (const p of providers) {
    console.log(`Seeding provider: ${p.name} (${p.id})`);
    await sql`
      INSERT INTO providers (id, name, model, endpoint, pricing_amount, pricing_symbol, wallet_address, agent_id, models, status, registered_at)
      VALUES (
        ${p.id},
        ${p.name},
        ${p.model},
        ${p.endpoint},
        ${p.pricing.amount},
        ${p.pricing.symbol},
        ${p.walletAddress},
        ${p.agentId ?? null},
        ${p.models ?? null},
        ${p.status},
        ${p.registeredAt}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`  Done.`);
  }

  console.log("Seeding complete.");
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
