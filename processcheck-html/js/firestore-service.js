// ═══════════════════════════════════════════════════════════════════════════════
// Firestore Service — all CRUD + real-time subscriptions
// Ported from lib/firestoreService.ts (no TypeScript)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, deleteField,
  query, where, Timestamp, writeBatch, onSnapshot,
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
  return { ...data, id, startDate: toDate(data.startDate), endDate: toDate(data.endDate) };
}

function docToChecklistItem(id, data) {
  return {
    ...data, id,
    dueDate: toDate(data.dueDate),
    completedDate: data.completedDate ? toDate(data.completedDate) : undefined,
    comments: (data.comments || []).map(c => ({ ...c, createdAt: toDate(c.createdAt) })),
  };
}

function docToChangeRequest(id, data) {
  return { ...data, id, requestedAt: toDate(data.requestedAt) };
}

function docToNotification(id, data) {
  return { ...data, id, createdAt: toDate(data.createdAt) };
}

function docToUser(id, data) {
  return { ...data, id };
}

// ─── Mock Data (inline for seeding) ─────────────────────────────────────────

function getMockData() {
  const today = new Date();
  const d = (offset) => new Date(today.getTime() + offset * 86400000);

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
    { id: "proj1", name: "신규 체성분 분석기 개발", productType: "체성분 분석기", projectType: "신규개발", status: "active", progress: 35, startDate: new Date("2026-01-01"), endDate: new Date("2026-08-31"), pm: "박민수", riskLevel: "yellow", currentStage: "WM제작" },
    { id: "proj2", name: "가정용 혈압계 업그레이드", productType: "혈압계", projectType: "신규개발", status: "active", progress: 65, startDate: new Date("2025-10-01"), endDate: new Date("2026-05-31"), pm: "박민수", riskLevel: "green", currentStage: "Tx단계" },
    { id: "proj3", name: "FRA 장비 신모델", productType: "FRA", projectType: "신규개발", status: "active", progress: 15, startDate: new Date("2026-02-01"), endDate: new Date("2026-12-31"), pm: "박민수", riskLevel: "green", currentStage: "기획검토" },
    { id: "proj4", name: "신장계 긴급 설계 변경", productType: "신장계", projectType: "설계변경", changeScale: "major", status: "active", progress: 85, startDate: new Date("2025-11-01"), endDate: new Date("2026-03-31"), pm: "박민수", riskLevel: "red", currentStage: "MSG승인회" },
    { id: "proj5", name: "이전 프로젝트 (완료)", productType: "혈압계", projectType: "신규개발", status: "completed", progress: 100, startDate: new Date("2025-06-01"), endDate: new Date("2025-12-31"), pm: "박민수", riskLevel: "green", currentStage: "영업이관" },
    // 설계변경 프로젝트
    { id: "proj6", name: "센서 교체 (혈압계)", productType: "혈압계", projectType: "설계변경", changeScale: "minor", status: "completed", progress: 100, startDate: new Date("2026-01-10"), endDate: new Date("2026-01-25"), pm: "이영희", riskLevel: "green", currentStage: "영업이관" },
    { id: "proj7", name: "배터리 규격 변경", productType: "체성분 분석기", projectType: "설계변경", changeScale: "major", status: "active", progress: 20, startDate: new Date("2026-01-15"), endDate: new Date("2026-06-30"), pm: "박민수", riskLevel: "yellow", currentStage: "발의검토" },
    { id: "proj8", name: "LCD 크기 조정", productType: "혈압계", projectType: "설계변경", changeScale: "medium", status: "active", progress: 40, startDate: new Date("2026-02-01"), endDate: new Date("2026-04-30"), pm: "이영희", riskLevel: "green", currentStage: "기획검토" },
    { id: "proj9", name: "펌웨어 버전 업데이트", productType: "FRA", projectType: "설계변경", changeScale: "minor", status: "active", progress: 50, startDate: new Date("2026-02-10"), endDate: new Date("2026-03-15"), pm: "이영희", riskLevel: "green", currentStage: "발의검토" },
    { id: "proj10", name: "외관 재질 변경", productType: "신장계", projectType: "설계변경", changeScale: "medium", status: "completed", progress: 100, startDate: new Date("2025-12-01"), endDate: new Date("2026-02-10"), pm: "박민수", riskLevel: "green", currentStage: "영업이관" },
  ];

  const mockChecklistItems = [
    { id: "task1", projectId: "proj1", stage: "WM제작", department: "개발팀", title: "스펙 정리 및 분석 완료", description: "제품 스펙을 최종 확정하고 기술 문서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(1) },
    { id: "task2", projectId: "proj1", stage: "WM제작", department: "개발팀", title: "eBOM 작성", description: "설계 자재 명세서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: d(0) },
    { id: "task3", projectId: "proj2", stage: "Tx단계", department: "개발팀", title: "기술 문서 검토", description: "최종 기술 문서를 검토하고 승인합니다.", assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: d(3) },
    { id: "task4", projectId: "proj1", stage: "기획검토", department: "개발팀", title: "NABC 분석 완료", description: "Need, Approach, Benefit, Competition 분석", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-1) },
    { id: "task5", projectId: "proj2", stage: "Tx단계", department: "개발팀", title: "성능 테스트 보고서 작성", description: "성능 테스트 결과를 정리하고 보고서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(2), completedDate: d(-1) },
    { id: "task6", projectId: "proj1", stage: "WM제작", department: "품질팀", title: "신뢰성 테스트 계획 수립", description: "제품의 신뢰성 테스트 계획을 수립합니다.", assignee: "최지영", reviewer: "강민지", status: "in_progress", dueDate: d(5) },
    { id: "task7", projectId: "proj2", stage: "Tx단계", department: "품질팀", title: "낙하 테스트 실시", description: "제품 낙하 테스트를 실시하고 결과를 분석합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(1) },
    { id: "task8", projectId: "proj4", stage: "MSG승인회", department: "제조팀", title: "양산 라인 셋업", description: "양산을 위한 제조 라인 준비 및 테스트", assignee: "정수현", reviewer: "이영희", status: "in_progress", dueDate: d(0) },
    { id: "task9", projectId: "proj4", stage: "MasterGatePilot", department: "제조팀", title: "시생산 결과 분석", description: "시생산 결과를 분석하고 개선사항을 도출합니다.", assignee: "정수현", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-2) },
    { id: "task10", projectId: "proj2", stage: "Tx단계", department: "디자인연구소", title: "UI/UX 디자인 최종 검토", description: "사용자 인터페이스 및 경험 디자인 최종 검토", assignee: "홍길동", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-3) },
    { id: "task11", projectId: "proj1", stage: "WM제작", department: "구매팀", title: "부품 공급업체 선정", description: "주요 부품의 공급업체를 선정하고 계약합니다.", assignee: "박영수", reviewer: "김부장", status: "pending", dueDate: d(7) },
    { id: "task12", projectId: "proj3", stage: "기획검토", department: "영업팀", title: "시장 조사 및 분석", description: "목표 시장을 조사하고 경쟁사를 분석합니다.", assignee: "이상민", reviewer: "최과장", status: "in_progress", dueDate: d(5) },
    { id: "task13", projectId: "proj1", stage: "WM제작", department: "인증팀", title: "인증 전략 수립", description: "각국 인증 요구사항을 분석하고 전략을 수립합니다.", assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: d(7) },
    { id: "task14", projectId: "proj4", stage: "MSG승인회", department: "개발팀", title: "최종 도면 승인", description: "양산을 위한 최종 도면을 검토하고 승인합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(-1) },
    { id: "task15", projectId: "proj1", stage: "발의검토", department: "개발팀", title: "제품 컨셉 정의", description: "신제품 컨셉과 목표를 정의합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task16", projectId: "proj1", stage: "발의검토", department: "품질팀", title: "품질 목표 수립", description: "제품의 품질 목표와 기준을 수립합니다.", assignee: "최지영", reviewer: "강민지", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task17", projectId: "proj1", stage: "발의검토", department: "영업팀", title: "시장 기회 분석", description: "목표 시장과 경쟁 환경을 분석합니다.", assignee: "이상민", reviewer: "최과장", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task18", projectId: "proj1", stage: "발의검토", department: "경영관리팀", title: "사업성 검토", description: "ROI 및 수익성을 분석합니다.", assignee: "정재무", reviewer: "김부장", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task19", projectId: "proj1", stage: "기획검토", department: "영업팀", title: "가격 전략 수립", description: "제품 가격 전략을 수립합니다.", assignee: "이상민", reviewer: "최과장", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task20", projectId: "proj1", stage: "WM제작", department: "개발팀", title: "시제품 제작", description: "1차 시제품을 제작합니다.", assignee: "박영수", reviewer: "이영희", status: "pending", dueDate: d(7) },
    { id: "task21", projectId: "proj1", stage: "WM제작", department: "제조팀", title: "제작 공정 검토", description: "시제품 제작 공정을 검토합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task22", projectId: "proj1", stage: "Tx단계", department: "품질팀", title: "내구성 테스트", description: "제품 내구성 테스트를 실시합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(7) },
    { id: "task23", projectId: "proj1", stage: "Tx단계", department: "디자인연구소", title: "외관 디자인 확정", description: "제품 외관 디자인을 확정합니다.", assignee: "홍길동", reviewer: "박디자인", status: "pending", dueDate: d(7) },
    { id: "task24", projectId: "proj1", stage: "MasterGatePilot", department: "제조팀", title: "양산 공정 계획", description: "양산을 위한 제조 공정을 계획합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task25", projectId: "proj1", stage: "MasterGatePilot", department: "구매팀", title: "자재 조달 계획", description: "양산 자재 조달 계획을 수립합니다.", assignee: "박구매", reviewer: "최구매", status: "pending", dueDate: d(7) },
    { id: "task26", projectId: "proj1", stage: "MasterGatePilot", department: "제조팀", title: "시생산 실시", description: "시생산을 실시하고 문제점을 파악합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task27", projectId: "proj1", stage: "MSG승인회", department: "품질팀", title: "최종 품질 검증", description: "양산 전 최종 품질을 검증합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(7) },
    { id: "task28", projectId: "proj1", stage: "양산", department: "제조팀", title: "양산 가동", description: "본격적인 양산을 시작합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task29", projectId: "proj1", stage: "영업이관", department: "영업팀", title: "판매 시작 준비", description: "제품 판매를 위한 준비를 합니다.", assignee: "이상민", reviewer: "최과장", status: "pending", dueDate: d(7) },
    { id: "task30", projectId: "proj1", stage: "영업이관", department: "CS팀", title: "A/S 체계 구축", description: "고객 서비스 및 A/S 체계를 구축합니다.", assignee: "김서비스", reviewer: "박CS", status: "pending", dueDate: d(7) },
    { id: "task31", projectId: "proj1", stage: "WM제작", department: "인증팀", title: "인증 요구사항 검토", description: "각국 인증 요구사항을 검토합니다.", assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: d(5) },
    // Gate stage tasks
    { id: "task32", projectId: "proj1", stage: "발의승인", department: "개발팀", title: "발의 심사 자료 준비", description: "발의 승인을 위한 심사 자료를 준비합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-30), completedDate: d(-28), approvalStatus: "approved" },
    { id: "task33", projectId: "proj1", stage: "발의승인", department: "품질팀", title: "발의 품질 기준 검토", description: "발의 단계 품질 기준을 검토합니다.", assignee: "최지영", reviewer: "강민지", status: "completed", dueDate: d(-30), completedDate: d(-28), approvalStatus: "approved" },
    { id: "task34", projectId: "proj1", stage: "기획승인", department: "개발팀", title: "기획 발표 자료 작성", description: "기획 승인회 발표 자료를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-20), completedDate: d(-18), approvalStatus: "approved" },
    { id: "task35", projectId: "proj1", stage: "기획승인", department: "영업팀", title: "기획 시장성 검증", description: "기획 단계 시장성을 검증합니다.", assignee: "이상민", reviewer: "최과장", status: "completed", dueDate: d(-20), completedDate: d(-18), approvalStatus: "approved" },
    { id: "task36", projectId: "proj1", stage: "WM승인회", department: "개발팀", title: "W/M 검증 결과 보고", description: "W/M 검증 결과를 보고합니다.", assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: d(14) },
    { id: "task37", projectId: "proj1", stage: "WM승인회", department: "품질팀", title: "W/M 품질 검증", description: "W/M 단계 품질을 검증합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(14) },
    { id: "task38", projectId: "proj1", stage: "Tx승인회", department: "품질팀", title: "Tx 시험 성적서 취합", description: "Tx 단계 시험 성적서를 취합합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(30) },
    { id: "task39", projectId: "proj1", stage: "Tx승인회", department: "인증팀", title: "인증 시험 보고서", description: "인증 시험 보고서를 작성합니다.", assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: d(30) },
    // Department coverage tasks
    { id: "task40", projectId: "proj1", stage: "WM제작", department: "글로벌임상팀", title: "해외 임상 계획 수립", description: "해외 임상 시험 계획을 수립합니다.", assignee: "이글로벌", reviewer: "김임상", status: "pending", dueDate: d(10) },
    { id: "task41", projectId: "proj1", stage: "기획검토", department: "CS팀", title: "서비스 요구사항 정의", description: "고객 서비스 요구사항을 정의합니다.", assignee: "김서비스", reviewer: "박CS", status: "completed", dueDate: d(-14), completedDate: d(-12) },
    { id: "task42", projectId: "proj2", stage: "Tx단계", department: "제조팀", title: "시험 생산 준비", description: "시험 생산 라인을 준비합니다.", assignee: "정수현", reviewer: "김제조", status: "in_progress", dueDate: d(3) },
    { id: "task43", projectId: "proj2", stage: "Tx단계", department: "구매팀", title: "시험 자재 조달", description: "시험 생산에 필요한 자재를 조달합니다.", assignee: "박구매", reviewer: "최구매", status: "pending", dueDate: d(5) },
    { id: "task44", projectId: "proj3", stage: "기획검토", department: "개발팀", title: "기술 타당성 검토", description: "FRA 신모델의 기술 타당성을 검토합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(5) },
    { id: "task45", projectId: "proj3", stage: "기획검토", department: "제조팀", title: "제조 타당성 검토", description: "FRA 신모델의 제조 타당성을 검토합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task46", projectId: "proj4", stage: "MasterGatePilot", department: "개발팀", title: "양산 도면 확정", description: "양산을 위한 최종 도면을 확정합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-5) },
    { id: "task47", projectId: "proj4", stage: "MasterGatePilot", department: "품질팀", title: "양산 품질 기준 설정", description: "양산 품질 기준을 설정합니다.", assignee: "최지영", reviewer: "강민지", status: "completed", dueDate: d(-7), completedDate: d(-5) },
    // 설계변경 프로젝트 tasks
    { id: "task48", projectId: "proj6", stage: "발의검토", department: "개발팀", title: "센서 호환성 확인", description: "교체 센서의 호환성을 확인합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-25), completedDate: d(-24) },
    { id: "task49", projectId: "proj6", stage: "발의승인", department: "품질팀", title: "품질 영향 검토", description: "센서 교체에 따른 품질 영향을 검토합니다.", assignee: "최지영", reviewer: "강민지", status: "completed", dueDate: d(-23), completedDate: d(-22), approvalStatus: "approved" },
    { id: "task50", projectId: "proj7", stage: "발의검토", department: "개발팀", title: "변경 사유서 작성", description: "배터리 규격 변경 사유서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(3) },
    { id: "task51", projectId: "proj7", stage: "발의검토", department: "제조팀", title: "제조 영향 분석", description: "배터리 변경에 따른 제조 영향을 분석합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task52", projectId: "proj8", stage: "기획검토", department: "개발팀", title: "LCD 규격 변경서", description: "LCD 크기 조정 규격 변경서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-10), completedDate: d(-8) },
    { id: "task53", projectId: "proj8", stage: "기획검토", department: "품질팀", title: "표시부 시인성 검증", description: "변경된 LCD의 시인성을 검증합니다.", assignee: "최지영", reviewer: "강민지", status: "in_progress", dueDate: d(3) },
    { id: "task54", projectId: "proj8", stage: "기획승인", department: "경영관리팀", title: "비용 영향 검토", description: "LCD 변경에 따른 비용 영향을 검토합니다.", assignee: "정재무", reviewer: "김부장", status: "pending", dueDate: d(10) },
    { id: "task55", projectId: "proj9", stage: "발의검토", department: "개발팀", title: "펌웨어 변경 내역서", description: "펌웨어 변경 내역서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(2) },
    { id: "task56", projectId: "proj10", stage: "기획검토", department: "디자인연구소", title: "외관 디자인 변경", description: "외관 재질에 맞는 디자인을 변경합니다.", assignee: "홍길동", reviewer: "박디자인", status: "completed", dueDate: d(-20), completedDate: d(-18) },
    { id: "task57", projectId: "proj10", stage: "기획승인", department: "품질팀", title: "재질 안전성 검증", description: "변경된 재질의 안전성을 검증합니다.", assignee: "최지영", reviewer: "강민지", status: "completed", dueDate: d(-15), completedDate: d(-14), approvalStatus: "approved" },
    // proj5 완료 tasks
    { id: "task58", projectId: "proj5", stage: "영업이관", department: "영업팀", title: "판매 채널 확보", description: "판매 채널을 확보합니다.", assignee: "이상민", reviewer: "최과장", status: "completed", dueDate: d(-60), completedDate: d(-55) },
    { id: "task59", projectId: "proj5", stage: "양산", department: "제조팀", title: "양산 안정화", description: "양산 프로세스를 안정화합니다.", assignee: "정수현", reviewer: "김제조", status: "completed", dueDate: d(-70), completedDate: d(-65) },
  ];

  const now = new Date();
  const h = (offset) => new Date(now.getTime() + offset * 3600000);
  const mockChangeRequests = [
    { id: "change1", projectId: "proj4", title: "배터리 규격 변경", description: "기존 AA 배터리에서 리튬이온 배터리로 변경", requestedBy: "영업팀", requestedAt: new Date("2026-01-27"), affectedDepartments: ["개발팀", "제조팀", "구매팀", "인증팀"], scale: "major", status: "in_review", readBy: { "개발팀": true, "제조팀": true, "구매팀": false, "인증팀": false } },
    { id: "change2", projectId: "proj1", title: "LCD 화면 크기 조정", description: "3.5인치에서 4.0인치로 확대", requestedBy: "품질팀", requestedAt: new Date("2026-01-25"), affectedDepartments: ["개발팀", "디자인연구소", "제조팀"], scale: "medium", status: "approved", readBy: { "개발팀": true, "디자인연구소": true, "제조팀": true } },
  ];

  const mockNotifications = [
    { id: "notif1", userId: "user1", type: "deadline_approaching", title: "⚠️ 마감일이 오늘입니다", message: "[신규 체성분 분석기] eBOM 작성 - 오늘 마감", link: "/projects/proj1/tasks/task2", read: false, createdAt: h(-1) },
    { id: "notif2", userId: "user1", type: "task_assigned", title: "새 작업이 배정되었습니다", message: "[신규 체성분 분석기] 스펙 정리 및 분석 완료", link: "/projects/proj1/tasks/task1", read: false, createdAt: h(-2) },
    { id: "notif3", userId: "user1", type: "deadline_approaching", title: "마감일이 1일 남았습니다", message: "[신장계] 최종 도면 승인 - 이미 마감일 지남 (긴급)", link: "/projects/proj4/tasks/task14", read: false, createdAt: h(-3) },
    { id: "notif4", userId: "user1", type: "change_request", title: "설계 변경 요청 확인 필요", message: "[신장계] 배터리 규격 변경 - 영향도 검토 요청", link: "/projects/proj4", read: true, createdAt: h(-24) },
    { id: "notif5", userId: "user1", type: "approval_request", title: "승인 완료", message: "이영희님이 NABC 분석 완료 작업을 승인했습니다", link: "/projects/proj1/tasks/task4", read: true, createdAt: h(-48) },
    { id: "notif6", userId: "user4", type: "deadline_approaching", title: "마감일이 내일입니다", message: "[가정용 혈압계] 낙하 테스트 실시 - 내일 마감", link: "/projects/proj2/tasks/task7", read: false, createdAt: h(-2) },
    { id: "notif7", userId: "user5", type: "deadline_approaching", title: "⚠️ 마감일이 오늘입니다", message: "[신장계] 양산 라인 셋업 - 오늘 마감", link: "/projects/proj4/tasks/task8", read: false, createdAt: h(-1) },
  ];

  return { mockUsers, mockProjects, mockChecklistItems, mockChangeRequests, mockNotifications };
}

// ─── Seed Database ──────────────────────────────────────────────────────────

export async function seedDatabaseIfEmpty() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    if (!usersSnap.empty) return false;

    const { mockUsers, mockProjects, mockChecklistItems, mockChangeRequests, mockNotifications } = getMockData();
    const batch = writeBatch(db);

    for (const user of mockUsers) {
      batch.set(doc(db, "users", user.id), user);
    }

    for (const project of mockProjects) {
      batch.set(doc(db, "projects", project.id), {
        ...project,
        startDate: Timestamp.fromDate(project.startDate),
        endDate: Timestamp.fromDate(project.endDate),
      });
    }

    for (const item of mockChecklistItems) {
      batch.set(doc(db, "checklistItems", item.id), {
        ...item,
        dueDate: Timestamp.fromDate(item.dueDate),
        completedDate: item.completedDate ? Timestamp.fromDate(item.completedDate) : null,
        files: item.files || [],
        comments: item.comments || [],
        dependencies: item.dependencies || [],
      });
    }

    for (const cr of mockChangeRequests) {
      batch.set(doc(db, "changeRequests", cr.id), {
        ...cr,
        requestedAt: Timestamp.fromDate(cr.requestedAt),
      });
    }

    for (const notif of mockNotifications) {
      batch.set(doc(db, "notifications", notif.id), {
        ...notif,
        createdAt: Timestamp.fromDate(notif.createdAt),
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

    // Template Items (stageId는 페이즈 ID 참조, 193개 — ISO 13485/IEC 62304/FDA 기반)
    const tItems = [
      // ── Phase 0: 발의 (22개) ──────────────────────────────────────
      // 개발팀 (6)
      { id: "ti-1", stageId: "phase0", departmentId: "dept1", content: "제품 컨셉 정의서 작성", order: 0, isRequired: true },
      { id: "ti-2", stageId: "phase0", departmentId: "dept1", content: "기술 타당성 사전 검토", order: 1, isRequired: true },
      { id: "ti-3", stageId: "phase0", departmentId: "dept1", content: "선행 기술 조사 보고서", order: 2, isRequired: true },
      { id: "ti-4", stageId: "phase0", departmentId: "dept1", content: "NABC 분석 작성", order: 3, isRequired: true },
      { id: "ti-5", stageId: "phase0", departmentId: "dept1", content: "지적재산권 사전 검토", order: 4, isRequired: false },
      { id: "ti-6", stageId: "phase0", departmentId: "dept1", content: "발의 심사 발표자료 준비", order: 5, isRequired: true },
      // 품질팀 (3)
      { id: "ti-7", stageId: "phase0", departmentId: "dept2", content: "품질 목표 수립", order: 0, isRequired: true },
      { id: "ti-8", stageId: "phase0", departmentId: "dept2", content: "해당 규격/표준 목록 사전 조사", order: 1, isRequired: true },
      { id: "ti-9", stageId: "phase0", departmentId: "dept2", content: "유사 제품 CAPA/불만 데이터 분석", order: 2, isRequired: false },
      // 영업팀 (4)
      { id: "ti-10", stageId: "phase0", departmentId: "dept3", content: "시장 기회 분석 보고서", order: 0, isRequired: true },
      { id: "ti-11", stageId: "phase0", departmentId: "dept3", content: "경쟁사 제품 분석", order: 1, isRequired: true },
      { id: "ti-12", stageId: "phase0", departmentId: "dept3", content: "목표 고객군 정의", order: 2, isRequired: true },
      { id: "ti-13", stageId: "phase0", departmentId: "dept3", content: "예상 판매가/판매량 추정", order: 3, isRequired: false },
      // 경영관리팀 (4)
      { id: "ti-14", stageId: "phase0", departmentId: "dept7", content: "사업성 검토 (ROI/수익성 분석)", order: 0, isRequired: true },
      { id: "ti-15", stageId: "phase0", departmentId: "dept7", content: "초기 프로젝트 예산 산정", order: 1, isRequired: true },
      { id: "ti-16", stageId: "phase0", departmentId: "dept7", content: "프로젝트 일정 초안 수립", order: 2, isRequired: true },
      { id: "ti-17", stageId: "phase0", departmentId: "dept7", content: "발의 승인 판단 근거 자료 취합", order: 3, isRequired: true },
      // 인증팀 (3)
      { id: "ti-18", stageId: "phase0", departmentId: "dept10", content: "규제 분류 사전 검토 (등급/품목 예비 분류)", order: 0, isRequired: true },
      { id: "ti-19", stageId: "phase0", departmentId: "dept10", content: "인허가 경로 조사 (국내 MFDS + 해외)", order: 1, isRequired: true },
      { id: "ti-20", stageId: "phase0", departmentId: "dept10", content: "필수 인증 목록 사전 파악", order: 2, isRequired: false },
      // 디자인연구소 (2)
      { id: "ti-21", stageId: "phase0", departmentId: "dept9", content: "사용자 니즈 사전 조사", order: 0, isRequired: false },
      { id: "ti-22", stageId: "phase0", departmentId: "dept9", content: "컨셉 스케치/무드보드", order: 1, isRequired: false },

      // ── Phase 1: 기획 (37개) ──────────────────────────────────────
      // 개발팀 (8)
      { id: "ti-23", stageId: "phase1", departmentId: "dept1", content: "설계 입력(Design Input) 요구사항 명세서", order: 0, isRequired: true },
      { id: "ti-24", stageId: "phase1", departmentId: "dept1", content: "제품 사양서(Product Specification) 작성", order: 1, isRequired: true },
      { id: "ti-25", stageId: "phase1", departmentId: "dept1", content: "소프트웨어 개발 계획 수립 (IEC 62304)", order: 2, isRequired: true },
      { id: "ti-26", stageId: "phase1", departmentId: "dept1", content: "시스템 아키텍처 설계", order: 3, isRequired: true },
      { id: "ti-27", stageId: "phase1", departmentId: "dept1", content: "설계 검증/확인 계획 수립", order: 4, isRequired: true },
      { id: "ti-28", stageId: "phase1", departmentId: "dept1", content: "개발 일정 상세 수립", order: 5, isRequired: true },
      { id: "ti-29", stageId: "phase1", departmentId: "dept1", content: "기술 위험 분석 (초기 FMEA)", order: 6, isRequired: true },
      { id: "ti-30", stageId: "phase1", departmentId: "dept1", content: "기획 승인회 발표자료 작성", order: 7, isRequired: true },
      // 품질팀 (6)
      { id: "ti-31", stageId: "phase1", departmentId: "dept2", content: "위험관리 계획서 수립 (ISO 14971)", order: 0, isRequired: true },
      { id: "ti-32", stageId: "phase1", departmentId: "dept2", content: "적용 규격/표준 확정 및 적합성 매트릭스", order: 1, isRequired: true },
      { id: "ti-33", stageId: "phase1", departmentId: "dept2", content: "설계 관리(Design Control) 절차 확인", order: 2, isRequired: true },
      { id: "ti-34", stageId: "phase1", departmentId: "dept2", content: "시험/검증 계획서 초안", order: 3, isRequired: true },
      { id: "ti-35", stageId: "phase1", departmentId: "dept2", content: "DHF(설계이력파일) 구성 계획", order: 4, isRequired: true },
      { id: "ti-36", stageId: "phase1", departmentId: "dept2", content: "사용적합성(Usability) 엔지니어링 계획 (IEC 62366)", order: 5, isRequired: false },
      // 영업팀 (4)
      { id: "ti-37", stageId: "phase1", departmentId: "dept3", content: "고객 요구사항 정의서", order: 0, isRequired: true },
      { id: "ti-38", stageId: "phase1", departmentId: "dept3", content: "가격 전략 수립", order: 1, isRequired: true },
      { id: "ti-39", stageId: "phase1", departmentId: "dept3", content: "마케팅 요구사항 정리 (라벨링, 포장 등)", order: 2, isRequired: false },
      { id: "ti-40", stageId: "phase1", departmentId: "dept3", content: "기획 단계 시장성 검증 결과", order: 3, isRequired: true },
      // 제조팀 (3)
      { id: "ti-41", stageId: "phase1", departmentId: "dept4", content: "제조 타당성 검토", order: 0, isRequired: true },
      { id: "ti-42", stageId: "phase1", departmentId: "dept4", content: "초기 공정 흐름도 검토", order: 1, isRequired: false },
      { id: "ti-43", stageId: "phase1", departmentId: "dept4", content: "제조 비용 사전 추정", order: 2, isRequired: false },
      // 구매팀 (2)
      { id: "ti-44", stageId: "phase1", departmentId: "dept5", content: "주요 부품/원재료 사전 조사", order: 0, isRequired: true },
      { id: "ti-45", stageId: "phase1", departmentId: "dept5", content: "공급업체 후보 리스트 작성", order: 1, isRequired: false },
      // CS팀 (1)
      { id: "ti-46", stageId: "phase1", departmentId: "dept6", content: "서비스 요구사항 정의 (A/S, 유지보수 등)", order: 0, isRequired: false },
      // 경영관리팀 (3)
      { id: "ti-47", stageId: "phase1", departmentId: "dept7", content: "프로젝트 상세 예산 확정", order: 0, isRequired: true },
      { id: "ti-48", stageId: "phase1", departmentId: "dept7", content: "자원 배분 계획 (인력/설비)", order: 1, isRequired: true },
      { id: "ti-49", stageId: "phase1", departmentId: "dept7", content: "비용/일정 검토 결과 보고", order: 2, isRequired: true },
      // 글로벌임상팀 (2)
      { id: "ti-50", stageId: "phase1", departmentId: "dept8", content: "임상 전략 수립 (임상 필요성 판단)", order: 0, isRequired: true },
      { id: "ti-51", stageId: "phase1", departmentId: "dept8", content: "임상시험 예비 계획서", order: 1, isRequired: false },
      // 디자인연구소 (4)
      { id: "ti-52", stageId: "phase1", departmentId: "dept9", content: "산업 디자인 요구사항 정의", order: 0, isRequired: true },
      { id: "ti-53", stageId: "phase1", departmentId: "dept9", content: "사용자 인터페이스(UI) 요구사항 정의", order: 1, isRequired: true },
      { id: "ti-54", stageId: "phase1", departmentId: "dept9", content: "인간공학 설계 요구사항", order: 2, isRequired: true },
      { id: "ti-55", stageId: "phase1", departmentId: "dept9", content: "초기 디자인 컨셉 개발 (2-3안)", order: 3, isRequired: false },
      // 인증팀 (4)
      { id: "ti-56", stageId: "phase1", departmentId: "dept10", content: "인허가 전략서 확정", order: 0, isRequired: true },
      { id: "ti-57", stageId: "phase1", departmentId: "dept10", content: "필수 시험 항목 목록 확정", order: 1, isRequired: true },
      { id: "ti-58", stageId: "phase1", departmentId: "dept10", content: "기술문서 작성 계획 수립", order: 2, isRequired: true },
      { id: "ti-59", stageId: "phase1", departmentId: "dept10", content: "해외 인증 로드맵 수립 (CE, FDA 등)", order: 3, isRequired: false },

      // ── Phase 2: WM (35개) ──────────────────────────────────────
      // 개발팀 (9)
      { id: "ti-60", stageId: "phase2", departmentId: "dept1", content: "eBOM (설계 자재 명세서) 작성", order: 0, isRequired: true },
      { id: "ti-61", stageId: "phase2", departmentId: "dept1", content: "상세 설계 문서 작성 (도면/3D 모델)", order: 1, isRequired: true },
      { id: "ti-62", stageId: "phase2", departmentId: "dept1", content: "시제품(Working Model) 제작", order: 2, isRequired: true },
      { id: "ti-63", stageId: "phase2", departmentId: "dept1", content: "소프트웨어 구현 및 단위 테스트 (IEC 62304)", order: 3, isRequired: true },
      { id: "ti-64", stageId: "phase2", departmentId: "dept1", content: "설계 출력(Design Output) 문서화", order: 4, isRequired: true },
      { id: "ti-65", stageId: "phase2", departmentId: "dept1", content: "설계 검증(Design Verification) 실시", order: 5, isRequired: true },
      { id: "ti-66", stageId: "phase2", departmentId: "dept1", content: "HW/SW 통합 테스트", order: 6, isRequired: true },
      { id: "ti-67", stageId: "phase2", departmentId: "dept1", content: "전기 안전 사전 시험 (IEC 60601-1)", order: 7, isRequired: false },
      { id: "ti-68", stageId: "phase2", departmentId: "dept1", content: "W/M 검증 결과 보고서", order: 8, isRequired: true },
      // 품질팀 (6)
      { id: "ti-69", stageId: "phase2", departmentId: "dept2", content: "설계 검증 시험 계획서 확정", order: 0, isRequired: true },
      { id: "ti-70", stageId: "phase2", departmentId: "dept2", content: "위험 분석 업데이트 (FMEA 정교화)", order: 1, isRequired: true },
      { id: "ti-71", stageId: "phase2", departmentId: "dept2", content: "신뢰성 시험 계획 수립", order: 2, isRequired: true },
      { id: "ti-72", stageId: "phase2", departmentId: "dept2", content: "검교정 장비/시험 설비 확보", order: 3, isRequired: true },
      { id: "ti-73", stageId: "phase2", departmentId: "dept2", content: "IQ/OQ 프로토콜 초안", order: 4, isRequired: false },
      { id: "ti-74", stageId: "phase2", departmentId: "dept2", content: "W/M 품질 검증 보고서", order: 5, isRequired: true },
      // 제조팀 (4)
      { id: "ti-75", stageId: "phase2", departmentId: "dept4", content: "시제품 제작 공정 검토", order: 0, isRequired: true },
      { id: "ti-76", stageId: "phase2", departmentId: "dept4", content: "제작 공정 흐름도(Process Flow) 작성", order: 1, isRequired: true },
      { id: "ti-77", stageId: "phase2", departmentId: "dept4", content: "시제품 조립 지원", order: 2, isRequired: true },
      { id: "ti-78", stageId: "phase2", departmentId: "dept4", content: "공정 개선점 초기 도출", order: 3, isRequired: false },
      // 구매팀 (4)
      { id: "ti-79", stageId: "phase2", departmentId: "dept5", content: "시제품 부품 조달", order: 0, isRequired: true },
      { id: "ti-80", stageId: "phase2", departmentId: "dept5", content: "핵심 공급업체 선정 및 평가", order: 1, isRequired: true },
      { id: "ti-81", stageId: "phase2", departmentId: "dept5", content: "부품 수급 리드타임 확인", order: 2, isRequired: true },
      { id: "ti-82", stageId: "phase2", departmentId: "dept5", content: "공급업체 품질 협약서(SQA) 체결", order: 3, isRequired: false },
      // 디자인연구소 (5)
      { id: "ti-83", stageId: "phase2", departmentId: "dept9", content: "외관 디자인 확정", order: 0, isRequired: true },
      { id: "ti-84", stageId: "phase2", departmentId: "dept9", content: "사용자 인터페이스(UI/UX) 설계", order: 1, isRequired: true },
      { id: "ti-85", stageId: "phase2", departmentId: "dept9", content: "목업/외관 시제품 제작", order: 2, isRequired: true },
      { id: "ti-86", stageId: "phase2", departmentId: "dept9", content: "사용성 사전 평가", order: 3, isRequired: false },
      { id: "ti-87", stageId: "phase2", departmentId: "dept9", content: "디자인 검증 결과 보고", order: 4, isRequired: true },
      // 인증팀 (4)
      { id: "ti-88", stageId: "phase2", departmentId: "dept10", content: "인증 전략 세부 수립 (각국별 요구사항 분석)", order: 0, isRequired: true },
      { id: "ti-89", stageId: "phase2", departmentId: "dept10", content: "기술문서 초안 작성 시작", order: 1, isRequired: true },
      { id: "ti-90", stageId: "phase2", departmentId: "dept10", content: "필수 시험 항목 확인 및 시험소 선정", order: 2, isRequired: true },
      { id: "ti-91", stageId: "phase2", departmentId: "dept10", content: "라벨링/IFU 초안 검토", order: 3, isRequired: false },
      // 글로벌임상팀 (2)
      { id: "ti-92", stageId: "phase2", departmentId: "dept8", content: "임상 문헌 조사", order: 0, isRequired: true },
      { id: "ti-93", stageId: "phase2", departmentId: "dept8", content: "임상시험 프로토콜 초안 작성", order: 1, isRequired: false },
      // 경영관리팀 (1)
      { id: "ti-94", stageId: "phase2", departmentId: "dept7", content: "중간 비용 실적 검토", order: 0, isRequired: false },

      // ── Phase 3: Tx (39개) ──────────────────────────────────────
      // 개발팀 (6)
      { id: "ti-95", stageId: "phase3", departmentId: "dept1", content: "설계 확인(Design Validation) 실시", order: 0, isRequired: true },
      { id: "ti-96", stageId: "phase3", departmentId: "dept1", content: "소프트웨어 검증/확인 완료 (IEC 62304)", order: 1, isRequired: true },
      { id: "ti-97", stageId: "phase3", departmentId: "dept1", content: "기술 문서 최종 검토", order: 2, isRequired: true },
      { id: "ti-98", stageId: "phase3", departmentId: "dept1", content: "설계 동결(Design Freeze)", order: 3, isRequired: true },
      { id: "ti-99", stageId: "phase3", departmentId: "dept1", content: "설계 이전(Design Transfer) 문서 작성", order: 4, isRequired: true },
      { id: "ti-100", stageId: "phase3", departmentId: "dept1", content: "성능 시험 보고서 작성", order: 5, isRequired: true },
      // 품질팀 (8)
      { id: "ti-101", stageId: "phase3", departmentId: "dept2", content: "신뢰성 시험 실시 (낙하/진동/온습도 등)", order: 0, isRequired: true },
      { id: "ti-102", stageId: "phase3", departmentId: "dept2", content: "EMC 시험 실시 (IEC 60601-1-2)", order: 1, isRequired: true },
      { id: "ti-103", stageId: "phase3", departmentId: "dept2", content: "전기 안전 시험 실시 (IEC 60601-1)", order: 2, isRequired: true },
      { id: "ti-104", stageId: "phase3", departmentId: "dept2", content: "생물학적 안전성 시험 (ISO 10993)", order: 3, isRequired: true },
      { id: "ti-105", stageId: "phase3", departmentId: "dept2", content: "사용적합성(Usability) 검증 시험 (IEC 62366)", order: 4, isRequired: true },
      { id: "ti-106", stageId: "phase3", departmentId: "dept2", content: "위험 분석 최종 보고서 (ISO 14971)", order: 5, isRequired: true },
      { id: "ti-107", stageId: "phase3", departmentId: "dept2", content: "시험 성적서 취합 및 검토", order: 6, isRequired: true },
      { id: "ti-108", stageId: "phase3", departmentId: "dept2", content: "Tx 시험 성적서 총괄 취합", order: 7, isRequired: true },
      // 제조팀 (4)
      { id: "ti-109", stageId: "phase3", departmentId: "dept4", content: "시험 생산 준비", order: 0, isRequired: true },
      { id: "ti-110", stageId: "phase3", departmentId: "dept4", content: "공정 FMEA (pFMEA) 작성", order: 1, isRequired: true },
      { id: "ti-111", stageId: "phase3", departmentId: "dept4", content: "제조 작업 지시서 초안", order: 2, isRequired: true },
      { id: "ti-112", stageId: "phase3", departmentId: "dept4", content: "시험 생산 실시 (소량)", order: 3, isRequired: false },
      // 구매팀 (3)
      { id: "ti-113", stageId: "phase3", departmentId: "dept5", content: "시험 자재 조달", order: 0, isRequired: true },
      { id: "ti-114", stageId: "phase3", departmentId: "dept5", content: "수입검사 기준서 작성", order: 1, isRequired: true },
      { id: "ti-115", stageId: "phase3", departmentId: "dept5", content: "공급업체 2차 평가", order: 2, isRequired: false },
      // 글로벌임상팀 (6)
      { id: "ti-116", stageId: "phase3", departmentId: "dept8", content: "임상시험 실시 (IRB 승인 후)", order: 0, isRequired: true },
      { id: "ti-117", stageId: "phase3", departmentId: "dept8", content: "임상 데이터 수집/분석", order: 1, isRequired: true },
      { id: "ti-118", stageId: "phase3", departmentId: "dept8", content: "임상시험 결과 보고서 작성", order: 2, isRequired: true },
      { id: "ti-119", stageId: "phase3", departmentId: "dept8", content: "임상적 평가 보고서(CER) 작성", order: 3, isRequired: true },
      { id: "ti-120", stageId: "phase3", departmentId: "dept8", content: "해외 임상 시험 진행 (대상국 해당 시)", order: 4, isRequired: false },
      { id: "ti-121", stageId: "phase3", departmentId: "dept8", content: "임상 결과 최종 보고", order: 5, isRequired: true },
      // 인증팀 (8)
      { id: "ti-122", stageId: "phase3", departmentId: "dept10", content: "MFDS 기술문서 작성 완료", order: 0, isRequired: true },
      { id: "ti-123", stageId: "phase3", departmentId: "dept10", content: "MFDS 인허가 신청 (품목인증/허가)", order: 1, isRequired: true },
      { id: "ti-124", stageId: "phase3", departmentId: "dept10", content: "GMP 적합성 평가 준비", order: 2, isRequired: true },
      { id: "ti-125", stageId: "phase3", departmentId: "dept10", content: "CE 기술문서 작성 (해당 시)", order: 3, isRequired: false },
      { id: "ti-126", stageId: "phase3", departmentId: "dept10", content: "FDA 510(k)/PMA 서류 준비 (해당 시)", order: 4, isRequired: false },
      { id: "ti-127", stageId: "phase3", departmentId: "dept10", content: "라벨링/IFU 최종본 작성", order: 5, isRequired: true },
      { id: "ti-128", stageId: "phase3", departmentId: "dept10", content: "적합성 선언서 작성", order: 6, isRequired: true },
      { id: "ti-129", stageId: "phase3", departmentId: "dept10", content: "인증 시험 결과 보고서", order: 7, isRequired: true },
      // 디자인연구소 (2)
      { id: "ti-130", stageId: "phase3", departmentId: "dept9", content: "최종 외관 디자인 확정 (양산용)", order: 0, isRequired: true },
      { id: "ti-131", stageId: "phase3", departmentId: "dept9", content: "포장 디자인 개발", order: 1, isRequired: true },
      // 영업팀 (2)
      { id: "ti-132", stageId: "phase3", departmentId: "dept3", content: "제품 카탈로그/브로슈어 초안", order: 0, isRequired: false },
      { id: "ti-133", stageId: "phase3", departmentId: "dept3", content: "판매 채널 사전 확보", order: 1, isRequired: false },

      // ── Phase 4: MSG (31개) ──────────────────────────────────────
      // 개발팀 (4)
      { id: "ti-134", stageId: "phase4", departmentId: "dept1", content: "양산 도면 확정", order: 0, isRequired: true },
      { id: "ti-135", stageId: "phase4", departmentId: "dept1", content: "mBOM (제조 자재 명세서) 확정", order: 1, isRequired: true },
      { id: "ti-136", stageId: "phase4", departmentId: "dept1", content: "설계 이전(Design Transfer) 완료 확인", order: 2, isRequired: true },
      { id: "ti-137", stageId: "phase4", departmentId: "dept1", content: "양산용 소프트웨어 릴리스", order: 3, isRequired: true },
      // 품질팀 (7)
      { id: "ti-138", stageId: "phase4", departmentId: "dept2", content: "공정 밸리데이션 (IQ/OQ/PQ) 실시", order: 0, isRequired: true },
      { id: "ti-139", stageId: "phase4", departmentId: "dept2", content: "최종 품질 검증 (출하 검사 기준 확정)", order: 1, isRequired: true },
      { id: "ti-140", stageId: "phase4", departmentId: "dept2", content: "양산 품질 기준서 작성", order: 2, isRequired: true },
      { id: "ti-141", stageId: "phase4", departmentId: "dept2", content: "검사 장비 밸리데이션", order: 3, isRequired: true },
      { id: "ti-142", stageId: "phase4", departmentId: "dept2", content: "시생산 제품 최종 검사", order: 4, isRequired: true },
      { id: "ti-143", stageId: "phase4", departmentId: "dept2", content: "DHF(설계이력파일) 최종 정리", order: 5, isRequired: true },
      { id: "ti-144", stageId: "phase4", departmentId: "dept2", content: "양산 전 최종 품질 판정 보고", order: 6, isRequired: true },
      // 제조팀 (8)
      { id: "ti-145", stageId: "phase4", departmentId: "dept4", content: "양산 공정 계획 수립", order: 0, isRequired: true },
      { id: "ti-146", stageId: "phase4", departmentId: "dept4", content: "시생산(Pilot Run) 실시", order: 1, isRequired: true },
      { id: "ti-147", stageId: "phase4", departmentId: "dept4", content: "양산 라인 셋업", order: 2, isRequired: true },
      { id: "ti-148", stageId: "phase4", departmentId: "dept4", content: "작업 표준서(SOP) 확정", order: 3, isRequired: true },
      { id: "ti-149", stageId: "phase4", departmentId: "dept4", content: "시생산 결과 분석 및 개선", order: 4, isRequired: true },
      { id: "ti-150", stageId: "phase4", departmentId: "dept4", content: "특수공정 밸리데이션", order: 5, isRequired: false },
      { id: "ti-151", stageId: "phase4", departmentId: "dept4", content: "양산 Capacity/Takt Time 확인", order: 6, isRequired: true },
      { id: "ti-152", stageId: "phase4", departmentId: "dept4", content: "시생산 결과 최종 보고", order: 7, isRequired: true },
      // 구매팀 (4)
      { id: "ti-153", stageId: "phase4", departmentId: "dept5", content: "양산 자재 조달 계획 확정", order: 0, isRequired: true },
      { id: "ti-154", stageId: "phase4", departmentId: "dept5", content: "양산용 공급업체 계약 확정", order: 1, isRequired: true },
      { id: "ti-155", stageId: "phase4", departmentId: "dept5", content: "안전 재고 수준 설정", order: 2, isRequired: true },
      { id: "ti-156", stageId: "phase4", departmentId: "dept5", content: "수입검사 체계 확정", order: 3, isRequired: true },
      // 인증팀 (4)
      { id: "ti-157", stageId: "phase4", departmentId: "dept10", content: "인허가 승인 확인", order: 0, isRequired: true },
      { id: "ti-158", stageId: "phase4", departmentId: "dept10", content: "GMP 적합성 인정 확인", order: 1, isRequired: true },
      { id: "ti-159", stageId: "phase4", departmentId: "dept10", content: "제조소 변경 시 변경 신고 (해당 시)", order: 2, isRequired: false },
      { id: "ti-160", stageId: "phase4", departmentId: "dept10", content: "인허가 현황 최종 보고", order: 3, isRequired: true },
      // 디자인연구소 (2 → 3 with IFU)
      { id: "ti-161", stageId: "phase4", departmentId: "dept9", content: "양산용 포장/라벨 디자인 확정", order: 0, isRequired: true },
      { id: "ti-162", stageId: "phase4", departmentId: "dept9", content: "사용 설명서(IFU) 최종 디자인 확정", order: 1, isRequired: true },
      // 경영관리팀 (2)
      { id: "ti-163", stageId: "phase4", departmentId: "dept7", content: "양산 원가 산정 확정", order: 0, isRequired: true },
      { id: "ti-164", stageId: "phase4", departmentId: "dept7", content: "출시 일정 확정", order: 1, isRequired: true },

      // ── Phase 5: 양산/이관 (29개) ──────────────────────────────────────
      // 개발팀 (2)
      { id: "ti-165", stageId: "phase5", departmentId: "dept1", content: "양산 초기 기술 지원", order: 0, isRequired: true },
      { id: "ti-166", stageId: "phase5", departmentId: "dept1", content: "설계 이력 파일(DHF) 최종 이관", order: 1, isRequired: true },
      // 품질팀 (4)
      { id: "ti-167", stageId: "phase5", departmentId: "dept2", content: "초도품 검사 실시 (FAI)", order: 0, isRequired: true },
      { id: "ti-168", stageId: "phase5", departmentId: "dept2", content: "양산 초기 불량률 모니터링", order: 1, isRequired: true },
      { id: "ti-169", stageId: "phase5", departmentId: "dept2", content: "출하 검사 프로세스 가동", order: 2, isRequired: true },
      { id: "ti-170", stageId: "phase5", departmentId: "dept2", content: "시판 후 감시(PMS) 계획 수립", order: 3, isRequired: true },
      // 영업팀 (5)
      { id: "ti-171", stageId: "phase5", departmentId: "dept3", content: "판매 개시 준비 완료 확인", order: 0, isRequired: true },
      { id: "ti-172", stageId: "phase5", departmentId: "dept3", content: "영업 교육 실시", order: 1, isRequired: true },
      { id: "ti-173", stageId: "phase5", departmentId: "dept3", content: "제품 카탈로그/브로슈어 최종본", order: 2, isRequired: true },
      { id: "ti-174", stageId: "phase5", departmentId: "dept3", content: "거래처 등록/공급 계약", order: 3, isRequired: true },
      { id: "ti-175", stageId: "phase5", departmentId: "dept3", content: "온라인 마케팅 자료 게시", order: 4, isRequired: false },
      // 제조팀 (4)
      { id: "ti-176", stageId: "phase5", departmentId: "dept4", content: "양산 가동 개시", order: 0, isRequired: true },
      { id: "ti-177", stageId: "phase5", departmentId: "dept4", content: "양산 안정화 (수율 확인)", order: 1, isRequired: true },
      { id: "ti-178", stageId: "phase5", departmentId: "dept4", content: "양산 SOP 최종 확정", order: 2, isRequired: true },
      { id: "ti-179", stageId: "phase5", departmentId: "dept4", content: "초기 공정 능력(Cpk) 확인", order: 3, isRequired: true },
      // 구매팀 (2)
      { id: "ti-180", stageId: "phase5", departmentId: "dept5", content: "양산 자재 안정 공급 확인", order: 0, isRequired: true },
      { id: "ti-181", stageId: "phase5", departmentId: "dept5", content: "납품 일정 관리 체계 가동", order: 1, isRequired: true },
      // CS팀 (4)
      { id: "ti-182", stageId: "phase5", departmentId: "dept6", content: "A/S 체계 구축", order: 0, isRequired: true },
      { id: "ti-183", stageId: "phase5", departmentId: "dept6", content: "고객 상담 매뉴얼 작성", order: 1, isRequired: true },
      { id: "ti-184", stageId: "phase5", departmentId: "dept6", content: "보수용 부품 재고 확보", order: 2, isRequired: true },
      { id: "ti-185", stageId: "phase5", departmentId: "dept6", content: "CS 담당자 교육 실시", order: 3, isRequired: true },
      // 경영관리팀 (3)
      { id: "ti-186", stageId: "phase5", departmentId: "dept7", content: "최종 원가 확정 및 손익 분석", order: 0, isRequired: true },
      { id: "ti-187", stageId: "phase5", departmentId: "dept7", content: "프로젝트 종료 보고서", order: 1, isRequired: true },
      { id: "ti-188", stageId: "phase5", departmentId: "dept7", content: "프로젝트 Lessons Learned 정리", order: 2, isRequired: false },
      // 글로벌임상팀 (1)
      { id: "ti-189", stageId: "phase5", departmentId: "dept8", content: "시판 후 임상 추적(PMCF) 계획 수립 (해당 시)", order: 0, isRequired: false },
      // 인증팀 (4)
      { id: "ti-190", stageId: "phase5", departmentId: "dept10", content: "최종 인허가 완료 확인서", order: 0, isRequired: true },
      { id: "ti-191", stageId: "phase5", departmentId: "dept10", content: "시판 후 안전성 보고 체계 구축", order: 1, isRequired: true },
      { id: "ti-192", stageId: "phase5", departmentId: "dept10", content: "해외 인허가 완료 현황 정리", order: 2, isRequired: false },
      { id: "ti-193", stageId: "phase5", departmentId: "dept10", content: "정기 안전성 보고 계획 확정", order: 3, isRequired: false },
    ];
    for (const ti of tItems) {
      batch.set(doc(db, "templateItems", ti.id), { ...ti, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() });
    }

    await batch.commit();
    console.log("✅ Firestore 초기 데이터 시드 완료");
    return true;
  } catch (error) {
    console.error("❌ Firestore 시드 오류:", error);
    throw error;
  }
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserByName(name) {
  const q = query(collection(db, "users"), where("name", "==", name));
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

export async function completeTask(taskId) {
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "completed",
    completedDate: Timestamp.now(),
    approvalStatus: "pending",
  });
}

export async function approveTask(taskId, reviewerName) {
  await updateDoc(doc(db, "checklistItems", taskId), {
    approvedBy: reviewerName,
    approvedAt: Timestamp.now(),
    approvalStatus: "approved",
  });
}

export async function rejectTask(taskId, reviewerName, reason) {
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "rejected",
    approvalStatus: "rejected",
    rejectedBy: reviewerName,
    rejectedAt: Timestamp.now(),
    rejectionReason: reason,
  });
}

export async function restartTask(taskId) {
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "in_progress",
    approvalStatus: deleteField(),
    rejectedBy: deleteField(),
    rejectedAt: deleteField(),
    rejectionReason: deleteField(),
  });
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
}

// ─── Change Requests ────────────────────────────────────────────────────────

export function subscribeChangeRequests(projectId, callback) {
  const q = query(collection(db, "changeRequests"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => docToChangeRequest(d.id, d.data())));
  });
}

export async function createChangeRequest(data) {
  const ref = await addDoc(collection(db, "changeRequests"), {
    ...data,
    requestedAt: Timestamp.fromDate(data.requestedAt),
  });
  return ref.id;
}

export async function updateChangeRequest(id, data) {
  const payload = { ...data };
  if (data.requestedAt) payload.requestedAt = Timestamp.fromDate(data.requestedAt);
  await updateDoc(doc(db, "changeRequests", id), payload);
}

// ─── Notifications ──────────────────────────────────────────────────────────

export function subscribeNotifications(userId, callback) {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs
      .map(d => docToNotification(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(notifs);
  });
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function createNotification(data) {
  await addDoc(collection(db, "notifications"), {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
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

export async function addTemplateStage(data) {
  // data: { name, workStageName, gateStageName, createdBy }
  const stagesSnap = await getDocs(collection(db, "templateStages"));
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

export async function addTemplateDepartment(data) {
  const deptsSnap = await getDocs(collection(db, "templateDepartments"));
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
