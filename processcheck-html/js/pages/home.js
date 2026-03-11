// ═══════════════════════════════════════════════════════════════════════════════
// Home (Hub) Page — choose between ProcessCheck and 영업 출시 준비
// ═══════════════════════════════════════════════════════════════════════════════

import { guardPage } from "../auth.js";
import { renderHomeNav, initTheme } from "../components.js";

initTheme();

const user = guardPage();
if (!user) throw new Error("Not authenticated");

renderHomeNav(document.getElementById("nav-root"));
