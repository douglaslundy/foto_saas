-- Allow guest checkout: orders don't require a logged-in user
ALTER TABLE orders ALTER COLUMN client_user_id DROP NOT NULL;

-- Add columns needed for e-commerce if not present
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
