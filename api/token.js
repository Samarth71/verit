
const { jwtVerify, createRemoteJWKSet, SignJWT } = require('jose');

const JWKSet = createRemoteJWKSet(new URL('https://googleapis.com'));

module.exports = async (req, res) => {
    try {
        const pid = process.env.FIREBASE_PROJECT_ID || 'verit-ce74d';
        const idt = (req.headers.authorization || '').replace(/^Bearer /, '');
        
        // 1. Verify incoming Firebase Token
        const { payload } = await jwtVerify(idt, JWKSet, { issuer: 'https://google.com' + pid, audience: pid });
        
        // 2. Safely convert string to Uint8Array without relying on global TextEncoder
        const secret = Buffer.from(process.env.SUPABASE_JWT_SECRET, 'utf-8');
        
        // 3. Sign the JWT using the secret key
        const token = await new SignJWT({ role: 'authenticated' })
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setSubject(payload.sub)
            .setAudience('authenticated')
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(secret); 
            
        res.setHeader('Cache-Control', 'no-store');
        res.json({ token });
    } catch(e) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
