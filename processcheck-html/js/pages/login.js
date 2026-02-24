// ═══════════════════════════════════════════════════════════════════════════════
// Login Page — sample user cards + Microsoft OAuth login
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, login, loginWithMicrosoft, completeRegistration } from "../auth.js";
import { seedDatabaseIfEmpty } from "../firestore-service.js";

// If already logged in, redirect immediately
if (getUser()) {
  window.location.href = "dashboard.html";
}

// DOM refs
const seedingView = document.getElementById("login-seeding");
const contentView = document.getElementById("login-content");
const userCards = document.querySelectorAll(".user-card");
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

// State for Microsoft auth flow
let pendingAuthInfo = null;

// MS button original HTML (for reset)
const MS_BTN_HTML = msLoginBtn.innerHTML;

// Seed database first, then show cards
seedDatabaseIfEmpty()
  .catch((e) => console.warn("시드 오류 (무시 가능):", e))
  .finally(() => {
    seedingView.style.display = "none";
    contentView.style.display = "";
    window.__seedComplete = true;
  });

// ── Demo card click → login → redirect ──
userCards.forEach((card) => {
  card.addEventListener("click", async () => {
    const role = card.dataset.role;
    const userName = card.dataset.user;

    // Disable all cards while loading
    userCards.forEach((c) => c.setAttribute("disabled", ""));

    // Show loading state on clicked card
    card.classList.add("loading");
    const iconEl = card.querySelector(".user-card-icon svg");
    const savedIcon = iconEl ? iconEl.outerHTML : "";
    if (iconEl) {
      iconEl.outerHTML =
        '<div class="spinner" style="width:24px;height:24px;border-width:2px"></div>';
    }

    try {
      await login(userName, role);
      window.location.href = "dashboard.html";
    } catch (e) {
      console.error("로그인 오류:", e);
      // Restore state on error
      card.classList.remove("loading");
      const spinnerEl = card.querySelector(".user-card-icon .spinner");
      if (spinnerEl) spinnerEl.outerHTML = savedIcon;
      userCards.forEach((c) => c.removeAttribute("disabled"));
    }
  });
});

// ── Microsoft Login ──
msLoginBtn.addEventListener("click", async () => {
  msLoginBtn.disabled = true;
  msLoginBtn.innerHTML = `
    <div class="spinner" style="width:20px;height:20px;border-width:2px"></div>
    <span>로그인 중...</span>
  `;
  removeError();

  try {
    const result = await loginWithMicrosoft();

    if (!result.isNewUser) {
      // Existing user → go straight to dashboard
      window.location.href = "dashboard.html";
    } else {
      // New user → show role/department selection
      pendingAuthInfo = result.authInfo;
      showRoleSelection(result.authInfo);
    }
  } catch (e) {
    console.error("Microsoft 로그인 오류:", e);

    let errorMsg = "로그인 중 오류가 발생했습니다.";
    if (e.code === "auth/popup-closed-by-user") {
      errorMsg = "로그인 팝업이 닫혔습니다. 다시 시도해주세요.";
    } else if (e.code === "auth/popup-blocked") {
      errorMsg = "팝업이 차단되었습니다. 팝업 차단을 해제해주세요.";
    } else if (e.code === "auth/cancelled-popup-request") {
      errorMsg = "";
    }

    if (errorMsg) showError(errorMsg);
    resetMsButton();
  }
});

// ── Role Selection Logic ──
function showRoleSelection(authInfo) {
  document.getElementById("user-cards").style.display = "none";
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
  document.getElementById("user-cards").style.display = "";
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
    window.location.href = "dashboard.html";
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
