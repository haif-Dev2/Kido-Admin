import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icons.jsx';
import { useVerifications, useFlaggedPhotos } from '../hooks.js';
import { Card, Btn, Pill, Avatar, PageHeader, Chip, SectionHeader, Tabs, Modal, NotifyUserModal, showToast } from '../components.jsx';
import { approveVerification, rejectVerification, requestMoreInfoVerification, approveProfilePhoto, rejectProfilePhoto, sendNotification } from '../admin-actions.js';

// Verification page — the hero. Split view: queue + detail panel.

export function VerificationPage({ admin, goto, search = '', onActionDone }) {
  const { data: VERIFICATIONS } = useVerifications();
  const { data: PHOTOS } = useFlaggedPhotos();
  const [items, setItems] = useState([]);
  const [mainTab, setMainTab] = useState('pending');
  React.useEffect(() => { setItems(VERIFICATIONS); }, [VERIFICATIONS]);
  const [selectedId, setSelectedId] = useState(null);
  React.useEffect(() => {
    if (!selectedId && VERIFICATIONS.length > 0) setSelectedId(VERIFICATIONS[0].id);
  }, [VERIFICATIONS, selectedId]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [infoModalFor, setInfoModalFor] = useState(null);
  const [resubModalFor, setResubModalFor] = useState(null);
  const [notifyFor, setNotifyFor] = useState(null); // { id, name, sitterId }

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'high') list = list.filter(v => v.score >= 80);
    else if (filter === 'risky') list = list.filter(v => v.score < 60);
    else if (filter === 'incomplete') list = list.filter(v => !v.cv || !v.selfie || v.refs === 0);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(v => `${v.id} ${v.name} ${v.city}`.toLowerCase().includes(q));
    return list;
  }, [items, filter, search]);

  const selected = items.find(v => v.id === selectedId) || filtered[0];

  async function decide(id, decision) {
    const target = items.find(v => v.id === id);
    if (!target) return;
    const next = items.filter(v => v.id !== id);
    setItems(next);
    if (next.length) setSelectedId(next[0].id);
    try {
      setBusy(true);
      if (decision === 'approved') await approveVerification(id, { actor: admin });
      else                          await rejectVerification(id, { actor: admin });
      showToast(`${target.name} ${decision === 'approved' ? 'verified — sitter is now visible' : 'rejected — applicant notified'}`,
        { tone: decision === 'approved' ? 'success' : 'error' });
      onActionDone?.();
    } catch (e) {
      setItems(items);
      showToast(`Failed: ${e?.message || 'unknown error'}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function requestResubmission(id, message) {
    const target = items.find(v => v.id === id);
    if (!target) return;
    const next = items.filter(v => v.id !== id);
    setItems(next);
    if (next.length) setSelectedId(next[0].id);
    try {
      setBusy(true);
      await requestMoreInfoVerification(id, { actor: admin, message });
      showToast(`Resubmission requested — ${target.name} notified`, { tone: 'info' });
      onActionDone?.();
    } catch (e) {
      setItems(items);
      showToast(`Failed: ${e?.message || 'unknown error'}`, { tone: 'error' });
    } finally {
      setBusy(false);
      setResubModalFor(null);
    }
  }

  async function bulkApprove() {
    const high = items.filter(v => v.score >= 80);
    if (!high.length) return showToast('No high-score sitters in queue', { tone: 'info' });
    if (!confirm(`Approve ${high.length} sitter${high.length > 1 ? 's' : ''} with score ≥ 80?`)) return;
    setBusy(true);
    let ok = 0, fail = 0;
    for (const v of high) {
      try { await approveVerification(v.id, { actor: admin, note: 'Bulk approval — score ≥ 80.' }); ok++; }
      catch { fail++; }
    }
    setItems(items.filter(v => v.score < 80));
    setBusy(false);
    showToast(`${ok} approved${fail ? `, ${fail} failed` : ''}`, { tone: fail ? 'error' : 'success' });
    onActionDone?.();
  }

  return (
    <div className="page-enter">
      <PageHeader
        kicker="Trust & Safety"
        title="Babysitter verification"
        sub={mainTab === 'pending'
          ? `${items.length} sitter${items.length !== 1 ? 's' : ''} waiting for review`
          : `${PHOTOS.length} photo${PHOTOS.length !== 1 ? 's' : ''} flagged for review`}
        actions={mainTab === 'pending' ? [
          <Btn key="refresh" variant="ghost" icon="refresh" onClick={() => location.reload()}>Refresh</Btn>,
          <Btn key="bulk" variant="secondary" icon="check" disabled={busy} onClick={bulkApprove}>Bulk approve high score</Btn>,
        ] : [
          <Btn key="refresh" variant="ghost" icon="refresh" onClick={() => location.reload()}>Refresh</Btn>,
        ]}
      />

      <div style={{ marginBottom: 16 }}>
        <Tabs
          items={[
            { id: 'pending', label: 'Pending', count: items.length },
            { id: 'photos',  label: 'Photo review', count: PHOTOS.length },
          ]}
          active={mainTab}
          onChange={setMainTab}
        />
      </div>

      {mainTab === 'pending' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All <span style={{ opacity: 0.7 }}>· {items.length}</span></Chip>
            <Chip active={filter === 'high'} onClick={() => setFilter('high')} icon="trendUp">High score <span style={{ opacity: 0.7 }}>· {items.filter(v => v.score >= 80).length}</span></Chip>
            <Chip active={filter === 'risky'} onClick={() => setFilter('risky')} icon="alert">Risky <span style={{ opacity: 0.7 }}>· {items.filter(v => v.score < 60).length}</span></Chip>
            <Chip active={filter === 'incomplete'} onClick={() => setFilter('incomplete')}>Incomplete docs <span style={{ opacity: 0.7 }}>· {items.filter(v => !v.cv || !v.selfie || v.refs === 0).length}</span></Chip>
            <span style={{ flex: 1 }} />
            <Chip icon="filter">More filters</Chip>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
            {/* QUEUE */}
            <Card padding={0} style={{ overflow: 'hidden', position: 'sticky', top: 80, height: 'calc(100vh - 260px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F3F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0E1420' }}>Queue · {filtered.length}</div>
                <div style={{ fontSize: 11, color: '#9099AD', fontWeight: 600 }}>Sorted by score ↓</div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filtered.length === 0 && (
                  <div style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 99, background: '#DCF5E4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#1F8A4E' }}>
                      <Icon name="check" size={28} strokeWidth={2.5} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1420' }}>Queue clear!</div>
                    <div style={{ fontSize: 12, color: '#6B7488', marginTop: 4 }}>No pending verifications match this filter.</div>
                  </div>
                )}
                {filtered.map(v => (
                  <button key={v.id} onClick={() => setSelectedId(v.id)}
                    style={{
                      width: '100%', textAlign: 'left', border: 'none',
                      background: selectedId === v.id ? '#F3FBFA' : '#fff',
                      padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit',
                      borderLeft: `3px solid ${selectedId === v.id ? '#0D7377' : 'transparent'}`,
                      borderBottom: '1px solid #F8F9FC',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}>
                    <Avatar name={v.name} initial={v.initial} bg0={v.bg0} bg1={v.bg1} tint={v.tint} size={42} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1420' }}>{v.name}</div>
                        <ScoreDot score={v.score} />
                      </div>
                      <div style={{ fontSize: 11.5, color: '#6B7488', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Icon name="pin" size={11} stroke="#9099AD" /> {v.city}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        <Pill tone={v.idType === 'Passport' ? 'violet' : 'gray'} size="sm">{v.idType}</Pill>
                        {v.selfie ? <Pill tone="teal" size="sm">Selfie</Pill> : <Pill tone="amber" size="sm">No selfie</Pill>}
                        {!v.cv && <Pill tone="amber" size="sm">No CV</Pill>}
                        {v.refs > 0 && <Pill tone="green" size="sm">{v.refs} refs</Pill>}
                      </div>
                      <div style={{ fontSize: 10.5, color: '#9099AD', marginTop: 8, fontWeight: 600 }}>Submitted {v.submitted}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* DETAIL */}
            {selected ? (
              <VerificationDetail
                v={selected}
                busy={busy}
                onApprove={() => decide(selected.id, 'approved')}
                onReject={() => decide(selected.id, 'rejected')}
                onRequestResubmission={() => setResubModalFor(selected.id)}
                onRequestInfo={() => setInfoModalFor(selected.id)}
                onNotify={() => setNotifyFor({ id: selected.id, name: selected.name, sitterId: selected.sitterId })}
                onOpenProfile={() => selected.sitterId ? goto?.('user-detail', { userId: selected.sitterId }) : goto?.('users')}
              />
            ) : (
              <Card padding={48} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', maxWidth: 320 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0E1420', marginBottom: 4 }}>You're all caught up</div>
                  <div style={{ fontSize: 13, color: '#6B7488' }}>Every pending verification has been reviewed. New submissions appear here automatically.</div>
                </div>
              </Card>
            )}
          </div>

          <RequestResubmissionModal
            open={!!resubModalFor}
            onClose={() => setResubModalFor(null)}
            onSubmit={(msg) => requestResubmission(resubModalFor, msg)}
          />

          <NotifyUserModal
            open={!!notifyFor}
            onClose={() => setNotifyFor(null)}
            userName={notifyFor?.name}
            onSend={async ({ type, title, message }) => {
              try {
                await sendNotification(notifyFor.sitterId, { title, message, type, actor: admin });
                showToast(`Notification sent to ${notifyFor.name}`, { tone: 'success' });
                setNotifyFor(null);
              } catch (e) {
                showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
              }
            }}
          />

          <RequestInfoModal
            open={!!infoModalFor}
            onClose={() => setInfoModalFor(null)}
            onSubmit={async (msg) => {
              try {
                await requestMoreInfoVerification(infoModalFor, { actor: admin, message: msg });
                showToast('Request sent — applicant will be notified', { tone: 'info' });
              } catch (e) {
                showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
              } finally {
                setInfoModalFor(null);
              }
            }}
          />
        </>
      )}

      {mainTab === 'photos' && (
        <PhotoReviewSection admin={admin} onActionDone={onActionDone} />
      )}
    </div>
  );
}

function PhotoReviewSection({ admin, onActionDone }) {
  const { data: PHOTOS } = useFlaggedPhotos();
  const [items, setItems] = useState([]);
  const [rejectFor, setRejectFor] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setItems(PHOTOS); }, [PHOTOS]);

  async function approvePhoto(id) {
    const target = items.find(p => p.id === id);
    setItems(prev => prev.filter(p => p.id !== id));
    try {
      setBusy(true);
      await approveProfilePhoto(id, { actor: admin });
      showToast(`Photo approved — ${target?.name || 'Sitter'} profile updated`, { tone: 'success' });
      onActionDone?.();
    } catch (e) {
      setItems(prev => [target, ...prev]);
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  async function rejectPhoto(id, reason) {
    const target = items.find(p => p.id === id);
    setItems(prev => prev.filter(p => p.id !== id));
    try {
      setBusy(true);
      await rejectProfilePhoto(id, { reason, actor: admin });
      showToast(`Photo removed — ${target?.name || 'Sitter'} asked to re-upload`, { tone: 'error' });
      onActionDone?.();
    } catch (e) {
      setItems(prev => [target, ...prev]);
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally { setBusy(false); setRejectFor(null); }
  }

  if (items.length === 0) {
    return (
      <Card padding={48} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#0E1420', marginBottom: 4 }}>No photos to review</div>
          <div style={{ fontSize: 13, color: '#6B7488' }}>All flagged profile photos have been checked.</div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {items.map(p => (
          <Card key={p.id} padding={0} style={{ overflow: 'hidden' }}>
            <div style={{ height: 160, background: '#F1F3F8', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <PhotoOrAvatar url={p.photoUrl} name={p.name} initial={p.initial} />
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0E1420' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#6B7488', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="pin" size={11} stroke="#9099AD" /> {p.city}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Btn variant="successSolid" size="sm" icon="check" full disabled={busy} onClick={() => approvePhoto(p.id)}>Approve photo</Btn>
                <Btn variant="dangerSolid" size="sm" icon="x" disabled={busy} onClick={() => setRejectFor(p.id)}>Reject</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <PhotoRejectModal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onSubmit={(reason) => rejectPhoto(rejectFor, reason)}
      />
    </>
  );
}

function PhotoOrAvatar({ url, name, initial }) {
  const [failed, setFailed] = useState(!url);
  if (failed || !url) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        <Avatar name={name} initial={initial} size={72} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

function PhotoRejectModal({ open, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reject profile photo"
      sub="The sitter will be asked to upload a new photo. Provide a reason."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="dangerSolid" icon="x" disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>Remove & ask to re-upload</Btn>
        </>
      }
    >
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Photo does not show a real face — please upload a clear, recent portrait photo of yourself."
        style={{
          width: '100%', minHeight: 120,
          border: '1.5px solid #E5E8EF', borderRadius: 12,
          padding: 14, fontSize: 13.5, fontFamily: 'inherit',
          background: '#FAFBFD', color: '#0E1420',
          outline: 'none', resize: 'vertical', lineHeight: 1.5,
        }}
      />
    </Modal>
  );
}

export function RequestResubmissionModal({ open, onClose, onSubmit }) {
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open) setMsg(''); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request resubmission"
      sub="The applicant will be removed from the queue and asked to resubmit with the requested changes."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="msg" disabled={!msg.trim()} onClick={() => onSubmit(msg.trim())}>Send & remove from queue</Btn>
        </>
      }
    >
      <textarea
        autoFocus
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="e.g. Please re-upload your ID document — the current image is blurry and unreadable."
        style={{
          width: '100%', minHeight: 140,
          border: '1.5px solid #E5E8EF', borderRadius: 12,
          padding: 14, fontSize: 13.5, fontFamily: 'inherit',
          background: '#FAFBFD', color: '#0E1420',
          outline: 'none', resize: 'vertical', lineHeight: 1.5,
        }}
      />
      <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 8 }}>
        This applicant is removed from the pending queue. A note is added to the audit log.
      </div>
    </Modal>
  );
}

export function RequestInfoModal({ open, onClose, onSubmit }) {
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open) setMsg(''); }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request more information"
      sub="Ask the applicant for specific documents or clarifications before deciding."
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="msg" disabled={!msg.trim()} onClick={() => onSubmit(msg.trim())}>Send request</Btn>
        </>
      }
    >
      <textarea
        autoFocus
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="e.g. The selfie is blurry — please upload a sharper photo holding your ID document, face clearly visible."
        style={{
          width: '100%', minHeight: 140,
          border: '1.5px solid #E5E8EF', borderRadius: 12,
          padding: 14, fontSize: 13.5, fontFamily: 'inherit',
          background: '#FAFBFD', color: '#0E1420',
          outline: 'none', resize: 'vertical', lineHeight: 1.5,
        }}
      />
      <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 8 }}>
        The applicant gets this message and an opportunity to resubmit. A note is also added to the audit log.
      </div>
    </Modal>
  );
}

export function ScoreDot({ score }) {
  const tone = score >= 80 ? '#1F8A4E' : score >= 60 ? '#B26A00' : '#C8324A';
  const bg   = score >= 80 ? '#DCF5E4' : score >= 60 ? '#FFF4DC' : '#FFE0E4';
  return (
    <span style={{ background: bg, color: tone, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, fontFamily: 'var(--font-display)' }}>{score}</span>
  );
}

export function VerificationDetail({ v, onApprove, onReject, onRequestResubmission, onRequestInfo, onNotify, onOpenProfile, busy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero */}
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <div style={{
          background: `radial-gradient(ellipse at 80% 0%, ${v.bg0} 0%, transparent 70%), linear-gradient(135deg, #0D7377 0%, #08484B 100%)`,
          padding: 28, color: '#fff', position: 'relative',
        }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            <Avatar name={v.name} initial={v.initial} bg0={v.bg0} bg1={v.bg1} tint={v.tint} size={84} ring={v.score >= 80 ? '#7DD6D8' : '#FFB8C8'} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Pill tone="amber" size="sm" dot>Pending review</Pill>
                <Pill tone="gray" size="sm">{v.id}</Pill>
              </div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{v.name}</h2>
              <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.78)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span><Icon name="pin" size={12} style={{ display: 'inline', verticalAlign: -2 }} /> {v.city}</span>
                <span>·</span>
                <span>{v.exp} experience</span>
                <span>·</span>
                <span>{v.age} yrs old</span>
                <span>·</span>
                <span>Submitted {v.submitted}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>Trust score</div>
              <div style={{ fontSize: 48, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', lineHeight: 1, color: v.score >= 80 ? '#7DD6D8' : v.score >= 60 ? '#FFD580' : '#FFB8C8' }}>{v.score}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{v.score >= 80 ? 'Looks legitimate' : v.score >= 60 ? 'Manual review' : 'High risk'}</div>
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #F1F3F8', display: 'flex', alignItems: 'center', gap: 10, background: '#FAFBFD' }}>
          <Btn variant="successSolid" icon="check" onClick={onApprove} disabled={busy}>Approve & verify</Btn>
          <Btn variant="ghost" icon="refresh" onClick={onRequestResubmission} disabled={busy}>Request resubmission</Btn>
          <Btn variant="dangerSolid" icon="x" onClick={onReject} disabled={busy}>Reject submission</Btn>
          <Btn variant="ghost" icon="msg" onClick={onRequestInfo}>Request more info</Btn>
          <span style={{ flex: 1 }} />
          <Btn variant="soft" size="sm" icon="msg" onClick={onNotify}>Notify sitter</Btn>
          <Btn variant="soft" size="sm" icon="external" onClick={onOpenProfile}>Open public profile</Btn>
        </div>
      </Card>

      {/* Documents grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <DocCard title="Government ID" sub={v.idType} status={v.selfie ? 'verified' : 'pending'} icon="card" />
        <DocCard title="Selfie + ID match" sub={v.selfie ? 'Match score 0.91' : 'Not provided'} status={v.selfie ? 'verified' : 'missing'} icon="eye" />
        <DocCard title="CV / Experience" sub={v.cv ? '1 file uploaded' : 'Not provided'} status={v.cv ? 'verified' : 'missing'} icon="fileLog" />
      </div>

      {/* Profile body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Card padding={22}>
          <SectionHeader title="Profile bio" />
          <p style={{ margin: 0, fontSize: 14, color: '#2E3748', lineHeight: 1.55 }}>{v.bio}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18, paddingTop: 18, borderTop: '1px solid #F1F3F8' }}>
            <KeyValue label="Hourly rate" value={`${v.priceHr} DZD/hr`} highlight />
            <KeyValue label="Email" value={v.email} icon="mail" />
            <KeyValue label="Phone" value={v.phone} icon="phone" />
            <KeyValue label="ID document" value={`${v.idType} · ends ····2841`} icon="card" />
            <KeyValue label="Languages" value={v.languages.join(', ')} icon="globe" />
            <KeyValue label="Certifications" value={v.certifications.length ? v.certifications.join(' · ') : '—'} icon="badge" />
          </div>
        </Card>

        <Card padding={22}>
          <SectionHeader title="Trust signals" sub="Auto-checks performed at submission" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Signal ok={true}            label="Phone is reachable"           detail="OTP delivered & confirmed" />
            <Signal ok={v.selfie}        label="Face matches ID document"     detail={v.selfie ? 'ML similarity 0.91' : 'Selfie not uploaded'} />
            <Signal ok={v.refs > 0}      label={`${v.refs} reference${v.refs===1?'':'s'} provided`} detail={v.refs > 0 ? 'Ready for outreach' : 'Add at least one'} />
            <Signal ok={v.score >= 60}   label="No prior reports"             detail="Email/phone not in moderation history" />
            <Signal ok={v.cv}            label="Experience document attached" detail={v.cv ? 'Reviewed by moderator' : 'Missing CV upload'} />
            <Signal ok={v.age >= 21}     label="Meets minimum age (18+)"      detail={`${v.age} yrs old`} />
          </div>
        </Card>
      </div>

      {/* Notes / decision aid */}
      <Card padding={22}>
        <SectionHeader title="Moderator notes" sub="Visible to admins only · saved to audit log" />
        <textarea defaultValue={v.score < 60 ? 'Verification score below threshold. Selfie missing — request a clear, well-lit photo holding the ID document.' : ''}
          placeholder="Add a private note before approving or rejecting…"
          style={{
            width: '100%', minHeight: 96,
            border: '1.5px solid #E5E8EF', borderRadius: 12,
            padding: 14, fontSize: 13.5, fontFamily: 'inherit',
            background: '#FAFBFD', color: '#0E1420',
            outline: 'none', resize: 'vertical', lineHeight: 1.5,
          }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11.5, color: '#9099AD' }}>Press <kbd style={{ background: '#F1F3F8', padding: '1px 5px', borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>⌘ Enter</kbd> to save</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip>Template: missing selfie</Chip>
            <Chip>Template: blurry ID</Chip>
            <Chip>Template: under-age</Chip>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function KeyValue({ label, value, icon, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9099AD', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: highlight ? 16 : 13.5, fontWeight: highlight ? 800 : 600, color: highlight ? '#0D7377' : '#0E1420', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: highlight ? 'var(--font-display)' : 'inherit' }}>
        {icon && <Icon name={icon} size={13} stroke="#6B7488" />}
        {value}
      </div>
    </div>
  );
}

export function DocCard({ title, sub, status, icon }) {
  const statusMap = {
    verified: { tone: 'green', label: '✓ Looks good' },
    pending:  { tone: 'amber', label: 'Needs review' },
    missing:  { tone: 'red',   label: 'Missing' },
  };
  const s = statusMap[status];
  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <div style={{
        height: 130,
        background: status === 'missing'
          ? 'linear-gradient(135deg, #F8F9FC, #FFE0E4)'
          : `linear-gradient(135deg, #F3FBFA, #D9F1F2)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {status === 'missing' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#C8324A' }}>
            <Icon name="alert" size={32} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Not uploaded</span>
          </div>
        ) : (
          <FauxDocument kind={icon} />
        )}
      </div>
      <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1420' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: '#6B7488', marginTop: 1 }}>{sub}</div>
        </div>
        <Pill tone={s.tone} size="sm" dot>{s.label}</Pill>
      </div>
    </Card>
  );
}

export function FauxDocument({ kind }) {
  if (kind === 'card') {
    return (
      <div style={{
        width: '70%', aspectRatio: '1.6/1',
        background: 'linear-gradient(135deg, #199CA0, #0D7377)',
        borderRadius: 8,
        boxShadow: '0 8px 20px rgba(13,115,119,0.32)',
        padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        color: '#fff', position: 'relative',
        transform: 'rotate(-3deg)',
      }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', opacity: 0.7 }}>RÉPUBLIQUE ALGÉRIENNE</div>
        <div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>NAME</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <div className="skel" style={{ height: 8, width: 60, background: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
          <span>•••• •••• 2841</span>
          <span style={{ width: 18, height: 22, borderRadius: 3, background: 'rgba(255,255,255,0.22)' }} />
        </div>
      </div>
    );
  }
  if (kind === 'eye') {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          width: 70, height: 70, borderRadius: 99,
          background: 'radial-gradient(circle at 35% 30%, #FFE4EB, #D9F1F2)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(14,20,32,0.06)',
        }}>
          <svg width={64} height={64} viewBox="0 0 64 64">
            <circle cx={32} cy={24} r={11} fill="#0D7377" opacity={0.4} />
            <path d="M10 64 C 10 44, 54 44, 54 64 Z" fill="#0D7377" opacity={0.4} />
          </svg>
        </div>
        <Icon name="check" size={26} stroke="#1F8A4E" strokeWidth={3} />
        <div style={{
          width: 50, aspectRatio: '1.6/1',
          background: 'linear-gradient(135deg, #199CA0, #0D7377)',
          borderRadius: 5, transform: 'rotate(6deg)',
        }} />
      </div>
    );
  }
  return (
    <div style={{
      width: '60%', aspectRatio: '0.72',
      background: '#fff',
      borderRadius: 6, padding: 10,
      boxShadow: '0 4px 12px rgba(14,20,32,0.10)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div className="skel" style={{ height: 6, width: '60%', borderRadius: 3 }} />
      <div className="skel" style={{ height: 4, width: '40%', borderRadius: 3, marginBottom: 6 }} />
      <div className="skel" style={{ height: 3, width: '90%', borderRadius: 3 }} />
      <div className="skel" style={{ height: 3, width: '85%', borderRadius: 3 }} />
      <div className="skel" style={{ height: 3, width: '88%', borderRadius: 3 }} />
      <div className="skel" style={{ height: 3, width: '50%', borderRadius: 3, marginTop: 4 }} />
      <div className="skel" style={{ height: 3, width: '70%', borderRadius: 3 }} />
    </div>
  );
}

export function Signal({ ok, label, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: '1px solid #F1F3F8' }}>
      <span style={{
        width: 22, height: 22, borderRadius: 99, flexShrink: 0,
        background: ok ? '#DCF5E4' : '#FFE0E4', color: ok ? '#1F8A4E' : '#C8324A',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
      }}>
        <Icon name={ok ? 'check' : 'x'} size={12} strokeWidth={3} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420' }}>{label}</div>
        <div style={{ fontSize: 11.5, color: '#6B7488', marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  );
}
