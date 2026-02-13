
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'linkedin')),
  linkedin_type TEXT CHECK (linkedin_type IN ('connection_request', 'inmail', 'message')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  list_id UUID REFERENCES public.prospect_lists(id) ON DELETE SET NULL,
  subject TEXT,
  message_template TEXT,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_replied INTEGER NOT NULL DEFAULT 0,
  total_failed INTEGER NOT NULL DEFAULT 0,
  total_accepted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign leads table
CREATE TABLE public.campaign_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.prospect_list_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'opened', 'replied', 'failed', 'accepted', 'bounced')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  webhook_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaign leads" ON public.campaign_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaign leads" ON public.campaign_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaign leads" ON public.campaign_leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaign leads" ON public.campaign_leads FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_campaign_leads_updated_at BEFORE UPDATE ON public.campaign_leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for campaign_leads to reflect status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_leads;

-- Index for queue processing
CREATE INDEX idx_campaign_leads_status ON public.campaign_leads(status, campaign_id);
CREATE INDEX idx_campaigns_user_status ON public.campaigns(user_id, status);
