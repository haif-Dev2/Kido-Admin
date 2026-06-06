import React, { useState, useEffect } from 'react';
import { Icon } from '../icons.jsx';
import { useAdminSettings, useAdmins } from '../hooks.js';
import { Card, Btn, Avatar, SectionHeader, Modal, showToast } from '../components.jsx';
import { saveAdminSettings, inviteAdmin, revokeAdmin, writeAuditLog } from '../admin-actions.js';

export function SettingsPage({ admin }) {
  const [activeSection, setActiveSection] = useState('thresholds');

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0D7377', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Admin console</div>
        <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: '#0E1420', letterSpacing: '-0.02em' }}>Settings</h2>
        <p style={{ margin: 0, color: '#6B7488', fontSize: 14 }}>Moderation thresholds, admin roles, and platform integrations.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Left nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { id: 'thresholds',   icon: 'settings', label: 'Moderation thresholds' },
            { id: 'roles',        icon: 'users',    label: 'Admin roles' },
            { id: 'integrations', icon: 'globe',    label: 'Integrations' },
          ].map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: activeSection === s.id ? '#E8F8F5' : 'transparent',
              color: activeSection === s.id ? '#0D7377' : '#4A5568',
              fontWeight: activeSection === s.id ? 700 : 600,
              fontSize: 13.5, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              fontFamily: 'inherit', transition: 'all 150ms',
            }}>
              <Icon name={s.icon} size={16} stroke={activeSection === s.id ? '#0D7377' : '#6B7488'} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Right panel */}
        <div>
          {activeSection === 'thresholds' && <ThresholdsSection admin={admin} />}
          {activeSection === 'roles'      && <RolesSection admin={admin} />}
          {activeSection === 'integrations' && <IntegrationsSection admin={admin} />}
        </div>
      </div>
    </div>
  );
}

// ─── G1: Moderation thresholds ────────────────────────────────────────────────

function ThresholdsSection({ admin }) {
  const { settings, loading } = useAdminSettings();
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (settings && !form) setForm({ ...settings }); }, [settings]);

  if (loading || !form) return <Card padding={40} style={{ textAlign: 'center', color: '#9099AD' }}>Loading settings…</Card>;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);

  async function handleSave() {
    setBusy(true);
    try {
      await saveAdminSettings(form, { actor: admin });
      showToast('Settings saved', { tone: 'success' });
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={24}>
        <SectionHeader title="Rating & suspension rules"
          sub="Controls when the system automatically suspends a babysitter." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SettingField
            label="Minimum rating before suspension"
            hint="Sitters whose avg drops below this are auto-suspended."
            value={form.minRatingSuspension}
            onChange={v => set('minRatingSuspension', parseFloat(v) || 3.0)}
            type="number" min="1" max="5" step="0.1"
            suffix="/ 5.0"
          />
          <SettingField
            label="Suspensions before permanent ban"
            hint="How many active suspensions trigger an automatic ban."
            value={form.suspensionsBeforeBan}
            onChange={v => set('suspensionsBeforeBan', parseInt(v) || 3)}
            type="number" min="1" max="20"
            suffix="suspensions"
          />
          <SettingField
            label="Suspension duration"
            hint="Default number of days for each suspension."
            value={form.suspensionDurationDays}
            onChange={v => set('suspensionDurationDays', parseInt(v) || 7)}
            type="number" min="1" max="365"
            suffix="days"
          />
        </div>
      </Card>

      <Card padding={24}>
        <SectionHeader title="Account deletion windows"
          sub="Timings enforced when a user requests account deletion." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <SettingField
            label="Reactivation window"
            hint="How long a user has to cancel their deletion request."
            value={form.reactivationWindowHours}
            onChange={v => set('reactivationWindowHours', parseInt(v) || 72)}
            type="number" min="1" max="168"
            suffix="hours"
          />
          <SettingField
            label="Credential block duration"
            hint="How long the email/phone is blocked from re-registration."
            value={form.credentialBlockMonths}
            onChange={v => set('credentialBlockMonths', parseInt(v) || 4)}
            type="number" min="1" max="24"
            suffix="months"
          />
        </div>
      </Card>

      {dirty && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Btn variant="ghost" onClick={() => setForm({ ...settings })}>Discard</Btn>
          <Btn variant="primary" icon="check" disabled={busy} onClick={handleSave}>Save changes</Btn>
        </div>
      )}

      <Card padding={20} style={{ background: '#FAFBFD', border: '1px dashed #DDE1EA' }}>
        <div style={{ fontSize: 12, color: '#6B7488', lineHeight: 1.6 }}>
          <strong style={{ color: '#0E1420' }}>How auto-suspension works:</strong>{' '}
          After each completed booking, the system recalculates the sitter's average rating.
          If it falls below <strong>{form.minRatingSuspension}</strong>, a {form.suspensionDurationDays}-day suspension is issued automatically.
          If the sitter reaches <strong>{form.suspensionsBeforeBan}</strong> suspensions, they are permanently banned and flagged for admin review.
        </div>
      </Card>
    </div>
  );
}

// ─── G2: Role permissions ─────────────────────────────────────────────────────

function RolesSection({ admin }) {
  const { data: admins, refetch } = useAdmins();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doInvite(email) {
    setBusy(true);
    try {
      await inviteAdmin(email, { actor: admin });
      showToast(`${email} promoted to admin`, { tone: 'success' });
      setInviteOpen(false);
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  async function doRevoke(adminUser) {
    if (!confirm(`Revoke admin access for ${adminUser.name}? They will lose access immediately.`)) return;
    setBusy(true);
    try {
      await revokeAdmin(adminUser.id, { actor: admin });
      showToast(`${adminUser.name} removed from admins`, { tone: 'error' });
      refetch();
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={24}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0E1420' }}>Admin accounts</div>
            <div style={{ fontSize: 12, color: '#6B7488', marginTop: 2 }}>{admins.length} admin{admins.length !== 1 ? 's' : ''} with console access</div>
          </div>
          <Btn variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>Add admin</Btn>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {admins.map(a => (
            <div key={a.id} style={{
              padding: '12px 14px', borderRadius: 12,
              background: '#FAFBFD', border: '1px solid #F1F3F8',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <Avatar name={a.name} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0E1420' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: '#9099AD' }}>{a.email} · {a.city}</div>
              </div>
              <div style={{ fontSize: 11, color: '#6B7488' }}>Since {a.joined}</div>
              {a.id !== admin?.id && (
                <Btn variant="danger" size="sm" icon="ban" disabled={busy} onClick={() => doRevoke(a)}>Revoke</Btn>
              )}
              {a.id === admin?.id && (
                <span style={{ fontSize: 11, color: '#0D7377', fontWeight: 700, background: '#E8F8F5', padding: '3px 10px', borderRadius: 99 }}>You</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card padding={20} style={{ background: '#FAFBFD', border: '1px dashed #DDE1EA' }}>
        <div style={{ fontSize: 12, color: '#6B7488', lineHeight: 1.6 }}>
          All admins currently have full access. Role-based permissions (moderator vs. viewer) will be available in v2.
          For now, use the Audit log to track who took which action.
        </div>
      </Card>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={doInvite} busy={busy} />
    </div>
  );
}

// ─── G3: Integrations ─────────────────────────────────────────────────────────

function IntegrationsSection({ admin }) {
  const [testUserId, setTestUserId] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendTestPush() {
    if (!testUserId.trim()) return;
    setBusy(true);
    try {
      await writeAuditLog({
        actor: admin, action: 'opened', entityType: 'PushTest', entityId: testUserId.trim(),
        detail: `Test push notification sent: "${testMsg || 'Test notification from Kido Admin'}"`,
      });
      showToast(`Test notification logged for user ${testUserId.trim().slice(0, 8)}`, { tone: 'info' });
      setTestUserId(''); setTestMsg('');
    } catch (e) {
      showToast(`Failed: ${e.message}`, { tone: 'error' });
    } finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Chargily */}
      <Card padding={24}>
        <SectionHeader title="Chargily — Payment gateway"
          sub="CIB, Edahabia, and CCP card processing for Algeria." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IntegrationRow
            icon="globe" label="Webhook endpoint"
            value="https://kido-admin.vercel.app/api/chargily-webhook"
            hint="Configure this URL in your Chargily dashboard → Webhooks"
            status="info"
          />
          <IntegrationRow
            icon="card" label="Payment methods enabled"
            value="CIB · Edahabia · CCP (24-hour transfer)"
            hint="Visa / Mastercard is disabled per Algerian banking requirements"
            status="ok"
          />
          <div style={{ padding: 12, background: '#FFF4DC', borderRadius: 10, fontSize: 12.5, color: '#B26A00', display: 'flex', gap: 10 }}>
            <Icon name="alert" size={14} stroke="#B26A00" style={{ marginTop: 2, flexShrink: 0 }} />
            The Chargily secret key is stored as a server-side environment variable — never visible in the admin console. Rotate it in Vercel environment settings.
          </div>
        </div>
      </Card>

      {/* Twilio */}
      <Card padding={24}>
        <SectionHeader title="Twilio — Phone OTP"
          sub="SMS verification codes sent on signup." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <IntegrationRow
            icon="phone" label="Phone OTP"
            value="Handled by Supabase Auth + Twilio"
            hint="Configure in Supabase Dashboard → Auth → Providers → Phone"
            status="ok"
          />
          <IntegrationRow
            icon="globe" label="OTP length"
            value="6-digit numeric code · 10-minute expiry"
            hint="Standard Supabase defaults"
            status="ok"
          />
        </div>
      </Card>

      {/* Push notifications */}
      <Card padding={24}>
        <SectionHeader title="Push notifications — Test"
          sub="Send a test notification to any user by their Supabase profile ID." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={LABEL}>Target user ID (Supabase UUID)</label>
            <input value={testUserId} onChange={e => setTestUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>Message (optional)</label>
            <input value={testMsg} onChange={e => setTestMsg(e.target.value)}
              placeholder="Test notification from Kido Admin"
              style={INPUT} />
          </div>
          <Btn variant="secondary" icon="zap" disabled={!testUserId.trim() || busy} onClick={sendTestPush}>
            Send test notification
          </Btn>
          <div style={{ fontSize: 11.5, color: '#9099AD' }}>
            This logs the test notification to the audit log. Real push delivery requires the Expo push token for that user (stored in the mobile app).
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SettingField({ label, hint, value, onChange, type = 'number', min, max, step, suffix }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type={type} value={value} min={min} max={max} step={step}
          onChange={e => onChange(e.target.value)}
          style={{ ...INPUT, width: 90 }}
        />
        {suffix && <span style={{ fontSize: 12.5, color: '#6B7488' }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function IntegrationRow({ icon, label, value, hint, status }) {
  const statusDot = { ok: '#34C759', info: '#0D7377', warn: '#FF9500', error: '#FF3B30' };
  return (
    <div style={{ padding: 14, background: '#F8F9FC', borderRadius: 12, border: '1px solid #F1F3F8' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#E8F8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name={icon} size={15} stroke="#0D7377" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1420' }}>{label}</span>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: statusDot[status] || '#ccc', flexShrink: 0 }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: '#4A5568', wordBreak: 'break-all' }}>{value}</div>
          {hint && <div style={{ fontSize: 11, color: '#9099AD', marginTop: 3 }}>{hint}</div>}
        </div>
      </div>
    </div>
  );
}

function InviteModal({ open, onClose, onInvite, busy }) {
  const [email, setEmail] = useState('');
  useEffect(() => { if (open) setEmail(''); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add new administrator"
      sub="The account must already exist (signed up via the mobile app). Promotion is immediate."
      footer={<>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" disabled={!email.trim() || busy} onClick={() => onInvite(email)}>Promote to admin</Btn>
      </>}>
      <label style={LABEL}>Email address</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="someone@kido.dz" autoFocus style={INPUT} />
      <div style={{ fontSize: 11.5, color: '#9099AD', marginTop: 8 }}>
        Admins can verify sitters, resolve reports, and remove reviews. The action is recorded in the audit log.
      </div>
    </Modal>
  );
}

const LABEL = { display: 'block', fontSize: 11, fontWeight: 700, color: '#4A5568', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 };
const INPUT = { height: 42, padding: '0 14px', border: '1.5px solid #E5E8EF', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', background: '#FAFBFD', outline: 'none', width: '100%', boxSizing: 'border-box' };
