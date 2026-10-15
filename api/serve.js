/* Public values (they are also in index.html). Environment variables override them if set. */
const DEFAULT_URL = 'https://zeljesglqeaqlxonmqvw.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplbGplc2dscWVhcWx4b25tcXZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NDE0NTMsImV4cCI6MjEwNzUxNzQ1M30.CV_HCDhvYT2eWd-dDLl1MYzc4SlVYb3K9uOS3OPfsuQ';
/* In a sandbox the browser blocks localStorage, sessionStorage and cookies, which crashes many sites. This gives them in-memory versions. */
const SHIM = '<script>(function(){function mem(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(e2){}}});try{void document.cookie}catch(e){var c="";try{Object.defineProperty(document,"cookie",{get:function(){return c},set:function(v){c=String(v).split(";")[0]},configurable:true})}catch(e2){}}})();</'+'script>';
const T={html:'text/html; charset=utf-8',htm:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',mjs:'text/javascript; charset=utf-8',json:'application/json',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8',xml:'application/xml',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
const TEXT=new Set(Object.keys(T));
module.exports=async(req,res)=>{
  const U=(process.env.SUPABASE_URL||DEFAULT_URL).replace(/\/+$/,''),K=process.env.SUPABASE_ANON_KEY||DEFAULT_KEY,H={apikey:K,Authorization:'Bearer '+K};
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
    res.setHeader('Content-Type',T[ext]);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Access-Control-Allow-Origin','*');
    let buf=Buffer.from(await f.arrayBuffer());
    if(p){
      res.setHeader('Content-Security-Policy','sandbox allow-scripts allow-forms allow-popups allow-modals');
      if(ext==='html'||ext==='htm'||ext==='css'){
        /* Pages here live under /s/<slug>/ inside a sandbox: fix root-relative links and give scripts a storage fallback */
        const sl=String(slug||'').replace(/[^a-z0-9-]/gi,''),pre='/s/'+sl+'/';
        let t=buf.toString('utf8');
        t=t.replace(/url\(\s*(["']?)\/(?!\/|s\/)/gi,'url($1'+pre);
        if(ext!=='css'){
          t=t.replace(/(\s(?:src|href|action|poster|data-src)\s*=\s*["'])\/(?!\/|s\/)/gi,'$1'+pre);
          const h=/<head[^>]*>/i.exec(t)||/<html[^>]*>/i.exec(t);
          t=h?t.slice(0,h.index+h[0].length)+SHIM+t.slice(h.index+h[0].length):SHIM+t;
        }
        buf=Buffer.from(t,'utf8');
      }
    }
    res.status(hit?200:404).send(buf);
  }catch(e){res.status(500).send('Hosting error: '+(e&&e.message||'unknown'))}
};
