import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';

// Lucide-style 2px stroke icons. Round caps + joins.
// Single component, by-name registry. Exports to window.

export function Icon({ name, size = 20, stroke = 'currentColor', fill = 'none', strokeWidth = 2, style }) {
  const p = ICON_PATHS[name];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size}
      fill={fill} stroke={stroke} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, ...style }}>
      {p}
    </svg>
  );
}

export const ICON_PATHS = {
  // Brand glyph (Kido teardrop child)
  logo:       (<><path d="M12 3c4 4 6 7 6 10a6 6 0 11-12 0c0-3 2-6 6-10z"/><circle cx="10.5" cy="12.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="13.5" cy="12.5" r="1.1" fill="currentColor" stroke="none"/><path d="M10.5 15.2c.7.5 2.3.5 3 0"/></>),
  // Nav
  grid:       (<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>),
  shield:     (<><path d="M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></>),
  flag:       (<><path d="M4 21V4"/><path d="M4 4h13l-2 4 2 4H4"/></>),
  users:      (<><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.9"/><path d="M16 3.1a4 4 0 010 7.8"/></>),
  calendar:   (<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>),
  star:       (<><polygon points="12 2 15 9 22 9.5 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.5 9 9 12 2"/></>),
  fileLog:    (<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></>),
  settings:   (<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3h.1a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8v.1a1.6 1.6 0 001.5 1H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></>),
  // UI
  search:     (<><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>),
  bell:       (<><path d="M18 16V11a6 6 0 10-12 0v5l-2 3h16l-2-3z"/><path d="M10 20a2 2 0 004 0"/></>),
  filter:     (<><path d="M4 6h16M7 12h10M10 18h4"/></>),
  download:   (<><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></>),
  upload:     (<><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></>),
  plus:       (<><path d="M12 5v14M5 12h14"/></>),
  more:       (<><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/></>),
  chevron:    (<><path d="M9 18l6-6-6-6"/></>),
  chevronD:   (<><path d="M6 9l6 6 6-6"/></>),
  arrowR:     (<><path d="M5 12h14M13 5l7 7-7 7"/></>),
  arrowL:     (<><path d="M19 12H5M11 19l-7-7 7-7"/></>),
  check:      (<><path d="M5 12l5 5L20 7"/></>),
  x:          (<><path d="M6 6l12 12M18 6L6 18"/></>),
  // Status / sentiment
  alert:      (<><path d="M10.3 3.86l-8 14A2 2 0 004 21h16a2 2 0 001.7-3.14l-8-14a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></>),
  ban:        (<><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></>),
  trash:      (<><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/></>),
  pause:      (<><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>),
  play:       (<><polygon points="6 4 20 12 6 20 6 4"/></>),
  verified:   (<><path d="M12 2l2.4 2.1 3.2-.4.8 3.1 2.7 1.8-1.5 2.9 1 3-2.9 1.5-.4 3.2-3.2-.4L12 22l-2.1-2.4-3.2.4-.4-3.2-2.9-1.5 1-3-1.5-2.9 2.7-1.8.8-3.1 3.2.4z"/><path d="M9 12l2 2 4-4"/></>),
  eye:        (<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>),
  mail:       (<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/></>),
  phone:      (<><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.6a2 2 0 01-.5 2.1l-1.3 1.3a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.8.3 1.7.5 2.6.6a2 2 0 011.7 2z"/></>),
  pin:        (<><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></>),
  card:       (<><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/></>),
  badge:      (<><circle cx="12" cy="8" r="6"/><path d="M8.5 13L7 22l5-3 5 3-1.5-9"/></>),
  trendUp:    (<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>),
  trendDown:  (<><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></>),
  clock:      (<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>),
  baby:       (<><circle cx="12" cy="8" r="4"/><path d="M9 8h.01M15 8h.01M10 11s.7 1 2 1 2-1 2-1"/><path d="M5 21l1-5h12l1 5"/></>),
  msg:        (<><path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>),
  collapse:   (<><path d="M15 6l-6 6 6 6"/><path d="M21 6v12"/></>),
  expand:     (<><path d="M9 6l6 6-6 6"/><path d="M3 6v12"/></>),
  logout:     (<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></>),
  refresh:    (<><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/><path d="M3 21v-5h5"/></>),
  external:   (<><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></>),
  zap:        (<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
  globe:      (<><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></>),
};


