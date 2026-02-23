
-- 1. Tracking page settings per user
CREATE TABLE public.tracking_page_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  logo_url TEXT,
  background_color TEXT NOT NULL DEFAULT '#f8fafc',
  button_text TEXT NOT NULL DEFAULT 'Acessar conteúdo',
  button_color TEXT NOT NULL DEFAULT '#3b82f6',
  button_font_color TEXT NOT NULL DEFAULT '#ffffff',
  redirect_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_page_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracking_page_settings"
  ON public.tracking_page_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracking_page_settings"
  ON public.tracking_page_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracking_page_settings"
  ON public.tracking_page_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can read (for public tracking page)
CREATE POLICY "Service role can read tracking_page_settings"
  ON public.tracking_page_settings FOR SELECT
  USING (auth.role() = 'service_role');

-- 2. Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('tracking-logos', 'tracking-logos', true);

CREATE POLICY "Users can upload own tracking logo"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'tracking-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own tracking logo"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'tracking-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Tracking logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tracking-logos');

-- 3. Add clicked_at to campaign_leads
ALTER TABLE public.campaign_leads ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE;

-- 4. Add total_clicked to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS total_clicked INTEGER NOT NULL DEFAULT 0;

-- 5. Trigger for updated_at on tracking_page_settings
CREATE TRIGGER update_tracking_page_settings_updated_at
  BEFORE UPDATE ON public.tracking_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
