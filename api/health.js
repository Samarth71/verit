/* Public values (they are also in index.html). Environment variables override them if set. */
const DEFAULT_URL = 'https://zeljesglqeaqlxonmqvw.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbGplc2dscWVhcWx4b25tcXZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NDE0NTMsImV4cCI6MjEwNzUxNzQ1M30.CV_HCDhvYT2eWd-dDLl1MYzc4SlVYb3K9uOS3OPfsuQ';
/* Open /api/health after deploying. It checks your settings and tests the Supabase connection. It never shows secrets. */
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const U = (process.env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, ''), K = process.env.SUPABASE_ANON_KEY || DEFAULT_KEY;
  const out = {
    ok: true,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'set' : 'built-in default',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'set' : 'built-in default',
      SUPABASE_JWT_SECRET: !!process.env.SUPABASE_JWT_SECRET,
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID ? 'set' : 'default (verit-ce74d)'
    },
    supabase: 'not tested'
  };
  if (U && K) {
    try {
      const r = await fetch(U + '/rest/v1/repos?select=id&limit=1', { headers: { apikey: K, Authorization: 'Bearer ' + K } });
      out.supabase = r.status === 200 ? 'connected'
        : r.status === 401 || r.status === 403 ? 'rejected the key: SUPABASE_ANON_KEY is wrong'
        : r.status === 404 ? 'reached, but the repos table is missing: run schema.sql in Supabase'
        : 'unexpected status ' + r.status;
    } catch (e) { out.supabase = 'could not reach Supabase: check SUPABASE_URL'; }
  }
  out.ok = out.supabase === 'connected';
  res.json(out);
};
