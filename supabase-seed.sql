-- =============================================================================
-- Kido seed data — gives the admin console real content to show
-- Run AFTER supabase-full-schema.sql.
-- Idempotent: ON CONFLICT DO NOTHING means re-running is safe.
-- =============================================================================

DO $$
DECLARE
  amina_id    uuid := '11111111-1111-1111-1111-111111111111';
  yasmine_id  uuid := '22222222-2222-2222-2222-222222222222';
  fatima_id   uuid := '33333333-3333-3333-3333-333333333333';
  nour_id     uuid := '44444444-4444-4444-4444-444444444444';
  parent1_id  uuid := '55555555-5555-5555-5555-555555555555';
  parent2_id  uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  -- ─── 1. Create the auth.users rows first (FK target for profiles) ────────
  INSERT INTO auth.users (id, email, instance_id, aud, role, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
  VALUES
    (amina_id,   'amina@kido.dz',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), false, false),
    (yasmine_id, 'yasmine@kido.dz', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), false, false),
    (fatima_id,  'fatima@kido.dz',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), false, false),
    (nour_id,    'nour@kido.dz',    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), false, false),
    (parent1_id, 'sarah@kido.dz',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), false, false),
    (parent2_id, 'imane@kido.dz',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '{}'::jsonb, now(), now(), false, false)
  ON CONFLICT (id) DO NOTHING;

  -- ─── 2. Sitters ─────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, first_name, last_name, role, city, bio, phone)
  VALUES
    (amina_id,   'amina@kido.dz',   'Amina',   'Khelifi',   'sitter', 'Algiers', '5 years experience with toddlers. CPR certified.',                          '+213 555 12 34 56'),
    (yasmine_id, 'yasmine@kido.dz', 'Yasmine', 'Benali',    'sitter', 'Algiers', 'Pediatric nursing student. Comfortable with infants.',                      '+213 555 23 45 67'),
    (fatima_id,  'fatima@kido.dz',  'Fatima',  'Zerrouki',  'sitter', 'Oran',    '8 years of professional childcare. Worked long-term with three families.', '+213 555 34 56 78'),
    (nour_id,    'nour@kido.dz',    'Nour',    'Hadji',     'sitter', 'Algiers', 'Looking for evening shifts. First aid trained.',                            '+213 555 45 67 89')
  ON CONFLICT (id) DO NOTHING;

  -- ─── 3. Parents ─────────────────────────────────────────────────────────
  INSERT INTO public.profiles (id, email, first_name, last_name, role, city, phone)
  VALUES
    (parent1_id, 'sarah@kido.dz',  'Sarah',  'Khodja',  'parent', 'Algiers', '+213 555 56 78 90'),
    (parent2_id, 'imane@kido.dz',  'Imane',  'Daoud',   'parent', 'Oran',    '+213 555 67 89 01')
  ON CONFLICT (id) DO NOTHING;

  -- ─── 4. Bookings ────────────────────────────────────────────────────────
  INSERT INTO public.bookings (parent_id, baby_sitter_id, start_date, end_date, duration, total_price, status)
  VALUES
    (parent1_id, amina_id,   now() + interval '1 day',    now() + interval '1 day 4 hours',                  4,  800, 'PENDING'),
    (parent1_id, yasmine_id, now() - interval '2 hours',  now() + interval '2 hours',                        4, 1000, 'IN_PROGRESS'),
    (parent2_id, fatima_id,  now() - interval '5 days',   now() - interval '5 days' + interval '4 hours',    4, 1250, 'COMPLETED'),
    (parent2_id, nour_id,    now() - interval '3 days',   now() - interval '3 days' + interval '3 hours',    3,  720, 'CANCELLED'),
    (parent1_id, fatima_id,  now() + interval '3 days',   now() + interval '3 days' + interval '5 hours',    5, 1500, 'CONFIRMED')
  ON CONFLICT DO NOTHING;

  -- ─── 5. Reviews ─────────────────────────────────────────────────────────
  INSERT INTO public.reviews (parent_id, babysitter_id, rating, comment)
  VALUES
    (parent2_id, fatima_id, 5, 'Excellent! Our daughter loved her. Very professional.'),
    (parent1_id, amina_id,  5, 'Amina is amazing with kids — would book again.'),
    (parent2_id, nour_id,   2, 'Cancelled last minute. Would not book again.')
  ON CONFLICT DO NOTHING;

  -- ─── 6. Verification queue ──────────────────────────────────────────────
  INSERT INTO public.verifications (code, sitter_id, status, id_type, selfie_url, cv_url, references_count, experience, score)
  VALUES
    ('V-001', yasmine_id, 'pending', 'National ID', 'https://example.com/selfie1', 'https://example.com/cv1', 2, '3-5 years',  88),
    ('V-002', nour_id,    'pending', 'National ID', 'https://example.com/selfie2', NULL,                       0, '< 1 year',   42)
  ON CONFLICT (code) DO NOTHING;

  -- ─── 7. Reports ─────────────────────────────────────────────────────────
  INSERT INTO public.reports (code, reporter_id, target_id, reason, notes, priority, status)
  VALUES
    ('R-001', parent1_id, nour_id, 'No-show twice in a row',  'Pattern of cancellations within 30 min of booking start.', 'critical', 'open'),
    ('R-002', parent2_id, nour_id, 'Repeated cancellations',  'Third cancellation in two weeks.',                          'high',     'investigating')
  ON CONFLICT (code) DO NOTHING;

  -- ─── 8. Audit log ───────────────────────────────────────────────────────
  INSERT INTO public.audit_log (actor_name, action, entity_type, entity_id, detail)
  VALUES
    ('System',      'auto-flagged', 'profile',      nour_id::text,    'Cancellation rate exceeded threshold (3 in 14 days).'),
    ('Henni Fouad', 'opened',       'report',       'R-001',          'Investigation started.'),
    ('Henni Fouad', 'approved',     'verification', 'V-prev-001',     'All documents valid. Sitter promoted to verified.'),
    ('System',      'closed',       'report',       'R-prev-098',     'Auto-resolved after 7 days without dispute.')
  ON CONFLICT DO NOTHING;
END $$;

-- Verification: how many rows of each?
SELECT
  (SELECT count(*) FROM public.profiles)      AS profiles,
  (SELECT count(*) FROM public.bookings)      AS bookings,
  (SELECT count(*) FROM public.reviews)       AS reviews,
  (SELECT count(*) FROM public.verifications) AS verifications,
  (SELECT count(*) FROM public.reports)       AS reports,
  (SELECT count(*) FROM public.audit_log)     AS audit_log;
