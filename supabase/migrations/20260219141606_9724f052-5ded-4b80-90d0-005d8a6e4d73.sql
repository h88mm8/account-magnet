
-- Create email_settings table to store per-user email signature and scheduling link
CREATE TABLE IF NOT EXISTS public.email_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  email_signature text,
  scheduling_link text,
  scheduling_title text DEFAULT 'Agende uma conversa',
  scheduling_duration text DEFAULT '30 min',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email_settings"
  ON public.email_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email_settings"
  ON public.email_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email_settings"
  ON public.email_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
