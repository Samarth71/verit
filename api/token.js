const { jwtVerify, createRemoteJWKSet, SignJWT } = require('jose');

// 1. Full official Google keys URL
const JWKSet = createRemoteJWKSet(new URL('https://googleapis.com'));

module.exports = async (req, res) => {
    try {
        const pid = process.env.FIREBASE_PROJECT_ID || 'verit-ce74d';
        const idt = (req.headers.authorization || '').replace(/^Bearer /, '');
        
        // 2. Full Firebase token verification setup
        const { payload } = await jwtVerify(idt, JWKSet, { 
            issuer: 'https://google.com' + pid, 
            audience: pid 
        });
        
        // 3. Convert Supabase JWT Secret string safely to Buffer
        const secret = Buffer.from(process.env.SUPABASE_JWT_SECRET, 'utf-8');
        
        // 4. Sign the JWT using the secret key
        const token = await new SignJWT({ role: 'authenticated' })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setSubject(payload.sub)
            .setAudience('authenticated')
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(secret); 
            
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ token });
        
    } catch(e) {
        // 5. This will print the exact issue to your browser banner if it fails
        return res.status(401).json({ error: e.message || 'Invalid token' });
    }
};
