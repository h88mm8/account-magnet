ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS cta_button_text text DEFAULT 'Acessar site',
  ADD COLUMN IF NOT EXISTS cta_button_color text DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS cta_button_font_color text DEFAULT '#ffffff';