// ═══════════════════════════════════════════════════════════════════════════════
// Login Page — 3 sample user card login (no name input)
// Matches Next.js app/page.tsx design
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser, login } from "../auth.js";
import { seedDatabaseIfEmpty } from "../firestore-service.js";

// If already logged in, redirect immediately
if (getUser()) {
  window.location.href = "dashboard.html";
}

// DOM refs
const seedingView = document.getElementById("login-seeding");
const contentView = document.getElementById("login-content");
const userCards = document.querySelectorAll(".user-card");

// Seed database first, then show cards
seedDatabaseIfEmpty()
  .catch((e) => console.warn("시드 오류 (무시 가능):", e))
  .finally(() => {
    seedingView.style.display = "none";
    contentView.style.display = "";
    window.__seedComplete = true;
  });

// Card click → login → redirect
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
