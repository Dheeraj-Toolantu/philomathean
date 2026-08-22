// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDt66vm6jheSH3nFTXc9Nb_Y0LId0a1glk",
  authDomain: "philomathean-a2c93.firebaseapp.com",
  projectId: "philomathean-a2c93",
  storageBucket: "philomathean-a2c93.firebasestorage.app",
  messagingSenderId: "234241779411",
  appId: "1:234241779411:web:18d9ca0c876a5502ca5626",
  measurementId: "G-C5NHM39RBP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);