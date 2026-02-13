
-- Drop the overly permissive policy
DROP POLICY "Service role can manage all whatsapp connections" ON public.whatsapp_connections;
