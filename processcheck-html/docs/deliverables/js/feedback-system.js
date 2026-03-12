// ═══════════════════════════════════════════════════════════════
// Feedback System — 디자인 리뷰 피드백
// Firestore 연동 + 페이지별 피드백 위젯
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, updateDoc, doc, getDoc, getDocs,
  onSnapshot, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, increment, Timestamp
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase init (reuse if already initialized)
const firebaseConfig = {
  apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
  authDomain: "processsss-appp.firebaseapp.com",
  projectId: "processsss-appp",
  storageBucket: "processsss-appp.firebasestorage.app",
  messagingSenderId: "1041230235574",
  appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
};
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// ─── Page Registry ──────────────────────────────────────────
export const PAGES = [
  { id: "wireframes", file: "wireframes.html", name: "전체 화면 설계", category: "UI 설계", icon: "📱" },
  { id: "user-flows", file: "user-flows.html", name: "업무 흐름", category: "프로세스", icon: "🔀" },
  { id: "diagrams", file: "diagram-viewer.html", name: "시스템 구조", category: "시스템", icon: "📐" },
];

export function getPageInfo() {
  const file = location.pathname.split("/").pop();
  return PAGES.find(p => p.file === file) || null;
}

// ─── Firestore CRUD ─────────────────────────────────────────

export async function addFeedback({ pageId, pageName, content, section, type, priority, authorName, authorEmail, screenshot, screenshots }) {
  // Support both single screenshot (legacy) and multiple screenshots array
  const ssArray = screenshots && screenshots.length > 0
    ? screenshots
    : (screenshot ? [screenshot] : []);
  const feedbackRef = await addDoc(collection(db, "feedbacks"), {
    pageId, pageName, content,
    section: section || "",
    type: type || "suggestion",
    priority: priority || "medium",
    status: "open",
    author: { name: authorName, email: authorEmail || "" },
    screenshot: ssArray[0] || "",  // backward compat: first screenshot
    screenshots: ssArray,           // all screenshots array
    createdAt: serverTimestamp(),
    votes: 0,
    votedBy: [],
    resolution: "",
    resolvedBy: null,
    resolvedAt: null,
  });

  // ── 이메일 알림: 새 피드백 등록 시 observer(기획조정실)에게 ──
  _notifyNewFeedback({ authorName, authorEmail, pageName: pageName || pageId, content, type }).catch(console.error);

  return feedbackRef;
}

export async function updateFeedbackStatus(feedbackId, status, resolution, resolverName) {
  const updates = { status };
  if (resolution !== undefined) updates.resolution = resolution;
  if (status === "resolved" || status === "wontfix") {
    updates.resolvedBy = resolverName || null;
    updates.resolvedAt = serverTimestamp();
  }
  await updateDoc(doc(db, "feedbacks", feedbackId), updates);

  // ── 이메일 알림: 해결/보류 시 작성자에게 ──
  if (status === "resolved" || status === "wontfix") {
    _notifyFeedbackResolved(feedbackId, status, resolverName).catch(console.error);
  }
}

export async function voteFeedback(feedbackId, userName) {
  return updateDoc(doc(db, "feedbacks", feedbackId), {
    votes: increment(1),
    votedBy: arrayUnion(userName),
  });
}

export async function unvoteFeedback(feedbackId, userName) {
  return updateDoc(doc(db, "feedbacks", feedbackId), {
    votes: increment(-1),
    votedBy: arrayRemove(userName),
  });
}

// Subscribe to feedbacks for a specific page
export function subscribeFeedbacks(pageId, callback) {
  const q = query(
    collection(db, "feedbacks"),
    where("pageId", "==", pageId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

// Subscribe to ALL feedbacks (for dashboard)
export function subscribeAllFeedbacks(callback) {
  const q = query(collection(db, "feedbacks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

// ─── Email Queue (Firebase Trigger Email Extension) ─────────
async function _queueEmail({ to, subject, html }) {
  const toList = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (toList.length === 0) return;
  await addDoc(collection(db, "mail"), {
    to: toList,
    message: { subject: subject || "(ProcessCheck 알림)", html: html || "" },
    createdAt: Timestamp.now(),
  });
}

function _escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 새 피드백 → observer(기획조정실) 전원에게 이메일 + 인앱 알림 */
async function _notifyNewFeedback({ authorName, authorEmail, pageName, content, type }) {
  const typeLabel = { bug: "버그", suggestion: "제안", question: "질문", praise: "칭찬" }[type] || type || "피드백";
  const snippet = (content || "").length > 50 ? content.slice(0, 50) + "…" : (content || "");
  const subject = `[ProcessCheck] 새 ${typeLabel}: ${pageName}`;
  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;">
      <h3 style="margin:0 0 8px;">새 ${typeLabel}가 등록되었습니다</h3>
      <p style="color:#64748b;margin:4px 0;">페이지: <strong>${_escapeHtml(pageName)}</strong></p>
      <p style="color:#64748b;margin:4px 0;">작성자: <strong>${_escapeHtml(authorName)}</strong></p>
      <div style="background:#f8fafc;border-left:3px solid #3b82f6;padding:12px;margin:12px 0;border-radius:4px;">
        ${_escapeHtml(snippet)}
      </div>
      <a href="https://processsss-appp.web.app/docs/deliverables/feedback.html" style="color:#3b82f6;">ProcessCheck에서 확인하기 →</a>
    </div>`;

  try {
    // observer 역할 사용자 조회 (users 컬렉션)
    const usersSnap = await getDocs(collection(db, "users"));
    const observers = usersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "observer" && u.email && u.email !== authorEmail);

    // 인앱 알림
    for (const obs of observers) {
      await addDoc(collection(db, "notifications"), {
        userId: obs.id,
        type: "feedback",
        title: `새 ${typeLabel}: ${pageName}`,
        message: `${authorName}님이 ${typeLabel}를 작성했습니다: "${snippet}"`,
        link: "docs/deliverables/feedback.html",
        read: false,
        createdAt: Timestamp.now(),
      });
    }

    // 이메일 (Firebase Trigger Email 확장 필요)
    const emails = observers.map(o => o.email).filter(Boolean);
    if (emails.length > 0) {
      await _queueEmail({ to: emails, subject, html: htmlBody });
    }
  } catch (err) {
    console.warn("피드백 알림 전송 실패:", err);
  }
}

/** 피드백 해결/보류 → 원 작성자에게 이메일 + 인앱 알림 */
async function _notifyFeedbackResolved(feedbackId, status, resolverName) {
  try {
    const feedbackSnap = await getDoc(doc(db, "feedbacks", feedbackId));
    if (!feedbackSnap.exists()) return;
    const fb = feedbackSnap.data();
    const author = fb.author || {};

    // 자기가 쓴 피드백을 자기가 해결하면 알림 불필요
    if (author.name === resolverName) return;

    const statusLabel = status === "resolved" ? "해결됨" : "보류";
    const snippet = (fb.content || "").length > 50 ? fb.content.slice(0, 50) + "…" : (fb.content || "");
    const subject = `[ProcessCheck] 피드백 ${statusLabel}: ${fb.pageName || fb.pageId}`;
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:600px;">
        <h3 style="margin:0 0 8px;">피드백이 ${statusLabel} 처리되었습니다</h3>
        <p style="color:#64748b;margin:4px 0;">페이지: <strong>${_escapeHtml(fb.pageName || fb.pageId || "")}</strong></p>
        <p style="color:#64748b;margin:4px 0;">처리자: <strong>${_escapeHtml(resolverName || "")}</strong></p>
        ${fb.resolution ? `<p style="color:#64748b;margin:4px 0;">해결 내용: ${_escapeHtml(fb.resolution)}</p>` : ""}
        <div style="background:#f8fafc;border-left:3px solid ${status === "resolved" ? "#22c55e" : "#94a3b8"};padding:12px;margin:12px 0;border-radius:4px;">
          ${_escapeHtml(snippet)}
        </div>
        <a href="https://processsss-appp.web.app/docs/deliverables/feedback.html" style="color:#3b82f6;">ProcessCheck에서 확인하기 →</a>
      </div>`;

    // 이메일 — 작성자에게
    if (author.email) {
      await _queueEmail({ to: author.email, subject, html: htmlBody });
    }

    // 인앱 알림 — 작성자 이름으로 users 컬렉션 검색
    if (author.name) {
      const uq = query(collection(db, "users"), where("name", "==", author.name));
      const uSnap = await getDocs(uq);
      if (!uSnap.empty) {
        const authorUser = uSnap.docs[0];
        await addDoc(collection(db, "notifications"), {
          userId: authorUser.id,
          type: "feedback",
          title: `피드백 ${statusLabel}: ${fb.pageName || fb.pageId}`,
          message: `${resolverName}님이 피드백을 ${statusLabel} 처리했습니다: "${snippet}"`,
          link: "docs/deliverables/feedback.html",
          read: false,
          createdAt: Timestamp.now(),
        });
      }
    }
  } catch (err) {
    console.warn("피드백 해결 알림 전송 실패:", err);
  }
}

// ─── Get current user (from localStorage like main app) ─────
export function getCurrentUser() {
  try {
    const stored = localStorage.getItem("pc_user");
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

// ─── Time formatting ────────────────────────────────────────
export function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR");
}
