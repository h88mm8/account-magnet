
-- Unified integrations table for LinkedIn and Email (WhatsApp keeps its own table)
CREATE TABLE public.user_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL, -- 'linkedin', 'email'
  status TEXT NOT NULL DEFAULT 'disconnected', -- 'disconnected', 'pending', 'connected', 'expired'
  unipile_account_id TEXT,
  provider_email TEXT, -- for email: which email account is connected
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
  ON public.user_integrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations"
  ON public.user_integrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations"
  ON public.user_integrations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for status monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_integrations;

-- Add provider_id to prospect_list_items for LinkedIn caching
ALTER TABLE public.prospect_list_items
  ADD COLUMN IF NOT EXISTS provider_id TEXT;
