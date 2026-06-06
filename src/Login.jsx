import React, { useState } from 'react';
import { Icon } from './icons.jsx';
import { Btn } from './components.jsx';
import { supabase } from './supabase';

export function Login({ onLogin }) {
  // Pre-fill the project owner's email so login is just one password field.
  const [email, setEmail] = useState(import.meta.env.VITE_ADMIN_EMAIL || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. Try to sign in
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !data?.user?.id) {
      // Show a generic message — never expose raw Supabase error strings to
      // the UI (they sometimes leak internal URLs or implementation details).
      setError('Incorrect email or password.');
      setLoading(false);
      return;
    }

    // 2. Check the profile has role = 'ADMIN'
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileErr || !profile) {
      setError('Profile not found. Contact support.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (profile.role !== 'ADMIN') {
      setError('This account is not an administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // 3. Success → notify parent
    onLogin(profile);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0D7377 0%, #095457 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 24,
        padding: 40,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, #0D7377, #199CA0)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 8px 24px rgba(13,115,119,0.32)',
            marginBottom: 16,
          }}>
            <Icon name="logo" size={36} stroke="#fff" strokeWidth={2} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.02em' }}>
            Kido Admin Console
          </div>
          <div style={{ fontSize: 13, color: '#6B7488', marginTop: 4 }}>
            Trust &amp; Safety dashboard
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@kido.dz"
              style={{
                width: '100%', height: 44, padding: '0 14px',
                border: '1.5px solid #E5E8EF', borderRadius: 10,
                fontSize: 14, fontFamily: 'inherit',
                background: '#F8F9FC', outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', height: 44, padding: '0 14px',
                border: '1.5px solid #E5E8EF', borderRadius: 10,
                fontSize: 14, fontFamily: 'inherit',
                background: '#F8F9FC', outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 12px', background: '#FFE0E4', color: '#C8324A',
              borderRadius: 10, fontSize: 12.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="alert" size={14} stroke="#C8324A" />
              {error}
            </div>
          )}

          <Btn variant="primary" size="lg" full disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Btn>
        </form>

        <div style={{ marginTop: 20, fontSize: 11, color: '#9099AD', textAlign: 'center' }}>
          Only authorized administrators can access this console.
        </div>

        {/*
          Demo bypass — DEV / PREVIEW ONLY.
          Tree-shaken out of production builds because `import.meta.env.DEV`
          becomes a compile-time `false` constant. This guarantees no
          unauthenticated access path ships to the live deployment.
        */}
        {import.meta.env.DEV && (
          <button
            type="button"
            onClick={() => onLogin({
              id: 'demo', email: 'demo@kido.dz',
              first_name: 'Henni', last_name: 'Fouad',
              role: 'ADMIN', city: 'Mostaganem', photo_url: null,
            })}
            style={{
              marginTop: 14, width: '100%', height: 36,
              background: 'transparent', border: '1px dashed #C7CCD9',
              borderRadius: 10, color: '#6B7488',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            UI preview only — no database writes →
          </button>
        )}
      </div>
    </div>
  );
}
