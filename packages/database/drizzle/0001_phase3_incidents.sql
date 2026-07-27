CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id),
  type text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  first_observed_value real,
  latest_observed_value real,
  threshold_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_active_query_idx ON incidents(integration_id, active, started_at);
CREATE INDEX IF NOT EXISTS incidents_history_query_idx ON incidents(integration_id, started_at, type);
CREATE UNIQUE INDEX IF NOT EXISTS incidents_one_active_per_key_idx ON incidents(integration_id, dedupe_key) WHERE active;

CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id),
  incident_type text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  warning_threshold real,
  critical_threshold real,
  persistence_seconds bigint NOT NULL,
  recovery_seconds bigint NOT NULL,
  cooldown_seconds bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_rules_scope_type_unique UNIQUE(integration_id, incident_type)
);

CREATE TABLE IF NOT EXISTS alert_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id),
  type text NOT NULL,
  severity text NOT NULL,
  message text NOT NULL,
  occurred_at timestamptz NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz
);
CREATE INDEX IF NOT EXISTS alert_occurrences_query_idx ON alert_occurrences(occurred_at, acknowledged);
CREATE INDEX IF NOT EXISTS alert_occurrences_incident_idx ON alert_occurrences(incident_id, occurred_at);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id),
  summary_date text NOT NULL,
  data jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_summaries_integration_day_unique UNIQUE(integration_id, summary_date)
);
