CREATE TABLE IF NOT EXISTS providers (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name           TEXT NOT NULL,
  model          TEXT NOT NULL,
  endpoint       TEXT NOT NULL,
  pricing_amount TEXT NOT NULL,
  pricing_symbol TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  agent_id       TEXT,
  models         TEXT[],
  status         TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline')),
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_models ON providers USING GIN (models);
