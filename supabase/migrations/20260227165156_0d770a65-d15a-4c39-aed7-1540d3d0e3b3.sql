
CREATE TABLE public.campaign_email_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL,
  user_id uuid NOT NULL,
  lead_id uuid,
  provider text NOT NULL DEFAULT 'resend',
  sender_email text,
  external_message_id text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages campaign_email_logs" ON public.campaign_email_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Users can view own campaign_email_logs" ON public.campaign_email_logs FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_campaign_email_logs_campaign ON public.campaign_email_logs (campaign_id);
CREATE INDEX idx_campaign_email_logs_user ON public.campaign_email_logs (user_id);
