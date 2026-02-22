#!/usr/bin/env node
// Capture manual screenshots using Puppeteer
// Key: use evaluateOnNewDocument to set localStorage BEFORE page scripts run
import puppeteer from "puppeteer";
import { mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMG_DIR = join(__dirname, "img");
const BASE = "http://localhost:8080";

// Must match STORAGE_KEY in auth.js ("pc_user")
const STORAGE_KEY = "pc_user";

const USERS = {
  worker: { id: "user1", name: "김철수", email: "chulsoo@company.com", role: "worker", department: "개발팀" },
  manager: { id: "user2", name: "이영희", email: "younghee@company.com", role: "manager", department: "개발팀" },
  observer: { id: "user3", name: "박민수", email: "minsu@company.com", role: "observer", department: "경영관리팀" },
};

async function waitForData(page, timeout = 10000) {
  try {
    await page.waitForFunction(() => {
      const app = document.getElementById("app");
      if (!app) return false;
      const hasContent = app.querySelector(".stat-card, table, .card, .section-title, h1, .stat-value");
      const spinnerVisible = app.querySelector(".spinner-overlay:not(.hidden)");
      return hasContent && !spinnerVisible;
    }, { timeout });
  } catch {
    // Timeout ok — page may not have expected elements
  }
  await new Promise(r => setTimeout(r, 1500));
}

// Create a new page with localStorage pre-set BEFORE any page scripts run
async function createAuthPage(browser, role) {
  const page = await browser.newPage();
  if (role) {
    // This runs before any page script — solves guardPage() redirect issue
    await page.evaluateOnNewDocument((key, user) => {
      localStorage.setItem(key, JSON.stringify(user));
    }, STORAGE_KEY, USERS[role]);
  } else {
    // Ensure no auth
    await page.evaluateOnNewDocument((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
  }
  return page;
}

async function capture(browser, name, url, opts = {}) {
  console.log(`📸 ${name}...`);
  const page = await createAuthPage(browser, opts.role || "worker");
  try {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2", timeout: 20000 });
    await waitForData(page);

    if (opts.tab) {
      const tabBtn = await page.$(`[data-tab="${opts.tab}"]`);
      if (tabBtn) { await tabBtn.click(); await new Promise(r => setTimeout(r, 2000)); }
    }
    if (opts.view) {
      const viewBtn = await page.$(`[data-view="${opts.view}"]`);
      if (viewBtn) { await viewBtn.click(); await new Promise(r => setTimeout(r, 2000)); }
    }
    if (opts.afterNav) {
      await opts.afterNav(page);
    }

    await page.screenshot({ path: join(IMG_DIR, name), fullPage: false });
    console.log(`  ✅ ${name}`);
    return true;
  } catch (err) {
    console.error(`  ❌ ${name}: ${err.message}`);
    return false;
  } finally {
    await page.close();
  }
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1400, height: 900 },
  });

  // Step 0: Clear existing data, then seed via login page
  console.log("🔧 Clearing Firestore data for fresh seed...");
  const seedPage = await createAuthPage(browser, null);
  await seedPage.goto(`${BASE}/index.html`, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // Delete all docs from key collections so seedDatabaseIfEmpty() re-runs
  await seedPage.evaluate(async () => {
    const { getFirestore, collection, getDocs, deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js");
    const db = getFirestore();
    const collections = ["users", "projects", "checklistItems", "templateStages", "templateItems",
      "changeRequests", "notifications", "customers", "launchChecklists", "portalNotifications"];
    for (const colName of collections) {
      const snap = await getDocs(collection(db, colName));
      const deletes = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
      await Promise.all(deletes);
      console.log(`  Deleted ${snap.size} docs from ${colName}`);
    }
  });
  console.log("  ✅ Firestore cleared");

  // Close and reopen to trigger fresh seed
  console.log("🔧 Re-seeding database...");
  await seedPage.close();
  const seedPage2 = await createAuthPage(browser, null);
  await seedPage2.goto(`${BASE}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
  // Wait for seeding to complete — monitor console for completion message
  try {
    await seedPage2.waitForFunction(() => {
      return window.__seedComplete === true;
    }, { timeout: 120000 });
    console.log("  ✅ Seed complete (via flag)");
  } catch {
    // Fallback: just wait a long time
    console.log("  ⏳ Seed flag not found, waiting 30s...");
    await new Promise(r => setTimeout(r, 30000));
  }
  await seedPage2.close();

  // 1. Login page (no auth)
  await capture(browser, "manual-login.png", "/index.html", { role: null });

  // 2. Dashboard (worker)
  await capture(browser, "manual-dashboard.png", "/dashboard.html", { role: "worker" });

  // 3. Projects list (worker)
  await capture(browser, "manual-projects.png", "/projects.html", { role: "worker" });

  // 4. Checklist tab
  await capture(browser, "manual-checklist.png", "/project.html?id=proj1", { role: "worker", tab: "checklist" });

  // 5. Matrix view
  await capture(browser, "manual-matrix.png", "/projects.html", { role: "worker", view: "matrix" });

  // 6. Task detail (worker — complete button visible)
  await capture(browser, "manual-task-complete.png", "/project.html?id=proj1", {
    role: "worker",
    afterNav: async (page) => {
      // Navigate to checklist tab, find a task, then go to task page
      const tabBtn = await page.$('[data-tab="checklist"]');
      if (tabBtn) { await tabBtn.click(); await new Promise(r => setTimeout(r, 2000)); }
      const taskId = await page.evaluate(() => {
        const el = document.querySelector("[data-task-id]");
        return el ? el.dataset.taskId : null;
      });
      if (taskId) {
        await page.goto(`${BASE}/task.html?projectId=proj1&taskId=${taskId}`, { waitUntil: "networkidle2", timeout: 20000 });
        await waitForData(page);
      }
    },
  });

  // 7. Task detail (manager — approve/reject buttons)
  await capture(browser, "manual-task-approve.png", "/dashboard.html", {
    role: "manager",
    afterNav: async (page) => {
      await waitForData(page);
      const task = await page.evaluate(() => {
        const el = document.querySelector("[data-task-id]");
        return el ? { taskId: el.dataset.taskId, projectId: el.closest("[data-project-id]")?.dataset.projectId || "proj1" } : null;
      });
      const taskUrl = task
        ? `/task.html?projectId=${task.projectId}&taskId=${task.taskId}`
        : "/task.html?projectId=proj1&taskId=task1";
      await page.goto(`${BASE}${taskUrl}`, { waitUntil: "networkidle2", timeout: 20000 });
      await waitForData(page);
    },
  });

  // 8. Change request tab
  await capture(browser, "manual-change-request.png", "/project.html?id=proj1", { role: "worker", tab: "changes" });

  // 9. Launch tab
  await capture(browser, "manual-launch.png", "/project.html?id=proj1", { role: "worker", tab: "launch" });

  // 10. Customers
  await capture(browser, "manual-customers.png", "/customers.html", { role: "worker" });

  // 11. Customer portal (no auth, fill email)
  await capture(browser, "manual-portal.png", "/customer-portal.html", {
    role: null,
    afterNav: async (page) => {
      await new Promise(r => setTimeout(r, 2000));
      const emailInput = await page.$("#portal-email");
      if (emailInput) {
        await emailInput.type("portal@seoulmedical.co.kr", { delay: 50 });
        const loginBtn = await page.$("#portal-login-btn");
        if (loginBtn) await loginBtn.click();
        await new Promise(r => setTimeout(r, 4000));
      }
    },
  });

  // 12. Admin checklists (observer)
  await capture(browser, "manual-admin.png", "/admin-checklists.html", { role: "observer" });

  // 13. Sales dashboard (worker)
  await capture(browser, "manual-sales.png", "/sales.html", { role: "worker" });

  // 14. Calendar view
  await capture(browser, "manual-calendar.png", "/projects.html", { role: "worker", view: "calendar" });

  await browser.close();
  console.log("\n🎉 All screenshots captured!");
}

main().catch(console.error);
