// ═══════════════════════════════════════════════════════════════════════════════
// Auth — localStorage based session management + Microsoft OAuth
// ═══════════════════════════════════════════════════════════════════════════════

import { OAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase-init.js";
import { getUserByName, getUserByEmail, createUser } from "./firestore-service.js";

const STORAGE_KEY = "pc_user";
const ALLOWED_DOMAIN = "inbody.com"; // Only @inbody.com emails allowed

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

// Login — find or create user in Firestore, save to localStorage (demo cards)
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

// Microsoft OAuth login — popup based
export async function loginWithMicrosoft() {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({
    tenant: "547afe76-db4a-45d9-9af8-c970051a4c7d", // InBody Azure AD tenant
  });
  const result = await signInWithPopup(auth, provider);

  const firebaseUser = result.user;
  const email = firebaseUser.email;
  const displayName = firebaseUser.displayName || email.split("@")[0];

  // Restrict to @inbody.com only
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await signOut(auth);
    throw new Error(`@${ALLOWED_DOMAIN} 이메일만 사용할 수 있습니다.`);
  }

  // Check if user already exists in Firestore
  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    const msUser = { ...existingUser, authProvider: "microsoft" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msUser));
    return { user: msUser, isNewUser: false };
  }

  // New user: return auth info so login page can show role selection
  return {
    user: null,
    isNewUser: true,
    authInfo: { email, displayName },
  };
}

// Complete registration for new Microsoft users
export async function completeRegistration(authInfo, role, department) {
  const newUser = await createUser({
    name: authInfo.displayName,
    email: authInfo.email,
    role,
    department,
    authProvider: "microsoft",
  });
  const msUser = { ...newUser, authProvider: "microsoft" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msUser));
  return msUser;
}

// Logout — clear session and redirect
export async function logout() {
  localStorage.removeItem(STORAGE_KEY);
  try {
    await signOut(auth);
  } catch {
    // Ignore — user might not have used Firebase Auth
  }
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
