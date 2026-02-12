
ALTER TABLE public.prospect_list_items
ADD COLUMN email_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN phone_checked_at TIMESTAMP WITH TIME ZONE;
