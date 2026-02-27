-- Subscription events from Stripe (Phase 4)
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  stripe_event_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  event_type TEXT NOT NULL,
  plan TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_events_user ON public.subscription_events (user_id, created_at DESC);
CREATE INDEX idx_subscription_events_stripe ON public.subscription_events (stripe_customer_id);

-- Stripe customer mapping
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription events"
  ON public.subscription_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stripe customer"
  ON public.stripe_customers FOR SELECT
  USING (auth.uid() = user_id);
