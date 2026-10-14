const{jwtVerify,createRemoteJWKSet,SignJWT}=require('jose');
const JWKS=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
module.exports=async(req,res)=>{
  try{
    const pid=process.env.FIREBASE_PROJECT_ID||'verit-ce74d';
    const idt=(req.headers.authorization||'').replace(/^Bearer /,'');
    const{payload}=await jwtVerify(idt,JWKS,{issuer:'https://securetoken.google.com/'+pid,audience:pid});
    const token=await new SignJWT({role:'authenticated'}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setSubject(payload.sub).setAudience('authenticated').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));
    res.setHeader('Cache-Control','no-store');res.json({token});
  }catch(e){res.status(401).json({error:'invalid token'})}
};
