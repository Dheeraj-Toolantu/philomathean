const admin = require('firebase-admin')

const adminEmail = process.env.ADMIN_EMAIL || 'admin@philomathean.in'
const adminPassword = process.env.ADMIN_PASSWORD

if (!adminPassword) {
  throw new Error('Set ADMIN_PASSWORD before running this script. Use a strong password for production.')
}

admin.initializeApp()
const db = admin.firestore()

const seedCollections = async () => {
  const { results } = await import('../../src/content-seed.js')
  let user
  try {
    user = await admin.auth().getUserByEmail(adminEmail)
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
    user = await admin.auth().createUser({ email: adminEmail, password: adminPassword, displayName: 'Philomathean Administrator' })
  }
  await admin.auth().setCustomUserClaims(user.uid, { admin: true })

  const existingResults = await db.collection('results').limit(1).get()
  if (existingResults.empty) {
    const batch = db.batch()
    results.forEach((result, index) => batch.set(db.collection('results').doc(), { ...result, published: true, sortOrder: index, version: 1, createdBy: user.uid, updatedBy: user.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }))
    await batch.commit()
  }

  console.log(`Admin ready: ${adminEmail}`)
  console.log(`Results collection: ${existingResults.empty ? 'seeded' : 'already contains records'}`)
  console.log('Past paper collection: ready for dashboard uploads')
}

seedCollections().then(() => admin.app().delete()).catch(async (error) => { console.error(error.message); await admin.app().delete(); process.exitCode = 1 })
