import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock `@supabase/supabase-js` directly. That way the real `supabase.ts`
// runs its `createClient()` call but gets our stub back, and `getCurrentAdmin`
// — which reads the resulting `supabase` binding inside the same module —
// uses the stub correctly. (Mocking `../supabase` itself doesn't work because
// of ESM live bindings: `getCurrentAdmin` keeps a closure on the original
// `supabase` import regardless of what we return from the factory.)

const { single, getUser } = vi.hoisted(() => ({
  single: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single }),
      }),
    }),
  }),
}));

// Ensure env vars exist before `supabase.ts` is evaluated.
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

import { getCurrentAdmin } from '../supabase';

function setUser(user: { id: string } | null) {
  getUser.mockResolvedValueOnce({ data: { user } });
}
function setProfile(profile: unknown | null) {
  single.mockResolvedValueOnce({ data: profile });
}

describe('getCurrentAdmin — auth + role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when there is no session', async () => {
    setUser(null);
    expect(await getCurrentAdmin()).toBeNull();
  });

  it('returns null when the user has no profile row', async () => {
    setUser({ id: 'user-123' });
    setProfile(null);
    expect(await getCurrentAdmin()).toBeNull();
  });

  it('returns null when the user is a parent (not admin)', async () => {
    setUser({ id: 'user-123' });
    setProfile({
      id: 'user-123', email: 'parent@kido.dz', role: 'parent',
      first_name: 'P', last_name: 'Arent', city: 'Algiers', photo_url: null,
    });
    expect(await getCurrentAdmin()).toBeNull();
  });

  it('returns null when the user is a sitter (not admin)', async () => {
    setUser({ id: 'user-123' });
    setProfile({
      id: 'user-123', email: 'sitter@kido.dz', role: 'sitter',
      first_name: 'S', last_name: 'Itter', city: 'Algiers', photo_url: null,
    });
    expect(await getCurrentAdmin()).toBeNull();
  });

  it('returns the profile when role is admin', async () => {
    const adminRow = {
      id: 'user-123', email: 'admin@kido.dz', role: 'admin' as const,
      first_name: 'Henni', last_name: 'Fouad', city: 'Mostaganem', photo_url: null,
    };
    setUser({ id: 'user-123' });
    setProfile(adminRow);
    expect(await getCurrentAdmin()).toEqual(adminRow);
  });
});
