// ═══════════════════════════════════════════════════════════════
// Feedback System — 디자인 리뷰 피드백
// Firestore 연동 + 페이지별 피드백 위젯
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, updateDoc, doc,
  onSnapshot, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, increment
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
  return addDoc(collection(db, "feedbacks"), {
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
}

export async function updateFeedbackStatus(feedbackId, status, resolution, resolverName) {
  const updates = { status };
  if (resolution !== undefined) updates.resolution = resolution;
  if (status === "resolved" || status === "wontfix") {
    updates.resolvedBy = resolverName || null;
    updates.resolvedAt = serverTimestamp();
  }
  return updateDoc(doc(db, "feedbacks", feedbackId), updates);
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
