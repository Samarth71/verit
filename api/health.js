/* Open /api/health after deploying to check that everything is wired. Shows only yes/no, never secrets. */
module.exports = (req, res) => {
  const has = k => !!process.env[k];
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    functions: ['serve', 'token', 'vercel', 'health'],
    env: {
      SUPABASE_URL: has('SUPABASE_URL'),
      SUPABASE_ANON_KEY: has('SUPABASE_ANON_KEY'),
      SUPABASE_JWT_SECRET: has('SUPABASE_JWT_SECRET'),
      FIREBASE_PROJECT_ID: has('FIREBASE_PROJECT_ID') ? 'set' : 'default (verit-ce74d)'
    }
  });
};
