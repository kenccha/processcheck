// 사용자 역할 (3 roles: 실무자, 매니저, 기획조정실(옵저버))
export type UserRole = "worker" | "manager" | "observer";

// 사용자
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  profileImage?: string;
}

// 부서
export type Department =
  | "개발팀"
  | "품질팀"
  | "영업팀"
  | "제조팀"
  | "구매팀"
  | "CS팀"
  | "경영관리팀"
  | "글로벌임상팀"
  | "디자인연구소"
  | "인증팀";

// 프로젝트 단계 (6 Phase, 각각 작업+승인 쌍)
export type ProjectStage =
  | "발의검토"
  | "발의승인"
  | "기획검토"
  | "기획승인"
  | "WM제작"
  | "WM승인회"
  | "Tx단계"
  | "Tx승인회"
  | "MasterGatePilot"
  | "MSG승인회"
  | "양산"
  | "영업이관";

// Phase 그룹 (작업●+승인● 쌍으로 묶임)
export interface PhaseGroup {
  name: string;          // Phase 이름 (발의, 기획, WM, Tx, MSG, 양산/이관)
  workStage: ProjectStage;
  gateStage: ProjectStage;
}

export const PHASE_GROUPS: PhaseGroup[] = [
  { name: "발의", workStage: "발의검토", gateStage: "발의승인" },
  { name: "기획", workStage: "기획검토", gateStage: "기획승인" },
  { name: "WM", workStage: "WM제작", gateStage: "WM승인회" },
  { name: "Tx", workStage: "Tx단계", gateStage: "Tx승인회" },
  { name: "MSG", workStage: "MasterGatePilot", gateStage: "MSG승인회" },
  { name: "양산/이관", workStage: "양산", gateStage: "영업이관" },
];

// 작업 상태
export type TaskStatus = "pending" | "in_progress" | "completed" | "rejected";

// 위험도
export type RiskLevel = "green" | "yellow" | "red";

// 프로젝트 유형
export type ProjectType = "신규개발" | "설계변경";

// 설계변경 규모
export type ChangeScale = "minor" | "medium" | "major";

// 프로젝트
export interface Project {
  id: string;
  name: string;
  productType: string;
  projectType: ProjectType;
  changeScale?: ChangeScale; // 설계변경일 때만 사용
  status: "active" | "completed" | "on_hold";
  progress: number; // 0-100
  startDate: Date;
  endDate: Date;
  pm: string;
  riskLevel: RiskLevel;
  currentStage: ProjectStage;
}

// 파일 첨부
export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  size: number;
}

// 태스크 코멘트
export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

// 체크리스트 항목
export interface ChecklistItem {
  id: string;
  projectId: string;
  stage: ProjectStage;
  department: Department;
  title: string;
  description: string;
  assignee: string; // 실무자
  reviewer: string; // 부서 관리자
  status: TaskStatus;
  dueDate: Date;
  completedDate?: Date;
  files?: FileAttachment[];
  comments?: TaskComment[];
  dependencies?: string[]; // 의존하는 다른 task ID들
  // 승인 관련 (Firestore에서 추가)
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
}

// 설계 변경
export interface ChangeRequest {
  id: string;
  projectId: string;
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  affectedDepartments: Department[];
  scale: "minor" | "medium" | "major"; // 경미/중간/대규모
  status: "pending" | "in_review" | "approved" | "rejected";
  readBy: { [department: string]: boolean };
}

// 알림
export interface Notification {
  id: string;
  userId: string;
  type: "task_assigned" | "approval_request" | "deadline_approaching" | "change_request";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

// 대시보드 통계
export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  completedTasks: number;
  pendingApprovals: number;
  upcomingDeadlines: number;
  criticalIssues: number;
}

// 체크리스트 템플릿 관련 타입

export interface ChecklistTemplateStage {
  id: string;
  name: string;           // 페이즈 이름 (발의, 기획, WM 등)
  order: number;
  workStageName: string;  // 작업 단계명 (발의검토, 기획검토 등)
  gateStageName: string;  // 승인 단계명 (발의승인, 기획승인 등)
  createdBy: string;
  createdAt: Date;
  lastModifiedBy: string;
  lastModifiedAt: Date;
}

export interface ChecklistTemplateDepartment {
  id: string;
  name: string;
  order: number;
  createdBy: string;
  createdAt: Date;
}

export interface ChecklistTemplateItem {
  id: string;
  stageId: string;
  departmentId: string;
  content: string;
  order: number;
  isRequired: boolean;
  createdBy: string;
  createdAt: Date;
  lastModifiedBy: string;
  lastModifiedAt: Date;
}

export interface ChecklistTemplateHistory {
  id: string;
  itemId: string;
  action: "created" | "updated" | "deleted";
  modifiedBy: string;
  modifiedAt: Date;
  previousValue: unknown;
  newValue: unknown;
}
