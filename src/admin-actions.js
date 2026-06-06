// Shared admin mutations — every moderation button goes through here.
// Each mutation writes to its primary table AND appends an audit_log row.

import { supabase } from './supabase';

export const isDemoAdmin = (actor) => !actor || actor.id === 'demo';

export class NoRowError extends Error {
  constructor(table, key) { super(`No ${table} row matched ${key} — this might be mock-only data.`); this.name = 'NoRowError'; }
}

// ─── Audit helper ───────────────────────────────────────────────────────────

export async function writeAuditLog({ actor, action, entityType, entityId, detail }) {
  if (isDemoAdmin(actor)) {
    console.info('[demo] would audit:', { action, entityType, entityId, detail });
    return;
  }
  const { error } = await supabase.from('audit_log').insert({
    actor_id:    actor.id,
    actor_name:  actor.first_name ? `${actor.first_name} ${actor.last_name ?? ''}`.trim() : (actor.email || 'Admin'),
    action,
    entity_type: entityType,
    entity_id:   String(entityId),
    detail:      detail || null,
  });
  if (error) console.warn('[admin-actions] audit_log write failed:', error.message);
}

// ─── Verifications ──────────────────────────────────────────────────────────

export async function approveVerification(code, { actor, note } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would approve verification', code); return; }

  const { data, error } = await supabase
    .from('verifications')
    .update({ status: 'approved', reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq('code', code)
    .select('sitter_id');
  if (error) throw error;
  if (!data || data.length === 0) { console.warn('[admin] approveVerification: no row matched', code); }

  // Mark the sitter's profile as identity-verified
  if (data[0]?.sitter_id) {
    await supabase
      .from('profiles')
      .update({ identity_verified: true, profile_photo_verified: true })
      .eq('id', data[0].sitter_id);
  }

  await writeAuditLog({
    actor, action: 'approved', entityType: 'Verification', entityId: code,
    detail: note || 'All documents valid. Sitter promoted to verified.',
  });
  return data[0];
}

export async function rejectVerification(code, { actor, reason } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would reject verification', code); return; }
  const { data, error } = await supabase
    .from('verifications')
    .update({ status: 'rejected', reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq('code', code)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) console.warn('[admin] rejectVerification: no row matched', code);
  await writeAuditLog({
    actor, action: 'rejected', entityType: 'Verification', entityId: code,
    detail: reason || 'Submission rejected — applicant notified.',
  });
}

export async function requestMoreInfoVerification(code, { actor, message }) {
  await writeAuditLog({
    actor, action: 'opened', entityType: 'Verification', entityId: code,
    detail: `Requested more info: ${message}`,
  });
}

// ─── Profile photos ──────────────────────────────────────────────────────────

export async function approveProfilePhoto(userId, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would approve profile photo', userId); return; }
  const { error } = await supabase
    .from('profiles')
    .update({ profile_photo_verified: true })
    .eq('id', userId);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'approved', entityType: 'ProfilePhoto', entityId: userId.slice(0, 8),
    detail: 'Profile photo approved by admin.',
  });
}

export async function rejectProfilePhoto(userId, { reason, actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would reject profile photo', userId); return; }
  const { error } = await supabase
    .from('profiles')
    .update({ photo_url: null, profile_photo_verified: false })
    .eq('id', userId);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'removed', entityType: 'ProfilePhoto', entityId: userId.slice(0, 8),
    detail: reason ? `Photo removed: ${reason}` : 'Photo removed — sitter asked to re-upload.',
  });
}

// ─── Reports ────────────────────────────────────────────────────────────────

export async function decideReport(code, decision, { actor, targetId, notes } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would decide report', code, decision); return; }
  const newStatus = decision === 'dismissed' ? 'closed' : 'resolved';
  const { data, error } = await supabase
    .from('reports')
    .update({ status: newStatus, resolved_at: new Date().toISOString() })
    .eq('code', code)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) console.warn('[admin] decideReport: no row matched', code);
  await writeAuditLog({
    actor, action: decision, entityType: 'Report', entityId: code,
    detail: notes || `Report ${decision}.`,
  });
}

// ─── Users — suspend / lift / ban / lift ban ─────────────────────────────────

export async function suspendUser(userId, { durationDays = 7, reason, triggeredBy = 'manual', actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would suspend user', userId); return; }

  // Insert suspension record
  const { data: suspData, error: suspErr } = await supabase
    .from('suspensions')
    .insert({
      user_id:      userId,
      reason:       reason || 'Suspended by admin',
      duration_days: durationDays,
      triggered_by: triggeredBy,
      admin_id:     actor.id,
      is_active:    true,
    })
    .select('id');
  if (suspErr) throw suspErr;

  // Update profile flags
  const { error: profErr } = await supabase
    .from('profiles')
    .update({
      is_suspended:    true,
      suspension_count: supabase.rpc ? undefined : undefined, // incremented via DB below
    })
    .eq('id', userId);
  if (profErr) throw profErr;

  // Increment suspension_count
  await supabase.rpc('increment_suspension_count', { target_id: userId }).catch(() => {
    // If RPC doesn't exist, do it manually
    supabase.from('profiles').select('suspension_count').eq('id', userId).single()
      .then(({ data }) => {
        if (data) supabase.from('profiles').update({ suspension_count: (data.suspension_count || 0) + 1 }).eq('id', userId);
      });
  });

  await writeAuditLog({
    actor, action: 'suspended', entityType: 'Profile', entityId: userId.slice(0, 8),
    detail: `${durationDays}-day suspension. Reason: ${reason || 'manual'}. Triggered by: ${triggeredBy}.`,
  });
  return suspData?.[0];
}

export async function liftSuspension(suspensionId, { userId, note, actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would lift suspension', suspensionId); return; }

  const now = new Date().toISOString();
  const { error: suspErr } = await supabase
    .from('suspensions')
    .update({ lifted_at: now, is_active: false })
    .eq('id', suspensionId);
  if (suspErr) throw suspErr;

  if (userId) {
    await supabase.from('profiles').update({ is_suspended: false }).eq('id', userId);
  }

  await writeAuditLog({
    actor, action: 'opened', entityType: 'Suspension', entityId: suspensionId,
    detail: note || 'Suspension lifted manually by admin.',
  });
}

export async function banUser(userId, { reason, actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would ban user', userId); return; }
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: true, is_suspended: false })
    .eq('id', userId);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'banned', entityType: 'Profile', entityId: userId.slice(0, 8),
    detail: reason || 'Account permanently banned.',
  });
}

export async function liftBan(userId, { note, actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would lift ban', userId); return; }
  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: false })
    .eq('id', userId);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'approved', entityType: 'Profile', entityId: userId.slice(0, 8),
    detail: note || 'Ban lifted by admin.',
  });
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export async function keepReview(id, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would keep review', id); return; }
  const numericId = Number(String(id).replace(/^RV-0*/, ''));
  const { data, error } = await supabase.from('reviews').update({ is_flagged: false }).eq('id', numericId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) console.warn('[admin] keepReview: no row matched', id, '(mock data)');
  await writeAuditLog({
    actor, action: 'closed', entityType: 'Review', entityId: id,
    detail: 'Review kept — flag dismissed.',
  });
}

export async function removeReview(id, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would remove review', id); return; }
  const numericId = Number(String(id).replace(/^RV-0*/, ''));
  const { data, error } = await supabase.from('reviews').delete().eq('id', numericId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) console.warn('[admin] removeReview: no row matched', id, '(mock data)');
  await writeAuditLog({
    actor, action: 'removed', entityType: 'Review', entityId: id,
    detail: 'Review removed for violating content rules.',
  });
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export async function cancelBooking(id, { actor, reason } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would cancel booking', id); return; }
  const numericId = Number(String(id).replace(/^#0*/, ''));
  const { data, error } = await supabase.from('bookings').update({ status: 'CANCELLED' }).eq('id', numericId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) console.warn('[admin] cancelBooking: no row matched', id, '(mock data)');
  await writeAuditLog({
    actor, action: 'closed', entityType: 'Booking', entityId: id,
    detail: reason || 'Booking cancelled by moderator.',
  });
}

// ─── Transactions ────────────────────────────────────────────────────────────

export async function markTransferCompleted(rawId, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would mark transfer complete', rawId); return; }
  const { data, error } = await supabase
    .from('transactions')
    .update({ status: 'completed', transferred_at: new Date().toISOString() })
    .eq('id', rawId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) console.warn('[admin] markTransferCompleted: no row matched', rawId, '(mock data)');
  await writeAuditLog({
    actor, action: 'closed', entityType: 'Transaction', entityId: rawId.slice(0, 8),
    detail: 'Cash payment confirmed as transferred by admin.',
  });
}

// ─── Admin settings ──────────────────────────────────────────────────────────

export async function saveAdminSettings(settings, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would save settings', settings); return; }
  const now = new Date().toISOString();
  const rows = [
    { key: 'min_rating_suspension',    value: String(settings.minRatingSuspension) },
    { key: 'suspensions_before_ban',   value: String(settings.suspensionsBeforeBan) },
    { key: 'suspension_duration_days', value: String(settings.suspensionDurationDays) },
    { key: 'credential_block_months',  value: String(settings.credentialBlockMonths) },
    { key: 'reactivation_window_hours', value: String(settings.reactivationWindowHours) },
  ].map(r => ({ ...r, updated_by: actor.id, updated_at: now }));

  for (const row of rows) {
    const { error } = await supabase
      .from('admin_settings')
      .upsert(row, { onConflict: 'key' });
    if (error) throw error;
  }
  await writeAuditLog({
    actor, action: 'opened', entityType: 'Settings', entityId: 'admin_settings',
    detail: `Settings updated: min_rating=${settings.minRatingSuspension}, ban_limit=${settings.suspensionsBeforeBan}, suspension_days=${settings.suspensionDurationDays}`,
  });
}

// ─── Deleted accounts ─────────────────────────────────────────────────────────

export async function unblockDeletedAccount(id, { note, actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would unblock deleted account', id); return; }
  const { error } = await supabase
    .from('deleted_accounts')
    .update({
      credential_block_until: new Date().toISOString(),
      admin_note: note || 'Manually unblocked by admin.',
    })
    .eq('id', id);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'approved', entityType: 'DeletedAccount', entityId: id,
    detail: note || 'Credential block lifted early by admin.',
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function inviteAdmin(email, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would promote', email, 'to admin'); return { email, invited: false }; }
  const cleanEmail = email.toLowerCase().trim();

  // ── Phase 1: promote an existing profile directly ─────────────────────
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('email', cleanEmail)
    .select('id, email');
  if (error) throw error;

  if (data && data.length > 0) {
    await writeAuditLog({
      actor, action: 'approved', entityType: 'Profile', entityId: data[0].id.slice(0, 8),
      detail: `${cleanEmail} promoted to admin.`,
    });
    return { ...data[0], invited: false };
  }

  // ── Phase 2: no profile found — store pending invite + send magic link ─
  // Requires the admin-invite-migration.sql to have been run first.
  const { error: pendingErr } = await supabase
    .from('pending_admin_invites')
    .upsert({ email: cleanEmail, invited_by: actor.id }, { onConflict: 'email' });
  if (pendingErr) {
    // Pending invite table not set up — fall back to a clear message
    throw new Error(`No account found for "${cleanEmail}". Ask them to sign up in the Kido app first, then try again.`);
  }

  // Send a sign-up / magic-link email so they can create their account
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email: cleanEmail,
    options: { shouldCreateUser: true },
  });
  if (otpErr) throw new Error('Pending invite stored, but email delivery failed: ' + otpErr.message);

  await writeAuditLog({
    actor, action: 'opened', entityType: 'Profile', entityId: 'pending',
    detail: `Admin invite sent to ${cleanEmail} — will be auto-promoted on first sign-in.`,
  });
  return { email: cleanEmail, invited: true };
}

export async function revokeAdmin(userId, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would revoke admin', userId); return; }
  const { error } = await supabase.from('profiles').update({ role: 'parent' }).eq('id', userId);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'removed', entityType: 'Profile', entityId: userId.slice(0, 8),
    detail: 'Admin access revoked.',
  });
}

// ─── Notifications ───────────────────────────────────────────────────────────

export async function sendNotification(userId, { title, message, type = 'SYSTEM', actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] would notify', userId, { title, message, type }); return; }
  if (!userId) { console.warn('[admin] sendNotification: no userId'); return; }

  const { error } = await supabase.from('notifications').insert({
    user_id: userId, 
    title, 
    message,
    type: 'SYSTEM',
    data: { sent_by: actor.id },
  });
  if (error) throw error;

  // Also trigger a real push notification to the device
  await supabase.functions.invoke('send-push-notification', {
    body: { user_id: userId, title, message, data: {} },
  });

  await writeAuditLog({
    actor, action: 'opened', entityType: 'Notification', entityId: userId.slice(0, 8),
    detail: `[SYSTEM] "${title}" — ${message.slice(0, 80)}`,
  });
}

// ─── Auto-moderation rules ───────────────────────────────────────────────────

export async function createAutoRule({ trigger, value, action }, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] create rule', { trigger, value, action }); return { id: Date.now() }; }
  const { data, error } = await supabase
    .from('moderation_rules')
    .insert({ trigger, value, action, created_by: actor.id })
    .select('id');
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'opened', entityType: 'ModerationRule', entityId: String(data[0]?.id || ''),
    detail: `Auto-rule: ${trigger} "${value}" → ${action}`,
  });
  return data[0];
}

export async function deleteAutoRule(id, { actor } = {}) {
  if (isDemoAdmin(actor)) { console.info('[demo] delete rule', id); return; }
  const { error } = await supabase
    .from('moderation_rules')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
  await writeAuditLog({
    actor, action: 'removed', entityType: 'ModerationRule', entityId: String(id),
    detail: 'Auto-moderation rule disabled by admin.',
  });
}

// ─── CSV export helper ──────────────────────────────────────────────────────

export function downloadCSV(rows, filename) {
  if (!rows || rows.length === 0) { alert('No rows to export.'); return; }
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}