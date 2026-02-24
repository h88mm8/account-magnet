
-- ============================================
-- WORKFLOW ENGINE - PHASE 1 TABLES
-- ============================================

-- 1. workflows
CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual',
  trigger_list_id uuid REFERENCES public.prospect_lists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'paused',
  schedule_days text[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  schedule_start_time time DEFAULT '08:00',
  schedule_end_time time DEFAULT '18:00',
  schedule_timezone text DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workflows" ON public.workflows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own workflows" ON public.workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own workflows" ON public.workflows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own workflows" ON public.workflows FOR DELETE USING (auth.uid() = user_id);

-- 2. workflow_nodes
CREATE TABLE public.workflow_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'start',
  config jsonb DEFAULT '{}'::jsonb,
  next_node_id uuid,
  true_node_id uuid,
  false_node_id uuid,
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;

-- RLS via workflow ownership
CREATE OR REPLACE FUNCTION public.owns_workflow(wf_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workflows WHERE id = wf_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users can view own workflow nodes" ON public.workflow_nodes FOR SELECT USING (public.owns_workflow(workflow_id));
CREATE POLICY "Users can insert own workflow nodes" ON public.workflow_nodes FOR INSERT WITH CHECK (public.owns_workflow(workflow_id));
CREATE POLICY "Users can update own workflow nodes" ON public.workflow_nodes FOR UPDATE USING (public.owns_workflow(workflow_id));
CREATE POLICY "Users can delete own workflow nodes" ON public.workflow_nodes FOR DELETE USING (public.owns_workflow(workflow_id));

-- Self-references for node links
ALTER TABLE public.workflow_nodes ADD CONSTRAINT fk_next_node FOREIGN KEY (next_node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_nodes ADD CONSTRAINT fk_true_node FOREIGN KEY (true_node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL;
ALTER TABLE public.workflow_nodes ADD CONSTRAINT fk_false_node FOREIGN KEY (false_node_id) REFERENCES public.workflow_nodes(id) ON DELETE SET NULL;

-- 3. workflow_executions
CREATE TABLE public.workflow_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.prospect_list_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  current_node_id uuid REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  next_run_at timestamptz DEFAULT now(),
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own executions" ON public.workflow_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own executions" ON public.workflow_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own executions" ON public.workflow_executions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own executions" ON public.workflow_executions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages executions" ON public.workflow_executions FOR ALL USING (auth.role() = 'service_role');

-- Index for processor queries
CREATE INDEX idx_wf_exec_pending ON public.workflow_executions (status, next_run_at) WHERE status = 'running';
CREATE INDEX idx_wf_exec_workflow ON public.workflow_executions (workflow_id);
CREATE INDEX idx_wf_exec_contact ON public.workflow_executions (contact_id);

-- 4. events (unified tracking)
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_id uuid REFERENCES public.prospect_list_items(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  workflow_id uuid REFERENCES public.workflows(id) ON DELETE SET NULL,
  workflow_execution_id uuid REFERENCES public.workflow_executions(id) ON DELETE SET NULL,
  channel text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events" ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages events" ON public.events FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_events_contact ON public.events (contact_id, event_type);
CREATE INDEX idx_events_workflow ON public.events (workflow_execution_id, event_type);
CREATE INDEX idx_events_channel ON public.events (channel, event_type, created_at);

-- 5. workflow_execution_logs (for debugging)
CREATE TABLE public.workflow_execution_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id uuid NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  node_id uuid REFERENCES public.workflow_nodes(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_execution(exec_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workflow_executions WHERE id = exec_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "Users can view own execution logs" ON public.workflow_execution_logs FOR SELECT USING (public.owns_execution(execution_id));
CREATE POLICY "Service role manages execution logs" ON public.workflow_execution_logs FOR ALL USING (auth.role() = 'service_role');

-- 6. Trigger: auto-create executions when contact added to list
CREATE OR REPLACE FUNCTION public.trigger_workflow_on_list_add()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wf RECORD;
  start_node_id uuid;
BEGIN
  -- Find active workflows triggered by this list
  FOR wf IN
    SELECT id FROM public.workflows
    WHERE trigger_type = 'added_to_list'
      AND trigger_list_id = NEW.list_id
      AND status = 'active'
  LOOP
    -- Find the start node
    SELECT id INTO start_node_id
    FROM public.workflow_nodes
    WHERE workflow_id = wf.id AND type = 'start'
    LIMIT 1;

    IF start_node_id IS NOT NULL THEN
      -- Avoid duplicate executions for same contact+workflow
      INSERT INTO public.workflow_executions (workflow_id, contact_id, user_id, current_node_id, status, next_run_at)
      VALUES (wf.id, NEW.id, NEW.user_id, start_node_id, 'running', now())
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_workflow_on_list_add
  AFTER INSERT ON public.prospect_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_workflow_on_list_add();

-- 7. Unique constraint to prevent duplicate executions
ALTER TABLE public.workflow_executions ADD CONSTRAINT uq_workflow_contact UNIQUE (workflow_id, contact_id);

-- 8. updated_at triggers
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON public.workflow_executions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
