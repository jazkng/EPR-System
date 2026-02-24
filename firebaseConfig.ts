
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Kim Lian Kee ERP Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD3-ycPL9eCgaOHRdSQ9X5HU6UVrnk4Pfc",
  authDomain: "kimliankee-erp.firebaseapp.com",
  projectId: "kimliankee-erp",
  storageBucket: "kimliankee-erp.firebasestorage.app",
  messagingSenderId: "593553216354",
  appId: "1:593553216354:web:5022ff79a898988206123b",
  measurementId: "G-WBQ4JQJT7V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
