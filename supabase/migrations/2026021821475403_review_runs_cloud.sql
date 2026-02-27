-- Cloud-synced review run summaries (Phase 3)
CREATE TABLE IF NOT EXISTS public.review_runs_cloud (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  repo_name TEXT,
  mode TEXT,
  findings_count INTEGER DEFAULT 0,
  severity_breakdown JSONB DEFAULT '{}',
  duration_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_review_runs_cloud_user ON public.review_runs_cloud (user_id, created_at DESC);

-- API key storage for BYOK management via dashboard (Phase 3)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON public.api_keys (user_id);

-- RLS
ALTER TABLE public.review_runs_cloud ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own review runs"
  ON public.review_runs_cloud FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own review runs"
  ON public.review_runs_cloud FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own API keys"
  ON public.api_keys FOR ALL
  USING (auth.uid() = user_id);
