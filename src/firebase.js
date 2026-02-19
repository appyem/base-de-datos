import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBEughbyZJU2RW3fhaMwfzr-GUHOATZw5k",
  authDomain: "crm-base-de-datos.firebaseapp.com",
  projectId: "crm-base-de-datos",
  storageBucket: "crm-base-de-datos.firebasestorage.app",
  messagingSenderId: "278250542313",
  appId: "1:278250542313:web:14e5ed09d546a2d86e4c78"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);