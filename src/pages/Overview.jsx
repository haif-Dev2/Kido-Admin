import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icons.jsx';
import { BOOKINGS_TREND } from '../data.jsx';
import { useKPIs, useReports, useVerifications, useAuditLog } from '../hooks.js';
import { Card, Btn, Pill, Avatar, PageHeader, Chip, SectionHeader, KpiCard, showToast } from '../components.jsx';
import { downloadCSV } from '../admin-actions.js';

// Overview / Dashboard page

export function OverviewPage({ goto, admin }) {
  const KPI_DATA = useKPIs();
  const { data: REPORTS } = useReports();
  const { data: VERIFICATIONS } = useVerifications();
  const { data: AUDIT_LOG } = useAuditLog();

  // Live greeting — re-renders if the user keeps the tab open into a new
  // morning/afternoon/evening window.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = admin?.first_name || (admin?.email ? admin.email.split('@')[0] : 'admin');
  const city = admin?.city || 'Mostaganem';
  const dateLine = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
    + ' · ' + city.toUpperCase();
  const critical = REPORTS.filter(r => r.priority === 'critical' && r.status === 'open').length;
  const todayVerifs = VERIFICATIONS.length;
  const [range, setRange] = useState('14d');
  const trend = BOOKINGS_TREND.slice(-({ '14d': 14, '30d': 30, '90d': 90 }[range] || 14));
  const max = Math.max(...trend.map(d => d.count));
  function exportWeekly() {
    const rows = [
      { metric: 'Total users',          value: KPI_DATA.users.value },
      { metric: 'Active bookings',      value: KPI_DATA.bookings.value },
      { metric: 'Pending verifications', value: KPI_DATA.pendingVerif.value },
      { metric: 'Open reports',          value: KPI_DATA.openReports.value },
      ...trend.map(d => ({ metric: `Bookings ${d.label || d.day || ''}`, value: d.count })),
    ];
    downloadCSV(rows, `kido-weekly-${new Date().toISOString().slice(0, 10)}.csv`);
    showToast('Weekly report downloaded', { tone: 'success' });
  }
  const topReports = REPORTS.slice(0, 3);
  const topVerifs = VERIFICATIONS.slice(0, 4);

  return (
    <div className="page-enter">
      <PageHeader
        kicker={dateLine}
        title={`${greeting}, ${firstName}.`}
        sub={
          <span>
            {critical > 0
              ? <>You have <strong style={{ color: '#C8324A' }}>{critical} critical report{critical === 1 ? '' : 's'}</strong> waiting.</>
              : <>No critical reports — nice.</>}
            {' '}
            {todayVerifs > 0
              ? <>{todayVerifs} sitter verification{todayVerifs === 1 ? '' : 's'} in queue.</>
              : <>The verification queue is clear.</>}
          </span>
        }
        actions={[
          <Btn key="export" variant="ghost" icon="download" onClick={exportWeekly}>Export weekly report</Btn>,
          <Btn key="queue" variant="primary" icon="zap" onClick={() => goto('reports')}>Open queue</Btn>,
        ]}
      />

      {/* KPI ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <KpiCard k={KPI_DATA.users} />
        <KpiCard k={KPI_DATA.bookings} />
        <KpiCard k={KPI_DATA.pendingVerif} />
        <KpiCard k={KPI_DATA.openReports} />
      </div>

      {/* QUICK ACTION CARDS (H2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
        <QuickAction
          icon="shield" tone="amber"
          count={KPI_DATA.pendingVerif?.value ?? 0}
          label="verifications pending"
          onClick={() => goto('verification')}
        />
        <QuickAction
          icon="flag" tone="coral"
          count={KPI_DATA.openReports?.value ?? 0}
          label="reports unresolved"
          onClick={() => goto('reports')}
        />
        <QuickAction
          icon="pause" tone="coral"
          count={KPI_DATA.suspended?.value ?? 0}
          label="users suspended"
          onClick={() => goto('users')}
        />
        <QuickAction
          icon="card" tone="amber"
          count={0}
          label="CCP payments 24h+"
          onClick={() => goto('payments')}
        />
      </div>

      {/* MAIN GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Bookings chart */}
        <Card padding={22}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0E1420' }}>Bookings · last 14 days</h3>
              <div style={{ fontSize: 12, color: '#6B7488', marginTop: 3 }}>Total <strong style={{ color: '#0E1420' }}>2 618</strong> · Avg <strong style={{ color: '#0E1420' }}>187/day</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={range === '14d'} onClick={() => setRange('14d')}>14d</Chip>
              <Chip active={range === '30d'} onClick={() => setRange('30d')}>30d</Chip>
              <Chip active={range === '90d'} onClick={() => setRange('90d')}>90d</Chip>
            </div>
          </div>
          {/* Bar chart */}
          <BarChart trend={trend} max={max} />
          <div style={{ display: 'flex', gap: 16, marginTop: 22, fontSize: 11.5, color: '#6B7488' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#7DD6D8' }} /> Confirmed</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: '#FF6B8A' }} /> Today</span>
          </div>
        </Card>

        {/* Critical alerts */}
        <Card padding={22} style={{ background: 'linear-gradient(165deg, #FFF8FA 0%, #FFFFFF 60%)', border: '1px solid #FFE4EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span className="pulse-danger" style={{ width: 32, height: 32, borderRadius: 10, background: '#FFE0E4', color: '#C8324A', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="alert" size={16} />
            </span>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#0E1420' }}>Needs your attention</h3>
              <div style={{ fontSize: 11.5, color: '#6B7488' }}>2 critical · 1 high priority</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topReports.map(r => (
              <div key={r.id} style={{ padding: 12, background: '#fff', borderRadius: 12, border: '1px solid #F1F3F8', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <Avatar name={r.target} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Pill tone={r.priority === 'critical' ? 'red' : 'amber'} size="sm" dot>{r.priority}</Pill>
                    <span style={{ fontSize: 10.5, color: '#9099AD', fontWeight: 600 }}>· {r.id} · {r.opened}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7488', marginTop: 1 }}>{r.target} · {r.targetRole.toLowerCase()} · reported by {r.count}</div>
                </div>
                <button onClick={() => goto('reports')} style={{ background: '#F1F3F8', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#4A5568', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="chevron" size={14} />
                </button>
              </div>
            ))}
          </div>
          <Btn variant="ghost" full size="md" iconRight="arrowR" onClick={() => goto('reports')} style={{ marginTop: 14 }}>
            See all {KPI_DATA.openReports?.value ?? REPORTS.length} reports
          </Btn>
        </Card>
      </div>

      {/* SECONDARY ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>
        {/* Verification queue */}
        <Card padding={22}>
          <SectionHeader title="Awaiting verification" sub="Sitters who submitted documents in the last 24h" action="Review all" onAction={() => goto('verification')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {topVerifs.map((v, i) => (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F3F8' }}>
                <Avatar name={v.name} initial={v.initial} bg0={v.bg0} bg1={v.bg1} tint={v.tint} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1420' }}>{v.name}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7488', marginTop: 1, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <Icon name="pin" size={11} stroke="#9099AD" /> {v.city} · <span>{v.exp}</span> · <span>{v.submitted}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Pill tone={v.idType === 'Passport' ? 'violet' : 'gray'} size="sm">{v.idType}</Pill>
                  {v.selfie && <Pill tone="teal" size="sm" icon="check">Selfie</Pill>}
                  {!v.cv && <Pill tone="amber" size="sm">No CV</Pill>}
                </div>
                <div style={{ width: 56, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: v.score >= 80 ? '#1F8A4E' : v.score >= 60 ? '#B26A00' : '#C8324A', fontFamily: 'var(--font-display)' }}>{v.score}</div>
                  <div style={{ fontSize: 9.5, color: '#9099AD', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Score</div>
                </div>
                <Btn variant="ghost" size="sm" onClick={() => goto('verification')}>Review</Btn>
              </div>
            ))}
          </div>
        </Card>

        {/* Activity / breakdown */}
        <Card padding={22}>
          <SectionHeader title="User mix" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <DonutBreakdown />
          </div>
        </Card>
      </div>

      {/* TERTIARY ROW: Audit + Cities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 }}>
        <Card padding={22}>
          <SectionHeader title="Recent moderation activity" action="Audit log" onAction={() => goto('audit')} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {AUDIT_LOG.slice(0, 5).map((l, i) => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderTop: i === 0 ? 'none' : '1px solid #F1F3F8' }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: actionTone(l.action).bg, color: actionTone(l.action).fg,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={actionTone(l.action).icon} size={14} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: '#0E1420' }}>
                    <strong>{l.actor}</strong> <span style={{ color: '#6B7488' }}>{l.action}</span> {l.entity}
                  </div>
                  <div style={{ fontSize: 11, color: '#9099AD', marginTop: 1 }}>{l.detail}</div>
                </div>
                <div style={{ fontSize: 11, color: '#9099AD', whiteSpace: 'nowrap' }}>{l.when}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={22}>
          <SectionHeader title="Top cities" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { city: 'Algiers',     bookings: 1820, share: 0.71, parents: 1956, sitters: 642 },
              { city: 'Oran',        bookings: 412,  share: 0.16, parents: 521,  sitters: 188 },
              { city: 'Constantine', bookings: 198,  share: 0.08, parents: 280,  sitters: 96  },
              { city: 'Mostaganem',  bookings: 128,  share: 0.05, parents: 184,  sitters: 60  },
            ].map(c => (
              <div key={c.city}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#0E1420' }}>{c.city}</span>
                  <span style={{ color: '#6B7488' }}>{c.bookings.toLocaleString().replace(/,/g, ' ')} bookings</span>
                </div>
                <div style={{ height: 6, background: '#F1F3F8', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${c.share * 100}%`, height: '100%', background: 'linear-gradient(90deg, #0D7377, #2FBDC0)', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 10.5, color: '#9099AD', marginTop: 4 }}>{c.parents} parents · {c.sitters} sitters</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ icon, tone, count, label, onClick }) {
  const tones = {
    amber: { bg: '#FFF4DC', fg: '#B26A00', border: '#FDECC8' },
    coral: { bg: '#FFE4EB', fg: '#C8324A', border: '#FFD0DA' },
    teal:  { bg: '#E8F8F5', fg: '#0D7377', border: '#C8EFF0' },
    green: { bg: '#DCF5E4', fg: '#1F8A4E', border: '#BCEACD' },
  };
  const t = tones[tone] || tones.teal;
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={count > 0 ? onClick : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '16px 18px',
        background: count > 0 ? t.bg : '#F8F9FC',
        border: `1px solid ${count > 0 ? t.border : '#EDEFF4'}`,
        borderRadius: 14, cursor: count > 0 ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 14,
        transform: hover && count > 0 ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover && count > 0 ? `0 8px 24px rgba(14,20,32,0.08)` : 'none',
        transition: 'all 200ms cubic-bezier(0.2,0.8,0.2,1)',
      }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: count > 0 ? 'rgba(255,255,255,0.7)' : '#EDEFF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} stroke={count > 0 ? t.fg : '#9099AD'} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: count > 0 ? t.fg : '#B8BECE', lineHeight: 1, letterSpacing: '-0.01em' }}>{count}</div>
        <div style={{ fontSize: 11.5, color: count > 0 ? t.fg : '#9099AD', fontWeight: 600, marginTop: 2 }}>{label}</div>
      </div>
      {count > 0 && <Icon name="arrowR" size={14} stroke={t.fg} style={{ marginLeft: 'auto' }} />}
    </div>
  );
}

function actionTone(action) {
  const map = {
    approved:      { bg: '#DCF5E4', fg: '#1F8A4E', icon: 'check' },
    rejected:      { bg: '#FFE0E4', fg: '#C8324A', icon: 'x' },
    suspended:     { bg: '#FFE0E4', fg: '#C8324A', icon: 'pause' },
    banned:        { bg: '#FFE0E4', fg: '#C8324A', icon: 'ban' },
    warned:        { bg: '#FFF4DC', fg: '#B26A00', icon: 'alert' },
    removed:       { bg: '#FFE0E4', fg: '#C8324A', icon: 'trash' },
    'auto-flagged':{ bg: '#EDE9FE', fg: '#5B4DC2', icon: 'zap' },
    closed:        { bg: '#EDEFF4', fg: '#4A5568', icon: 'check' },
    opened:        { bg: '#DEF4F4', fg: '#0D7377', icon: 'eye' },
  };
  return map[action] || map.opened;
}

export function DonutBreakdown() {
  const segments = [
    { label: 'Parents',           value: 3156, color: '#0D7377' },
    { label: 'Verified sitters',   value: 824,  color: '#2FBDC0' },
    { label: 'Pending sitters',    value: 184,  color: '#FFB02E' },
    { label: 'Suspended/banned',   value: 123,  color: '#FF6B8A' },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);
  let cumul = 0;
  const radius = 56, stroke = 18, cx = 80, cy = 80;
  const C = 2 * Math.PI * radius;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
        <svg width={160} height={160}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#F1F3F8" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * C;
            const off = -cumul * C;
            cumul += frac;
            return (
              <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
                stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={off}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`} />
            );
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#0E1420', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{total.toLocaleString().replace(/,/g, ' ')}</div>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0E1420' }}>{s.label}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0E1420', fontFamily: 'var(--font-display)' }}>{s.value.toLocaleString().replace(/,/g, ' ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}



// =============================================================
// Bar chart with hover tooltip + entrance animation
// =============================================================
export function BarChart({ trend, max }) {
  const [hover, setHover] = useState(null);
  return (
    <div
      onMouseLeave={() => setHover(null)}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, paddingBottom: 24, borderBottom: '1px dashed #EDEFF4', position: 'relative' }}
    >
      {[1, 0.66, 0.33].map((p, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${(1 - p) * 100}%`, borderTop: '1px dashed #F1F3F8', pointerEvents: 'none' }} />
      ))}
      {trend.map((d, i) => {
        const h = (d.count / max) * 100;
        const isToday = i === trend.length - 1;
        const isHover = hover === i;
        return (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, position: 'relative', cursor: 'pointer' }}
          >
            {isHover && (
              <div style={{
                position: 'absolute', bottom: `calc(${h}% + 8px)`,
                background: '#0E1420', color: '#fff',
                padding: '6px 10px', borderRadius: 8,
                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                boxShadow: '0 8px 24px rgba(14,20,32,0.18)',
                fontVariantNumeric: 'tabular-nums',
                pointerEvents: 'none', zIndex: 2,
              }}>
                <span style={{ color: '#7DD6D8' }}>{d.d}</span>
                {' · '}
                <span>{d.count} bookings</span>
                <span style={{
                  position: 'absolute', left: '50%', bottom: -3,
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: 6, height: 6, background: '#0E1420',
                }} />
              </div>
            )}
            <div
              className="bar-rise"
              style={{
                width: '100%', maxWidth: 30, height: `${h}%`,
                animationDelay: `${i * 35}ms`,
                background: isToday
                  ? 'linear-gradient(180deg, #FF6B8A, #E04A6E)'
                  : isHover
                    ? 'linear-gradient(180deg, #5DC8CB, #199CA0)'
                    : 'linear-gradient(180deg, #B7E8E9, #7DD6D8)',
                borderRadius: '6px 6px 2px 2px',
                transition: 'background 200ms ease',
              }}
            />
            <div style={{ fontSize: 10, color: isToday ? '#C8324A' : isHover ? '#0D7377' : '#9099AD', fontWeight: isToday || isHover ? 700 : 500, position: 'absolute', bottom: -20, whiteSpace: 'nowrap', transition: 'color 150ms' }}>
              {d.d.slice(-2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

