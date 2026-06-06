#!/usr/bin/env node
// Run an ad-hoc SQL query against Supabase
const https = require('https');
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const sql = process.argv.slice(2).join(' ');
if (!TOKEN || !PROJECT_REF || !sql) {
  console.error('Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node run-sql.cjs "<sql>"');
  process.exit(1);
}
const body = JSON.stringify({ query: sql });
const req = https.request({
  method: 'POST',
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try { console.log(JSON.stringify(JSON.parse(data), null, 2)); }
    catch { console.log(data); }
    process.exit(res.statusCode >= 400 ? 1 : 0);
  });
});
req.on('error', (e) => { console.error('Request failed:', e.message); process.exit(1); });
req.write(body);
req.end();
