// ═══════════════════════════════════════════════════════════════════════════════
// Utils — helper functions ported from mockData.ts
// ═══════════════════════════════════════════════════════════════════════════════

// 부서 목록
export const departments = [
  "개발팀", "품질팀", "영업팀", "제조팀", "구매팀",
  "CS팀", "경영관리팀", "글로벌임상팀", "디자인연구소", "인증팀",
];

// 프로젝트 단계 목록
export const projectStages = [
  "0_발의검토", "1_발의승인", "2_기획검토", "3_기획승인",
  "4_WM제작", "5_WM승인회", "6_Tx단계", "7_Tx승인회",
  "8_MasterGatePilot", "9_MSG승인회", "10_양산", "11_영업이관",
];

// 단계명 포맷팅
const stageMap = {
  "0_발의검토": "0. 발의 검토",
  "1_발의승인": "1. 발의 승인",
  "2_기획검토": "2. 기획 검토",
  "3_기획승인": "3. 기획 승인",
  "4_WM제작": "4. W/M 제작",
  "5_WM승인회": "5. W/M 승인회",
  "6_Tx단계": "6. Tx 단계",
  "7_Tx승인회": "7. Tx 승인회",
  "8_MasterGatePilot": "8. Master Gate Pilot",
  "9_MSG승인회": "9. MSG 승인회",
  "10_양산": "10. 양산",
  "11_영업이관": "11. 영업 이관",
};

export function formatStageName(stage) {
  return stageMap[stage] || stage;
}

// 위험도 CSS class
export function getRiskClass(level) {
  switch (level) {
    case "green":  return "success";
    case "yellow": return "warning";
    case "red":    return "danger";
    default:       return "neutral";
  }
}

// 위험도 한글
export function getRiskLabel(level) {
  switch (level) {
    case "green":  return "안전";
    case "yellow": return "주의";
    case "red":    return "위험";
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
    pm: "프로세스 관리자",
    scheduler: "일정 관리자",
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
