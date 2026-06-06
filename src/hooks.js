// React hooks that fetch admin data from Supabase.
// Falls back to mock data automatically while loading or if a query fails.

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from './supabase';

// Module-level SWR cache: survives page unmount/remount so navigating back to
// a page shows the last-fetched data instantly instead of reverting to mock data.
const _cache = new Map();
import {
  USERS            as MOCK_USERS,
  BOOKINGS         as MOCK_BOOKINGS,
  REPORTS          as MOCK_REPORTS,
  VERIFICATIONS    as MOCK_VERIFICATIONS,
  FLAGGED_REVIEWS  as MOCK_REVIEWS,
  AUDIT_LOG        as MOCK_AUDIT,
  KPI_DATA         as MOCK_KPI,
  TRANSACTIONS     as MOCK_TRANSACTIONS,
  SUSPENSIONS      as MOCK_SUSPENSIONS,
  DELETED_ACCOUNTS as MOCK_DELETED_ACCOUNTS,
  ADMIN_SETTINGS   as MOCK_ADMIN_SETTINGS,
  FLAGGED_PHOTOS    as MOCK_FLAGGED_PHOTOS,
  SITTER_EARNINGS   as MOCK_SITTER_EARNINGS,
  MODERATION_RULES  as MOCK_MODERATION_RULES,
} from './data.jsx';

/**
 * Generic async hook with mock fallback + optional realtime subscription.
 */
// cacheKey: stable string used to persist results across page unmounts.
// Pass null to skip caching (e.g. per-user detail queries).
function useQuery(fetchFn, fallback, realtime = null, cacheKey = null) {
  // Initialise from cache so the page renders with real data on re-visit
  // instead of reverting to mock data and re-fetching from scratch.
  const [data, setData] = useState(() => (cacheKey && _cache.has(cacheKey)) ? _cache.get(cacheKey) : fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Skip real queries when there's no Supabase session so RLS-silenced
      // empty results don't replace the mock fallback data in demo mode.
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) { setLoading(false); return; }

      try {
        const rows = await fetchRef.current();
        if (!mounted) return;
        const result = rows && rows.length > 0 ? rows : fallback;
        if (cacheKey) _cache.set(cacheKey, result);
        setData(result);
      } catch (e) {
        if (!mounted) return;
        console.warn('[admin] query failed, using mock:', e.message);
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!realtime?.table) return;
    // Fresh ID per effect invocation — survives React StrictMode double-mount.
    const channelName = `admin:${realtime.table}:${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: realtime.table },
        async () => {
          try {
            const rows = await fetchRef.current();
            const result = rows && rows.length > 0 ? rows : fallback;
            if (cacheKey) _cache.set(cacheKey, result);
            setData(result);
          } catch (e) {
            console.warn(`[admin] realtime refetch (${realtime.table}) failed:`, e.message);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realtime?.table]);

  return { data, loading, error, refetch: () => fetchRef.current().then(rows => { const r = rows && rows.length > 0 ? rows : fallback; if (cacheKey) _cache.set(cacheKey, r); setData(r); }) };
}

// ─── Users ────────────────────────────────────────────────────────────────

export function useUsers() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, email, first_name, last_name, role, city, photo_url, phone,
        created_at,
        is_suspended, suspension_count, is_banned
      `)
      .in('role', ['PARENT', 'BABY_SITTER'])
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data || []).map(mapUser);
  }, MOCK_USERS, { table: 'profiles' }, 'users');
}

function mapUser(u) {
  const safeId = (u.id ?? '').toString();
  const created = u.created_at ? new Date(u.created_at) : null;
  const joined = created && !isNaN(created)
    ? created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const status = u.is_banned ? 'banned'
    : u.is_suspended ? 'suspended'
    : 'active';
  return {
    id:               safeId ? safeId.slice(0, 8).toUpperCase() : '????????',
    rawId:            safeId,
    name:             `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || 'Unknown',
    email:            u.email || '',
    phone:            u.phone || '',
    role:             u.role,
    joined,
    city:             u.city || 'Algiers',
    bookings:         0,
    status,
    verified:          false,
    identity_verified: false,
    is_suspended:      u.is_suspended ?? false,
    is_banned:         false,
    suspension_count:  0,
    rating:           0,
    initial:          (u.first_name || u.email || '?').charAt(0).toUpperCase(),
    last_login_at:    u.last_login_at ? timeAgo(u.last_login_at) : '—',
  };
}

// ─── User detail ───────────────────────────────────────────────────────────

export function useUserDetail(userId) {
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [suspensions, setSuspensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Skip queries without a real session — avoids RLS-silent empty results.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // In demo mode, synthesize a profile from mock user id
        const mockUser = MOCK_USERS.find(u => u.id === userId || u.rawId === userId);
        if (mockUser) {
          setProfile({ ...mockUser, rawId: mockUser.rawId || userId });
        }
        setLoading(false);
        return;
      }

      const [profileRes, bookingsRes, reviewsGivenRes, reviewsReceivedRes, reportsRes, suspRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('bookings').select(`
          id, start_date, end_date, duration_hours, total_price, status, created_at,
          sitter:babysitter_id(first_name, last_name)
          `).or(`parent_id.eq.${userId},babysitter_id.eq.${userId}`)
          .order('created_at', { ascending: false }).limit(20),
        supabase.from('reviews').select('id, rating, comment, created_at, babysitter_id, target:babysitter_id(first_name, last_name)')
          .eq('parent_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('reviews').select('id, rating, comment, created_at, author:parent_id(first_name, last_name)')
          .eq('babysitter_id', userId).order('created_at', { ascending: false }).limit(10),
        supabase.from('reports').select(`
          id, code, reason, notes, priority, status, created_at,
          reporter:reporter_id(first_name, last_name, role)
        `).or(`reporter_id.eq.${userId},target_id.eq.${userId}`)
          .order('created_at', { ascending: false }).limit(10),
        supabase.from('suspensions').select('*')
          .eq('user_id', userId)
          .order('suspended_at', { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      setProfile(mapUser(profileRes.data));

      setBookings((bookingsRes.data || []).map(b => ({
        id: '#' + String(b.id).padStart(6, '0'),
        when: new Date(b.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        duration: `${b.duration_hours ?? 0}h`,
        amount: b.total_price ?? 0,
        status: (b.status || 'pending').toLowerCase(),
        other: (b.parent ? `${b.parent.first_name ?? ''} ${b.parent.last_name ?? ''}`.trim() : '') ||
               (b.sitter ? `${b.sitter.first_name ?? ''} ${b.sitter.last_name ?? ''}`.trim() : ''),
      })));

      const given = (reviewsGivenRes.data || []).map(r => ({
        id: 'RV-' + String(r.id).padStart(4, '0'),
        rating: r.rating,
        comment: r.comment || '',
        when: timeAgo(r.created_at),
        direction: 'given',
        other: r.target ? `${r.target.first_name ?? ''} ${r.target.last_name ?? ''}`.trim() : '—',
      }));
      const received = (reviewsReceivedRes.data || []).map(r => ({
        id: 'RV-' + String(r.id).padStart(4, '0'),
        rating: r.rating,
        comment: r.comment || '',
        when: timeAgo(r.created_at),
        direction: 'received',
        other: r.author ? `${r.author.first_name ?? ''} ${r.author.last_name ?? ''}`.trim() : '—',
      }));
      setReviews([...given, ...received].sort((a, b) => b.id.localeCompare(a.id)));

      setReports((reportsRes.data || []).map(r => ({
        id: r.code || 'R-????',
        reason: r.reason,
        priority: r.priority,
        status: r.status,
        when: timeAgo(r.created_at),
        reporter: r.reporter ? `${r.reporter.first_name ?? ''} ${r.reporter.last_name ?? ''}`.trim() : 'System',
      })));

      setSuspensions((suspRes.data || []).map(s => ({
        id: s.id,
        reason: s.reason,
        suspendedAt: new Date(s.suspended_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        suspendedAtRaw: s.suspended_at,
        liftedAt: s.lifted_at ? new Date(s.lifted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
        durationDays: s.duration_days,
        triggeredBy: s.triggered_by || 'manual',
        isActive: s.is_active,
      })));

    } catch (e) {
      console.warn('[admin] useUserDetail failed:', e.message);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { profile, bookings, reviews, reports, suspensions, loading, error, refetch: fetch };
}

// ─── Bookings ─────────────────────────────────────────────────────────────

export function useBookings() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, start_date, end_date, duration_hours, total_price, status, created_at,
        parent:parent_id(first_name, last_name),
        sitter:babysitter_id(first_name, last_name, city)
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map((b) => {
      const start = new Date(b.start_date);
      const when = start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        + ', ' + start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return {
        id: '#' + String(b.id).padStart(6, '0'),
        parent: b.parent ? `${b.parent.first_name ?? ''} ${b.parent.last_name ?? ''}`.trim() : '—',
        sitter: b.sitter ? `${b.sitter.first_name ?? ''} ${b.sitter.last_name ?? ''}`.trim() : '—',
        when,
        duration: `${b.duration_hours ?? 0}h`,
        amount: b.total_price ?? 0,
        status: (b.status || 'pending').toLowerCase(),
        flag: null,
        city: b.sitter?.city || 'Algiers',
        startRaw: b.start_date,
        endRaw:   b.end_date,
      };
    });
  }, MOCK_BOOKINGS, { table: 'bookings' }, 'bookings');
}

// ─── Reports ──────────────────────────────────────────────────────────────

export function useReports() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        id, code, reason, notes, evidence, priority, status, created_at,
        reporter_id, target_id,
        reporter:reporter_id(first_name, last_name, role),
        target:target_id(first_name, last_name, role)
      `)
      .neq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.code || ('R-' + r.id?.toString().slice(0, 4)),
      priority: r.priority,
      reason: r.reason,
      reporter:     r.reporter ? `${r.reporter.first_name ?? ''} ${r.reporter.last_name ?? ''}`.trim() : 'System',
      reporterRole: r.reporter?.role === 'PARENT' ? 'Parent' : r.reporter?.role === 'BABY_SITTER' ? 'Babysitter' : 'System',
      reporterId:   r.reporter_id || null,
      target:     r.target ? `${r.target.first_name ?? ''} ${r.target.last_name ?? ''}`.trim() : '—',
      targetRole: r.target?.role === 'PARENT' ? 'Parent' : 'BABY_SITTER',
      targetId:   r.target_id || null,
      count: 1,
      opened: timeAgo(r.created_at),
      status: r.status,
      evidence: r.evidence || '—',
      notes: r.notes || '',
    }));
  }, MOCK_REPORTS, { table: 'reports' }, 'reports');
}

// ─── Verifications ────────────────────────────────────────────────────────

export function useVerifications() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('verifications')
      .select(`
        code, status, id_type, selfie_url, cv_url, references_count, experience, score, created_at,
        sitter_id,
        sitter:sitter_id(first_name, last_name, city, email, photo_url, phone)
      `)
      .in('status', ['pending'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map((v) => {
      const name = v.sitter ? `${v.sitter.first_name ?? ''} ${v.sitter.last_name ?? ''}`.trim() : 'Unknown';
      return {
        id: v.code,
        sitterId: v.sitter_id || null,
        name,
        city: v.sitter?.city || 'Algiers',
        submitted: timeAgo(v.created_at),
        exp: v.experience || 'N/A',
        age: 0,
        idType: v.id_type || 'National ID',
        selfie: !!v.selfie_url,
        cv: !!v.cv_url,
        refs: v.references_count || 0,
        score: v.score || 0,
        initial: name.charAt(0).toUpperCase(),
        tint: '#0D7377', bg0: '#D9F1F2', bg1: '#FFE4EB',
        email: v.sitter?.email || '',
        phone: v.sitter?.phone || '',
        bio: '',
        priceHr: 0,
        languages: [],
        certifications: [],
      };
    });
  }, MOCK_VERIFICATIONS, { table: 'verifications' }, 'verifications');
}

// ─── Flagged profile photos ───────────────────────────────────────────────

export function useFlaggedPhotos() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, city, email, photo_url, created_at')
      .eq('role', 'BABY_SITTER')
      .eq('profile_photo_verified', false)
      .not('photo_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown',
      city: p.city || 'Algiers',
      email: p.email,
      photoUrl: p.photo_url,
      initial: (p.first_name || '?').charAt(0).toUpperCase(),
    }));
  }, MOCK_FLAGGED_PHOTOS, { table: 'profiles' }, 'flagged-photos');
}

// ─── Reviews (flagged) ────────────────────────────────────────────────────

export function useFlaggedReviews() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select(`
        id, rating, comment, created_at, is_flagged,
        author:parent_id(first_name, last_name),
        target:babysitter_id(first_name, last_name)
      `)
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: 'RV-' + String(r.id).padStart(4, '0'),
      author: r.author ? `${r.author.first_name ?? ''} ${r.author.last_name ?? ''}`.trim() : 'Anonymous',
      target: r.target ? `${r.target.first_name ?? ''} ${r.target.last_name ?? ''}`.trim() : '—',
      stars: r.rating || 0,
      when: timeAgo(r.created_at),
      reason: 'Flagged',
      text: r.comment || '',
      flagged_by: 1,
    }));
  }, MOCK_REVIEWS, { table: 'reviews' }, 'reviews');
}

// ─── Audit log ────────────────────────────────────────────────────────────

export function useAuditLog() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, actor_name, action, entity_type, entity_id, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map((l) => ({
      id: 'L-' + String(l.id).padStart(4, '0'),
      when: timeAgo(l.created_at),
      actor: l.actor_name || 'System',
      action: l.action,
      entity: `${l.entity_type} ${l.entity_id}`,
      detail: l.detail || '',
    }));
  }, MOCK_AUDIT, { table: 'audit_log' }, 'audit-log');
}

// ─── Transactions ─────────────────────────────────────────────────────────

export function useTransactions() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        id, amount, method, status, chargily_checkout_id, created_at, transferred_at,
        booking:booking_id(id),
        payer:payer_id(first_name, last_name),
        payee:payee_id(first_name, last_name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map((t) => {
      const created = new Date(t.created_at);
      const age = Date.now() - created.getTime();
      return {
        id: 'TXN-' + t.id.slice(0, 8).toUpperCase(),
        rawId: t.id,
        bookingId: t.booking ? '#' + String(t.booking.id).padStart(6, '0') : '—',
        parentName: t.payer ? `${t.payer.first_name ?? ''} ${t.payer.last_name ?? ''}`.trim() : '—',
        sitterName: t.payee ? `${t.payee.first_name ?? ''} ${t.payee.last_name ?? ''}`.trim() : '—',
        amount: t.amount,
        method: t.method,
        status: t.status,
        when: created.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        whenRaw: t.created_at,
        transferredAt: t.transferred_at
          ? new Date(t.transferred_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
          : null,
        chargilyId: t.chargily_checkout_id || null,
        isCcpPending24h: t.method === 'ccp' && t.status === 'pending' && age > 24 * 3_600_000,
      };
    });
  }, MOCK_TRANSACTIONS, { table: 'transactions' }, 'transactions');
}

// ─── Sitter earnings ──────────────────────────────────────────────────────

export function useSitterEarnings() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        amount, method, status,
        payee:payee_id(id, first_name, last_name)
      `)
      .in('status', ['completed', 'pending']);
    if (error) throw error;
    const map = {};
    for (const t of data || []) {
      const id = t.payee?.id || 'unknown';
      const name = t.payee ? `${t.payee.first_name ?? ''} ${t.payee.last_name ?? ''}`.trim() : '—';
      if (!map[id]) map[id] = { id, name, totalEarned: 0, pending: 0, completed: 0, methods: {} };
      const amt = Number(t.amount);
      if (t.status === 'completed') { map[id].totalEarned += amt; map[id].completed += amt; }
      if (t.status === 'pending')   { map[id].pending += amt; }
      map[id].methods[t.method] = (map[id].methods[t.method] || 0) + amt;
    }
    return Object.values(map).sort((a, b) => b.totalEarned - a.totalEarned);
  }, MOCK_SITTER_EARNINGS, { table: 'transactions' }, 'sitter-earnings');
}

// ─── Suspensions ──────────────────────────────────────────────────────────

export function useSuspensions(userId = null) {
  return useQuery(async () => {
    let q = supabase
      .from('suspensions')
      .select(`
        id, reason, suspended_at, lifted_at, duration_days, triggered_by, is_active,
        user:user_id(id, first_name, last_name, role)
      `)
      .order('suspended_at', { ascending: false })
      .limit(100);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((s) => ({
      id: s.id,
      userId: s.user?.id || '',
      userName: s.user ? `${s.user.first_name ?? ''} ${s.user.last_name ?? ''}`.trim() : '—',
      userRole: s.user?.role || 'sitter',
      reason: s.reason,
      suspendedAt: new Date(s.suspended_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      suspendedAtRaw: s.suspended_at,
      liftedAt: s.lifted_at ? new Date(s.lifted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
      durationDays: s.duration_days,
      triggeredBy: s.triggered_by || 'manual',
      isActive: s.is_active,
    }));
  }, userId ? [] : MOCK_SUSPENSIONS, { table: 'suspensions' }, userId ? 'susp:' + userId : 'suspensions');
}

// ─── Deleted accounts ─────────────────────────────────────────────────────

export function useDeletedAccounts() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('deleted_accounts')
      .select('*')
      .order('deleted_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const now = Date.now();
    return (data || []).map((d) => ({
      id: d.id,
      email: d.email || '—',
      phone: '—',
      deletedAt: new Date(d.deleted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      deletedAtRaw: d.deleted_at,
      reactivationDeadline: '—',
      reactivationDeadlineRaw: null,
      credentialBlockUntil: '—',
      credentialBlockUntilRaw: null,
      wasReactivated: false,
      adminNote: d.reason || null,
      windowStatus: 'expired',
    }));
  }, MOCK_DELETED_ACCOUNTS, { table: 'deleted_accounts' }, 'deleted-accounts');
}

// ─── Admin settings ───────────────────────────────────────────────────────

export function useAdminSettings() {
  const [settings, setSettings] = useState(MOCK_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('admin_settings')
          .select('key, value');
        if (error) throw error;
        if (!mounted || !data?.length) return;
        const map = Object.fromEntries(data.map(r => [r.key, r.value]));
        setSettings({
          minRatingSuspension:     parseFloat(map.min_rating_suspension    ?? '3.0'),
          suspensionsBeforeBan:    parseInt  (map.suspensions_before_ban   ?? '3', 10),
          suspensionDurationDays:  parseInt  (map.suspension_duration_days ?? '7', 10),
          credentialBlockMonths:   parseInt  (map.credential_block_months  ?? '4', 10),
          reactivationWindowHours: parseInt  (map.reactivation_window_hours ?? '72', 10),
        });
      } catch (e) {
        console.warn('[admin] settings query failed:', e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return { settings, loading };
}

// ─── Admin accounts ───────────────────────────────────────────────────────

export function useAdmins() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, city, created_at')
      .eq('role', 'ADMIN')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(u => ({
      id: u.id,
      name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email,
      email: u.email,
      city: u.city || 'Algeria',
      joined: new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      initial: (u.first_name || u.email || '?').charAt(0).toUpperCase(),
    }));
  }, [{ id: 'demo', name: 'Henni Fouad', email: 'aboubakarnait@gmail.com', city: 'Mostaganem', joined: '01 Jan 2026', initial: 'H' }], null, 'admins');
}

// ─── Auto-moderation rules ────────────────────────────────────────────────

export function useAutoRules() {
  return useQuery(async () => {
    const { data, error } = await supabase
      .from('moderation_rules')
      .select('id, trigger, value, action, created_at, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }, MOCK_MODERATION_RULES, { table: 'moderation_rules' }, 'auto-rules');
}

// ─── KPIs (live counts) ───────────────────────────────────────────────────

export function useKPIs(refreshKey = 0) {
  const [data, setData] = useState(MOCK_KPI);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // RLS silently returns count=0 for unauthenticated users — skip queries
      // entirely if there's no real session so mock data stays visible.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) return;

      try {
        const [users, bookings, verif, reports, suspended, revenue, newToday] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['PARENT', 'BABY_SITTER']),
          supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'CONFIRMED', 'IN_PROGRESS']),
          supabase.from('verifications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
          supabase.from('transactions').select('amount').eq('status', 'completed'),
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .in('role', ['PARENT', 'BABY_SITTER'])
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        ]);
        if (!mounted) return;
        // Use real count when query succeeded, fall back to mock when it errored (e.g. RLS blocks demo/anon).
        const pick = (res, prev) => res.error ? prev : (res.count ?? prev);
        const totalRevenue = revenue.error ? null
          : (revenue.data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
        setData(prev => ({
          users:        { ...prev.users,        value: pick(users,    prev.users.value) },
          bookings:     { ...prev.bookings,     value: pick(bookings, prev.bookings.value) },
          pendingVerif: { ...prev.pendingVerif, value: pick(verif,    prev.pendingVerif.value) },
          openReports:  { ...prev.openReports,  value: pick(reports,  prev.openReports.value) },
          suspended:    { label: 'Suspended users',     value: pick(suspended, prev.suspended?.value ?? 0), delta: 'currently active', trend: 'flat', accent: 'coral', spark: prev.suspended?.spark || [1,1,2,1,3,2,3] },
          revenue:      { label: 'Total revenue (DZD)', value: totalRevenue ?? prev.revenue?.value ?? 0,   delta: 'completed payments', trend: 'up',  accent: 'mint',  spark: prev.revenue?.spark   || [20,30,25,40,50,45,60] },
          newToday:     { label: 'New signups today',   value: pick(newToday, prev.newToday?.value ?? 0),  delta: 'today so far',    trend: 'flat', accent: 'teal',  spark: prev.newToday?.spark  || [2,3,1,4,2,3,2] },
        }));
      } catch (e) {
        console.warn('[admin] KPI query failed:', e.message);
      }
    })();
    return () => { mounted = false; };
  }, [refreshKey]);

  return data;
}

// ─── Notifications (derived from KPI counts — no extra hook calls) ────────────

/**
 * Pure function: builds notification items from the already-fetched KPI object.
 * Called in App.jsx with the kpis value — no hooks, no duplicate subscriptions.
 */
export function buildNotifications(kpis) {
  const notifs = [];
  if (!kpis) return notifs;

  const openReports = kpis.openReports?.value ?? 0;
  if (openReports > 0) notifs.push({
    id:    'reports',
    type:  'report',
    icon:  'flag',
    tone:  'coral',
    title: `${openReports} open report${openReports !== 1 ? 's' : ''} need attention`,
    sub:   'Review and resolve in the Reports queue',
    when:  'now',
    page:  'reports',
  });

  const pendingVerif = kpis.pendingVerif?.value ?? 0;
  if (pendingVerif > 0) notifs.push({
    id:    'verifications',
    type:  'verification',
    icon:  'shield',
    tone:  'amber',
    title: `${pendingVerif} verification${pendingVerif !== 1 ? 's' : ''} pending`,
    sub:   'Babysitter ID documents waiting for review',
    when:  'now',
    page:  'verification',
  });

  const suspended = kpis.suspended?.value ?? 0;
  if (suspended > 0) notifs.push({
    id:    'suspensions',
    type:  'suspension',
    icon:  'pause',
    tone:  'coral',
    title: `${suspended} user${suspended !== 1 ? 's' : ''} currently suspended`,
    sub:   'Review suspension list in Users',
    when:  'now',
    page:  'users',
  });

  return notifs;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}