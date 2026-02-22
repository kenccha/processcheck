// ═══════════════════════════════════════════════════════════════════════════════
// Auth — localStorage based session management
// ═══════════════════════════════════════════════════════════════════════════════

import { getUserByName, createUser } from "./firestore-service.js";

const STORAGE_KEY = "pc_user";

// Get current user from localStorage
export function getUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

// Login — find or create user in Firestore, save to localStorage
export async function login(name, role) {
  let user = await getUserByName(name);

  if (!user) {
    user = await createUser({
      name,
      email: `${name.replace(/\s/g, "").toLowerCase()}@processcheck.com`,
      role,
      department: "개발팀",
    });
  }

  // Override role for demo convenience
  const sessionUser = { ...user, role };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
  return sessionUser;
}

// Logout — clear session and redirect
export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "index.html";
}

// Page guard — redirect to login if not authenticated
export function guardPage() {
  const user = getUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}
