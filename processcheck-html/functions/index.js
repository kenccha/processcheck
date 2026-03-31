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

// ─── Feature: 단계별 리마인더 에스컬레이션 ──────────────────────────────────

exports.dailyReminderEscalation = onSchedule(
  { schedule: "0 9 * * 1-5", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    // 1) Load reminder rules from config
    let rules = [
      { daysBefore: 3, recipients: ["assignee"], severity: "info" },
      { daysBefore: 1, recipients: ["assignee", "manager"], severity: "warning" },
      { daysBefore: 0, recipients: ["assignee", "manager"], severity: "warning" },
      { daysAfter: 1, recipients: ["manager", "coordinator"], severity: "danger" },
      { daysAfter: 3, recipients: ["coordinator"], severity: "critical" },
    ];

    try {
      const configDoc = await db.collection("config").doc("reminder-rules").get();
      if (configDoc.exists && configDoc.data().rules) {
        rules = configDoc.data().rules;
      }
    } catch (e) {
      console.warn("Using default reminder rules:", e.message);
    }

    if (!rules || rules.length === 0) {
      console.log("No reminder rules configured, skipping");
      return;
    }

    const webhookUrl = await getWebhookUrl("reminders");
    if (!webhookUrl) {
      console.log("No reminders webhook URL configured, skipping");
      return;
    }

    // 2) Load all active checklist items with due dates
    const tasksSnap = await db.collection("checklistItems")
      .where("status", "in", ["pending", "in_progress"])
      .get();

    if (tasksSnap.empty) {
      console.log("No active tasks to remind");
      return;
    }

    // 3) Load users for recipient resolution
    const usersSnap = await db.collection("users").get();
    const allUsers = {};
    usersSnap.docs.forEach(d => { allUsers[d.data().name] = { ...d.data(), id: d.id }; });

    // Find managers by department
    const managers = {};
    Object.values(allUsers).forEach(u => {
      if (u.role === "manager" && u.department) {
        managers[u.department] = u.name;
      }
    });

    // Find coordinators (observers)
    const coordinators = Object.values(allUsers)
      .filter(u => u.role === "observer")
      .map(u => u.name);

    // 4) Check today's sent reminders (dedup)
    const today = new Date().toISOString().split("T")[0];
    const sentSnap = await db.collection("reminders")
      .where("date", "==", today)
      .get();
    const sentKeys = new Set(sentSnap.docs.map(d => d.data().key));

    // 5) Process each task against rules
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let totalSent = 0;

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      if (!task.dueDate) continue;

      const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDate.getTime() - now.getTime()) / 86400000);

      // Find matching rule
      let matchedRule = null;
      for (const rule of rules) {
        if (rule.daysBefore !== undefined && diffDays === rule.daysBefore) {
          matchedRule = rule;
          break;
        }
        if (rule.daysAfter !== undefined && diffDays === -rule.daysAfter) {
          matchedRule = rule;
          break;
        }
      }
      // For continuous overdue (3+ days), match the highest daysAfter rule
      if (!matchedRule && diffDays < -3) {
        const overdueRules = rules.filter(r => r.daysAfter !== undefined).sort((a, b) => b.daysAfter - a.daysAfter);
        if (overdueRules.length > 0) matchedRule = overdueRules[0];
      }

      if (!matchedRule) continue;

      // Dedup key
      const dedupKey = `${taskDoc.id}-${matchedRule.severity}-${today}`;
      if (sentKeys.has(dedupKey)) continue;

      // Resolve recipients
      const recipientNames = new Set();
      for (const r of matchedRule.recipients) {
        if (r === "assignee" && task.assignee) recipientNames.add(task.assignee);
        if (r === "manager" && task.department && managers[task.department]) {
          recipientNames.add(managers[task.department]);
        }
        if (r === "coordinator") coordinators.forEach(c => recipientNames.add(c));
      }

      if (recipientNames.size === 0) continue;

      // Get project name
      let projectName = task.projectId;
      try {
        const pDoc = await db.collection("projects").doc(task.projectId).get();
        if (pDoc.exists) projectName = pDoc.data().name;
      } catch (_) {}

      // Build message
      const severityEmoji = { info: "📋", warning: "⚠️", danger: "🔴", critical: "🚨" };
      const severityColor = { info: "06B6D4", warning: "F59E0B", danger: "EF4444", critical: "EF4444" };
      const daysText = diffDays > 0 ? `마감 ${diffDays}일 전` : diffDays === 0 ? "오늘 마감" : `마감 ${Math.abs(diffDays)}일 초과`;

      const title = `${severityEmoji[matchedRule.severity] || "📋"} ${daysText}: ${task.title}`;
      const body = [
        `**프로젝트:** ${projectName}`,
        `**작업:** ${task.title}`,
        `**담당자:** ${task.assignee || "미배분"}`,
        `**부서:** ${task.department || "미정"}`,
        `**수신자:** ${[...recipientNames].join(", ")}`,
      ].join("\n\n");

      await sendTeamsMessage(webhookUrl, title, body, severityColor[matchedRule.severity] || "06B6D4");

      // Record sent reminder
      await db.collection("reminders").add({
        key: dedupKey,
        taskId: taskDoc.id,
        date: today,
        severity: matchedRule.severity,
        recipients: [...recipientNames],
        sentAt: new Date(),
      });

      totalSent++;
    }

    console.log(`Reminder escalation complete: ${totalSent} reminders sent`);
  }
);
