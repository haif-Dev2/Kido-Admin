import React, { useState } from 'react';
import { Icon } from '../icons.jsx';
import { useUserDetail } from '../hooks.js';
import { Card, Btn, Pill, Avatar, PageHeader, SectionHeader, Tabs, Modal, showToast } from '../components.jsx';
import { suspendUser, liftSuspension, banUser, liftBan, writeAuditLog } from '../admin-actions.js';

export function UserDetailPage({ admin, params = {}, goto }) {
  const userId = params.userId;
  const { profile, bookings, reviews, reports, suspensions, loading, refetch } = useUserDetail(userId);
  const [tab, setTab] = useState('bookings');
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [liftOpen, setLiftOpen] = useState(null); // suspension object
  const [banOpen, setBanOpen] = useState(false);
  const [liftBanOpen, setLiftBanOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (!profile) return (
    <div className="page-enter">
      <div style={{ padding: 48, textAlign: 'center', color: '#6B7488' }}>
        <Icon name="users" size={36} stroke="#B8BECE" /><br />
        <div style={{ marginTop: 12, fontSize: 14 }}>User not found or could not be loaded.</div>
        <Btn variant="ghost" style={{ marginTop: 16 }} onClick={() => goto('users')}>← Back to users</Btn>
      </div>
    </div>
  );

  const activeSuspension = suspensions.find(s => s.isActive);
  const statusTone = profile.is_banned ? 'red' : profile.is_suspended ? 'coral' : 'green';
  const statusLabel = profile.is_banned ? 'Banned' : profile.is_suspended ? 'Suspended' : 'Active';

  async function doSuspend({ durationDays, reason }) {
    setBusy(true);
    try {
      await suspendUser(profile.rawId, { durationDays, reason, actor: admin });
      showToast(`${profile.name} suspended for ${durationDays} days`, { tone: 'error' });
      setSuspendOpen(false);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  async function doLiftSuspension(suspension) {
    setBusy(true);
    try {
      await liftSuspension(suspension.id, { userId: profile.rawId, actor: admin });
      showToast(`Suspension lifted for ${profile.name}`, { tone: 'success' });
      setLiftOpen(null);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  async function doBan(reason) {
    if (!confirm(`Permanently ban ${profile.name}? This action requires a second admin review per policy.`)) return;
    setBusy(true);
    try {
      await banUser(profile.rawId, { reason, actor: admin });
      showToast(`${profile.name} permanently banned`, { tone: 'error' });
      setBanOpen(false);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  async function doLiftBan(note) {
    setBusy(true);
    try {
      await liftBan(profile.rawId, { note, actor: admin });
      showToast(`Ban lifted for ${profile.name}`, { tone: 'success' });
      setLiftBanOpen(false);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => goto('users')} style={{ background: 'none', border: 'none', color: '#0D7377', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', padding: 0 }}>
          <Icon name="arrowL" size={14} /> Back to Users
        </button>
      </div>

      {/* Profile header */}
      <Card padding={24} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Avatar name={profile.name} size={72} verified={profile.identity_verified} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#0E1420' }}>{profile.name}</h2>
              <Pill tone={profile.role === 'sitter' ? 'mint' : 'violet'} size="sm">{profile.role === 'sitter' ? 'Babysitter' : 'Parent'}</Pill>
              <Pill tone={statusTone} dot size="sm">{statusLabel}</Pill>
              {profile.identity_verified && <Pill tone="teal" icon="verified" size="sm">ID Verified</Pill>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 24px', fontSize: 13, color: '#4A5568' }}>
              <InfoRow icon="mail"     label={profile.email || '—'} />
              <InfoRow icon="phone"    label={profile.phone || '—'} />
              <InfoRow icon="pin"      label={profile.city || '—'} />
              <InfoRow icon="calendar" label={`Joined ${profile.joined}`} />
              <InfoRow icon="clock"    label={`Last seen ${profile.last_login_at}`} />
              <InfoRow icon="badge"    label={`${profile.suspension_count} suspension${profile.suspension_count !== 1 ? 's' : ''}`} />
            </div>
          </div>
          {/* Action panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
            {!profile.is_banned && !profile.is_suspended && (
              <Btn variant="danger" icon="pause" size="sm" full onClick={() => setSuspendOpen(true)} disabled={busy}>
                Suspend
              </Btn>
            )}
            {profile.is_suspended && activeSuspension && (
              <Btn variant="success" icon="play" size="sm" full onClick={() => setLiftOpen(activeSuspension)} disabled={busy}>
                Lift suspension
              </Btn>
            )}
            {!profile.is_banned && (
              <Btn variant="dangerSolid" icon="ban" size="sm" full onClick={() => setBanOpen(true)} disabled={busy}>
                Ban account
              </Btn>
            )}
            {profile.is_banned && (
              <Btn variant="secondary" icon="check" size="sm" full onClick={() => setLiftBanOpen(true)} disabled={busy}>
                Lift ban
              </Btn>
            )}
            <Btn variant="ghost" icon="mail" size="sm" full onClick={async () => {
              await writeAuditLog({ actor: admin, action: 'opened', entityType: 'Profile', entityId: profile.id, detail: 'Admin viewed full profile.' });
              showToast('Profile visit logged', { tone: 'info' });
            }}>Message user</Btn>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Tabs
          items={[
            { id: 'bookings',    label: 'Bookings',    count: bookings.length },
            { id: 'reviews',     label: 'Reviews',     count: reviews.length },
            { id: 'reports',     label: 'Reports',     count: reports.length },
            { id: 'suspensions', label: 'Suspensions', count: suspensions.length },
          ]}
          active={tab} onChange={setTab}
        />
      </div>

      {tab === 'bookings' && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {bookings.length === 0
            ? <EmptyState icon="calendar" msg="No bookings on record." />
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFBFD' }}>
                    <th style={TH}>Booking</th>
                    <th style={TH}>Date</th>
                    <th style={TH}>Duration</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Amount</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>With</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => (
                    <tr key={b.id} style={{ background: i % 2 ? '#FCFCFE' : '#fff' }}>
                      <td style={TD}><span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12 }}>{b.id}</span></td>
                      <td style={TD}>{b.when}</td>
                      <td style={TD}>{b.duration}</td>
                      <td style={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{Number(b.amount).toLocaleString()} DZD</td>
                      <td style={TD}><StatusPill status={b.status} /></td>
                      <td style={TD}>{b.other}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      )}

      {tab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reviews.length === 0
            ? <Card padding={32}><EmptyState icon="star" msg="No reviews on record." /></Card>
            : reviews.map(r => (
              <Card key={r.id} padding={18}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon key={i} name="star" size={14} fill={i < r.rating ? '#FFB02E' : '#EDEFF4'} stroke={i < r.rating ? '#FFB02E' : '#EDEFF4'} />
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#9099AD', marginBottom: 4 }}>
                      <Pill tone={r.direction === 'given' ? 'violet' : 'teal'} size="sm">{r.direction === 'given' ? 'Given to' : 'Received from'}</Pill>
                      {' '}{r.other} · {r.when}
                    </div>
                    <div style={{ fontSize: 13.5, color: '#2E3748', fontStyle: 'italic' }}>"{r.comment || '(no comment)'}"</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#9099AD', fontFamily: 'var(--font-mono)' }}>{r.id}</span>
                </div>
              </Card>
            ))}
        </div>
      )}

      {tab === 'reports' && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {reports.length === 0
            ? <EmptyState icon="flag" msg="No reports involving this user." />
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFBFD' }}>
                    <th style={TH}>ID</th>
                    <th style={TH}>Reason</th>
                    <th style={TH}>Priority</th>
                    <th style={TH}>Status</th>
                    <th style={TH}>Reporter</th>
                    <th style={TH}>When</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 ? '#FCFCFE' : '#fff' }}>
                      <td style={TD}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.id}</span></td>
                      <td style={TD}>{r.reason}</td>
                      <td style={TD}><PriorityPill p={r.priority} /></td>
                      <td style={TD}><StatusPill status={r.status} /></td>
                      <td style={TD}>{r.reporter}</td>
                      <td style={{ ...TD, color: '#9099AD', fontSize: 12 }}>{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      )}

      {tab === 'suspensions' && (
        <Card padding={0} style={{ overflow: 'hidden' }}>
          {suspensions.length === 0
            ? <EmptyState icon="pause" msg="No suspension history." />
            : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#FAFBFD' }}>
                    <th style={TH}>Reason</th>
                    <th style={TH}>Triggered by</th>
                    <th style={TH}>Suspended at</th>
                    <th style={TH}>Duration</th>
                    <th style={TH}>Lifted at</th>
                    <th style={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {suspensions.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 ? '#FCFCFE' : '#fff' }}>
                      <td style={TD}>{s.reason}</td>
                      <td style={TD}>
                        <Pill tone={s.triggeredBy?.startsWith('auto') ? 'amber' : 'gray'} size="sm">
                          {s.triggeredBy?.startsWith('auto') ? 'Automatic' : s.triggeredBy?.startsWith('report') ? 'Report' : 'Manual'}
                        </Pill>
                      </td>
                      <td style={{ ...TD, fontSize: 12 }}>{s.suspendedAt}</td>
                      <td style={TD}>{s.durationDays} days</td>
                      <td style={{ ...TD, fontSize: 12 }}>{s.liftedAt || '—'}</td>
                      <td style={TD}>
                        {s.isActive ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Pill tone="coral" dot size="sm">Active</Pill>
                            <Btn variant="ghost" size="sm" onClick={() => setLiftOpen(s)} disabled={busy}>Lift</Btn>
                          </div>
                        ) : (
                          <Pill tone="green" dot size="sm">Lifted</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      )}

      {/* Modals */}
      <SuspendModal open={suspendOpen} onClose={() => setSuspendOpen(false)} userName={profile.name} onConfirm={doSuspend} busy={busy} />
      <LiftSuspensionModal open={!!liftOpen} onClose={() => setLiftOpen(null)} suspension={liftOpen} onConfirm={() => doLiftSuspension(liftOpen)} busy={busy} />
      <BanModal open={banOpen} onClose={() => setBanOpen(false)} userName={profile.name} onConfirm={doBan} busy={busy} />
      <LiftBanModal open={liftBanOpen} onClose={() => setLiftBanOpen(false)} userName={profile.name} onConfirm={doLiftBan} busy={busy} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={icon} size={13} stroke="#9099AD" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function EmptyState({ icon, msg }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9099AD' }}>
      <Icon name={icon} size={28} stroke="#B8BECE" />
      <div style={{ marginTop: 8, fontSize: 13 }}>{msg}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    active: 'green', completed: 'green', approved: 'green',
    pending: 'amber', investigating: 'amber',
    cancelled: 'gray', closed: 'gray',
    suspended: 'coral', open: 'coral', failed: 'red', banned: 'red',
    resolved: 'teal',
  };
  return <Pill tone={map[status] || 'gray'} size="sm">{status}</Pill>;
}

function PriorityPill({ p }) {
  const map = { critical: 'red', high: 'coral', medium: 'amber', low: 'gray' };
  return <Pill tone={map[p] || 'gray'} size="sm">{p}</Pill>;
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 24 }}>
      <div className="skel" style={{ width: 120, height: 16, marginBottom: 20 }} />
      <div className="skel" style={{ width: '100%', height: 140, borderRadius: 16, marginBottom: 16 }} />
      <div className="skel" style={{ width: 360, height: 40, marginBottom: 16 }} />
      <div className="skel" style={{ width: '100%', height: 240, borderRadius: 16 }} />
    </div>
  );
}

function SuspendModal({ open, onClose, userName, onConfirm, busy }) {
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`Suspend ${userName}`}
      sub="The user will not be able to log in for the suspension period."
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="dangerSolid" icon="pause" disabled={!reason.trim() || busy} onClick={() => onConfirm({ durationDays: days, reason })}>
          Suspend {days} days
        </Btn>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormField label="Duration (days)">
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: '6px 14px', borderRadius: 8, border: '1.5px solid',
                borderColor: days === d ? '#0D7377' : '#E5E8EF',
                background: days === d ? '#E8F8F5' : '#fff',
                color: days === d ? '#0D7377' : '#4A5568',
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>{d}</button>
            ))}
          </div>
        </FormField>
        <FormField label="Reason (required)">
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Explain why this user is being suspended..."
            style={{ width: '100%', minHeight: 80, padding: 12, border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none', resize: 'vertical' }} />
        </FormField>
      </div>
    </Modal>
  );
}

function LiftSuspensionModal({ open, onClose, suspension, onConfirm, busy }) {
  if (!suspension) return null;
  return (
    <Modal open={open} onClose={onClose} title="Lift suspension"
      sub={`Reason: ${suspension.reason} · Suspended ${suspension.suspendedAt}`}
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="successSolid" icon="play" disabled={busy} onClick={onConfirm}>Lift suspension now</Btn>
      </>}>
      <p style={{ margin: 0, fontSize: 13.5, color: '#4A5568', lineHeight: 1.6 }}>
        This will immediately re-activate the user's account. The suspension record will remain in the history log.
      </p>
    </Modal>
  );
}

function BanModal({ open, onClose, userName, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`Permanently ban ${userName}`}
      sub="This action cannot be undone without another admin lifting the ban."
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="dangerSolid" icon="ban" disabled={!reason.trim() || busy} onClick={() => onConfirm(reason)}>Confirm ban</Btn>
      </>}>
      <FormField label="Reason (required)">
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Document the reason for permanent ban..."
          style={{ width: '100%', minHeight: 80, padding: 12, border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none', resize: 'vertical' }} />
      </FormField>
    </Modal>
  );
}

function LiftBanModal({ open, onClose, userName, onConfirm, busy }) {
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`Lift ban for ${userName}`}
      sub="The user will be able to log in again immediately."
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="successSolid" icon="check" disabled={busy} onClick={() => onConfirm(note)}>Lift ban</Btn>
      </>}>
      <FormField label="Admin note (optional)">
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Reason for lifting the ban..."
          style={{ width: '100%', minHeight: 80, padding: 12, border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none', resize: 'vertical' }} />
      </FormField>
    </Modal>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #F1F3F8' };
const TD = { padding: '11px 14px', fontSize: 13, color: '#0E1420', borderBottom: '1px solid #F8F9FC' };
