import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icons.jsx';
import { useUsers } from '../hooks.js';
import { Card, Btn, IconBtn, Pill, Avatar, SearchField, PageHeader, Tabs, Chip, Modal, NotifyUserModal, showToast } from '../components.jsx';
import { inviteAdmin, downloadCSV, writeAuditLog, sendNotification } from '../admin-actions.js';

// Users — Parents + Babysitters table

export function UsersPage({ admin, search = '', goto }) {
  const { data: USERS } = useUsers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState(null); // user object for row menu
  const [notifyFor, setNotifyFor] = useState(null);   // user object for notification modal
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [localQuery, setLocalQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  // Effective query = global topbar search OR local in-page search.
  const query = (search || localQuery).trim().toLowerCase();

  const filtered = USERS.filter(u => {
    if (role !== 'all' && u.role !== role) return false;
    if (status !== 'all' && u.status !== status) return false;
    if (query && !u.name.toLowerCase().includes(query) && !u.id.toLowerCase().includes(query) && !u.city.toLowerCase().includes(query)) return false;
    return true;
  });

  const counts = {
    all:    USERS.length,
    parent: USERS.filter(u => u.role === 'parent').length,
    sitter: USERS.filter(u => u.role === 'sitter').length,
  };

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(u => u.id)));
  }

  const someSelected = selected.size > 0;

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Account management"
        title="Users"
        sub={`${counts.all} accounts · ${counts.parent} parents · ${counts.sitter} babysitters`}
        actions={[
          <Btn key="export" variant="ghost" icon="download" onClick={() => {
            downloadCSV(filtered.map(u => ({
              id: u.id, name: u.name, role: u.role, city: u.city, joined: u.joined,
              bookings: u.bookings, rating: u.rating, status: u.status, verified: u.verified,
            })), `kido-users-${new Date().toISOString().slice(0, 10)}.csv`);
            showToast(`Exported ${filtered.length} users`, { tone: 'success' });
          }}>Export CSV</Btn>,
          <Btn key="invite" variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>Invite admin</Btn>,
        ]}
      />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <Tabs
          items={[
            { id: 'all',    label: 'Everyone',    count: counts.all },
            { id: 'parent', label: 'Parents',     count: counts.parent },
            { id: 'sitter', label: 'Babysitters', count: counts.sitter },
          ]}
          active={role} onChange={setRole}
        />
        <span style={{ width: 1, height: 24, background: '#EDEFF4' }} />
        <Chip active={status === 'all'}      onClick={() => setStatus('all')}>All status</Chip>
        <Chip active={status === 'active'}    onClick={() => setStatus('active')} tone={status !== 'active' ? 'teal' : null}>Active</Chip>
        <Chip active={status === 'pending'}   onClick={() => setStatus('pending')} tone={status !== 'pending' ? 'amber' : null}>Pending</Chip>
        <Chip active={status === 'warned'}    onClick={() => setStatus('warned')}>Warned</Chip>
        <Chip active={status === 'suspended'} onClick={() => setStatus('suspended')} tone={status !== 'suspended' ? 'coral' : null}>Suspended</Chip>
        <Chip active={status === 'banned'}    onClick={() => setStatus('banned')}>Banned</Chip>
        <span style={{ flex: 1 }} />
        <SearchField placeholder="Search by name or ID…" width={260} value={localQuery} onChange={setLocalQuery} />
      </div>

      {someSelected && (
        <div style={{
          background: '#0E1420', color: '#fff',
          padding: '10px 16px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12,
          boxShadow: '0 8px 24px rgba(14,20,32,0.18)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selected.size} selected</span>
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" size="sm" icon="mail" style={{ color: '#fff', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
            onClick={async () => {
              const recipients = filtered.filter(u => selected.has(u.id));
              await writeAuditLog({ actor: admin, action: 'opened', entityType: 'Profile', entityId: 'bulk',
                detail: `Email broadcast queued for ${recipients.length} users.` });
              showToast(`Email queued for ${recipients.length} users (audit logged)`, { tone: 'info' });
            }}>Email</Btn>
          <Btn variant="ghost" size="sm" icon="alert" style={{ color: '#fff', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)' }}
            onClick={async () => {
              const recipients = filtered.filter(u => selected.has(u.id));
              await writeAuditLog({ actor: admin, action: 'warned', entityType: 'Profile', entityId: 'bulk',
                detail: `${recipients.length} users warned.` });
              showToast(`Warned ${recipients.length} users`, { tone: 'info' });
              setSelected(new Set());
            }}>Warn</Btn>
          <Btn variant="dangerSolid" size="sm" icon="pause"
            onClick={async () => {
              if (!confirm(`Suspend ${selected.size} user${selected.size > 1 ? 's' : ''} for 7 days?`)) return;
              const recipients = filtered.filter(u => selected.has(u.id));
              await writeAuditLog({ actor: admin, action: 'suspended', entityType: 'Profile', entityId: 'bulk',
                detail: `7-day suspension applied to ${recipients.length} users.` });
              showToast(`Suspended ${recipients.length} users (audit logged)`, { tone: 'error' });
              setSelected(new Set());
            }}>Suspend</Btn>
          <button onClick={() => setSelected(new Set())} style={{ background: 'transparent', border: 'none', color: '#9099AD', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Clear</button>
        </div>
      )}

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 38 }} />
            <col />
            <col style={{ width: 90 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 64 }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#FAFBFD' }}>
              <th style={thStyle}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ accentColor: '#0D7377' }} />
              </th>
              <th style={thStyle}>User</th>
              <th style={thStyle}>Role</th>
              <th style={thStyle}>Joined</th>
              <th style={thStyle}>City</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Bookings</th>
              <th style={thStyle}>Rating</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <UserRow key={u.id} u={u} checked={selected.has(u.id)} onCheck={() => toggle(u.id)} alt={i % 2 === 1} onOpenMenu={() => setActionsFor(u)} onViewDetail={() => goto?.('user-detail', { userId: u.rawId || u.id })} />
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F3F8', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#6B7488' }}>
          <span>Showing <strong style={{ color: '#0E1420' }}>{filtered.length}</strong> of {USERS.length}</span>
          <span style={{ flex: 1 }} />
          <Btn variant="ghost" size="sm" icon="arrowL" onClick={() => showToast('You’re on the first page', { tone: 'info' })}>Prev</Btn>
          <span>Page 1 of 1</span>
          <Btn variant="ghost" size="sm" iconRight="arrowR" onClick={() => showToast('No more pages — pagination kicks in once the table exceeds 100 rows', { tone: 'info' })}>Next</Btn>
        </div>
      </Card>

      <InviteAdminModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={async (email) => {
          try {
            const result = await inviteAdmin(email, { actor: admin });
            if (result?.invited) {
              showToast(`Invitation sent — ${email} will have admin access once they sign up via the link`, { tone: 'info' });
            } else {
              showToast(`${email} promoted to admin`, { tone: 'success' });
            }
            setInviteOpen(false);
          } catch (e) {
            showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
          }
        }}
      />

      <UserActionsModal
        user={actionsFor}
        admin={admin}
        onClose={() => setActionsFor(null)}
        onViewDetail={() => goto?.('user-detail', { userId: actionsFor?.rawId || actionsFor?.id })}
        onNotify={() => { setNotifyFor(actionsFor); setActionsFor(null); }}
      />

      <NotifyUserModal
        open={!!notifyFor}
        onClose={() => setNotifyFor(null)}
        userName={notifyFor?.name}
        onSend={async ({ type, title, message }) => {
          try {
            await sendNotification(notifyFor.rawId || notifyFor.id, { title, message, type, actor: admin });
            showToast(`Notification sent to ${notifyFor.name}`, { tone: 'success' });
            setNotifyFor(null);
          } catch (e) {
            showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
          }
        }}
      />
    </div>
  );
}

export function InviteAdminModal({ open, onClose, onInvite }) {
  const [email, setEmail] = useState('');
  useEffect(() => { if (open) setEmail(''); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a new administrator"
      sub="If the account already exists, promotion is immediate. If not, they'll receive a sign-up link and be made admin automatically on first login."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="check" disabled={!email.trim()} onClick={() => onInvite(email)}>Promote to admin</Btn>
        </>
      }
    >
      <label style={{ fontSize: 11.5, fontWeight: 700, color: '#4A5568', display: 'block', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="someone@kido.dz"
        autoFocus
        style={{ width: '100%', height: 42, padding: '0 14px', border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none' }}
      />
      <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 8 }}>
        Admins can verify sitters, resolve reports, and remove reviews. The action is recorded in the audit log.
      </div>
    </Modal>
  );
}

export function UserActionsModal({ user, admin, onClose, onViewDetail, onNotify }) {
  if (!user) return null;
  async function logAction(action, detail) {
    try {
      await writeAuditLog({ actor: admin, action, entityType: 'Profile', entityId: user.id, detail });
      showToast(`${user.name} → ${action}`, { tone: action === 'banned' || action === 'suspended' ? 'error' : 'success' });
    } catch (e) {
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally {
      onClose();
    }
  }
  return (
    <Modal
      open={!!user}
      onClose={onClose}
      title={`Manage ${user.name}`}
      sub={`${user.role === 'sitter' ? 'Babysitter' : 'Parent'} · ${user.city} · joined ${user.joined}`}
      width={420}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Btn variant="secondary" icon="eye" full onClick={() => { onClose(); onViewDetail?.(); }}>View full profile</Btn>
        <Btn variant="primary" icon="msg" full onClick={onNotify}>Send notification</Btn>
        <Btn variant="secondary" icon="alert" full onClick={() => logAction('warned', `Warning issued to ${user.name}.`)}>Issue a warning</Btn>
        <Btn variant="danger" icon="pause" full onClick={() => {
          if (confirm(`Suspend ${user.name} for 7 days?`)) logAction('suspended', `7-day suspension applied.`);
        }}>Suspend (7 days)</Btn>
        <Btn variant="dangerSolid" icon="ban" full onClick={() => {
          if (confirm(`Permanently ban ${user.name}? Requires a second admin per policy.`)) logAction('banned', `Account permanently banned.`);
        }}>Ban account</Btn>
      </div>
    </Modal>
  );
}

const thStyle = {
  padding: '12px 14px',
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 700,
  color: '#9099AD',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #F1F3F8',
};
const tdStyle = { padding: '12px 14px', fontSize: 13, color: '#0E1420', borderBottom: '1px solid #F8F9FC' };

export function UserRow({ u, checked, onCheck, alt, onOpenMenu, onViewDetail }) {
  const [hover, setHover] = useState(false);
  const statusTones = {
    active:    { tone: 'green',  label: 'Active',    dot: true },
    pending:   { tone: 'amber',  label: 'Pending',   dot: true },
    warned:    { tone: 'amber',  label: 'Warned',    dot: false },
    suspended: { tone: 'coral',  label: 'Suspended', dot: false },
    banned:    { tone: 'red',    label: 'Banned',    dot: false },
  };
  const s = statusTones[u.status] || statusTones.active;
  return (
    <tr onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ background: hover ? '#FAFBFD' : (alt ? '#FCFCFE' : '#fff') }}>
      <td style={tdStyle}>
        <input type="checkbox" checked={checked} onChange={onCheck} style={{ accentColor: '#0D7377' }} />
      </td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={onViewDetail} title="View full profile">
          <Avatar name={u.name} initial={u.initial} size={32} verified={u.verified} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#0E1420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
            <div style={{ fontSize: 11, color: '#9099AD', fontFamily: 'var(--font-mono)' }}>{u.id}</div>
          </div>
        </div>
      </td>
      <td style={tdStyle}>
        <Pill tone={u.role === 'sitter' ? 'mint' : 'violet'} size="sm">
          {u.role === 'sitter' ? 'Babysitter' : 'Parent'}
        </Pill>
      </td>
      <td style={{ ...tdStyle, color: '#6B7488', fontSize: 12.5 }}>{u.joined}</td>
      <td style={{ ...tdStyle, color: '#6B7488', fontSize: 12.5 }}>{u.city}</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{u.bookings}</td>
      <td style={tdStyle}>
        {u.rating > 0 ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="star" size={12} fill="#FFB02E" stroke="#FFB02E" />
            <span style={{ fontWeight: 700 }}>{u.rating.toFixed(1)}</span>
          </span>
        ) : <span style={{ color: '#B8BECE' }}>—</span>}
      </td>
      <td style={tdStyle}>
        <Pill tone={s.tone} dot={s.dot} size="sm">{s.label}</Pill>
      </td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <IconBtn icon="more" size={28} onClick={onOpenMenu} title={`Manage ${u.name}`} />
      </td>
    </tr>
  );
}


