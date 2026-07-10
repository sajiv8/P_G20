import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAEzuhxfaWo91FDF2WXGd1y_hZaJCKpuqA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'campus-rso.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'campus-rso',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
