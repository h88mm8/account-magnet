-- Email blocklist table for automatic bounce/spam blocking
CREATE TABLE IF NOT EXISTS public.email_blocklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'bounce',
  bounce_count INTEGER NOT NULL DEFAULT 1,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.email_blocklist ENABLE ROW LEVEL SECURITY;

-- Users can view their own blocklist
CREATE POLICY "Users can view own blocklist" ON public.email_blocklist
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert into their own blocklist
CREATE POLICY "Users can insert own blocklist" ON public.email_blocklist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own blocklist
CREATE POLICY "Users can update own blocklist" ON public.email_blocklist
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete from their own blocklist (unblock)
CREATE POLICY "Users can delete own blocklist" ON public.email_blocklist
  FOR DELETE USING (auth.uid() = user_id);

-- Service role full access for edge functions
CREATE POLICY "Service role manages blocklist" ON public.email_blocklist
  FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookup during dispatch
CREATE INDEX IF NOT EXISTS idx_email_blocklist_lookup ON public.email_blocklist (user_id, email);