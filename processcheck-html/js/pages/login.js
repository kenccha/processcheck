// ═══════════════════════════════════════════════════════════════════════════════
// Login Page — Microsoft OAuth login only
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, loginWithMicrosoft } from "../auth.js";
import { seedTemplatesIfEmpty } from "../firestore-service.js";

// If already logged in, redirect immediately
if (getUser()) {
  window.location.href = "home.html";
}

// DOM refs
const seedingView = document.getElementById("login-seeding");
const contentView = document.getElementById("login-content");
const msLoginBtn = document.getElementById("ms-login-btn");

// MS button original HTML (for reset)
const MS_BTN_HTML = msLoginBtn.innerHTML;

// Show login content immediately (no seeding)
seedingView.style.display = "none";
contentView.style.display = "";

// Seed templates if missing (6 phases, 10 depts, 193 items)
seedTemplatesIfEmpty().then(seeded => {
  if (seeded) console.log("📦 템플릿 데이터 자동 생성 완료");
});

// ── Microsoft Login (popup) ──
msLoginBtn.addEventListener("click", async () => {
  msLoginBtn.disabled = true;
  msLoginBtn.innerHTML = `
    <div class="spinner" style="width:20px;height:20px;border-width:2px"></div>
    <span>로그인 중...</span>
  `;
  removeError();

  try {
    const result = await loginWithMicrosoft();
    // Both existing and new users go straight to dashboard
    // (new users auto-registered as worker, admin assigns role later)
    window.location.href = "home.html";
  } catch (e) {
    console.error("Microsoft 로그인 오류:", e);
    showError(e.message || "로그인 중 오류가 발생했습니다.");
    resetMsButton();
  }
});

// ── Error helpers ──
function showError(msg) {
  removeError();
  const errDiv = document.createElement("div");
  errDiv.className = "login-error";
  errDiv.id = "login-error";
  errDiv.textContent = msg;
  contentView.appendChild(errDiv);
}

function removeError() {
  const el = document.getElementById("login-error");
  if (el) el.remove();
}

function resetMsButton() {
  msLoginBtn.disabled = false;
  msLoginBtn.innerHTML = MS_BTN_HTML;
}
