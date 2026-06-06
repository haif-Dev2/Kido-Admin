-- =============================================================================
-- Kido — Complete Supabase schema (mobile + admin)
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- ─── 1. profiles (one row per auth user) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text UNIQUE NOT NULL,
  first_name  text,
  last_name   text,
  role        text NOT NULL DEFAULT 'parent' CHECK (role IN ('parent','sitter','admin')),
  city        text,
  bio         text,
  photo_url   text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_role  ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

-- ─── 2. bookings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id              bigserial PRIMARY KEY,
  parent_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  baby_sitter_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date      timestamptz NOT NULL,
  end_date        timestamptz NOT NULL,
  duration        int NOT NULL,
  total_price     numeric(10,2) NOT NULL,
  status          text NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','DECLINED')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_parent   ON public.bookings (parent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_sitter   ON public.bookings (baby_sitter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status   ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_created  ON public.bookings (created_at DESC);

-- ─── 3. reviews ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id            bigserial PRIMARY KEY,
  booking_id    bigint REFERENCES public.bookings(id) ON DELETE SET NULL,
  parent_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  babysitter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating        int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  is_flagged    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_babysitter ON public.reviews (babysitter_id);
CREATE INDEX IF NOT EXISTS idx_reviews_flagged    ON public.reviews (is_flagged) WHERE is_flagged;

-- ─── 4. reports (admin moderation queue) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  reporter_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason       text NOT NULL,
  notes        text,
  evidence     text,
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status       text NOT NULL DEFAULT 'open'   CHECK (status   IN ('open','investigating','resolved','closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON public.reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.reports (priority);

-- ─── 5. verifications (sitter verification queue) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.verifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text UNIQUE NOT NULL,
  sitter_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  id_type           text,
  selfie_url        text,
  cv_url            text,
  references_count  int DEFAULT 0,
  experience        text,
  score             int,
  reviewed_by       uuid REFERENCES public.profiles(id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON public.verifications (status);

-- ─── 6. audit_log (append-only admin action history) ────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           bigserial PRIMARY KEY,
  actor_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name   text,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  detail       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);

-- ─── 7. Auto-create a profile when a new auth user signs up ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'parent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 8. is_admin() helper for RLS ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- ─── 9. Row-level security ──────────────────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;

-- profiles: users see their own row; admins see all
DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "admins manage profiles" ON public.profiles;
CREATE POLICY "admins manage profiles" ON public.profiles FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- bookings: involved parties see their bookings; admins see all
DROP POLICY IF EXISTS "parties read bookings" ON public.bookings;
CREATE POLICY "parties read bookings" ON public.bookings FOR SELECT
  USING (auth.uid() = parent_id OR auth.uid() = baby_sitter_id OR public.is_admin());

DROP POLICY IF EXISTS "parents create bookings" ON public.bookings;
CREATE POLICY "parents create bookings" ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

DROP POLICY IF EXISTS "parties update bookings" ON public.bookings;
CREATE POLICY "parties update bookings" ON public.bookings FOR UPDATE
  USING (auth.uid() = parent_id OR auth.uid() = baby_sitter_id OR public.is_admin());

-- reviews: anyone can read; parent writes their own; admins manage all
DROP POLICY IF EXISTS "anyone read reviews" ON public.reviews;
CREATE POLICY "anyone read reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "parents write own reviews" ON public.reviews;
CREATE POLICY "parents write own reviews" ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

DROP POLICY IF EXISTS "admins manage reviews" ON public.reviews;
CREATE POLICY "admins manage reviews" ON public.reviews FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- reports/verifications/audit_log: admin only
DROP POLICY IF EXISTS "admins manage reports" ON public.reports;
CREATE POLICY "admins manage reports" ON public.reports FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins manage verifications" ON public.verifications;
CREATE POLICY "admins manage verifications" ON public.verifications FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins read audit" ON public.audit_log;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT
  USING (public.is_admin());

-- ─── 10. Backfill: create profiles for any existing auth users ──────────────
INSERT INTO public.profiles (id, email, first_name, last_name, role)
SELECT
  u.id,
  u.email,
  NULLIF(u.raw_user_meta_data->>'first_name', ''),
  NULLIF(u.raw_user_meta_data->>'last_name', ''),
  COALESCE(u.raw_user_meta_data->>'role', 'parent')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = u.id);

-- ─── 11. Promote the project owner to admin ─────────────────────────────────
UPDATE public.profiles SET role = 'admin' WHERE email = 'aboubakarnait@gmail.com';
