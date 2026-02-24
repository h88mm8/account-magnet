
-- Add scheduling fields to campaigns table
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS schedule_days text[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  ADD COLUMN IF NOT EXISTS schedule_start_time time WITHOUT TIME ZONE DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS schedule_end_time time WITHOUT TIME ZONE DEFAULT '18:00:00',
  ADD COLUMN IF NOT EXISTS schedule_timezone text DEFAULT 'America/Sao_Paulo';

-- Create campaign_steps table for multi-step sequences
CREATE TABLE IF NOT EXISTS public.campaign_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step_order integer NOT NULL DEFAULT 1,
  step_type text NOT NULL DEFAULT 'message',
  message_template text,
  subject text,
  delay_days integer NOT NULL DEFAULT 0,
  delay_hours integer NOT NULL DEFAULT 0,
  condition_type text DEFAULT 'no_reply',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add unique constraint for step ordering
ALTER TABLE public.campaign_steps
  ADD CONSTRAINT campaign_steps_unique_order UNIQUE (campaign_id, step_order);

-- Enable RLS
ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own campaign steps"
  ON public.campaign_steps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaign steps"
  ON public.campaign_steps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaign steps"
  ON public.campaign_steps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaign steps"
  ON public.campaign_steps FOR DELETE
  USING (auth.uid() = user_id);

-- Service role access for edge functions
CREATE POLICY "Service role manages campaign steps"
  ON public.campaign_steps FOR ALL
  USING (auth.role() = 'service_role');

-- Updated at trigger
CREATE TRIGGER update_campaign_steps_updated_at
  BEFORE UPDATE ON public.campaign_steps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
