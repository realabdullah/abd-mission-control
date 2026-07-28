CREATE TABLE IF NOT EXISTS speed_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id),
  state text NOT NULL,
  bytes_transferred bigint NOT NULL,
  download_bps real,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  error text
);
CREATE INDEX IF NOT EXISTS speed_tests_query_idx ON speed_tests(integration_id, completed_at DESC);
