import React, { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Icon } from './icons.jsx';
import { Card, Sidebar, Topbar, PageHeader, ToastHost, NavProgress, navStart, navDone, showToast } from './components.jsx';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakColor } from './tweaks-panel.jsx';
import { supabase } from './supabase';
import { useKPIs, buildNotifications } from './hooks.js';

const OverviewPage         = lazy(() => import('./pages/Overview.jsx').then(m => ({ default: m.OverviewPage })));
const VerificationPage     = lazy(() => import('./pages/Verification.jsx').then(m => ({ default: m.VerificationPage })));
const ReportsPage          = lazy(() => import('./pages/Reports.jsx').then(m => ({ default: m.ReportsPage })));
const UsersPage            = lazy(() => import('./pages/Users.jsx').then(m => ({ default: m.UsersPage })));
const UserDetailPage       = lazy(() => import('./pages/UserDetail.jsx').then(m => ({ default: m.UserDetailPage })));
const BookingsPage         = lazy(() => import('./pages/Bookings.jsx').then(m => ({ default: m.BookingsPage })));
const ReviewsPage          = lazy(() => import('./pages/Reviews.jsx').then(m => ({ default: m.ReviewsPage })));
const AuditLogPage         = lazy(() => import('./pages/AuditLog.jsx').then(m => ({ default: m.AuditLogPage })));
const TransactionsPage     = lazy(() => import('./pages/Transactions.jsx').then(m => ({ default: m.TransactionsPage })));
const DeletedAccountsPage  = lazy(() => import('./pages/DeletedAccounts.jsx').then(m => ({ default: m.DeletedAccountsPage })));
const SettingsPage         = lazy(() => import('./pages/Settings.jsx').then(m => ({ default: m.SettingsPage })));

function PageFallback() {
  return (
    <div style={{ padding: 24 }}>
      <div className="skel" style={{ width: 200, height: 24, marginBottom: 16 }} />
      <div className="skel" style={{ width: '100%', height: 120, marginBottom: 12 }} />
      <div className="skel" style={{ width: '90%', height: 60, marginBottom: 12 }} />
      <div className="skel" style={{ width: '80%', height: 60 }} />
    </div>
  );
}

export const PAGES = {
  overview:        { title: 'Overview',           breadcrumbs: ['Kido Admin'],                       Page: OverviewPage },
  verification:    { title: 'Verifications',      breadcrumbs: ['Kido Admin', 'Trust & Safety'],     Page: VerificationPage },
  reports:         { title: 'Reports',            breadcrumbs: ['Kido Admin', 'Trust & Safety'],     Page: ReportsPage },
  users:           { title: 'Users',              breadcrumbs: ['Kido Admin'],                       Page: UsersPage },
  'user-detail':   { title: 'User profile',       breadcrumbs: ['Kido Admin', 'Users'],              Page: UserDetailPage },
  bookings:        { title: 'Bookings',           breadcrumbs: ['Kido Admin'],                       Page: BookingsPage },
  reviews:         { title: 'Reviews',            breadcrumbs: ['Kido Admin', 'Content'],            Page: ReviewsPage },
  payments:        { title: 'Payments',           breadcrumbs: ['Kido Admin'],                       Page: TransactionsPage },
  'deleted-accounts': { title: 'Deleted accounts', breadcrumbs: ['Kido Admin', 'Users'],             Page: DeletedAccountsPage },
  audit:           { title: 'Audit log',          breadcrumbs: ['Kido Admin', 'System'],             Page: AuditLogPage },
  settings:        { title: 'Settings',           breadcrumbs: ['Kido Admin'],                       Page: SettingsPage },
};

export function App({ adminProfile }) {
  // nav = { page: string, params: object }
  const [nav, setNav] = useState({ page: 'overview', params: {} });
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { setSearch(''); }, [nav.page]);

  // Eagerly prefetch every page chunk during browser idle time so that
  // subsequent navigations are instant (React.lazy resolves from cache).
  useEffect(() => {
    const prefetch = () => {
      import('./pages/Overview.jsx');
      import('./pages/Verification.jsx');
      import('./pages/Reports.jsx');
      import('./pages/Users.jsx');
      import('./pages/UserDetail.jsx');
      import('./pages/Bookings.jsx');
      import('./pages/Reviews.jsx');
      import('./pages/AuditLog.jsx');
      import('./pages/Transactions.jsx');
      import('./pages/DeletedAccounts.jsx');
      import('./pages/Settings.jsx');
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(prefetch, 300);
    return () => clearTimeout(t);
  }, []);

  const kpis = useKPIs(refreshKey);
  const notifications = buildNotifications(kpis);
  const alertCount = notifications.length;

  const navigate = useCallback((nextPage, params = {}) => {
    if (nextPage === nav.page && JSON.stringify(params) === JSON.stringify(nav.params)) return;
    navStart();
    setNav({ page: nextPage, params });
    setNotifOpen(false);
  }, [nav]);

  useEffect(() => { navDone(); }, [nav.page]);

  const handleLogout = useCallback(async () => {
    try { await supabase.auth.signOut(); } catch (e) { console.warn('[admin] sign out failed:', e?.message); }
    if (adminProfile?.id === 'demo') location.reload();
  }, [adminProfile?.id]);

  const t = useTweaks(/*EDITMODE-BEGIN*/{
    "density": "comfortable",
    "accent": "#0D7377",
    "showBadges": true
  }/*EDITMODE-END*/);

  const cfg = PAGES[nav.page] ?? PAGES.overview;
  const Page = cfg.Page;

  React.useEffect(() => {
    document.documentElement.style.setProperty('--kido-teal-700', t.accent);
  }, [t.accent]);

  // Dynamic sidebar badge counts from live KPI data
  const sidebarBadges = {
    verification: kpis?.pendingVerif?.value || 0,
    reports:      kpis?.openReports?.value  || 0,
    reviews:      0,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1F3F8' }}>
      <Sidebar
        active={nav.page}
        onNav={navigate}
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        admin={adminProfile}
        onLogout={handleLogout}
        badges={sidebarBadges}
      />
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar
          title={cfg.title}
          breadcrumbs={cfg.breadcrumbs}
          search={search}
          onSearch={setSearch}
          alertCount={alertCount}
          admin={adminProfile}
          notifications={notifications}
          notifOpen={notifOpen}
          onBellClick={() => setNotifOpen(o => !o)}
          onBellClose={() => setNotifOpen(false)}
          onNotifNavigate={(page) => navigate(page)}
        />
        <div style={{ padding: t.density === 'compact' ? '20px 24px' : '28px 32px', flex: 1 }}>
          <Suspense fallback={<PageFallback />}>
            <Page
              key={nav.page + (nav.params?.userId || '')}
              goto={navigate}
              admin={adminProfile}
              search={search}
              params={nav.params}
              onActionDone={() => setRefreshKey(k => k + 1)}
            />
          </Suspense>
        </div>
        <footer style={{ padding: '14px 32px', borderTop: '1px solid #EDEFF4', display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, color: '#9099AD', background: '#fff' }}>
          <span>Kido Admin Console · v1.0</span>
          <span style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: '#34C759' }} /> All systems normal
          </span>
          <span>· {adminProfile?.city || 'Mostaganem'} · {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </footer>
      </main>

      <NavProgress />
      <ToastHost />

      <TweaksPanel title="Tweaks" subtitle="Personalize the admin shell">
        <TweakSection title="Layout">
          <TweakRadio label="Density" value={t.density} onChange={(v) => t.set('density', v)}
            options={[{ value: 'comfortable', label: 'Comfy' }, { value: 'compact', label: 'Compact' }]} />
          <TweakToggle label="Show priority badges" value={t.showBadges} onChange={(v) => t.set('showBadges', v)} />
        </TweakSection>
        <TweakSection title="Brand accent">
          <TweakColor label="Primary" value={t.accent} onChange={(v) => t.set('accent', v)}
            options={['#0D7377', '#FF6B8A', '#5347D6', '#1F8A4E']} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}
