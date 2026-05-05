// Firebase 初期化設定
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCRJ9rTd3Ss3QxczGc1R0rwUJXccGSLMco",
  authDomain: "game-86071.firebaseapp.com",
  projectId: "game-86071",
  storageBucket: "game-86071.firebasestorage.app",
  messagingSenderId: "1442050997",
  appId: "1:1442050997:web:77e44e8044fd36eee51ffc",
  measurementId: "G-8DNH2FM92Z",
};

const app = initializeApp(firebaseConfig);

// Firestoreインスタンスをエクスポート
export const db = getFirestore(app);
