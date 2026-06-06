import React, { useState, useMemo } from 'react';
import { Icon } from '../icons.jsx';
import { useDeletedAccounts } from '../hooks.js';
import { Card, Btn, Pill, SearchField, PageHeader, Modal, showToast } from '../components.jsx';
import { unblockDeletedAccount, downloadCSV } from '../admin-actions.js';

export function DeletedAccountsPage({ admin, search = '' }) {
  const { data: DELETED, refetch } = useDeletedAccounts();
  const [filter, setFilter] = useState('all');
  const [localQuery, setLocalQuery] = useState('');
  const [unblockFor, setUnblockFor] = useState(null);
  const [busy, setBusy] = useState(false);

  const query = (search || localQuery).trim().toLowerCase();

  const filtered = useMemo(() => DELETED.filter(d => {
    if (filter !== 'all' && d.windowStatus !== filter) return false;
    if (query && !`${d.email} ${d.phone}`.toLowerCase().includes(query)) return false;
    return true;
  }), [DELETED, filter, query]);

  const counts = {
    all:         DELETED.length,
    active:      DELETED.filter(d => d.windowStatus === 'active').length,
    blocked:     DELETED.filter(d => d.windowStatus === 'blocked').length,
    expired:     DELETED.filter(d => d.windowStatus === 'expired').length,
    reactivated: DELETED.filter(d => d.windowStatus === 'reactivated').length,
  };

  async function doUnblock(id, note) {
    setBusy(true);
    try {
      await unblockDeletedAccount(id, { note, actor: admin });
      showToast('Credential block lifted', { tone: 'success' });
      setUnblockFor(null);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Account management"
        title="Deleted accounts"
        sub="Accounts in the 72-hour reactivation window or the 4-month credential block period."
        actions={[
          <Btn key="export" variant="ghost" icon="download" onClick={() => {
            downloadCSV(filtered.map(d => ({
              email: d.email, phone: d.phone, deleted_at: d.deletedAt,
              reactivation_deadline: d.reactivationDeadline,
              credential_block_until: d.credentialBlockUntil,
              was_reactivated: d.wasReactivated, status: d.windowStatus,
            })), `kido-deleted-${new Date().toISOString().slice(0, 10)}.csv`);
            showToast(`Exported ${filtered.length} records`, { tone: 'success' });
          }}>Export CSV</Btn>,
        ]}
      />

      {/* Legend */}
      <Card padding={14} style={{ marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <LegendItem color="#34C759" label="Active (72h reactivation window open)" />
        <LegendItem color="#FF9500" label="Blocked (4-month credential block)" />
        <LegendItem color="#8E8E93" label="Expired (block period over)" />
        <LegendItem color="#0D7377" label="Reactivated (user came back)" />
      </Card>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { id: 'all',         label: `All (${counts.all})` },
          { id: 'active',      label: `Active window (${counts.active})` },
          { id: 'blocked',     label: `Credential block (${counts.blocked})` },
          { id: 'expired',     label: `Block expired (${counts.expired})` },
          { id: 'reactivated', label: `Reactivated (${counts.reactivated})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: filter === f.id ? '#0D7377' : '#fff',
            color: filter === f.id ? '#fff' : '#4A5568',
            fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
            boxShadow: filter === f.id ? 'none' : 'inset 0 0 0 1px #DDE1EA',
          }}>{f.label}</button>
        ))}
        <span style={{ flex: 1 }} />
        <SearchField placeholder="Search email or phone…" width={260} value={localQuery} onChange={setLocalQuery} />
      </div>

      {/* Table */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 16 }} />
            <col /><col style={{ width: 120 }} /><col style={{ width: 130 }} />
            <col style={{ width: 130 }} /><col style={{ width: 130 }} />
            <col style={{ width: 110 }} /><col style={{ width: 64 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#FAFBFD' }}>
              <th style={TH}></th>
              <th style={TH}>Email / Phone</th>
              <th style={TH}>Deleted at</th>
              <th style={TH}>Reactivation deadline</th>
              <th style={TH}>Block until</th>
              <th style={TH}>Note</th>
              <th style={TH}>Status</th>
              <th style={TH}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9099AD', fontSize: 13 }}>No deleted accounts match your filters.</td></tr>
            )}
            {filtered.map((d, i) => {
              const statusColors = { active: '#34C759', blocked: '#FF9500', expired: '#8E8E93', reactivated: '#0D7377' };
              const statusLabels = { active: 'Window open', blocked: 'Blocked', expired: 'Expired', reactivated: 'Reactivated' };
              const statusTones = { active: 'green', blocked: 'amber', expired: 'gray', reactivated: 'teal' };
              return (
                <tr key={d.id} style={{ background: i % 2 ? '#FCFCFE' : '#fff' }}>
                  <td style={{ ...TD, paddingLeft: 16 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: statusColors[d.windowStatus] || '#ccc' }} />
                  </td>
                  <td style={TD}>
                    <div style={{ fontWeight: 700 }}>{d.email}</div>
                    <div style={{ fontSize: 11.5, color: '#9099AD' }}>{d.phone}</div>
                  </td>
                  <td style={{ ...TD, fontSize: 12, color: '#6B7488' }}>{d.deletedAt}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{d.reactivationDeadline}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{d.credentialBlockUntil}</td>
                  <td style={{ ...TD, fontSize: 12, color: '#9099AD', maxWidth: 160 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.adminNote || '—'}
                    </span>
                  </td>
                  <td style={TD}>
                    <Pill tone={statusTones[d.windowStatus] || 'gray'} dot size="sm">
                      {statusLabels[d.windowStatus] || d.windowStatus}
                    </Pill>
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    {d.windowStatus === 'blocked' && (
                      <Btn variant="secondary" size="sm" onClick={() => setUnblockFor(d)}>Unblock</Btn>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F3F8', fontSize: 12, color: '#6B7488', display: 'flex', alignItems: 'center' }}>
          Showing <strong style={{ color: '#0E1420', margin: '0 4px' }}>{filtered.length}</strong> of {DELETED.length} records
        </div>
      </Card>

      <UnblockModal record={unblockFor} onClose={() => setUnblockFor(null)} onConfirm={(note) => doUnblock(unblockFor.id, note)} busy={busy} />
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#4A5568' }}>
      <div style={{ width: 10, height: 10, borderRadius: 99, background: color, flexShrink: 0 }} />
      {label}
    </div>
  );
}

function UnblockModal({ record, onClose, onConfirm, busy }) {
  const [note, setNote] = useState('');
  if (!record) return null;
  return (
    <Modal open={!!record} onClose={onClose} title="Remove credential block"
      sub={`${record.email} — block was set until ${record.credentialBlockUntil}`}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={busy} onClick={() => onConfirm(note)}>Confirm unblock</Btn>
      </>}>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#4A5568', lineHeight: 1.6 }}>
        This will allow this email / phone to sign up again immediately, bypassing the remaining 4-month block period. The action will be logged.
      </p>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Admin note (optional)
      </label>
      <textarea value={note} onChange={e => setNote(e.target.value)}
        placeholder="Reason for early unblock..."
        style={{ width: '100%', minHeight: 80, padding: 12, border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none', resize: 'vertical' }} />
    </Modal>
  );
}

const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #F1F3F8' };
const TD = { padding: '11px 14px', fontSize: 13, color: '#0E1420', borderBottom: '1px solid #F8F9FC' };
