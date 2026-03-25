import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9eGmsyxiqOuH5STel7aI6UmaPg5qJ19o",
  authDomain: "botanica-abddb.firebaseapp.com",
  projectId: "botanica-abddb",
  storageBucket: "botanica-abddb.firebasestorage.app",
  messagingSenderId: "29863714347",
  appId: "1:29863714347:web:f32aff353c72a91934946e",
  measurementId: "G-MXF396SP8W"
};

export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
