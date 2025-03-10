const functions = require('firebase-functions');
const admin = require('firebase-admin');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Security: Validate file types to prevent malicious uploads
const validateFileType = (contentType) => {
  const allowedTypes = [
    'text/csv', 
    'application/vnd.ms-excel',
    'application/json',
    'text/plain'
  ];
  
  return allowedTypes.includes(contentType);
};

// Security: Scan file content for potentially harmful patterns
const scanFileContent = (content) => {
  // Check for potential script injection or command injection patterns
  const dangerousPatterns = [
    /<script>/i,
    /javascript:/i,
    /\bexec\s*\(/i,
    /\beval\s*\(/i,
    /\bspawn\s*\(/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(content));
};

// Handle file uploads securely
exports.handleFileUpload = functions.https.onCall(async (data, context) => {
  // Security: Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'Authentication required'
    );
  }
  
  // Security: Validate email domain
  if (!context.auth.token.email.endsWith('@allisone.ai')) {
    throw new functions.https.HttpsError(
      'permission-denied', 
      'Unauthorized domain'
    );
  }
  
  try {
    const { fileName, contentType, base64Content } = data;
    
    // Security: Validate content type
    if (!validateFileType(contentType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid file type'
      );
    }
    
    // Security: Validate file size (max 10MB)
    const fileBuffer = Buffer.from(base64Content, 'base64');
    if (fileBuffer.length > 10 * 1024 * 1024) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'File too large (max 10MB)'
      );
    }
    
    // Security: Scan file content
    const fileContent = fileBuffer.toString();
    if (!scanFileContent(fileContent)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'File contains potentially harmful content'
      );
    }
    
    // Generate safe filename
    const safeFileName = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${uuidv4()}_${safeFileName}`;
    
    // Store file metadata in Firestore
    const fileDoc = await admin.firestore().collection('uploadedFiles').add({
      fileName: safeFileName,
      originalName: fileName,
      contentType,
      size: fileBuffer.length,
      uploadedBy: context.auth.uid,
      email: context.auth.token.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Store file in Cloud Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(`uploads/${fileDoc.id}/${uniqueFileName}`);
    
    await file.save(fileBuffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: uuidv4(),
          uploadedBy: context.auth.uid,
          originalName: fileName
        }
      }
    });
    
    // Return file details
    const fileUrl = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 1 week
    });
    
    return {
      id: fileDoc.id,
      fileName: safeFileName,
      url: fileUrl[0],
      contentType,
      size: fileBuffer.length
    };
    
  } catch (error) {
    console.error('File upload error:', error);
    throw new functions.https.HttpsError('internal', 'File upload failed');
  }
});