// functions/auth-middleware.js
const admin = require('firebase-admin');

exports.validateAuth = async (req, res, next) => {
  // Handle OPTIONS requests for CORS preflight
  if (req.method === 'OPTIONS') {
    return next();
  }
  
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authentication' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Add rate limiting based on user
    const rateLimitDoc = await admin.firestore()
      .collection('rateLimits')
      .doc(decodedToken.uid)
      .get();
    
    const now = Date.now();
    const rateData = rateLimitDoc.exists ? rateLimitDoc.data() : { count: 0, resetTime: now + 60000 };
    
    if (rateData.count > 100 && now < rateData.resetTime) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // Update rate limit counter
    await admin.firestore().collection('rateLimits').doc(decodedToken.uid).set({
      count: rateData.count + 1,
      resetTime: rateData.resetTime < now ? now + 60000 : rateData.resetTime
    });
    
    // Multi-factor authorization check
    const isAuthorizedDomain = decodedToken.email?.endsWith('@allisone.ai');
    
    // Check whitelist for additional security
    const whitelistDoc = await admin.firestore()
      .collection('authorizedUsers')
      .doc(decodedToken.email)
      .get();
    
    if (!isAuthorizedDomain && !whitelistDoc.exists) {
      // Log unauthorized access attempt
      await admin.firestore().collection('securityEvents').add({
        type: 'unauthorizedAccess',
        email: decodedToken.email,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip || 'unknown'
      });
      
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Add user info to request
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};