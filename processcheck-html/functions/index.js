const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// ─── Helper: Send Teams Webhook ─────────────────────────────────────────────

async function sendTeamsMessage(webhookUrl, title, body, color = "06B6D4") {
  if (!webhookUrl) {
    console.warn("Teams webhook URL not configured");
    return false;
  }

  const card = {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color,
    summary: title,
    sections: [{
      activityTitle: title,
      text: body,
      markdown: true,
    }],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card),
  });

  if (!res.ok) {
    console.error(`Teams webhook failed: ${res.status} ${res.statusText}`);
    return false;
  }
  return true;
}

// ─── Helper: Get webhook URL from config ────────────────────────────────────

async function getWebhookUrl(type = "general") {
  const doc = await db.collection("config").doc("teams-webhooks").get();
  if (!doc.exists) return null;
  return doc.data()[type] || doc.data().general || null;
}

// ─── Feature 4: 월요일 아침 주간 요약 ──────────────────────────────────────

exports.weeklyReportToTeams = onSchedule(
  { schedule: "0 8 * * 1", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const webhookUrl = await getWebhookUrl("weekly");
    if (!webhookUrl) {
      console.log("No weekly webhook URL configured, skipping");
      return;
    }

    // Get active projects
    const projectsSnap = await db.collection("projects")
      .where("status", "==", "active")
      .get();

    if (projectsSnap.empty) {
      await sendTeamsMessage(webhookUrl, "📊 ProcessCheck 주간 요약", "활성 프로젝트가 없습니다.");
      return;
    }

    // Get all checklist items
    const tasksSnap = await db.collection("checklistItems").get();
    const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const lines = [];
    let totalOverdue = 0;

    projectsSnap.docs.forEach(doc => {
      const p = { id: doc.id, ...doc.data() };
      const tasks = allTasks.filter(t => t.projectId === p.id);
      const active = tasks.filter(t => t.status !== "completed" && t.status !== "rejected");
      const overdue = active.filter(t => {
        if (!t.dueDate) return false;
        const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
        return due < now;
      });

      totalOverdue += overdue.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
      const health = overdue.length === 0 ? "🟢" : overdue.length <= 3 ? "🟡" : "🔴";

      lines.push(`${health} **${p.name}** — 완료율 ${rate}%, 지연 ${overdue.length}건`);
    });

    const title = `📊 ProcessCheck 주간 요약 (${now.getMonth() + 1}/${now.getDate()})`;
    const body = [
      `**프로젝트 ${projectsSnap.size}건** | 지연 작업 ${totalOverdue}건`,
      "",
      ...lines,
      "",
      "[ProcessCheck 열기](https://processsss-appp.web.app/processcheck.html)",
    ].join("\n\n");

    await sendTeamsMessage(webhookUrl, title, body, totalOverdue > 5 ? "EF4444" : "06B6D4");
    console.log(`Weekly report sent: ${projectsSnap.size} projects, ${totalOverdue} overdue`);
  }
);

// ─── Feature 5: 영업 자동 알림 (게이트 통과 시) ────────────────────────────

exports.salesAlertOnGatePass = onDocumentUpdated(
  { document: "checklistItems/{itemId}", region: "asia-northeast3" },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    // Only trigger when status changes to "completed" on a gate stage
    if (before.status === after.status) return;
    if (after.status !== "completed") return;

    const gateStages = ["발의승인", "기획승인", "WM승인회", "Tx승인회", "MSG승인회", "영업이관"];
    if (!gateStages.includes(after.stage)) return;

    const webhookUrl = await getWebhookUrl("sales");
    if (!webhookUrl) {
      console.log("No sales webhook URL configured, skipping");
      return;
    }

    // Get project name
    let projectName = after.projectId;
    try {
      const projDoc = await db.collection("projects").doc(after.projectId).get();
      if (projDoc.exists) projectName = projDoc.data().name;
    } catch (e) {
      console.warn("Could not fetch project name:", e.message);
    }

    const title = `🚀 게이트 통과: ${projectName}`;
    const body = [
      `**${projectName}** 프로젝트의 **${after.stage}** 단계가 완료되었습니다.`,
      "",
      `- 단계: ${after.stage}`,
      `- 부서: ${after.department || "미정"}`,
      `- 완료자: ${after.assignee || "미배분"}`,
      "",
      "[프로젝트 상세 보기](https://processsss-appp.web.app/project.html?id=" + after.projectId + ")",
    ].join("\n\n");

    // Use warning color for final stage (영업이관)
    const color = after.stage === "영업이관" ? "22C55E" : "06B6D4";
    await sendTeamsMessage(webhookUrl, title, body, color);
    console.log(`Sales alert sent: ${projectName} - ${after.stage}`);
  }
);
