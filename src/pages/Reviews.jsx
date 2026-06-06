import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../icons.jsx';
import { useFlaggedReviews } from '../hooks.js';
import { Card, Btn, Pill, Avatar, PageHeader, Modal, showToast } from '../components.jsx';
import { keepReview, removeReview, writeAuditLog } from '../admin-actions.js';

// Flagged Reviews moderation

export function ReviewsPage({ admin, search = '' }) {
  const { data: FLAGGED_REVIEWS } = useFlaggedReviews();
  const [items, setItems] = useState([]);
  React.useEffect(() => { setItems(FLAGGED_REVIEWS); }, [FLAGGED_REVIEWS]);
  const [busy, setBusy] = useState(false);
  const [replyFor, setReplyFor] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const query = search.trim().toLowerCase();
  const visible = !query ? items : items.filter(r =>
    `${r.id} ${r.author} ${r.target} ${r.reason} ${r.text}`.toLowerCase().includes(query));

  async function act(id, action) {
    const target = items.find(r => r.id === id);
    setItems(items.map(r => r.id === id ? { ...r, decision: action } : r));
    setBusy(true);
    try {
      if (action === 'kept')       await keepReview(id, { actor: admin });
      else if (action === 'removed') await removeReview(id, { actor: admin });
      showToast(`${id} ${action === 'kept' ? 'kept' : 'removed'}`, { tone: action === 'kept' ? 'success' : 'error' });
    } catch (e) {
      // Roll back decision visual on failure.
      setItems(items.map(r => r.id === id ? { ...r, decision: undefined } : r));
      showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <PageHeader
        kicker="Content moderation"
        title="Flagged reviews"
        sub={`${items.filter(r => !r.decision).length} pending · 12 resolved this week`}
        actions={[<Btn key="rules" variant="ghost" icon="settings" onClick={() => setRulesOpen(true)}>Moderation rules</Btn>]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {visible.length === 0 && (
          <Card padding={48} style={{ textAlign: 'center', color: '#6B7488', fontSize: 13 }}>
            No reviews match "{query}".
          </Card>
        )}
        {visible.map(r => (
          <Card key={r.id} padding={22} style={{ opacity: r.decision ? 0.7 : 1 }}>
            <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
              <Avatar name={r.author} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0E1420' }}>{r.author}</span>
                  <span style={{ color: '#9099AD' }}>→</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0E1420' }}>{r.target}</span>
                  <Pill tone="gray" size="sm">{r.id}</Pill>
                  <Pill tone={r.reason === 'Verified incident' ? 'amber' : 'red'} size="sm" dot>{r.reason}</Pill>
                  <span style={{ fontSize: 11.5, color: '#9099AD' }}>· flagged by {r.flagged_by} · {r.when}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon key={i} name="star" size={15} fill={i < r.stars ? '#FFB02E' : '#EDEFF4'} stroke={i < r.stars ? '#FFB02E' : '#EDEFF4'} />
                  ))}
                </div>
                <blockquote style={{
                  margin: 0, padding: 14,
                  background: '#FAFBFD', borderRadius: 12,
                  borderLeft: '3px solid #FF6B8A',
                  fontSize: 14, color: '#2E3748', lineHeight: 1.55,
                  fontStyle: 'italic',
                }}>"{r.text}"</blockquote>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  {r.decision ? (
                    <Pill tone={r.decision === 'kept' ? 'green' : 'red'} dot icon={r.decision === 'kept' ? 'check' : 'trash'}>
                      {r.decision === 'kept' ? 'Kept — review is legitimate' : 'Removed — author warned'}
                    </Pill>
                  ) : (
                    <>
                      <Btn variant="successSolid" size="sm" icon="check" disabled={busy} onClick={() => act(r.id, 'kept')}>Keep review</Btn>
                      <Btn variant="dangerSolid" size="sm" icon="trash" disabled={busy} onClick={() => act(r.id, 'removed')}>Remove</Btn>
                      <Btn variant="ghost" size="sm" icon="msg" onClick={() => setReplyFor(r)}>Reply to author</Btn>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ReplyModal
        review={replyFor}
        onClose={() => setReplyFor(null)}
        onSend={async (text) => {
          try {
            await writeAuditLog({
              actor: admin, action: 'opened', entityType: 'Review', entityId: replyFor.id,
              detail: `Replied to ${replyFor.author}: ${text}`,
            });
            showToast(`Reply sent to ${replyFor.author}`, { tone: 'info' });
          } catch (e) {
            showToast(`Failed: ${e?.message || 'unknown'}`, { tone: 'error' });
          } finally {
            setReplyFor(null);
          }
        }}
      />

      <ModerationRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </div>
  );
}

export function ReplyModal({ review, onClose, onSend }) {
  const [text, setText] = useState('');
  useEffect(() => { if (review) setText(''); }, [review]);
  if (!review) return null;
  return (
    <Modal
      open={!!review}
      onClose={onClose}
      title={`Reply to ${review.author}`}
      sub={`Their review of ${review.target} — ${review.stars}★`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon="msg" disabled={!text.trim()} onClick={() => onSend(text.trim())}>Send reply</Btn>
        </>
      }
    >
      <blockquote style={{ margin: '0 0 16px', padding: 12, background: '#FAFBFD', borderLeft: '3px solid #FF6B8A', borderRadius: 8, fontSize: 12.5, fontStyle: 'italic', color: '#4A5568' }}>
        "{review.text}"
      </blockquote>
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Hi — thanks for sharing your experience. We're looking into this..."
        style={{
          width: '100%', minHeight: 120,
          border: '1.5px solid #E5E8EF', borderRadius: 12,
          padding: 14, fontSize: 13.5, fontFamily: 'inherit',
          background: '#FAFBFD', outline: 'none', resize: 'vertical', lineHeight: 1.5,
        }}
      />
    </Modal>
  );
}

export function ModerationRulesModal({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Moderation rules"
      sub="Active rules applied to all incoming reviews."
      footer={<Btn variant="primary" onClick={onClose}>Close</Btn>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { name: 'Profanity filter', desc: 'Flags reviews containing profanity in Arabic, French, or English.', on: true },
          { name: 'Personal-info detector', desc: 'Hides phone numbers and email addresses pasted into reviews.', on: true },
          { name: '1-star burst rule', desc: 'Auto-flags if a sitter receives 3+ one-star reviews within 24h.', on: true },
          { name: 'Off-platform mentions', desc: 'Flags reviews suggesting payment or contact outside the app.', on: false },
        ].map((r) => (
          <div key={r.name} style={{ padding: 14, background: '#FAFBFD', borderRadius: 12, border: '1px solid #F1F3F8', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1420' }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: '#6B7488', marginTop: 2 }}>{r.desc}</div>
            </div>
            <Pill tone={r.on ? 'green' : 'gray'} size="sm" dot>{r.on ? 'On' : 'Off'}</Pill>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#9099AD', marginTop: 6 }}>
          Editing rules is a v2 feature — for now they live in the codebase and require a redeploy.
        </div>
      </div>
    </Modal>
  );
}


