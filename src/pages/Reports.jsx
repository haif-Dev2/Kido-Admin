import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icons.jsx';
import { useReports, useAutoRules } from '../hooks.js';
import { Card, Btn, Pill, Avatar, SearchField, PageHeader, Tabs, Chip, SectionHeader, Modal, showToast } from '../components.jsx';
import { decideReport, suspendUser, writeAuditLog, downloadCSV, createAutoRule, deleteAutoRule } from '../admin-actions.js';

// Reports & moderation queue

export function ReportsPage({ admin, search = '', goto, onActionDone }) {
  const { data: REPORTS } = useReports();
  const { data: rules, refetch: refetchRules } = useAutoRules();
  const [items, setItems] = useState([]);
  React.useEffect(() => { setItems(REPORTS); }, [REPORTS]);
  const [activeTab, setActiveTab] = useState('open');
  const [priority, setPriority] = useState('all');
  const [selectedId, setSelectedId] = useState(REPORTS[0]?.id);
  const [decisions, setDecisions] = useState({});
  const [busy, setBusy] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const query = (search || localQuery).trim().toLowerCase();

  const filtered = items.filter(r => {
    if (activeTab === 'open' && r.status === 'closed') return false;
    if (activeTab === 'investigating' && r.status !== 'investigating') return false;
    if (activeTab === 'closed' && r.status !== 'closed') return false;
    if (priority !== 'all' && r.priority !== priority) return false;
    if (query) {
      const hay = `${r.id} ${r.reason} ${r.reporter} ${r.target}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const selected = items.find(r => r.id === selectedId) || filtered[0];

  const [adminNotes, setAdminNotes] = useState({}); // id → note text

  async function decide(id, action) {
    if (action === 'banned' && !confirm('Ban this account permanently? This requires a second admin review per policy.')) return;
    setBusy(true);
    setDecisions(d => ({ ...d, [id]: action }));
    const note = adminNotes[id] || '';
    try {
      // If suspending from a report, call the real suspendUser action too
      if (action === 'suspended') {
        const report = items.find(r => r.id === id);
        if (report?.targetId) {
          await suspendUser(report.targetId, { durationDays: 7, reason: `Report ${id}: ${report.reason}`, triggeredBy: `report:${id}`, actor: admin });
        }
      }
      await decideReport(id, action, { actor: admin, notes: note || undefined });
      showToast(`Report ${id} → ${action}`, { tone: action === 'banned' || action === 'suspended' ? 'error' : 'success' });
      onActionDone?.();
    } catch (e) {
      setDecisions(d => { const { [id]: _, ...rest } = d; return rest; });
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function exportCSV() {
    downloadCSV(filtered.map(r => ({
      id: r.id, priority: r.priority, reason: r.reason,
      reporter: r.reporter, reporter_role: r.reporterRole,
      target: r.target, target_role: r.targetRole,
      status: r.status, opened: r.opened, notes: r.notes,
    })), `kido-reports-${new Date().toISOString().slice(0, 10)}.csv`);
    showToast(`Exported ${filtered.length} reports`, { tone: 'success' });
  }

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Trust & Safety"
        title="Reports & moderation"
        sub="Open reports filed by users or auto-flagged by the system. Resolve to keep parents safe."
        actions={[
          <Btn key="export" variant="ghost" icon="download" onClick={exportCSV}>Export</Btn>,
          <Btn key="rule" variant="primary" icon="plus" onClick={() => setRuleOpen(true)}>New auto-rule</Btn>,
        ]}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Tabs
          items={[
            { id: 'open', label: 'Open', count: items.filter(r => r.status === 'open').length },
            { id: 'investigating', label: 'Investigating', count: items.filter(r => r.status === 'investigating').length },
            { id: 'closed', label: 'Resolved', count: items.filter(r => r.status === 'closed' || r.status === 'resolved').length },
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
        <span style={{ width: 1, height: 24, background: '#EDEFF4' }} />
        <Chip active={priority === 'all'} onClick={() => setPriority('all')}>All priorities</Chip>
        <Chip active={priority === 'critical'} onClick={() => setPriority('critical')} tone={priority !== 'critical' ? 'coral' : null}>Critical</Chip>
        <Chip active={priority === 'high'} onClick={() => setPriority('high')} tone={priority !== 'high' ? 'amber' : null}>High</Chip>
        <Chip active={priority === 'medium'} onClick={() => setPriority('medium')}>Medium</Chip>
        <Chip active={priority === 'low'} onClick={() => setPriority('low')}>Low</Chip>
        <span style={{ flex: 1 }} />
        <SearchField placeholder="Search reports…" width={260} value={localQuery} onChange={setLocalQuery} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 16 }}>
        {/* Queue */}
        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F3F8', background: '#FAFBFD', display: 'grid', gridTemplateColumns: '90px 1fr 110px', gap: 8, fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>Priority</span>
            <span>Report</span>
            <span style={{ textAlign: 'right' }}>Opened</span>
          </div>
          {filtered.map(r => {
            const isSel = selectedId === r.id;
            const d = decisions[r.id];
            return (
              <button key={r.id} onClick={() => setSelectedId(r.id)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none',
                  background: isSel ? '#F3FBFA' : '#fff',
                  borderLeft: `3px solid ${isSel ? '#0D7377' : 'transparent'}`,
                  padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit',
                  display: 'grid', gridTemplateColumns: '90px 1fr 110px', gap: 8,
                  borderBottom: '1px solid #F8F9FC', alignItems: 'center',
                }}>
                <Pill tone={priorityTone(r.priority)} size="sm" dot>{r.priority}</Pill>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1420', marginBottom: 2 }}>{r.reason}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7488', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{r.id}</span>
                    <span>·</span>
                    <span>against <strong style={{ color: '#0E1420' }}>{r.target}</strong></span>
                    {r.count > 1 && <Pill tone="red" size="sm">×{r.count} reports</Pill>}
                    {d && <Pill tone={d === 'suspended' || d === 'banned' ? 'red' : d === 'dismissed' ? 'gray' : 'green'} size="sm">{d}</Pill>}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#9099AD', textAlign: 'right' }}>{r.opened}</div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#6B7488', fontSize: 13 }}>No reports match these filters.</div>
          )}
        </Card>

        {/* Detail */}
        {selected && (
          <ReportDetail
            r={selected}
            decision={decisions[selected.id]}
            busy={busy}
            onDecide={(a) => decide(selected.id, a)}
            adminNote={adminNotes[selected.id] || ''}
            onNoteChange={(v) => setAdminNotes(n => ({ ...n, [selected.id]: v }))}
            goto={goto}
            allReports={items}
          />
        )}
      </div>

      <ActiveRulesSection rules={rules} admin={admin} onDeleted={refetchRules} />

      <NewAutoRuleModal
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        admin={admin}
        onCreated={refetchRules}
      />
    </div>
  );
}

export function NewAutoRuleModal({ open, onClose, admin, onCreated }) {
  const [trigger, setTrigger] = useState('keyword');
  const [value, setValue] = useState('');
  const [action, setAction] = useState('flag');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setTrigger('keyword'); setValue(''); setAction('flag'); setBusy(false); }
  }, [open]);

  async function handleCreate() {
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await createAutoRule({ trigger, value: value.trim(), action }, { actor: admin });
      showToast('Rule saved — active immediately', { tone: 'success' });
      onCreated?.();
      onClose();
    } catch (e) {
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  const TRIGGERS = [
    { id: 'keyword', label: 'Keyword',  icon: '💬', hint: 'Fires when a message contains a specific word or phrase' },
    { id: 'rating',  label: 'Rating',   icon: '⭐', hint: 'Fires when a sitter rating drops below a threshold' },
    { id: 'reports', label: 'Reports',  icon: '🚩', hint: 'Fires when N reports are filed against the same user in 24 h' },
  ];
  const ACTIONS = [
    { id: 'flag',    label: 'Flag for review',   tone: 'teal',  desc: 'Adds to the moderation queue for manual review' },
    { id: 'hide',    label: 'Hide listing',       tone: 'amber', desc: 'Hides the sitter from public search results' },
    { id: 'suspend', label: 'Auto-suspend 7 days', tone: 'red',  desc: 'Immediately suspends the account for 7 days' },
  ];

  const valLabel = trigger === 'keyword' ? 'Keyword or phrase' : trigger === 'rating' ? 'Star rating below' : 'Number of reports (N)';
  const valPlaceholder = trigger === 'keyword' ? 'e.g. cash only, off-platform' : trigger === 'rating' ? '2' : '3';

  const previewWhen = value.trim()
    ? trigger === 'keyword' ? `message contains "${value.trim()}"`
    : trigger === 'rating'  ? `rating drops below ${value.trim()} ★`
    : `${value.trim()} reports in 24 h`
    : '…';
  const selectedAction = ACTIONS.find(a => a.id === action);

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="New auto-moderation rule"
      sub="Rules are checked automatically on every report and message."
      width={520}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn variant="primary" icon="check" disabled={!value.trim() || busy} onClick={handleCreate}>
            {busy ? 'Saving…' : 'Create rule'}
          </Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Step 1: Trigger type ─────────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            1 · When
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TRIGGERS.map(t => (
              <button key={t.id} onClick={() => { setTrigger(t.id); setValue(''); }} disabled={busy}
                style={{
                  border: `2px solid ${trigger === t.id ? '#0D7377' : '#E5E8EF'}`,
                  borderRadius: 12, background: trigger === t.id ? '#F3FBFA' : '#FAFBFD',
                  padding: '10px 8px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                  transition: 'all 140ms',
                }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: trigger === t.id ? '#0D7377' : '#0E1420' }}>{t.label}</div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 6 }}>
            {TRIGGERS.find(t => t.id === trigger)?.hint}
          </div>
        </div>

        {/* ── Step 2: Value input ──────────────────────────────── */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            2 · {valLabel}
          </label>
          <input
            autoFocus
            type={trigger === 'keyword' ? 'text' : 'number'}
            min={1} max={trigger === 'rating' ? 5 : 50}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={valPlaceholder}
            disabled={busy}
            style={{ ...inputStyle, fontSize: 14, height: 44, borderRadius: 12 }}
          />
        </div>

        {/* ── Step 3: Action ───────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9099AD', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            3 · Then
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ACTIONS.map(a => {
              const tones = { teal: { bg: '#F3FBFA', border: '#0D7377', dot: '#0D7377' }, amber: { bg: '#FFF9EE', border: '#B26A00', dot: '#B26A00' }, red: { bg: '#FFF5F5', border: '#C8324A', dot: '#C8324A' } };
              const tc = tones[a.tone];
              const active = action === a.id;
              return (
                <button key={a.id} onClick={() => setAction(a.id)} disabled={busy}
                  style={{
                    border: `2px solid ${active ? tc.border : '#E5E8EF'}`,
                    borderRadius: 12, background: active ? tc.bg : '#FAFBFD',
                    padding: '10px 14px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 12, transition: 'all 140ms',
                  }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 99, border: `2px solid ${active ? tc.dot : '#CBD0DB'}`,
                    background: active ? tc.dot : 'transparent', flexShrink: 0, transition: 'all 140ms',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: active ? tc.border : '#0E1420' }}>{a.label}</div>
                    <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 1 }}>{a.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Preview ──────────────────────────────────────────── */}
        <div style={{
          padding: '12px 16px', background: 'linear-gradient(135deg, #F3FBFA, #E8F8F5)',
          borderRadius: 12, border: '1px solid #B7E8E9', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Icon name="shield" size={16} stroke="#0D7377" />
          <div style={{ fontSize: 13, color: '#0E1420', lineHeight: 1.4 }}>
            <span style={{ color: '#6B7488' }}>Rule: </span>
            When <strong>{previewWhen}</strong>
            <span style={{ color: '#6B7488' }}> → </span>
            <strong style={{ color: selectedAction ? { teal: '#0D7377', amber: '#B26A00', red: '#C8324A' }[selectedAction.tone] : '#0D7377' }}>
              {selectedAction?.label || '—'}
            </strong>
          </div>
        </div>

      </div>
    </Modal>
  );
}

function ActiveRulesSection({ rules, admin, onDeleted }) {
  const [deletingId, setDeletingId] = useState(null);
  if (!rules || rules.length === 0) return null;

  const TRIGGER_META = {
    keyword: { icon: '💬', label: 'Keyword',  format: (v) => `Message contains "${v}"` },
    rating:  { icon: '⭐', label: 'Rating',   format: (v) => `Rating drops below ${v} ★` },
    reports: { icon: '🚩', label: 'Reports',  format: (v) => `${v} reports in 24 h` },
  };
  const ACTION_META = {
    flag:    { label: 'Flag for review',    tone: 'teal'  },
    hide:    { label: 'Hide listing',       tone: 'amber' },
    suspend: { label: 'Auto-suspend 7d',    tone: 'red'   },
  };

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await deleteAutoRule(id, { actor: admin });
      showToast('Rule disabled', { tone: 'info' });
      onDeleted?.();
    } catch (e) {
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally { setDeletingId(null); }
  }

  return (
    <div style={{ marginTop: 28 }}>
      <SectionHeader
        title="Active auto-rules"
        sub={`${rules.length} rule${rules.length !== 1 ? 's' : ''} running — checked on every new report and message`}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rules.map((r, i) => {
          const tm = TRIGGER_META[r.trigger] || TRIGGER_META.keyword;
          const am = ACTION_META[r.action]   || ACTION_META.flag;
          const actionColors = { teal: '#0D7377', amber: '#B26A00', red: '#C8324A' };
          const actionBgs    = { teal: '#F3FBFA', amber: '#FFF9EE', red: '#FFF5F5' };
          return (
            <Card key={r.id} padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                {/* Rule number + trigger icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: '#F1F3F8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {tm.icon}
                </div>

                {/* Condition */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1420', marginBottom: 2 }}>
                    {tm.format(r.value)}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#9099AD', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Pill tone="gray" size="sm">{tm.label}</Pill>
                    <span>· Rule #{i + 1}</span>
                  </div>
                </div>

                {/* Arrow */}
                <Icon name="arrowR" size={14} stroke="#CBD0DB" />

                {/* Action */}
                <div style={{
                  padding: '6px 14px', borderRadius: 99,
                  background: actionBgs[am.tone], color: actionColors[am.tone],
                  fontSize: 12.5, fontWeight: 700, flexShrink: 0,
                }}>
                  {am.label}
                </div>

                {/* Disable button */}
                <Btn
                  variant="ghost" size="sm"
                  disabled={deletingId === r.id}
                  onClick={() => handleDelete(r.id)}
                  style={{ flexShrink: 0 }}
                >
                  {deletingId === r.id ? 'Removing…' : 'Disable'}
                </Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { width: '100%', height: 40, padding: '0 12px', border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 13.5, fontFamily: 'inherit', background: '#FAFBFD', color: '#0E1420', outline: 'none' };
const selectStyle = { ...inputStyle, appearance: 'auto' };

function priorityTone(p) {
  return p === 'critical' ? 'red' : p === 'high' ? 'amber' : p === 'medium' ? 'violet' : 'gray';
}

// ─── Evidence Modal ────────────────────────────────────────────────────────────
function EvidenceModal({ open, onClose, r }) {
  if (!r) return null;
  const evidenceType = (r.evidence || '').toLowerCase();
  const isChat    = evidenceType.includes('chat') || evidenceType.includes('message');
  const isBooking = evidenceType.includes('booking');
  const isProfile = evidenceType.includes('profile') || evidenceType.includes('selfie') || evidenceType.includes('id');
  const isReview  = evidenceType.includes('review');
  return (
    <Modal open={open} onClose={onClose} title="Evidence viewer" sub={`${r.id} · ${r.evidence}`} width={580}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: 14, background: '#FAFBFD', borderRadius: 12, border: '1px solid #F1F3F8' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Report summary</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0E1420', marginBottom: 4 }}>{r.reason}</div>
          <div style={{ fontSize: 13, color: '#4A5568', lineHeight: 1.55 }}>{r.notes}</div>
        </div>

        {isChat && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Chat extract · {r.count > 1 ? `${r.count} reports reference this thread` : '1 report'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, background: '#F8F9FC', borderRadius: 12 }}>
              <Msg from={r.reporter} side="left"  text="Hi, are you available tomorrow evening from 7 pm?" time="Yesterday 18:14" />
              <Msg from={r.target}   side="right" text="Yes, but my rate goes up to 400/hr after 8 pm and I take cash only — don't tell the platform." time="Yesterday 18:22" flagged />
              <Msg from={r.reporter} side="left"  text="That's not what your profile says. I'd rather book through the app." time="Yesterday 18:24" />
            </div>
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#FFE0E4', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="flag" size={13} stroke="#C8324A" />
              <span style={{ fontSize: 12, color: '#C8324A', fontWeight: 600 }}>1 message auto-flagged · off-platform payment solicitation detected</span>
            </div>
          </div>
        )}

        {isBooking && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Booking history · {r.target}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#FAFBFD' }}>
                  {['Booking', 'Date', 'Status', 'Cancelled by'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#6B7488', fontSize: 11, borderBottom: '1px solid #F1F3F8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { id: '#003121', date: '28 Apr 2026', status: 'cancelled', by: r.target },
                  { id: '#002988', date: '21 Apr 2026', status: 'cancelled', by: r.target },
                  { id: '#002711', date: '10 Apr 2026', status: 'completed', by: '—' },
                  { id: '#002504', date: '01 Apr 2026', status: 'cancelled', by: r.target },
                  { id: '#002219', date: '18 Mar 2026', status: 'completed', by: '—' },
                ].map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #F8F9FC' }}>
                    <td style={{ padding: '9px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{b.id}</td>
                    <td style={{ padding: '9px 10px', color: '#4A5568' }}>{b.date}</td>
                    <td style={{ padding: '9px 10px' }}>
                      <Pill tone={b.status === 'cancelled' ? 'coral' : 'green'} size="sm" dot>{b.status}</Pill>
                    </td>
                    <td style={{ padding: '9px 10px', color: b.by !== '—' ? '#C8324A' : '#9099AD', fontWeight: b.by !== '—' ? 700 : 400 }}>{b.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8, padding: '8px 12px', background: '#FFE0E4', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icon name="alert" size={13} stroke="#C8324A" />
              <span style={{ fontSize: 12, color: '#C8324A', fontWeight: 600 }}>3 cancellations in 30 days — threshold exceeded (policy: max 2)</span>
            </div>
          </div>
        )}

        {isProfile && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Identity verification comparison
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'National ID', icon: 'fileLog', color: '#0D7377', bg: '#E8F8F5', note: 'Submitted by sitter' },
                { label: 'Profile selfie', icon: 'users', color: evidenceType.includes('mismatch') ? '#C8324A' : '#0D7377', bg: evidenceType.includes('mismatch') ? '#FFE0E4' : '#E8F8F5', note: evidenceType.includes('mismatch') ? 'ML similarity: 34% — below 70% threshold' : 'Submitted by sitter' },
              ].map(item => (
                <div key={item.label} style={{ padding: 16, background: item.bg, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    <Icon name={item.icon} size={22} stroke={item.color} />
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420' }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7488' }}>{item.note}</div>
                </div>
              ))}
            </div>
            {evidenceType.includes('mismatch') && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#FFE0E4', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="alert" size={13} stroke="#C8324A" />
                <span style={{ fontSize: 12, color: '#C8324A', fontWeight: 600 }}>Face similarity score 34% — auto-flagged by verification ML model</span>
              </div>
            )}
          </div>
        )}

        {isReview && (
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Flagged review · {r.evidence}
            </div>
            <div style={{ padding: 16, background: '#FFF8FA', borderRadius: 12, border: '1px solid #FFE4EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Avatar name={r.reporter} size={32} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.reporter}</div>
                  <div style={{ fontSize: 11, color: '#9099AD' }}>Reported by: {r.target}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={i} name="star" size={13} fill={i < 1 ? '#FFB02E' : '#EDEFF4'} stroke={i < 1 ? '#FFB02E' : '#EDEFF4'} />
                  ))}
                </div>
              </div>
              <blockquote style={{ margin: 0, padding: '10px 14px', background: '#fff', borderRadius: 10, borderLeft: '3px solid #FF6B8A', fontSize: 13, color: '#2E3748', lineHeight: 1.55, fontStyle: 'italic' }}>
                "This person was rude and unprofessional throughout our interaction. I would not recommend to anyone and hope no family hires them."
              </blockquote>
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#FFE0E4', borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Icon name="flag" size={13} stroke="#C8324A" />
                <span style={{ fontSize: 12, color: '#C8324A', fontWeight: 600 }}>Review flagged: personal attack unrelated to service quality</span>
              </div>
            </div>
          </div>
        )}

        {!isChat && !isBooking && !isProfile && !isReview && (
          <div style={{ padding: 24, textAlign: 'center', color: '#6B7488', fontSize: 13 }}>
            <Icon name="fileLog" size={32} stroke="#B8BECE" style={{ display: 'block', margin: '0 auto 10px' }} />
            Evidence on file: <strong style={{ color: '#0E1420' }}>{r.evidence}</strong><br />
            <span style={{ fontSize: 12, marginTop: 6, display: 'block' }}>Attachments are stored in the case file. Contact the platform team to retrieve raw files.</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn variant="primary" icon="download" onClick={() => showToast('Evidence package downloading…', { tone: 'info' })}>Export evidence</Btn>
        </div>
      </div>
    </Modal>
  );
}

export function ReportDetail({ r, onDecide, decision, busy, adminNote, onNoteChange, goto, allReports }) {
  const isLate = r.opened && (r.opened.includes('day') || r.opened.includes('week'));
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card padding={22}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <Pill tone={priorityTone(r.priority)} dot>{r.priority} priority</Pill>
          <Pill tone="gray">{r.id}</Pill>
          {isLate && (
            <Pill tone="amber" icon="clock">Late report · {r.opened}</Pill>
          )}
          <span style={{ flex: 1 }} />
          {!isLate && <span style={{ fontSize: 11.5, color: '#9099AD' }}>Opened {r.opened}</span>}
        </div>
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.02em' }}>{r.reason}</h2>
        <div style={{ fontSize: 13.5, color: '#4A5568', lineHeight: 1.55 }}>{r.notes}</div>

        {/* Reporter / target */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18 }}>
          <PartyCard role="Reporter" name={r.reporter} sub={r.reporterRole} onViewProfile={r.reporterId && goto ? () => goto('user-detail', { userId: r.reporterId }) : null} />
          <PartyCard role="Reported" name={r.target} sub={r.targetRole} flag onViewProfile={r.targetId && goto ? () => goto('user-detail', { userId: r.targetId }) : null} />
        </div>

        {/* Evidence */}
        <div style={{ marginTop: 16, padding: 14, background: '#FAFBFD', borderRadius: 12, border: '1px solid #F1F3F8' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Evidence</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="fileLog" size={16} stroke="#0D7377" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0D7377' }}>{r.evidence}</span>
            <span style={{ flex: 1 }} />
            <Btn size="sm" variant="ghost" icon="external" onClick={() => setEvidenceOpen(true)}>Open</Btn>
          </div>
        </div>
      </Card>

      {/* Conversation extract */}
      <Card padding={22}>
        <SectionHeader title="Conversation extract" sub="Latest 3 messages between reporter and reported user" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Msg from={r.reporter} side="left"  text="Hi, are you available tomorrow evening from 7 pm?" time="Yesterday 18:14" />
          <Msg from={r.target}   side="right" text="Yes, but my rate goes up to 400/hr after 8 pm and I take cash only — don't tell the platform." time="Yesterday 18:22" flagged />
          <Msg from={r.reporter} side="left"  text="That's not what your profile says. I'd rather book through the app." time="Yesterday 18:24" />
        </div>
      </Card>

      {/* History */}
      {allReports && (() => {
        const history = allReports
          .filter(h => h.id !== r.id && (h.reporter === r.reporter || h.target === r.target))
          .slice(0, 5);
        return (
          <Card padding={22}>
            <SectionHeader title="History" sub="Previous reports involving the reporter or the reported user" />
            {history.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9099AD' }}>No previous reports involving these users.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {history.map((h, i) => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < history.length - 1 ? '1px solid #F1F3F8' : 'none' }}>
                    <Pill tone={priorityTone(h.priority)} size="sm" dot>{h.priority}</Pill>
                    <span style={{ flex: 1, fontSize: 13, color: '#0E1420', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.reason}</span>
                    <span style={{ fontSize: 11.5, color: '#9099AD', flexShrink: 0 }}>{h.opened}</span>
                    <Pill tone={h.status === 'open' ? 'amber' : h.status === 'investigating' ? 'violet' : 'gray'} size="sm">{h.status}</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}

      {/* Admin note */}
      {!decision && (
        <Card padding={18}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
            Admin note (saved with decision)
          </label>
          <textarea
            value={adminNote}
            onChange={e => onNoteChange?.(e.target.value)}
            placeholder="Add context, justification, or instructions for the affected user…"
            style={{ width: '100%', minHeight: 72, padding: 12, border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none', resize: 'vertical', lineHeight: 1.5 }}
          />
        </Card>
      )}

      {/* Decision */}
      <Card padding={22} style={{
        background: decision ? '#F3FBFA' : 'linear-gradient(165deg, #FFF8FA 0%, #FFFFFF 60%)',
        border: decision ? '1px solid #B7E8E9' : '1px solid #FFE4EB'
      }}>
        <SectionHeader
          title={decision ? '✓ Decision saved' : 'Decide on this report'}
          sub={decision
            ? 'Action logged in the audit trail. The user has been notified.'
            : 'Pick the lightest action that resolves the issue. Bans require a second admin review.'}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant={decision === 'dismissed' ? 'soft' : 'ghost'}      icon="x"     disabled={busy || !!decision} onClick={() => onDecide('dismissed')}>Dismiss</Btn>
          <Btn variant={decision === 'warned'    ? 'soft' : 'secondary'}  icon="alert" disabled={busy || !!decision} onClick={() => onDecide('warned')}>Send warning</Btn>
          <Btn variant={decision === 'removed'   ? 'soft' : 'secondary'}  icon="trash" disabled={busy || !!decision} onClick={() => onDecide('removed')}>Remove content</Btn>
          <Btn variant={decision === 'suspended' ? 'soft' : 'danger'}     icon="pause" disabled={busy || !!decision} onClick={() => onDecide('suspended')}>Suspend 7 days</Btn>
          <Btn variant={decision === 'banned'    ? 'soft' : 'dangerSolid'} icon="ban"  disabled={busy || !!decision} onClick={() => onDecide('banned')}>Ban account</Btn>
        </div>
      </Card>

      <EvidenceModal open={evidenceOpen} onClose={() => setEvidenceOpen(false)} r={r} />
    </div>
  );
}

export function PartyCard({ role, name, sub, flag, onViewProfile }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12, border: `1px solid ${flag ? '#FFE4EB' : '#F1F3F8'}`,
      background: flag ? 'linear-gradient(165deg, #FFF8FA 0%, #fff 80%)' : '#FAFBFD',
      display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <Avatar name={name} size={42} ring={flag ? '#FFB8C8' : null} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: flag ? '#C8324A' : '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{role}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: '#6B7488' }}>{sub}</div>
      </div>
      {onViewProfile && (
        <button onClick={onViewProfile} title="View full profile"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0D7377', padding: 4 }}>
          <Icon name="eye" size={15} />
        </button>
      )}
    </div>
  );
}

export function Msg({ from, side, text, time, flagged }) {
  return (
    <div style={{ display: 'flex', justifyContent: side === 'right' ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%' }}>
        <div style={{ fontSize: 10.5, color: '#9099AD', marginBottom: 4, textAlign: side === 'right' ? 'right' : 'left' }}>{from} · {time}</div>
        <div style={{
          padding: '10px 14px', borderRadius: side === 'right' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: side === 'right' ? (flagged ? '#FFE0E4' : '#E8F8F5') : '#F1F3F8',
          color: side === 'right' && flagged ? '#C8324A' : '#0E1420',
          fontSize: 13, lineHeight: 1.45,
          border: flagged ? '1px solid #FFB8C8' : 'none',
        }}>
          {text}
          {flagged && <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 6, color: '#C8324A', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="flag" size={11} /> Flagged by auto-moderation</div>}
        </div>
      </div>
    </div>
  );
}


