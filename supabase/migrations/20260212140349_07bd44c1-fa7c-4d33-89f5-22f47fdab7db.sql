
-- Add enrichment columns to prospect_list_items
ALTER TABLE public.prospect_list_items
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS enrichment_source text;

-- enrichment_source will store 'apify' or 'apollo'
