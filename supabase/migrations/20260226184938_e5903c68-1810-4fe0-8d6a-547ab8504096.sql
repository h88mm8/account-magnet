
-- Separated credits table
CREATE TABLE public.user_credits_separated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  leads_balance integer NOT NULL DEFAULT 50,
  email_balance integer NOT NULL DEFAULT 0,
  phone_balance integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits_separated ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own separated credits" ON public.user_credits_separated FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own separated credits" ON public.user_credits_separated FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own separated credits" ON public.user_credits_separated FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages separated credits" ON public.user_credits_separated FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_user_credits_separated_updated_at BEFORE UPDATE ON public.user_credits_separated FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Channel licenses table
CREATE TABLE public.channel_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'inactive',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);

ALTER TABLE public.channel_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own channel licenses" ON public.channel_licenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own channel licenses" ON public.channel_licenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own channel licenses" ON public.channel_licenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages channel licenses" ON public.channel_licenses FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_channel_licenses_updated_at BEFORE UPDATE ON public.channel_licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing balances to leads_balance
INSERT INTO public.user_credits_separated (user_id, leads_balance)
SELECT user_id, balance FROM public.user_credits
ON CONFLICT (user_id) DO UPDATE SET leads_balance = EXCLUDED.leads_balance;

-- RPC functions for separated credits
CREATE OR REPLACE FUNCTION public.deduct_leads_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  INSERT INTO user_credits_separated (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT leads_balance INTO v_balance FROM user_credits_separated WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance < p_amount THEN RETURN -1; END IF;
  UPDATE user_credits_separated SET leads_balance = leads_balance - p_amount WHERE user_id = p_user_id;
  INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (p_user_id, -p_amount, 'leads_deduct', p_description);
  RETURN v_balance - p_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_email_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  INSERT INTO user_credits_separated (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT email_balance INTO v_balance FROM user_credits_separated WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance < p_amount THEN RETURN -1; END IF;
  UPDATE user_credits_separated SET email_balance = email_balance - p_amount WHERE user_id = p_user_id;
  INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (p_user_id, -p_amount, 'email_deduct', p_description);
  RETURN v_balance - p_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_phone_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  INSERT INTO user_credits_separated (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT phone_balance INTO v_balance FROM user_credits_separated WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance < p_amount THEN RETURN -1; END IF;
  UPDATE user_credits_separated SET phone_balance = phone_balance - p_amount WHERE user_id = p_user_id;
  INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (p_user_id, -p_amount, 'phone_deduct', p_description);
  RETURN v_balance - p_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_leads_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  INSERT INTO user_credits_separated (user_id, leads_balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET leads_balance = user_credits_separated.leads_balance + p_amount;
  SELECT leads_balance INTO v_balance FROM user_credits_separated WHERE user_id = p_user_id;
  INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (p_user_id, p_amount, 'leads_topup', p_description);
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_email_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  INSERT INTO user_credits_separated (user_id, email_balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET email_balance = user_credits_separated.email_balance + p_amount;
  SELECT email_balance INTO v_balance FROM user_credits_separated WHERE user_id = p_user_id;
  INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (p_user_id, p_amount, 'email_topup', p_description);
  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_phone_credits(p_user_id uuid, p_amount integer, p_description text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance integer;
BEGIN
  INSERT INTO user_credits_separated (user_id, phone_balance) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET phone_balance = user_credits_separated.phone_balance + p_amount;
  SELECT phone_balance INTO v_balance FROM user_credits_separated WHERE user_id = p_user_id;
  INSERT INTO credit_transactions (user_id, amount, type, description) VALUES (p_user_id, p_amount, 'phone_topup', p_description);
  RETURN v_balance;
END;
$$;
