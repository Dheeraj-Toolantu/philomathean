import { initializeApp } from 'firebase/app'
import { getFirestore, writeBatch, collection, doc } from 'firebase/firestore'
import { results } from '../src/content-seed.js'
import { firebaseConfig } from '../src/firebase/config.js'

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const batch = writeBatch(db)
results.forEach((result) => batch.set(doc(collection(db, 'results')), { ...result, published: true, version: 1 }))
await batch.commit()
console.log(`Migrated ${results.length} results.`)
