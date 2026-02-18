
-- Fix overly permissive policies: restrict service role writes to actual service_role
DROP POLICY IF EXISTS "Service role full access link_tracking" ON public.link_tracking;
DROP POLICY IF EXISTS "Service role full access link_clicks"   ON public.link_clicks;
DROP POLICY IF EXISTS "Service role full access notifications" ON public.notifications;

CREATE POLICY "Service role insert link_tracking"
  ON public.link_tracking FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role update link_tracking"
  ON public.link_tracking FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "Service role delete link_tracking"
  ON public.link_tracking FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "Service role insert link_clicks"
  ON public.link_clicks FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role update link_clicks"
  ON public.link_clicks FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "Service role insert notifications"
  ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role delete notifications"
  ON public.notifications FOR DELETE USING (auth.role() = 'service_role');
