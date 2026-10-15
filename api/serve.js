const T={html:'text/html; charset=utf-8',htm:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8',xml:'application/xml',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const TEXT=new Set(Object.keys(T));
module.exports=async(req,res)=>{
  const U=(process.env.SUPABASE_URL||'').replace(/\/+$/,''),K=process.env.SUPABASE_ANON_KEY||'',H={apikey:K,Authorization:'Bearer '+K};
  if(!U||!K)return res.status(500).send('Hosting is not set up yet: add SUPABASE_URL and SUPABASE_ANON_KEY in the Vercel project settings (Environment Variables), then redeploy.');
  const{slug,p,d}=req.query;let path=decodeURIComponent(req.query.path||'').replace(/^\/+/,'');
  const q=async u=>{const r=await fetch(U+'/rest/v1/'+u,{headers:H});const j=await r.json();if(!Array.isArray(j))throw new Error('Supabase replied: '+(j&&(j.message||j.hint||j.error)||r.status)+'. Check SUPABASE_URL and SUPABASE_ANON_KEY.');return j};
  try{
    const[r]=await q(`repos?slug=eq.${encodeURIComponent(slug)}&select=prod`);
    const did=d||(r&&r.prod);
    if(!did)return res.status(404).send('Nothing deployed here yet.');
    const[dp]=await q(`deploys?id=eq.${encodeURIComponent(did)}&select=tree`);
    if(!dp)return res.status(404).send('Deployment not found.');
    const t=dp.tree,base=path.replace(/\/$/,'');
    const hit=[path&&!path.endsWith('/')?path:null,(base?base+'/':'')+'index.html',base+'.html'].find(k=>k&&t[k]);
    const key=hit||(t['404.html']?'404.html':null);
    if(!key)return res.status(404).send('Not found.');
    const ext=key.split('.').pop().toLowerCase(),blob=U+'/storage/v1/object/public/blobs/'+t[key];
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=600');
    if(!TEXT.has(ext)){res.setHeader('Location',blob);return res.status(302).end()}
    const f=await fetch(blob);
    res.setHeader('Content-Type',T[ext]);res.setHeader('X-Content-Type-Options','nosniff');
    if(p)res.setHeader('Content-Security-Policy','sandbox allow-scripts allow-forms allow-popups allow-modals');
    res.status(hit?200:404).send(Buffer.from(await f.arrayBuffer()));
  }catch(e){res.status(500).send('Hosting error: '+(e&&e.message||'unknown'))}
};
