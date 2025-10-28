// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCU46KuOgPTLtygBDrRTtXdTB1q4lmnGrM",
  authDomain: "stock-market-dashboard-b0c3f.firebaseapp.com",
  projectId: "stock-market-dashboard-b0c3f",
  storageBucket: "stock-market-dashboard-b0c3f.appspot.com",
  messagingSenderId: "294678388887",
  appId: "1:294678388887:web:3abbe6b2cd23c7c85509d2",
  measurementId: "G-89DS9N0PB1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
