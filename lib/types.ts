// 사용자 역할
export type UserRole = "worker" | "manager" | "pm" | "scheduler";

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

// 프로젝트 단계
export type ProjectStage =
  | "0_발의검토"
  | "1_발의승인"
  | "2_기획검토"
  | "3_기획승인"
  | "4_WM제작"
  | "5_WM승인회"
  | "6_Tx단계"
  | "7_Tx승인회"
  | "8_MasterGatePilot"
  | "9_MSG승인회"
  | "10_양산"
  | "11_영업이관";

// 작업 상태
export type TaskStatus = "pending" | "in_progress" | "completed" | "rejected";

// 위험도
export type RiskLevel = "green" | "yellow" | "red";

// 프로젝트
export interface Project {
  id: string;
  name: string;
  productType: string;
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
export type StageType = "work" | "gate";

export interface ChecklistTemplateStage {
  id: string;
  name: string;
  order: number;
  type: StageType;
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
