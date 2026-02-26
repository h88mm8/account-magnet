
CREATE TABLE public.web_tracking_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  site_url text,
  gtm_id text,
  org_token text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.web_tracking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own web_tracking_settings" ON public.web_tracking_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own web_tracking_settings" ON public.web_tracking_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own web_tracking_settings" ON public.web_tracking_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages web_tracking_settings" ON public.web_tracking_settings FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_web_tracking_settings_updated_at
  BEFORE UPDATE ON public.web_tracking_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
