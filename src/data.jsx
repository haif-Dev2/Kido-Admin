import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

// Sample data for Kido Admin Console.
// Algerian names + DZD pricing per the Kido brief.

export const ADMIN = { name: 'Henni Fouad', role: 'Admin · Mostaganem', initial: 'H', avatarBg: '#0D7377' };

// ---------- KPIs ----------
export const KPI_DATA = {
  users:         { label: 'Total users',          value: 4287, delta: '+128 this week',  trend: 'up',   accent: 'teal',  spark: [40, 44, 41, 47, 50, 56, 61, 65, 72, 78, 84, 92] },
  bookings:      { label: 'Active bookings',      value: 184,  delta: '+12% vs last wk',  trend: 'up',   accent: 'mint',  spark: [22, 28, 24, 31, 36, 33, 40, 44, 41, 48, 52, 56] },
  pendingVerif:  { label: 'Pending verifications',value: 23,   delta: '5 added today',    trend: 'flat', accent: 'amber', spark: [18, 19, 22, 21, 20, 24, 26, 25, 23, 24, 22, 23] },
  openReports:   { label: 'Open reports',         value: 7,    delta: '2 critical',       trend: 'up',   accent: 'coral', spark: [3, 2, 4, 5, 4, 6, 5, 4, 6, 7, 5, 7] },
};

// ---------- Bookings over last 14 days ----------
export const BOOKINGS_TREND = [
  { d: 'Apr 27', count: 142 }, { d: 'Apr 28', count: 156 }, { d: 'Apr 29', count: 138 },
  { d: 'Apr 30', count: 161 }, { d: 'May 01', count: 174 }, { d: 'May 02', count: 198 },
  { d: 'May 03', count: 220 }, { d: 'May 04', count: 184 }, { d: 'May 05', count: 178 },
  { d: 'May 06', count: 192 }, { d: 'May 07', count: 207 }, { d: 'May 08', count: 233 },
  { d: 'May 09', count: 251 }, { d: 'May 10', count: 184 },
];

// ---------- Reports queue ----------
export const REPORTS = [
  { id: 'R-3127', priority: 'critical', reason: 'Inappropriate behavior',  reporter: 'Yasmine Benali',     reporterRole: 'Parent',   target: 'Reda Bouzid',     targetRole: 'Babysitter', count: 3, opened: '2 hours ago',  status: 'open',         evidence: 'Chat thread + 1 review', notes: 'Three independent parents reported the same sitter within 24 hours. Conversation contains warning signs.' },
  { id: 'R-3126', priority: 'critical', reason: 'No-show twice in a row',  reporter: 'Amira Saadi',        reporterRole: 'Parent',   target: 'Sofiane Talbi',   targetRole: 'Babysitter', count: 2, opened: '5 hours ago',  status: 'open',         evidence: 'Booking history',         notes: 'Pattern of cancellations under 30 minutes before booking start.' },
  { id: 'R-3124', priority: 'high',     reason: 'Misleading profile',       reporter: 'Imane Daoud',        reporterRole: 'Parent',   target: 'Khadija Ammar',   targetRole: 'Babysitter', count: 1, opened: '1 day ago',    status: 'investigating', evidence: 'Profile screenshot',     notes: 'Reporter claims experience years and certifications do not match reality.' },
  { id: 'R-3122', priority: 'high',     reason: 'Inappropriate review',     reporter: 'Lina Messaoudi',     reporterRole: 'Babysitter', target: 'Parent #P-7841', targetRole: 'Parent',     count: 1, opened: '1 day ago',    status: 'open',         evidence: 'Review #RV-1029',         notes: 'Review contains personal attack unrelated to the service.' },
  { id: 'R-3119', priority: 'medium',   reason: 'Spam messages',            reporter: 'Sarah Khodja',       reporterRole: 'Parent',   target: 'Account #A-2014', targetRole: 'Parent',     count: 4, opened: '2 days ago',   status: 'open',         evidence: '12 messages',             notes: 'User sending bulk promotional messages to multiple sitters.' },
  { id: 'R-3115', priority: 'low',      reason: 'Photo not own face',       reporter: 'Auto-moderation',    reporterRole: 'System',   target: 'Account #A-1840', targetRole: 'Babysitter', count: 1, opened: '3 days ago',   status: 'investigating', evidence: 'ID + selfie mismatch',   notes: 'ML similarity below threshold.' },
  { id: 'R-3110', priority: 'medium',   reason: 'Repeated cancellations',   reporter: 'System',             reporterRole: 'System',   target: 'Nour Hadji',      targetRole: 'Babysitter', count: 5, opened: '4 days ago',   status: 'open',         evidence: 'Booking history',         notes: '5 cancellations in 14 days exceeds threshold (3).' },
];

// ---------- Verification queue ----------
export const VERIFICATIONS = [
  { id: 'V-481', name: 'Sarah Khodja',     city: 'Algiers, Hydra',         submitted: '12 min ago',   exp: '5+ years',   age: 27, idType: 'National ID',  selfie: true,  cv: true,  refs: 2, score: 92, initial: 'S', tint: '#0D7377', bg0: '#D9F1F2', bg1: '#FFE4EB', email: 'sarah.k@example.dz', phone: '+213 555 12 34 56', bio: 'Pediatric nursing student. Two years of family-friend childcare. Comfortable with infants up to 8-year-olds. CPR certified through Red Crescent.', priceHr: 350, languages: ['Arabic', 'French', 'English'], certifications: ['CPR — Red Crescent', 'First Aid Level 2'] },
  { id: 'V-480', name: 'Imane Daoud',      city: 'Oran, Bir El Djir',      submitted: '34 min ago',   exp: '3–5 years',  age: 24, idType: 'National ID',  selfie: true,  cv: false, refs: 1, score: 78, initial: 'I', tint: '#FF6B8A', bg0: '#FFE4EB', bg1: '#FFF4DC', email: 'imane.d@example.dz', phone: '+213 555 87 65 43', bio: 'Three years babysitting in Oran neighborhoods. Currently studying primary education.', priceHr: 280, languages: ['Arabic', 'French'], certifications: [] },
  { id: 'V-479', name: 'Sofiane Talbi',    city: 'Constantine',            submitted: '1 hour ago',   exp: '1–2 years',  age: 22, idType: 'National ID',  selfie: false, cv: true,  refs: 0, score: 54, initial: 'S', tint: '#B26A00', bg0: '#FFF4DC', bg1: '#D9F1F2', email: 'sofiane.t@example.dz', phone: '+213 555 11 22 33', bio: 'Engineering student looking for evening shifts.', priceHr: 200, languages: ['Arabic', 'French'], certifications: [] },
  { id: 'V-478', name: 'Khadija Ammar',    city: 'Algiers, El Biar',       submitted: '2 hours ago',  exp: '5+ years',   age: 31, idType: 'Passport',     selfie: true,  cv: true,  refs: 3, score: 96, initial: 'K', tint: '#1F8A4E', bg0: '#DCF5E4', bg1: '#D9F1F2', email: 'khadija.a@example.dz', phone: '+213 555 44 55 66', bio: 'Eight years of professional childcare. Worked with three families long-term.', priceHr: 400, languages: ['Arabic', 'French', 'English'], certifications: ['CPR', 'Childcare Diploma'] },
  { id: 'V-477', name: 'Meriem Boutella',  city: 'Algiers, Bab El Oued',   submitted: '3 hours ago',  exp: '3–5 years',  age: 26, idType: 'National ID',  selfie: true,  cv: true,  refs: 2, score: 88, initial: 'M', tint: '#5347D6', bg0: '#E7E6FD', bg1: '#FFE4EB', email: 'meriem.b@example.dz', phone: '+213 555 77 88 99', bio: 'Calm with toddlers. Available weekends and weekday afternoons.', priceHr: 300, languages: ['Arabic', 'French'], certifications: ['First Aid'] },
  { id: 'V-476', name: 'Reda Bouzid',      city: 'Algiers, Kouba',         submitted: '4 hours ago',  exp: '< 1 year',   age: 21, idType: 'National ID',  selfie: true,  cv: false, refs: 0, score: 38, initial: 'R', tint: '#C8324A', bg0: '#FFE0E4', bg1: '#FFF4DC', email: 'reda.b@example.dz', phone: '+213 555 33 22 11', bio: 'Looking for first babysitting job.', priceHr: 150, languages: ['Arabic'], certifications: [] },
];

// ---------- Users (parents + babysitters) ----------
export const USERS = [
  { id: 'U-7841', name: 'Yasmine Benali',    role: 'parent',  joined: '12 Mar 2026', city: 'Algiers',     bookings: 14, status: 'active',     verified: true,  rating: 4.9, initial: 'Y' },
  { id: 'U-7822', name: 'Amina Khelifi',     role: 'sitter',  joined: '02 Jan 2026', city: 'Algiers',     bookings: 48, status: 'active',     verified: true,  rating: 4.9, initial: 'A' },
  { id: 'U-7800', name: 'Amira Saadi',       role: 'parent',  joined: '04 Feb 2026', city: 'Algiers',     bookings: 7,  status: 'active',     verified: true,  rating: 4.7, initial: 'A' },
  { id: 'U-7790', name: 'Fatima Zerrouki',   role: 'sitter',  joined: '15 Nov 2025', city: 'Algiers',     bookings: 56, status: 'active',     verified: true,  rating: 4.8, initial: 'F' },
  { id: 'U-7755', name: 'Nour Hadji',        role: 'sitter',  joined: '21 Apr 2026', city: 'Algiers',     bookings: 19, status: 'warned',     verified: false, rating: 4.2, initial: 'N' },
  { id: 'U-7720', name: 'Reda Bouzid',       role: 'sitter',  joined: '02 May 2026', city: 'Algiers',     bookings: 4,  status: 'suspended',  verified: false, rating: 3.1, initial: 'R' },
  { id: 'U-7711', name: 'Lina Messaoudi',    role: 'sitter',  joined: '08 Dec 2025', city: 'Algiers',     bookings: 12, status: 'active',     verified: true,  rating: 5.0, initial: 'L' },
  { id: 'U-7700', name: 'Sofiane Talbi',     role: 'sitter',  joined: '30 Apr 2026', city: 'Constantine', bookings: 6,  status: 'pending',    verified: false, rating: 4.0, initial: 'S' },
  { id: 'U-7689', name: 'Imane Daoud',       role: 'parent',  joined: '11 Mar 2026', city: 'Oran',        bookings: 9,  status: 'active',     verified: true,  rating: 4.8, initial: 'I' },
  { id: 'U-7651', name: 'Sarah Khodja',      role: 'parent',  joined: '03 Apr 2026', city: 'Algiers',     bookings: 3,  status: 'active',     verified: true,  rating: 4.9, initial: 'S' },
  { id: 'U-7620', name: 'Meriem Boutella',   role: 'sitter',  joined: '18 Apr 2026', city: 'Algiers',     bookings: 11, status: 'pending',    verified: false, rating: 4.6, initial: 'M' },
  { id: 'U-7588', name: 'Khadija Ammar',     role: 'sitter',  joined: '07 Feb 2026', city: 'Algiers',     bookings: 33, status: 'active',     verified: true,  rating: 4.9, initial: 'K' },
  { id: 'U-7540', name: 'Account #A-2014',   role: 'parent',  joined: '01 May 2026', city: 'Algiers',     bookings: 0,  status: 'banned',     verified: false, rating: 0,   initial: '?' },
];

// ---------- Bookings oversight ----------
export const BOOKINGS = [
  { id: '#328-047', parent: 'Yasmine Benali',  sitter: 'Amina Khelifi',    when: 'Today, 19:00 – 23:00',     duration: '4h', amount: 1000, status: 'pending',   flag: null,           city: 'Hydra' },
  { id: '#328-046', parent: 'Imane Daoud',     sitter: 'Khadija Ammar',    when: 'Today, 14:00 – 18:00',     duration: '4h', amount: 1600, status: 'confirmed', flag: null,           city: 'El Biar' },
  { id: '#327-029', parent: 'Sarah Khodja',    sitter: 'Lina Messaoudi',   when: 'Yesterday, 10:00 – 14:00', duration: '4h', amount: 1400, status: 'completed', flag: null,           city: 'Hydra' },
  { id: '#327-018', parent: 'Amira Saadi',     sitter: 'Sofiane Talbi',    when: 'Yesterday, 16:00 – 20:00', duration: '4h', amount: 800,  status: 'cancelled', flag: 'no-show',      city: 'Constantine' },
  { id: '#326-117', parent: 'Yasmine Benali',  sitter: 'Reda Bouzid',      when: '2 days ago',               duration: '3h', amount: 600,  status: 'cancelled', flag: 'disputed',     city: 'Kouba' },
  { id: '#326-104', parent: 'Imane Daoud',     sitter: 'Fatima Zerrouki',  when: '2 days ago',               duration: '5h', amount: 1500, status: 'completed', flag: null,           city: 'Oran' },
  { id: '#325-088', parent: 'Sarah Khodja',    sitter: 'Amina Khelifi',    when: '3 days ago',               duration: '4h', amount: 1000, status: 'completed', flag: null,           city: 'Hydra' },
  { id: '#325-076', parent: 'Amira Saadi',     sitter: 'Nour Hadji',       when: '3 days ago',               duration: '4h', amount: 720,  status: 'cancelled', flag: 'late-cancel',  city: 'Bir Mourad Rais' },
];

// ---------- Reviews moderation ----------
export const FLAGGED_REVIEWS = [
  { id: 'RV-1029', author: 'Account #A-2014', target: 'Lina Messaoudi',   stars: 1, when: '3 hours ago',  reason: 'Personal attack', text: 'She thinks she is too good for honest work and her family is not even from Algiers. Avoid at all costs.', flagged_by: 2 },
  { id: 'RV-1027', author: 'Yasmine Benali',  target: 'Reda Bouzid',      stars: 1, when: '1 day ago',    reason: 'Verified incident', text: 'Did not show up at the agreed time and did not respond. We had to cancel our evening last minute.', flagged_by: 1 },
  { id: 'RV-1019', author: 'Sarah Khodja',    target: 'Amina Khelifi',    stars: 5, when: '2 days ago',   reason: 'Possible self-promo', text: 'Best sitter ever, you can also book me at @sarahkido_sitter on Insta for cheaper rates!', flagged_by: 1 },
];

// ---------- Audit log ----------
export const AUDIT_LOG = [
  { id: 'L-9201', when: 'Just now',         actor: 'Henni Fouad', action: 'opened',     entity: 'Report R-3127',                 detail: 'Investigation started.' },
  { id: 'L-9200', when: '12 min ago',       actor: 'Henni Fouad', action: 'approved',   entity: 'Verification V-478 — Khadija Ammar', detail: 'All documents valid. Sitter promoted to verified.' },
  { id: 'L-9199', when: '1 hour ago',       actor: 'Henni Fouad', action: 'suspended',  entity: 'Sitter @reda-b',                detail: '7-day suspension following report R-3127.' },
  { id: 'L-9198', when: '2 hours ago',      actor: 'Henni Fouad', action: 'removed',    entity: 'Review RV-1015',                detail: 'Offensive language. Notified author.' },
  { id: 'L-9197', when: '3 hours ago',      actor: 'System',      action: 'auto-flagged', entity: 'Account A-1840',              detail: 'Selfie / ID similarity below threshold (0.41).' },
  { id: 'L-9196', when: 'Yesterday, 18:42', actor: 'Henni Fouad', action: 'warned',     entity: 'Sitter @nour-h',                detail: 'Repeated cancellations notice sent.' },
  { id: 'L-9195', when: 'Yesterday, 16:11', actor: 'Henni Fouad', action: 'rejected',   entity: 'Verification V-470 — anonymous', detail: 'ID document not legible after 2nd attempt.' },
  { id: 'L-9194', when: 'Yesterday, 12:03', actor: 'Henni Fouad', action: 'approved',   entity: 'Verification V-469 — Lina Messaoudi', detail: 'All documents valid.' },
  { id: 'L-9193', when: '2 days ago',       actor: 'Henni Fouad', action: 'banned',     entity: 'Account A-2014',                detail: 'Repeated abusive reviews. Permanent ban.' },
  { id: 'L-9192', when: '2 days ago',       actor: 'System',      action: 'closed',     entity: 'Report R-3098',                 detail: 'Auto-resolved after 7 days without dispute.' },
];

// ---------- Cities (for filters) ----------
export const CITIES = ['All cities', 'Algiers', 'Oran', 'Constantine', 'Annaba', 'Mostaganem'];

// ---------- Transactions (payments) ----------
export const TRANSACTIONS = [
  { id: 'TXN-A1B2C3', rawId: 'a1b2c3d4-0000-0000-0000-000000000001', bookingId: '#328-047', parentName: 'Yasmine Benali', sitterName: 'Amina Khelifi',    amount: 1000, method: 'edahabia', status: 'completed', when: '31 May 2026', whenRaw: '2026-05-31T18:00:00Z', transferredAt: '31 May 2026', chargilyId: 'ch_abc123', isCcpPending24h: false },
  { id: 'TXN-D4E5F6', rawId: 'a1b2c3d4-0000-0000-0000-000000000002', bookingId: '#328-046', parentName: 'Imane Daoud',    sitterName: 'Khadija Ammar',    amount: 1600, method: 'cib',      status: 'completed', when: '31 May 2026', whenRaw: '2026-05-31T14:00:00Z', transferredAt: '31 May 2026', chargilyId: 'ch_def456', isCcpPending24h: false },
  { id: 'TXN-G7H8I9', rawId: 'a1b2c3d4-0000-0000-0000-000000000003', bookingId: '#327-029', parentName: 'Sarah Khodja',   sitterName: 'Lina Messaoudi',   amount: 1400, method: 'cash',     status: 'pending',   when: '30 May 2026', whenRaw: '2026-05-30T10:00:00Z', transferredAt: null,          chargilyId: null,        isCcpPending24h: false },
  { id: 'TXN-J1K2L3', rawId: 'a1b2c3d4-0000-0000-0000-000000000004', bookingId: '#327-018', parentName: 'Amira Saadi',    sitterName: 'Sofiane Talbi',    amount: 800,  method: 'ccp',      status: 'pending',   when: '29 May 2026', whenRaw: '2026-05-29T16:00:00Z', transferredAt: null,          chargilyId: null,        isCcpPending24h: true  },
  { id: 'TXN-M4N5O6', rawId: 'a1b2c3d4-0000-0000-0000-000000000005', bookingId: '#326-117', parentName: 'Yasmine Benali', sitterName: 'Reda Bouzid',      amount: 600,  method: 'edahabia', status: 'failed',    when: '29 May 2026', whenRaw: '2026-05-29T09:00:00Z', transferredAt: null,          chargilyId: 'ch_ghi789', isCcpPending24h: false },
  { id: 'TXN-P7Q8R9', rawId: 'a1b2c3d4-0000-0000-0000-000000000006', bookingId: '#326-104', parentName: 'Imane Daoud',    sitterName: 'Fatima Zerrouki',  amount: 1500, method: 'edahabia', status: 'completed', when: '28 May 2026', whenRaw: '2026-05-28T14:00:00Z', transferredAt: '28 May 2026', chargilyId: 'ch_jkl012', isCcpPending24h: false },
  { id: 'TXN-S1T2U3', rawId: 'a1b2c3d4-0000-0000-0000-000000000007', bookingId: '#325-088', parentName: 'Sarah Khodja',   sitterName: 'Amina Khelifi',    amount: 1000, method: 'cash',     status: 'pending',   when: '28 May 2026', whenRaw: '2026-05-28T09:00:00Z', transferredAt: null,          chargilyId: null,        isCcpPending24h: false },
  { id: 'TXN-V4W5X6', rawId: 'a1b2c3d4-0000-0000-0000-000000000008', bookingId: '#325-076', parentName: 'Amira Saadi',    sitterName: 'Nour Hadji',       amount: 720,  method: 'ccp',      status: 'refunded',  when: '28 May 2026', whenRaw: '2026-05-28T08:00:00Z', transferredAt: null,          chargilyId: null,        isCcpPending24h: false },
];

// ---------- Suspensions ----------
export const SUSPENSIONS = [
  { id: 'susp-0001', userId: 'U-7720', userName: 'Reda Bouzid',   userRole: 'sitter', reason: 'Low rating (3.1 avg — dropped below threshold)',    suspendedAt: '29 May 2026', liftedAt: null,           durationDays: 7,  liftDate: '05 Jun 2026', triggeredBy: 'auto:low_rating', isActive: true  },
  { id: 'susp-0002', userId: 'U-7755', userName: 'Nour Hadji',    userRole: 'sitter', reason: 'Repeated cancellations (5 in 14 days)',              suspendedAt: '27 May 2026', liftedAt: '28 May 2026',  durationDays: 1,  liftDate: '28 May 2026', triggeredBy: 'manual',          isActive: false },
  { id: 'susp-0003', userId: 'U-7700', userName: 'Sofiane Talbi', userRole: 'sitter', reason: 'No-show twice in a row — report R-3126 escalated',   suspendedAt: '28 May 2026', liftedAt: null,           durationDays: 7,  liftDate: '04 Jun 2026', triggeredBy: 'report:R-3126',   isActive: true  },
];

// ---------- Deleted accounts ----------
export const DELETED_ACCOUNTS = [
  { id: 'del-0001', email: 'karim.b@example.dz',   phone: '+213 555 00 11 22', deletedAt: '31 May 2026', deletedAtRaw: '2026-05-31T10:00:00Z', reactivationDeadline: '03 Jun 2026', reactivationDeadlineRaw: '2026-06-03T10:00:00Z', credentialBlockUntil: '01 Oct 2026', credentialBlockUntilRaw: '2026-10-01T10:00:00Z', wasReactivated: false, adminNote: null,                          windowStatus: 'active'  },
  { id: 'del-0002', email: 'lydia.m@example.dz',   phone: '+213 555 33 44 55', deletedAt: '27 May 2026', deletedAtRaw: '2026-05-27T08:00:00Z', reactivationDeadline: '30 May 2026', reactivationDeadlineRaw: '2026-05-30T08:00:00Z', credentialBlockUntil: '27 Sep 2026', credentialBlockUntilRaw: '2026-09-27T08:00:00Z', wasReactivated: false, adminNote: null,                          windowStatus: 'blocked' },
  { id: 'del-0003', email: 'rachid.o@example.dz',  phone: null,               deletedAt: '15 Apr 2026', deletedAtRaw: '2026-04-15T12:00:00Z', reactivationDeadline: '18 Apr 2026', reactivationDeadlineRaw: '2026-04-18T12:00:00Z', credentialBlockUntil: '15 Aug 2026', credentialBlockUntilRaw: '2026-08-15T12:00:00Z', wasReactivated: true,  adminNote: 'Manually reactivated on request.', windowStatus: 'blocked' },
];

// ---------- Admin settings ----------
export const ADMIN_SETTINGS = {
  minRatingSuspension:    3.0,
  suspensionsBeforeBan:   3,
  suspensionDurationDays: 7,
  credentialBlockMonths:  4,
  reactivationWindowHours: 72,
};

// ---------- Auto-moderation rules ----------
export const MODERATION_RULES = [
  { id: 1, trigger: 'keyword', value: 'cash only',     action: 'flag',    created_at: '2026-05-28', is_active: true },
  { id: 2, trigger: 'reports', value: '3',             action: 'suspend', created_at: '2026-05-20', is_active: true },
  { id: 3, trigger: 'rating',  value: '2',             action: 'flag',    created_at: '2026-05-15', is_active: true },
];

// ---------- Flagged profile photos ----------
export const FLAGGED_PHOTOS = [
  { id: 'fp-001', name: 'Nour Hadji',      city: 'Algiers',     email: 'nour.h@example.dz',    photoUrl: null, initial: 'N' },
  { id: 'fp-002', name: 'Meriem Boutella', city: 'Algiers',     email: 'meriem.b@example.dz',  photoUrl: null, initial: 'M' },
  { id: 'fp-003', name: 'Sofiane Talbi',   city: 'Constantine', email: 'sofiane.t@example.dz', photoUrl: null, initial: 'S' },
];

// ---------- Sitter earnings (for Transactions page) ----------
export const SITTER_EARNINGS = [
  { id: 'e1', name: 'Amina Khelifi',   totalEarned: 8400, pending: 1000, completed: 7400, methods: { edahabia: 5000, cash: 2400, ccp: 1000 } },
  { id: 'e2', name: 'Fatima Zerrouki', totalEarned: 6200, pending: 0,    completed: 6200, methods: { edahabia: 4000, cib: 2200 } },
  { id: 'e3', name: 'Lina Messaoudi',  totalEarned: 4800, pending: 1400, completed: 3400, methods: { cash: 2800, edahabia: 2000 } },
  { id: 'e4', name: 'Khadija Ammar',   totalEarned: 9600, pending: 0,    completed: 9600, methods: { cib: 6000, edahabia: 3600 } },
];


