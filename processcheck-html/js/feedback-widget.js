// ═══════════════════════════════════════════════════════════════════════════════
// Global Feedback Widget — FAB (Floating Action Button) for all pages
// Viewport-only screenshot capture + rectangle annotation + multi-screenshot
// Stores feedback in Firestore `feedbacks` collection
// Uses `fw-` prefix for all DOM IDs/classes to avoid collisions
// ═══════════════════════════════════════════════════════════════════════════════

import { db } from "./firebase-init.js";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { showToast } from "./ui/toast.js";

let _initialized = false;

export function initFeedbackWidget() {
  if (_initialized) return;
  // Don't show on deliverable pages (they have their own capture system)
  if (window.location.pathname.includes("/docs/deliverables/")) return;
  // Don't show on login page
  const page = window.location.pathname.split("/").pop() || "index.html";
  if (page === "index.html") return;

  _initialized = true;

  // ── html2canvas: lazy load only when needed ──
  let _h2cLoaded = typeof html2canvas !== "undefined";
  let _h2cLoading = false;
  function ensureHtml2Canvas() {
    if (_h2cLoaded) return Promise.resolve();
    if (_h2cLoading) return _h2cLoading;
    _h2cLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      s.onload = () => { _h2cLoaded = true; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return _h2cLoading;
  }

  // ── Get user ──
  let user = null;
  try { user = JSON.parse(localStorage.getItem("pc_user")); } catch {}

  // ── State ──
  let captureCanvas, captureCtx, baseImage;
  let rects = [];
  let drawing = false, startX = 0, startY = 0;
  let savedScreenshots = [];

  // ── Page info ──
  function getPageInfo() {
    const pathname = window.location.pathname;
    const file = pathname.split("/").pop() || "index.html";
    const id = file.replace(".html", "");
    const name = document.title || id;
    return { id, name, file };
  }

  // ═══════════════════════════════════
  // DOM: FAB Button
  // ═══════════════════════════════════
  const fab = document.createElement("button");
  fab.id = "fw-fab";
  fab.title = "피드백 보내기";
  fab.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/></svg>`;
  document.body.appendChild(fab);

  // ═══════════════════════════════════
  // DOM: Capture Overlay
  // ═══════════════════════════════════
  const overlay = document.createElement("div");
  overlay.id = "fw-overlay";
  overlay.innerHTML = `
    <div class="fw-toolbar">
      <div class="fw-toolbar-left">
        <span class="fw-title">📸 화면에 표시하고 피드백을 남기세요</span>
        <span class="fw-hint">드래그로 영역을 표시하세요. 여러 개 가능합니다.</span>
      </div>
      <div class="fw-toolbar-right">
        <button class="fw-btn fw-btn-undo" id="fw-undo">↩ 되돌리기</button>
        <button class="fw-btn fw-btn-save-more" id="fw-save-more">✅ 저장 & 더 캡처</button>
        <button class="fw-btn fw-btn-cancel" id="fw-cancel">취소</button>
      </div>
    </div>
    <div class="fw-canvas-wrap">
      <canvas id="fw-canvas"></canvas>
    </div>
    <div class="fw-form-bar">
      <div class="fw-thumbs-row" id="fw-thumbs-row"></div>
      <div class="fw-form-fields">
        <input type="text" class="fw-input" id="fw-author" placeholder="이름">
        <select class="fw-select" id="fw-type">
          <option value="suggestion">💡 제안</option>
          <option value="bug">🐛 문제</option>
          <option value="question">❓ 질문</option>
        </select>
        <select class="fw-select" id="fw-priority">
          <option value="medium">보통</option>
          <option value="high">🔴 높음</option>
          <option value="low">낮음</option>
        </select>
        <textarea class="fw-textarea" id="fw-content" placeholder="여기에 피드백 내용을 입력하세요..." rows="2"></textarea>
        <button class="fw-btn fw-btn-submit" id="fw-submit">📤 피드백 등록</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // ═══════════════════════════════════
  // DOM: Screenshot Preview Modal
  // ═══════════════════════════════════
  const ssModal = document.createElement("div");
  ssModal.id = "fw-ss-modal";
  ssModal.innerHTML = '<img id="fw-ss-modal-img">';
  document.body.appendChild(ssModal);
  ssModal.addEventListener("click", () => ssModal.classList.remove("open"));

  // ═══════════════════════════════════
  // DOM: Floating Bar (when screenshots accumulated)
  // ═══════════════════════════════════
  const floatBar = document.createElement("div");
  floatBar.id = "fw-float-bar";
  floatBar.innerHTML = `
    <div class="fw-fb-thumbs" id="fw-fb-thumbs"></div>
    <span class="fw-fb-count" id="fw-fb-count"></span>
    <button class="fw-btn fw-fbb-capture" id="fw-fb-add">📸 추가 캡처</button>
    <button class="fw-btn fw-fbb-submit" id="fw-fb-go-submit">📤 피드백 작성</button>
    <button class="fw-btn fw-fbb-discard" id="fw-fb-discard">✕ 취소</button>
  `;
  document.body.appendChild(floatBar);

  // ═══════════════════════════════════
  // STYLES (inline, uses CSS vars for theme)
  // ═══════════════════════════════════
  const style = document.createElement("style");
  style.textContent = `
    /* FAB Button */
    #fw-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 10000;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg, #06b6d4, #0284c7);
      color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(6,182,212,0.35);
      transition: all 0.2s ease;
    }
    #fw-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 24px rgba(6,182,212,0.5);
    }
    #fw-fab:active { transform: scale(0.95); }

    /* Overlay (fullscreen capture + annotate) */
    #fw-overlay {
      display: none; position: fixed; inset: 0; z-index: 20000;
      background: #0f172a; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
    }
    #fw-overlay.open { display: flex; }

    .fw-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 20px; background: #1e293b;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .fw-toolbar-left { display: flex; flex-direction: column; gap: 2px; }
    .fw-title { font-size: 14px; font-weight: 700; color: #e2e8f0; }
    .fw-hint { font-size: 12px; color: #64748b; }
    .fw-toolbar-right { display: flex; gap: 8px; }

    .fw-btn {
      padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: none; transition: all 0.15s;
    }
    .fw-btn-undo { background: #334155; color: #e2e8f0; }
    .fw-btn-undo:hover { background: #475569; }
    .fw-btn-save-more { background: rgba(34,197,94,0.15); color: #22c55e; }
    .fw-btn-save-more:hover { background: rgba(34,197,94,0.25); }
    .fw-btn-cancel { background: rgba(239,68,68,0.15); color: #ef4444; }
    .fw-btn-cancel:hover { background: rgba(239,68,68,0.25); }
    .fw-btn-submit {
      background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff;
      padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
      border: none; cursor: pointer; white-space: nowrap;
    }
    .fw-btn-submit:hover { opacity: 0.9; }
    .fw-btn-submit:disabled { opacity: 0.4; cursor: not-allowed; }

    .fw-canvas-wrap {
      flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center;
      padding: 12px; background: #0f172a; position: relative;
    }
    #fw-canvas {
      max-width: 100%; max-height: 100%;
      border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      cursor: crosshair;
    }

    .fw-form-bar {
      display: flex; flex-direction: column; gap: 8px;
      padding: 12px 20px; background: #1e293b;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .fw-thumbs-row {
      display: flex; gap: 8px; align-items: center; overflow-x: auto; padding: 4px 0;
      min-height: 0;
    }
    .fw-thumbs-row:empty { display: none; }
    .fw-thumb-wrap { position: relative; flex-shrink: 0; }
    .fw-thumb {
      width: 80px; height: 50px; object-fit: cover; border-radius: 6px;
      border: 2px solid rgba(255,255,255,0.15); cursor: pointer;
      transition: border-color 0.15s;
    }
    .fw-thumb:hover { border-color: #06b6d4; }
    .fw-thumb-num {
      position: absolute; top: -4px; left: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #06b6d4; color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .fw-thumb-del {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #ef4444; color: #fff; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; border: none; line-height: 1; opacity: 0;
      transition: opacity 0.15s;
    }
    .fw-thumb-wrap:hover .fw-thumb-del { opacity: 1; }

    .fw-form-fields {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    .fw-input, .fw-select, .fw-textarea {
      padding: 7px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);
      background: #0f172a; color: #e2e8f0; font-size: 12px; font-family: inherit; outline: none;
    }
    .fw-input:focus, .fw-select:focus, .fw-textarea:focus { border-color: #06b6d4; }
    .fw-input { width: 100px; }
    .fw-select { width: 90px; }
    .fw-textarea { flex: 1; min-width: 200px; resize: none; }

    /* Screenshot Modal */
    #fw-ss-modal {
      display: none; position: fixed; inset: 0; z-index: 30000;
      background: rgba(0,0,0,0.85); align-items: center; justify-content: center;
      cursor: zoom-out;
    }
    #fw-ss-modal.open { display: flex; }
    #fw-ss-modal img { max-width: 95vw; max-height: 95vh; border-radius: 8px; }

    /* Floating Bar */
    #fw-float-bar {
      display: none; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 10002; background: #1e293b; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 14px; padding: 10px 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
      align-items: center; gap: 10px;
    }
    #fw-float-bar.open { display: flex; }
    .fw-fb-thumbs { display: flex; gap: 6px; align-items: center; }
    .fw-fb-thumbs img {
      width: 56px; height: 36px; object-fit: cover; border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .fw-fb-count { font-size: 12px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
    .fw-fbb-capture { background: #334155; color: #e2e8f0; }
    .fw-fbb-capture:hover { background: #475569; }
    .fw-fbb-submit { background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff; }
    .fw-fbb-submit:hover { opacity: 0.9; }
    .fw-fbb-discard { background: none; color: #ef4444; font-size: 11px; padding: 4px 8px; }
    .fw-fbb-discard:hover { text-decoration: underline; }

    /* Hide FAB when overlay or float bar open */
    #fw-overlay.open ~ #fw-fab { display: none; }
    #fw-float-bar.open ~ #fw-fab { display: none; }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════
  // CAPTURE LOGIC
  // ═══════════════════════════════════

  async function openCaptureMode() {
    // Lazy-load html2canvas on first use
    try {
      await ensureHtml2Canvas();
    } catch {
      showToast('error', "캡처 라이브러리를 로드할 수 없습니다. 네트워크를 확인하세요.");
      return;
    }

    // Hide our widgets before capture
    fab.style.display = "none";
    floatBar.style.display = "none";

    requestAnimationFrame(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      html2canvas(document.body, {
        useCORS: true,
        scale: window.devicePixelRatio > 1 ? 1.5 : 1,
        logging: false,
        x: window.scrollX,
        y: window.scrollY,
        width: vw,
        height: vh,
        windowWidth: vw,
        windowHeight: vh,
        ignoreElements: (el) => {
          return el.id === "fw-fab" || el.id === "fw-overlay"
            || el.id === "fw-ss-modal" || el.id === "fw-float-bar";
        },
      }).then(canvas => {
        fab.style.display = "";

        captureCanvas = document.getElementById("fw-canvas");
        captureCtx = captureCanvas.getContext("2d");
        captureCanvas.width = canvas.width;
        captureCanvas.height = canvas.height;
        captureCtx.drawImage(canvas, 0, 0);
        baseImage = captureCtx.getImageData(0, 0, canvas.width, canvas.height);
        rects = [];

        if (user?.name) {
          const inp = document.getElementById("fw-author");
          if (inp && !inp.value) inp.value = user.name;
        }

        renderThumbsInOverlay();
        overlay.classList.add("open");
      }).catch(err => {
        console.error("캡처 실패:", err);
        fab.style.display = "";
        showToast('error', "화면 캡처에 실패했습니다.");
      });
    });
  }

  function closeCaptureMode() {
    overlay.classList.remove("open");
    rects = [];
    updateFloatBar();
  }

  function discardAllCaptures() {
    savedScreenshots = [];
    closeCaptureMode();
    floatBar.classList.remove("open");
  }

  function saveCurrentScreenshot() {
    redrawCanvas();
    const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.6);
    savedScreenshots.push(dataUrl);
    rects = [];
    overlay.classList.remove("open");
    updateFloatBar();
  }

  function openSubmitMode() {
    // If currently in overlay with unsaved annotation, save it first
    if (overlay.classList.contains("open")) {
      if (rects.length > 0 || !savedScreenshots.length) {
        redrawCanvas();
        const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.6);
        savedScreenshots.push(dataUrl);
        rects = [];
      }
    }
    // Show overlay in submit mode
    if (!overlay.classList.contains("open")) {
      if (savedScreenshots.length > 0) {
        captureCanvas = document.getElementById("fw-canvas");
        captureCtx = captureCanvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
          captureCanvas.width = img.naturalWidth;
          captureCanvas.height = img.naturalHeight;
          captureCtx.drawImage(img, 0, 0);
          baseImage = captureCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
          rects = [];
        };
        img.src = savedScreenshots[savedScreenshots.length - 1];
      }
    }
    floatBar.classList.remove("open");
    renderThumbsInOverlay();
    overlay.classList.add("open");

    if (user?.name) {
      const inp = document.getElementById("fw-author");
      if (inp && !inp.value) inp.value = user.name;
    }
  }

  // ── Thumbnail rendering ──
  function renderThumbsInOverlay() {
    const row = document.getElementById("fw-thumbs-row");
    if (!row) return;
    if (!savedScreenshots.length) { row.innerHTML = ""; return; }
    row.innerHTML = savedScreenshots.map((ss, i) =>
      `<div class="fw-thumb-wrap">
        <span class="fw-thumb-num">${i + 1}</span>
        <img class="fw-thumb" src="${ss}" alt="캡처 ${i + 1}" data-idx="${i}">
        <button class="fw-thumb-del" data-del="${i}">✕</button>
      </div>`
    ).join("") + `<span style="font-size:11px;color:#64748b;white-space:nowrap;">${savedScreenshots.length}장</span>`;

    row.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        savedScreenshots.splice(Number(btn.dataset.del), 1);
        renderThumbsInOverlay();
        updateFloatBar();
      });
    });
    row.querySelectorAll(".fw-thumb").forEach(img => {
      img.addEventListener("click", () => {
        document.getElementById("fw-ss-modal-img").src = img.src;
        ssModal.classList.add("open");
      });
    });
  }

  function updateFloatBar() {
    if (!savedScreenshots.length) {
      floatBar.classList.remove("open");
      return;
    }
    floatBar.classList.add("open");
    const thumbs = document.getElementById("fw-fb-thumbs");
    thumbs.innerHTML = savedScreenshots.slice(-3).map(ss =>
      `<img src="${ss}" alt="">`
    ).join("");
    document.getElementById("fw-fb-count").textContent = `${savedScreenshots.length}장 캡처됨`;
  }

  // ── Canvas drawing ──
  function getCanvasCoords(e) {
    const c = captureCanvas;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function redrawCanvas() {
    captureCtx.putImageData(baseImage, 0, 0);
    rects.forEach((r, i) => {
      captureCtx.strokeStyle = "#ef4444";
      captureCtx.lineWidth = 3;
      captureCtx.setLineDash([]);
      captureCtx.strokeRect(r.x, r.y, r.w, r.h);
      captureCtx.fillStyle = "#ef4444";
      captureCtx.font = "bold 18px sans-serif";
      captureCtx.fillText(String(i + 1), r.x + 4, r.y + 18);
    });
  }

  // ── Canvas mouse events ──
  overlay.addEventListener("mousedown", (e) => {
    if (e.target.id !== "fw-canvas") return;
    drawing = true;
    const { x, y } = getCanvasCoords(e);
    startX = x; startY = y;
  });
  overlay.addEventListener("mousemove", (e) => {
    if (!drawing || e.target.closest(".fw-form-bar") || e.target.closest(".fw-toolbar")) return;
    const { x, y } = getCanvasCoords(e);
    redrawCanvas();
    captureCtx.strokeStyle = "rgba(239,68,68,0.7)";
    captureCtx.lineWidth = 2;
    captureCtx.setLineDash([6, 3]);
    captureCtx.strokeRect(startX, startY, x - startX, y - startY);
  });
  overlay.addEventListener("mouseup", (e) => {
    if (!drawing) return;
    drawing = false;
    const { x, y } = getCanvasCoords(e);
    const w = x - startX, h = y - startY;
    if (Math.abs(w) > 10 && Math.abs(h) > 10) {
      rects.push({ x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(w), h: Math.abs(h) });
    }
    redrawCanvas();
  });

  // ═══════════════════════════════════
  // EVENT BINDINGS
  // ═══════════════════════════════════

  // FAB click → start capture
  fab.addEventListener("click", openCaptureMode);

  // Overlay toolbar buttons
  document.getElementById("fw-undo")?.addEventListener("click", () => {
    rects.pop();
    redrawCanvas();
  });
  document.getElementById("fw-save-more")?.addEventListener("click", saveCurrentScreenshot);
  document.getElementById("fw-cancel")?.addEventListener("click", discardAllCaptures);

  // Floating bar buttons
  document.getElementById("fw-fb-add")?.addEventListener("click", openCaptureMode);
  document.getElementById("fw-fb-go-submit")?.addEventListener("click", openSubmitMode);
  document.getElementById("fw-fb-discard")?.addEventListener("click", discardAllCaptures);

  // ═══════════════════════════════════
  // SUBMIT → Firestore
  // ═══════════════════════════════════
  document.getElementById("fw-submit")?.addEventListener("click", async function () {
    const author = document.getElementById("fw-author").value.trim();
    const content = document.getElementById("fw-content").value.trim();
    if (!author || !content) { showToast('warning', "이름과 피드백 내용을 입력하세요"); return; }

    const pageInfo = getPageInfo();

    this.disabled = true;
    this.textContent = "등록 중...";

    try {
      // If current canvas has annotations, save it too
      let allScreenshots = [...savedScreenshots];
      if (rects.length > 0 || allScreenshots.length === 0) {
        redrawCanvas();
        const currentCapture = captureCanvas.toDataURL("image/jpeg", 0.6);
        allScreenshots.push(currentCapture);
      }

      await addDoc(collection(db, "feedbacks"), {
        pageId: pageInfo.id,
        pageName: pageInfo.name,
        content,
        section: "",
        type: document.getElementById("fw-type").value,
        priority: document.getElementById("fw-priority").value,
        status: "open",
        author: { name: author, email: "" },
        screenshot: allScreenshots[0] || "",
        screenshots: allScreenshots,
        createdAt: serverTimestamp(),
        votes: 0,
        votedBy: [],
        resolution: "",
        resolvedBy: null,
        resolvedAt: null,
      });

      // Reset
      document.getElementById("fw-content").value = "";
      savedScreenshots = [];
      rects = [];
      closeCaptureMode();
      floatBar.classList.remove("open");
    } catch (e) {
      console.error("피드백 등록 오류:", e);
      showToast('error', "등록 실패: " + e.message);
    }

    this.disabled = false;
    this.textContent = "📤 피드백 등록";
  });
}
