CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_users_owner_role CHECK (role = 'owner')
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_idx ON auth_users(email);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_one_owner_idx ON auth_users(role) WHERE role = 'owner';
