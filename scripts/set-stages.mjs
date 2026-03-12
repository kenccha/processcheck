// Set templateStages in Firestore
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

const NEW_STAGES = [
  { id: "phase0", name: "발의", workStageName: "발의검토", gateStageName: "발의승인", order: 0 },
  { id: "phase1", name: "기획", workStageName: "기획검토", gateStageName: "기획승인", order: 1 },
  { id: "phase2", name: "WM", workStageName: "WM제작", gateStageName: "WM승인회", order: 2 },
  { id: "phase3", name: "Tx", workStageName: "Tx단계", gateStageName: "Tx승인회", order: 3 },
  { id: "phase4", name: "MSG", workStageName: "MasterGatePilot", gateStageName: "MSG승인회", order: 4 },
  { id: "phase5", name: "양산/이관", workStageName: "양산", gateStageName: "영업이관", order: 5 },
];

async function run() {
  // 1. Delete existing stages
  const existing = await getDocs(collection(db, "templateStages"));
  if (existing.docs.length > 0) {
    const delBatch = writeBatch(db);
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`Deleted ${existing.docs.length} existing stages`);
  }

  // 2. Add new stages
  const addBatch = writeBatch(db);
  for (const s of NEW_STAGES) {
    addBatch.set(doc(db, "templateStages", s.id), {
      name: s.name,
      workStageName: s.workStageName,
      gateStageName: s.gateStageName,
      order: s.order,
      createdBy: "system",
      createdAt: Timestamp.now(),
    });
  }
  await addBatch.commit();
  console.log(`Added ${NEW_STAGES.length} stages`);

  console.log("\nStages set:");
  NEW_STAGES.forEach(s => console.log(`  ${s.order}. ${s.name} (${s.workStageName} / ${s.gateStageName})`));

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
