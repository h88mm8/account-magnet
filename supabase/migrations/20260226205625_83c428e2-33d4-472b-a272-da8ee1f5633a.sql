
-- 1. Create admin role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: only admins can read user_roles, service role can manage
CREATE POLICY "Service role manages user_roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Create billing_welcome_config table
CREATE TABLE public.billing_welcome_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leads_credits integer NOT NULL DEFAULT 50,
  email_credits integer NOT NULL DEFAULT 0,
  phone_credits integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.billing_welcome_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages billing_welcome_config"
  ON public.billing_welcome_config FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view billing_welcome_config"
  ON public.billing_welcome_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update billing_welcome_config"
  ON public.billing_welcome_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert billing_welcome_config"
  ON public.billing_welcome_config FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.billing_welcome_config (leads_credits, email_credits, phone_credits) VALUES (50, 0, 0);

-- 3. Create billing_products table
CREATE TABLE public.billing_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type text NOT NULL,
  billing_type text NOT NULL DEFAULT 'one_time',
  stripe_product_id text,
  stripe_price_id text,
  unit_price integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'brl',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages billing_products"
  ON public.billing_products FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view billing_products"
  ON public.billing_products FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update billing_products"
  ON public.billing_products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert billing_products"
  ON public.billing_products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Create billing_price_history table
CREATE TABLE public.billing_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_product_id uuid REFERENCES public.billing_products(id) NOT NULL,
  old_price integer NOT NULL,
  new_price integer NOT NULL,
  old_stripe_price_id text,
  new_stripe_price_id text,
  changed_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages billing_price_history"
  ON public.billing_price_history FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view billing_price_history"
  ON public.billing_price_history FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Update handle_new_user to apply welcome credits from config
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_leads integer;
  v_email integer;
  v_phone integer;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- Get welcome credits config
  SELECT leads_credits, email_credits, phone_credits
  INTO v_leads, v_email, v_phone
  FROM public.billing_welcome_config
  LIMIT 1;

  -- Apply welcome credits
  IF v_leads > 0 OR v_email > 0 OR v_phone > 0 THEN
    INSERT INTO public.user_credits_separated (user_id, leads_balance, email_balance, phone_balance)
    VALUES (NEW.id, COALESCE(v_leads, 50), COALESCE(v_email, 0), COALESCE(v_phone, 0))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Authenticated users can read billing_products (needed for checkout pages)
CREATE POLICY "Authenticated can view active billing_products"
  ON public.billing_products FOR SELECT TO authenticated
  USING (active = true);
