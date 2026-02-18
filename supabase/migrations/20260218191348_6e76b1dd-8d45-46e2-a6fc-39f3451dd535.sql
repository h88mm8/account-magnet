
-- ══════════════════════════════════════════════
-- instances: uma instância = um número WhatsApp
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.instances (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID        NOT NULL,
  name                TEXT        NOT NULL,
  unipile_account_id  TEXT,
  status              TEXT        NOT NULL DEFAULT 'disconnected',
  -- send delay config (seconds)
  min_delay_seconds   INTEGER     NOT NULL DEFAULT 5,
  max_delay_seconds   INTEGER     NOT NULL DEFAULT 30,
  -- daily limit with reset tracking
  daily_send_limit    INTEGER     NOT NULL DEFAULT 50,
  daily_sent_count    INTEGER     NOT NULL DEFAULT 0,
  daily_reset_at      TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own instances"
  ON public.instances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own instances"
  ON public.instances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own instances"
  ON public.instances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own instances"
  ON public.instances FOR DELETE USING (auth.uid() = user_id);

-- ══════════════════════════════════════════════
-- messages_sent: histórico de mensagens enviadas
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.messages_sent (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        NOT NULL,
  instance_id           UUID        REFERENCES public.instances(id) ON DELETE SET NULL,
  lead_id               UUID,
  campaign_id           UUID        REFERENCES public.campaigns(id) ON DELETE SET NULL,
  campaign_lead_id      UUID        REFERENCES public.campaign_leads(id) ON DELETE SET NULL,
  workflow_instance_id  TEXT,
  node_id               TEXT,
  -- message content
  phone                 TEXT,
  content               TEXT,
  media_url             TEXT,
  message_type          TEXT        NOT NULL DEFAULT 'text',
  -- delivery tracking
  status                TEXT        NOT NULL DEFAULT 'sent',
  unipile_message_id    TEXT,
  error_message         TEXT,
  sent_at               TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at          TIMESTAMP WITH TIME ZONE,
  read_at               TIMESTAMP WITH TIME ZONE,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages_sent"
  ON public.messages_sent FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages_sent"
  ON public.messages_sent FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own messages_sent"
  ON public.messages_sent FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage messages_sent"
  ON public.messages_sent FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_messages_sent_user_id     ON public.messages_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_campaign_id ON public.messages_sent(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_lead_id     ON public.messages_sent(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_unipile_id  ON public.messages_sent(unipile_message_id);

-- ══════════════════════════════════════════════
-- messages_received: mensagens recebidas via webhook
-- ══════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.messages_received (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        NOT NULL,
  instance_id           UUID        REFERENCES public.instances(id) ON DELETE SET NULL,
  lead_id               UUID,
  unipile_message_id    TEXT,
  unipile_chat_id       TEXT,
  phone                 TEXT,
  content               TEXT,
  media_url             TEXT,
  message_type          TEXT        NOT NULL DEFAULT 'text',
  received_at           TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- workflow reference
  workflow_instance_id  TEXT,
  raw_payload           JSONB,
  created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages_received"
  ON public.messages_received FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage messages_received"
  ON public.messages_received FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_messages_received_user_id    ON public.messages_received(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_received_lead_id    ON public.messages_received(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_received_chat_id    ON public.messages_received(unipile_chat_id);

-- updated_at trigger for instances
CREATE TRIGGER update_instances_updated_at
  BEFORE UPDATE ON public.instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- updated_at trigger for messages_sent
CREATE TRIGGER update_messages_sent_updated_at
  BEFORE UPDATE ON public.messages_sent
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
