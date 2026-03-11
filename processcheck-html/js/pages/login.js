// ═══════════════════════════════════════════════════════════════════════════════
// Login Page — sample user cards + Microsoft OAuth login
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, login, loginWithMicrosoft, completeRegistration } from "../auth.js";
import { seedTemplatesIfEmpty } from "../firestore-service.js";

// If already logged in, redirect immediately
if (getUser()) {
  window.location.href = "home.html";
}

// DOM refs
const seedingView = document.getElementById("login-seeding");
const contentView = document.getElementById("login-content");
const userCards = document.querySelectorAll(".demo-btn");
const msLoginBtn = document.getElementById("ms-login-btn");
const msLoginWrap = document.getElementById("ms-login-wrap");
const loginDivider = document.getElementById("login-divider");
const loginPrompt = document.querySelector(".login-prompt");
const roleSelection = document.getElementById("role-selection");
const roleSelect = document.getElementById("role-select");
const deptSelect = document.getElementById("dept-select");
const completeBtn = document.getElementById("complete-registration-btn");
const cancelBtn = document.getElementById("cancel-registration-btn");
const msUserEmail = document.getElementById("ms-user-email");

// ── Production guard — hide demo cards on non-localhost hostnames ──
const IS_PROD = window.location.hostname !== "localhost"
             && window.location.hostname !== "127.0.0.1";

if (IS_PROD) {
  const demoRow = document.getElementById("user-cards");
  const divider = document.getElementById("login-divider");
  const prompt = document.querySelector(".login-prompt");
  if (demoRow) demoRow.style.display = "none";
  if (divider) divider.style.display = "none";
  if (prompt) prompt.textContent = "InBody 계정으로 로그인하세요";
}

// State for Microsoft auth flow
let pendingAuthInfo = null;

// MS button original HTML (for reset)
const MS_BTN_HTML = msLoginBtn.innerHTML;

// Seed database — show content immediately, seed in background
// Show login content after max 3 seconds even if seeding is still running
let seedDone = false;
const showContent = () => {
  if (seedDone) return;
  seedDone = true;
  seedingView.style.display = "none";
  contentView.style.display = "";
  window.__seedComplete = true;
};

// No seeding — show login content immediately
showContent();

// Seed templates if missing (6 phases, 10 depts, 193 items)
seedTemplatesIfEmpty().then(seeded => {
  if (seeded) console.log("📦 템플릿 데이터 자동 생성 완료");
});

// ── Demo card click → login → redirect ──
userCards.forEach((card) => {
  card.addEventListener("click", async () => {
    const role = card.dataset.role;
    const userName = card.dataset.user;

    // Disable all cards while loading
    userCards.forEach((c) => (c.disabled = true));
    card.classList.add("loading");
    const savedHTML = card.innerHTML;
    card.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div>';

    try {
      await login(userName, role);
      window.location.href = "home.html";
    } catch (e) {
      console.error("로그인 오류:", e);
      card.classList.remove("loading");
      card.innerHTML = savedHTML;
      userCards.forEach((c) => (c.disabled = false));
    }
  });
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

// ── Role Selection Logic ──
function showRoleSelection(authInfo) {
  const demoRow = document.getElementById("user-cards");
  if (demoRow) demoRow.style.display = "none";
  loginDivider.style.display = "none";
  msLoginWrap.style.display = "none";
  loginPrompt.style.display = "none";

  msUserEmail.textContent = authInfo.email;
  roleSelection.style.display = "";
  roleSelect.value = "";
  deptSelect.value = "";
  completeBtn.disabled = true;
}

function hideRoleSelection() {
  roleSelection.style.display = "none";
  const demoRow = document.getElementById("user-cards");
  if (demoRow) demoRow.style.display = "";
  loginDivider.style.display = "";
  msLoginWrap.style.display = "";
  loginPrompt.style.display = "";
  resetMsButton();
  pendingAuthInfo = null;
}

roleSelect.addEventListener("change", validateSelections);
deptSelect.addEventListener("change", validateSelections);

function validateSelections() {
  completeBtn.disabled = !(roleSelect.value && deptSelect.value);
}

completeBtn.addEventListener("click", async () => {
  if (!pendingAuthInfo || !roleSelect.value || !deptSelect.value) return;

  completeBtn.disabled = true;
  completeBtn.textContent = "등록 중...";

  try {
    await completeRegistration(pendingAuthInfo, roleSelect.value, deptSelect.value);
    window.location.href = "home.html";
  } catch (e) {
    console.error("등록 오류:", e);
    showError("등록 중 오류가 발생했습니다.");
    completeBtn.disabled = false;
    completeBtn.textContent = "시작하기";
  }
});

cancelBtn.addEventListener("click", hideRoleSelection);

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
