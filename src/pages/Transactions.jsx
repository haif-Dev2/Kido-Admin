import React, { useState, useMemo } from 'react';
import { Icon } from '../icons.jsx';
import { useTransactions, useSitterEarnings } from '../hooks.js';
import { Card, Btn, Pill, SearchField, PageHeader, Tabs, Chip, Modal, SectionHeader, showToast } from '../components.jsx';
import { markTransferCompleted, downloadCSV, writeAuditLog } from '../admin-actions.js';

export function TransactionsPage({ admin, search = '', onActionDone }) {
  const { data: TXN, refetch } = useTransactions();
  const [tab, setTab] = useState('all');
  const [method, setMethod] = useState('all');
  const [localQuery, setLocalQuery] = useState('');
  const [flagOnly, setFlagOnly] = useState(false);
  const [actionFor, setActionFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const query = (search || localQuery).trim().toLowerCase();

  const filtered = useMemo(() => TXN.filter(t => {
    if (tab !== 'all' && t.status !== tab) return false;
    if (method !== 'all' && t.method !== method) return false;
    if (flagOnly && !t.isCcpPending24h) return false;
    if (query) {
      const hay = `${t.id} ${t.bookingId} ${t.parentName} ${t.sitterName}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }), [TXN, tab, method, flagOnly, query]);

  // Stats
  const completed  = TXN.filter(t => t.status === 'completed');
  const pending    = TXN.filter(t => t.status === 'pending');
  const failed     = TXN.filter(t => t.status === 'failed');
  const ccpPending = TXN.filter(t => t.isCcpPending24h);
  const totalRevenue = completed.reduce((s, t) => s + Number(t.amount), 0);

  async function doMarkTransferred(txn) {
    setBusy(true);
    try {
      await markTransferCompleted(txn.rawId, { actor: admin });
      showToast(`${txn.id} marked as transferred`, { tone: 'success' });
      setActionFor(null);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Payments"
        title="Transaction monitoring"
        sub="Track all payment activity across the platform."
        actions={[
          <Btn key="export" variant="ghost" icon="download" onClick={() => {
            downloadCSV(filtered.map(t => ({
              id: t.id, booking: t.bookingId, parent: t.parentName, sitter: t.sitterName,
              amount_dzd: t.amount, method: t.method, status: t.status,
              when: t.when, transferred: t.transferredAt || '—', chargily: t.chargilyId || '—',
            })), `kido-transactions-${new Date().toISOString().slice(0, 10)}.csv`);
            showToast(`Exported ${filtered.length} transactions`, { tone: 'success' });
          }}>Export CSV</Btn>,
        ]}
      />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total revenue" value={`${totalRevenue.toLocaleString()} DZD`} tone="teal" icon="trendUp" />
        <StatCard label="Completed" value={completed.length} tone="green" icon="check" />
        <StatCard label="Pending" value={pending.length} tone="amber" icon="clock" />
        <StatCard label="Failed / refunded" value={failed.length + TXN.filter(t => t.status === 'refunded').length} tone="coral" icon="alert" />
        <StatCard label="CCP pending 24h+" value={ccpPending.length} tone={ccpPending.length > 0 ? 'red' : 'gray'} icon="flag" onClick={() => { setFlagOnly(true); setTab('all'); }} />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <Tabs items={[
          { id: 'all',       label: 'All',       count: TXN.length },
          { id: 'pending',   label: 'Pending',   count: pending.length },
          { id: 'completed', label: 'Completed', count: completed.length },
          { id: 'failed',    label: 'Failed',    count: failed.length },
          { id: 'refunded',  label: 'Refunded',  count: TXN.filter(t => t.status === 'refunded').length },
        ]} active={tab} onChange={v => { setTab(v); setFlagOnly(false); }} />
        <span style={{ width: 1, height: 24, background: '#EDEFF4' }} />
        {['all', 'cash', 'edahabia', 'cib', 'ccp'].map(m => (
          <Chip key={m} active={method === m} onClick={() => setMethod(m)}
            tone={m === 'all' ? null : m === 'ccp' ? 'amber' : m === 'cash' ? null : 'teal'}>
            {m === 'all' ? 'All methods' : m.toUpperCase()}
          </Chip>
        ))}
        {ccpPending.length > 0 && (
          <Chip active={flagOnly} onClick={() => setFlagOnly(f => !f)} tone="coral">
            CCP 24h+ only
          </Chip>
        )}
        <span style={{ flex: 1 }} />
        <SearchField placeholder="Search booking, name…" width={260} value={localQuery} onChange={setLocalQuery} />
      </div>

      {/* Table */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
            <col /><col />
            <col style={{ width: 120 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 50 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#FAFBFD' }}>
              <th style={TH}>ID</th>
              <th style={TH}>Booking</th>
              <th style={TH}>Parent</th>
              <th style={TH}>Sitter</th>
              <th style={{ ...TH, textAlign: 'right' }}>Amount</th>
              <th style={TH}>Method</th>
              <th style={TH}>Status</th>
              <th style={TH}>Date</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#9099AD', fontSize: 13 }}>No transactions match your filters.</td></tr>
            )}
            {filtered.map((t, i) => (
              <TxnRow key={t.id} t={t} alt={i % 2 === 1} onAction={() => setActionFor(t)} />
            ))}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F3F8', fontSize: 12, color: '#6B7488', display: 'flex', alignItems: 'center' }}>
          Showing <strong style={{ color: '#0E1420', margin: '0 4px' }}>{filtered.length}</strong> of {TXN.length} transactions
        </div>
      </Card>

      <ActionModal txn={actionFor} onClose={() => setActionFor(null)} onMarkTransferred={doMarkTransferred} busy={busy} />

      <SitterEarningsSection admin={admin} />
    </div>
  );
}

function TxnRow({ t, alt, onAction }) {
  const [hover, setHover] = useState(false);
  const methodColors = { cash: 'gray', edahabia: 'teal', cib: 'violet', ccp: 'amber' };
  const statusColors = { completed: 'green', pending: 'amber', failed: 'red', refunded: 'gray' };
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: hover ? '#FAFBFD' : (alt ? '#FCFCFE' : '#fff') }}>
      <td style={TD}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>{t.id}</span>
        {t.isCcpPending24h && <Pill tone="red" size="sm" style={{ marginLeft: 4 }}>⚠ 24h+</Pill>}
      </td>
      <td style={{ ...TD, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.bookingId}</td>
      <td style={TD}>{t.parentName}</td>
      <td style={TD}>{t.sitterName}</td>
      <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
        {Number(t.amount).toLocaleString()} <span style={{ fontSize: 10, color: '#9099AD' }}>DZD</span>
      </td>
      <td style={TD}><Pill tone={methodColors[t.method] || 'gray'} size="sm">{t.method?.toUpperCase()}</Pill></td>
      <td style={TD}><Pill tone={statusColors[t.status] || 'gray'} dot size="sm">{t.status}</Pill></td>
      <td style={{ ...TD, fontSize: 12, color: '#6B7488' }}>{t.when}</td>
      <td style={{ ...TD, textAlign: 'right' }}>
        {(t.status === 'pending') && (
          <Btn variant="ghost" size="sm" onClick={onAction}>…</Btn>
        )}
      </td>
    </tr>
  );
}

function ActionModal({ txn, onClose, onMarkTransferred, busy }) {
  if (!txn) return null;
  return (
    <Modal open={!!txn} onClose={onClose} title={`Transaction ${txn.id}`}
      sub={`${txn.bookingId} · ${Number(txn.amount).toLocaleString()} DZD · ${txn.method?.toUpperCase()}`}
      width={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {txn.method === 'cash' && (
          <Btn variant="successSolid" icon="check" full disabled={busy} onClick={() => onMarkTransferred(txn)}>
            Mark as transferred (cash confirmed)
          </Btn>
        )}
        {txn.isCcpPending24h && (
          <div style={{ padding: 12, background: '#FFF4DC', borderRadius: 10, fontSize: 12.5, color: '#B26A00' }}>
            This CCP payment has been pending for over 24 hours. Contact the payer or mark as failed if payment did not arrive.
          </div>
        )}
        {txn.chargilyId && (
          <div style={{ padding: 12, background: '#F8F9FC', borderRadius: 10, fontSize: 12 }}>
            <span style={{ color: '#6B7488' }}>Chargily ID: </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{txn.chargilyId}</span>
          </div>
        )}
        <Btn variant="ghost" full onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}

function StatCard({ label, value, tone, icon, onClick }) {
  const tones = {
    teal:  { bg: '#E8F8F5', fg: '#0D7377' },
    green: { bg: '#DCF5E4', fg: '#1F8A4E' },
    amber: { bg: '#FFF4DC', fg: '#B26A00' },
    coral: { bg: '#FFE4EB', fg: '#C8324A' },
    red:   { bg: '#FFE0E4', fg: '#C8324A' },
    gray:  { bg: '#EDEFF4', fg: '#4A5568' },
  };
  const t = tones[tone] || tones.gray;
  return (
    <Card padding={16} hoverable={!!onClick} onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} stroke={t.fg} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: '#0E1420' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#6B7488' }}>{label}</div>
    </Card>
  );
}

function SitterEarningsSection({ admin }) {
  const { data: earnings } = useSitterEarnings();
  const [busy, setBusy] = useState(null);

  async function flagForReview(sitter) {
    try {
      setBusy(sitter.id);
      await writeAuditLog({
        actor: admin,
        action: 'opened',
        entityType: 'Profile',
        entityId: String(sitter.id).slice(0, 8),
        detail: `Flagged for review from sitter earnings table. Total earned: ${sitter.totalEarned} DZD.`,
      });
      showToast(`${sitter.name} flagged for review`, { tone: 'info' });
    } catch (e) {
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally { setBusy(null); }
  }

  const methodColors = { cash: 'gray', edahabia: 'teal', cib: 'violet', ccp: 'amber' };

  return (
    <div style={{ marginTop: 32 }}>
      <SectionHeader title="Sitter earnings breakdown" sub="Aggregate earnings per sitter from completed and pending transactions" />
      <Card padding={0} style={{ overflow: 'hidden', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col /><col style={{ width: 140 }} /><col style={{ width: 110 }} />
            <col style={{ width: 110 }} /><col style={{ width: 110 }} /><col style={{ width: 130 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#FAFBFD' }}>
              <th style={TH}>Sitter</th>
              <th style={{ ...TH, textAlign: 'right' }}>Total earned</th>
              <th style={{ ...TH, textAlign: 'right' }}>Pending</th>
              <th style={{ ...TH, textAlign: 'right' }}>Completed</th>
              <th style={TH}>Top method</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {earnings.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#9099AD', fontSize: 13 }}>No earnings data available.</td></tr>
            )}
            {earnings.map((e, i) => {
              const topMethod = Object.entries(e.methods || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
              return (
                <tr key={e.id} style={{ background: i % 2 === 1 ? '#FCFCFE' : '#fff' }}>
                  <td style={TD}><span style={{ fontWeight: 600 }}>{e.name}</span></td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                    {Number(e.totalEarned).toLocaleString()} <span style={{ fontSize: 10, color: '#9099AD' }}>DZD</span>
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: e.pending > 0 ? '#B26A00' : '#9099AD' }}>
                    {Number(e.pending).toLocaleString()}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: '#1F8A4E' }}>
                    {Number(e.completed).toLocaleString()}
                  </td>
                  <td style={TD}>
                    <Pill tone={methodColors[topMethod] || 'gray'} size="sm">{topMethod.toUpperCase()}</Pill>
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <Btn variant="ghost" size="sm" disabled={busy === e.id} onClick={() => flagForReview(e)}>
                      Flag for review
                    </Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #F1F3F8' };
const TD = { padding: '11px 14px', fontSize: 13, color: '#0E1420', borderBottom: '1px solid #F8F9FC' };
