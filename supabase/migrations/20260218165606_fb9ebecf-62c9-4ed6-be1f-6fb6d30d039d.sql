
-- 1. link_tracking: stores each unique tracked link sent to a lead
CREATE TABLE IF NOT EXISTS public.link_tracking (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  lead_id     uuid NOT NULL,
  campaign_lead_id uuid,
  original_url text NOT NULL,
  short_code  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.link_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link_tracking"
  ON public.link_tracking FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access link_tracking"
  ON public.link_tracking FOR ALL USING (true) WITH CHECK (true);

-- 2. link_clicks: every raw click event
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id  uuid NOT NULL REFERENCES public.link_tracking(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  lead_id      uuid NOT NULL,
  ip_address   text,
  user_agent   text,
  is_unique    boolean NOT NULL DEFAULT false,
  clicked_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own link_clicks"
  ON public.link_clicks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access link_clicks"
  ON public.link_clicks FOR ALL USING (true) WITH CHECK (true);

-- 3. Add link_clicks_count to prospect_list_items (unique clicks counter per lead)
ALTER TABLE public.prospect_list_items
  ADD COLUMN IF NOT EXISTS link_clicks_count integer NOT NULL DEFAULT 0;

-- 4. notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  type       text NOT NULL DEFAULT 'link_click',
  title      text NOT NULL,
  body       text,
  data       jsonb,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access notifications"
  ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- 5. notification_preferences on profiles (add columns)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_inapp_enabled   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_enabled   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_email           text,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_whatsapp_number text;

-- 6. Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
