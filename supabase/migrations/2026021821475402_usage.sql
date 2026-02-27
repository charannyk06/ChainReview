-- Detailed usage records
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  tool_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_records_user_date ON public.usage_records (user_id, created_at DESC);

-- Daily aggregated usage
CREATE TABLE IF NOT EXISTS public.usage_daily (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- Function to atomically increment daily usage
CREATE OR REPLACE FUNCTION public.increment_daily_usage(
  p_user_id UUID,
  p_date DATE,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.usage_daily (user_id, date, total_input_tokens, total_output_tokens, request_count)
  VALUES (p_user_id, p_date, p_input_tokens, p_output_tokens, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_input_tokens = usage_daily.total_input_tokens + p_input_tokens,
    total_output_tokens = usage_daily.total_output_tokens + p_output_tokens,
    request_count = usage_daily.request_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage records"
  ON public.usage_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own daily usage"
  ON public.usage_daily FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (via API proxy)
CREATE POLICY "Service role can insert usage records"
  ON public.usage_records FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can insert daily usage"
  ON public.usage_daily FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update daily usage"
  ON public.usage_daily FOR UPDATE
  USING (true);
