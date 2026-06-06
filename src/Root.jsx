import React, { useEffect, useState } from 'react';
import { App } from './App.jsx';
import { Login } from './Login.jsx';
import { Icon } from './icons.jsx';
import { supabase, getCurrentAdmin } from './supabase';

export function Root() {
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    let mounted = true;

    // 1. Check initial session
    getCurrentAdmin().then((a) => {
      if (!mounted) return;
      setAdmin(a);
      setLoading(false);
    });

    // 2. React to auth state changes:
    //    - SIGNED_OUT (anywhere, incl. another tab) → drop admin state.
    //    - SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED → re-resolve the
    //      profile so a role change (e.g. demotion) takes effect immediately.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setAdmin(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        getCurrentAdmin().then((a) => { if (mounted) setAdmin(a); });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F1F3F8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #0D7377, #199CA0)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          animation: 'pulse 1.8s ease-out infinite',
        }}>
          <Icon name="logo" size={28} stroke="#fff" strokeWidth={2} />
        </div>
        <div style={{ fontSize: 13, color: '#6B7488', fontWeight: 600 }}>Loading…</div>
      </div>
    );
  }

  if (!admin) {
    return <Login onLogin={setAdmin} />;
  }

  return <App adminProfile={admin} />;
}
