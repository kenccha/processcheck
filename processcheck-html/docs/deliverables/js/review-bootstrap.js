// ═══════════════════════════════════════════════════════════════════════════════
// Review Bootstrap — Standalone review system for deliverable pages
// Injects Firebase SDK, handles auth, renders FAB + review panel
// No ES module dependencies — works in any HTML page
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ─── Firebase Config ──────────────────────────────────────────────────────
  const FIREBASE_VERSION = "11.3.0";
  const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
    authDomain: "processsss-appp.firebaseapp.com",
    projectId: "processsss-appp",
    storageBucket: "processsss-appp.firebasestorage.app",
    messagingSenderId: "1041230235574",
    appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
  };

  // ─── State ────────────────────────────────────────────────────────────────
  let firebase = null;
  let db = null;
  let auth = null;
  let currentUser = null; // { id, name, email, authProvider }
  let reviews = [];
  let panelOpen = false;
  let filter = "all";
  let replyOpenId = null;
  let selectedType = "comment";
  let unsubscribe = null;
  let loaded = false;

  const pageId = detectPageId();

  function detectPageId() {
    const path = window.location.pathname;
    const filename = path.split("/").pop() || "index";
    return filename.replace(".html", "");
  }

  // ─── Load Firebase SDK ────────────────────────────────────────────────────
  async function loadFirebase() {
    if (loaded) return;
    const [appMod, firestoreMod, authMod] = await Promise.all([
      import(`${FIREBASE_CDN}/firebase-app.js`),
      import(`${FIREBASE_CDN}/firebase-firestore.js`),
      import(`${FIREBASE_CDN}/firebase-auth.js`)
    ]);

    const app = appMod.getApps().length === 0
      ? appMod.initializeApp(FIREBASE_CONFIG)
      : appMod.getApp();
    db = firestoreMod.getFirestore(app);
    auth = authMod.getAuth(app);

    firebase = { app: appMod, firestore: firestoreMod, auth: authMod };
    loaded = true;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("pc_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async function loginWithMicrosoft() {
    if (!firebase) await loadFirebase();
    const provider = new firebase.auth.OAuthProvider("microsoft.com");
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await firebase.auth.signInWithPopup(auth, provider);
      const user = result.user;
      // Check if user exists in pc_user localStorage
      const stored = getStoredUser();
      if (stored && stored.authProvider === "microsoft") {
        currentUser = stored;
      } else {
        // Create minimal user
        currentUser = {
          id: user.uid,
          name: user.displayName || user.email,
          email: user.email,
          authProvider: "microsoft"
        };
        localStorage.setItem("pc_user", JSON.stringify(currentUser));
      }
      return currentUser;
    } catch (err) {
      console.error("MS login failed:", err);
      throw err;
    }
  }

  // ─── Firestore Operations ─────────────────────────────────────────────────

  function subscribeReviews(callback) {
    if (!db) return () => {};
    const { collection, query, where, onSnapshot } = firebase.firestore;
    const q = query(collection(db, "reviews"), where("pageId", "==", pageId));
    return onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          replies: (data.replies || []).map(r => ({
            ...r,
            createdAt: r.createdAt?.toDate?.() || new Date()
          })),
          history: (data.history || []).map(h => ({
            ...h,
            at: h.at?.toDate?.() || new Date()
          }))
        };
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(items);
    });
  }

  async function addReview(type, content) {
    if (!currentUser || currentUser.authProvider !== "microsoft") {
      throw new Error("MS OAuth 인증 사용자만 리뷰를 작성할 수 있습니다");
    }
    const { addDoc, collection, Timestamp } = firebase.firestore;
    const now = Timestamp.now();
    return await addDoc(collection(db, "reviews"), {
      pageId,
      pageUrl: window.location.pathname,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorEmail: currentUser.email || "",
      type,
      status: "open",
      content,
      selector: null,
      votes: {},
      replies: [],
      history: [{ action: "created", by: currentUser.name, at: now, detail: "" }],
      createdAt: now,
      updatedAt: now
    });
  }

  async function toggleVote(reviewId, currentVotes) {
    if (!currentUser) return;
    const { updateDoc, doc, Timestamp } = firebase.firestore;
    const votes = { ...currentVotes };
    if (votes[currentUser.id] === "up") {
      delete votes[currentUser.id];
    } else {
      votes[currentUser.id] = "up";
    }
    await updateDoc(doc(db, "reviews", reviewId), { votes, updatedAt: Timestamp.now() });
  }

  async function addReplyToReview(reviewId, content, currentReplies) {
    if (!currentUser || currentUser.authProvider !== "microsoft") {
      throw new Error("MS OAuth 인증 사용자만 답글을 작성할 수 있습니다");
    }
    const { updateDoc, doc, Timestamp } = firebase.firestore;
    const now = Timestamp.now();
    const newReply = {
      authorId: currentUser.id,
      authorName: currentUser.name,
      content,
      createdAt: now
    };
    await updateDoc(doc(db, "reviews", reviewId), {
      replies: [...(currentReplies || []).map(r => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? Timestamp.fromDate(r.createdAt) : r.createdAt
      })), newReply],
      updatedAt: now
    });
  }

  async function updateReviewStatus(reviewId, review, newStatus) {
    if (!currentUser) return;
    const { updateDoc, doc, Timestamp } = firebase.firestore;
    const now = Timestamp.now();
    const updatedHistory = [
      ...(review.history || []).map(h => ({
        ...h,
        at: h.at instanceof Date ? Timestamp.fromDate(h.at) : h.at
      })),
      { action: `status_${newStatus}`, by: currentUser.name, at: now, detail: "" }
    ];
    await updateDoc(doc(db, "reviews", reviewId), {
      status: newStatus,
      updatedAt: now,
      history: updatedHistory
    });
  }

  async function deleteReviewDoc(reviewId) {
    const { deleteDoc, doc } = firebase.firestore;
    await deleteDoc(doc(db, "reviews", reviewId));
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function timeAgo(date) {
    if (!date) return "";
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
    return date.toLocaleDateString("ko-KR");
  }

  // ─── CSS Injection ────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("review-bootstrap-styles")) return;
    const style = document.createElement("style");
    style.id = "review-bootstrap-styles";
    style.textContent = `
      .review-fab {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 3.5rem;
        height: 3.5rem;
        border-radius: 50%;
        background: #06b6d4;
        color: #fff;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        box-shadow: 0 4px 16px rgba(6, 182, 212, 0.3);
        transition: transform 0.2s, box-shadow 0.2s;
        z-index: 9999;
      }
      .review-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 24px rgba(6, 182, 212, 0.4);
      }
      .review-fab-badge {
        position: absolute;
        top: -0.25rem;
        right: -0.25rem;
        min-width: 1.25rem;
        height: 1.25rem;
        padding: 0 0.375rem;
        border-radius: 999px;
        background: #ef4444;
        color: #fff;
        font-size: 0.6875rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .rb-panel {
        position: fixed;
        bottom: 6rem;
        right: 2rem;
        width: 26rem;
        max-height: calc(100vh - 8rem);
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        box-shadow: 0 20px 40px rgba(0,0,0,0.15);
        z-index: 9998;
        display: flex;
        flex-direction: column;
        animation: rb-fade-in 0.2s ease-out;
        font-family: 'Pretendard Variable', -apple-system, sans-serif;
      }
      [data-theme="dark"] .rb-panel {
        background: #1e293b;
        border-color: #334155;
      }
      @keyframes rb-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

      .rb-header {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
      }
      [data-theme="dark"] .rb-header { border-color: #334155; }
      .rb-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #334155;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      [data-theme="dark"] .rb-title { color: #e2e8f0; }
      .rb-badge { display:inline-flex; align-items:center; justify-content:center; min-width:1.25rem; height:1.25rem; padding:0 0.375rem; border-radius:999px; background:#f59e0b; color:#fff; font-size:0.6875rem; font-weight:600; }
      .rb-close { background:none; border:none; color:#64748b; cursor:pointer; padding:0.25rem; border-radius:0.25rem; font-size:1.25rem; line-height:1; }
      .rb-close:hover { color:#1e293b; background:#f1f5f9; }
      [data-theme="dark"] .rb-close:hover { color:#e2e8f0; background:#334155; }

      .rb-filters {
        display: flex;
        gap: 0.25rem;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e2e8f0;
        flex-shrink: 0;
      }
      [data-theme="dark"] .rb-filters { border-color: #334155; }
      .rb-filter-btn {
        background:none; border:1px solid transparent; border-radius:999px; padding:0.25rem 0.625rem;
        font-size:0.75rem; color:#64748b; cursor:pointer; transition:all 0.15s;
      }
      .rb-filter-btn:hover { color:#334155; background:#f1f5f9; }
      [data-theme="dark"] .rb-filter-btn:hover { color:#e2e8f0; background:#334155; }
      .rb-filter-btn.active { color:#06b6d4; background:rgba(6,182,212,0.08); border-color:rgba(6,182,212,0.3); }

      .rb-compose { padding:0.75rem; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
      [data-theme="dark"] .rb-compose { border-color:#334155; }
      .rb-compose-types { display:flex; gap:0.375rem; margin-bottom:0.5rem; }
      .rb-type-btn {
        background:#f1f5f9; border:1px solid #e2e8f0; border-radius:999px; padding:0.25rem 0.625rem;
        font-size:0.75rem; color:#475569; cursor:pointer; transition:all 0.15s;
      }
      [data-theme="dark"] .rb-type-btn { background:#334155; border-color:#475569; color:#94a3b8; }
      .rb-type-btn.active { background:rgba(6,182,212,0.08); border-color:#06b6d4; color:#0891b2; }
      .rb-textarea {
        width:100%; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:0.5rem;
        padding:0.5rem 0.75rem; font-size:0.8125rem; color:#1e293b; resize:vertical; min-height:3rem;
        font-family:inherit; box-sizing:border-box;
      }
      [data-theme="dark"] .rb-textarea { background:#0f172a; border-color:#334155; color:#e2e8f0; }
      .rb-textarea:focus { outline:none; border-color:#06b6d4; }
      .rb-compose-actions { display:flex; justify-content:flex-end; margin-top:0.5rem; }
      .rb-submit {
        background:#06b6d4; color:#fff; border:none; border-radius:0.375rem; padding:0.375rem 0.75rem;
        font-size:0.75rem; font-weight:500; cursor:pointer; transition:background 0.15s;
      }
      .rb-submit:hover { background:#0891b2; }
      .rb-submit:disabled { opacity:0.5; cursor:not-allowed; }

      .rb-login-prompt {
        padding:1rem; text-align:center; border-bottom:1px solid #e2e8f0; flex-shrink:0;
      }
      [data-theme="dark"] .rb-login-prompt { border-color:#334155; }
      .rb-login-text { font-size:0.75rem; color:#64748b; margin-bottom:0.5rem; }
      .rb-login-btn {
        background:#0078d4; color:#fff; border:none; border-radius:0.375rem; padding:0.5rem 1rem;
        font-size:0.8125rem; font-weight:500; cursor:pointer; transition:background 0.15s;
      }
      .rb-login-btn:hover { background:#106ebe; }

      .rb-body { overflow-y:auto; flex:1; min-height:0; }
      .rb-empty {
        display:flex; flex-direction:column; align-items:center; gap:0.5rem; padding:3rem 1rem;
        color:#64748b; font-size:0.8125rem;
      }
      .rb-empty-icon { font-size:1.5rem; }

      .rb-card { padding:0.75rem 1rem; border-bottom:1px solid #e2e8f0; transition:background 0.15s; }
      [data-theme="dark"] .rb-card { border-color:#334155; }
      .rb-card:hover { background:#f8fafc; }
      [data-theme="dark"] .rb-card:hover { background:#0f172a; }
      .rb-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem; }
      .rb-card-meta { display:flex; align-items:center; gap:0.5rem; }
      .rb-type-tag { font-size:0.6875rem; font-weight:500; }
      .rb-status-tag { font-size:0.625rem; font-weight:600; color:#fff; padding:0.0625rem 0.375rem; border-radius:999px; }
      .rb-card-time { font-size:0.6875rem; color:#94a3b8; }
      .rb-card-author { font-size:0.75rem; font-weight:500; color:#475569; margin-bottom:0.375rem; }
      [data-theme="dark"] .rb-card-author { color:#94a3b8; }
      .rb-card-content { font-size:0.8125rem; color:#334155; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
      [data-theme="dark"] .rb-card-content { color:#e2e8f0; }

      .rb-card-actions { display:flex; gap:0.25rem; margin-top:0.5rem; flex-wrap:wrap; }
      .rb-action {
        background:none; border:1px solid transparent; border-radius:999px; padding:0.1875rem 0.5rem;
        font-size:0.6875rem; color:#64748b; cursor:pointer; transition:all 0.15s;
      }
      .rb-action:hover { background:#f1f5f9; color:#334155; }
      [data-theme="dark"] .rb-action:hover { background:#334155; color:#e2e8f0; }
      .rb-action.voted { background:rgba(6,182,212,0.08); color:#0891b2; border-color:rgba(6,182,212,0.3); }
      .rb-action.delete:hover { background:#fef2f2; color:#ef4444; }

      .rb-replies { margin-top:0.5rem; padding-left:0.75rem; border-left:2px solid #e2e8f0; }
      [data-theme="dark"] .rb-replies { border-color:#334155; }
      .rb-reply { padding:0.375rem 0; }
      .rb-reply + .rb-reply { border-top:1px solid #e2e8f0; }
      [data-theme="dark"] .rb-reply + .rb-reply { border-color:#334155; }
      .rb-reply-author { font-size:0.6875rem; font-weight:500; color:#475569; }
      [data-theme="dark"] .rb-reply-author { color:#94a3b8; }
      .rb-reply-content { font-size:0.75rem; color:#334155; line-height:1.4; white-space:pre-wrap; }
      [data-theme="dark"] .rb-reply-content { color:#e2e8f0; }
      .rb-reply-time { font-size:0.625rem; color:#94a3b8; margin-top:0.125rem; }

      .rb-reply-compose { margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid #e2e8f0; }
      [data-theme="dark"] .rb-reply-compose { border-color:#334155; }
      .rb-reply-input {
        width:100%; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:0.5rem;
        padding:0.375rem 0.625rem; font-size:0.75rem; color:#1e293b; resize:vertical; min-height:2rem;
        font-family:inherit; box-sizing:border-box;
      }
      [data-theme="dark"] .rb-reply-input { background:#0f172a; border-color:#334155; color:#e2e8f0; }
      .rb-reply-actions { display:flex; gap:0.375rem; justify-content:flex-end; margin-top:0.375rem; }
      .rb-reply-submit { background:#06b6d4; color:#fff; border:none; border-radius:0.375rem; padding:0.25rem 0.625rem; font-size:0.6875rem; cursor:pointer; }
      .rb-reply-cancel { background:none; border:1px solid #e2e8f0; border-radius:0.375rem; padding:0.25rem 0.625rem; font-size:0.6875rem; cursor:pointer; color:#64748b; }
    `;
    document.head.appendChild(style);
  }

  // ─── Type/Status Labels ───────────────────────────────────────────────────

  const TYPES = {
    comment: { label: "코멘트", icon: "💬", color: "#06b6d4" },
    issue: { label: "이슈", icon: "⚠️", color: "#f59e0b" },
    approval: { label: "승인", icon: "✅", color: "#22c55e" }
  };
  const STATUSES = {
    open: { label: "미해결", color: "#f59e0b" },
    resolved: { label: "해결됨", color: "#22c55e" },
    wontfix: { label: "보류", color: "#94a3b8" }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  function getFiltered() {
    if (filter === "all") return reviews;
    if (filter === "open") return reviews.filter(r => r.status === "open");
    if (filter === "resolved") return reviews.filter(r => r.status === "resolved");
    if (filter === "issue") return reviews.filter(r => r.type === "issue");
    return reviews;
  }

  function renderPanel() {
    const root = document.getElementById("rb-panel-root");
    if (!root) return;

    if (!panelOpen) { root.innerHTML = ""; return; }

    const canWrite = currentUser?.authProvider === "microsoft";
    const filtered = getFiltered();
    const openCount = reviews.filter(r => r.status === "open").length;

    root.innerHTML = `
      <div class="rb-panel">
        <div class="rb-header">
          <div class="rb-title">
            <span>리뷰</span>
            <span class="rb-badge">${openCount}</span>
          </div>
          <button class="rb-close" id="rb-close">&times;</button>
        </div>

        <div class="rb-filters">
          ${["all","open","resolved","issue"].map(f => `
            <button class="rb-filter-btn${filter===f?" active":""}" data-filter="${f}">
              ${{all:"전체",open:"미해결",resolved:"해결됨",issue:"이슈"}[f]}
            </button>
          `).join("")}
        </div>

        ${canWrite ? `
          <div class="rb-compose">
            <div class="rb-compose-types">
              ${Object.entries(TYPES).map(([k,v]) => `
                <button class="rb-type-btn${selectedType===k?" active":""}" data-type="${k}">${v.icon} ${v.label}</button>
              `).join("")}
            </div>
            <textarea class="rb-textarea" id="rb-input" placeholder="리뷰를 작성하세요..." rows="3"></textarea>
            <div class="rb-compose-actions">
              <button class="rb-submit" id="rb-submit" disabled>등록</button>
            </div>
          </div>
        ` : `
          <div class="rb-login-prompt">
            <div class="rb-login-text">${currentUser ? "MS OAuth 인증 사용자만 리뷰를 작성할 수 있습니다" : "리뷰를 작성하려면 로그인하세요"}</div>
            ${!currentUser ? `<button class="rb-login-btn" id="rb-login">Microsoft 계정으로 로그인</button>` : ""}
          </div>
        `}

        <div class="rb-body">
          ${filtered.length === 0 ? `
            <div class="rb-empty">
              <span class="rb-empty-icon">📝</span>
              <span>리뷰가 없습니다</span>
            </div>
          ` : filtered.map(r => renderCard(r)).join("")}
        </div>
      </div>
    `;

    bindPanelEvents();
  }

  function renderCard(r) {
    const t = TYPES[r.type] || TYPES.comment;
    const s = STATUSES[r.status] || STATUSES.open;
    const canModify = currentUser && (currentUser.id === r.authorId || currentUser.role === "observer");
    const upVotes = Object.values(r.votes || {}).filter(v => v === "up").length;
    const hasVoted = currentUser && r.votes?.[currentUser.id] === "up";
    const canWrite = currentUser?.authProvider === "microsoft";

    return `
      <div class="rb-card" data-rid="${r.id}">
        <div class="rb-card-header">
          <div class="rb-card-meta">
            <span class="rb-type-tag" style="color:${t.color}">${t.icon} ${t.label}</span>
            <span class="rb-status-tag" style="background:${s.color}">${s.label}</span>
          </div>
          <span class="rb-card-time">${timeAgo(r.createdAt)}</span>
        </div>
        <div class="rb-card-author">${escapeHtml(r.authorName)}</div>
        <div class="rb-card-content">${escapeHtml(r.content)}</div>
        <div class="rb-card-actions">
          <button class="rb-action${hasVoted?" voted":""}" data-act="vote" data-rid="${r.id}">👍 ${upVotes||""}</button>
          ${canWrite ? `<button class="rb-action" data-act="reply" data-rid="${r.id}">💬 답글</button>` : ""}
          ${canModify && r.status==="open" ? `
            <button class="rb-action" data-act="resolve" data-rid="${r.id}">✓ 해결</button>
            <button class="rb-action" data-act="wontfix" data-rid="${r.id}">— 보류</button>
          ` : ""}
          ${canModify && r.status!=="open" ? `<button class="rb-action" data-act="reopen" data-rid="${r.id}">↩ 재오픈</button>` : ""}
          ${currentUser && currentUser.id===r.authorId ? `<button class="rb-action delete" data-act="delete" data-rid="${r.id}">🗑</button>` : ""}
        </div>
        ${r.replies?.length ? `
          <div class="rb-replies">
            ${r.replies.map(rp => `
              <div class="rb-reply">
                <div class="rb-reply-author">${escapeHtml(rp.authorName)}</div>
                <div class="rb-reply-content">${escapeHtml(rp.content)}</div>
                <div class="rb-reply-time">${timeAgo(rp.createdAt)}</div>
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${replyOpenId===r.id ? `
          <div class="rb-reply-compose">
            <textarea class="rb-reply-input" data-rid="${r.id}" placeholder="답글 입력..." rows="2"></textarea>
            <div class="rb-reply-actions">
              <button class="rb-reply-submit" data-act="submit-reply" data-rid="${r.id}">등록</button>
              <button class="rb-reply-cancel" data-act="cancel-reply" data-rid="${r.id}">취소</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  function bindPanelEvents() {
    const panel = document.querySelector(".rb-panel");
    if (!panel) return;

    panel.querySelector("#rb-close")?.addEventListener("click", () => { panelOpen = false; renderPanel(); });

    // Login
    panel.querySelector("#rb-login")?.addEventListener("click", async () => {
      try {
        await loginWithMicrosoft();
        renderPanel();
        renderFab();
      } catch (e) { alert("로그인 실패: " + e.message); }
    });

    // Filters
    panel.querySelectorAll(".rb-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => { filter = btn.dataset.filter; renderPanel(); });
    });

    // Type selection
    panel.querySelectorAll(".rb-type-btn").forEach(btn => {
      btn.addEventListener("click", () => { selectedType = btn.dataset.type; renderPanel(); });
    });

    // Compose
    const input = panel.querySelector("#rb-input");
    const submit = panel.querySelector("#rb-submit");
    if (input && submit) {
      input.addEventListener("input", () => { submit.disabled = !input.value.trim(); });
      submit.addEventListener("click", async () => {
        const content = input.value.trim();
        if (!content) return;
        submit.disabled = true; submit.textContent = "등록 중...";
        try { await addReview(selectedType, content); input.value = ""; } catch (e) { alert(e.message); }
        submit.disabled = false; submit.textContent = "등록";
      });
    }

    // Card actions
    panel.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const rid = btn.dataset.rid;
        const review = reviews.find(r => r.id === rid);
        if (!review) return;
        switch (act) {
          case "vote": await toggleVote(rid, review.votes); break;
          case "reply": replyOpenId = replyOpenId===rid ? null : rid; renderPanel(); break;
          case "resolve": await updateReviewStatus(rid, review, "resolved"); break;
          case "wontfix": await updateReviewStatus(rid, review, "wontfix"); break;
          case "reopen": await updateReviewStatus(rid, review, "open"); break;
          case "delete":
            if (confirm("이 리뷰를 삭제하시겠습니까?")) await deleteReviewDoc(rid);
            break;
          case "submit-reply": {
            const ta = panel.querySelector(`.rb-reply-input[data-rid="${rid}"]`);
            const c = ta?.value?.trim();
            if (!c) return;
            btn.disabled = true;
            try { await addReplyToReview(rid, c, review.replies); replyOpenId = null; } catch(e) { alert(e.message); }
            break;
          }
          case "cancel-reply": replyOpenId = null; renderPanel(); break;
        }
      });
    });
  }

  // ─── FAB Button ───────────────────────────────────────────────────────────

  function renderFab() {
    let fab = document.getElementById("rb-fab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "rb-fab";
      fab.className = "review-fab";
      document.body.appendChild(fab);
      fab.addEventListener("click", () => { panelOpen = !panelOpen; renderPanel(); });
    }
    const openCount = reviews.filter(r => r.status === "open").length;
    fab.innerHTML = `💬${openCount > 0 ? `<span class="review-fab-badge">${openCount}</span>` : ""}`;
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    injectStyles();

    // Panel root
    let panelRoot = document.getElementById("rb-panel-root");
    if (!panelRoot) {
      panelRoot = document.createElement("div");
      panelRoot.id = "rb-panel-root";
      document.body.appendChild(panelRoot);
    }

    // Check stored user
    currentUser = getStoredUser();

    // Load Firebase
    try {
      await loadFirebase();
    } catch (e) {
      console.error("Failed to load Firebase:", e);
      return;
    }

    // Subscribe to reviews
    unsubscribe = subscribeReviews((items) => {
      reviews = items;
      renderFab();
      if (panelOpen) renderPanel();
    });

    renderFab();

    // Close panel on outside click
    document.addEventListener("click", (e) => {
      if (!panelOpen) return;
      const panel = document.querySelector(".rb-panel");
      const fab = document.getElementById("rb-fab");
      if (panel && !panel.contains(e.target) && fab && !fab.contains(e.target)) {
        panelOpen = false;
        renderPanel();
      }
    });
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
