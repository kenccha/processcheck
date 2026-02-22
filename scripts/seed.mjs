// Firestore 시드 스크립트 - 샘플 데이터 투입
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
  authDomain: "processsss-appp.firebaseapp.com",
  projectId: "processsss-appp",
  storageBucket: "processsss-appp.firebasestorage.app",
  messagingSenderId: "1041230235574",
  appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 날짜 헬퍼
const now = new Date();
const day = (offset) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  return Timestamp.fromDate(d);
};
const ts = (dateStr) => Timestamp.fromDate(new Date(dateStr));

// ─── 사용자 ─────────────────────────────────
const users = [
  { id: "user1", name: "김철수", email: "chulsoo@company.com", role: "worker", department: "개발팀" },
  { id: "user2", name: "이영희", email: "younghee@company.com", role: "manager", department: "개발팀" },
  { id: "user3", name: "박민수", email: "minsu@company.com", role: "pm", department: "경영관리팀" },
  { id: "user4", name: "최지영", email: "jiyoung@company.com", role: "worker", department: "품질팀" },
  { id: "user5", name: "정수현", email: "soohyun@company.com", role: "worker", department: "제조팀" },
  { id: "user6", name: "강민지", email: "minji@company.com", role: "manager", department: "품질팀" },
  { id: "user7", name: "홍길동", email: "gildong@company.com", role: "worker", department: "디자인연구소" },
];

// ─── 프로젝트 ────────────────────────────────
const projects = [
  {
    id: "proj1", name: "신규 체성분 분석기 개발", productType: "체성분 분석기",
    projectType: "신규개발",
    status: "active", progress: 35,
    startDate: ts("2026-01-01"), endDate: ts("2026-08-31"),
    pm: "박민수", riskLevel: "yellow", currentStage: "WM제작",
  },
  {
    id: "proj2", name: "가정용 혈압계 업그레이드", productType: "혈압계",
    projectType: "신규개발",
    status: "active", progress: 65,
    startDate: ts("2025-10-01"), endDate: ts("2026-05-31"),
    pm: "박민수", riskLevel: "green", currentStage: "Tx단계",
  },
  {
    id: "proj3", name: "FRA 장비 신모델", productType: "FRA",
    projectType: "신규개발",
    status: "active", progress: 15,
    startDate: ts("2026-02-01"), endDate: ts("2026-12-31"),
    pm: "박민수", riskLevel: "green", currentStage: "기획검토",
  },
  {
    id: "proj4", name: "신장계 긴급 설계 변경", productType: "신장계",
    projectType: "설계변경", changeScale: "major",
    status: "active", progress: 85,
    startDate: ts("2025-11-01"), endDate: ts("2026-03-31"),
    pm: "박민수", riskLevel: "red", currentStage: "MSG승인회",
  },
  {
    id: "proj5", name: "이전 프로젝트 (완료)", productType: "혈압계",
    projectType: "신규개발",
    status: "completed", progress: 100,
    startDate: ts("2025-06-01"), endDate: ts("2025-12-31"),
    pm: "박민수", riskLevel: "green", currentStage: "영업이관",
  },
  // 설계변경 프로젝트
  {
    id: "proj6", name: "센서 교체 (혈압계)", productType: "혈압계",
    projectType: "설계변경", changeScale: "minor",
    status: "completed", progress: 100,
    startDate: ts("2026-01-10"), endDate: ts("2026-01-25"),
    pm: "이영희", riskLevel: "green", currentStage: "영업이관",
  },
  {
    id: "proj7", name: "배터리 규격 변경", productType: "체성분 분석기",
    projectType: "설계변경", changeScale: "major",
    status: "active", progress: 20,
    startDate: ts("2026-01-15"), endDate: ts("2026-06-30"),
    pm: "박민수", riskLevel: "yellow", currentStage: "발의검토",
  },
  {
    id: "proj8", name: "LCD 크기 조정", productType: "혈압계",
    projectType: "설계변경", changeScale: "medium",
    status: "active", progress: 40,
    startDate: ts("2026-02-01"), endDate: ts("2026-04-30"),
    pm: "이영희", riskLevel: "green", currentStage: "기획검토",
  },
  {
    id: "proj9", name: "펌웨어 버전 업데이트", productType: "FRA",
    projectType: "설계변경", changeScale: "minor",
    status: "active", progress: 50,
    startDate: ts("2026-02-10"), endDate: ts("2026-03-15"),
    pm: "이영희", riskLevel: "green", currentStage: "발의검토",
  },
  {
    id: "proj10", name: "외관 재질 변경", productType: "신장계",
    projectType: "설계변경", changeScale: "medium",
    status: "completed", progress: 100,
    startDate: ts("2025-12-01"), endDate: ts("2026-02-10"),
    pm: "박민수", riskLevel: "green", currentStage: "영업이관",
  },
];

// ─── 체크리스트 항목 (태스크) ──────────────────
const checklistItems = [
  // 김철수의 오늘 할 일
  {
    id: "task1", projectId: "proj1", stage: "WM제작", department: "개발팀",
    title: "스펙 정리 및 분석 완료", description: "제품 스펙을 최종 확정하고 기술 문서를 작성합니다.",
    assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: day(1),
  },
  {
    id: "task2", projectId: "proj1", stage: "WM제작", department: "개발팀",
    title: "eBOM 작성", description: "설계 자재 명세서를 작성합니다.",
    assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: day(0),
  },
  {
    id: "task3", projectId: "proj2", stage: "Tx단계", department: "개발팀",
    title: "기술 문서 검토", description: "최종 기술 문서를 검토하고 승인합니다.",
    assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: day(3),
  },
  // 김철수의 승인 대기 작업
  {
    id: "task4", projectId: "proj1", stage: "기획검토", department: "개발팀",
    title: "NABC 분석 완료", description: "Need, Approach, Benefit, Competition 분석",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-7), completedDate: day(-1),
  },
  {
    id: "task5", projectId: "proj2", stage: "Tx단계", department: "개발팀",
    title: "성능 테스트 보고서 작성", description: "성능 테스트 결과를 정리하고 보고서를 작성합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(2), completedDate: day(-1),
  },
  // 최지영의 작업 (품질팀)
  {
    id: "task6", projectId: "proj1", stage: "WM제작", department: "품질팀",
    title: "신뢰성 테스트 계획 수립", description: "제품의 신뢰성 테스트 계획을 수립합니다.",
    assignee: "최지영", reviewer: "강민지", status: "in_progress", dueDate: day(5),
  },
  {
    id: "task7", projectId: "proj2", stage: "Tx단계", department: "품질팀",
    title: "낙하 테스트 실시", description: "제품 낙하 테스트를 실시하고 결과를 분석합니다.",
    assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: day(1),
  },
  // 정수현의 작업 (제조팀)
  {
    id: "task8", projectId: "proj4", stage: "MSG승인회", department: "제조팀",
    title: "양산 라인 셋업", description: "양산을 위한 제조 라인 준비 및 테스트",
    assignee: "정수현", reviewer: "이영희", status: "in_progress", dueDate: day(0),
  },
  {
    id: "task9", projectId: "proj4", stage: "MasterGatePilot", department: "제조팀",
    title: "시생산 결과 분석", description: "시생산 결과를 분석하고 개선사항을 도출합니다.",
    assignee: "정수현", reviewer: "이영희",
    status: "completed", dueDate: day(-7), completedDate: day(-2),
  },
  // 홍길동의 작업 (디자인연구소)
  {
    id: "task10", projectId: "proj2", stage: "Tx단계", department: "디자인연구소",
    title: "UI/UX 디자인 최종 검토", description: "사용자 인터페이스 및 경험 디자인 최종 검토",
    assignee: "홍길동", reviewer: "이영희",
    status: "completed", dueDate: day(-7), completedDate: day(-3),
  },
  // 기타 부서 작업들
  {
    id: "task11", projectId: "proj1", stage: "WM제작", department: "구매팀",
    title: "부품 공급업체 선정", description: "주요 부품의 공급업체를 선정하고 계약합니다.",
    assignee: "박영수", reviewer: "김부장", status: "pending", dueDate: day(7),
  },
  {
    id: "task12", projectId: "proj3", stage: "기획검토", department: "영업팀",
    title: "시장 조사 및 분석", description: "목표 시장을 조사하고 경쟁사를 분석합니다.",
    assignee: "이상민", reviewer: "최과장", status: "in_progress", dueDate: day(5),
  },
  {
    id: "task13", projectId: "proj1", stage: "WM제작", department: "인증팀",
    title: "인증 전략 수립", description: "각국 인증 요구사항을 분석하고 전략을 수립합니다.",
    assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: day(7),
  },
  // 지연된 작업
  {
    id: "task14", projectId: "proj4", stage: "MSG승인회", department: "개발팀",
    title: "최종 도면 승인", description: "양산을 위한 최종 도면을 검토하고 승인합니다.",
    assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: day(-1),
  },
  // proj1 추가 작업들 (12단계 커버)
  {
    id: "task15", projectId: "proj1", stage: "발의검토", department: "개발팀",
    title: "제품 컨셉 정의", description: "신제품 컨셉과 목표를 정의합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-7), completedDate: day(-7),
  },
  {
    id: "task16", projectId: "proj1", stage: "발의검토", department: "품질팀",
    title: "품질 목표 수립", description: "제품의 품질 목표와 기준을 수립합니다.",
    assignee: "최지영", reviewer: "강민지",
    status: "completed", dueDate: day(-7), completedDate: day(-7),
  },
  {
    id: "task17", projectId: "proj1", stage: "발의검토", department: "영업팀",
    title: "시장 기회 분석", description: "목표 시장과 경쟁 환경을 분석합니다.",
    assignee: "이상민", reviewer: "최과장",
    status: "completed", dueDate: day(-7), completedDate: day(-7),
  },
  {
    id: "task18", projectId: "proj1", stage: "발의검토", department: "경영관리팀",
    title: "사업성 검토", description: "ROI 및 수익성을 분석합니다.",
    assignee: "정재무", reviewer: "김부장",
    status: "completed", dueDate: day(-7), completedDate: day(-7),
  },
  {
    id: "task19", projectId: "proj1", stage: "기획검토", department: "영업팀",
    title: "가격 전략 수립", description: "제품 가격 전략을 수립합니다.",
    assignee: "이상민", reviewer: "최과장",
    status: "completed", dueDate: day(-7), completedDate: day(-7),
  },
  {
    id: "task20", projectId: "proj1", stage: "WM제작", department: "개발팀",
    title: "시제품 제작", description: "1차 시제품을 제작합니다.",
    assignee: "박영수", reviewer: "이영희", status: "pending", dueDate: day(7),
  },
  {
    id: "task21", projectId: "proj1", stage: "WM제작", department: "제조팀",
    title: "제작 공정 검토", description: "시제품 제작 공정을 검토합니다.",
    assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: day(7),
  },
  {
    id: "task22", projectId: "proj1", stage: "Tx단계", department: "품질팀",
    title: "내구성 테스트", description: "제품 내구성 테스트를 실시합니다.",
    assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: day(7),
  },
  {
    id: "task23", projectId: "proj1", stage: "Tx단계", department: "디자인연구소",
    title: "외관 디자인 확정", description: "제품 외관 디자인을 확정합니다.",
    assignee: "홍길동", reviewer: "박디자인", status: "pending", dueDate: day(7),
  },
  {
    id: "task24", projectId: "proj1", stage: "MasterGatePilot", department: "제조팀",
    title: "양산 공정 계획", description: "양산을 위한 제조 공정을 계획합니다.",
    assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: day(7),
  },
  {
    id: "task25", projectId: "proj1", stage: "MasterGatePilot", department: "구매팀",
    title: "자재 조달 계획", description: "양산 자재 조달 계획을 수립합니다.",
    assignee: "박구매", reviewer: "최구매", status: "pending", dueDate: day(7),
  },
  {
    id: "task26", projectId: "proj1", stage: "MasterGatePilot", department: "제조팀",
    title: "시생산 실시", description: "시생산을 실시하고 문제점을 파악합니다.",
    assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: day(7),
  },
  {
    id: "task27", projectId: "proj1", stage: "MSG승인회", department: "품질팀",
    title: "최종 품질 검증", description: "양산 전 최종 품질을 검증합니다.",
    assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: day(7),
  },
  {
    id: "task28", projectId: "proj1", stage: "양산", department: "제조팀",
    title: "양산 가동", description: "본격적인 양산을 시작합니다.",
    assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: day(7),
  },
  {
    id: "task29", projectId: "proj1", stage: "영업이관", department: "영업팀",
    title: "판매 시작 준비", description: "제품 판매를 위한 준비를 합니다.",
    assignee: "이상민", reviewer: "최과장", status: "pending", dueDate: day(7),
  },
  {
    id: "task30", projectId: "proj1", stage: "영업이관", department: "CS팀",
    title: "A/S 체계 구축", description: "고객 서비스 및 A/S 체계를 구축합니다.",
    assignee: "김서비스", reviewer: "박CS", status: "pending", dueDate: day(7),
  },
  {
    id: "task31", projectId: "proj1", stage: "WM제작", department: "인증팀",
    title: "인증 요구사항 검토", description: "각국 인증 요구사항을 검토합니다.",
    assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: day(5),
  },
  // Gate stage tasks
  {
    id: "task32", projectId: "proj1", stage: "발의승인", department: "개발팀",
    title: "발의 심사 자료 준비", description: "발의 승인을 위한 심사 자료를 준비합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-30), completedDate: day(-28), approvalStatus: "approved",
  },
  {
    id: "task33", projectId: "proj1", stage: "발의승인", department: "품질팀",
    title: "발의 품질 기준 검토", description: "발의 단계 품질 기준을 검토합니다.",
    assignee: "최지영", reviewer: "강민지",
    status: "completed", dueDate: day(-30), completedDate: day(-28), approvalStatus: "approved",
  },
  {
    id: "task34", projectId: "proj1", stage: "기획승인", department: "개발팀",
    title: "기획 발표 자료 작성", description: "기획 승인회 발표 자료를 작성합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-20), completedDate: day(-18), approvalStatus: "approved",
  },
  {
    id: "task35", projectId: "proj1", stage: "기획승인", department: "영업팀",
    title: "기획 시장성 검증", description: "기획 단계 시장성을 검증합니다.",
    assignee: "이상민", reviewer: "최과장",
    status: "completed", dueDate: day(-20), completedDate: day(-18), approvalStatus: "approved",
  },
  {
    id: "task36", projectId: "proj1", stage: "WM승인회", department: "개발팀",
    title: "W/M 검증 결과 보고", description: "W/M 검증 결과를 보고합니다.",
    assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: day(14),
  },
  {
    id: "task37", projectId: "proj1", stage: "WM승인회", department: "품질팀",
    title: "W/M 품질 검증", description: "W/M 단계 품질을 검증합니다.",
    assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: day(14),
  },
  {
    id: "task38", projectId: "proj1", stage: "Tx승인회", department: "품질팀",
    title: "Tx 시험 성적서 취합", description: "Tx 단계 시험 성적서를 취합합니다.",
    assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: day(30),
  },
  {
    id: "task39", projectId: "proj1", stage: "Tx승인회", department: "인증팀",
    title: "인증 시험 보고서", description: "인증 시험 보고서를 작성합니다.",
    assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: day(30),
  },
  // Department coverage tasks
  {
    id: "task40", projectId: "proj1", stage: "WM제작", department: "글로벌임상팀",
    title: "해외 임상 계획 수립", description: "해외 임상 시험 계획을 수립합니다.",
    assignee: "이글로벌", reviewer: "김임상", status: "pending", dueDate: day(10),
  },
  {
    id: "task41", projectId: "proj1", stage: "기획검토", department: "CS팀",
    title: "서비스 요구사항 정의", description: "고객 서비스 요구사항을 정의합니다.",
    assignee: "김서비스", reviewer: "박CS",
    status: "completed", dueDate: day(-14), completedDate: day(-12),
  },
  {
    id: "task42", projectId: "proj2", stage: "Tx단계", department: "제조팀",
    title: "시험 생산 준비", description: "시험 생산 라인을 준비합니다.",
    assignee: "정수현", reviewer: "김제조", status: "in_progress", dueDate: day(3),
  },
  {
    id: "task43", projectId: "proj2", stage: "Tx단계", department: "구매팀",
    title: "시험 자재 조달", description: "시험 생산에 필요한 자재를 조달합니다.",
    assignee: "박구매", reviewer: "최구매", status: "pending", dueDate: day(5),
  },
  {
    id: "task44", projectId: "proj3", stage: "기획검토", department: "개발팀",
    title: "기술 타당성 검토", description: "FRA 신모델의 기술 타당성을 검토합니다.",
    assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: day(5),
  },
  {
    id: "task45", projectId: "proj3", stage: "기획검토", department: "제조팀",
    title: "제조 타당성 검토", description: "FRA 신모델의 제조 타당성을 검토합니다.",
    assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: day(7),
  },
  {
    id: "task46", projectId: "proj4", stage: "MasterGatePilot", department: "개발팀",
    title: "양산 도면 확정", description: "양산을 위한 최종 도면을 확정합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-7), completedDate: day(-5),
  },
  {
    id: "task47", projectId: "proj4", stage: "MasterGatePilot", department: "품질팀",
    title: "양산 품질 기준 설정", description: "양산 품질 기준을 설정합니다.",
    assignee: "최지영", reviewer: "강민지",
    status: "completed", dueDate: day(-7), completedDate: day(-5),
  },
  // 설계변경 프로젝트 tasks
  {
    id: "task48", projectId: "proj6", stage: "발의검토", department: "개발팀",
    title: "센서 호환성 확인", description: "교체 센서의 호환성을 확인합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-25), completedDate: day(-24),
  },
  {
    id: "task49", projectId: "proj6", stage: "발의승인", department: "품질팀",
    title: "품질 영향 검토", description: "센서 교체에 따른 품질 영향을 검토합니다.",
    assignee: "최지영", reviewer: "강민지",
    status: "completed", dueDate: day(-23), completedDate: day(-22), approvalStatus: "approved",
  },
  {
    id: "task50", projectId: "proj7", stage: "발의검토", department: "개발팀",
    title: "변경 사유서 작성", description: "배터리 규격 변경 사유서를 작성합니다.",
    assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: day(3),
  },
  {
    id: "task51", projectId: "proj7", stage: "발의검토", department: "제조팀",
    title: "제조 영향 분석", description: "배터리 변경에 따른 제조 영향을 분석합니다.",
    assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: day(7),
  },
  {
    id: "task52", projectId: "proj8", stage: "기획검토", department: "개발팀",
    title: "LCD 규격 변경서", description: "LCD 크기 조정 규격 변경서를 작성합니다.",
    assignee: "김철수", reviewer: "이영희",
    status: "completed", dueDate: day(-10), completedDate: day(-8),
  },
  {
    id: "task53", projectId: "proj8", stage: "기획검토", department: "품질팀",
    title: "표시부 시인성 검증", description: "변경된 LCD의 시인성을 검증합니다.",
    assignee: "최지영", reviewer: "강민지", status: "in_progress", dueDate: day(3),
  },
  {
    id: "task54", projectId: "proj8", stage: "기획승인", department: "경영관리팀",
    title: "비용 영향 검토", description: "LCD 변경에 따른 비용 영향을 검토합니다.",
    assignee: "정재무", reviewer: "김부장", status: "pending", dueDate: day(10),
  },
  {
    id: "task55", projectId: "proj9", stage: "발의검토", department: "개발팀",
    title: "펌웨어 변경 내역서", description: "펌웨어 변경 내역서를 작성합니다.",
    assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: day(2),
  },
  {
    id: "task56", projectId: "proj10", stage: "기획검토", department: "디자인연구소",
    title: "외관 디자인 변경", description: "외관 재질에 맞는 디자인을 변경합니다.",
    assignee: "홍길동", reviewer: "박디자인",
    status: "completed", dueDate: day(-20), completedDate: day(-18),
  },
  {
    id: "task57", projectId: "proj10", stage: "기획승인", department: "품질팀",
    title: "재질 안전성 검증", description: "변경된 재질의 안전성을 검증합니다.",
    assignee: "최지영", reviewer: "강민지",
    status: "completed", dueDate: day(-15), completedDate: day(-14), approvalStatus: "approved",
  },
  // proj5 완료 tasks
  {
    id: "task58", projectId: "proj5", stage: "영업이관", department: "영업팀",
    title: "판매 채널 확보", description: "판매 채널을 확보합니다.",
    assignee: "이상민", reviewer: "최과장",
    status: "completed", dueDate: day(-60), completedDate: day(-55),
  },
  {
    id: "task59", projectId: "proj5", stage: "양산", department: "제조팀",
    title: "양산 안정화", description: "양산 프로세스를 안정화합니다.",
    assignee: "정수현", reviewer: "김제조",
    status: "completed", dueDate: day(-70), completedDate: day(-65),
  },
];

// ─── 설계 변경 ───────────────────────────────
const changeRequests = [
  {
    id: "change1", projectId: "proj4",
    title: "배터리 규격 변경", description: "기존 AA 배터리에서 리튬이온 배터리로 변경",
    requestedBy: "영업팀", requestedAt: ts("2026-01-27"),
    affectedDepartments: ["개발팀", "제조팀", "구매팀", "인증팀"],
    scale: "major", status: "in_review",
    readBy: { "개발팀": true, "제조팀": true, "구매팀": false, "인증팀": false },
  },
  {
    id: "change2", projectId: "proj1",
    title: "LCD 화면 크기 조정", description: "3.5인치에서 4.0인치로 확대",
    requestedBy: "품질팀", requestedAt: ts("2026-01-25"),
    affectedDepartments: ["개발팀", "디자인연구소", "제조팀"],
    scale: "medium", status: "approved",
    readBy: { "개발팀": true, "디자인연구소": true, "제조팀": true },
  },
];

// ─── 알림 ────────────────────────────────────
const hour = (h) => {
  const d = new Date(now);
  d.setHours(d.getHours() - h);
  return Timestamp.fromDate(d);
};

const notifications = [
  {
    id: "notif1", userId: "user1", type: "deadline_approaching",
    title: "⚠️ 마감일이 오늘입니다",
    message: "[신규 체성분 분석기] eBOM 작성 - 오늘 마감",
    link: "/task?projectId=proj1&taskId=task2", read: false, createdAt: hour(1),
  },
  {
    id: "notif2", userId: "user1", type: "task_assigned",
    title: "새 작업이 배정되었습니다",
    message: "[신규 체성분 분석기] 스펙 정리 및 분석 완료",
    link: "/task?projectId=proj1&taskId=task1", read: false, createdAt: hour(2),
  },
  {
    id: "notif3", userId: "user1", type: "deadline_approaching",
    title: "마감일이 1일 남았습니다",
    message: "[신장계] 최종 도면 승인 - 이미 마감일 지남 (긴급)",
    link: "/task?projectId=proj4&taskId=task14", read: false, createdAt: hour(3),
  },
  {
    id: "notif4", userId: "user1", type: "change_request",
    title: "설계 변경 요청 확인 필요",
    message: "[신장계] 배터리 규격 변경 - 영향도 검토 요청",
    link: "/project?id=proj4", read: true, createdAt: hour(24),
  },
  {
    id: "notif5", userId: "user1", type: "approval_request",
    title: "승인 완료",
    message: "이영희님이 NABC 분석 완료 작업을 승인했습니다",
    link: "/task?projectId=proj1&taskId=task4", read: true, createdAt: hour(48),
  },
  {
    id: "notif6", userId: "user4", type: "deadline_approaching",
    title: "마감일이 내일입니다",
    message: "[가정용 혈압계] 낙하 테스트 실시 - 내일 마감",
    link: "/task?projectId=proj2&taskId=task7", read: false, createdAt: hour(2),
  },
  {
    id: "notif7", userId: "user5", type: "deadline_approaching",
    title: "⚠️ 마감일이 오늘입니다",
    message: "[신장계] 양산 라인 셋업 - 오늘 마감",
    link: "/task?projectId=proj4&taskId=task8", read: false, createdAt: hour(1),
  },
  // PM(박민수) 알림 추가
  {
    id: "notif8", userId: "user3", type: "approval_request",
    title: "승인 요청",
    message: "[신규 체성분 분석기] 김철수님이 NABC 분석을 완료했습니다. 검토 필요.",
    link: "/task?projectId=proj1&taskId=task4", read: false, createdAt: hour(1),
  },
  {
    id: "notif9", userId: "user3", type: "deadline_approaching",
    title: "⚠️ 프로젝트 위험 감지",
    message: "[신장계 긴급 설계 변경] 마감일 임박 - 위험도 상승",
    link: "/project?id=proj4", read: false, createdAt: hour(2),
  },
  {
    id: "notif10", userId: "user3", type: "change_request",
    title: "설계 변경 요청 접수",
    message: "[신장계] 배터리 규격 변경 요청이 접수되었습니다. 검토 필요.",
    link: "/project?id=proj4", read: true, createdAt: hour(24),
  },
  // 매니저(이영희) 알림 추가
  {
    id: "notif11", userId: "user2", type: "approval_request",
    title: "승인 대기",
    message: "[신규 체성분 분석기] 김철수님의 NABC 분석이 승인을 기다리고 있습니다.",
    link: "/task?projectId=proj1&taskId=task4", read: false, createdAt: hour(1),
  },
  {
    id: "notif12", userId: "user2", type: "approval_request",
    title: "승인 대기",
    message: "[가정용 혈압계] 성능 테스트 보고서가 승인을 기다리고 있습니다.",
    link: "/task?projectId=proj2&taskId=task5", read: false, createdAt: hour(2),
  },
];

// ─── 템플릿 단계 ──────────────────────────────
const templateStages = [
  { id: "stage0", name: "발의검토", order: 0, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage1", name: "발의승인", order: 1, type: "gate", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage2", name: "기획검토", order: 2, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage3", name: "기획승인", order: 3, type: "gate", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage4", name: "WM제작", order: 4, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage5", name: "WM승인회", order: 5, type: "gate", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage6", name: "Tx단계", order: 6, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage7", name: "Tx승인회", order: 7, type: "gate", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage8", name: "MasterGatePilot", order: 8, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage9", name: "MSG승인회", order: 9, type: "gate", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage10", name: "양산", order: 10, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
  { id: "stage11", name: "영업이관", order: 11, type: "work", createdBy: "시스템", createdAt: Timestamp.now(), lastModifiedBy: "시스템", lastModifiedAt: Timestamp.now() },
];

// ─── 템플릿 부서 ──────────────────────────────
const templateDepartments = [
  { id: "dept1", name: "개발팀", order: 0, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept2", name: "품질팀", order: 1, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept3", name: "영업팀", order: 2, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept4", name: "제조팀", order: 3, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept5", name: "구매팀", order: 4, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept6", name: "CS팀", order: 5, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept7", name: "경영관리팀", order: 6, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept8", name: "글로벌임상팀", order: 7, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept9", name: "디자인연구소", order: 8, createdBy: "시스템", createdAt: Timestamp.now() },
  { id: "dept10", name: "인증팀", order: 9, createdBy: "시스템", createdAt: Timestamp.now() },
];

// ─── 템플릿 항목 (193개 — ISO 13485/IEC 62304/FDA 기반) ────────────────────────
const tiNow = Timestamp.now();
const ti = (id, stageId, departmentId, content, order, isRequired) => ({
  id, stageId, departmentId, content, order, isRequired,
  createdBy: "시스템", createdAt: tiNow, lastModifiedBy: "시스템", lastModifiedAt: tiNow,
});
const templateItems = [
  // ── Phase 0: 발의 (22개) ──
  ti("ti-1","phase0","dept1","제품 컨셉 정의서 작성",0,true),
  ti("ti-2","phase0","dept1","기술 타당성 사전 검토",1,true),
  ti("ti-3","phase0","dept1","선행 기술 조사 보고서",2,true),
  ti("ti-4","phase0","dept1","NABC 분석 작성",3,true),
  ti("ti-5","phase0","dept1","지적재산권 사전 검토",4,false),
  ti("ti-6","phase0","dept1","발의 심사 발표자료 준비",5,true),
  ti("ti-7","phase0","dept2","품질 목표 수립",0,true),
  ti("ti-8","phase0","dept2","해당 규격/표준 목록 사전 조사",1,true),
  ti("ti-9","phase0","dept2","유사 제품 CAPA/불만 데이터 분석",2,false),
  ti("ti-10","phase0","dept3","시장 기회 분석 보고서",0,true),
  ti("ti-11","phase0","dept3","경쟁사 제품 분석",1,true),
  ti("ti-12","phase0","dept3","목표 고객군 정의",2,true),
  ti("ti-13","phase0","dept3","예상 판매가/판매량 추정",3,false),
  ti("ti-14","phase0","dept7","사업성 검토 (ROI/수익성 분석)",0,true),
  ti("ti-15","phase0","dept7","초기 프로젝트 예산 산정",1,true),
  ti("ti-16","phase0","dept7","프로젝트 일정 초안 수립",2,true),
  ti("ti-17","phase0","dept7","발의 승인 판단 근거 자료 취합",3,true),
  ti("ti-18","phase0","dept10","규제 분류 사전 검토 (등급/품목 예비 분류)",0,true),
  ti("ti-19","phase0","dept10","인허가 경로 조사 (국내 MFDS + 해외)",1,true),
  ti("ti-20","phase0","dept10","필수 인증 목록 사전 파악",2,false),
  ti("ti-21","phase0","dept9","사용자 니즈 사전 조사",0,false),
  ti("ti-22","phase0","dept9","컨셉 스케치/무드보드",1,false),
  // ── Phase 1: 기획 (37개) ──
  ti("ti-23","phase1","dept1","설계 입력(Design Input) 요구사항 명세서",0,true),
  ti("ti-24","phase1","dept1","제품 사양서(Product Specification) 작성",1,true),
  ti("ti-25","phase1","dept1","소프트웨어 개발 계획 수립 (IEC 62304)",2,true),
  ti("ti-26","phase1","dept1","시스템 아키텍처 설계",3,true),
  ti("ti-27","phase1","dept1","설계 검증/확인 계획 수립",4,true),
  ti("ti-28","phase1","dept1","개발 일정 상세 수립",5,true),
  ti("ti-29","phase1","dept1","기술 위험 분석 (초기 FMEA)",6,true),
  ti("ti-30","phase1","dept1","기획 승인회 발표자료 작성",7,true),
  ti("ti-31","phase1","dept2","위험관리 계획서 수립 (ISO 14971)",0,true),
  ti("ti-32","phase1","dept2","적용 규격/표준 확정 및 적합성 매트릭스",1,true),
  ti("ti-33","phase1","dept2","설계 관리(Design Control) 절차 확인",2,true),
  ti("ti-34","phase1","dept2","시험/검증 계획서 초안",3,true),
  ti("ti-35","phase1","dept2","DHF(설계이력파일) 구성 계획",4,true),
  ti("ti-36","phase1","dept2","사용적합성(Usability) 엔지니어링 계획 (IEC 62366)",5,false),
  ti("ti-37","phase1","dept3","고객 요구사항 정의서",0,true),
  ti("ti-38","phase1","dept3","가격 전략 수립",1,true),
  ti("ti-39","phase1","dept3","마케팅 요구사항 정리 (라벨링, 포장 등)",2,false),
  ti("ti-40","phase1","dept3","기획 단계 시장성 검증 결과",3,true),
  ti("ti-41","phase1","dept4","제조 타당성 검토",0,true),
  ti("ti-42","phase1","dept4","초기 공정 흐름도 검토",1,false),
  ti("ti-43","phase1","dept4","제조 비용 사전 추정",2,false),
  ti("ti-44","phase1","dept5","주요 부품/원재료 사전 조사",0,true),
  ti("ti-45","phase1","dept5","공급업체 후보 리스트 작성",1,false),
  ti("ti-46","phase1","dept6","서비스 요구사항 정의 (A/S, 유지보수 등)",0,false),
  ti("ti-47","phase1","dept7","프로젝트 상세 예산 확정",0,true),
  ti("ti-48","phase1","dept7","자원 배분 계획 (인력/설비)",1,true),
  ti("ti-49","phase1","dept7","비용/일정 검토 결과 보고",2,true),
  ti("ti-50","phase1","dept8","임상 전략 수립 (임상 필요성 판단)",0,true),
  ti("ti-51","phase1","dept8","임상시험 예비 계획서",1,false),
  ti("ti-52","phase1","dept9","산업 디자인 요구사항 정의",0,true),
  ti("ti-53","phase1","dept9","사용자 인터페이스(UI) 요구사항 정의",1,true),
  ti("ti-54","phase1","dept9","인간공학 설계 요구사항",2,true),
  ti("ti-55","phase1","dept9","초기 디자인 컨셉 개발 (2-3안)",3,false),
  ti("ti-56","phase1","dept10","인허가 전략서 확정",0,true),
  ti("ti-57","phase1","dept10","필수 시험 항목 목록 확정",1,true),
  ti("ti-58","phase1","dept10","기술문서 작성 계획 수립",2,true),
  ti("ti-59","phase1","dept10","해외 인증 로드맵 수립 (CE, FDA 등)",3,false),
  // ── Phase 2: WM (35개) ──
  ti("ti-60","phase2","dept1","eBOM (설계 자재 명세서) 작성",0,true),
  ti("ti-61","phase2","dept1","상세 설계 문서 작성 (도면/3D 모델)",1,true),
  ti("ti-62","phase2","dept1","시제품(Working Model) 제작",2,true),
  ti("ti-63","phase2","dept1","소프트웨어 구현 및 단위 테스트 (IEC 62304)",3,true),
  ti("ti-64","phase2","dept1","설계 출력(Design Output) 문서화",4,true),
  ti("ti-65","phase2","dept1","설계 검증(Design Verification) 실시",5,true),
  ti("ti-66","phase2","dept1","HW/SW 통합 테스트",6,true),
  ti("ti-67","phase2","dept1","전기 안전 사전 시험 (IEC 60601-1)",7,false),
  ti("ti-68","phase2","dept1","W/M 검증 결과 보고서",8,true),
  ti("ti-69","phase2","dept2","설계 검증 시험 계획서 확정",0,true),
  ti("ti-70","phase2","dept2","위험 분석 업데이트 (FMEA 정교화)",1,true),
  ti("ti-71","phase2","dept2","신뢰성 시험 계획 수립",2,true),
  ti("ti-72","phase2","dept2","검교정 장비/시험 설비 확보",3,true),
  ti("ti-73","phase2","dept2","IQ/OQ 프로토콜 초안",4,false),
  ti("ti-74","phase2","dept2","W/M 품질 검증 보고서",5,true),
  ti("ti-75","phase2","dept4","시제품 제작 공정 검토",0,true),
  ti("ti-76","phase2","dept4","제작 공정 흐름도(Process Flow) 작성",1,true),
  ti("ti-77","phase2","dept4","시제품 조립 지원",2,true),
  ti("ti-78","phase2","dept4","공정 개선점 초기 도출",3,false),
  ti("ti-79","phase2","dept5","시제품 부품 조달",0,true),
  ti("ti-80","phase2","dept5","핵심 공급업체 선정 및 평가",1,true),
  ti("ti-81","phase2","dept5","부품 수급 리드타임 확인",2,true),
  ti("ti-82","phase2","dept5","공급업체 품질 협약서(SQA) 체결",3,false),
  ti("ti-83","phase2","dept9","외관 디자인 확정",0,true),
  ti("ti-84","phase2","dept9","사용자 인터페이스(UI/UX) 설계",1,true),
  ti("ti-85","phase2","dept9","목업/외관 시제품 제작",2,true),
  ti("ti-86","phase2","dept9","사용성 사전 평가",3,false),
  ti("ti-87","phase2","dept9","디자인 검증 결과 보고",4,true),
  ti("ti-88","phase2","dept10","인증 전략 세부 수립 (각국별 요구사항 분석)",0,true),
  ti("ti-89","phase2","dept10","기술문서 초안 작성 시작",1,true),
  ti("ti-90","phase2","dept10","필수 시험 항목 확인 및 시험소 선정",2,true),
  ti("ti-91","phase2","dept10","라벨링/IFU 초안 검토",3,false),
  ti("ti-92","phase2","dept8","임상 문헌 조사",0,true),
  ti("ti-93","phase2","dept8","임상시험 프로토콜 초안 작성",1,false),
  ti("ti-94","phase2","dept7","중간 비용 실적 검토",0,false),
  // ── Phase 3: Tx (39개) ──
  ti("ti-95","phase3","dept1","설계 확인(Design Validation) 실시",0,true),
  ti("ti-96","phase3","dept1","소프트웨어 검증/확인 완료 (IEC 62304)",1,true),
  ti("ti-97","phase3","dept1","기술 문서 최종 검토",2,true),
  ti("ti-98","phase3","dept1","설계 동결(Design Freeze)",3,true),
  ti("ti-99","phase3","dept1","설계 이전(Design Transfer) 문서 작성",4,true),
  ti("ti-100","phase3","dept1","성능 시험 보고서 작성",5,true),
  ti("ti-101","phase3","dept2","신뢰성 시험 실시 (낙하/진동/온습도 등)",0,true),
  ti("ti-102","phase3","dept2","EMC 시험 실시 (IEC 60601-1-2)",1,true),
  ti("ti-103","phase3","dept2","전기 안전 시험 실시 (IEC 60601-1)",2,true),
  ti("ti-104","phase3","dept2","생물학적 안전성 시험 (ISO 10993)",3,true),
  ti("ti-105","phase3","dept2","사용적합성(Usability) 검증 시험 (IEC 62366)",4,true),
  ti("ti-106","phase3","dept2","위험 분석 최종 보고서 (ISO 14971)",5,true),
  ti("ti-107","phase3","dept2","시험 성적서 취합 및 검토",6,true),
  ti("ti-108","phase3","dept2","Tx 시험 성적서 총괄 취합",7,true),
  ti("ti-109","phase3","dept4","시험 생산 준비",0,true),
  ti("ti-110","phase3","dept4","공정 FMEA (pFMEA) 작성",1,true),
  ti("ti-111","phase3","dept4","제조 작업 지시서 초안",2,true),
  ti("ti-112","phase3","dept4","시험 생산 실시 (소량)",3,false),
  ti("ti-113","phase3","dept5","시험 자재 조달",0,true),
  ti("ti-114","phase3","dept5","수입검사 기준서 작성",1,true),
  ti("ti-115","phase3","dept5","공급업체 2차 평가",2,false),
  ti("ti-116","phase3","dept8","임상시험 실시 (IRB 승인 후)",0,true),
  ti("ti-117","phase3","dept8","임상 데이터 수집/분석",1,true),
  ti("ti-118","phase3","dept8","임상시험 결과 보고서 작성",2,true),
  ti("ti-119","phase3","dept8","임상적 평가 보고서(CER) 작성",3,true),
  ti("ti-120","phase3","dept8","해외 임상 시험 진행 (대상국 해당 시)",4,false),
  ti("ti-121","phase3","dept8","임상 결과 최종 보고",5,true),
  ti("ti-122","phase3","dept10","MFDS 기술문서 작성 완료",0,true),
  ti("ti-123","phase3","dept10","MFDS 인허가 신청 (품목인증/허가)",1,true),
  ti("ti-124","phase3","dept10","GMP 적합성 평가 준비",2,true),
  ti("ti-125","phase3","dept10","CE 기술문서 작성 (해당 시)",3,false),
  ti("ti-126","phase3","dept10","FDA 510(k)/PMA 서류 준비 (해당 시)",4,false),
  ti("ti-127","phase3","dept10","라벨링/IFU 최종본 작성",5,true),
  ti("ti-128","phase3","dept10","적합성 선언서 작성",6,true),
  ti("ti-129","phase3","dept10","인증 시험 결과 보고서",7,true),
  ti("ti-130","phase3","dept9","최종 외관 디자인 확정 (양산용)",0,true),
  ti("ti-131","phase3","dept9","포장 디자인 개발",1,true),
  ti("ti-132","phase3","dept3","제품 카탈로그/브로슈어 초안",0,false),
  ti("ti-133","phase3","dept3","판매 채널 사전 확보",1,false),
  // ── Phase 4: MSG (31개) ──
  ti("ti-134","phase4","dept1","양산 도면 확정",0,true),
  ti("ti-135","phase4","dept1","mBOM (제조 자재 명세서) 확정",1,true),
  ti("ti-136","phase4","dept1","설계 이전(Design Transfer) 완료 확인",2,true),
  ti("ti-137","phase4","dept1","양산용 소프트웨어 릴리스",3,true),
  ti("ti-138","phase4","dept2","공정 밸리데이션 (IQ/OQ/PQ) 실시",0,true),
  ti("ti-139","phase4","dept2","최종 품질 검증 (출하 검사 기준 확정)",1,true),
  ti("ti-140","phase4","dept2","양산 품질 기준서 작성",2,true),
  ti("ti-141","phase4","dept2","검사 장비 밸리데이션",3,true),
  ti("ti-142","phase4","dept2","시생산 제품 최종 검사",4,true),
  ti("ti-143","phase4","dept2","DHF(설계이력파일) 최종 정리",5,true),
  ti("ti-144","phase4","dept2","양산 전 최종 품질 판정 보고",6,true),
  ti("ti-145","phase4","dept4","양산 공정 계획 수립",0,true),
  ti("ti-146","phase4","dept4","시생산(Pilot Run) 실시",1,true),
  ti("ti-147","phase4","dept4","양산 라인 셋업",2,true),
  ti("ti-148","phase4","dept4","작업 표준서(SOP) 확정",3,true),
  ti("ti-149","phase4","dept4","시생산 결과 분석 및 개선",4,true),
  ti("ti-150","phase4","dept4","특수공정 밸리데이션",5,false),
  ti("ti-151","phase4","dept4","양산 Capacity/Takt Time 확인",6,true),
  ti("ti-152","phase4","dept4","시생산 결과 최종 보고",7,true),
  ti("ti-153","phase4","dept5","양산 자재 조달 계획 확정",0,true),
  ti("ti-154","phase4","dept5","양산용 공급업체 계약 확정",1,true),
  ti("ti-155","phase4","dept5","안전 재고 수준 설정",2,true),
  ti("ti-156","phase4","dept5","수입검사 체계 확정",3,true),
  ti("ti-157","phase4","dept10","인허가 승인 확인",0,true),
  ti("ti-158","phase4","dept10","GMP 적합성 인정 확인",1,true),
  ti("ti-159","phase4","dept10","제조소 변경 시 변경 신고 (해당 시)",2,false),
  ti("ti-160","phase4","dept10","인허가 현황 최종 보고",3,true),
  ti("ti-161","phase4","dept9","양산용 포장/라벨 디자인 확정",0,true),
  ti("ti-162","phase4","dept9","사용 설명서(IFU) 최종 디자인 확정",1,true),
  ti("ti-163","phase4","dept7","양산 원가 산정 확정",0,true),
  ti("ti-164","phase4","dept7","출시 일정 확정",1,true),
  // ── Phase 5: 양산/이관 (29개) ──
  ti("ti-165","phase5","dept1","양산 초기 기술 지원",0,true),
  ti("ti-166","phase5","dept1","설계 이력 파일(DHF) 최종 이관",1,true),
  ti("ti-167","phase5","dept2","초도품 검사 실시 (FAI)",0,true),
  ti("ti-168","phase5","dept2","양산 초기 불량률 모니터링",1,true),
  ti("ti-169","phase5","dept2","출하 검사 프로세스 가동",2,true),
  ti("ti-170","phase5","dept2","시판 후 감시(PMS) 계획 수립",3,true),
  ti("ti-171","phase5","dept3","판매 개시 준비 완료 확인",0,true),
  ti("ti-172","phase5","dept3","영업 교육 실시",1,true),
  ti("ti-173","phase5","dept3","제품 카탈로그/브로슈어 최종본",2,true),
  ti("ti-174","phase5","dept3","거래처 등록/공급 계약",3,true),
  ti("ti-175","phase5","dept3","온라인 마케팅 자료 게시",4,false),
  ti("ti-176","phase5","dept4","양산 가동 개시",0,true),
  ti("ti-177","phase5","dept4","양산 안정화 (수율 확인)",1,true),
  ti("ti-178","phase5","dept4","양산 SOP 최종 확정",2,true),
  ti("ti-179","phase5","dept4","초기 공정 능력(Cpk) 확인",3,true),
  ti("ti-180","phase5","dept5","양산 자재 안정 공급 확인",0,true),
  ti("ti-181","phase5","dept5","납품 일정 관리 체계 가동",1,true),
  ti("ti-182","phase5","dept6","A/S 체계 구축",0,true),
  ti("ti-183","phase5","dept6","고객 상담 매뉴얼 작성",1,true),
  ti("ti-184","phase5","dept6","보수용 부품 재고 확보",2,true),
  ti("ti-185","phase5","dept6","CS 담당자 교육 실시",3,true),
  ti("ti-186","phase5","dept7","최종 원가 확정 및 손익 분석",0,true),
  ti("ti-187","phase5","dept7","프로젝트 종료 보고서",1,true),
  ti("ti-188","phase5","dept7","프로젝트 Lessons Learned 정리",2,false),
  ti("ti-189","phase5","dept8","시판 후 임상 추적(PMCF) 계획 수립 (해당 시)",0,false),
  ti("ti-190","phase5","dept10","최종 인허가 완료 확인서",0,true),
  ti("ti-191","phase5","dept10","시판 후 안전성 보고 체계 구축",1,true),
  ti("ti-192","phase5","dept10","해외 인허가 완료 현황 정리",2,false),
  ti("ti-193","phase5","dept10","정기 안전성 보고 계획 확정",3,false),
];

// ─── 실행 ────────────────────────────────────
async function clearCollection(name) {
  const snap = await getDocs(collection(db, name));
  const promises = snap.docs.map((d) => deleteDoc(doc(db, name, d.id)));
  await Promise.all(promises);
  console.log(`  ✓ ${name} cleared (${snap.docs.length}건)`);
}

async function seedCollection(name, items) {
  const promises = items.map((item) => {
    const { id, ...data } = item;
    return setDoc(doc(db, name, id), data);
  });
  await Promise.all(promises);
  console.log(`  ✓ ${name} seeded (${items.length}건)`);
}

async function main() {
  console.log("🔥 Firestore 시드 데이터 투입 시작\n");

  // 기존 데이터 삭제
  console.log("1. 기존 데이터 삭제...");
  for (const col of ["users", "projects", "checklistItems", "changeRequests", "notifications", "templateStages", "templateDepartments", "templateItems"]) {
    await clearCollection(col);
  }

  // 새 데이터 투입
  console.log("\n2. 새 데이터 투입...");
  await seedCollection("users", users);
  await seedCollection("projects", projects);
  await seedCollection("checklistItems", checklistItems);
  await seedCollection("changeRequests", changeRequests);
  await seedCollection("notifications", notifications);
  await seedCollection("templateStages", templateStages);
  await seedCollection("templateDepartments", templateDepartments);
  await seedCollection("templateItems", templateItems);

  console.log("\n✅ 시드 완료!");
  console.log(`   사용자: ${users.length}명`);
  console.log(`   프로젝트: ${projects.length}개`);
  console.log(`   체크리스트: ${checklistItems.length}개`);
  console.log(`   설계변경: ${changeRequests.length}개`);
  console.log(`   알림: ${notifications.length}개`);
  console.log(`   템플릿 단계: ${templateStages.length}개`);
  console.log(`   템플릿 부서: ${templateDepartments.length}개`);
  console.log(`   템플릿 항목: ${templateItems.length}개`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ 시드 실패:", err);
  process.exit(1);
});
