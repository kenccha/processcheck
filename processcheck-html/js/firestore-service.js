// ═══════════════════════════════════════════════════════════════════════════════
// Firestore Service — all CRUD + real-time subscriptions
// Ported from lib/firestoreService.ts (no TypeScript)
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
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
    { id: "user3", name: "박민수", email: "minsu@company.com", role: "pm", department: "경영관리팀" },
    { id: "user4", name: "최지영", email: "jiyoung@company.com", role: "worker", department: "품질팀" },
    { id: "user5", name: "정수현", email: "soohyun@company.com", role: "worker", department: "제조팀" },
    { id: "user6", name: "강민지", email: "minji@company.com", role: "manager", department: "품질팀" },
    { id: "user7", name: "홍길동", email: "gildong@company.com", role: "worker", department: "디자인연구소" },
  ];

  const mockProjects = [
    { id: "proj1", name: "신규 체성분 분석기 개발", productType: "체성분 분석기", status: "active", progress: 35, startDate: new Date("2026-01-01"), endDate: new Date("2026-08-31"), pm: "박민수", riskLevel: "yellow", currentStage: "4_WM제작" },
    { id: "proj2", name: "가정용 혈압계 업그레이드", productType: "혈압계", status: "active", progress: 65, startDate: new Date("2025-10-01"), endDate: new Date("2026-05-31"), pm: "박민수", riskLevel: "green", currentStage: "6_Tx단계" },
    { id: "proj3", name: "FRA 장비 신모델", productType: "FRA", status: "active", progress: 15, startDate: new Date("2026-02-01"), endDate: new Date("2026-12-31"), pm: "박민수", riskLevel: "green", currentStage: "2_기획검토" },
    { id: "proj4", name: "신장계 긴급 설계 변경", productType: "신장계", status: "active", progress: 85, startDate: new Date("2025-11-01"), endDate: new Date("2026-03-31"), pm: "박민수", riskLevel: "red", currentStage: "9_MSG승인회" },
    { id: "proj5", name: "이전 프로젝트 (완료)", productType: "혈압계", status: "completed", progress: 100, startDate: new Date("2025-06-01"), endDate: new Date("2025-12-31"), pm: "박민수", riskLevel: "green", currentStage: "11_영업이관" },
  ];

  const mockChecklistItems = [
    { id: "task1", projectId: "proj1", stage: "4_WM제작", department: "개발팀", title: "스펙 정리 및 분석 완료", description: "제품 스펙을 최종 확정하고 기술 문서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(1) },
    { id: "task2", projectId: "proj1", stage: "4_WM제작", department: "개발팀", title: "eBOM 작성", description: "설계 자재 명세서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: d(0) },
    { id: "task3", projectId: "proj2", stage: "6_Tx단계", department: "개발팀", title: "기술 문서 검토", description: "최종 기술 문서를 검토하고 승인합니다.", assignee: "김철수", reviewer: "이영희", status: "pending", dueDate: d(3) },
    { id: "task4", projectId: "proj1", stage: "2_기획검토", department: "개발팀", title: "NABC 분석 완료", description: "Need, Approach, Benefit, Competition 분석", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-1) },
    { id: "task5", projectId: "proj2", stage: "6_Tx단계", department: "개발팀", title: "성능 테스트 보고서 작성", description: "성능 테스트 결과를 정리하고 보고서를 작성합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(2), completedDate: d(-1) },
    { id: "task6", projectId: "proj1", stage: "4_WM제작", department: "품질팀", title: "신뢰성 테스트 계획 수립", description: "제품의 신뢰성 테스트 계획을 수립합니다.", assignee: "최지영", reviewer: "강민지", status: "in_progress", dueDate: d(5) },
    { id: "task7", projectId: "proj2", stage: "6_Tx단계", department: "품질팀", title: "낙하 테스트 실시", description: "제품 낙하 테스트를 실시하고 결과를 분석합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(1) },
    { id: "task8", projectId: "proj4", stage: "9_MSG승인회", department: "제조팀", title: "양산 라인 셋업", description: "양산을 위한 제조 라인 준비 및 테스트", assignee: "정수현", reviewer: "이영희", status: "in_progress", dueDate: d(0) },
    { id: "task9", projectId: "proj4", stage: "8_MasterGatePilot", department: "제조팀", title: "시생산 결과 분석", description: "시생산 결과를 분석하고 개선사항을 도출합니다.", assignee: "정수현", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-2) },
    { id: "task10", projectId: "proj2", stage: "6_Tx단계", department: "디자인연구소", title: "UI/UX 디자인 최종 검토", description: "사용자 인터페이스 및 경험 디자인 최종 검토", assignee: "홍길동", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-3) },
    { id: "task11", projectId: "proj1", stage: "4_WM제작", department: "구매팀", title: "부품 공급업체 선정", description: "주요 부품의 공급업체를 선정하고 계약합니다.", assignee: "박영수", reviewer: "김부장", status: "pending", dueDate: d(7) },
    { id: "task12", projectId: "proj3", stage: "2_기획검토", department: "영업팀", title: "시장 조사 및 분석", description: "목표 시장을 조사하고 경쟁사를 분석합니다.", assignee: "이상민", reviewer: "최과장", status: "in_progress", dueDate: d(5) },
    { id: "task13", projectId: "proj1", stage: "4_WM제작", department: "인증팀", title: "인증 전략 수립", description: "각국 인증 요구사항을 분석하고 전략을 수립합니다.", assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: d(7) },
    { id: "task14", projectId: "proj4", stage: "9_MSG승인회", department: "개발팀", title: "최종 도면 승인", description: "양산을 위한 최종 도면을 검토하고 승인합니다.", assignee: "김철수", reviewer: "이영희", status: "in_progress", dueDate: d(-1) },
    { id: "task15", projectId: "proj1", stage: "0_발의검토", department: "개발팀", title: "제품 컨셉 정의", description: "신제품 컨셉과 목표를 정의합니다.", assignee: "김철수", reviewer: "이영희", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task16", projectId: "proj1", stage: "0_발의검토", department: "품질팀", title: "품질 목표 수립", description: "제품의 품질 목표와 기준을 수립합니다.", assignee: "최지영", reviewer: "강민지", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task17", projectId: "proj1", stage: "0_발의검토", department: "영업팀", title: "시장 기회 분석", description: "목표 시장과 경쟁 환경을 분석합니다.", assignee: "이상민", reviewer: "최과장", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task18", projectId: "proj1", stage: "0_발의검토", department: "경영관리팀", title: "사업성 검토", description: "ROI 및 수익성을 분석합니다.", assignee: "정재무", reviewer: "김부장", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task19", projectId: "proj1", stage: "2_기획검토", department: "영업팀", title: "가격 전략 수립", description: "제품 가격 전략을 수립합니다.", assignee: "이상민", reviewer: "최과장", status: "completed", dueDate: d(-7), completedDate: d(-7) },
    { id: "task20", projectId: "proj1", stage: "4_WM제작", department: "개발팀", title: "시제품 제작", description: "1차 시제품을 제작합니다.", assignee: "박영수", reviewer: "이영희", status: "pending", dueDate: d(7) },
    { id: "task21", projectId: "proj1", stage: "4_WM제작", department: "제조팀", title: "제작 공정 검토", description: "시제품 제작 공정을 검토합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task22", projectId: "proj1", stage: "6_Tx단계", department: "품질팀", title: "내구성 테스트", description: "제품 내구성 테스트를 실시합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(7) },
    { id: "task23", projectId: "proj1", stage: "6_Tx단계", department: "디자인연구소", title: "외관 디자인 확정", description: "제품 외관 디자인을 확정합니다.", assignee: "홍길동", reviewer: "박디자인", status: "pending", dueDate: d(7) },
    { id: "task24", projectId: "proj1", stage: "8_MasterGatePilot", department: "제조팀", title: "양산 공정 계획", description: "양산을 위한 제조 공정을 계획합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task25", projectId: "proj1", stage: "8_MasterGatePilot", department: "구매팀", title: "자재 조달 계획", description: "양산 자재 조달 계획을 수립합니다.", assignee: "박구매", reviewer: "최구매", status: "pending", dueDate: d(7) },
    { id: "task26", projectId: "proj1", stage: "8_MasterGatePilot", department: "제조팀", title: "시생산 실시", description: "시생산을 실시하고 문제점을 파악합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task27", projectId: "proj1", stage: "9_MSG승인회", department: "품질팀", title: "최종 품질 검증", description: "양산 전 최종 품질을 검증합니다.", assignee: "최지영", reviewer: "강민지", status: "pending", dueDate: d(7) },
    { id: "task28", projectId: "proj1", stage: "10_양산", department: "제조팀", title: "양산 가동", description: "본격적인 양산을 시작합니다.", assignee: "정수현", reviewer: "김제조", status: "pending", dueDate: d(7) },
    { id: "task29", projectId: "proj1", stage: "11_영업이관", department: "영업팀", title: "판매 시작 준비", description: "제품 판매를 위한 준비를 합니다.", assignee: "이상민", reviewer: "최과장", status: "pending", dueDate: d(7) },
    { id: "task30", projectId: "proj1", stage: "11_영업이관", department: "CS팀", title: "A/S 체계 구축", description: "고객 서비스 및 A/S 체계를 구축합니다.", assignee: "김서비스", reviewer: "박CS", status: "pending", dueDate: d(7) },
    { id: "task31", projectId: "proj1", stage: "4_WM제작", department: "인증팀", title: "인증 요구사항 검토", description: "각국 인증 요구사항을 검토합니다.", assignee: "김인증", reviewer: "박인증", status: "pending", dueDate: d(5) },
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

    // Template Stages
    const stages = [
      { id: "stage-0", name: "0. 발의 검토", order: 0, type: "work" },
      { id: "stage-1", name: "1. 발의 승인", order: 1, type: "gate" },
      { id: "stage-2", name: "2. 기획 검토", order: 2, type: "work" },
      { id: "stage-3", name: "3. 기획 승인", order: 3, type: "gate" },
      { id: "stage-4", name: "4. W/M 제작", order: 4, type: "work" },
      { id: "stage-5", name: "5. W/M 승인회", order: 5, type: "gate" },
      { id: "stage-6", name: "6. Tx 단계", order: 6, type: "work" },
      { id: "stage-7", name: "7. Tx 승인회", order: 7, type: "gate" },
      { id: "stage-8", name: "8. Master Gate Pilot", order: 8, type: "work" },
      { id: "stage-9", name: "9. MSG 승인회", order: 9, type: "gate" },
      { id: "stage-10", name: "10. 양산", order: 10, type: "work" },
      { id: "stage-11", name: "11. 영업 이관", order: 11, type: "work" },
    ];
    for (const s of stages) {
      batch.set(doc(db, "templateStages", s.id), { ...s, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() });
    }

    // Template Departments
    const depts = [
      { id: "dept-dev", name: "개발팀", order: 0 },
      { id: "dept-quality", name: "품질팀", order: 1 },
      { id: "dept-sales", name: "영업팀", order: 2 },
      { id: "dept-mfg", name: "제조팀", order: 3 },
      { id: "dept-purchase", name: "구매팀", order: 4 },
      { id: "dept-cs", name: "CS팀", order: 5 },
      { id: "dept-mgmt", name: "경영관리팀", order: 6 },
      { id: "dept-clinical", name: "글로벌임상팀", order: 7 },
      { id: "dept-design", name: "디자인연구소", order: 8 },
      { id: "dept-cert", name: "인증팀", order: 9 },
    ];
    for (const d of depts) {
      batch.set(doc(db, "templateDepartments", d.id), { ...d, createdBy: "system", createdAt: Timestamp.now() });
    }

    // Template Items
    const tItems = [
      { id: "ti-1", stageId: "stage-0", departmentId: "dept-dev", content: "NABC 문서가 작성되었는가?", order: 0, isRequired: true },
      { id: "ti-2", stageId: "stage-0", departmentId: "dept-dev", content: "Needs(필요성) 항목이 작성되었는가?", order: 1, isRequired: true },
      { id: "ti-3", stageId: "stage-0", departmentId: "dept-sales", content: "시장 니즈 조사 자료가 있는가?", order: 0, isRequired: true },
      { id: "ti-4", stageId: "stage-2", departmentId: "dept-dev", content: "요구사항 문서 작성 완료", order: 0, isRequired: true },
      { id: "ti-5", stageId: "stage-2", departmentId: "dept-dev", content: "기술 스펙 문서 작성 완료", order: 1, isRequired: true },
      { id: "ti-6", stageId: "stage-2", departmentId: "dept-dev", content: "관련 부서 검토 완료", order: 2, isRequired: true },
      { id: "ti-7", stageId: "stage-2", departmentId: "dept-dev", content: "예산 검토 완료", order: 3, isRequired: false },
      { id: "ti-8", stageId: "stage-2", departmentId: "dept-dev", content: "일정 검토 완료", order: 4, isRequired: true },
      { id: "ti-9", stageId: "stage-4", departmentId: "dept-dev", content: "설계 도면 완성 여부 확인", order: 0, isRequired: true },
      { id: "ti-10", stageId: "stage-4", departmentId: "dept-quality", content: "품질 계획서가 수립되었는가?", order: 0, isRequired: true },
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
  const stagesSnap = await getDocs(collection(db, "templateStages"));
  const maxOrder = stagesSnap.docs.reduce((max, d) => Math.max(max, d.data().order ?? 0), -1);
  const ref = await addDoc(collection(db, "templateStages"), {
    ...data,
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
