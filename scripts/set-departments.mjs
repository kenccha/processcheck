// Set templateDepartments in Firestore
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
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

const NEW_DEPARTMENTS = [
  { id: "dept-design", name: "디자인연구소", order: 0 },
  { id: "dept-clinical", name: "글로벌임상파트", order: 1 },
  { id: "dept-quality", name: "품질파트", order: 2 },
  { id: "dept-rnd", name: "R&D파트", order: 3 },
  { id: "dept-manufacturing", name: "제조그룹", order: 4 },
  { id: "dept-certification", name: "전략인증팀", order: 5 },
  { id: "dept-management", name: "경영관리그룹", order: 6 },
  { id: "dept-sales", name: "영업그룹", order: 7 },
  { id: "dept-cs", name: "글로벌CS팀", order: 8 },
  { id: "dept-procurement", name: "구매파트", order: 9 },
];

async function run() {
  // 1. Delete existing departments
  const existing = await getDocs(collection(db, "templateDepartments"));
  if (existing.docs.length > 0) {
    const delBatch = writeBatch(db);
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`Deleted ${existing.docs.length} existing departments`);
  }

  // 2. Add new departments
  const addBatch = writeBatch(db);
  for (const d of NEW_DEPARTMENTS) {
    addBatch.set(doc(db, "templateDepartments", d.id), {
      name: d.name,
      order: d.order,
      createdBy: "system",
      createdAt: Timestamp.now(),
    });
  }
  await addBatch.commit();
  console.log(`Added ${NEW_DEPARTMENTS.length} departments`);

  // 3. Also update hardcoded fallback in utils.js
  console.log("\nDepartments set:");
  NEW_DEPARTMENTS.forEach(d => console.log(`  ${d.order}. ${d.name}`));

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
