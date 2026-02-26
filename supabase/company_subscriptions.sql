CREATE TABLE IF NOT EXISTS public.company_subscriptions (
  company_id uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text,
  price_id text,
  current_period_end timestamptz,
  updated_at timestamptz DEFAULT now()
);
