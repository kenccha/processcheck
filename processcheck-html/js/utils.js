// ═══════════════════════════════════════════════════════════════════════════════
// Utils — helper functions ported from mockData.ts
// ═══════════════════════════════════════════════════════════════════════════════

// 부서 목록
export const departments = [
  "개발팀", "품질팀", "영업팀", "제조팀", "구매팀",
  "CS팀", "경영관리팀", "글로벌임상팀", "디자인연구소", "인증팀",
];

// 프로젝트 단계 목록 (12개 개별 stage — 내부 데이터 키로만 사용)
export const projectStages = [
  "발의검토", "발의승인", "기획검토", "기획승인",
  "WM제작", "WM승인회", "Tx단계", "Tx승인회",
  "MasterGatePilot", "MSG승인회", "양산", "영업이관",
];

// 6개 Phase 그룹 (UI에서는 항상 이 단위로 표시)
export const PHASE_GROUPS = [
  { name: "발의", workStage: "발의검토", gateStage: "발의승인" },
  { name: "기획", workStage: "기획검토", gateStage: "기획승인" },
  { name: "WM", workStage: "WM제작", gateStage: "WM승인회" },
  { name: "Tx", workStage: "Tx단계", gateStage: "Tx승인회" },
  { name: "MSG", workStage: "MasterGatePilot", gateStage: "MSG승인회" },
  { name: "양산/이관", workStage: "양산", gateStage: "영업이관" },
];

// 게이트 스테이지 목록 (기획조정실 승인 대상)
export const GATE_STAGES = ["발의승인", "기획승인", "WM승인회", "Tx승인회", "MSG승인회", "영업이관"];

// 단계명 포맷팅
const stageMap = {
  "발의검토": "발의 검토",
  "발의승인": "발의 승인",
  "기획검토": "기획 검토",
  "기획승인": "기획 승인",
  "WM제작": "W/M 제작",
  "WM승인회": "W/M 승인회",
  "Tx단계": "Tx 단계",
  "Tx승인회": "Tx 승인회",
  "MasterGatePilot": "Master Gate Pilot",
  "MSG승인회": "MSG 승인회",
  "양산": "양산",
  "영업이관": "영업 이관",
};

export function formatStageName(stage) {
  return stageMap[stage] || stage;
}

// 중요도 CSS class
export function getRiskClass(level) {
  switch (level) {
    case "green":  return "success";
    case "yellow": return "warning";
    case "red":    return "danger";
    default:       return "neutral";
  }
}

// 중요도 한글
export function getRiskLabel(level) {
  switch (level) {
    case "green":  return "보통";
    case "yellow": return "중요";
    case "red":    return "긴급";
    default:       return level;
  }
}

// 상태 한글명
export function getStatusLabel(status) {
  switch (status) {
    case "pending":     return "대기 중";
    case "in_progress": return "진행 중";
    case "completed":   return "완료";
    case "rejected":    return "반려";
    default:            return status;
  }
}

// 상태 badge class
export function getStatusBadgeClass(status) {
  switch (status) {
    case "pending":     return "badge-neutral";
    case "in_progress": return "badge-primary";
    case "completed":   return "badge-success";
    case "rejected":    return "badge-danger";
    default:            return "badge-neutral";
  }
}

// 역할 한글명
export function getRoleName(role) {
  const map = {
    worker: "실무자",
    manager: "부서 관리자",
    observer: "기획조정실",
  };
  return map[role] || role;
}

// 날짜 포맷 — 사용자 설정 기반 (기본: YY/MM/DD)
// 설정은 localStorage("pc-date-format")에 저장
// 지원 형식: "YY/MM/DD", "YYYY/MM/DD", "YYYY-MM-DD", "MM/DD/YYYY", "YYYY.MM.DD"
export function getDateFormat() {
  return localStorage.getItem("pc-date-format") || "YY/MM/DD";
}
export function setDateFormat(fmt) {
  localStorage.setItem("pc-date-format", fmt);
}

function applyDateFormat(d, fmt) {
  const yyyy = d.getFullYear();
  const yy = String(yyyy).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  switch (fmt) {
    case "YYYY/MM/DD": return `${yyyy}/${mm}/${dd}`;
    case "YYYY-MM-DD": return `${yyyy}-${mm}-${dd}`;
    case "MM/DD/YYYY": return `${mm}/${dd}/${yyyy}`;
    case "YYYY.MM.DD": return `${yyyy}.${mm}.${dd}`;
    default: return `${yy}/${mm}/${dd}`;
  }
}

export function formatDate(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  return applyDateFormat(d, getDateFormat());
}

export function formatDateTime(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${applyDateFormat(d, getDateFormat())} ${hh}:${mi}`;
}

// Short date (for inline use like phase headers)
export function formatDateShort(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "-";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

// 상대 시간
export function timeAgo(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return formatDate(d);
}

// D-Day 계산
export function daysUntil(date) {
  if (!date) return null;
  const d = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86400000);
}

// 진행률에 따른 색상 class
export function getProgressClass(progress) {
  if (progress >= 80) return "success";
  if (progress >= 40) return "primary";
  return "warning";
}

// HTML 이스케이프
export function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// 쿼리 파라미터 헬퍼
export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ─── Mention & Markdown Helpers ──────────────────────────────────────────────

// Parse @mentions in text, return HTML with highlighted mentions
export function parseMentions(text, userNames = []) {
  if (!text) return "";
  let html = escapeHtml(text);
  // Match @name patterns (Korean names 2-4 chars)
  html = html.replace(/@([\uAC00-\uD7A3a-zA-Z]{2,10})/g, (match, name) => {
    if (userNames.length === 0 || userNames.includes(name)) {
      return `<span class="mention-tag">@${name}</span>`;
    }
    return match;
  });
  return html;
}

// Extract mentioned names from text
export function extractMentions(text) {
  if (!text) return [];
  const matches = text.match(/@([\uAC00-\uD7A3a-zA-Z]{2,10})/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

// Simple markdown-like rendering (bold, italic, code, links)
export function renderSimpleMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic: *text*
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  // Code: `text`
  html = html.replace(/`(.+?)`/g, '<code class="inline-code">$1</code>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ─── Export Helpers ──────────────────────────────────────────────────────────

export function exportToCSV(data, headers, filename = "export.csv") {
  // Support both formats:
  // 1) headers = ["col1", "col2"], data = [["val1", "val2"], ...]  (simple arrays)
  // 2) headers = [{label, key}, ...], data = [{field: val}, ...]   (object format)
  const isSimple = headers.length > 0 && typeof headers[0] === "string";

  let headerRow, rows;
  if (isSimple) {
    headerRow = headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(",");
    rows = data.map(row =>
      (Array.isArray(row) ? row : headers.map((_, i) => row[i] ?? ""))
        .map(val => `"${String(val ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
  } else {
    headerRow = headers.map(h => `"${String(h.label).replace(/"/g, '""')}"`).join(",");
    rows = data.map(row =>
      headers.map(h => {
        let val = typeof h.key === "function" ? h.key(row) : (row[h.key] ?? "");
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(",")
    );
  }

  const csv = [headerRow, ...rows].join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToPDF(title, content) {
  // Simple print-based PDF export
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: 'Pretendard', sans-serif; padding: 40px; color: #1e293b; }
      h1 { font-size: 24px; border-bottom: 2px solid #0891b2; padding-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 12px; }
      th { background: #f1f5f9; font-weight: 600; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
      .badge-success { background: #dcfce7; color: #166534; }
      .badge-warning { background: #fef3c7; color: #92400e; }
      .badge-danger { background: #fecaca; color: #991b1b; }
      .badge-primary { background: #cffafe; color: #155e75; }
      .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    ${content}
    <div class="footer">ProcessCheck — ${formatDate(new Date())} 생성</div>
    </body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); }, 500);
}

// ─── Input Validation ────────────────────────────────────────────────────────

export function validateInput(str, maxLength = 500) {
  if (!str || typeof str !== "string") return "";
  return str.trim().substring(0, maxLength);
}

export function validateId(id) {
  if (!id) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// ─── File Helpers ────────────────────────────────────────────────────────────

const FILE_ICONS = {
  pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
  ppt: "📽", pptx: "📽", png: "🖼", jpg: "🖼", jpeg: "🖼",
  gif: "🖼", zip: "📦", default: "📎",
};

export function getFileIcon(filename) {
  const ext = (filename || "").split(".").pop().toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png", "image/jpeg", "image/gif",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFile(file) {
  if (!file) return { valid: false, error: "파일이 없습니다" };
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: "파일 크기가 10MB를 초과합니다" };
  if (!ALLOWED_FILE_TYPES.includes(file.type)) return { valid: false, error: "허용되지 않는 파일 형식입니다 (PDF, DOC, XLS, PPT, PNG, JPG 허용)" };
  return { valid: true };
}
