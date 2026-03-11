// ═══════════════════════════════════════════════════════════════════════════════
// Review System — Inline review/feedback for all pages
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from "./firebase-init.js";
import { showToast } from "./ui/toast.js";
import { getUser } from "./auth.js";
import { escapeHtml, timeAgo } from "./utils.js";
import { createNotification } from "./firestore-service.js";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  query, where, Timestamp
} from "firebase/firestore";

// ─── Page ID Detection ──────────────────────────────────────────────────────

function detectPageId() {
  const path = window.location.pathname;
  const filename = path.split("/").pop() || "index.html";
  return filename.replace(".html", "");
}

// ─── Firestore Operations ───────────────────────────────────────────────────

export function subscribeReviews(pageId, callback) {
  const q = query(
    collection(db, "reviews"),
    where("pageId", "==", pageId)
  );
  return onSnapshot(q, (snap) => {
    const reviews = snap.docs
      .map(d => {
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
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(reviews);
  });
}

export async function addReview({ pageId, type, content }) {
  const user = getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  if (user.authProvider !== "microsoft") throw new Error("MS OAuth 인증 사용자만 리뷰를 작성할 수 있습니다");

  const now = Timestamp.now();
  return await addDoc(collection(db, "reviews"), {
    pageId,
    pageUrl: window.location.pathname,
    authorId: user.id,
    authorName: user.name,
    authorEmail: user.email || "",
    type,
    status: "open",
    content,
    selector: null,
    votes: {},
    replies: [],
    history: [{ action: "created", by: user.name, at: now, detail: "" }],
    createdAt: now,
    updatedAt: now
  });
}

export async function updateReviewStatus(reviewId, newStatus) {
  const user = getUser();
  if (!user) return;
  const now = Timestamp.now();
  await updateDoc(doc(db, "reviews", reviewId), {
    status: newStatus,
    updatedAt: now,
    history: await getUpdatedHistory(reviewId, {
      action: `status_${newStatus}`, by: user.name, at: now, detail: ""
    })
  });
}

async function getUpdatedHistory(reviewId, newEntry) {
  // We'll use arrayUnion-like approach — but since history is an array of objects,
  // we read+append via the update. For simplicity, we use the local review data.
  // The caller should pass the current history from the local state.
  return; // handled inline in the panel
}

export async function addReply(reviewId, content, currentReplies) {
  const user = getUser();
  if (!user) throw new Error("로그인이 필요합니다");
  if (user.authProvider !== "microsoft") throw new Error("MS OAuth 인증 사용자만 답글을 작성할 수 있습니다");

  const now = Timestamp.now();
  const newReply = {
    authorId: user.id,
    authorName: user.name,
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

export async function toggleVote(reviewId, currentVotes) {
  const user = getUser();
  if (!user) return;
  const votes = { ...currentVotes };
  if (votes[user.id] === "up") {
    delete votes[user.id];
  } else {
    votes[user.id] = "up";
  }
  await updateDoc(doc(db, "reviews", reviewId), { votes, updatedAt: Timestamp.now() });
}

export async function deleteReview(reviewId) {
  await deleteDoc(doc(db, "reviews", reviewId));
}

// ─── Review Panel UI ────────────────────────────────────────────────────────

const TYPE_LABELS = {
  comment: { label: "코멘트", icon: "💬", color: "var(--primary-500)" },
  issue: { label: "이슈", icon: "⚠️", color: "var(--warning-500)" },
  approval: { label: "승인", icon: "✅", color: "var(--success-500)" }
};

const STATUS_LABELS = {
  open: { label: "미해결", color: "var(--warning-500)" },
  resolved: { label: "해결됨", color: "var(--success-500)" },
  wontfix: { label: "보류", color: "var(--slate-400)" }
};

export class ReviewPanel {
  constructor(container) {
    this.container = container;
    this.pageId = detectPageId();
    this.reviews = [];
    this.isOpen = false;
    this.filter = "all"; // all | open | resolved | issue
    this.unsubscribe = null;
    this.replyOpenId = null;
  }

  init() {
    this.unsubscribe = subscribeReviews(this.pageId, (reviews) => {
      this.reviews = reviews;
      if (this.isOpen) this.render();
    });
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.render();
    } else {
      this.container.innerHTML = "";
    }
  }

  close() {
    this.isOpen = false;
    this.container.innerHTML = "";
  }

  getFilteredReviews() {
    if (this.filter === "all") return this.reviews;
    if (this.filter === "open") return this.reviews.filter(r => r.status === "open");
    if (this.filter === "resolved") return this.reviews.filter(r => r.status === "resolved");
    if (this.filter === "issue") return this.reviews.filter(r => r.type === "issue");
    return this.reviews;
  }

  render() {
    const user = getUser();
    const canWrite = user?.authProvider === "microsoft";
    const filtered = this.getFilteredReviews();
    const openCount = this.reviews.filter(r => r.status === "open").length;

    this.container.innerHTML = `
      <div class="review-panel">
        <div class="review-panel-header">
          <div class="review-panel-title">
            <span>리뷰</span>
            <span class="review-count-badge">${openCount}</span>
          </div>
          <button class="review-panel-close" id="review-close-btn">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="review-filter-bar">
          ${["all", "open", "resolved", "issue"].map(f => `
            <button class="review-filter-btn${this.filter === f ? " active" : ""}" data-filter="${f}">
              ${{ all: "전체", open: "미해결", resolved: "해결됨", issue: "이슈" }[f]}
              ${f !== "all" ? `<span class="review-filter-count">${
                f === "issue" ? this.reviews.filter(r => r.type === "issue").length
                : this.reviews.filter(r => r.status === f).length
              }</span>` : ""}
            </button>
          `).join("")}
        </div>

        ${canWrite ? `
          <div class="review-compose">
            <div class="review-compose-types">
              ${Object.entries(TYPE_LABELS).map(([k, v]) => `
                <button class="review-type-btn" data-type="${k}" title="${v.label}">
                  ${v.icon} ${v.label}
                </button>
              `).join("")}
            </div>
            <textarea class="review-compose-input" id="review-input" placeholder="리뷰를 작성하세요..." rows="3"></textarea>
            <div class="review-compose-actions">
              <button class="btn btn-sm btn-primary" id="review-submit-btn" disabled>등록</button>
            </div>
          </div>
        ` : `
          <div class="review-compose-disabled">
            ${user ? "MS OAuth 인증 사용자만 리뷰를 작성할 수 있습니다" : "로그인 후 리뷰를 작성할 수 있습니다"}
          </div>
        `}

        <div class="review-panel-body">
          ${filtered.length === 0
            ? `<div class="review-empty">
                <span class="review-empty-icon">📝</span>
                <span>리뷰가 없습니다</span>
              </div>`
            : filtered.map(r => this.renderReviewCard(r, user)).join("")
          }
        </div>
      </div>
    `;

    this.bindEvents(user);
  }

  renderReviewCard(review, user) {
    const typeInfo = TYPE_LABELS[review.type] || TYPE_LABELS.comment;
    const statusInfo = STATUS_LABELS[review.status] || STATUS_LABELS.open;
    const canModify = user && (user.id === review.authorId || user.role === "observer");
    const upVotes = Object.values(review.votes || {}).filter(v => v === "up").length;
    const hasVoted = user && review.votes?.[user.id] === "up";
    const canWrite = user?.authProvider === "microsoft";

    return `
      <div class="review-card" data-review-id="${review.id}">
        <div class="review-card-header">
          <div class="review-card-meta">
            <span class="review-type-tag" style="color:${typeInfo.color}">${typeInfo.icon} ${typeInfo.label}</span>
            <span class="review-status-tag" style="background:${statusInfo.color}">${statusInfo.label}</span>
          </div>
          <span class="review-card-time">${timeAgo(review.createdAt)}</span>
        </div>
        <div class="review-card-author">${escapeHtml(review.authorName)}</div>
        <div class="review-card-content">${escapeHtml(review.content)}</div>
        <div class="review-card-actions">
          <button class="review-action-btn review-vote-btn${hasVoted ? " voted" : ""}" data-action="vote" data-review-id="${review.id}" title="추천">
            👍 ${upVotes > 0 ? upVotes : ""}
          </button>
          ${canWrite ? `<button class="review-action-btn" data-action="reply" data-review-id="${review.id}">💬 답글</button>` : ""}
          ${canModify && review.status === "open" ? `
            <button class="review-action-btn" data-action="resolve" data-review-id="${review.id}">✓ 해결</button>
            <button class="review-action-btn" data-action="wontfix" data-review-id="${review.id}">— 보류</button>
          ` : ""}
          ${canModify && review.status !== "open" ? `
            <button class="review-action-btn" data-action="reopen" data-review-id="${review.id}">↩ 재오픈</button>
          ` : ""}
          ${user && user.id === review.authorId ? `
            <button class="review-action-btn review-delete-btn" data-action="delete" data-review-id="${review.id}">🗑</button>
          ` : ""}
        </div>
        ${review.replies && review.replies.length > 0 ? `
          <div class="review-replies">
            ${review.replies.map(r => `
              <div class="review-reply">
                <div class="review-reply-author">${escapeHtml(r.authorName)}</div>
                <div class="review-reply-content">${escapeHtml(r.content)}</div>
                <div class="review-reply-time">${timeAgo(r.createdAt)}</div>
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${this.replyOpenId === review.id ? `
          <div class="review-reply-compose">
            <textarea class="review-reply-input" data-review-id="${review.id}" placeholder="답글 입력..." rows="2"></textarea>
            <div class="review-reply-actions">
              <button class="btn btn-sm btn-primary" data-action="submit-reply" data-review-id="${review.id}">등록</button>
              <button class="btn btn-sm" data-action="cancel-reply" data-review-id="${review.id}">취소</button>
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  bindEvents(user) {
    const panel = this.container.querySelector(".review-panel");
    if (!panel) return;

    // Close button
    panel.querySelector("#review-close-btn")?.addEventListener("click", () => this.close());

    // Filter buttons
    panel.querySelectorAll(".review-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.filter = btn.dataset.filter;
        this.render();
      });
    });

    // Compose — type selection
    let selectedType = "comment";
    panel.querySelectorAll(".review-type-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        panel.querySelectorAll(".review-type-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedType = btn.dataset.type;
      });
    });
    // Default selection
    const defaultTypeBtn = panel.querySelector('.review-type-btn[data-type="comment"]');
    if (defaultTypeBtn) defaultTypeBtn.classList.add("active");

    // Compose — textarea enable submit
    const input = panel.querySelector("#review-input");
    const submitBtn = panel.querySelector("#review-submit-btn");
    if (input && submitBtn) {
      input.addEventListener("input", () => {
        submitBtn.disabled = !input.value.trim();
      });
      submitBtn.addEventListener("click", async () => {
        const content = input.value.trim();
        if (!content) return;
        submitBtn.disabled = true;
        submitBtn.textContent = "등록 중...";
        try {
          await addReview({ pageId: this.pageId, type: selectedType, content });
          input.value = "";
        } catch (e) {
          showToast('error', e.message);
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "등록";
      });
    }

    // Review card actions
    panel.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const reviewId = btn.dataset.reviewId;
        const review = this.reviews.find(r => r.id === reviewId);
        if (!review) return;

        switch (action) {
          case "vote":
            await toggleVote(reviewId, review.votes);
            break;
          case "reply":
            this.replyOpenId = this.replyOpenId === reviewId ? null : reviewId;
            this.render();
            break;
          case "resolve":
            await this.updateStatus(review, "resolved");
            break;
          case "wontfix":
            await this.updateStatus(review, "wontfix");
            break;
          case "reopen":
            await this.updateStatus(review, "open");
            break;
          case "delete":
            if (confirm("이 리뷰를 삭제하시겠습니까?")) {
              await deleteReview(reviewId);
            }
            break;
          case "submit-reply": {
            const textarea = panel.querySelector(`.review-reply-input[data-review-id="${reviewId}"]`);
            const content = textarea?.value?.trim();
            if (!content) return;
            btn.disabled = true;
            try {
              await addReply(reviewId, content, review.replies);
              this.replyOpenId = null;
            } catch (e) {
              showToast('error', e.message);
            }
            break;
          }
          case "cancel-reply":
            this.replyOpenId = null;
            this.render();
            break;
        }
      });
    });

    // Click outside to close
    document.addEventListener("click", this._outsideClickHandler = (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        const bellBtn = document.getElementById("nav-review-btn");
        if (bellBtn && bellBtn.contains(e.target)) return;
        this.close();
      }
    });
  }

  async updateStatus(review, newStatus) {
    const user = getUser();
    if (!user) return;
    const now = Timestamp.now();
    const updatedHistory = [
      ...(review.history || []).map(h => ({
        ...h,
        at: h.at instanceof Date ? Timestamp.fromDate(h.at) : h.at
      })),
      { action: `status_${newStatus}`, by: user.name, at: now, detail: "" }
    ];
    await updateDoc(doc(db, "reviews", review.id), {
      status: newStatus,
      updatedAt: now,
      history: updatedHistory
    });
  }
}
