#!/usr/bin/env node
/**
 * Runs the Supabase migration via the Management API.
 * Uses a Personal Access Token (sbp_*) for auth.
 */
const fs = require('fs');
const https = require('https');

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF;
const SQL_FILE = process.argv[2] || 'supabase-migration.sql';

if (!TOKEN || !PROJECT_REF) {
  console.error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF env var.');
  process.exit(1);
}

const sql = fs.readFileSync(SQL_FILE, 'utf-8');

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
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
    process.exit(res.statusCode >= 400 ? 1 : 0);
  });
});

req.on('error', (e) => {
  console.error('Request failed:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
