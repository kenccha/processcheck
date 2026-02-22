// ═══════════════════════════════════════════════════════════════════════════════
// Login Page — authentication and database seeding
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, login } from "../auth.js";
import { seedDatabaseIfEmpty } from "../firestore-service.js";

// If already logged in, redirect
if (getUser()) {
  window.location.href = "dashboard.html";
}

// State
let selectedRole = "worker";
let loading = false;

// DOM refs
const nameInput = document.getElementById("login-name-input");
const errorDiv = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const spinnerView = document.getElementById("login-spinner");
const formView = document.getElementById("login-form");

// Seed database
spinnerView.classList.remove("hidden");
formView.classList.add("hidden");
seedDatabaseIfEmpty()
  .catch((e) => console.warn("시드 오류:", e))
  .finally(() => {
    spinnerView.classList.add("hidden");
    formView.classList.remove("hidden");
  });

// Role selection
const roleCards = document.querySelectorAll("[data-role]");
roleCards.forEach((card) => {
  card.addEventListener("click", () => {
    selectedRole = card.dataset.role;
    roleCards.forEach((c) => {
      c.classList.toggle("role-selected", c.dataset.role === selectedRole);
    });
  });
});

// Login
async function handleLogin() {
  const name = nameInput.value.trim();
  if (!name) {
    showError("이름을 입력해주세요.");
    return;
  }
  if (loading) return;
  loading = true;
  hideError();
  loginBtn.disabled = true;
  loginBtn.innerHTML =
    '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div><span>로그인 중...</span>';

  try {
    await login(name, selectedRole);
    window.location.href = "dashboard.html";
  } catch (e) {
    console.error(e);
    showError("로그인 중 오류가 발생했습니다.");
  } finally {
    loading = false;
    loginBtn.disabled = false;
    loginBtn.innerHTML = "<span>로그인</span>";
  }
}

loginBtn.addEventListener("click", handleLogin);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

function showError(msg) {
  errorDiv.querySelector("span").textContent = msg;
  errorDiv.classList.remove("hidden");
}

function hideError() {
  errorDiv.classList.add("hidden");
}
