import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons.jsx';
import { ADMIN } from './data.jsx';

// Shared admin components: layout shell, cards, tables, badges, etc.


// Count-up: animates a number from 0 → target on mount.
export function useCountUp(target, duration = 1100) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setVal(target); return; }
    let start = null;
    let raf;
    const ease = (t) => 1 - Math.pow(1 - t, 3); // ease-out-cubic
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      setVal(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function formatNum(n, decimals = 0) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

// =============================================================
// PRIMITIVES
// =============================================================

export function Card({ children, style, padding = 24, hoverable, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding,
        boxShadow: hover ? '0 12px 32px rgba(14,20,32,0.10)' : '0 2px 10px rgba(14,20,32,0.04)',
        border: '1px solid #EDEFF4',
        transition: 'all 200ms cubic-bezier(0.2,0.8,0.2,1)',
        transform: hover && hoverable ? 'translateY(-2px)' : 'translateY(0)',
        cursor: onClick || hoverable ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Btn({ variant = 'primary', size = 'md', icon, iconRight, children, onClick, full, disabled, style }) {
  const variants = {
    primary:   { background: 'linear-gradient(180deg, #0D7377 0%, #095457 100%)', color: '#fff', boxShadow: '0 8px 20px rgba(13,115,119,0.28)' },
    secondary: { background: '#E8F8F5', color: '#0D7377' },
    ghost:     { background: 'transparent', color: '#2E3748', boxShadow: 'inset 0 0 0 1px #DDE1EA' },
    soft:      { background: '#F1F3F8', color: '#2E3748' },
    danger:    { background: '#FFE0E4', color: '#C8324A' },
    dangerSolid: { background: '#E5304A', color: '#fff', boxShadow: '0 8px 20px rgba(229,48,74,0.25)' },
    success:   { background: '#DCF5E4', color: '#1F8A4E' },
    successSolid: { background: '#1F8A4E', color: '#fff', boxShadow: '0 8px 20px rgba(31,138,78,0.25)' },
  };
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 12, borderRadius: 999, gap: 6, height: 30 },
    md: { padding: '9px 16px', fontSize: 13, borderRadius: 10, gap: 8, height: 38 },
    lg: { padding: '12px 22px', fontSize: 14, borderRadius: 12, gap: 10, height: 46 },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', fontWeight: 600,
        opacity: disabled ? 0.5 : 1,
        width: full ? '100%' : undefined,
        transition: 'transform 120ms, box-shadow 200ms, background 200ms',
        ...sizes[size], ...variants[variant], ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.98)')}
      onMouseUp={(e) => !disabled && (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={(e) => !disabled && (e.currentTarget.style.transform = 'scale(1)')}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

export function IconBtn({ icon, onClick, size = 36, style, title, badge, 'aria-label': ariaLabel }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel || title || icon}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: size, height: size, borderRadius: 10,
        background: hover ? '#F1F3F8' : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#4A5568', transition: 'background 150ms', ...style,
      }}
    >
      <Icon name={icon} size={18} />
      {badge != null && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          background: '#FF6B8A', color: '#fff',
          fontSize: 9, fontWeight: 800,
          minWidth: 14, height: 14, borderRadius: 99,
          padding: '0 4px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #fff',
        }}>{badge}</span>
      )}
    </button>
  );
}

// Pill: status badges. tone: amber/teal/green/red/gray/coral/violet.
export function Pill({ tone = 'gray', children, dot, size = 'md', icon }) {
  const tones = {
    amber:   { bg: '#FFF4DC', fg: '#B26A00' },
    teal:    { bg: '#DEF4F4', fg: '#0D7377' },
    green:   { bg: '#DCF5E4', fg: '#1F8A4E' },
    red:     { bg: '#FFE0E4', fg: '#C8324A' },
    coral:   { bg: '#FFE4EB', fg: '#C8324A' },
    violet:  { bg: '#EDE9FE', fg: '#5B4DC2' },
    gray:    { bg: '#EDEFF4', fg: '#4A5568' },
    mint:    { bg: '#E8F8F5', fg: '#0D7377' },
  };
  const t = tones[tone] || tones.gray;
  const sz = size === 'sm'
    ? { padding: '2px 8px', fontSize: 10.5, height: 18 }
    : { padding: '4px 10px', fontSize: 11, height: 22 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: t.bg, color: t.fg,
      borderRadius: 999, fontWeight: 700,
      ...sz,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: t.fg }} />}
      {icon && <Icon name={icon} size={11} stroke={t.fg} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

// Avatar: gradient tile with initial.
export function Avatar({ name, initial, size = 36, tint, bg0, bg1, verified, online, ring }) {
  const palettes = [
    ['#D9F1F2', '#FFE4EB', '#0D7377'],
    ['#FFE4EB', '#D9F1F2', '#FF6B8A'],
    ['#FFF4DC', '#D9F1F2', '#B26A00'],
    ['#E7E6FD', '#FFE4EB', '#5347D6'],
    ['#DCF5E4', '#D9F1F2', '#1F8A4E'],
    ['#FFE0E4', '#FFF4DC', '#C8324A'],
  ];
  // Hash an arbitrary string into a palette index.
  // Falls back to 'A' when both `name` and `initial` are missing or empty,
  // guaranteeing a valid index even for null/undefined/empty inputs.
  const seedSource = (name || initial || 'A').toString();
  const seed = (seedSource.charCodeAt(0) || 65) % palettes.length;
  const [a, b, t] = palettes[seed];
  const init = (initial || (name || '?').charAt(0) || '?').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 99,
      background: `radial-gradient(circle at 30% 25%, ${bg0 || a}, ${bg1 || b})`,
      color: tint || t,
      fontSize: size * 0.42, fontWeight: 800, letterSpacing: '-0.02em',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative',
      boxShadow: ring ? `0 0 0 2px ${ring}, 0 0 0 4px #fff` : 'inset 0 0 0 1px rgba(14,20,32,0.04)',
    }}>
      {init}
      {verified && (
        <span style={{
          position: 'absolute', right: -2, bottom: -2,
          width: Math.max(14, size * 0.32), height: Math.max(14, size * 0.32),
          background: '#0D7377', color: '#fff',
          borderRadius: 99, border: '2px solid #fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="check" size={Math.max(8, size * 0.18)} stroke="#fff" strokeWidth={3} />
        </span>
      )}
      {online && (
        <span style={{
          position: 'absolute', right: 0, top: 0,
          width: 10, height: 10, borderRadius: 99,
          background: '#34C759', border: '2px solid #fff',
        }} />
      )}
    </div>
  );
}

// Search field.
export function SearchField({ placeholder = 'Search', value, onChange, width = 320 }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{
      width, height: 40,
      background: '#fff',
      borderRadius: 10,
      border: `1.5px solid ${focus ? '#0D7377' : '#E5E8EF'}`,
      boxShadow: focus ? '0 0 0 4px rgba(13,115,119,0.14)' : 'inset 0 1px 2px rgba(14,20,32,0.02)',
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '0 12px',
      transition: 'all 150ms',
    }}>
      <Icon name="search" size={16} stroke="#9099AD" />
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: '#0E1420', fontFamily: 'inherit' }}
      />
      <span style={{ display: 'inline-flex', gap: 2 }}>
        <kbd style={{ fontSize: 10, fontWeight: 700, color: '#9099AD', background: '#F1F3F8', border: '1px solid #E5E8EF', padding: '1px 5px', borderRadius: 4 }}>⌘K</kbd>
      </span>
    </div>
  );
}

// =============================================================
// SHELL — Sidebar + Topbar
// =============================================================

export const NAV_ITEMS = [
  { id: 'overview',     label: 'Overview',         icon: 'grid' },
  { id: 'verification', label: 'Verifications',    icon: 'shield', badgeKey: 'verification', tone: 'amber' },
  { id: 'reports',      label: 'Reports',          icon: 'flag',   badgeKey: 'reports',      tone: 'coral' },
  { id: 'users',        label: 'Users',            icon: 'users' },
  { id: 'bookings',     label: 'Bookings',         icon: 'calendar' },
  { id: 'payments',     label: 'Payments',         icon: 'card' },
  { id: 'reviews',      label: 'Reviews',          icon: 'star' },
  { id: 'audit',        label: 'Audit log',        icon: 'fileLog' },
];

export function Sidebar({ active, onNav, collapsed, onToggle, admin, onLogout, badges = {} }) {
  const adminName = admin
    ? `${admin.first_name ?? ''} ${admin.last_name ?? ''}`.trim() || admin.email
    : ADMIN.name;
  const adminRole = admin ? `Admin · ${admin.city ?? 'Algeria'}` : ADMIN.role;
  const adminInitial = adminName.charAt(0).toUpperCase();
  return (
    <aside style={{
      width: collapsed ? 76 : 244,
      flexShrink: 0,
      background: '#fff',
      borderRight: '1px solid #EDEFF4',
      display: 'flex', flexDirection: 'column',
      transition: 'width 240ms cubic-bezier(0.2,0.8,0.2,1)',
      position: 'sticky', top: 0, height: '100vh',
      zIndex: 5,
    }}>
      {/* Brand */}
      <div style={{ height: 64, padding: collapsed ? '0 18px' : '0 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F3F8' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #0D7377, #199CA0)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
          boxShadow: '0 4px 14px rgba(13,115,119,0.32)',
        }}>
          <Icon name="logo" size={22} stroke="#fff" strokeWidth={2} />
        </div>
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.01em' }}>kido</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: '#0D7377', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Admin Console</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {!collapsed && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 12px 4px' }}>Moderation</div>}
        {NAV_ITEMS.map(item => (
          <NavItem key={item.id} {...item}
            badge={item.badgeKey ? (badges[item.badgeKey] || 0) || undefined : undefined}
            active={active === item.id || (item.id === 'users' && active === 'user-detail')}
            onClick={() => onNav(item.id)} collapsed={collapsed} />
        ))}

        {!collapsed && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '14px 12px 4px' }}>System</div>}
        <NavItem id="settings" label="Settings" icon="settings" active={active === 'settings'} onClick={() => onNav('settings')} collapsed={collapsed} />
        <NavItem id="deleted-accounts" label="Deleted accounts" icon="trash" active={active === 'deleted-accounts'} onClick={() => onNav('deleted-accounts')} collapsed={collapsed} />
      </nav>

      {/* Admin user pill */}
      <div style={{ borderTop: '1px solid #F1F3F8', padding: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: collapsed ? 6 : 8,
          borderRadius: 12,
          background: '#F8F9FC',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <Avatar name={adminName} initial={adminInitial} size={collapsed ? 30 : 34} />
          {!collapsed && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminName}</div>
              <div style={{ fontSize: 11, color: '#6B7488', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{adminRole}</div>
            </div>
          )}
          {!collapsed && onLogout && (
            <IconBtn
              icon="logout"
              size={28}
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
            />
          )}
        </div>
        {!collapsed && (
          <button onClick={onToggle} style={{ marginTop: 8, width: '100%', height: 32, background: 'transparent', border: 'none', color: '#9099AD', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
            <Icon name="collapse" size={14} /> Collapse sidebar
          </button>
        )}
        {collapsed && (
          <button onClick={onToggle} style={{ marginTop: 8, width: '100%', height: 32, background: 'transparent', border: 'none', color: '#9099AD', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
            <Icon name="expand" size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

export function NavItem({ icon, label, active, onClick, badge, tone, collapsed }) {
  const [hover, setHover] = useState(false);
  const badgeBg = tone === 'coral' ? '#FFE4EB' : '#FFF4DC';
  const badgeFg = tone === 'coral' ? '#C8324A' : '#B26A00';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? label : undefined}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: collapsed ? '10px' : '10px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        height: 42,
        borderRadius: 10,
        border: 'none', cursor: 'pointer',
        background: active ? '#E8F8F5' : hover ? '#F8F9FC' : 'transparent',
        color: active ? '#0D7377' : '#2E3748',
        fontWeight: active ? 700 : 600,
        fontSize: 13.5, textAlign: 'left',
        transition: 'all 150ms', fontFamily: 'inherit',
      }}
    >
      {active && (
        <span style={{ position: 'absolute', left: -12, top: 8, bottom: 8, width: 3, background: '#0D7377', borderRadius: '0 4px 4px 0' }} />
      )}
      <Icon name={icon} size={18} stroke={active ? '#0D7377' : '#6B7488'} strokeWidth={active ? 2.2 : 2} />
      {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
      {!collapsed && badge != null && (
        <span style={{
          background: badgeBg, color: badgeFg,
          fontSize: 10.5, fontWeight: 800,
          padding: '2px 7px', borderRadius: 99,
          minWidth: 22, textAlign: 'center',
        }}>{badge}</span>
      )}
      {collapsed && badge != null && (
        <span style={{
          position: 'absolute', top: 6, right: 8,
          width: 8, height: 8, borderRadius: 99,
          background: tone === 'coral' ? '#FF6B8A' : '#FFB02E',
          border: '2px solid #fff',
        }} />
      )}
    </button>
  );
}

export function Topbar({ title, breadcrumbs, actions, search, onSearch, alertCount = 0, admin, onBellClick, onBellClose, notifications = [], notifOpen = false, onNotifNavigate }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const displayName = admin?.first_name
    ? `${admin.first_name} ${admin.last_name || ''}`.trim()
    : (admin?.email || ADMIN.name);
  const initial = displayName.charAt(0).toUpperCase();
  const bellRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) onBellClose?.(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen, onBellClose]);

  return (
    <header style={{
      height: 64, padding: '0 28px',
      borderBottom: '1px solid #EDEFF4',
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', gap: 16,
      position: 'sticky', top: 0, zIndex: 4,
    }}>
      <div style={{ flex: 1 }}>
        {breadcrumbs && (
          <div style={{ fontSize: 11.5, color: '#9099AD', fontWeight: 600, marginBottom: 1 }}>
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                {i > 0 && <span style={{ margin: '0 6px', color: '#B8BECE' }}>/</span>}
                {b}
              </span>
            ))}
          </div>
        )}
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.01em' }}>{title}</h1>
      </div>
      {admin?.id === 'demo' && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#B26A00', background: '#FFF4DC', padding: '4px 10px', borderRadius: 99, letterSpacing: '0.04em', textTransform: 'uppercase' }}
          title="Demo mode: button clicks update the UI but are NOT written to Supabase. Sign in as a real admin to persist changes.">
          <Icon name="alert" size={11} stroke="#B26A00" /> Demo · not saved
        </span>
      )}
      <SearchField placeholder="Search this page…" width={300} value={search} onChange={onSearch} />
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#4A5568', padding: '0 10px', background: '#F1F3F8', borderRadius: 10, height: 36, fontFamily: 'var(--font-mono)' }} title={now.toLocaleString()}>
        <Icon name="clock" size={13} stroke="#6B7488" /> {timeStr}
      </div>

      {/* Notification bell + dropdown */}
      <div ref={bellRef} style={{ position: 'relative' }}>
        <IconBtn icon="bell" badge={alertCount || undefined} title={`${alertCount} alert${alertCount === 1 ? '' : 's'}`} onClick={onBellClick} />
        {notifOpen && (
          <div style={{
            position: 'absolute', top: 44, right: 0,
            width: 360, maxHeight: 460, overflowY: 'auto',
            background: '#fff', borderRadius: 16,
            boxShadow: '0 20px 60px rgba(14,20,32,0.18)',
            border: '1px solid #EDEFF4',
            zIndex: 50,
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F3F8', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0E1420', flex: 1 }}>Alerts</span>
              {alertCount > 0 && <span style={{ fontSize: 11, color: '#9099AD' }}>{alertCount} pending</span>}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9099AD', fontSize: 13 }}>
                <Icon name="check" size={24} stroke="#B8BECE" style={{ margin: '0 auto 8px' }} />
                All clear — no pending alerts.
              </div>
            ) : notifications.map(n => (
              <NotifItem key={n.id} n={n} onNavigate={() => { onNotifNavigate?.(n.page); onBellClose?.(); }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ width: 1, height: 28, background: '#EDEFF4' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={displayName} initial={initial} size={34} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420' }}>{displayName}</div>
          <div style={{ fontSize: 10.5, color: '#6B7488' }}>Administrator</div>
        </div>
      </div>
      {actions}
    </header>
  );
}

function NotifItem({ n, onNavigate }) {
  const [hover, setHover] = useState(false);
  const tones = {
    coral: { bg: '#FFE4EB', fg: '#C8324A' },
    amber: { bg: '#FFF4DC', fg: '#B26A00' },
    teal:  { bg: '#E8F8F5', fg: '#0D7377' },
  };
  const t = tones[n.tone] || tones.amber;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onNavigate}
      style={{
        padding: '12px 18px', cursor: 'pointer',
        background: hover ? '#FAFBFD' : '#fff',
        borderBottom: '1px solid #F8F9FC',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        transition: 'background 120ms',
      }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
        <Icon name={n.icon} size={14} stroke={t.fg} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420', marginBottom: 2 }}>{n.title}</div>
        <div style={{ fontSize: 11.5, color: '#6B7488', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.sub}</div>
      </div>
      <div style={{ fontSize: 10.5, color: '#9099AD', flexShrink: 0, marginTop: 2 }}>{n.when}</div>
    </div>
  );
}

// =============================================================
// PAGE-LEVEL HELPERS
// =============================================================

export function PageHeader({ title, sub, actions, kicker }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 280 }}>
        {kicker && <div style={{ fontSize: 11, fontWeight: 700, color: '#0D7377', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{kicker}</div>}
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.02em' }}>{title}</h2>
        {sub && <div style={{ marginTop: 6, color: '#6B7488', fontSize: 14 }}>{sub}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.01em' }}>{title}</h3>
        {sub && <div style={{ fontSize: 12, color: '#6B7488', marginTop: 2 }}>{sub}</div>}
      </div>
      {action && (
        <button onClick={onAction} style={{ background: 'none', border: 'none', color: '#0D7377', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
          {action} <Icon name="arrowR" size={13} />
        </button>
      )}
    </div>
  );
}

// Filter chip / segmented / tabs
export function Tabs({ items, active, onChange, count }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: '#F1F3F8', padding: 4, borderRadius: 10 }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onChange(item.id)}
          style={{
            padding: '6px 14px', borderRadius: 7,
            border: 'none', cursor: 'pointer',
            background: active === item.id ? '#fff' : 'transparent',
            color: active === item.id ? '#0E1420' : '#6B7488',
            fontWeight: 700, fontSize: 12.5,
            fontFamily: 'inherit',
            boxShadow: active === item.id ? '0 1px 3px rgba(14,20,32,0.08)' : 'none',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
          {item.label}
          {item.count != null && (
            <span style={{ fontSize: 10.5, color: active === item.id ? '#0D7377' : '#9099AD', background: active === item.id ? '#E8F8F5' : '#fff', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, active, onClick, icon, tone }) {
  const tones = {
    teal: { bg: '#E8F8F5', fg: '#0D7377' },
    amber: { bg: '#FFF4DC', fg: '#B26A00' },
    coral: { bg: '#FFE4EB', fg: '#C8324A' },
  };
  const t = tone && tones[tone];
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 999, border: 'none',
      background: active ? '#0D7377' : t ? t.bg : '#fff',
      color: active ? '#fff' : t ? t.fg : '#2E3748',
      fontSize: 12, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit',
      boxShadow: active || t ? 'none' : 'inset 0 0 0 1px #DDE1EA',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </button>
  );
}

// =============================================================
// SPARKLINE
// =============================================================

export function Sparkline({ data, color = '#0D7377', width = 100, height = 32, fill = true }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * (height - 2) - 1;
    return [x, y];
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const fillD = `${d} L ${width} ${height} L 0 ${height} Z`;
  const id = useMemo(() => 'spark-' + Math.random().toString(36).slice(2, 9), []);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={fillD} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =============================================================
// KPI CARD
// =============================================================

export function KpiCard({ k, accent }) {
  const tints = {
    teal:  { fg: '#0D7377', soft: '#E8F8F5', spark: '#0D7377' },
    mint:  { fg: '#199CA0', soft: '#D9F1F2', spark: '#199CA0' },
    amber: { fg: '#B26A00', soft: '#FFF4DC', spark: '#B26A00' },
    coral: { fg: '#C8324A', soft: '#FFE4EB', spark: '#FF6B8A' },
  };
  const t = tints[accent || k.accent] || tints.teal;
  const animated = useCountUp(k.value, 1200);
  const display = Math.round(animated).toLocaleString('en-US').replace(/,/g, ' ');
  return (
    <Card padding={18} style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 120 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7488', marginBottom: 6 }}>{k.label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
            {display}
          </div>
        </div>
        <div style={{ width: 100, height: 36, marginTop: -4 }}>
          <Sparkline data={k.spark} color={t.spark} width={100} height={36} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11.5, fontWeight: 700, color: t.fg,
          background: t.soft, padding: '3px 8px', borderRadius: 99,
        }}>
          <Icon name={k.trend === 'up' ? 'trendUp' : k.trend === 'down' ? 'trendDown' : 'arrowR'} size={11} stroke={t.fg} strokeWidth={2.5} />
          {k.delta}
        </span>
      </div>
    </Card>
  );
}

// =============================================================
// NAV PROGRESS BAR
// =============================================================
// 3px bar at the top of the viewport. Shows instantly on navigation,
// trickles toward 80% while the lazy chunk loads, then completes when the
// new page mounts. Identical UX to Next.js loading.tsx + a progress bar.

let _navListeners = new Set();
/** Call when a navigation starts (page state changes). */
export function navStart() { _navListeners.forEach((fn) => fn('start')); }
/** Call when the new page has mounted. */
export function navDone() { _navListeners.forEach((fn) => fn('done')); }

export function NavProgress() {
  // progress: 0 = hidden, 1-99 = climbing, 100 = completing then hide.
  const [progress, setProgress] = useState(0);
  const trickleRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (event === 'start') {
        setProgress(15);
        // Trickle up so the bar always feels alive — never hits 100% until done.
        if (trickleRef.current) clearInterval(trickleRef.current);
        trickleRef.current = setInterval(() => {
          setProgress((p) => (p >= 85 ? p : p + (90 - p) * 0.15));
        }, 200);
      } else if (event === 'done') {
        if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null; }
        setProgress(100);
        // Fade and reset after the completion animation finishes.
        setTimeout(() => setProgress(0), 280);
      }
    };
    _navListeners.add(handler);
    return () => {
      _navListeners.delete(handler);
      if (trickleRef.current) clearInterval(trickleRef.current);
    };
  }, []);

  if (progress === 0) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 400, pointerEvents: 'none',
      background: 'transparent',
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg, var(--kido-teal-700, #0D7377), #2FBDC0)',
        boxShadow: '0 0 10px var(--kido-teal-700, #0D7377), 0 0 5px var(--kido-teal-700, #0D7377)',
        transition: progress === 100 ? 'width 200ms ease-out, opacity 200ms ease-out 80ms' : 'width 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: progress === 100 ? 0 : 1,
      }} />
    </div>
  );
}

// =============================================================
// MODAL
// =============================================================
// Centered dialog with backdrop. ESC closes. Click outside closes.

export function Modal({ open, onClose, title, sub, children, width = 480, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  // Use a portal so the backdrop + dialog are rendered directly on document.body.
  // This prevents parent CSS transforms (e.g. page-enter animation) from displacing
  // the fixed overlay away from the viewport center.
  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(14,20,32,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(2px)',
      }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: width,
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
        animation: 'modalIn 180ms ease-out',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F1F3F8', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.01em' }}>{title}</h3>
            {sub && <div style={{ fontSize: 12.5, color: '#6B7488', marginTop: 3 }}>{sub}</div>}
          </div>
          <IconBtn icon="x" size={32} onClick={onClose} aria-label="Close" />
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ padding: '14px 24px 18px', borderTop: '1px solid #F1F3F8', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// =============================================================
// NOTIFY USER MODAL
// =============================================================

const NOTIF_TYPES = [
  { id: 'info',    label: 'Info',    emoji: '📢', bg: '#F3FBFA', border: '#0D7377', color: '#0D7377' },
  { id: 'success', label: 'Success', emoji: '✅', bg: '#DCF5E4', border: '#1F8A4E', color: '#1F8A4E' },
  { id: 'warning', label: 'Warning', emoji: '⚠️', bg: '#FFF9EE', border: '#B26A00', color: '#B26A00' },
  { id: 'alert',   label: 'Alert',   emoji: '🚨', bg: '#FFF5F5', border: '#C8324A', color: '#C8324A' },
];

export function NotifyUserModal({ open, onClose, userName, onSend }) {
  const [type, setType] = useState('info');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setType('info'); setTitle(''); setMessage(''); setBusy(false); }
  }, [open]);

  async function handleSend() {
    if (!title.trim() || !message.trim() || busy) return;
    setBusy(true);
    try {
      await onSend({ type, title: title.trim(), message: message.trim() });
    } finally { setBusy(false); }
  }

  const st = NOTIF_TYPES.find(t => t.id === type);

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={`Notify ${userName || 'user'}`}
      sub="The notification appears instantly in their mobile app."
      width={500}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn variant="primary" icon="msg" disabled={!title.trim() || !message.trim() || busy} onClick={handleSend}>
            {busy ? 'Sending…' : 'Send notification'}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Type selector */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {NOTIF_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)} disabled={busy}
                style={{
                  border: `2px solid ${type === t.id ? t.border : '#E5E8EF'}`,
                  borderRadius: 12, background: type === t.id ? t.bg : '#FAFBFD',
                  padding: '10px 4px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                  transition: 'all 140ms',
                }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{t.emoji}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: type === t.id ? t.color : '#6B7488' }}>{t.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Title</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Your verification was approved"
            maxLength={80}
            disabled={busy}
            style={{ width: '100%', height: 42, padding: '0 14px', border: '1.5px solid #E5E8EF', borderRadius: 12, fontSize: 14, fontFamily: 'inherit', background: '#FAFBFD', color: '#0E1420', outline: 'none' }}
          />
        </div>

        {/* Message */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write a clear, concise message for the user…"
            maxLength={300}
            disabled={busy}
            rows={3}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E8EF', borderRadius: 12, fontSize: 13.5, fontFamily: 'inherit', background: '#FAFBFD', color: '#0E1420', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
          />
          <div style={{ fontSize: 11, color: '#9099AD', marginTop: 4, textAlign: 'right' }}>{message.length}/300</div>
        </div>

        {/* Live preview */}
        <div style={{
          padding: '14px 16px', borderRadius: 14,
          background: st?.bg, border: `1px solid ${st?.border}`,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{st?.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1420' }}>{title || 'Notification title'}</div>
            <div style={{ fontSize: 12.5, color: '#4A5568', marginTop: 3, lineHeight: 1.4 }}>{message || 'Notification message will appear here…'}</div>
          </div>
        </div>

      </div>
    </Modal>
  );
}

// =============================================================
// TOAST  (singleton hook + container)
// =============================================================

let _toastListeners = new Set();
export function showToast(message, { tone = 'success', duration = 2800 } = {}) {
  _toastListeners.forEach((fn) => fn({ id: Date.now() + Math.random(), message, tone, duration }));
}

export function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), t.duration);
    };
    _toastListeners.add(handler);
    return () => _toastListeners.delete(handler);
  }, []);
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 10, zIndex: 300, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#0E1420', color: '#fff',
          padding: '12px 20px', borderRadius: 99,
          display: 'inline-flex', alignItems: 'center', gap: 10,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 12px 32px rgba(14,20,32,0.20)',
          animation: 'modalIn 180ms ease-out',
          pointerEvents: 'auto',
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 99,
            background: t.tone === 'error' ? '#E5304A' : t.tone === 'info' ? '#0D7377' : '#1F8A4E',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name={t.tone === 'error' ? 'x' : 'check'} size={12} stroke="#fff" strokeWidth={3} />
          </span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

window.__KidoComponents = {
  Card, Btn, IconBtn, Pill, Avatar, SearchField,
  Sidebar, Topbar, PageHeader, SectionHeader,
  Tabs, Chip, Sparkline, KpiCard,
  Modal, ToastHost, showToast,
  NavProgress, navStart, navDone,
  useCountUp, formatNum,
};
Object.assign(window, window.__KidoComponents);
