import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icons.jsx';
import { useAuditLog } from '../hooks.js';
import { Card, Btn, SearchField, PageHeader, Tabs, Chip, showToast } from '../components.jsx';
import { downloadCSV } from '../admin-actions.js';

// Audit log — append-only timeline of admin actions

function actionTone(action) {
  const map = {
    approved:       { bg: '#DCF5E4', fg: '#1F8A4E', icon: 'check' },
    rejected:       { bg: '#FFE0E4', fg: '#C8324A', icon: 'x' },
    suspended:      { bg: '#FFE0E4', fg: '#C8324A', icon: 'pause' },
    banned:         { bg: '#FFE0E4', fg: '#C8324A', icon: 'ban' },
    warned:         { bg: '#FFF4DC', fg: '#B26A00', icon: 'alert' },
    removed:        { bg: '#FFE0E4', fg: '#C8324A', icon: 'trash' },
    'auto-flagged': { bg: '#EDE9FE', fg: '#5B4DC2', icon: 'zap' },
    closed:         { bg: '#EDEFF4', fg: '#4A5568', icon: 'check' },
    opened:         { bg: '#DEF4F4', fg: '#0D7377', icon: 'eye' },
  };
  return map[action] || map.opened;
}

// Map an audit log entity string (e.g. "Profile abc123", "Verification V-481")
// to the target page + params for the goto() router.
function resolveEntityNav(entity, goto) {
  if (!entity || !goto) return null;
  const [type, ...rest] = entity.trim().split(' ');
  const id = rest.join(' ').trim();
  switch (type) {
    case 'Profile':      return () => goto('user-detail', { userId: id });
    case 'Verification': return () => goto('verification');
    case 'Report':       return () => goto('reports');
    case 'Booking':      return () => goto('bookings');
    case 'Transaction':  return () => goto('payments');
    case 'Review':       return () => goto('reviews');
    default:             return null;
  }
}

export function AuditLogPage({ search = '', goto }) {
  const { data: AUDIT_LOG } = useAuditLog();
  const [actorFilter, setActorFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [localSearch, setLocalSearch] = useState('');
  const q = (search || localSearch).trim().toLowerCase();
  const filtered = AUDIT_LOG.filter(l => {
    if (actorFilter === 'admin' && l.actor === 'System') return false;
    if (actorFilter === 'system' && l.actor !== 'System') return false;
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (q) {
      if (!l.actor.toLowerCase().includes(q) &&
          !l.action.toLowerCase().includes(q) &&
          !l.entity.toLowerCase().includes(q) &&
          !(l.detail || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });
  // Group by day for the timeline
  const grouped = {};
  filtered.forEach(l => {
    const day = l.when.includes('ago') || l.when === 'Just now' ? 'Today' : l.when.split(',')[0];
    (grouped[day] ||= []).push(l);
  });

  return (
    <div className="page-enter">
      <PageHeader
        kicker="System"
        title="Audit log"
        sub="Append-only record of every moderation action. Visible to admins only — required by NFR-S4."
        actions={[<Btn key="exp" variant="ghost" icon="download" onClick={() => {
          downloadCSV(filtered.map(l => ({
            id: l.id, when: l.when, actor: l.actor, action: l.action, entity: l.entity, detail: l.detail,
          })), `kido-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
          showToast(`Exported ${filtered.length} entries`, { tone: 'success' });
        }}>Export full log</Btn>]}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Tabs
          items={[
            { id: 'all',    label: 'All actors' },
            { id: 'admin',  label: 'Admin' },
            { id: 'system', label: 'System' },
          ]}
          active={actorFilter} onChange={setActorFilter}
        />
        <span style={{ width: 1, height: 24, background: '#EDEFF4' }} />
        <Chip active={actionFilter === 'all'} onClick={() => setActionFilter('all')}>All actions</Chip>
        <Chip active={actionFilter === 'approved'} onClick={() => setActionFilter('approved')} tone={actionFilter !== 'approved' ? 'teal' : null}>Approvals</Chip>
        <Chip active={actionFilter === 'suspended'} onClick={() => setActionFilter('suspended')} tone={actionFilter !== 'suspended' ? 'coral' : null}>Suspensions</Chip>
        <Chip active={actionFilter === 'banned'} onClick={() => setActionFilter('banned')}>Bans</Chip>
        <span style={{ flex: 1 }} />
        <SearchField placeholder="Search audit log…" width={260} value={localSearch} onChange={setLocalSearch} />
      </div>

      <Card padding={28}>
        {Object.entries(grouped).map(([day, entries]) => (
          <div key={day} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, paddingLeft: 38 }}>{day}</div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 14, top: 6, bottom: 6, width: 1, background: '#F1F3F8' }} />
              {entries.map(l => {
                const tone = actionTone(l.action);
                return (
                  <div key={l.id} style={{ display: 'flex', gap: 14, marginBottom: 14, position: 'relative' }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 99, flexShrink: 0,
                      background: tone.bg, color: tone.fg, zIndex: 1,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      border: '3px solid #fff',
                    }}>
                      <Icon name={tone.icon} size={13} strokeWidth={2.4} />
                    </span>
                    <div style={{ flex: 1, paddingTop: 1 }}>
                      <div style={{ fontSize: 13, color: '#0E1420' }}>
                        <strong>{l.actor}</strong>
                        <span style={{ color: '#6B7488' }}> {l.action} </span>
                        <span style={{ fontWeight: 600 }}>{l.entity}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7488', marginTop: 2 }}>{l.detail}</div>
                      <div style={{ fontSize: 10.5, color: '#9099AD', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{l.id}</span>
                        <span>·</span>
                        <span>{l.when}</span>
                      </div>
                    </div>
                    {(() => {
                      const nav = resolveEntityNav(l.entity, goto);
                      return nav
                        ? <Btn variant="ghost" size="sm" onClick={nav}>Open</Btn>
                        : <Btn variant="ghost" size="sm" onClick={() => showToast(`${l.entity} — ${l.detail || 'no detail'}`, { tone: 'info', duration: 4200 })}>Open</Btn>;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}


