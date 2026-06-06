// Migrates old JSX files to ES module format
const fs = require('fs');
const path = require('path');

const OLD = 'C:/Users/aboubakar/Desktop/kido-admin-old';
const NEW = 'C:/Users/aboubakar/Desktop/kido-admin/src';

// Identifiers defined in each module (for cross-file imports)
const ICON_EXPORTS = ['Icon', 'ICON_PATHS'];
const DATA_EXPORTS = ['ADMIN', 'KPI_DATA', 'BOOKINGS_TREND', 'REPORTS', 'VERIFICATIONS', 'USERS', 'BOOKINGS', 'FLAGGED_REVIEWS', 'AUDIT_LOG', 'CITIES'];
const COMPONENT_EXPORTS = ['useCountUp', 'formatNum', 'Card', 'Btn', 'IconBtn', 'Pill', 'Avatar', 'SearchField', 'Sidebar', 'Topbar', 'NavItem', 'PageHeader', 'EmptyState', 'StatCard', 'Sparkline', 'BarChart', 'DataTable', 'Modal', 'Drawer', 'Tabs', 'Tooltip', 'Skeleton', 'NAV_ITEMS'];
const TWEAKS_EXPORTS = ['useTweaks', 'TweaksPanel', 'TweakSection', 'TweakRadio', 'TweakToggle', 'TweakColor', 'TweakSlider'];

function transform(content, file) {
  let out = content;

  // 1. Add React imports at top
  let imports = `import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';\n`;

  // 2. Add cross-file imports if used
  const isIcons = file === 'icons.jsx';
  const isData = file === 'data.jsx';
  const isComps = file === 'components.jsx';
  const isTweaks = file === 'tweaks-panel.jsx';

  if (!isIcons) {
    const usedIcons = ICON_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(out));
    if (usedIcons.length) imports += `import { ${usedIcons.join(', ')} } from './icons.jsx';\n`;
  }
  if (!isData) {
    const usedData = DATA_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(out));
    if (usedData.length) imports += `import { ${usedData.join(', ')} } from './data.jsx';\n`;
  }
  if (!isComps) {
    const usedComps = COMPONENT_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(out));
    if (usedComps.length) imports += `import { ${usedComps.join(', ')} } from './components.jsx';\n`;
  }
  if (!isTweaks) {
    const usedTweaks = TWEAKS_EXPORTS.filter(name => new RegExp(`\\b${name}\\b`).test(out));
    if (usedTweaks.length) imports += `import { ${usedTweaks.join(', ')} } from './tweaks-panel.jsx';\n`;
  }

  // Remove `const { useState } = React;` etc.
  out = out.replace(/const\s*\{[^}]*\}\s*=\s*React\s*;/g, '');
  // Remove `const { useState: useS } = React;` etc with renames
  out = out.replace(/const\s*\{[^}]*useState[^}]*\}\s*=\s*React\s*;/g, '');

  // Remove `window.X = X;` lines and Object.assign(window, {...})
  out = out.replace(/window\.[a-zA-Z_]+\s*=\s*[a-zA-Z_]+\s*;/g, '');
  out = out.replace(/Object\.assign\(window,\s*\{[^}]*\}\s*\);?/gs, '');

  // Remove the ReactDOM.createRoot(...).render(<App />); line (we'll do that in main.tsx)
  out = out.replace(/ReactDOM\.createRoot\([^)]*\)\.render\(<App\s*\/>\)\s*;?/g, '');

  // Add exports - find function declarations and add export
  const fnPattern = /^function\s+([A-Z][a-zA-Z_]*)\s*\(/gm;
  const constPattern = /^const\s+([A-Z_][A-Z0-9_]*)\s*=/gm;
  const lowerFnPattern = /^function\s+(use[A-Z][a-zA-Z_]*|format[A-Z][a-zA-Z_]*)\s*\(/gm;

  out = out.replace(fnPattern, 'export function $1(');
  out = out.replace(constPattern, 'export const $1 =');
  out = out.replace(lowerFnPattern, 'export function $1(');

  // Special case: useState shadowing in App.jsx - replace useS with useState
  out = out.replace(/\buseS\b/g, 'useState');

  return imports + '\n' + out;
}

function processFile(rel) {
  const src = path.join(OLD, rel);
  const dest = path.join(NEW, rel);
  const content = fs.readFileSync(src, 'utf-8');
  const transformed = transform(content, path.basename(rel));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, transformed);
  console.log('✓', rel);
}

// Process all files
processFile('src/icons.jsx');
processFile('src/data.jsx');
processFile('src/components.jsx');
fs.copyFileSync(path.join(OLD, 'tweaks-panel.jsx'), path.join(NEW, 'tweaks-panel.jsx'));
processFile('tweaks-panel.jsx'.replace('tweaks-panel.jsx', 'tweaks-panel.jsx'));

// Wait, tweaks-panel.jsx is at root of old, but we want it in src/
const tweaksContent = fs.readFileSync(path.join(OLD, 'tweaks-panel.jsx'), 'utf-8');
fs.writeFileSync(path.join(NEW, 'tweaks-panel.jsx'), transform(tweaksContent, 'tweaks-panel.jsx'));

processFile('src/pages/Overview.jsx');
processFile('src/pages/Verification.jsx');
processFile('src/pages/Reports.jsx');
processFile('src/pages/Users.jsx');
processFile('src/pages/Bookings.jsx');
processFile('src/pages/Reviews.jsx');
processFile('src/pages/AuditLog.jsx');
processFile('src/App.jsx');

console.log('\nDone!');
