import {
  User,
  Project,
  ChecklistItem,
  ChangeRequest,
  Notification,
  Department,
  ProjectStage,
} from "./types";

// Mock 사용자 데이터
export const mockUsers: User[] = [
  {
    id: "user1",
    name: "김철수",
    email: "chulsoo@company.com",
    role: "worker",
    department: "개발팀",
  },
  {
    id: "user2",
    name: "이영희",
    email: "younghee@company.com",
    role: "manager",
    department: "개발팀",
  },
  {
    id: "user3",
    name: "박민수",
    email: "minsu@company.com",
    role: "pm",
    department: "경영관리팀",
  },
  {
    id: "user4",
    name: "최지영",
    email: "jiyoung@company.com",
    role: "worker",
    department: "품질팀",
  },
  {
    id: "user5",
    name: "정수현",
    email: "soohyun@company.com",
    role: "worker",
    department: "제조팀",
  },
  {
    id: "user6",
    name: "강민지",
    email: "minji@company.com",
    role: "manager",
    department: "품질팀",
  },
  {
    id: "user7",
    name: "홍길동",
    email: "gildong@company.com",
    role: "worker",
    department: "디자인연구소",
  },
];

// Mock 프로젝트 데이터
export const mockProjects: Project[] = [
  {
    id: "proj1",
    name: "신규 체성분 분석기 개발",
    productType: "체성분 분석기",
    status: "active",
    progress: 35,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-08-31"),
    pm: "박민수",
    riskLevel: "yellow",
    currentStage: "WM제작",
  },
  {
    id: "proj2",
    name: "가정용 혈압계 업그레이드",
    productType: "혈압계",
    status: "active",
    progress: 65,
    startDate: new Date("2025-10-01"),
    endDate: new Date("2026-05-31"),
    pm: "박민수",
    riskLevel: "green",
    currentStage: "Tx단계",
  },
  {
    id: "proj3",
    name: "FRA 장비 신모델",
    productType: "FRA",
    status: "active",
    progress: 15,
    startDate: new Date("2026-02-01"),
    endDate: new Date("2026-12-31"),
    pm: "박민수",
    riskLevel: "green",
    currentStage: "기획검토",
  },
  {
    id: "proj4",
    name: "신장계 긴급 설계 변경",
    productType: "신장계",
    status: "active",
    progress: 85,
    startDate: new Date("2025-11-01"),
    endDate: new Date("2026-03-31"),
    pm: "박민수",
    riskLevel: "red",
    currentStage: "MSG승인회",
  },
  {
    id: "proj5",
    name: "이전 프로젝트 (완료)",
    productType: "혈압계",
    status: "completed",
    progress: 100,
    startDate: new Date("2025-06-01"),
    endDate: new Date("2025-12-31"),
    pm: "박민수",
    riskLevel: "green",
    currentStage: "영업이관",
  },
];

// Mock 체크리스트 항목
const today = new Date();
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
const in2Days = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
const in5Days = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

export const mockChecklistItems: ChecklistItem[] = [
  // 김철수의 오늘 할 일 (마감일 임박)
  {
    id: "task1",
    projectId: "proj1",
    stage: "WM제작",
    department: "개발팀",
    title: "스펙 정리 및 분석 완료",
    description: "제품 스펙을 최종 확정하고 기술 문서를 작성합니다.",
    assignee: "김철수",
    reviewer: "이영희",
    status: "in_progress",
    dueDate: tomorrow,
  },
  {
    id: "task2",
    projectId: "proj1",
    stage: "WM제작",
    department: "개발팀",
    title: "eBOM 작성",
    description: "설계 자재 명세서를 작성합니다.",
    assignee: "김철수",
    reviewer: "이영희",
    status: "pending",
    dueDate: today,
  },
  {
    id: "task3",
    projectId: "proj2",
    stage: "Tx단계",
    department: "개발팀",
    title: "기술 문서 검토",
    description: "최종 기술 문서를 검토하고 승인합니다.",
    assignee: "김철수",
    reviewer: "이영희",
    status: "pending",
    dueDate: in3Days,
  },

  // 김철수의 승인 대기 중인 작업
  {
    id: "task4",
    projectId: "proj1",
    stage: "기획검토",
    department: "개발팀",
    title: "NABC 분석 완료",
    description: "Need, Approach, Benefit, Competition 분석",
    assignee: "김철수",
    reviewer: "이영희",
    status: "completed",
    dueDate: weekAgo,
    completedDate: yesterday,
  },
  {
    id: "task5",
    projectId: "proj2",
    stage: "Tx단계",
    department: "개발팀",
    title: "성능 테스트 보고서 작성",
    description: "성능 테스트 결과를 정리하고 보고서를 작성합니다.",
    assignee: "김철수",
    reviewer: "이영희",
    status: "completed",
    dueDate: in2Days,
    completedDate: yesterday,
  },

  // 최지영의 작업 (품질팀)
  {
    id: "task6",
    projectId: "proj1",
    stage: "WM제작",
    department: "품질팀",
    title: "신뢰성 테스트 계획 수립",
    description: "제품의 신뢰성 테스트 계획을 수립합니다.",
    assignee: "최지영",
    reviewer: "강민지",
    status: "in_progress",
    dueDate: in5Days,
  },
  {
    id: "task7",
    projectId: "proj2",
    stage: "Tx단계",
    department: "품질팀",
    title: "낙하 테스트 실시",
    description: "제품 낙하 테스트를 실시하고 결과를 분석합니다.",
    assignee: "최지영",
    reviewer: "강민지",
    status: "pending",
    dueDate: tomorrow,
  },

  // 정수현의 작업 (제조팀)
  {
    id: "task8",
    projectId: "proj4",
    stage: "MSG승인회",
    department: "제조팀",
    title: "양산 라인 셋업",
    description: "양산을 위한 제조 라인 준비 및 테스트",
    assignee: "정수현",
    reviewer: "이영희",
    status: "in_progress",
    dueDate: today,
  },
  {
    id: "task9",
    projectId: "proj4",
    stage: "MasterGatePilot",
    department: "제조팀",
    title: "시생산 결과 분석",
    description: "시생산 결과를 분석하고 개선사항을 도출합니다.",
    assignee: "정수현",
    reviewer: "이영희",
    status: "completed",
    dueDate: weekAgo,
    completedDate: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
  },

  // 홍길동의 작업 (디자인연구소)
  {
    id: "task10",
    projectId: "proj2",
    stage: "Tx단계",
    department: "디자인연구소",
    title: "UI/UX 디자인 최종 검토",
    description: "사용자 인터페이스 및 경험 디자인 최종 검토",
    assignee: "홍길동",
    reviewer: "이영희",
    status: "completed",
    dueDate: weekAgo,
    completedDate: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
  },

  // 기타 부서 작업들
  {
    id: "task11",
    projectId: "proj1",
    stage: "WM제작",
    department: "구매팀",
    title: "부품 공급업체 선정",
    description: "주요 부품의 공급업체를 선정하고 계약합니다.",
    assignee: "박영수",
    reviewer: "김부장",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task12",
    projectId: "proj3",
    stage: "기획검토",
    department: "영업팀",
    title: "시장 조사 및 분석",
    description: "목표 시장을 조사하고 경쟁사를 분석합니다.",
    assignee: "이상민",
    reviewer: "최과장",
    status: "in_progress",
    dueDate: in5Days,
  },
  {
    id: "task13",
    projectId: "proj1",
    stage: "WM제작",
    department: "인증팀",
    title: "인증 전략 수립",
    description: "각국 인증 요구사항을 분석하고 전략을 수립합니다.",
    assignee: "김인증",
    reviewer: "박인증",
    status: "pending",
    dueDate: in7Days,
  },

  // 지연된 작업 (마감일 지남)
  {
    id: "task14",
    projectId: "proj4",
    stage: "MSG승인회",
    department: "개발팀",
    title: "최종 도면 승인",
    description: "양산을 위한 최종 도면을 검토하고 승인합니다.",
    assignee: "김철수",
    reviewer: "이영희",
    status: "in_progress",
    dueDate: yesterday,
  },

  // proj1 추가 작업들 (전체 단계 커버)
  {
    id: "task15",
    projectId: "proj1",
    stage: "발의검토",
    department: "개발팀",
    title: "제품 컨셉 정의",
    description: "신제품 컨셉과 목표를 정의합니다.",
    assignee: "김철수",
    reviewer: "이영희",
    status: "completed",
    dueDate: weekAgo,
    completedDate: weekAgo,
  },
  {
    id: "task16",
    projectId: "proj1",
    stage: "발의검토",
    department: "품질팀",
    title: "품질 목표 수립",
    description: "제품의 품질 목표와 기준을 수립합니다.",
    assignee: "최지영",
    reviewer: "강민지",
    status: "completed",
    dueDate: weekAgo,
    completedDate: weekAgo,
  },
  {
    id: "task17",
    projectId: "proj1",
    stage: "발의검토",
    department: "영업팀",
    title: "시장 기회 분석",
    description: "목표 시장과 경쟁 환경을 분석합니다.",
    assignee: "이상민",
    reviewer: "최과장",
    status: "completed",
    dueDate: weekAgo,
    completedDate: weekAgo,
  },
  {
    id: "task18",
    projectId: "proj1",
    stage: "발의검토",
    department: "경영관리팀",
    title: "사업성 검토",
    description: "ROI 및 수익성을 분석합니다.",
    assignee: "정재무",
    reviewer: "김부장",
    status: "completed",
    dueDate: weekAgo,
    completedDate: weekAgo,
  },
  {
    id: "task19",
    projectId: "proj1",
    stage: "기획검토",
    department: "영업팀",
    title: "가격 전략 수립",
    description: "제품 가격 전략을 수립합니다.",
    assignee: "이상민",
    reviewer: "최과장",
    status: "completed",
    dueDate: weekAgo,
    completedDate: weekAgo,
  },
  {
    id: "task20",
    projectId: "proj1",
    stage: "WM제작",
    department: "개발팀",
    title: "시제품 제작",
    description: "1차 시제품을 제작합니다.",
    assignee: "박영수",
    reviewer: "이영희",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task21",
    projectId: "proj1",
    stage: "WM제작",
    department: "제조팀",
    title: "제작 공정 검토",
    description: "시제품 제작 공정을 검토합니다.",
    assignee: "정수현",
    reviewer: "김제조",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task22",
    projectId: "proj1",
    stage: "Tx단계",
    department: "품질팀",
    title: "내구성 테스트",
    description: "제품 내구성 테스트를 실시합니다.",
    assignee: "최지영",
    reviewer: "강민지",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task23",
    projectId: "proj1",
    stage: "Tx단계",
    department: "디자인연구소",
    title: "외관 디자인 확정",
    description: "제품 외관 디자인을 확정합니다.",
    assignee: "홍길동",
    reviewer: "박디자인",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task24",
    projectId: "proj1",
    stage: "MasterGatePilot",
    department: "제조팀",
    title: "양산 공정 계획",
    description: "양산을 위한 제조 공정을 계획합니다.",
    assignee: "정수현",
    reviewer: "김제조",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task25",
    projectId: "proj1",
    stage: "MasterGatePilot",
    department: "구매팀",
    title: "자재 조달 계획",
    description: "양산 자재 조달 계획을 수립합니다.",
    assignee: "박구매",
    reviewer: "최구매",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task26",
    projectId: "proj1",
    stage: "MasterGatePilot",
    department: "제조팀",
    title: "시생산 실시",
    description: "시생산을 실시하고 문제점을 파악합니다.",
    assignee: "정수현",
    reviewer: "김제조",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task27",
    projectId: "proj1",
    stage: "MSG승인회",
    department: "품질팀",
    title: "최종 품질 검증",
    description: "양산 전 최종 품질을 검증합니다.",
    assignee: "최지영",
    reviewer: "강민지",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task28",
    projectId: "proj1",
    stage: "양산",
    department: "제조팀",
    title: "양산 가동",
    description: "본격적인 양산을 시작합니다.",
    assignee: "정수현",
    reviewer: "김제조",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task29",
    projectId: "proj1",
    stage: "영업이관",
    department: "영업팀",
    title: "판매 시작 준비",
    description: "제품 판매를 위한 준비를 합니다.",
    assignee: "이상민",
    reviewer: "최과장",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task30",
    projectId: "proj1",
    stage: "영업이관",
    department: "CS팀",
    title: "A/S 체계 구축",
    description: "고객 서비스 및 A/S 체계를 구축합니다.",
    assignee: "김서비스",
    reviewer: "박CS",
    status: "pending",
    dueDate: in7Days,
  },
  {
    id: "task31",
    projectId: "proj1",
    stage: "WM제작",
    department: "인증팀",
    title: "인증 요구사항 검토",
    description: "각국 인증 요구사항을 검토합니다.",
    assignee: "김인증",
    reviewer: "박인증",
    status: "pending",
    dueDate: in5Days,
  },
];

// Mock 설계 변경
export const mockChangeRequests: ChangeRequest[] = [
  {
    id: "change1",
    projectId: "proj4",
    title: "배터리 규격 변경",
    description: "기존 AA 배터리에서 리튬이온 배터리로 변경",
    requestedBy: "영업팀",
    requestedAt: new Date("2026-01-27"),
    affectedDepartments: ["개발팀", "제조팀", "구매팀", "인증팀"],
    scale: "major",
    status: "in_review",
    readBy: {
      개발팀: true,
      제조팀: true,
      구매팀: false,
      인증팀: false,
    },
  },
  {
    id: "change2",
    projectId: "proj1",
    title: "LCD 화면 크기 조정",
    description: "3.5인치에서 4.0인치로 확대",
    requestedBy: "품질팀",
    requestedAt: new Date("2026-01-25"),
    affectedDepartments: ["개발팀", "디자인연구소", "제조팀"],
    scale: "medium",
    status: "approved",
    readBy: {
      개발팀: true,
      디자인연구소: true,
      제조팀: true,
    },
  },
];

// Mock 알림
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

export const mockNotifications: Notification[] = [
  {
    id: "notif1",
    userId: "user1",
    type: "deadline_approaching",
    title: "⚠️ 마감일이 오늘입니다",
    message: "[신규 체성분 분석기] eBOM 작성 - 오늘 마감",
    link: "/projects/proj1/tasks/task2",
    read: false,
    createdAt: oneHourAgo,
  },
  {
    id: "notif2",
    userId: "user1",
    type: "task_assigned",
    title: "새 작업이 배정되었습니다",
    message: "[신규 체성분 분석기] 스펙 정리 및 분석 완료",
    link: "/projects/proj1/tasks/task1",
    read: false,
    createdAt: twoHoursAgo,
  },
  {
    id: "notif3",
    userId: "user1",
    type: "deadline_approaching",
    title: "마감일이 1일 남았습니다",
    message: "[신장계] 최종 도면 승인 - 이미 마감일 지남 (긴급)",
    link: "/projects/proj4/tasks/task14",
    read: false,
    createdAt: threeHoursAgo,
  },
  {
    id: "notif4",
    userId: "user1",
    type: "change_request",
    title: "설계 변경 요청 확인 필요",
    message: "[신장계] 배터리 규격 변경 - 영향도 검토 요청",
    link: "/projects/proj4",
    read: true,
    createdAt: oneDayAgo,
  },
  {
    id: "notif5",
    userId: "user1",
    type: "approval_request",
    title: "승인 완료",
    message: "이영희님이 NABC 분석 완료 작업을 승인했습니다",
    link: "/projects/proj1/tasks/task4",
    read: true,
    createdAt: twoDaysAgo,
  },
  // 최지영의 알림
  {
    id: "notif6",
    userId: "user4",
    type: "deadline_approaching",
    title: "마감일이 내일입니다",
    message: "[가정용 혈압계] 낙하 테스트 실시 - 내일 마감",
    link: "/projects/proj2/tasks/task7",
    read: false,
    createdAt: twoHoursAgo,
  },
  // 정수현의 알림
  {
    id: "notif7",
    userId: "user5",
    type: "deadline_approaching",
    title: "⚠️ 마감일이 오늘입니다",
    message: "[신장계] 양산 라인 셋업 - 오늘 마감",
    link: "/projects/proj4/tasks/task8",
    read: false,
    createdAt: oneHourAgo,
  },
  // PM(박민수) 알림 추가
  {
    id: "notif8",
    userId: "user3",
    type: "approval_request",
    title: "승인 요청",
    message: "[신규 체성분 분석기] 김철수님이 NABC 분석을 완료했습니다. 검토 필요.",
    link: "/projects/proj1/tasks/task4",
    read: false,
    createdAt: oneHourAgo,
  },
  {
    id: "notif9",
    userId: "user3",
    type: "deadline_approaching",
    title: "⚠️ 프로젝트 위험 감지",
    message: "[신장계 긴급 설계 변경] 마감일 임박 - 위험도 상승",
    link: "/projects/proj4",
    read: false,
    createdAt: twoHoursAgo,
  },
  {
    id: "notif10",
    userId: "user3",
    type: "change_request",
    title: "설계 변경 요청 접수",
    message: "[신장계] 배터리 규격 변경 요청이 접수되었습니다. 검토 필요.",
    link: "/projects/proj4",
    read: true,
    createdAt: oneDayAgo,
  },
  // 매니저(이영희) 알림 추가
  {
    id: "notif11",
    userId: "user2",
    type: "approval_request",
    title: "승인 대기",
    message: "[신규 체성분 분석기] 김철수님의 NABC 분석이 승인을 기다리고 있습니다.",
    link: "/projects/proj1/tasks/task4",
    read: false,
    createdAt: oneHourAgo,
  },
  {
    id: "notif12",
    userId: "user2",
    type: "approval_request",
    title: "승인 대기",
    message: "[가정용 혈압계] 성능 테스트 보고서가 승인을 기다리고 있습니다.",
    link: "/projects/proj2/tasks/task5",
    read: false,
    createdAt: twoHoursAgo,
  },
  // 강민지(매니저, 품질팀) 알림 추가
  {
    id: "notif13",
    userId: "user6",
    type: "task_assigned",
    title: "부서 작업 알림",
    message: "[신규 체성분 분석기] 신뢰성 테스트 계획 수립이 진행 중입니다.",
    link: "/projects/proj1/tasks/task6",
    read: false,
    createdAt: threeHoursAgo,
  },
];

// 부서 목록
export const departments: Department[] = [
  "개발팀",
  "품질팀",
  "영업팀",
  "제조팀",
  "구매팀",
  "CS팀",
  "경영관리팀",
  "글로벌임상팀",
  "디자인연구소",
  "인증팀",
];

// 프로젝트 단계 목록
export const projectStages: ProjectStage[] = [
  "발의검토",
  "발의승인",
  "기획검토",
  "기획승인",
  "WM제작",
  "WM승인회",
  "Tx단계",
  "Tx승인회",
  "MasterGatePilot",
  "MSG승인회",
  "양산",
  "영업이관",
];

// 단계명 포맷팅
export const formatStageName = (stage: ProjectStage): string => {
  const stageMap: Record<ProjectStage, string> = {
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
  return stageMap[stage] || stage;
};

// 위험도 색상
export const getRiskColor = (level: "green" | "yellow" | "red"): string => {
  switch (level) {
    case "green":
      return "bg-success-400";
    case "yellow":
      return "bg-warning-400";
    case "red":
      return "bg-danger-400";
  }
};

// 상태 한글명
export const getStatusLabel = (
  status: "pending" | "in_progress" | "completed" | "rejected"
): string => {
  switch (status) {
    case "pending":
      return "대기 중";
    case "in_progress":
      return "진행 중";
    case "completed":
      return "완료";
    case "rejected":
      return "반려";
  }
};
