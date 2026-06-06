import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../icons.jsx';
import { useBookings } from '../hooks.js';
import { Card, Btn, IconBtn, Pill, Avatar, SearchField, PageHeader, Tabs, SectionHeader, Modal, showToast } from '../components.jsx';
import { cancelBooking, downloadCSV } from '../admin-actions.js';

// Bookings oversight — table view + active sessions monitor

export function BookingsPage({ admin, search = '' }) {
  const { data: BOOKINGS } = useBookings();
  const [tab, setTab] = useState('all');
  const [actionFor, setActionFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const query = (search || localQuery).trim().toLowerCase();

  // Separate active (in_progress) sessions for live monitor
  const activeSessions = BOOKINGS.filter(b => b.status === 'in_progress' || b.status === 'confirmed');
  const flaggedCount   = BOOKINGS.filter(b => b.flag).length;

  const filtered = BOOKINGS.filter(b => {
    if (tab === 'live'    && b.status !== 'in_progress') return false;
    if (tab === 'flagged' && !b.flag)                    return false;
    if (tab !== 'all' && tab !== 'flagged' && tab !== 'live' && b.status !== tab) return false;
    if (query) {
      const hay = `${b.id} ${b.parent} ${b.sitter} ${b.city}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Operations"
        title="Bookings oversight"
        sub="Track active, completed, and disputed bookings across the platform."
        actions={[
          <Btn key="exp" variant="ghost" icon="download" onClick={() => {
            downloadCSV(filtered.map(b => ({
              id: b.id, parent: b.parent, sitter: b.sitter,
              when: b.when, duration: b.duration,
              amount_dzd: b.amount, status: b.status, city: b.city,
            })), `kido-bookings-${new Date().toISOString().slice(0, 10)}.csv`);
            showToast(`Exported ${filtered.length} bookings`, { tone: 'success' });
          }}>Export</Btn>,
        ]}
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Tabs items={[
          { id: 'all',       label: 'All',        count: BOOKINGS.length },
          { id: 'live',      label: '🔴 Live',     count: activeSessions.length },
          { id: 'pending',   label: 'Pending',    count: BOOKINGS.filter(b => b.status === 'pending').length },
          { id: 'confirmed', label: 'Confirmed',  count: BOOKINGS.filter(b => b.status === 'confirmed').length },
          { id: 'completed', label: 'Completed',  count: BOOKINGS.filter(b => b.status === 'completed').length },
          { id: 'cancelled', label: 'Cancelled',  count: BOOKINGS.filter(b => b.status === 'cancelled').length },
          { id: 'flagged',   label: 'Flagged',    count: flaggedCount },
        ]} active={tab} onChange={setTab} />
        <span style={{ flex: 1 }} />
        <SearchField placeholder="Search booking ID, parent, sitter…" width={300} value={localQuery} onChange={setLocalQuery} />
      </div>

      {/* Live sessions monitor */}
      {tab === 'live' ? (
        <LiveSessionsPanel sessions={activeSessions} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <MiniStat label="Active right now"   value={activeSessions.length} tone="teal" />
            <MiniStat label="Avg duration"       value="3.8 h"  tone="mint" />
            <MiniStat label="Cancellation rate"  value="6.2 %"  tone="green" />
            <MiniStat label="Flagged (open)"     value={flaggedCount} tone={flaggedCount > 0 ? 'coral' : 'gray'} />
          </div>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#FAFBFD' }}>
                  <th style={thStyle}>Booking</th>
                  <th style={thStyle}>Parent</th>
                  <th style={thStyle}>Babysitter</th>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>City</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9099AD', fontSize: 13 }}>
                    No bookings match your filters.
                  </td></tr>
                )}
                {filtered.map((b, i) => (
                  <tr key={b.id} style={{ background: i % 2 ? '#FCFCFE' : '#fff' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: '#0E1420', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{b.id}</div>
                      <div style={{ fontSize: 11, color: '#9099AD' }}>{b.duration}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={b.parent} size={26} />
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.parent}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={b.sitter} size={26} verified />
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.sitter}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: '#4A5568', fontSize: 12.5 }}>{b.when}</td>
                    <td style={{ ...tdStyle, color: '#6B7488', fontSize: 12.5 }}>{b.city}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, color: '#0D7377', fontFamily: 'var(--font-display)' }}>
                        {b.amount.toLocaleString().replace(/,/g, ' ')}
                      </span>
                      <span style={{ fontSize: 11, color: '#9099AD', marginLeft: 3 }}>DZD</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Pill tone={statusTone(b.status)} dot size="sm">{cap(b.status)}</Pill>
                        {b.flag && <Pill tone="red" size="sm" icon="flag">{b.flag}</Pill>}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <IconBtn icon="more" size={28} onClick={() => setActionFor(b)} title={`Manage ${b.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F3F8', fontSize: 12, color: '#6B7488', display: 'flex', alignItems: 'center' }}>
              Showing <strong style={{ color: '#0E1420', margin: '0 4px' }}>{filtered.length}</strong> of {BOOKINGS.length}
            </div>
          </Card>
        </>
      )}

      <BookingActionsModal
        booking={actionFor}
        busy={busy}
        onClose={() => setActionFor(null)}
        onCancel={async () => {
          if (!confirm(`Cancel booking ${actionFor.id}?`)) return;
          setBusy(true);
          try {
            await cancelBooking(actionFor.id, { actor: admin, reason: 'Cancelled by moderator.' });
            showToast(`Booking ${actionFor.id} cancelled`, { tone: 'error' });
            setActionFor(null);
          } catch (e) {
            showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
          } finally { setBusy(false); }
        }}
      />
    </div>
  );
}

// ─── F2: Live Sessions Monitor ────────────────────────────────────────────────

function LiveSessionsPanel({ sessions }) {
  const [tick, setTick] = useState(0);
  // Re-render every minute to update elapsed time
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (sessions.length === 0) {
    return (
      <Card padding={48} style={{ textAlign: 'center', color: '#9099AD' }}>
        <Icon name="play" size={32} stroke="#B8BECE" style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>No active sessions right now</div>
        <div style={{ fontSize: 12.5, marginTop: 4 }}>Sessions appear here when a booking is IN_PROGRESS.</div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: '#FF3B30', animation: 'pulse 1.5s ease-out infinite', display: 'inline-block' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0E1420' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} in progress</span>
        <span style={{ fontSize: 11.5, color: '#9099AD' }}>· updates every minute</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {sessions.map(s => <LiveSessionCard key={s.id} s={s} tick={tick} />)}
      </div>
    </div>
  );
}

function LiveSessionCard({ s, tick }) {
  const startTime = s.startRaw ? new Date(s.startRaw) : null;
  const endTime   = s.endRaw   ? new Date(s.endRaw)   : null;
  const now = new Date();
  const elapsedMins = startTime ? Math.max(0, Math.floor((now - startTime) / 60000)) : null;
  const remainMins  = endTime   ? Math.floor((endTime - now) / 60000) : null;
  const isOvertime  = remainMins !== null && remainMins < -10;
  const isNearEnd   = remainMins !== null && remainMins >= 0 && remainMins <= 30;

  const formatMins = (m) => {
    if (m === null) return '—';
    const abs = Math.abs(m);
    const h = Math.floor(abs / 60);
    const min = abs % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  return (
    <Card padding={18} style={{ border: isOvertime ? '1.5px solid #FFB8C8' : '1px solid #EDEFF4', background: isOvertime ? '#FFF8FA' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={s.sitter} size={42} verified />
          <span style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 99, background: '#34C759', border: '2px solid #fff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1420' }}>{s.sitter}</div>
          <div style={{ fontSize: 11.5, color: '#6B7488' }}>with <strong>{s.parent}</strong> · {s.city}</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#9099AD' }}>{s.id}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <TimeBox label="Elapsed"   value={elapsedMins !== null ? formatMins(elapsedMins) : s.duration} color="#0D7377" />
        <TimeBox label="Remaining" value={remainMins !== null ? (remainMins < 0 ? `+${formatMins(remainMins)} over` : formatMins(remainMins)) : '—'} color={isOvertime ? '#C8324A' : isNearEnd ? '#B26A00' : '#1F8A4E'} />
        <TimeBox label="Amount"    value={`${Number(s.amount).toLocaleString()} DZD`} color="#0E1420" />
      </div>

      {isOvertime && (
        <div style={{ padding: '8px 12px', background: '#FFE0E4', borderRadius: 8, fontSize: 12, color: '#C8324A', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="alert" size={13} stroke="#C8324A" />
          Session running {formatMins(Math.abs(remainMins))} over expected end time
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="ghost" size="sm" icon="msg" full onClick={() => showToast('In-app messaging ships in the mobile app', { tone: 'info' })}>
          Message sitter
        </Btn>
        <Btn variant={isOvertime ? 'dangerSolid' : 'soft'} size="sm" icon="flag" onClick={() => showToast(`Session ${s.id} flagged for review`, { tone: isOvertime ? 'error' : 'info' })}>
          {isOvertime ? 'Flag urgent' : 'Flag'}
        </Btn>
      </div>
    </Card>
  );
}

function TimeBox({ label, value, color }) {
  return (
    <div style={{ background: '#F8F9FC', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9099AD', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}

// ─── Booking actions modal ────────────────────────────────────────────────────

export function BookingActionsModal({ booking, busy, onClose, onCancel }) {
  if (!booking) return null;
  return (
    <Modal open={!!booking} onClose={onClose} title={`Booking ${booking.id}`}
      sub={`${booking.parent} → ${booking.sitter} · ${booking.when}`} width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: 14, background: '#FAFBFD', borderRadius: 12, border: '1px solid #F1F3F8' }}>
          <KV label="Amount"   value={`${booking.amount.toLocaleString().replace(/,/g, ' ')} DZD`} />
          <KV label="Duration" value={booking.duration} />
          <KV label="City"     value={booking.city} />
          <KV label="Status"   value={booking.status} />
        </div>
        {/* F3: Mutual ratings section */}
        <RatingsSection booking={booking} />
        <Btn variant="dangerSolid" icon="x" full
          disabled={busy || booking.status === 'cancelled' || booking.status === 'completed'}
          onClick={onCancel}>
          Cancel booking
        </Btn>
      </div>
    </Modal>
  );
}

// F3: Show mutual ratings submitted after a completed session
function RatingsSection({ booking }) {
  if (booking.status !== 'completed') return null;
  // In production these come from the reviews table filtered by booking_id.
  // For demo/mock, synthesize based on whether it's a completed booking.
  const hasParentRating = booking.amount > 1000; // mock heuristic
  const hasSitterRating = booking.amount > 800;
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Mutual ratings
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <RatingChip label="Parent rated sitter" submitted={hasParentRating} stars={hasParentRating ? 4 : null} />
        <RatingChip label="Sitter rated parent" submitted={hasSitterRating} stars={hasSitterRating ? 5 : null} />
      </div>
      {(!hasParentRating || !hasSitterRating) && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: '#9099AD' }}>
          Missing ratings: a nudge notification can be sent to remind users.
        </div>
      )}
    </div>
  );
}

function RatingChip({ label, submitted, stars }) {
  return (
    <div style={{ padding: '10px 12px', background: submitted ? '#DCF5E4' : '#F8F9FC', borderRadius: 10, border: `1px solid ${submitted ? '#BCE8CC' : '#EDEFF4'}` }}>
      <div style={{ fontSize: 10.5, color: '#6B7488', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {submitted ? (
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Icon key={i} name="star" size={13} fill={i < stars ? '#FFB02E' : '#E5E8EF'} stroke={i < stars ? '#FFB02E' : '#E5E8EF'} />
          ))}
        </div>
      ) : (
        <span style={{ fontSize: 11, color: '#B26A00', fontWeight: 700 }}>Not submitted yet</span>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function KV({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12.5 }}>
      <span style={{ color: '#6B7488' }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#0E1420' }}>{value}</span>
    </div>
  );
}

function statusTone(s) {
  return s === 'pending' ? 'amber' : s === 'confirmed' ? 'teal' : s === 'in_progress' ? 'green' : s === 'completed' ? 'mint' : 'red';
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ') : ''; }

export function MiniStat({ label, value, tone }) {
  const tones = { teal: '#0D7377', mint: '#199CA0', green: '#1F8A4E', coral: '#C8324A', gray: '#9099AD' };
  return (
    <Card padding={16}>
      <div style={{ fontSize: 11.5, color: '#6B7488', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tones[tone] || '#0E1420', marginTop: 6, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{value}</div>
    </Card>
  );
}

const thStyle = { padding: '12px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #F1F3F8' };
const tdStyle = { padding: '12px 14px', fontSize: 13, color: '#0E1420', borderBottom: '1px solid #F8F9FC' };
