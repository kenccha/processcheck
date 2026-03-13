// ═══════════════════════════════════════════════════════════════════════════════
// Firestore Service — all CRUD + real-time subscriptions
// Ported from lib/firestoreService.ts (no TypeScript)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, writeBatch, onSnapshot, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "./firebase-init.js";

// ─── Timestamp helpers ──────────────────────────────────────────────────────

function toDate(val) {
  if (val && typeof val.toDate === "function") return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

function docToProject(id, data) {
  const proj = { ...data, id, startDate: toDate(data.startDate), endDate: toDate(data.endDate) };
  // phaseSchedules 내 Timestamp → Date 변환
  if (data.phaseSchedules) {
    proj.phaseSchedules = {};
    for (const [key, val] of Object.entries(data.phaseSchedules)) {
      proj.phaseSchedules[key] = {
        plannedStart: val.plannedStart ? toDate(val.plannedStart) : null,
        plannedEnd: val.plannedEnd ? toDate(val.plannedEnd) : null,
        actualStart: val.actualStart ? toDate(val.actualStart) : null,
        actualEnd: val.actualEnd ? toDate(val.actualEnd) : null,
      };
    }
  }
  return proj;
}

function docToChecklistItem(id, data) {
  return {
    ...data, id,
    dueDate: toDate(data.dueDate),
    completedDate: data.completedDate ? toDate(data.completedDate) : undefined,
    comments: (data.comments || []).map(c => ({ ...c, createdAt: toDate(c.createdAt) })),
  };
}

function docToCustomer(id, data) {
  return { ...data, id, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) };
}

function docToLaunchChecklist(id, data) {
  return {
    ...data, id,
    dueDate: data.dueDate ? toDate(data.dueDate) : undefined,
    completedDate: data.completedDate ? toDate(data.completedDate) : undefined,
    checkedBy: data.checkedBy || null,
    checkedAt: data.checkedAt ? toDate(data.checkedAt) : null,
    checkedNote: data.checkedNote || "",
  };
}

function docToPortalNotification(id, data) {
  return { ...data, id, createdAt: toDate(data.createdAt) };
}

function docToNotification(id, data) {
  return { ...data, id, createdAt: toDate(data.createdAt) };
}

function docToUser(id, data) {
  return { ...data, id };
}

// ─── Demo Data Filtering ────────────────────────────────────────────────────
// ─── Mock Data (inline for seeding) ─────────────────────────────────────────

function getMockData() {
  const today = new Date();
  const _d = (offset) => new Date(today.getTime() + offset * 86400000);

  const mockUsers = [
    { id: "user1", name: "김철수", email: "chulsoo@company.com", role: "worker", department: "개발팀" },
    { id: "user2", name: "이영희", email: "younghee@company.com", role: "manager", department: "개발팀" },
    { id: "user3", name: "박민수", email: "minsu@company.com", role: "observer", department: "경영관리팀" },
    { id: "user4", name: "최지영", email: "jiyoung@company.com", role: "worker", department: "품질팀" },
    { id: "user5", name: "정수현", email: "soohyun@company.com", role: "worker", department: "제조팀" },
    { id: "user6", name: "강민지", email: "minji@company.com", role: "manager", department: "품질팀" },
    { id: "user7", name: "홍길동", email: "gildong@company.com", role: "worker", department: "디자인연구소" },
  ];

  const mockProjects = [
    { id: "proj1", name: "신규 체성분 분석기 개발", productType: "체성분 분석기", projectType: "신규개발", status: "active", progress: 35, startDate: new Date("2026-01-01"), endDate: new Date("2026-08-31"), riskLevel: "yellow", currentStage: "WM제작" },
    { id: "proj2", name: "가정용 혈압계 업그레이드", productType: "혈압계", projectType: "신규개발", status: "active", progress: 65, startDate: new Date("2025-10-01"), endDate: new Date("2026-05-31"), riskLevel: "green", currentStage: "Tx단계" },
    { id: "proj3", name: "FRA 장비 신모델", productType: "FRA", projectType: "신규개발", status: "active", progress: 15, startDate: new Date("2026-02-01"), endDate: new Date("2026-12-31"), riskLevel: "green", currentStage: "기획검토" },
    { id: "proj4", name: "신장계 신규 모델", productType: "신장계", projectType: "신규개발", status: "active", progress: 85, startDate: new Date("2025-11-01"), endDate: new Date("2026-03-31"), riskLevel: "red", currentStage: "MSG승인회" },
    { id: "proj5", name: "이전 프로젝트 (완료)", productType: "혈압계", projectType: "신규개발", status: "completed", progress: 100, startDate: new Date("2025-06-01"), endDate: new Date("2025-12-31"), riskLevel: "green", currentStage: "영업이관" },
  ];

  // checklistItems are now generated from templates via applyTemplateToProject()
  // (see seedDatabaseIfEmpty below)

  const now = new Date();
  const h = (offset) => new Date(now.getTime() + offset * 3600000);

  const mockNotifications = [
    { id: "notif1", userId: "user1", type: "deadline_approaching", title: "⚠️ 마감일이 오늘입니다", message: "[신규 체성분 분석기] eBOM 작성 - 오늘 마감", link: "/projects/proj1/tasks/task2", read: false, createdAt: h(-1) },
    { id: "notif2", userId: "user1", type: "task_assigned", title: "새 작업이 배정되었습니다", message: "[신규 체성분 분석기] 스펙 정리 및 분석 완료", link: "/projects/proj1/tasks/task1", read: false, createdAt: h(-2) },
    { id: "notif3", userId: "user1", type: "deadline_approaching", title: "마감일이 1일 남았습니다", message: "[신장계] 최종 도면 승인 - 이미 마감일 지남 (긴급)", link: "/projects/proj4/tasks/task14", read: false, createdAt: h(-3) },
    { id: "notif5", userId: "user1", type: "approval_request", title: "승인 완료", message: "이영희님이 NABC 분석 완료 작업을 승인했습니다", link: "/projects/proj1/tasks/task4", read: true, createdAt: h(-48) },
    { id: "notif6", userId: "user4", type: "deadline_approaching", title: "마감일이 내일입니다", message: "[가정용 혈압계] 낙하 테스트 실시 - 내일 마감", link: "/projects/proj2/tasks/task7", read: false, createdAt: h(-2) },
    { id: "notif7", userId: "user5", type: "deadline_approaching", title: "⚠️ 마감일이 오늘입니다", message: "[신장계] 양산 라인 셋업 - 오늘 마감", link: "/projects/proj4/tasks/task8", read: false, createdAt: h(-1) },
  ];

  const mockCustomers = [
    { id: "cust1", name: "서울메디칼", type: "dealer", region: "서울/경기", contactName: "김대현", contactEmail: "kim@seoulmed.co.kr", contactPhone: "02-1234-5678", salesRep: "이상민", contractStatus: "active", products: ["proj1", "proj2"], notes: "주요 대리점, 10년 거래", portalEnabled: true, portalLoginEmail: "portal@seoulmed.co.kr", portalAccessLevel: "detailed" },
    { id: "cust2", name: "부산의료기", type: "dealer", region: "부산/경남", contactName: "박성훈", contactEmail: "park@busanmed.co.kr", contactPhone: "051-987-6543", salesRep: "이상민", contractStatus: "active", products: ["proj1", "proj4"], notes: "남부 지역 주력", portalEnabled: true, portalLoginEmail: "portal@busanmed.co.kr", portalAccessLevel: "basic" },
    { id: "cust3", name: "일본법인 (JP)", type: "subsidiary", region: "일본", contactName: "田中太郎", contactEmail: "tanaka@company-jp.co.jp", contactPhone: "+81-3-1234-5678", salesRep: "정해외", contractStatus: "active", products: ["proj1", "proj2"], notes: "일본 시장 독점 파트너", portalEnabled: true, portalLoginEmail: "portal@company-jp.co.jp", portalAccessLevel: "detailed" },
    { id: "cust4", name: "서울대학병원", type: "hospital", region: "서울", contactName: "이의사", contactEmail: "lee@snuh.org", contactPhone: "02-2072-0000", salesRep: "이상민", contractStatus: "active", products: ["proj1"], notes: "직거래 대형병원", portalEnabled: false, portalLoginEmail: "", portalAccessLevel: "basic" },
    { id: "cust5", name: "글로벌메드 (US)", type: "subsidiary", region: "미국", contactName: "John Smith", contactEmail: "john@globalmed-us.com", contactPhone: "+1-555-0123", salesRep: "정해외", contractStatus: "negotiating", products: ["proj1"], notes: "미국 시장 진출 파트너 (협상 중)", portalEnabled: false, portalLoginEmail: "", portalAccessLevel: "basic" },
    { id: "cust6", name: "대전메디서플라이", type: "dealer", region: "대전/충남", contactName: "최영수", contactEmail: "choi@djmed.co.kr", contactPhone: "042-111-2222", salesRep: "이상민", contractStatus: "active", products: ["proj2", "proj4"], notes: "중부 지역 대리점", portalEnabled: true, portalLoginEmail: "portal@djmed.co.kr", portalAccessLevel: "basic" },
  ];

  return { mockUsers, mockProjects, mockNotifications, mockCustomers };
}

// ─── Seed Templates Only (separated from demo data) ──────────────────────────

// ── 193개 템플릿 아이템 데이터 (seedTemplatesIfEmpty + seedDatabaseIfEmpty 공유) ──
function _getTemplateItems() {
  return [
    // ── Phase 0: 발의 (22개) ──────────────────────────────────────
    { id: "ti-1", stageId: "phase0", departmentId: "dept1", content: "제품 컨셉 정의서 작성", order: 0, isRequired: true },
    { id: "ti-2", stageId: "phase0", departmentId: "dept1", content: "기술 타당성 사전 검토", order: 1, isRequired: true },
    { id: "ti-3", stageId: "phase0", departmentId: "dept1", content: "선행 기술 조사 보고서", order: 2, isRequired: true },
    { id: "ti-4", stageId: "phase0", departmentId: "dept1", content: "NABC 분석 작성", order: 3, isRequired: true },
    { id: "ti-5", stageId: "phase0", departmentId: "dept1", content: "지적재산권 사전 검토", order: 4, isRequired: false },
    { id: "ti-6", stageId: "phase0", departmentId: "dept1", content: "발의 심사 발표자료 준비", order: 5, isRequired: true },
    { id: "ti-7", stageId: "phase0", departmentId: "dept2", content: "품질 목표 수립", order: 0, isRequired: true },
    { id: "ti-8", stageId: "phase0", departmentId: "dept2", content: "해당 규격/표준 목록 사전 조사", order: 1, isRequired: true },
    { id: "ti-9", stageId: "phase0", departmentId: "dept2", content: "유사 제품 CAPA/불만 데이터 분석", order: 2, isRequired: false },
    { id: "ti-10", stageId: "phase0", departmentId: "dept3", content: "시장 기회 분석 보고서", order: 0, isRequired: true },
    { id: "ti-11", stageId: "phase0", departmentId: "dept3", content: "경쟁사 제품 분석", order: 1, isRequired: true },
    { id: "ti-12", stageId: "phase0", departmentId: "dept3", content: "목표 고객군 정의", order: 2, isRequired: true },
    { id: "ti-13", stageId: "phase0", departmentId: "dept3", content: "예상 판매가/판매량 추정", order: 3, isRequired: false },
    { id: "ti-14", stageId: "phase0", departmentId: "dept7", content: "사업성 검토 (ROI/수익성 분석)", order: 0, isRequired: true },
    { id: "ti-15", stageId: "phase0", departmentId: "dept7", content: "초기 프로젝트 예산 산정", order: 1, isRequired: true },
    { id: "ti-16", stageId: "phase0", departmentId: "dept7", content: "프로젝트 일정 초안 수립", order: 2, isRequired: true },
    { id: "ti-17", stageId: "phase0", departmentId: "dept7", content: "발의 승인 판단 근거 자료 취합", order: 3, isRequired: true },
    { id: "ti-18", stageId: "phase0", departmentId: "dept10", content: "규제 분류 사전 검토 (등급/품목 예비 분류)", order: 0, isRequired: true },
    { id: "ti-19", stageId: "phase0", departmentId: "dept10", content: "인허가 경로 조사 (국내 MFDS + 해외)", order: 1, isRequired: true },
    { id: "ti-20", stageId: "phase0", departmentId: "dept10", content: "필수 인증 목록 사전 파악", order: 2, isRequired: false },
    { id: "ti-21", stageId: "phase0", departmentId: "dept9", content: "사용자 니즈 사전 조사", order: 0, isRequired: false },
    { id: "ti-22", stageId: "phase0", departmentId: "dept9", content: "컨셉 스케치/무드보드", order: 1, isRequired: false },
    // ── Phase 1: 기획 (37개) ──────────────────────────────────────
    { id: "ti-23", stageId: "phase1", departmentId: "dept1", content: "설계 입력(Design Input) 요구사항 명세서", order: 0, isRequired: true },
    { id: "ti-24", stageId: "phase1", departmentId: "dept1", content: "제품 사양서(Product Specification) 작성", order: 1, isRequired: true },
    { id: "ti-25", stageId: "phase1", departmentId: "dept1", content: "소프트웨어 개발 계획 수립 (IEC 62304)", order: 2, isRequired: true },
    { id: "ti-26", stageId: "phase1", departmentId: "dept1", content: "시스템 아키텍처 설계", order: 3, isRequired: true },
    { id: "ti-27", stageId: "phase1", departmentId: "dept1", content: "설계 검증/확인 계획 수립", order: 4, isRequired: true },
    { id: "ti-28", stageId: "phase1", departmentId: "dept1", content: "개발 일정 상세 수립", order: 5, isRequired: true },
    { id: "ti-29", stageId: "phase1", departmentId: "dept1", content: "기술 위험 분석 (초기 FMEA)", order: 6, isRequired: true },
    { id: "ti-30", stageId: "phase1", departmentId: "dept1", content: "기획 승인회 발표자료 작성", order: 7, isRequired: true },
    { id: "ti-31", stageId: "phase1", departmentId: "dept2", content: "위험관리 계획서 수립 (ISO 14971)", order: 0, isRequired: true },
    { id: "ti-32", stageId: "phase1", departmentId: "dept2", content: "적용 규격/표준 확정 및 적합성 매트릭스", order: 1, isRequired: true },
    { id: "ti-33", stageId: "phase1", departmentId: "dept2", content: "설계 관리(Design Control) 절차 확인", order: 2, isRequired: true },
    { id: "ti-34", stageId: "phase1", departmentId: "dept2", content: "시험/검증 계획서 초안", order: 3, isRequired: true },
    { id: "ti-35", stageId: "phase1", departmentId: "dept2", content: "DHF(설계이력파일) 구성 계획", order: 4, isRequired: true },
    { id: "ti-36", stageId: "phase1", departmentId: "dept2", content: "사용적합성(Usability) 엔지니어링 계획 (IEC 62366)", order: 5, isRequired: false },
    { id: "ti-37", stageId: "phase1", departmentId: "dept3", content: "고객 요구사항 정의서", order: 0, isRequired: true },
    { id: "ti-38", stageId: "phase1", departmentId: "dept3", content: "가격 전략 수립", order: 1, isRequired: true },
    { id: "ti-39", stageId: "phase1", departmentId: "dept3", content: "마케팅 요구사항 정리 (라벨링, 포장 등)", order: 2, isRequired: false },
    { id: "ti-40", stageId: "phase1", departmentId: "dept3", content: "기획 단계 시장성 검증 결과", order: 3, isRequired: true },
    { id: "ti-41", stageId: "phase1", departmentId: "dept4", content: "제조 타당성 검토", order: 0, isRequired: true },
    { id: "ti-42", stageId: "phase1", departmentId: "dept4", content: "초기 공정 흐름도 검토", order: 1, isRequired: false },
    { id: "ti-43", stageId: "phase1", departmentId: "dept4", content: "제조 비용 사전 추정", order: 2, isRequired: false },
    { id: "ti-44", stageId: "phase1", departmentId: "dept5", content: "주요 부품/원재료 사전 조사", order: 0, isRequired: true },
    { id: "ti-45", stageId: "phase1", departmentId: "dept5", content: "공급업체 후보 리스트 작성", order: 1, isRequired: false },
    { id: "ti-46", stageId: "phase1", departmentId: "dept6", content: "서비스 요구사항 정의 (A/S, 유지보수 등)", order: 0, isRequired: false },
    { id: "ti-47", stageId: "phase1", departmentId: "dept7", content: "프로젝트 상세 예산 확정", order: 0, isRequired: true },
    { id: "ti-48", stageId: "phase1", departmentId: "dept7", content: "자원 배분 계획 (인력/설비)", order: 1, isRequired: true },
    { id: "ti-49", stageId: "phase1", departmentId: "dept7", content: "비용/일정 검토 결과 보고", order: 2, isRequired: true },
    { id: "ti-50", stageId: "phase1", departmentId: "dept8", content: "임상 전략 수립 (임상 필요성 판단)", order: 0, isRequired: true },
    { id: "ti-51", stageId: "phase1", departmentId: "dept8", content: "임상시험 예비 계획서", order: 1, isRequired: false },
    { id: "ti-52", stageId: "phase1", departmentId: "dept9", content: "산업 디자인 요구사항 정의", order: 0, isRequired: true },
    { id: "ti-53", stageId: "phase1", departmentId: "dept9", content: "사용자 인터페이스(UI) 요구사항 정의", order: 1, isRequired: true },
    { id: "ti-54", stageId: "phase1", departmentId: "dept9", content: "인간공학 설계 요구사항", order: 2, isRequired: true },
    { id: "ti-55", stageId: "phase1", departmentId: "dept9", content: "초기 디자인 컨셉 개발 (2-3안)", order: 3, isRequired: false },
    { id: "ti-56", stageId: "phase1", departmentId: "dept10", content: "인허가 전략서 확정", order: 0, isRequired: true },
    { id: "ti-57", stageId: "phase1", departmentId: "dept10", content: "필수 시험 항목 목록 확정", order: 1, isRequired: true },
    { id: "ti-58", stageId: "phase1", departmentId: "dept10", content: "기술문서 작성 계획 수립", order: 2, isRequired: true },
    { id: "ti-59", stageId: "phase1", departmentId: "dept10", content: "해외 인증 로드맵 수립 (CE, FDA 등)", order: 3, isRequired: false },
    // ── Phase 2: WM (35개) ──────────────────────────────────────
    { id: "ti-60", stageId: "phase2", departmentId: "dept1", content: "eBOM (설계 자재 명세서) 작성", order: 0, isRequired: true },
    { id: "ti-61", stageId: "phase2", departmentId: "dept1", content: "상세 설계 문서 작성 (도면/3D 모델)", order: 1, isRequired: true },
    { id: "ti-62", stageId: "phase2", departmentId: "dept1", content: "시제품(Working Model) 제작", order: 2, isRequired: true },
    { id: "ti-63", stageId: "phase2", departmentId: "dept1", content: "소프트웨어 구현 및 단위 테스트 (IEC 62304)", order: 3, isRequired: true },
    { id: "ti-64", stageId: "phase2", departmentId: "dept1", content: "설계 출력(Design Output) 문서화", order: 4, isRequired: true },
    { id: "ti-65", stageId: "phase2", departmentId: "dept1", content: "설계 검증(Design Verification) 실시", order: 5, isRequired: true },
    { id: "ti-66", stageId: "phase2", departmentId: "dept1", content: "HW/SW 통합 테스트", order: 6, isRequired: true },
    { id: "ti-67", stageId: "phase2", departmentId: "dept1", content: "전기 안전 사전 시험 (IEC 60601-1)", order: 7, isRequired: false },
    { id: "ti-68", stageId: "phase2", departmentId: "dept1", content: "W/M 검증 결과 보고서", order: 8, isRequired: true },
    { id: "ti-69", stageId: "phase2", departmentId: "dept2", content: "설계 검증 시험 계획서 확정", order: 0, isRequired: true },
    { id: "ti-70", stageId: "phase2", departmentId: "dept2", content: "위험 분석 업데이트 (FMEA 정교화)", order: 1, isRequired: true },
    { id: "ti-71", stageId: "phase2", departmentId: "dept2", content: "신뢰성 시험 계획 수립", order: 2, isRequired: true },
    { id: "ti-72", stageId: "phase2", departmentId: "dept2", content: "검교정 장비/시험 설비 확보", order: 3, isRequired: true },
    { id: "ti-73", stageId: "phase2", departmentId: "dept2", content: "IQ/OQ 프로토콜 초안", order: 4, isRequired: false },
    { id: "ti-74", stageId: "phase2", departmentId: "dept2", content: "W/M 품질 검증 보고서", order: 5, isRequired: true },
    { id: "ti-75", stageId: "phase2", departmentId: "dept4", content: "시제품 제작 공정 검토", order: 0, isRequired: true },
    { id: "ti-76", stageId: "phase2", departmentId: "dept4", content: "제작 공정 흐름도(Process Flow) 작성", order: 1, isRequired: true },
    { id: "ti-77", stageId: "phase2", departmentId: "dept4", content: "시제품 조립 지원", order: 2, isRequired: true },
    { id: "ti-78", stageId: "phase2", departmentId: "dept4", content: "공정 개선점 초기 도출", order: 3, isRequired: false },
    { id: "ti-79", stageId: "phase2", departmentId: "dept5", content: "시제품 부품 조달", order: 0, isRequired: true },
    { id: "ti-80", stageId: "phase2", departmentId: "dept5", content: "핵심 공급업체 선정 및 평가", order: 1, isRequired: true },
    { id: "ti-81", stageId: "phase2", departmentId: "dept5", content: "부품 수급 리드타임 확인", order: 2, isRequired: true },
    { id: "ti-82", stageId: "phase2", departmentId: "dept5", content: "공급업체 품질 협약서(SQA) 체결", order: 3, isRequired: false },
    { id: "ti-83", stageId: "phase2", departmentId: "dept9", content: "외관 디자인 확정", order: 0, isRequired: true },
    { id: "ti-84", stageId: "phase2", departmentId: "dept9", content: "사용자 인터페이스(UI/UX) 설계", order: 1, isRequired: true },
    { id: "ti-85", stageId: "phase2", departmentId: "dept9", content: "목업/외관 시제품 제작", order: 2, isRequired: true },
    { id: "ti-86", stageId: "phase2", departmentId: "dept9", content: "사용성 사전 평가", order: 3, isRequired: false },
    { id: "ti-87", stageId: "phase2", departmentId: "dept9", content: "디자인 검증 결과 보고", order: 4, isRequired: true },
    { id: "ti-88", stageId: "phase2", departmentId: "dept10", content: "인증 전략 세부 수립 (각국별 요구사항 분석)", order: 0, isRequired: true },
    { id: "ti-89", stageId: "phase2", departmentId: "dept10", content: "기술문서 초안 작성 시작", order: 1, isRequired: true },
    { id: "ti-90", stageId: "phase2", departmentId: "dept10", content: "필수 시험 항목 확인 및 시험소 선정", order: 2, isRequired: true },
    { id: "ti-91", stageId: "phase2", departmentId: "dept10", content: "라벨링/IFU 초안 검토", order: 3, isRequired: false },
    { id: "ti-92", stageId: "phase2", departmentId: "dept8", content: "임상 문헌 조사", order: 0, isRequired: true },
    { id: "ti-93", stageId: "phase2", departmentId: "dept8", content: "임상시험 프로토콜 초안 작성", order: 1, isRequired: false },
    { id: "ti-94", stageId: "phase2", departmentId: "dept7", content: "중간 비용 실적 검토", order: 0, isRequired: false },
    // ── Phase 3: Tx (39개) ──────────────────────────────────────
    { id: "ti-95", stageId: "phase3", departmentId: "dept1", content: "설계 확인(Design Validation) 실시", order: 0, isRequired: true },
    { id: "ti-96", stageId: "phase3", departmentId: "dept1", content: "소프트웨어 검증/확인 완료 (IEC 62304)", order: 1, isRequired: true },
    { id: "ti-97", stageId: "phase3", departmentId: "dept1", content: "기술 문서 최종 검토", order: 2, isRequired: true },
    { id: "ti-98", stageId: "phase3", departmentId: "dept1", content: "설계 동결(Design Freeze)", order: 3, isRequired: true },
    { id: "ti-99", stageId: "phase3", departmentId: "dept1", content: "설계 이전(Design Transfer) 문서 작성", order: 4, isRequired: true },
    { id: "ti-100", stageId: "phase3", departmentId: "dept1", content: "성능 시험 보고서 작성", order: 5, isRequired: true },
    { id: "ti-101", stageId: "phase3", departmentId: "dept2", content: "신뢰성 시험 실시 (낙하/진동/온습도 등)", order: 0, isRequired: true },
    { id: "ti-102", stageId: "phase3", departmentId: "dept2", content: "EMC 시험 실시 (IEC 60601-1-2)", order: 1, isRequired: true },
    { id: "ti-103", stageId: "phase3", departmentId: "dept2", content: "전기 안전 시험 실시 (IEC 60601-1)", order: 2, isRequired: true },
    { id: "ti-104", stageId: "phase3", departmentId: "dept2", content: "생물학적 안전성 시험 (ISO 10993)", order: 3, isRequired: true },
    { id: "ti-105", stageId: "phase3", departmentId: "dept2", content: "사용적합성(Usability) 검증 시험 (IEC 62366)", order: 4, isRequired: true },
    { id: "ti-106", stageId: "phase3", departmentId: "dept2", content: "위험 분석 최종 보고서 (ISO 14971)", order: 5, isRequired: true },
    { id: "ti-107", stageId: "phase3", departmentId: "dept2", content: "시험 성적서 취합 및 검토", order: 6, isRequired: true },
    { id: "ti-108", stageId: "phase3", departmentId: "dept2", content: "Tx 시험 성적서 총괄 취합", order: 7, isRequired: true },
    { id: "ti-109", stageId: "phase3", departmentId: "dept4", content: "시험 생산 준비", order: 0, isRequired: true },
    { id: "ti-110", stageId: "phase3", departmentId: "dept4", content: "공정 FMEA (pFMEA) 작성", order: 1, isRequired: true },
    { id: "ti-111", stageId: "phase3", departmentId: "dept4", content: "제조 작업 지시서 초안", order: 2, isRequired: true },
    { id: "ti-112", stageId: "phase3", departmentId: "dept4", content: "시험 생산 실시 (소량)", order: 3, isRequired: false },
    { id: "ti-113", stageId: "phase3", departmentId: "dept5", content: "시험 자재 조달", order: 0, isRequired: true },
    { id: "ti-114", stageId: "phase3", departmentId: "dept5", content: "수입검사 기준서 작성", order: 1, isRequired: true },
    { id: "ti-115", stageId: "phase3", departmentId: "dept5", content: "공급업체 2차 평가", order: 2, isRequired: false },
    { id: "ti-116", stageId: "phase3", departmentId: "dept8", content: "임상시험 실시 (IRB 승인 후)", order: 0, isRequired: true },
    { id: "ti-117", stageId: "phase3", departmentId: "dept8", content: "임상 데이터 수집/분석", order: 1, isRequired: true },
    { id: "ti-118", stageId: "phase3", departmentId: "dept8", content: "임상시험 결과 보고서 작성", order: 2, isRequired: true },
    { id: "ti-119", stageId: "phase3", departmentId: "dept8", content: "임상적 평가 보고서(CER) 작성", order: 3, isRequired: true },
    { id: "ti-120", stageId: "phase3", departmentId: "dept8", content: "해외 임상 시험 진행 (대상국 해당 시)", order: 4, isRequired: false },
    { id: "ti-121", stageId: "phase3", departmentId: "dept8", content: "임상 결과 최종 보고", order: 5, isRequired: true },
    { id: "ti-122", stageId: "phase3", departmentId: "dept10", content: "MFDS 기술문서 작성 완료", order: 0, isRequired: true },
    { id: "ti-123", stageId: "phase3", departmentId: "dept10", content: "MFDS 인허가 신청 (품목인증/허가)", order: 1, isRequired: true },
    { id: "ti-124", stageId: "phase3", departmentId: "dept10", content: "GMP 적합성 평가 준비", order: 2, isRequired: true },
    { id: "ti-125", stageId: "phase3", departmentId: "dept10", content: "CE 기술문서 작성 (해당 시)", order: 3, isRequired: false },
    { id: "ti-126", stageId: "phase3", departmentId: "dept10", content: "FDA 510(k)/PMA 서류 준비 (해당 시)", order: 4, isRequired: false },
    { id: "ti-127", stageId: "phase3", departmentId: "dept10", content: "라벨링/IFU 최종본 작성", order: 5, isRequired: true },
    { id: "ti-128", stageId: "phase3", departmentId: "dept10", content: "적합성 선언서 작성", order: 6, isRequired: true },
    { id: "ti-129", stageId: "phase3", departmentId: "dept10", content: "인증 시험 결과 보고서", order: 7, isRequired: true },
    { id: "ti-130", stageId: "phase3", departmentId: "dept9", content: "최종 외관 디자인 확정 (양산용)", order: 0, isRequired: true },
    { id: "ti-131", stageId: "phase3", departmentId: "dept9", content: "포장 디자인 개발", order: 1, isRequired: true },
    { id: "ti-132", stageId: "phase3", departmentId: "dept3", content: "제품 카탈로그/브로슈어 초안", order: 0, isRequired: false },
    { id: "ti-133", stageId: "phase3", departmentId: "dept3", content: "판매 채널 사전 확보", order: 1, isRequired: false },
    // ── Phase 4: MSG (31개) ──────────────────────────────────────
    { id: "ti-134", stageId: "phase4", departmentId: "dept1", content: "양산 도면 확정", order: 0, isRequired: true },
    { id: "ti-135", stageId: "phase4", departmentId: "dept1", content: "mBOM (제조 자재 명세서) 확정", order: 1, isRequired: true },
    { id: "ti-136", stageId: "phase4", departmentId: "dept1", content: "설계 이전(Design Transfer) 완료 확인", order: 2, isRequired: true },
    { id: "ti-137", stageId: "phase4", departmentId: "dept1", content: "양산용 소프트웨어 릴리스", order: 3, isRequired: true },
    { id: "ti-138", stageId: "phase4", departmentId: "dept2", content: "공정 밸리데이션 (IQ/OQ/PQ) 실시", order: 0, isRequired: true },
    { id: "ti-139", stageId: "phase4", departmentId: "dept2", content: "최종 품질 검증 (출하 검사 기준 확정)", order: 1, isRequired: true },
    { id: "ti-140", stageId: "phase4", departmentId: "dept2", content: "양산 품질 기준서 작성", order: 2, isRequired: true },
    { id: "ti-141", stageId: "phase4", departmentId: "dept2", content: "검사 장비 밸리데이션", order: 3, isRequired: true },
    { id: "ti-142", stageId: "phase4", departmentId: "dept2", content: "시생산 제품 최종 검사", order: 4, isRequired: true },
    { id: "ti-143", stageId: "phase4", departmentId: "dept2", content: "DHF(설계이력파일) 최종 정리", order: 5, isRequired: true },
    { id: "ti-144", stageId: "phase4", departmentId: "dept2", content: "양산 전 최종 품질 판정 보고", order: 6, isRequired: true },
    { id: "ti-145", stageId: "phase4", departmentId: "dept4", content: "양산 공정 계획 수립", order: 0, isRequired: true },
    { id: "ti-146", stageId: "phase4", departmentId: "dept4", content: "시생산(Pilot Run) 실시", order: 1, isRequired: true },
    { id: "ti-147", stageId: "phase4", departmentId: "dept4", content: "양산 라인 셋업", order: 2, isRequired: true },
    { id: "ti-148", stageId: "phase4", departmentId: "dept4", content: "작업 표준서(SOP) 확정", order: 3, isRequired: true },
    { id: "ti-149", stageId: "phase4", departmentId: "dept4", content: "시생산 결과 분석 및 개선", order: 4, isRequired: true },
    { id: "ti-150", stageId: "phase4", departmentId: "dept4", content: "특수공정 밸리데이션", order: 5, isRequired: false },
    { id: "ti-151", stageId: "phase4", departmentId: "dept4", content: "양산 Capacity/Takt Time 확인", order: 6, isRequired: true },
    { id: "ti-152", stageId: "phase4", departmentId: "dept4", content: "시생산 결과 최종 보고", order: 7, isRequired: true },
    { id: "ti-153", stageId: "phase4", departmentId: "dept5", content: "양산 자재 조달 계획 확정", order: 0, isRequired: true },
    { id: "ti-154", stageId: "phase4", departmentId: "dept5", content: "양산용 공급업체 계약 확정", order: 1, isRequired: true },
    { id: "ti-155", stageId: "phase4", departmentId: "dept5", content: "안전 재고 수준 설정", order: 2, isRequired: true },
    { id: "ti-156", stageId: "phase4", departmentId: "dept5", content: "수입검사 체계 확정", order: 3, isRequired: true },
    { id: "ti-157", stageId: "phase4", departmentId: "dept10", content: "인허가 승인 확인", order: 0, isRequired: true },
    { id: "ti-158", stageId: "phase4", departmentId: "dept10", content: "GMP 적합성 인정 확인", order: 1, isRequired: true },
    { id: "ti-159", stageId: "phase4", departmentId: "dept10", content: "제조소 변경 시 변경 신고 (해당 시)", order: 2, isRequired: false },
    { id: "ti-160", stageId: "phase4", departmentId: "dept10", content: "인허가 현황 최종 보고", order: 3, isRequired: true },
    { id: "ti-161", stageId: "phase4", departmentId: "dept9", content: "양산용 포장/라벨 디자인 확정", order: 0, isRequired: true },
    { id: "ti-162", stageId: "phase4", departmentId: "dept9", content: "사용 설명서(IFU) 최종 디자인 확정", order: 1, isRequired: true },
    { id: "ti-163", stageId: "phase4", departmentId: "dept7", content: "양산 원가 산정 확정", order: 0, isRequired: true },
    { id: "ti-164", stageId: "phase4", departmentId: "dept7", content: "출시 일정 확정", order: 1, isRequired: true },
    // ── Phase 5: 양산/이관 (29개) ──────────────────────────────────────
    { id: "ti-165", stageId: "phase5", departmentId: "dept1", content: "양산 초기 기술 지원", order: 0, isRequired: true },
    { id: "ti-166", stageId: "phase5", departmentId: "dept1", content: "설계 이력 파일(DHF) 최종 이관", order: 1, isRequired: true },
    { id: "ti-167", stageId: "phase5", departmentId: "dept2", content: "초도품 검사 실시 (FAI)", order: 0, isRequired: true },
    { id: "ti-168", stageId: "phase5", departmentId: "dept2", content: "양산 초기 불량률 모니터링", order: 1, isRequired: true },
    { id: "ti-169", stageId: "phase5", departmentId: "dept2", content: "출하 검사 프로세스 가동", order: 2, isRequired: true },
    { id: "ti-170", stageId: "phase5", departmentId: "dept2", content: "시판 후 감시(PMS) 계획 수립", order: 3, isRequired: true },
    { id: "ti-171", stageId: "phase5", departmentId: "dept3", content: "판매 개시 준비 완료 확인", order: 0, isRequired: true },
    { id: "ti-172", stageId: "phase5", departmentId: "dept3", content: "영업 교육 실시", order: 1, isRequired: true },
    { id: "ti-173", stageId: "phase5", departmentId: "dept3", content: "제품 카탈로그/브로슈어 최종본", order: 2, isRequired: true },
    { id: "ti-174", stageId: "phase5", departmentId: "dept3", content: "거래처 등록/공급 계약", order: 3, isRequired: true },
    { id: "ti-175", stageId: "phase5", departmentId: "dept3", content: "온라인 마케팅 자료 게시", order: 4, isRequired: false },
    { id: "ti-176", stageId: "phase5", departmentId: "dept4", content: "양산 가동 개시", order: 0, isRequired: true },
    { id: "ti-177", stageId: "phase5", departmentId: "dept4", content: "양산 안정화 (수율 확인)", order: 1, isRequired: true },
    { id: "ti-178", stageId: "phase5", departmentId: "dept4", content: "양산 SOP 최종 확정", order: 2, isRequired: true },
    { id: "ti-179", stageId: "phase5", departmentId: "dept4", content: "초기 공정 능력(Cpk) 확인", order: 3, isRequired: true },
    { id: "ti-180", stageId: "phase5", departmentId: "dept5", content: "양산 자재 안정 공급 확인", order: 0, isRequired: true },
    { id: "ti-181", stageId: "phase5", departmentId: "dept5", content: "납품 일정 관리 체계 가동", order: 1, isRequired: true },
    { id: "ti-182", stageId: "phase5", departmentId: "dept6", content: "A/S 체계 구축", order: 0, isRequired: true },
    { id: "ti-183", stageId: "phase5", departmentId: "dept6", content: "고객 상담 매뉴얼 작성", order: 1, isRequired: true },
    { id: "ti-184", stageId: "phase5", departmentId: "dept6", content: "보수용 부품 재고 확보", order: 2, isRequired: true },
    { id: "ti-185", stageId: "phase5", departmentId: "dept6", content: "CS 담당자 교육 실시", order: 3, isRequired: true },
    { id: "ti-186", stageId: "phase5", departmentId: "dept7", content: "최종 원가 확정 및 손익 분석", order: 0, isRequired: true },
    { id: "ti-187", stageId: "phase5", departmentId: "dept7", content: "프로젝트 종료 보고서", order: 1, isRequired: true },
    { id: "ti-188", stageId: "phase5", departmentId: "dept7", content: "프로젝트 Lessons Learned 정리", order: 2, isRequired: false },
    { id: "ti-189", stageId: "phase5", departmentId: "dept8", content: "시판 후 임상 추적(PMCF) 계획 수립 (해당 시)", order: 0, isRequired: false },
    { id: "ti-190", stageId: "phase5", departmentId: "dept10", content: "최종 인허가 완료 확인서", order: 0, isRequired: true },
    { id: "ti-191", stageId: "phase5", departmentId: "dept10", content: "시판 후 안전성 보고 체계 구축", order: 1, isRequired: true },
    { id: "ti-192", stageId: "phase5", departmentId: "dept10", content: "해외 인허가 완료 현황 정리", order: 2, isRequired: false },
    { id: "ti-193", stageId: "phase5", departmentId: "dept10", content: "정기 안전성 보고 계획 확정", order: 3, isRequired: false },
  ];
}

export async function seedTemplatesIfEmpty() {
  try {
    const stagesSnap = await getDocs(collection(db, "templateStages"));
    if (!stagesSnap.empty) return false; // templates already exist

    console.log("📦 템플릿 데이터가 없어 자동 생성합니다...");
    const batch = writeBatch(db);

    // Template Stages (6 Phases)
    const stages = [
      { id: "phase0", name: "발의", order: 0, workStageName: "발의검토", gateStageName: "발의승인" },
      { id: "phase1", name: "기획", order: 1, workStageName: "기획검토", gateStageName: "기획승인" },
      { id: "phase2", name: "WM", order: 2, workStageName: "WM제작", gateStageName: "WM승인회" },
      { id: "phase3", name: "Tx", order: 3, workStageName: "Tx단계", gateStageName: "Tx승인회" },
      { id: "phase4", name: "MSG", order: 4, workStageName: "MasterGatePilot", gateStageName: "MSG승인회" },
      { id: "phase5", name: "양산/이관", order: 5, workStageName: "양산", gateStageName: "영업이관" },
    ];
    for (const s of stages) {
      batch.set(doc(db, "templateStages", s.id), { ...s, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() });
    }

    // Template Departments (10)
    const depts = [
      { id: "dept1", name: "개발팀", order: 0 },
      { id: "dept2", name: "품질팀", order: 1 },
      { id: "dept3", name: "영업팀", order: 2 },
      { id: "dept4", name: "제조팀", order: 3 },
      { id: "dept5", name: "구매팀", order: 4 },
      { id: "dept6", name: "CS팀", order: 5 },
      { id: "dept7", name: "경영관리팀", order: 6 },
      { id: "dept8", name: "글로벌임상팀", order: 7 },
      { id: "dept9", name: "디자인연구소", order: 8 },
      { id: "dept10", name: "인증팀", order: 9 },
    ];
    for (const d of depts) {
      batch.set(doc(db, "templateDepartments", d.id), { ...d, createdBy: "system", createdAt: Timestamp.now() });
    }

    await batch.commit();

    // Template Items (193개) — 별도 batch (500 limit 대비)
    const tItemsBatch = writeBatch(db);
    const tItems = _getTemplateItems();
    let count = 0;
    for (const ti of tItems) {
      tItemsBatch.set(doc(db, "templateItems", ti.id), { ...ti, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() });
      count++;
    }
    await tItemsBatch.commit();
    console.log(`✅ 템플릿 데이터 시드 완료 (6 phases, 10 departments, ${count} items)`);
    return true;
  } catch (err) {
    console.error("❌ 템플릿 시드 실패:", err);
    return false;
  }
}

// ─── Seed Database ──────────────────────────────────────────────────────────

export async function seedDatabaseIfEmpty() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    if (!usersSnap.empty) {
      return false;
    }

    const { mockUsers, mockProjects, mockNotifications, mockCustomers } = getMockData();
    const batch = writeBatch(db);

    for (const user of mockUsers) {
      batch.set(doc(db, "users", user.id), { ...user });
    }

    for (const project of mockProjects) {
      batch.set(doc(db, "projects", project.id), {
        ...project,
        startDate: Timestamp.fromDate(project.startDate),
        endDate: Timestamp.fromDate(project.endDate),
      });
    }

    for (const notif of mockNotifications) {
      batch.set(doc(db, "notifications", notif.id), {
        ...notif,
        createdAt: Timestamp.fromDate(notif.createdAt),
      });
    }

    // Customers (대리점/법인)
    const now = new Date();
    for (const c of mockCustomers) {
      batch.set(doc(db, "customers", c.id), {
        ...c,
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now),
      });
    }

    // Template Stages (6 Phases — 작업+승인 쌍으로 병합)
    const stages = [
      { id: "phase0", name: "발의", order: 0, workStageName: "발의검토", gateStageName: "발의승인" },
      { id: "phase1", name: "기획", order: 1, workStageName: "기획검토", gateStageName: "기획승인" },
      { id: "phase2", name: "WM", order: 2, workStageName: "WM제작", gateStageName: "WM승인회" },
      { id: "phase3", name: "Tx", order: 3, workStageName: "Tx단계", gateStageName: "Tx승인회" },
      { id: "phase4", name: "MSG", order: 4, workStageName: "MasterGatePilot", gateStageName: "MSG승인회" },
      { id: "phase5", name: "양산/이관", order: 5, workStageName: "양산", gateStageName: "영업이관" },
    ];
    for (const s of stages) {
      batch.set(doc(db, "templateStages", s.id), { ...s, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() });
    }

    // Template Departments
    const depts = [
      { id: "dept1", name: "개발팀", order: 0 },
      { id: "dept2", name: "품질팀", order: 1 },
      { id: "dept3", name: "영업팀", order: 2 },
      { id: "dept4", name: "제조팀", order: 3 },
      { id: "dept5", name: "구매팀", order: 4 },
      { id: "dept6", name: "CS팀", order: 5 },
      { id: "dept7", name: "경영관리팀", order: 6 },
      { id: "dept8", name: "글로벌임상팀", order: 7 },
      { id: "dept9", name: "디자인연구소", order: 8 },
      { id: "dept10", name: "인증팀", order: 9 },
    ];
    for (const d of depts) {
      batch.set(doc(db, "templateDepartments", d.id), { ...d, createdBy: "system", createdAt: Timestamp.now() });
    }

    // Template Items (193개 — 공유 함수 호출)
    const tItems = _getTemplateItems();
    for (const ti of tItems) {
      batch.set(doc(db, "templateItems", ti.id), { ...ti, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() });
    }

    await batch.commit();
    console.log("✅ 기본 데이터 시드 완료, 템플릿 기반 체크리스트 생성 시작...");

    // ── 최적화: 로컬 데이터로 체크리스트 일괄 생성 (Firestore 재읽기 없음) ──
    const _MINOR_PHASES = ["phase0", "phase3", "phase5"];
    const stageMap = {};
    for (const s of stages) stageMap[s.id] = s;
    const deptMap = {};
    for (const d of depts) deptMap[d.id] = d;
    const today = new Date();

    // 모든 프로젝트의 체크리스트를 한꺼번에 생성
    const allChecklistItems = [];
    for (const proj of mockProjects) {
      const filtered = tItems;

      for (const ti of filtered) {
        const stage = stageMap[ti.stageId];
        const dept = deptMap[ti.departmentId];
        if (!stage || !dept) continue;
        allChecklistItems.push({
          projectId: proj.id,
          stage: stage.workStageName,
          department: dept.name,
          title: ti.content,
          description: "",
          assignee: "",
          reviewer: "",
          status: "pending",
          dueDate: Timestamp.fromDate(new Date(today.getTime() + 30 * 86400000)),
          completedDate: null,
          files: [],
          comments: [],
          dependencies: [],
          isRequired: ti.isRequired,
          templateItemId: ti.id,
        });
      }
      console.log(`  → ${proj.name}: ${filtered.length}개`);
    }

    // 450개씩 배치 쓰기
    const BATCH_LIMIT = 450;
    for (let i = 0; i < allChecklistItems.length; i += BATCH_LIMIT) {
      const b = writeBatch(db);
      allChecklistItems.slice(i, i + BATCH_LIMIT).forEach(item => {
        b.set(doc(collection(db, "checklistItems")), item);
      });
      await b.commit();
    }
    console.log(`✅ 체크리스트 ${allChecklistItems.length}개 일괄 생성 완료`);

    // 프로젝트 상태에 맞게 일부 체크리스트 상태 업데이트
    await _seedUpdateChecklistStatuses(mockProjects);

    // 출시 준비 체크리스트 생성 (신규개발 프로젝트에만)
    console.log("✅ 출시 준비 체크리스트 생성 시작...");
    const customerObjs = mockCustomers.map(c => ({ id: c.id, name: c.name }));
    for (const proj of mockProjects) {
      if (proj.projectType === "신규개발" && proj.status === "active") {
        const lCount = await applyLaunchChecklistToProject(
          proj.id, proj.projectType, proj.endDate, customerObjs.slice(0, 3)
        );
        console.log(`  → ${proj.name}: ${lCount}개 출시 준비 체크리스트`);
      }
    }
    // 출시 준비 체크리스트 상태 시드
    await _seedLaunchChecklistStatuses();

    // 포털 알림 시드 (배치로 일괄 처리)
    const pnBatch = writeBatch(db);
    const portalNotifs = [
      { customerId: "cust1", projectId: "proj1", type: "phase_completed", title: "기획 단계 완료", message: "신규 체성분 분석기의 기획 단계가 완료되었습니다." },
      { customerId: "cust1", projectId: "proj2", type: "phase_completed", title: "WM 단계 완료", message: "가정용 혈압계 업그레이드의 WM 단계가 완료되었습니다." },
      { customerId: "cust3", projectId: "proj1", type: "request_resolved", title: "변경 요청 승인", message: "요청하신 '배터리 용량 증대' 건이 승인되었습니다." },
    ];
    for (const pn of portalNotifs) {
      pnBatch.set(doc(collection(db, "portalNotifications")), {
        ...pn, read: false, createdAt: Timestamp.now(),
      });
    }
    await pnBatch.commit();

    console.log("✅ Firestore 초기 데이터 시드 완료");
    return true;
  } catch (error) {
    console.error("❌ Firestore 시드 오류:", error);
    throw error;
  }
}

/**
 * 시드 후 프로젝트 상태에 맞게 체크리스트 항목 상태를 업데이트한다.
 * - 완료된 프로젝트(proj5, proj6, proj10): 모든 항목 completed
 * - 진행 중 프로젝트: currentStage 이전 phase 항목은 completed, 현재 phase는 일부 in_progress
 */
async function _seedUpdateChecklistStatuses(projects) {
  const stageOrder = ["발의검토", "발의승인", "기획검토", "기획승인", "WM제작", "WM승인회", "Tx단계", "Tx승인회", "MasterGatePilot", "MSG승인회", "양산", "영업이관"];

  // 전체 checklistItems를 한 번만 읽기 (프로젝트별 쿼리 10회 → 1회)
  const allSnap = await getDocs(collection(db, "checklistItems"));
  if (allSnap.empty) return;

  // projectId별로 그룹화
  const byProject = {};
  for (const d of allSnap.docs) {
    const pid = d.data().projectId;
    if (!byProject[pid]) byProject[pid] = [];
    byProject[pid].push(d);
  }

  // 프로젝트별 lookup
  const projMap = {};
  for (const p of projects) projMap[p.id] = p;

  // 모든 업데이트를 한 번에 수집 후 배치 쓰기
  const updates = []; // [{ref, data}]
  for (const proj of projects) {
    const docs = byProject[proj.id];
    if (!docs || docs.length === 0) continue;

    const currentIdx = stageOrder.indexOf(proj.currentStage);
    if (currentIdx < 0) continue;

    if (proj.status === "completed") {
      for (const d of docs) {
        updates.push({ ref: d.ref, data: {
          status: "completed",
          completedDate: Timestamp.fromDate(new Date(proj.endDate.getTime() - Math.random() * 30 * 86400000)),
        }});
      }
      continue;
    }

    const completedStages = new Set(stageOrder.slice(0, currentIdx));
    const currentStage = proj.currentStage;

    for (const d of docs) {
      const data = d.data();
      if (completedStages.has(data.stage)) {
        updates.push({ ref: d.ref, data: {
          status: "completed",
          completedDate: Timestamp.fromDate(new Date(Date.now() - Math.random() * 60 * 86400000)),
        }});
      } else if (data.stage === currentStage) {
        const rand = Math.random();
        if (rand < 0.3) {
          updates.push({ ref: d.ref, data: {
            status: "completed",
            completedDate: Timestamp.fromDate(new Date(Date.now() - Math.random() * 7 * 86400000)),
          }});
        } else if (rand < 0.5) {
          updates.push({ ref: d.ref, data: { status: "in_progress" } });
        }
      }
    }
  }

  // 배치 쓰기
  for (let i = 0; i < updates.length; i += 450) {
    const b = writeBatch(db);
    updates.slice(i, i + 450).forEach(u => b.update(u.ref, u.data));
    await b.commit();
  }
  console.log(`✅ 체크리스트 상태 업데이트 ${updates.length}건 완료`);
}

/**
 * 출시 준비 체크리스트 상태 시드:
 * - proj2(Tx단계, 65%): D-Day가 가까운 항목(D-120~D-60) 완료 + 일부 확인 처리
 * - proj1(WM제작, 35%): 초기 단계만 일부 진행중
 */
async function _seedLaunchChecklistStatuses() {
  const salesReps = ["이상민", "정해외", "김영업"];

  // proj2: 진행률 높으므로 D-Day가 먼 항목(D-120~D-60)을 완료 처리
  const q2 = query(collection(db, "launchChecklists"), where("projectId", "==", "proj2"));
  const snap2 = await getDocs(q2);
  if (!snap2.empty) {
    for (let i = 0; i < snap2.docs.length; i += 450) {
      const b = writeBatch(db);
      snap2.docs.slice(i, i + 450).forEach(d => {
        const data = d.data();
        const offset = data.dDayOffset;

        if (offset <= -90) {
          // D-90 이전 항목: 완료 + 확인
          const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
          b.update(d.ref, {
            status: "completed",
            completedDate: Timestamp.fromDate(new Date(Date.now() - Math.random() * 30 * 86400000)),
            assignee: rep,
            ...(data.customerId ? {
              checkedBy: data.customerName || rep,
              checkedAt: Timestamp.fromDate(new Date(Date.now() - Math.random() * 20 * 86400000)),
              checkedNote: "확인 완료",
            } : {}),
          });
        } else if (offset <= -45) {
          // D-45~D-89: 70% 완료, 30% 진행중
          const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
          if (Math.random() < 0.7) {
            b.update(d.ref, {
              status: "completed",
              completedDate: Timestamp.fromDate(new Date(Date.now() - Math.random() * 14 * 86400000)),
              assignee: rep,
            });
          } else {
            b.update(d.ref, { status: "in_progress", assignee: rep });
          }
        } else if (offset <= -14) {
          // D-14~D-44: 30% 진행중
          if (Math.random() < 0.3) {
            const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
            b.update(d.ref, { status: "in_progress", assignee: rep });
          }
        }
      });
      await b.commit();
    }
  }

  // proj1: 초기 단계 — D-180 이전만 일부 진행중
  const q1 = query(collection(db, "launchChecklists"), where("projectId", "==", "proj1"));
  const snap1 = await getDocs(q1);
  if (!snap1.empty) {
    for (let i = 0; i < snap1.docs.length; i += 450) {
      const b = writeBatch(db);
      snap1.docs.slice(i, i + 450).forEach(d => {
        const data = d.data();
        if (data.dDayOffset <= -180 && Math.random() < 0.4) {
          const rep = salesReps[Math.floor(Math.random() * salesReps.length)];
          b.update(d.ref, { status: "in_progress", assignee: rep });
        }
      });
      await b.commit();
    }
  }

  console.log("✅ 출시 준비 체크리스트 상태 시드 완료");
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserByName(name) {
  const q = query(collection(db, "users"), where("name", "==", name));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToUser(snap.docs[0].id, snap.docs[0].data());
}

export async function getUserByEmail(email) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToUser(snap.docs[0].id, snap.docs[0].data());
}

export async function getUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => docToUser(d.id, d.data()));
}

export async function createUser(user) {
  const ref = await addDoc(collection(db, "users"), user);
  return { ...user, id: ref.id };
}

export async function updateUser(id, data) {
  await updateDoc(doc(db, "users", id), data);
}

// ─── Projects ───────────────────────────────────────────────────────────────

export function subscribeProjects(callback) {
  return onSnapshot(collection(db, "projects"), (snap) => {
    const projects = snap.docs.map(d => docToProject(d.id, d.data()));
    projects.sort((a, b) => a.id.localeCompare(b.id));
    callback(projects);
  });
}

export async function getProject(id) {
  const snap = await getDoc(doc(db, "projects", id));
  if (!snap.exists()) return null;
  return docToProject(snap.id, snap.data());
}

export async function createProject(data) {
  const ref = await addDoc(collection(db, "projects"), {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
  });
  return ref.id;
}

export async function updateProject(id, data) {
  const payload = { ...data };
  if (data.startDate) payload.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate) payload.endDate = Timestamp.fromDate(data.endDate);
  await updateDoc(doc(db, "projects", id), payload);
}

// Phase 일정 일괄 업데이트 (프로젝트 phaseSchedules + 개별 task dueDate 동시)
export async function batchUpdatePhaseSchedule(projectId, phaseKey, scheduleData, taskUpdates) {
  const batch = writeBatch(db);
  // 1. 프로젝트 phaseSchedules 업데이트
  const projRef = doc(db, "projects", projectId);
  const updatePayload = {};
  if (scheduleData.plannedStart) updatePayload[`phaseSchedules.${phaseKey}.plannedStart`] = Timestamp.fromDate(scheduleData.plannedStart);
  if (scheduleData.plannedEnd) updatePayload[`phaseSchedules.${phaseKey}.plannedEnd`] = Timestamp.fromDate(scheduleData.plannedEnd);
  if (scheduleData.actualStart) updatePayload[`phaseSchedules.${phaseKey}.actualStart`] = Timestamp.fromDate(scheduleData.actualStart);
  if (scheduleData.actualEnd) updatePayload[`phaseSchedules.${phaseKey}.actualEnd`] = Timestamp.fromDate(scheduleData.actualEnd);
  batch.update(projRef, updatePayload);
  // 2. 개별 task dueDate 업데이트
  for (const { id, dueDate } of taskUpdates) {
    batch.update(doc(db, "checklistItems", id), { dueDate: Timestamp.fromDate(dueDate) });
  }
  await batch.commit();
}

// 여러 Phase 일정 일괄 업데이트 (cascade 포함)
export async function batchUpdateMultiPhaseSchedule(projectId, phaseUpdates) {
  const batch = writeBatch(db);
  const projRef = doc(db, "projects", projectId);
  const projPayload = {};
  for (const pu of phaseUpdates) {
    const key = pu.phaseKey;
    if (pu.plannedStart) projPayload[`phaseSchedules.${key}.plannedStart`] = Timestamp.fromDate(pu.plannedStart);
    if (pu.plannedEnd) projPayload[`phaseSchedules.${key}.plannedEnd`] = Timestamp.fromDate(pu.plannedEnd);
    if (pu.actualStart) projPayload[`phaseSchedules.${key}.actualStart`] = Timestamp.fromDate(pu.actualStart);
    if (pu.actualEnd) projPayload[`phaseSchedules.${key}.actualEnd`] = Timestamp.fromDate(pu.actualEnd);
    for (const { id, dueDate } of (pu.taskUpdates || [])) {
      batch.update(doc(db, "checklistItems", id), { dueDate: Timestamp.fromDate(dueDate) });
    }
  }
  if (Object.keys(projPayload).length > 0) batch.update(projRef, projPayload);
  await batch.commit();
}

// ─── Checklist Items ────────────────────────────────────────────────────────

export function subscribeChecklistItems(projectId, callback) {
  const q = query(collection(db, "checklistItems"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => docToChecklistItem(d.id, d.data())));
  });
}

export function subscribeAllChecklistItems(callback) {
  return onSnapshot(collection(db, "checklistItems"), (snap) => {
    callback(snap.docs.map(d => docToChecklistItem(d.id, d.data())));
  });
}

export function subscribeChecklistItemsByAssignee(assigneeName, callback) {
  const q = query(collection(db, "checklistItems"), where("assignee", "==", assigneeName));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => docToChecklistItem(d.id, d.data())));
  });
}

export async function getChecklistItem(id) {
  const snap = await getDoc(doc(db, "checklistItems", id));
  if (!snap.exists()) return null;
  return docToChecklistItem(snap.id, snap.data());
}

export async function updateChecklistItem(id, data) {
  const payload = { ...data };
  if (data.dueDate) payload.dueDate = Timestamp.fromDate(data.dueDate);
  if (data.completedDate) payload.completedDate = Timestamp.fromDate(data.completedDate);
  await updateDoc(doc(db, "checklistItems", id), payload);
}

export async function deleteChecklistItem(id) {
  await deleteDoc(doc(db, "checklistItems", id));
}

export async function updateChecklistItemStatus(itemId, newStatus) {
  const payload = { status: newStatus, updatedAt: serverTimestamp() };
  if (newStatus === "completed") {
    payload.completedDate = serverTimestamp();
  }
  await updateDoc(doc(db, "checklistItems", itemId), payload);
}

export async function createChecklistItem(data) {
  const payload = {
    ...data,
    status: data.status || "pending",
    comments: [],
    completedDate: null,
    createdAt: Timestamp.now(),
  };
  if (data.dueDate instanceof Date) payload.dueDate = Timestamp.fromDate(data.dueDate);
  const ref = await addDoc(collection(db, "checklistItems"), payload);
  return ref.id;
}

export async function completeTask(taskId) {
  try {
    await updateDoc(doc(db, "checklistItems", taskId), {
      status: "completed",
      completedDate: Timestamp.now(),
    });
  } catch (e) {
    throw new Error("작업 완료 처리에 실패했습니다: " + e.message);
  }
  // 프로젝트 통계 재계산 + 활동 로그 + 의존 작업 알림
  try {
    const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
    if (taskSnap.exists()) {
      const t = taskSnap.data();
      // Project-level activity log (project detail page에서 표시됨)
      if (t.projectId) {
        try { await addActivityLog("complete_task", "", t.assignee || "", "", "project", t.projectId, { taskTitle: t.title, department: t.department, taskId }); } catch { /* ignore */ }
        await recalculateProjectStats(t.projectId);

        // 의존 작업 알림: 이 작업을 선행으로 가진 다른 작업 찾기
        try {
          const allSnap = await getDocs(query(collection(db, "checklistItems"), where("projectId", "==", t.projectId)));
          const allTasks = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          for (const dependent of allTasks) {
            if (!dependent.dependencies || !dependent.dependencies.includes(taskId)) continue;
            // 모든 선행 작업이 완료인지 확인
            const allDepsComplete = dependent.dependencies.every(depId => {
              const dep = allTasks.find(dt => dt.id === depId);
              return dep && dep.status === "completed";
            });
            if (allDepsComplete && dependent.assignee) {
              // Find userId by assignee name
              const usersSnap = await getDocs(query(collection(db, "users"), where("name", "==", dependent.assignee)));
              const targetUserId = usersSnap.empty ? dependent.assignee : usersSnap.docs[0].id;
              await createNotification({
                userId: targetUserId,
                type: "dependency_resolved",
                title: "선행 작업 모두 완료",
                message: `"${dependent.title}"의 선행 작업이 모두 완료되었습니다. 작업을 시작할 수 있습니다.`,
                link: `task.html?projectId=${t.projectId}&taskId=${dependent.id}`,
                read: false,
                createdAt: new Date(),
              });
            }
          }
        } catch(e) { console.error("의존 작업 알림 실패:", e); }
      }
    }
  } catch (e) { console.error("통계 재계산 실패:", e); }
}

// 승인 절차 제거됨 — 하위 호환용 stub
export async function approveTask(_taskId, _reviewerName) {
  console.warn("approveTask is deprecated — approval workflow removed");
}

export async function rejectTask(_taskId, _reviewerName, _reason) {
  console.warn("rejectTask is deprecated — approval workflow removed");
}

export async function restartTask(taskId) {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "in_progress",
  });
  if (taskSnap.exists()) {
    const t = taskSnap.data();
    if (t.projectId) {
      try { await addActivityLog("restart_task", "", t.assignee || "", "", "project", t.projectId, { taskTitle: t.title, department: t.department, taskId }); } catch { /* ignore */ }
      await recalculateProjectStats(t.projectId);
    }
  }
}

// ─── Project Stats Auto-Calculation ──────────────────────────────────────────

export async function recalculateProjectStats(projectId) {
  const q = query(collection(db, "checklistItems"), where("projectId", "==", projectId));
  const snap = await getDocs(q);
  const tasks = snap.docs.map(d => d.data());
  if (tasks.length === 0) return;

  // Progress: completed %
  const completedCount = tasks.filter(t => t.status === "completed").length;
  const progress = Math.round((completedCount / tasks.length) * 100);

  // Risk level: overdue ratio
  const now = new Date();
  const overdue = tasks.filter(
    t => t.status !== "completed" && toDate(t.dueDate) < now
  ).length;
  const overdueRatio = overdue / tasks.length;
  const riskLevel = overdueRatio > 0.3 ? "red" : overdueRatio > 0.1 ? "yellow" : "green";

  // Current stage
  const stageOrder = [
    "발의검토", "발의승인", "기획검토", "기획승인",
    "WM제작", "WM승인회", "Tx단계", "Tx승인회",
    "MasterGatePilot", "MSG승인회", "양산", "영업이관",
  ];
  let currentStage = stageOrder[0];
  for (const stage of stageOrder) {
    const stageTasks = tasks.filter(t => t.stage === stage);
    if (stageTasks.length > 0) {
      const allDone = stageTasks.every(t => t.status === "completed");
      if (!allDone) { currentStage = stage; break; }
      currentStage = stage;
    }
  }

  await updateDoc(doc(db, "projects", projectId), { progress, riskLevel, currentStage });
}

// ─── Portal Notification Helper (internal) ──────────────────────────────────

async function _createPortalNotificationsForProject(projectId, type, title, message) {
  try {
    // 해당 프로젝트와 연결된 고객 찾기
    const custSnap = await getDocs(collection(db, "customers"));
    const customers = custSnap.docs.filter(d => {
      const data = d.data();
      return data.portalEnabled && (data.products || []).includes(projectId);
    });
    for (const c of customers) {
      await addDoc(collection(db, "portalNotifications"), {
        customerId: c.id,
        projectId,
        type,
        title,
        message,
        read: false,
        createdAt: Timestamp.now(),
      });
    }
  } catch (e) { console.error("포털 알림 생성 실패:", e); }
}

export async function addComment(taskId, userId, userName, content) {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (!taskSnap.exists()) return;
  const existing = taskSnap.data().comments || [];
  const newComment = {
    id: `comment-${Date.now()}`,
    userId, userName, content,
    createdAt: Timestamp.fromDate(new Date()),
  };
  await updateDoc(doc(db, "checklistItems", taskId), {
    comments: [...existing, newComment],
  });
  try { await addActivityLog("add_comment", userId, userName, "", "task", taskId, { content: content.substring(0, 100) }); } catch { /* ignore */ }

  // @mention 알림 생성
  try {
    const mentionRegex = /@([\uAC00-\uD7A3a-zA-Z]{2,10})/g;
    let match;
    const mentioned = new Set();
    while ((match = mentionRegex.exec(content)) !== null) mentioned.add(match[1]);
    if (mentioned.size > 0) {
      const t = taskSnap.data();
      for (const name of mentioned) {
        if (name === userName) continue; // 자기 자신 제외
        const uQ = query(collection(db, "users"), where("name", "==", name));
        const uSnap = await getDocs(uQ);
        if (!uSnap.empty) {
          await addDoc(collection(db, "notifications"), {
            userId: uSnap.docs[0].id,
            type: "mention",
            title: "멘션 알림",
            message: `${userName}님이 코멘트에서 회원님을 언급했습니다: "${content.substring(0, 60)}..."`,
            link: `task.html?projectId=${t.projectId}&taskId=${taskId}`,
            read: false,
            createdAt: Timestamp.now(),
          });
        }
      }
    }
  } catch (e) { console.error("멘션 알림 생성 실패:", e); }
}

// ─── Notifications ──────────────────────────────────────────────────────────

export function subscribeNotifications(userId, callback, onError) {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs
      .map(d => docToNotification(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(notifs);
  }, onError || ((err) => console.error("Notification subscription error:", err)));
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(userId) {
  const q = query(collection(db, "notifications"), where("userId", "==", userId), where("read", "==", false));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ─── Fallback getDocs loaders (for when onSnapshot fails) ─────────────────

export async function fallbackLoadProjects() {
  const snap = await getDocs(collection(db, "projects"));
  const projects = snap.docs.map(d => docToProject(d.id, d.data()));
  projects.sort((a, b) => a.id.localeCompare(b.id));
  return projects;
}

export async function fallbackLoadAllChecklistItems() {
  const snap = await getDocs(collection(db, "checklistItems"));
  return snap.docs.map(d => docToChecklistItem(d.id, d.data()));
}

export async function fallbackLoadChecklistItemsByAssignee(assigneeName) {
  const q = query(collection(db, "checklistItems"), where("assignee", "==", assigneeName));
  const snap = await getDocs(q);
  return snap.docs.map(d => docToChecklistItem(d.id, d.data()));
}

export async function fallbackLoadNotifications(userId) {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => docToNotification(d.id, d.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ─── Dashboard Targeted Queries (fast: loads only needed subset) ──────────
// Instead of loading all ~1,800 checklistItems, these load only what the
// dashboard actually displays: active tasks + pending approvals (~200-300 docs).

export async function loadDashboardActiveTasks(department = null) {
  const q = query(
    collection(db, "checklistItems"),
    where("status", "in", ["pending", "in_progress"])
  );
  const snap = await getDocs(q);
  let tasks = snap.docs.map(d => docToChecklistItem(d.id, d.data()));
  if (department) tasks = tasks.filter(t => t.department === department);
  return tasks;
}

// 개별 작업 승인 제거됨 — 항상 빈 배열 반환
export async function loadDashboardPendingApprovals(_department = null) {
  return [];
}

export async function createNotification(data) {
  await addDoc(collection(db, "notifications"), {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
  });
}

// ─── Email Queue (Firebase Trigger Email Extension) ─────────────────────────
// mail 컬렉션에 문서를 추가하면 Firebase "Trigger Email from Firestore" 확장이
// 자동으로 SMTP를 통해 이메일을 발송합니다.
// 확장 설치: Firebase Console → Extensions → "Trigger Email from Firestore"

export async function queueEmail({ to, subject, html, text }) {
  if (!to) return;
  const toList = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (toList.length === 0) return;
  await addDoc(collection(db, "mail"), {
    to: toList,
    message: {
      subject: subject || "(ProcessCheck 알림)",
      html: html || "",
      text: text || "",
    },
    createdAt: Timestamp.now(),
  });
}

// ─── Template Stages & Departments ──────────────────────────────────────────

export async function getTemplateStages() {
  const snap = await getDocs(collection(db, "templateStages"));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .sort((a, b) => a.order - b.order);
}

export async function getTemplateDepartments() {
  const snap = await getDocs(collection(db, "templateDepartments"));
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .sort((a, b) => a.order - b.order);
}

// ─── Template Items ─────────────────────────────────────────────────────────

export function subscribeAllTemplateItems(callback) {
  return onSnapshot(collection(db, "templateItems"), (snap) => {
    const items = snap.docs
      .map(d => ({
        ...d.data(), id: d.id,
        createdAt: toDate(d.data().createdAt),
        lastModifiedAt: toDate(d.data().lastModifiedAt),
      }))
      .sort((a, b) => a.order - b.order);
    callback(items);
  });
}

export function subscribeTemplateItems(stageId, departmentId, callback) {
  const q = query(
    collection(db, "templateItems"),
    where("stageId", "==", stageId),
    where("departmentId", "==", departmentId)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({
        ...d.data(), id: d.id,
        createdAt: toDate(d.data().createdAt),
        lastModifiedAt: toDate(d.data().lastModifiedAt),
      }))
      .sort((a, b) => a.order - b.order);
    callback(items);
  });
}

export async function addTemplateItem(data) {
  const ref = await addDoc(collection(db, "templateItems"), {
    ...data,
    createdAt: Timestamp.now(),
    lastModifiedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateTemplateItem(id, data) {
  await updateDoc(doc(db, "templateItems", id), {
    ...data,
    lastModifiedAt: Timestamp.now(),
  });
}

export async function deleteTemplateItem(id) {
  await deleteDoc(doc(db, "templateItems", id));
}

export async function reorderTemplateItems(items) {
  const batch = writeBatch(db);
  for (const item of items) {
    batch.update(doc(db, "templateItems", item.id), {
      order: item.order,
      lastModifiedAt: Timestamp.now(),
    });
  }
  await batch.commit();
}

// ─── Template Item Sub-Checklist ────────────────────────────────────────────

export function subscribeTemplateSubChecklist(itemId, callback) {
  const q = query(
    collection(db, "templateItems", itemId, "subChecklist"),
    orderBy("order", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id })));
  });
}

export async function addTemplateSubChecklistItem(itemId, data) {
  const snap = await getDocs(collection(db, "templateItems", itemId, "subChecklist"));
  const maxOrder = snap.docs.reduce((max, d) => Math.max(max, d.data().order ?? 0), -1);
  const ref = await addDoc(collection(db, "templateItems", itemId, "subChecklist"), {
    content: data.content,
    order: maxOrder + 1,
    createdBy: data.createdBy,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateTemplateSubChecklistItem(itemId, subId, data) {
  await updateDoc(doc(db, "templateItems", itemId, "subChecklist", subId), data);
}

export async function deleteTemplateSubChecklistItem(itemId, subId) {
  await deleteDoc(doc(db, "templateItems", itemId, "subChecklist", subId));
}

export async function reorderTemplateSubChecklist(itemId, items) {
  const batch = writeBatch(db);
  for (const item of items) {
    batch.update(doc(db, "templateItems", itemId, "subChecklist", item.id), { order: item.order });
  }
  await batch.commit();
}

export async function addTemplateStage(data) {
  // data: { name, workStageName, gateStageName, createdBy }
  const stagesSnap = await getDocs(collection(db, "templateStages"));
  // 중복 이름 체크
  const exists = stagesSnap.docs.some(d => d.data().name === data.name);
  if (exists) {
    throw new Error(`이미 존재하는 단계입니다: "${data.name}"`);
  }
  const maxOrder = stagesSnap.docs.reduce((max, d) => Math.max(max, d.data().order ?? 0), -1);
  const ref = await addDoc(collection(db, "templateStages"), {
    name: data.name,
    workStageName: data.workStageName,
    gateStageName: data.gateStageName,
    createdBy: data.createdBy,
    order: maxOrder + 1,
    createdAt: Timestamp.now(),
    lastModifiedBy: data.createdBy,
    lastModifiedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function deleteTemplateStage(stageId) {
  const q = query(collection(db, "templateItems"), where("stageId", "==", stageId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, "templateStages", stageId));
  await batch.commit();
}

export async function updateTemplateStage(stageId, data) {
  await updateDoc(doc(db, "templateStages", stageId), data);
}

export async function updateTemplateDepartment(deptId, data) {
  await updateDoc(doc(db, "templateDepartments", deptId), data);
}

export async function addTemplateDepartment(data) {
  const deptsSnap = await getDocs(collection(db, "templateDepartments"));
  // 중복 이름 체크
  const exists = deptsSnap.docs.some(d => d.data().name === data.name);
  if (exists) {
    throw new Error(`이미 존재하는 부서입니다: "${data.name}"`);
  }
  const maxOrder = deptsSnap.docs.reduce((max, d) => Math.max(max, d.data().order ?? 0), -1);
  const ref = await addDoc(collection(db, "templateDepartments"), {
    ...data,
    order: maxOrder + 1,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function deleteTemplateDepartment(deptId) {
  const q = query(collection(db, "templateItems"), where("departmentId", "==", deptId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, "templateDepartments", deptId));
  await batch.commit();
}

// ─── Apply Template to Project ───────────────────────────────────────────────

/**
 * 템플릿 항목을 실제 프로젝트 체크리스트로 변환하여 생성한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} projectType - "신규개발"
 * @returns {Promise<number>} 생성된 체크리스트 항목 수
 */
export async function applyTemplateToProject(projectId, _projectType) {
  // 0) 중복 방지: 이미 적용된 templateItemId 수집
  const existingSnap = await getDocs(
    query(collection(db, "checklistItems"), where("projectId", "==", projectId))
  );
  const existingTemplateIds = new Set(
    existingSnap.docs.map(d => d.data().templateItemId).filter(Boolean)
  );

  // 1) 템플릿 stages, departments, items 로드
  const stages = await getTemplateStages();
  const depts = await getTemplateDepartments();
  const allItemsSnap = await getDocs(collection(db, "templateItems"));
  const allItems = allItemsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  // 2) 전체 항목 사용
  let filteredItems = allItems;

  // 2.5) 이미 적용된 템플릿 항목 제외
  filteredItems = filteredItems.filter(ti => !existingTemplateIds.has(ti.id));
  if (filteredItems.length === 0) {
    console.warn(`⚠️ 프로젝트 ${projectId}: 새로 적용할 템플릿 항목 없음`);
    return 0;
  }

  // 3) stage/dept lookup maps
  const stageMap = {};
  for (const s of stages) {
    stageMap[s.id] = s;
  }
  const deptMap = {};
  for (const d of depts) {
    deptMap[d.id] = d;
  }

  // 4) 체크리스트 항목 변환
  const today = new Date();
  const checklistItems = filteredItems.map((ti, _idx) => {
    const stage = stageMap[ti.stageId];
    const dept = deptMap[ti.departmentId];
    if (!stage || !dept) return null;

    return {
      projectId,
      stage: stage.workStageName, // templateItem은 work stage 기준으로 생성
      department: dept.name,
      title: ti.content,
      description: "",
      assignee: "",
      reviewer: "",
      status: "pending",
      dueDate: Timestamp.fromDate(new Date(today.getTime() + 30 * 86400000)),
      completedDate: null,
      files: [],
      comments: [],
      dependencies: [],
      isRequired: ti.isRequired,
      templateItemId: ti.id,
    };
  }).filter(Boolean);

  // 5) Firestore batch write (500개 제한 고려)
  const BATCH_LIMIT = 450;
  for (let i = 0; i < checklistItems.length; i += BATCH_LIMIT) {
    const batchItems = checklistItems.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const item of batchItems) {
      const ref = doc(collection(db, "checklistItems"));
      batch.set(ref, item);
    }
    await batch.commit();
  }

  console.log(`✅ 프로젝트 ${projectId}에 ${checklistItems.length}개 체크리스트 생성 완료`);
  return checklistItems.length;
}

// ─── Customers (대리점/법인) ────────────────────────────────────────────────

export function subscribeCustomers(callback) {
  return onSnapshot(collection(db, "customers"), (snap) => {
    const customers = snap.docs.map(d => docToCustomer(d.id, d.data()));
    customers.sort((a, b) => a.name.localeCompare(b.name));
    callback(customers);
  });
}

export async function getCustomer(id) {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  return docToCustomer(snap.id, snap.data());
}

export async function createCustomer(data) {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, "customers"), {
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateCustomer(id, data) {
  await updateDoc(doc(db, "customers", id), {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteCustomer(id) {
  await deleteDoc(doc(db, "customers", id));
}

// ─── Launch Checklists (출시 준비) ─────────────────────────────────────────

export function subscribeLaunchChecklists(projectId, callback) {
  const q = query(collection(db, "launchChecklists"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => docToLaunchChecklist(d.id, d.data()));
    items.sort((a, b) => a.dDayOffset - b.dDayOffset);
    callback(items);
  });
}

export function subscribeAllLaunchChecklists(callback) {
  return onSnapshot(collection(db, "launchChecklists"), (snap) => {
    const items = snap.docs.map(d => docToLaunchChecklist(d.id, d.data()));
    items.sort((a, b) => a.dDayOffset - b.dDayOffset);
    callback(items);
  });
}

export async function updateLaunchChecklist(id, data) {
  const payload = { ...data };
  if (data.dueDate) payload.dueDate = Timestamp.fromDate(data.dueDate);
  if (data.completedDate) payload.completedDate = Timestamp.fromDate(data.completedDate);
  await updateDoc(doc(db, "launchChecklists", id), payload);
}

export async function completeLaunchChecklist(id) {
  await updateDoc(doc(db, "launchChecklists", id), {
    status: "completed",
    completedDate: Timestamp.now(),
  });
}

export async function confirmLaunchChecklist(id, checkedBy, note = "") {
  await updateDoc(doc(db, "launchChecklists", id), {
    checkedBy,
    checkedAt: Timestamp.now(),
    checkedNote: note,
  });
}

/**
 * 프로젝트의 출시 준비 체크리스트를 생성한다 (177개 기본 항목).
 * 거래처별 항목은 customers 배열 [{id, name}]로 곱해진다.
 */
export async function applyLaunchChecklistToProject(projectId, projectType, endDate, customers = []) {
  const LAUNCH_ITEMS = getLaunchTemplateItems();

  // design_change 카테고리 제외
  const filtered = LAUNCH_ITEMS.filter(item => item.category !== "design_change");

  // Normalize customers: accept [{id, name}] or [id] (backward compat)
  const custList = customers.map(c => typeof c === "string" ? { id: c, name: "" } : c);

  const baseDate = endDate instanceof Date ? endDate : new Date(endDate);
  const items = [];

  for (const tmpl of filtered) {
    if (tmpl.perCustomer && custList.length > 0) {
      // 거래처별 항목: 각 고객마다 하나씩 생성
      for (const cust of custList) {
        items.push({
          projectId,
          category: tmpl.category,
          code: tmpl.code,
          title: tmpl.title,
          department: tmpl.department,
          dDayOffset: tmpl.dDayOffset,
          durationDays: tmpl.durationDays,
          isRequired: tmpl.isRequired,
          status: "pending",
          assignee: "",
          dueDate: Timestamp.fromDate(new Date(baseDate.getTime() + tmpl.dDayOffset * 86400000)),
          completedDate: null,
          customerId: cust.id,
          customerName: cust.name,
          checkedBy: null,
          checkedAt: null,
          checkedNote: "",
        });
      }
    } else {
      items.push({
        projectId,
        category: tmpl.category,
        code: tmpl.code,
        title: tmpl.title,
        department: tmpl.department,
        dDayOffset: tmpl.dDayOffset,
        durationDays: tmpl.durationDays,
        isRequired: tmpl.isRequired,
        status: "pending",
        assignee: "",
        dueDate: Timestamp.fromDate(new Date(baseDate.getTime() + tmpl.dDayOffset * 86400000)),
        completedDate: null,
        checkedBy: null,
        checkedAt: null,
        checkedNote: "",
      });
    }
  }

  // Batch write
  const BATCH_LIMIT = 450;
  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    items.slice(i, i + BATCH_LIMIT).forEach(item => {
      batch.set(doc(collection(db, "launchChecklists")), item);
    });
    await batch.commit();
  }

  console.log(`✅ 프로젝트 ${projectId}에 ${items.length}개 출시 준비 체크리스트 생성`);
  return items.length;
}

/**
 * D-Day 재계산: 프로젝트 endDate 변경 시 모든 launchChecklist의 dueDate 업데이트
 */
export async function recalculateLaunchDueDates(projectId, newEndDate) {
  const baseDate = newEndDate instanceof Date ? newEndDate : new Date(newEndDate);
  const q = query(collection(db, "launchChecklists"), where("projectId", "==", projectId));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const BATCH_LIMIT = 450;
  let updated = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_LIMIT).forEach(d => {
      const data = d.data();
      if (data.status !== "completed") {
        batch.update(d.ref, {
          dueDate: Timestamp.fromDate(new Date(baseDate.getTime() + data.dDayOffset * 86400000)),
        });
        updated++;
      }
    });
    await batch.commit();
  }
  return updated;
}

// ─── Portal Notifications (고객 포털 알림) ──────────────────────────────────

export function subscribePortalNotifications(customerId, callback) {
  const q = query(collection(db, "portalNotifications"), where("customerId", "==", customerId));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs
      .map(d => docToPortalNotification(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(notifs);
  });
}

export async function createPortalNotification(data) {
  await addDoc(collection(db, "portalNotifications"), {
    ...data,
    read: false,
    createdAt: Timestamp.now(),
  });
}

export async function markPortalNotificationRead(id) {
  await updateDoc(doc(db, "portalNotifications", id), { read: true });
}

// ─── Launch Template Items (177개) ─────────────────────────────────────────

function getLaunchTemplateItems() {
  return [
    // Pre-A: 브랜드/포지셔닝 (8)
    { code: "P-01", category: "brand", title: "제품 브랜드명 확정 (상표 검색 포함)", department: "마케팅+법무", dDayOffset: -240, durationDays: 14, isRequired: true },
    { code: "P-02", category: "brand", title: "제품 로고 디자인 개발 (2~3안)", department: "디자인+마케팅", dDayOffset: -220, durationDays: 10, isRequired: true },
    { code: "P-03", category: "brand", title: "브랜드 가이드라인 문서 작성", department: "디자인+마케팅", dDayOffset: -210, durationDays: 7, isRequired: true },
    { code: "P-04", category: "brand", title: "제품 포지셔닝 전략서 작성 (타깃 시장/USP/메시지)", department: "마케팅+영업", dDayOffset: -200, durationDays: 10, isRequired: true },
    { code: "P-05", category: "brand", title: "바이어 페르소나 정의", department: "마케팅+영업", dDayOffset: -200, durationDays: 5, isRequired: true },
    { code: "P-06", category: "brand", title: "경쟁사 분석 보고서", department: "마케팅+영업", dDayOffset: -190, durationDays: 10, isRequired: true },
    { code: "P-07", category: "brand", title: "핵심 마케팅 메시지 확정 (슬로건/태그라인)", department: "마케팅", dDayOffset: -180, durationDays: 7, isRequired: true },
    { code: "P-08", category: "brand", title: "브랜드 템플릿 라이브러리 구축", department: "디자인+마케팅", dDayOffset: -170, durationDays: 7, isRequired: false },
    // A: 사진/영상 (15)
    { code: "A-01", category: "photo", title: "제품 외관 사진 촬영 기획안 작성", department: "마케팅", dDayOffset: -180, durationDays: 3, isRequired: true },
    { code: "A-02", category: "photo", title: "제품 스튜디오 사진 촬영", department: "마케팅", dDayOffset: -170, durationDays: 2, isRequired: true },
    { code: "A-03", category: "photo", title: "제품 사용 장면 사진 촬영 (모델+병원 환경)", department: "마케팅", dDayOffset: -160, durationDays: 3, isRequired: true },
    { code: "A-04", category: "photo", title: "사진 보정 및 리사이즈 (웹/인쇄/SNS)", department: "마케팅", dDayOffset: -155, durationDays: 5, isRequired: true },
    { code: "A-05", category: "photo", title: "제품 소개 영상 촬영 기획안 (콘티/스크립트)", department: "마케팅", dDayOffset: -150, durationDays: 5, isRequired: true },
    { code: "A-06", category: "photo", title: "제품 소개 영상 촬영 (1~3분)", department: "마케팅", dDayOffset: -140, durationDays: 3, isRequired: true },
    { code: "A-07", category: "photo", title: "제품 사용법 교육 영상 촬영", department: "마케팅+CS", dDayOffset: -135, durationDays: 3, isRequired: true },
    { code: "A-08", category: "photo", title: "영상 편집 및 자막/더빙 작업", department: "마케팅", dDayOffset: -130, durationDays: 7, isRequired: true },
    { code: "A-09", category: "photo", title: "3D 렌더링 제작 (포토리얼리스틱)", department: "디자인", dDayOffset: -160, durationDays: 14, isRequired: false },
    { code: "A-10", category: "photo", title: "MOA(기전) 애니메이션 제작", department: "디자인+개발", dDayOffset: -150, durationDays: 14, isRequired: false },
    { code: "A-11", category: "photo", title: "조립/분해 시퀀스 애니메이션", department: "디자인+CS", dDayOffset: -140, durationDays: 10, isRequired: false },
    { code: "A-12", category: "photo", title: "의료진 인터뷰 영상 촬영", department: "마케팅+임상", dDayOffset: -120, durationDays: 5, isRequired: false },
    { code: "A-13", category: "photo", title: "해외 시장용 영상 현지화", department: "마케팅", dDayOffset: -110, durationDays: 10, isRequired: false },
    { code: "A-14", category: "photo", title: "인터랙티브 제품 데모 제작", department: "마케팅+개발", dDayOffset: -120, durationDays: 21, isRequired: false },
    { code: "A-15", category: "photo", title: "사진/영상 자산 최종 검수 및 아카이빙", department: "마케팅", dDayOffset: -100, durationDays: 2, isRequired: true },
    // B: 인쇄물/문서 (18)
    { code: "B-01", category: "print", title: "제품 카탈로그 원고 작성", department: "마케팅+개발", dDayOffset: -150, durationDays: 7, isRequired: true },
    { code: "B-02", category: "print", title: "카탈로그 디자인 시안 제작 (2~3안)", department: "디자인+마케팅", dDayOffset: -140, durationDays: 7, isRequired: true },
    { code: "B-03", category: "print", title: "카탈로그 내부 검토 및 수정", department: "마케팅+품질", dDayOffset: -130, durationDays: 5, isRequired: true },
    { code: "B-04", category: "print", title: "카탈로그 인쇄 발주 (리드타임 2~3주)", department: "마케팅", dDayOffset: -120, durationDays: 21, isRequired: true },
    { code: "B-05", category: "print", title: "기술 데이터 시트 작성", department: "개발+마케팅", dDayOffset: -140, durationDays: 5, isRequired: true },
    { code: "B-06", category: "print", title: "기술 데이터 시트 규격 검증", department: "품질+개발", dDayOffset: -130, durationDays: 3, isRequired: true },
    { code: "B-07", category: "print", title: "임상 백서 초안 작성", department: "임상+마케팅", dDayOffset: -130, durationDays: 14, isRequired: false },
    { code: "B-08", category: "print", title: "임상 백서 내부 검토", department: "임상", dDayOffset: -110, durationDays: 7, isRequired: false },
    { code: "B-09", category: "print", title: "영업 교육 자료 작성 (PPT+스크립트)", department: "영업+마케팅", dDayOffset: -100, durationDays: 7, isRequired: true },
    { code: "B-10", category: "print", title: "영업 교육 자료 — 경쟁사 비교표", department: "영업+마케팅", dDayOffset: -90, durationDays: 3, isRequired: true },
    { code: "B-11", category: "print", title: "FAQ 문서 작성 (예상 질문 50개+)", department: "영업+CS+개발", dDayOffset: -90, durationDays: 7, isRequired: true },
    { code: "B-12", category: "print", title: "병원 내부품의서 양식 작성", department: "영업", dDayOffset: -80, durationDays: 5, isRequired: true },
    { code: "B-13", category: "print", title: "제품 비교 분석표 작성", department: "영업+마케팅", dDayOffset: -80, durationDays: 5, isRequired: true },
    { code: "B-14", category: "print", title: "TCO 산출표 작성 (병원 제출용)", department: "CS+영업", dDayOffset: -70, durationDays: 5, isRequired: false },
    { code: "B-15", category: "print", title: "학술 포스터/논문 초록 준비", department: "임상+마케팅", dDayOffset: -90, durationDays: 14, isRequired: false },
    { code: "B-16", category: "print", title: "해외 시장용 카탈로그 번역", department: "마케팅", dDayOffset: -100, durationDays: 14, isRequired: false },
    { code: "B-17", category: "print", title: "납품 제안서 표준 템플릿 작성", department: "영업", dDayOffset: -60, durationDays: 5, isRequired: true },
    { code: "B-18", category: "print", title: "인쇄물 최종 재고 확인 및 배포 계획", department: "마케팅", dDayOffset: -30, durationDays: 2, isRequired: true },
    // C: 디지털 콘텐츠 (14)
    { code: "C-01", category: "digital", title: "웹사이트 제품 페이지 기획 (SEO 포함)", department: "마케팅", dDayOffset: -90, durationDays: 5, isRequired: true },
    { code: "C-02", category: "digital", title: "웹사이트 제품 페이지 디자인/개발", department: "마케팅+개발", dDayOffset: -80, durationDays: 14, isRequired: true },
    { code: "C-03", category: "digital", title: "웹사이트 제품 페이지 QA 및 라이브", department: "마케팅", dDayOffset: -60, durationDays: 3, isRequired: true },
    { code: "C-04", category: "digital", title: "SNS 콘텐츠 기획 (티저+런칭)", department: "마케팅", dDayOffset: -60, durationDays: 5, isRequired: true },
    { code: "C-05", category: "digital", title: "SNS 콘텐츠 제작 (이미지+영상+카피)", department: "마케팅", dDayOffset: -50, durationDays: 10, isRequired: true },
    { code: "C-06", category: "digital", title: "SNS 런칭 캠페인 일정표 확정", department: "마케팅", dDayOffset: -40, durationDays: 2, isRequired: true },
    { code: "C-07", category: "digital", title: "이메일 캠페인 세그먼트 정의", department: "마케팅", dDayOffset: -50, durationDays: 3, isRequired: false },
    { code: "C-08", category: "digital", title: "이메일 캠페인 콘텐츠 및 A/B 테스트", department: "마케팅", dDayOffset: -40, durationDays: 7, isRequired: false },
    { code: "C-09", category: "digital", title: "온라인 광고 소재 제작", department: "마케팅", dDayOffset: -40, durationDays: 7, isRequired: false },
    { code: "C-10", category: "digital", title: "온라인 광고 매체 선정 및 예산 배분", department: "마케팅+경영", dDayOffset: -35, durationDays: 3, isRequired: false },
    { code: "C-11", category: "digital", title: "리드 수집용 랜딩 페이지 제작", department: "마케팅", dDayOffset: -45, durationDays: 7, isRequired: false },
    { code: "C-12", category: "digital", title: "블로그/뉴스레터 원고 작성", department: "마케팅", dDayOffset: -30, durationDays: 5, isRequired: false },
    { code: "C-13", category: "digital", title: "보도자료 작성 및 배포", department: "마케팅+경영", dDayOffset: -14, durationDays: 5, isRequired: false },
    { code: "C-14", category: "digital", title: "해외 디지털 콘텐츠 현지화", department: "마케팅", dDayOffset: -45, durationDays: 14, isRequired: false },
    // D: 가격/견적/계약 (16)
    { code: "D-01", category: "pricing", title: "원가 분석 및 목표 마진율 설정", department: "경영+영업", dDayOffset: -120, durationDays: 7, isRequired: true },
    { code: "D-02", category: "pricing", title: "국내 가격 전략 확정", department: "영업+경영", dDayOffset: -110, durationDays: 5, isRequired: true },
    { code: "D-03", category: "pricing", title: "해외 가격 전략 확정 (FOB/CIF)", department: "영업+경영", dDayOffset: -110, durationDays: 5, isRequired: true },
    { code: "D-04", category: "pricing", title: "표준 가격표 작성 (국내)", department: "영업", dDayOffset: -100, durationDays: 3, isRequired: true },
    { code: "D-05", category: "pricing", title: "해외 가격표 작성 (통화별)", department: "영업", dDayOffset: -100, durationDays: 3, isRequired: true },
    { code: "D-06", category: "pricing", title: "대리점 마진 구조 확정", department: "영업+경영", dDayOffset: -90, durationDays: 5, isRequired: true },
    { code: "D-07", category: "pricing", title: "거래처별 견적서 작성", department: "영업", dDayOffset: -60, durationDays: 1, isRequired: true, perCustomer: true },
    { code: "D-08", category: "pricing", title: "거래처별 공급 계약서 준비", department: "영업+법무", dDayOffset: -60, durationDays: 3, isRequired: true, perCustomer: true },
    { code: "D-09", category: "pricing", title: "거래처별 공급 계약 체결", department: "영업", dDayOffset: -30, durationDays: 7, isRequired: true, perCustomer: true },
    { code: "D-10", category: "pricing", title: "수출 계약서 준비 (해외 법인/파트너)", department: "영업+법무", dDayOffset: -60, durationDays: 7, isRequired: true, perCustomer: true },
    { code: "D-11", category: "pricing", title: "HIRA 급여 등재 신청", department: "인증+영업", dDayOffset: -90, durationDays: 60, isRequired: false },
    { code: "D-12", category: "pricing", title: "나라장터(조달청) 등록 준비", department: "영업", dDayOffset: -60, durationDays: 14, isRequired: false },
    { code: "D-13", category: "pricing", title: "할부/렌탈/리스 조건 확정", department: "영업+경영", dDayOffset: -45, durationDays: 7, isRequired: false },
    { code: "D-14", category: "pricing", title: "초도 물량 배분 계획 (거래처별)", department: "영업+제조", dDayOffset: -30, durationDays: 3, isRequired: true, perCustomer: true },
    { code: "D-15", category: "pricing", title: "첫 출하 스케줄 확정 (거래처별 납기)", department: "영업+제조", dDayOffset: -14, durationDays: 3, isRequired: true, perCustomer: true },
    { code: "D-16", category: "pricing", title: "거래처 서류 수집 (사업자등록증 등)", department: "영업", dDayOffset: -45, durationDays: 7, isRequired: true, perCustomer: true },
    // E: 영업 교육/역량 (14)
    { code: "E-01", category: "sales_training", title: "영업 교육 커리큘럼 수립", department: "영업+마케팅", dDayOffset: -90, durationDays: 5, isRequired: true },
    { code: "E-02", category: "sales_training", title: "제품 교육 세션 실시 (사내 영업팀)", department: "영업+개발", dDayOffset: -60, durationDays: 2, isRequired: true },
    { code: "E-03", category: "sales_training", title: "제품 교육 세션 실시 (대리점/딜러)", department: "영업", dDayOffset: -45, durationDays: 3, isRequired: true },
    { code: "E-04", category: "sales_training", title: "해외 법인/파트너 제품 교육", department: "영업", dDayOffset: -45, durationDays: 5, isRequired: true },
    { code: "E-05", category: "sales_training", title: "데모기 수량 확정 및 제조 요청", department: "영업+제조", dDayOffset: -60, durationDays: 1, isRequired: true },
    { code: "E-06", category: "sales_training", title: "데모기 제작 완료 확인", department: "제조", dDayOffset: -30, durationDays: 0, isRequired: true },
    { code: "E-07", category: "sales_training", title: "데모기 배포 (영업+주요 대리점)", department: "영업", dDayOffset: -21, durationDays: 5, isRequired: true },
    { code: "E-08", category: "sales_training", title: "영업 롤플레이 연습 (모의 상담)", department: "영업", dDayOffset: -30, durationDays: 2, isRequired: true },
    { code: "E-09", category: "sales_training", title: "파일럿 사이트 선정 (2~3개 병원)", department: "영업", dDayOffset: -90, durationDays: 7, isRequired: false },
    { code: "E-10", category: "sales_training", title: "파일럿 사이트 설치 및 피드백 수집", department: "영업+CS", dDayOffset: -60, durationDays: 30, isRequired: false },
    { code: "E-11", category: "sales_training", title: "파일럿 결과 정리 및 레퍼런스 확보", department: "영업+마케팅", dDayOffset: -30, durationDays: 5, isRequired: false },
    { code: "E-12", category: "sales_training", title: "KOL 섭외 및 관계 구축", department: "영업+임상", dDayOffset: -90, durationDays: 0, isRequired: false },
    { code: "E-13", category: "sales_training", title: "학회 전시 부스 예약 및 준비", department: "마케팅+영업", dDayOffset: -60, durationDays: 14, isRequired: false },
    { code: "E-14", category: "sales_training", title: "영업 목표 설정 (분기/연간 판매 계획)", department: "영업+경영", dDayOffset: -30, durationDays: 5, isRequired: true },
    // F: 거래처 통보/관리 (10)
    { code: "F-01", category: "dealer_notify", title: "거래처별 출시 사전 통보 (1차 — 제품 소개)", department: "영업", dDayOffset: -60, durationDays: 1, isRequired: true, perCustomer: true },
    { code: "F-02", category: "dealer_notify", title: "거래처별 출시 확정 통보 (2차 — 가격/납기)", department: "영업", dDayOffset: -30, durationDays: 1, isRequired: true, perCustomer: true },
    { code: "F-03", category: "dealer_notify", title: "거래처별 교육 일정 안내", department: "영업", dDayOffset: -45, durationDays: 1, isRequired: true, perCustomer: true },
    { code: "F-04", category: "dealer_notify", title: "주요 병원 구매부서 사전 미팅", department: "영업", dDayOffset: -45, durationDays: 0, isRequired: true, perCustomer: true },
    { code: "F-05", category: "dealer_notify", title: "병원 내부품의 지원 (견적+기술자료)", department: "영업", dDayOffset: -30, durationDays: 2, isRequired: true, perCustomer: true },
    { code: "F-06", category: "dealer_notify", title: "해외 법인 런칭 킥오프 미팅", department: "영업", dDayOffset: -30, durationDays: 1, isRequired: true, perCustomer: true },
    { code: "F-07", category: "dealer_notify", title: "대리점 인센티브 프로그램 안내", department: "영업+경영", dDayOffset: -30, durationDays: 3, isRequired: false },
    { code: "F-08", category: "dealer_notify", title: "VIP 고객 대상 사전 체험 행사", department: "영업+마케팅", dDayOffset: -14, durationDays: 3, isRequired: false, perCustomer: true },
    { code: "F-09", category: "dealer_notify", title: "런칭 이벤트 초대장 발송", department: "마케팅+영업", dDayOffset: -14, durationDays: 2, isRequired: false, perCustomer: true },
    { code: "F-10", category: "dealer_notify", title: "출시 후 1주일 거래처 피드백 수집", department: "영업", dDayOffset: 7, durationDays: 1, isRequired: true, perCustomer: true },
    // G: CS/서비스 준비 (18)
    { code: "G-01", category: "cs", title: "A/S 원가 분석 (부품비+인건비+물류비)", department: "CS+경영", dDayOffset: -90, durationDays: 7, isRequired: true },
    { code: "G-02", category: "cs", title: "A/S 가격 결정 (손익분기 기반)", department: "CS+경영", dDayOffset: -80, durationDays: 5, isRequired: true },
    { code: "G-03", category: "cs", title: "보증 기간 및 조건 확정", department: "CS+법무", dDayOffset: -80, durationDays: 5, isRequired: true },
    { code: "G-04", category: "cs", title: "보증서 양식 작성 (국문/영문)", department: "CS", dDayOffset: -70, durationDays: 3, isRequired: true },
    { code: "G-05", category: "cs", title: "서비스 부품 가격표 작성", department: "CS+구매", dDayOffset: -70, durationDays: 5, isRequired: true },
    { code: "G-06", category: "cs", title: "서비스 부품 초기 재고 확보", department: "CS+구매", dDayOffset: -45, durationDays: 14, isRequired: true },
    { code: "G-07", category: "cs", title: "A/S 접수 프로세스 정의", department: "CS", dDayOffset: -60, durationDays: 7, isRequired: true },
    { code: "G-08", category: "cs", title: "A/S 접수 채널 개설 (전화/이메일/웹폼)", department: "CS", dDayOffset: -45, durationDays: 5, isRequired: true },
    { code: "G-09", category: "cs", title: "서비스 매뉴얼 작성 (분해/조립/교정)", department: "CS+개발", dDayOffset: -60, durationDays: 14, isRequired: true },
    { code: "G-10", category: "cs", title: "CS 담당자 제품 교육 (실습 포함)", department: "CS+개발", dDayOffset: -30, durationDays: 3, isRequired: true },
    { code: "G-11", category: "cs", title: "고객 상담 매뉴얼 작성 (응대 스크립트)", department: "CS", dDayOffset: -30, durationDays: 7, isRequired: true },
    { code: "G-12", category: "cs", title: "원격 진단/지원 체계 구축", department: "CS+개발", dDayOffset: -30, durationDays: 7, isRequired: false },
    { code: "G-13", category: "cs", title: "해외 A/S 체계 구축 (현지 파트너 연계)", department: "CS+영업", dDayOffset: -45, durationDays: 14, isRequired: true },
    { code: "G-14", category: "cs", title: "설치 가이드 작성 (설치형 장비)", department: "CS+개발", dDayOffset: -45, durationDays: 7, isRequired: true },
    { code: "G-15", category: "cs", title: "교정(Calibration) 절차서 작성", department: "CS+품질", dDayOffset: -45, durationDays: 7, isRequired: false },
    { code: "G-16", category: "cs", title: "소모품/액세서리 판매 계획 수립", department: "CS+영업", dDayOffset: -30, durationDays: 5, isRequired: false },
    { code: "G-17", category: "cs", title: "고객 만족도 조사 양식 준비", department: "CS", dDayOffset: -14, durationDays: 3, isRequired: false },
    { code: "G-18", category: "cs", title: "CS KPI 목표 설정", department: "CS+경영", dDayOffset: -14, durationDays: 3, isRequired: true },
    // H: 규제/인허가/등록 (14)
    { code: "H-01", category: "regulatory", title: "MFDS 품목허가/인증 취득 완료 확인", department: "인증", dDayOffset: -180, durationDays: 0, isRequired: true },
    { code: "H-02", category: "regulatory", title: "허가 사항 vs 실제 제품 일치 확인", department: "인증+품질", dDayOffset: -60, durationDays: 3, isRequired: true },
    { code: "H-03", category: "regulatory", title: "UDI-DI (기기식별자) 발급", department: "인증", dDayOffset: -90, durationDays: 14, isRequired: true },
    { code: "H-04", category: "regulatory", title: "UDI-PI 체계 구축 (로트/시리얼)", department: "인증+제조", dDayOffset: -60, durationDays: 7, isRequired: true },
    { code: "H-05", category: "regulatory", title: "UDI 데이터베이스 등록", department: "인증", dDayOffset: -45, durationDays: 7, isRequired: true },
    { code: "H-06", category: "regulatory", title: "라벨링 최종 확인 (제품/포장/IFU)", department: "인증+품질", dDayOffset: -45, durationDays: 5, isRequired: true },
    { code: "H-07", category: "regulatory", title: "병원 조달 등록 서류 준비", department: "인증+영업", dDayOffset: -30, durationDays: 7, isRequired: true },
    { code: "H-08", category: "regulatory", title: "CE 인증 완료 확인 (유럽 수출 시)", department: "인증", dDayOffset: -120, durationDays: 0, isRequired: false },
    { code: "H-09", category: "regulatory", title: "FDA 510(k) clearance 확인 (미국)", department: "인증", dDayOffset: -120, durationDays: 0, isRequired: false },
    { code: "H-10", category: "regulatory", title: "수출 허가/면허 취득 확인", department: "인증", dDayOffset: -60, durationDays: 14, isRequired: false },
    { code: "H-11", category: "regulatory", title: "수출 통관 서류 준비", department: "인증+영업", dDayOffset: -30, durationDays: 7, isRequired: false },
    { code: "H-12", category: "regulatory", title: "GMP 적합성 인정서 유효 확인", department: "인증+품질", dDayOffset: -90, durationDays: 0, isRequired: true },
    { code: "H-13", category: "regulatory", title: "HIRA 급여 등재 신청 (해당 시)", department: "인증", dDayOffset: -120, durationDays: 60, isRequired: false },
    { code: "H-14", category: "regulatory", title: "의료기기 광고 사전심의 (해당 시)", department: "인증+마케팅", dDayOffset: -30, durationDays: 14, isRequired: false },
    // I: 물류/재고/출하 (10)
    { code: "I-01", category: "logistics", title: "제품 포장 사양 확정", department: "제조+디자인", dDayOffset: -45, durationDays: 5, isRequired: true },
    { code: "I-02", category: "logistics", title: "포장재 인쇄 발주", department: "구매", dDayOffset: -40, durationDays: 14, isRequired: true },
    { code: "I-03", category: "logistics", title: "물류 채널 확정 (택배/화물/직배송)", department: "영업+경영", dDayOffset: -30, durationDays: 3, isRequired: true },
    { code: "I-04", category: "logistics", title: "초도 생산 물량 확정", department: "영업+제조", dDayOffset: -30, durationDays: 2, isRequired: true },
    { code: "I-05", category: "logistics", title: "창고 입고/출고 프로세스 확인", department: "영업+제조", dDayOffset: -21, durationDays: 3, isRequired: true },
    { code: "I-06", category: "logistics", title: "수출 물류 준비 (포워더/보험)", department: "영업", dDayOffset: -21, durationDays: 7, isRequired: false },
    { code: "I-07", category: "logistics", title: "초도 물량 생산 완료 확인", department: "제조", dDayOffset: -14, durationDays: 0, isRequired: true },
    { code: "I-08", category: "logistics", title: "초도 물량 출하 검사 통과", department: "품질", dDayOffset: -7, durationDays: 3, isRequired: true },
    { code: "I-09", category: "logistics", title: "첫 출하 실행", department: "영업+제조", dDayOffset: 0, durationDays: 1, isRequired: true },
    { code: "I-10", category: "logistics", title: "출하 후 배송 추적 및 도착 확인", department: "영업", dDayOffset: 3, durationDays: 3, isRequired: true },
    // J: 런칭 이벤트/PR (8)
    { code: "J-01", category: "launch_event", title: "런칭 이벤트 기획", department: "마케팅+영업", dDayOffset: -60, durationDays: 7, isRequired: false },
    { code: "J-02", category: "launch_event", title: "런칭 이벤트 장소/플랫폼 섭외", department: "마케팅", dDayOffset: -45, durationDays: 3, isRequired: false },
    { code: "J-03", category: "launch_event", title: "런칭 이벤트 초대 및 참석자 관리", department: "마케팅+영업", dDayOffset: -21, durationDays: 7, isRequired: false },
    { code: "J-04", category: "launch_event", title: "런칭 이벤트 실행", department: "전체", dDayOffset: 0, durationDays: 1, isRequired: false },
    { code: "J-05", category: "launch_event", title: "보도자료 배포 (언론사/업계지)", department: "마케팅", dDayOffset: -7, durationDays: 3, isRequired: false },
    { code: "J-06", category: "launch_event", title: "SNS 런칭 캠페인 실행", department: "마케팅", dDayOffset: 0, durationDays: 7, isRequired: true },
    { code: "J-07", category: "launch_event", title: "출시 후 초기 반응 모니터링", department: "마케팅", dDayOffset: 1, durationDays: 14, isRequired: true },
    { code: "J-08", category: "launch_event", title: "출시 후 2주 리뷰 미팅 (전 부서)", department: "경영+전체", dDayOffset: 14, durationDays: 1, isRequired: true },
    // L: KOL/학회/임상 마케팅 (10)
    { code: "L-01", category: "kol", title: "KOL 후보 리스트 작성 (전문 분야별 3~5명)", department: "임상+영업", dDayOffset: -180, durationDays: 7, isRequired: true },
    { code: "L-02", category: "kol", title: "KOL 섭외 및 자문 계약 체결", department: "임상+영업", dDayOffset: -160, durationDays: 14, isRequired: true },
    { code: "L-03", category: "kol", title: "KOL 자문 회의 실시 (제품 피드백)", department: "임상+개발", dDayOffset: -140, durationDays: 3, isRequired: true },
    { code: "L-04", category: "kol", title: "KOL 대상 제품 사전 체험 프로그램", department: "영업+임상", dDayOffset: -90, durationDays: 30, isRequired: false },
    { code: "L-05", category: "kol", title: "KOL 추천사/추천 영상 확보", department: "마케팅+임상", dDayOffset: -45, durationDays: 14, isRequired: false },
    { code: "L-06", category: "kol", title: "학회 발표 일정 확인 (연관 학회 캘린더)", department: "마케팅+임상", dDayOffset: -180, durationDays: 3, isRequired: true },
    { code: "L-07", category: "kol", title: "학회 전시 부스 예약", department: "마케팅", dDayOffset: -120, durationDays: 1, isRequired: false },
    { code: "L-08", category: "kol", title: "학회 전시 부스 디자인 및 제작", department: "마케팅+디자인", dDayOffset: -60, durationDays: 21, isRequired: false },
    { code: "L-09", category: "kol", title: "학회 발표 초록/포스터 준비", department: "임상+마케팅", dDayOffset: -90, durationDays: 14, isRequired: false },
    { code: "L-10", category: "kol", title: "학회 후 리드(잠재고객) 후속 연락", department: "영업", dDayOffset: 7, durationDays: 7, isRequired: false },
    // M: 보험급여/조달/시장접근 (8)
    { code: "M-01", category: "insurance", title: "건강보험 급여 적용 여부 판단", department: "인증+영업", dDayOffset: -120, durationDays: 5, isRequired: true },
    { code: "M-02", category: "insurance", title: "HIRA 급여 등재 신청 (해당 시)", department: "인증", dDayOffset: -120, durationDays: 120, isRequired: false },
    { code: "M-03", category: "insurance", title: "건강보험 수가 산정 자료 준비", department: "인증+경영", dDayOffset: -90, durationDays: 14, isRequired: false },
    { code: "M-04", category: "insurance", title: "나라장터 등록 준비 (공공기관 납품용)", department: "영업", dDayOffset: -60, durationDays: 14, isRequired: false },
    { code: "M-05", category: "insurance", title: "나라장터 등록 완료", department: "영업", dDayOffset: -30, durationDays: 14, isRequired: false },
    { code: "M-06", category: "insurance", title: "보건경제성 분석 자료 작성", department: "임상+경영", dDayOffset: -60, durationDays: 21, isRequired: false },
    { code: "M-07", category: "insurance", title: "병원 구매위원회 발표 자료 준비", department: "영업", dDayOffset: -45, durationDays: 7, isRequired: true },
    { code: "M-08", category: "insurance", title: "해외 보험급여/상환 전략 수립", department: "인증+영업", dDayOffset: -90, durationDays: 21, isRequired: false },
    // N: 출시 후 모니터링/성과 추적 (8)
    { code: "N-01", category: "post_launch", title: "출시 후 1주 — 초기 판매 실적 집계", department: "영업+경영", dDayOffset: 7, durationDays: 1, isRequired: true },
    { code: "N-02", category: "post_launch", title: "출시 후 1주 — 고객 피드백 수집", department: "영업+CS", dDayOffset: 7, durationDays: 7, isRequired: true },
    { code: "N-03", category: "post_launch", title: "출시 후 2주 — 전 부서 리뷰 미팅", department: "경영+전체", dDayOffset: 14, durationDays: 1, isRequired: true },
    { code: "N-04", category: "post_launch", title: "출시 후 1개월 — 판매 목표 대비 실적 분석", department: "영업+경영", dDayOffset: 30, durationDays: 3, isRequired: true },
    { code: "N-05", category: "post_launch", title: "출시 후 1개월 — CS 이슈 취합", department: "CS", dDayOffset: 30, durationDays: 3, isRequired: true },
    { code: "N-06", category: "post_launch", title: "출시 후 1개월 — FAQ 보완", department: "CS+영업", dDayOffset: 30, durationDays: 5, isRequired: true },
    { code: "N-07", category: "post_launch", title: "출시 후 3개월 — 분기 실적 분석", department: "영업+경영", dDayOffset: 90, durationDays: 5, isRequired: true },
    { code: "N-08", category: "post_launch", title: "출시 후 3개월 — 마케팅 채널별 ROI 분석", department: "마케팅+경영", dDayOffset: 90, durationDays: 5, isRequired: true },
  ];
}

// ─── Launch Category Labels ─────────────────────────────────────────────────

export const LAUNCH_CATEGORY_LABELS = {
  brand: "브랜드/포지셔닝",
  photo: "사진/영상",
  print: "인쇄물/문서",
  digital: "디지털 콘텐츠",
  pricing: "가격/견적/계약",
  sales_training: "영업 교육/역량",
  dealer_notify: "거래처 통보/관리",
  cs: "CS/서비스 준비",
  regulatory: "규제/인허가/등록",
  logistics: "물류/재고/출하",
  launch_event: "런칭 이벤트/PR",
  kol: "KOL/학회/임상",
  insurance: "보험급여/조달",
  post_launch: "출시 후 모니터링",
};

export const CUSTOMER_TYPE_LABELS = {
  dealer: "대리점",
  subsidiary: "해외 법인",
  hospital: "병원/의료기관",
  online: "온라인 채널",
};

// ═══════════════════════════════════════════════════════════════════════════════
// NEW FEATURES — Activity Log, Bulk Operations, User Management, Comments CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Activity Log ────────────────────────────────────────────────────────────

export async function addActivityLog(action, userId, userName, role, targetType, targetId, details = {}) {
  await addDoc(collection(db, "activityLogs"), {
    action,
    userId,
    userName,
    role,
    targetType,
    targetId,
    details,
    timestamp: Timestamp.now(),
  });
}

export function subscribeActivityLogs(targetType, targetId, callback) {
  const q = targetId
    ? query(collection(db, "activityLogs"), where("targetType", "==", targetType), where("targetId", "==", targetId))
    : query(collection(db, "activityLogs"), where("targetType", "==", targetType));
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: toDate(d.data().timestamp) }));
    logs.sort((a, b) => b.timestamp - a.timestamp);
    callback(logs);
  });
}

export function subscribeAllActivityLogs(callback, limitCount = 50) {
  return onSnapshot(collection(db, "activityLogs"), (snap) => {
    const logs = snap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: toDate(d.data().timestamp) }));
    logs.sort((a, b) => b.timestamp - a.timestamp);
    callback(logs.slice(0, limitCount));
  });
}

// ─── Gate Records (Phase 승인 기록 + 회의록) ─────────────────────────────────

const PHASE_DESCRIPTIONS = {
  "발의": "제품 컨셉 정의 및 기술 타당성을 검토하여 개발 착수 승인",
  "기획": "상세 기획서 검토 및 개발 계획 승인",
  "WM": "Working Model 제작 완료 검토 및 설계 승인",
  "Tx": "Pilot 제품 완성도 검토 및 양산 준비 승인 (Product Readiness)",
  "MSG": "시생산 완료 검토 및 양산 전환 승인 (Sales Readiness)",
  "양산/이관": "양산 체제 확인 및 영업 이관 최종 승인",
};

export { PHASE_DESCRIPTIONS };

/** 프로젝트의 gateRecords 실시간 구독 */
export function subscribeGateRecords(projectId, callback) {
  const q = query(collection(db, "gateRecords"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    const records = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        approvedAt: toDate(data.approvedAt),
        meetingNotes: (data.meetingNotes || []).map(n => ({
          ...n,
          createdAt: toDate(n.createdAt),
        })),
      };
    });
    callback(records);
  });
}

/** Phase별 gateRecord 가져오기 (없으면 null) */
export async function getGateRecord(projectId, phaseId) {
  const q = query(
    collection(db, "gateRecords"),
    where("projectId", "==", projectId),
    where("phaseId", "==", phaseId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    ...data,
    id: d.id,
    approvedAt: toDate(data.approvedAt),
    meetingNotes: (data.meetingNotes || []).map(n => ({
      ...n,
      createdAt: toDate(n.createdAt),
    })),
  };
}

/** gateRecord 생성 또는 업데이트 (승인/반려) */
export async function updateGateRecord(projectId, phaseId, phaseName, gateStatus, approvedBy) {
  const q = query(
    collection(db, "gateRecords"),
    where("projectId", "==", projectId),
    where("phaseId", "==", phaseId)
  );
  const snap = await getDocs(q);

  const data = {
    projectId,
    phaseId,
    phaseName,
    gateStatus,
    approvedBy: gateStatus !== "pending" ? approvedBy : "",
    approvedAt: gateStatus !== "pending" ? Timestamp.now() : null,
    description: PHASE_DESCRIPTIONS[phaseName] || "",
    updatedAt: Timestamp.now(),
  };

  if (snap.empty) {
    // 새로 생성
    await addDoc(collection(db, "gateRecords"), {
      ...data,
      meetingNotes: [],
      createdAt: Timestamp.now(),
    });
  } else {
    // 기존 업데이트 (meetingNotes는 건드리지 않음)
    await updateDoc(snap.docs[0].ref, data);
  }

  // 활동 로그 기록
  const actionLabel = gateStatus === "approved" ? "gate_approved" : gateStatus === "rejected" ? "gate_rejected" : "gate_reset";
  try {
    await addActivityLog(actionLabel, "", approvedBy, "", "project", projectId, {
      phaseId,
      phaseName,
      gateStatus,
    });
  } catch { /* ignore */ }
}

/** gateRecord 승인 날짜 수정 */
export async function updateGateApprovedAt(projectId, phaseId, newDate) {
  const q = query(
    collection(db, "gateRecords"),
    where("projectId", "==", projectId),
    where("phaseId", "==", phaseId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  await updateDoc(snap.docs[0].ref, {
    approvedAt: Timestamp.fromDate(new Date(newDate)),
    updatedAt: Timestamp.now(),
  });
}

/** gateRecord에 회의록 메모 추가 */
export async function addGateMeetingNote(projectId, phaseId, phaseName, author, content, files = []) {
  const q = query(
    collection(db, "gateRecords"),
    where("projectId", "==", projectId),
    where("phaseId", "==", phaseId)
  );
  const snap = await getDocs(q);

  const note = {
    author,
    content,
    files,
    createdAt: Timestamp.now(),
  };

  if (snap.empty) {
    // gateRecord가 아직 없으면 생성하면서 메모 추가
    await addDoc(collection(db, "gateRecords"), {
      projectId,
      phaseId,
      phaseName,
      gateStatus: "pending",
      approvedBy: "",
      approvedAt: null,
      description: PHASE_DESCRIPTIONS[phaseName] || "",
      meetingNotes: [note],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } else {
    const docRef = snap.docs[0].ref;
    const existing = snap.docs[0].data().meetingNotes || [];
    await updateDoc(docRef, {
      meetingNotes: [...existing, note],
      updatedAt: Timestamp.now(),
    });
  }
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

// 개별 작업 승인 제거됨 — stub
export async function bulkApproveTasks(_taskIds, _reviewerName) {
  console.warn("bulkApproveTasks: 개별 작업 승인이 제거되었습니다.");
  return { successCount: 0, failCount: 0 };
}

export async function bulkUpdateAssignee(taskIds, newAssignee) {
  let successCount = 0;
  let failCount = 0;
  const BATCH_LIMIT = 450;

  for (let i = 0; i < taskIds.length; i += BATCH_LIMIT) {
    const chunk = taskIds.slice(i, i + BATCH_LIMIT);
    try {
      const batch = writeBatch(db);
      for (const taskId of chunk) {
        batch.update(doc(db, "checklistItems", taskId), { assignee: newAssignee });
      }
      await batch.commit();
      successCount += chunk.length;
    } catch (e) {
      console.error("Bulk assignee batch failed:", e);
      failCount += chunk.length;
    }
  }
  return { successCount, failCount };
}

// ─── User Management ─────────────────────────────────────────────────────────

export function subscribeUsers(callback) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const users = snap.docs.map(d => docToUser(d.id, d.data()));
    callback(users);
  });
}

export async function updateUserRole(userId, newRole) {
  await updateDoc(doc(db, "users", userId), { role: newRole });
}

export async function updateUserDepartment(userId, newDept) {
  await updateDoc(doc(db, "users", userId), { department: newDept });
}

export async function deactivateUser(userId) {
  await updateDoc(doc(db, "users", userId), { active: false });
}

export async function activateUser(userId) {
  await updateDoc(doc(db, "users", userId), { active: true });
}

// ─── Permissions / Settings ──────────────────────────────────────────────────

export function subscribePermissions(callback) {
  return onSnapshot(doc(db, "settings", "permissions"), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export async function updatePermissions(data) {
  await setDoc(doc(db, "settings", "permissions"), data, { merge: true });
}

// ─── Comment Update/Delete ───────────────────────────────────────────────────

export async function updateComment(taskId, commentId, newContent) {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (!taskSnap.exists()) return;
  const comments = (taskSnap.data().comments || []).map(c =>
    c.id === commentId ? { ...c, content: newContent, editedAt: Timestamp.fromDate(new Date()) } : c
  );
  await updateDoc(doc(db, "checklistItems", taskId), { comments });
}

export async function deleteComment(taskId, commentId) {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (!taskSnap.exists()) return;
  const comments = (taskSnap.data().comments || []).filter(c => c.id !== commentId);
  await updateDoc(doc(db, "checklistItems", taskId), { comments });
}

// ─── File Metadata (stored in Firestore, actual files in Firebase Storage) ──

export async function addFileMetadata(taskId, fileData) {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (!taskSnap.exists()) return;
  const files = taskSnap.data().files || [];
  files.push({ ...fileData, uploadedAt: Timestamp.fromDate(new Date()) });
  await updateDoc(doc(db, "checklistItems", taskId), { files });
}

export async function removeFileMetadata(taskId, fileId) {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (!taskSnap.exists()) return;
  const files = (taskSnap.data().files || []).filter(f => f.id !== fileId);
  await updateDoc(doc(db, "checklistItems", taskId), { files });
}

// ─── Task Dependencies ──────────────────────────────────────────────────────

export async function updateTaskDependencies(taskId, depIds) {
  await updateDoc(doc(db, "checklistItems", taskId), { dependencies: depIds });
}

/** Pure function: returns { blocked: boolean, blockers: Task[] } */
export function getBlockingStatus(task, allTasks) {
  const deps = task.dependencies || [];
  if (deps.length === 0) return { blocked: false, blockers: [] };
  const blockers = [];
  for (const depId of deps) {
    const dep = allTasks.find(t => t.id === depId);
    if (dep && dep.status !== "completed") blockers.push(dep);
  }
  return { blocked: blockers.length > 0, blockers };
}

/** BFS cycle detection — returns true if adding proposedDeps would create a cycle */
export function hasCyclicDependency(taskId, proposedDeps, allTasks) {
  const visited = new Set();
  const queue = [...proposedDeps];
  while (queue.length > 0) {
    const curId = queue.shift();
    if (curId === taskId) return true;
    if (visited.has(curId)) continue;
    visited.add(curId);
    const cur = allTasks.find(t => t.id === curId);
    if (cur && cur.dependencies) {
      for (const depId of cur.dependencies) queue.push(depId);
    }
  }
  return false;
}
