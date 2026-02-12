
-- Add enrichment tracking columns to prospect_list_items
ALTER TABLE public.prospect_list_items
  ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apify_run_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apify_called boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apify_finished boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apify_email_found boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apollo_called boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS apollo_reason text DEFAULT NULL;

-- Enable realtime for prospect_list_items so frontend can react to webhook updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospect_list_items;
