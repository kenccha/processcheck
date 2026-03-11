// Clear all sample/seed data from Firestore
// Keeps: templateStages, templateItems, templateDepartments (shared templates)
// Deletes: users, projects, checklistItems, changeRequests, notifications,
//          customers, launchChecklists, portalNotifications, reviews, feedbacks

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
  authDomain: "processsss-appp.firebaseapp.com",
  projectId: "processsss-appp",
  storageBucket: "processsss-appp.firebasestorage.app",
  messagingSenderId: "1041230235574",
  appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS_TO_CLEAR = [
  "users",
  "projects",
  "checklistItems",
  "changeRequests",
  "notifications",
  "customers",
  "launchChecklists",
  "portalNotifications",
  "reviews",
  "feedbacks",
];

async function clearCollection(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  if (snap.empty) {
    console.log(`  ✓ ${collectionName}: 비어있음`);
    return 0;
  }

  // Use batched writes (max 500 per batch)
  let count = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    batch.delete(doc(db, collectionName, docSnap.id));
    batchCount++;
    count++;

    if (batchCount >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`  ✓ ${collectionName}: ${count}개 문서 삭제`);
  return count;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" Firestore 샘플 데이터 전체 삭제");
  console.log(" (템플릿 데이터는 유지됩니다)");
  console.log("═══════════════════════════════════════════\n");

  let totalDeleted = 0;

  for (const col of COLLECTIONS_TO_CLEAR) {
    try {
      const deleted = await clearCollection(col);
      totalDeleted += deleted;
    } catch (err) {
      console.error(`  ✗ ${col} 삭제 실패:`, err.message);
    }
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(` 완료! 총 ${totalDeleted}개 문서 삭제됨`);
  console.log(` 유지된 컬렉션: templateStages, templateItems, templateDepartments`);
  console.log(`═══════════════════════════════════════════`);

  process.exit(0);
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
