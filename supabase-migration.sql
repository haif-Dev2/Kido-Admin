-- =============================================================================
-- Kido Admin — Supabase migration
-- Run this once in your Supabase SQL editor (project: udrmlimrbhimfmisfvtw)
-- =============================================================================

-- 1. Add `role` column to profiles if it doesn't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'parent'
    CHECK (role IN ('parent', 'sitter', 'admin'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- 2. Reports table (user-submitted complaints)
CREATE TABLE IF NOT EXISTS public.reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,                  -- e.g. "R-3127"
  reporter_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason          text NOT NULL,
  notes           text,
  evidence        text,
  priority        text NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON public.reports (priority);

-- 3. Verifications table (sitter verification queue)
CREATE TABLE IF NOT EXISTS public.verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,                  -- e.g. "V-481"
  sitter_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  id_type         text,                                  -- 'National ID' or 'Passport'
  selfie_url      text,
  cv_url          text,
  references_count int DEFAULT 0,
  experience      text,
  score           int,                                   -- ML similarity score 0-100
  reviewed_by     uuid REFERENCES public.profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON public.verifications (status);

-- 4. Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              bigserial PRIMARY KEY,
  actor_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name      text,                                  -- snapshot if user deleted later
  action          text NOT NULL,                         -- 'approved', 'rejected', 'banned', etc.
  entity_type     text NOT NULL,                         -- 'verification', 'user', 'report', 'review'
  entity_id       text NOT NULL,
  detail          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log (created_at DESC);

-- 5. Row-level security: only admins can read these tables
ALTER TABLE public.reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log      ENABLE ROW LEVEL SECURITY;

-- Helper function: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "admins read reports" ON public.reports;
CREATE POLICY "admins read reports" ON public.reports
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins write reports" ON public.reports;
CREATE POLICY "admins write reports" ON public.reports
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins read verifications" ON public.verifications;
CREATE POLICY "admins read verifications" ON public.verifications
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admins write verifications" ON public.verifications;
CREATE POLICY "admins write verifications" ON public.verifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins read audit" ON public.audit_log;
CREATE POLICY "admins read audit" ON public.audit_log
  FOR SELECT USING (public.is_admin());

-- 6. (Optional) Promote an existing user to admin
-- Run this AFTER creating your admin account through the mobile app's normal signup:
--
--   UPDATE public.profiles
--   SET role = 'admin'
--   WHERE email = 'YOUR_ADMIN_EMAIL@example.com';

-- =============================================================================
-- Done. The admin console can now query reports, verifications, audit_log, profiles.
-- =============================================================================
