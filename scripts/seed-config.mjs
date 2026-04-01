// Firestore config 시딩 — teams-webhooks + reminder-rules
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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

// ─── Teams Webhook URLs ──────────────────────────────────────────────────────
// TODO: 실제 Teams Incoming Webhook URL로 교체 필요
const teamsWebhooks = {
  general: "REPLACE_WITH_GENERAL_WEBHOOK_URL",
  weekly: "REPLACE_WITH_WEEKLY_WEBHOOK_URL",
  sales: "REPLACE_WITH_SALES_WEBHOOK_URL",
  reminders: "REPLACE_WITH_REMINDERS_WEBHOOK_URL",
};

// ─── Reminder Rules ──────────────────────────────────────────────────────────
const reminderRules = {
  rules: [
    { daysBefore: 3, recipients: ["assignee"], severity: "info" },
    { daysBefore: 1, recipients: ["assignee", "manager"], severity: "warning" },
    { daysBefore: 0, recipients: ["assignee", "manager"], severity: "warning" },
    { daysAfter: 1, recipients: ["manager", "coordinator"], severity: "danger" },
    { daysAfter: 3, recipients: ["coordinator"], severity: "critical" },
  ],
};

// ─── Seed ────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("Seeding config documents...\n");

  await setDoc(doc(db, "config", "teams-webhooks"), teamsWebhooks);
  console.log("  config/teams-webhooks");

  await setDoc(doc(db, "config", "reminder-rules"), reminderRules);
  console.log("  config/reminder-rules");

  console.log("\nDone. Update webhook URLs in Firestore Console before use.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
