
-- Add UPDATE policy for prospect_list_items (needed for enrichment)
CREATE POLICY "Users can update own list items"
ON public.prospect_list_items
FOR UPDATE
USING (auth.uid() = user_id);
