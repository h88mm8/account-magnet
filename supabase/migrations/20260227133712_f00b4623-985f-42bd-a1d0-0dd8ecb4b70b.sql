
-- Table for unit prices (admin-configurable)
CREATE TABLE public.credit_unit_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_type text NOT NULL UNIQUE CHECK (credit_type IN ('phone', 'email')),
  unit_price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'brl',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.credit_unit_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages credit_unit_prices" ON public.credit_unit_prices FOR ALL USING (auth.role() = 'service_role'::text);
CREATE POLICY "Admins can view credit_unit_prices" ON public.credit_unit_prices FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update credit_unit_prices" ON public.credit_unit_prices FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can view credit_unit_prices" ON public.credit_unit_prices FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed default prices (in centavos)
INSERT INTO public.credit_unit_prices (credit_type, unit_price_cents) VALUES
  ('phone', 50),
  ('email', 10);

-- Stripe events idempotency table
CREATE TABLE public.stripe_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages stripe_events" ON public.stripe_events FOR ALL USING (auth.role() = 'service_role'::text);

-- Credit topups log
CREATE TABLE public.credit_topups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  stripe_session_id text,
  phone_credits integer NOT NULL DEFAULT 0,
  email_credits integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'brl',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages credit_topups" ON public.credit_topups FOR ALL USING (auth.role() = 'service_role'::text);
CREATE POLICY "Users can view own credit_topups" ON public.credit_topups FOR SELECT USING (auth.uid() = user_id);

-- Idempotent function to apply dynamic credit topup
CREATE OR REPLACE FUNCTION public.apply_dynamic_credit_topup(
  p_stripe_event_id text,
  p_user_id uuid,
  p_phone_credits integer,
  p_email_credits integer,
  p_stripe_session_id text DEFAULT NULL,
  p_amount_paid_cents integer DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Idempotency check
  IF EXISTS (SELECT 1 FROM stripe_events WHERE stripe_event_id = p_stripe_event_id) THEN
    RETURN false;
  END IF;

  -- Record event
  INSERT INTO stripe_events (stripe_event_id, event_type) VALUES (p_stripe_event_id, 'checkout.session.completed');

  -- Record topup
  INSERT INTO credit_topups (user_id, stripe_session_id, phone_credits, email_credits, amount_paid_cents)
  VALUES (p_user_id, p_stripe_session_id, p_phone_credits, p_email_credits, p_amount_paid_cents);

  -- Add phone credits
  IF p_phone_credits > 0 THEN
    PERFORM add_phone_credits(p_user_id, p_phone_credits, 'Compra dinâmica Stripe: ' || p_phone_credits || ' créditos de telefone');
  END IF;

  -- Add email credits
  IF p_email_credits > 0 THEN
    PERFORM add_email_credits(p_user_id, p_email_credits, 'Compra dinâmica Stripe: ' || p_email_credits || ' créditos de email');
  END IF;

  RETURN true;
END;
$$;
