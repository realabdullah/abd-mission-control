CREATE TABLE IF NOT EXISTS path_probes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id),
  kind text NOT NULL,
  target text NOT NULL,
  status text NOT NULL,
  latency_ms real,
  observed_at timestamptz NOT NULL,
  detail text
);
CREATE INDEX IF NOT EXISTS path_probes_query_idx ON path_probes(integration_id, observed_at DESC);
