
CREATE TABLE IF NOT EXISTS public.email_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  lead_id UUID NOT NULL,
  user_id UUID NOT NULL,
  original_url TEXT NOT NULL,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  is_unique BOOLEAN NOT NULL DEFAULT true,
  short_code TEXT
);

ALTER TABLE public.email_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages email_clicks" ON public.email_clicks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own email_clicks" ON public.email_clicks
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_email_clicks_campaign ON public.email_clicks (campaign_id);
CREATE INDEX idx_email_clicks_lead ON public.email_clicks (lead_id);
CREATE INDEX idx_email_clicks_user ON public.email_clicks (user_id);
CREATE INDEX idx_email_clicks_dedup ON public.email_clicks (campaign_id, lead_id, original_url, is_unique, clicked_at);
