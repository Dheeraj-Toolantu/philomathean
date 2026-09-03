// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const env = typeof import.meta.env === 'object' ? import.meta.env : {}
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDt66vm6jheSH3nFTXc9Nb_Y0LId0a1glk',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'philomathean-a2c93.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'philomathean-a2c93',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'philomathean-a2c93.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '234241779411',
  appId: env.VITE_FIREBASE_APP_ID || '1:234241779411:web:18d9ca0c876a5502ca5626',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-C5NHM39RBP',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

export const firebaseApp = app
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)