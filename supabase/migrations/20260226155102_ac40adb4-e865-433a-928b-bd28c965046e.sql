
CREATE TABLE public.resend_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  resend_api_key_encrypted text,
  sender_domain text,
  sender_name text DEFAULT 'Minha Empresa',
  sender_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.resend_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own resend_settings" ON public.resend_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own resend_settings" ON public.resend_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own resend_settings" ON public.resend_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role manages resend_settings" ON public.resend_settings
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_resend_settings_updated_at
  BEFORE UPDATE ON public.resend_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
