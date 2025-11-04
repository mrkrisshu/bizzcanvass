import admin from 'firebase-admin'

// Initialize Admin SDK only once
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // Private key may contain escaped newlines
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    })
  } else {
    // Fallback to application default credentials in local dev or Firebase Functions
    try {
      admin.initializeApp()
    } catch {}
  }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()