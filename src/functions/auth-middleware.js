// functions/auth-middleware.js
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

// Middleware to check if the request is authenticated
const checkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user is authorized (has allisone.ai email or custom claim)
    const email = decodedToken.email;
    
    if (!email) {
      return res.status(403).json({ error: 'No email associated with account' });
    }
    
    // Option 1: Domain check
    const isDomainAuthorized = email.endsWith('@allisone.ai');
    
    // Option 2: Check custom claims
    const isClaimAuthorized = decodedToken.authorized === true;
    
    // Option 3: Check Firestore authorized users collection
    let isInWhitelist = false;
    try {
      const userDoc = await admin.firestore().collection('authorizedUsers').doc(email).get();
      isInWhitelist = userDoc.exists;
    } catch (error) {
      console.error('Error checking whitelist:', error);
    }
    
    if (isDomainAuthorized || isClaimAuthorized || isInWhitelist) {
      // Add the user to the request object for later use
      req.user = decodedToken;
      return next();
    } else {
      return res.status(403).json({ error: 'Forbidden - User not authorized' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid authentication' });
  }
};

module.exports = { checkAuth };