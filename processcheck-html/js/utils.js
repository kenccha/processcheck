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

// 날짜 포맷
export function formatDate(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(date) {
  if (!date) return "-";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
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
  const d = date instanceof Date ? date : new Date(date);
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
