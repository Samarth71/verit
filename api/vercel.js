/* Verit <-> Vercel bridge. Uses the signed-in user's own Vercel token (sent per request, never stored). */
const { jwtVerify, createRemoteJWKSet } = require('jose');
const crypto = require('crypto');
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const API = 'https://api.vercel.com';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const pid = process.env.FIREBASE_PROJECT_ID || 'verit-ce74d';
    const idt = (req.headers.authorization || '').replace(/^Bearer /, '');
    await jwtVerify(idt, JWKS, { issuer: 'https://securetoken.google.com/' + pid, audience: pid });
  } catch (e) { return res.status(401).json({ error: 'Please sign in to Verit again' }); }

  const tok = String(req.headers['x-vercel-token'] || '').trim();
  if (!/^[A-Za-z0-9_\-]{10,300}$/.test(tok)) return res.status(400).json({ error: 'Missing or invalid Vercel token' });
  const q = req.query || {}, team = /^[A-Za-z0-9_\-]{2,64}$/.test(q.team || '') ? q.team : '';
  const tq = team ? (team.startsWith('team_') ? 'teamId=' : 'slug=') + encodeURIComponent(team) : '';

  const vf = async (path, opt = {}) => {
    const url = API + path + (tq ? (path.includes('?') ? '&' : '?') + tq : '');
    const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + tok, ...(opt.headers || {}) } });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch (e) { j = { raw: t }; }
    return { ok: r.ok, status: r.status, j };
  };
  const fail = (r, d) => res.status(r.status >= 400 && r.status < 600 ? r.status : 502).json({ error: (r.j && r.j.error && r.j.error.message) || d });

  try {
    const op = q.op;
    if (op === 'me') {
      const r = await vf('/v2/user'); if (!r.ok) return fail(r, 'Vercel rejected this token');
      const u = r.j.user || {}; return res.json({ user: { name: u.name, username: u.username, email: u.email } });
    }
    if (op === 'projects') {
      const r = await vf('/v9/projects?limit=20'); if (!r.ok) return fail(r, 'Could not load projects');
      return res.json({ projects: (r.j.projects || []).map(p => ({
        id: p.id, name: p.name, framework: p.framework, updatedAt: p.updatedAt,
        url: (p.targets && p.targets.production && p.targets.production.alias && p.targets.production.alias[0]) || (p.latestDeployments && p.latestDeployments[0] && p.latestDeployments[0].url) || null
      })) });
    }
    if (op === 'deployments') {
      const r = await vf('/v6/deployments?limit=15'); if (!r.ok) return fail(r, 'Could not load deployments');
      return res.json({ deployments: (r.j.deployments || []).map(d => ({
        id: d.uid, name: d.name, url: d.url, state: d.state || d.readyState, created: d.created || d.createdAt, target: d.target, creator: d.creator && d.creator.username
      })) });
    }
    if (op === 'status') {
      if (!/^dpl_[A-Za-z0-9]+$/.test(q.id || '')) return res.status(400).json({ error: 'Bad deployment id' });
      const r = await vf('/v13/deployments/' + q.id); if (!r.ok) return fail(r, 'Could not read deployment');
      return res.json({ state: r.j.readyState, url: r.j.url, error: r.j.errorMessage || null });
    }
    if (op === 'deploy' && req.method === 'POST') {
      const b = req.body || {}, name = String(b.name || '');
      if (!/^[a-z0-9][a-z0-9._-]{0,98}$/.test(name)) return res.status(400).json({ error: 'Project name: lowercase letters, numbers, dots, dashes' });
      const paths = Object.keys(b.tree || {});
      if (!paths.length || paths.length > 400) return res.status(400).json({ error: 'A deployment needs 1 to 400 files' });
      if (!b.tree['index.html']) return res.status(400).json({ error: 'index.html is required' });
      const base = (process.env.SUPABASE_URL || '') + '/storage/v1/object/public/blobs/';
      let total = 0; const files = [], uploads = new Map();
      for (const p of paths) {
        const h = b.tree[p];
        if (/(^|\/)\.\.(\/|$)/.test(p) || p.startsWith('/') || !/^[a-f0-9]{64}$/.test(String(h))) return res.status(400).json({ error: 'Bad file entry: ' + p });
        const f = await fetch(base + h); if (!f.ok) return res.status(502).json({ error: 'Could not read stored file ' + p });
        const buf = Buffer.from(await f.arrayBuffer()); total += buf.length;
        if (total > 45 * 1048576) return res.status(413).json({ error: 'Files are larger than 45 MB in total' });
        const sha = crypto.createHash('sha1').update(buf).digest('hex');
        uploads.set(sha, buf); files.push({ file: p, sha, size: buf.length });
      }
      const list = [...uploads.entries()]; let i = 0, bad = null;
      const wk = async () => { while (i < list.length && !bad) { const [sha, buf] = list[i++];
        const r = await vf('/v2/files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': sha, 'Content-Length': String(buf.length) }, body: buf });
        if (!r.ok && r.status !== 409) bad = r; } };
      await Promise.all([wk(), wk(), wk(), wk()]); if (bad) return fail(bad, 'Upload to Vercel failed');
      const c = await vf('/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, files, target: 'production', projectSettings: { framework: null, buildCommand: null, installCommand: null, outputDirectory: null, devCommand: null } }) });
      if (!c.ok) return fail(c, 'Vercel could not create the deployment');
      const d = c.j; /* the browser polls ?op=status, so this function returns fast */
      return res.json({ id: d.id, url: 'https://' + d.url, state: d.readyState, inspector: d.inspectorUrl || null });
    }
    return res.status(400).json({ error: 'Unknown operation' });
  } catch (e) { return res.status(500).json({ error: 'Vercel bridge error: ' + (e.message || 'unknown') }); }
};
