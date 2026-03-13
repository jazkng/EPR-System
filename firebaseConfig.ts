import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * 御膳智控 - 安全加固版配置
 * 使用 import.meta.env 确保密钥不被硬编码在代码中
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// 增加一层防御性检查：如果变量没读到，记录错误但不直接 throw，防止应用在加载阶段就完全崩溃
export const isFirebaseInitialized = !!firebaseConfig.apiKey;

if (!isFirebaseInitialized) {
  console.error("🔥 [致命错误]: Firebase 配置未找到！请检查根目录是否存在 .env 文件且包含 VITE_ 变量。");
}

// 初始化 Firebase
const app = isFirebaseInitialized ? initializeApp(firebaseConfig) : null;

// 导出 Firestore 实例
export const db = app ? getFirestore(app) : (new Proxy({}, {
  get: () => {
    throw new Error("Firebase is not initialized. Please check your environment variables.");
  }
}) as any);

// 如果将来需要用到 Auth 或 Storage，可以在这里加：
// import { getAuth } from "firebase/auth";
// export const auth = getAuth(app);