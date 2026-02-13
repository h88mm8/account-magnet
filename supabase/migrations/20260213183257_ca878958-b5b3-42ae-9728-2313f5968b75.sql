
-- Table to store WhatsApp connection status per user
CREATE TABLE public.whatsapp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  unipile_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_whatsapp UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connection
CREATE POLICY "Users can view their own whatsapp connection"
ON public.whatsapp_connections FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own connection
CREATE POLICY "Users can create their own whatsapp connection"
ON public.whatsapp_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection
CREATE POLICY "Users can update their own whatsapp connection"
ON public.whatsapp_connections FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can update any (for webhook)
CREATE POLICY "Service role can manage all whatsapp connections"
ON public.whatsapp_connections FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_connections;

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_connections_updated_at
BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
