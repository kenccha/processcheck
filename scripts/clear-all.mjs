// Clear ALL data from Firestore — everything including templates
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
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

const ALL_COLLECTIONS = [
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
  "templateStages",
  "templateItems",
  "templateDepartments",
  "activityLogs",
];

async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) {
    console.log(`  ✓ ${name}: 비어있음`);
    return 0;
  }

  let count = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    batch.delete(doc(db, name, docSnap.id));
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

  console.log(`  ✓ ${name}: ${count}개 문서 삭제`);
  return count;
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log(" Firestore 전체 데이터 삭제 (모든 컬렉션)");
  console.log("═══════════════════════════════════════════\n");

  let total = 0;
  for (const col of ALL_COLLECTIONS) {
    try {
      total += await clearCollection(col);
    } catch (err) {
      console.error(`  ✗ ${col} 삭제 실패:`, err.message);
    }
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(` 완료! 총 ${total}개 문서 삭제됨`);
  console.log(` DB가 완전히 비어있습니다.`);
  console.log(`═══════════════════════════════════════════`);

  process.exit(0);
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
