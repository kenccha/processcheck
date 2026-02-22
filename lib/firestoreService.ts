import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  writeBatch,
  onSnapshot,
  DocumentData,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import type {
  User,
  Project,
  ChecklistItem,
  FileAttachment,
  ChangeRequest,
  Notification,
  TaskComment,
  ChecklistTemplateItem,
} from "./types";

// ─── Timestamp 변환 헬퍼 ─────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

function docToProject(id: string, data: DocumentData): Project {
  return {
    ...data,
    id,
    startDate: toDate(data.startDate),
    endDate: toDate(data.endDate),
  } as Project;
}

function docToChecklistItem(id: string, data: DocumentData): ChecklistItem {
  return {
    ...data,
    id,
    dueDate: toDate(data.dueDate),
    completedDate: data.completedDate ? toDate(data.completedDate) : undefined,
    comments: (data.comments || []).map((c: DocumentData) => ({
      ...c,
      createdAt: toDate(c.createdAt),
    })),
  } as ChecklistItem;
}

function docToChangeRequest(id: string, data: DocumentData): ChangeRequest {
  return {
    ...data,
    id,
    requestedAt: toDate(data.requestedAt),
  } as ChangeRequest;
}

function docToNotification(id: string, data: DocumentData): Notification {
  return {
    ...data,
    id,
    createdAt: toDate(data.createdAt),
  } as Notification;
}

function docToUser(id: string, data: DocumentData): User {
  return { ...data, id } as User;
}

// ─── 시드 데이터 (초기 Firestore 세팅) ──────────────────────────────────────

export async function seedDatabaseIfEmpty(): Promise<boolean> {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    if (!usersSnap.empty) return false; // 이미 시드됨

    const { mockUsers, mockProjects, mockChecklistItems, mockChangeRequests, mockNotifications } =
      await import("./mockData");

    const batch = writeBatch(db);

    // Users
    for (const user of mockUsers) {
      const ref = doc(db, "users", user.id);
      batch.set(ref, user);
    }

    // Projects
    for (const project of mockProjects) {
      const ref = doc(db, "projects", project.id);
      batch.set(ref, {
        ...project,
        startDate: Timestamp.fromDate(project.startDate),
        endDate: Timestamp.fromDate(project.endDate),
      });
    }

    // Checklist Items
    for (const item of mockChecklistItems) {
      const ref = doc(db, "checklistItems", item.id);
      batch.set(ref, {
        ...item,
        dueDate: Timestamp.fromDate(item.dueDate),
        completedDate: item.completedDate
          ? Timestamp.fromDate(item.completedDate)
          : null,
        files: item.files || [],
        comments: item.comments || [],
        dependencies: item.dependencies || [],
      });
    }

    // Change Requests
    for (const cr of mockChangeRequests) {
      const ref = doc(db, "changeRequests", cr.id);
      batch.set(ref, {
        ...cr,
        requestedAt: Timestamp.fromDate(cr.requestedAt),
      });
    }

    // Notifications
    for (const notif of mockNotifications) {
      const ref = doc(db, "notifications", notif.id);
      batch.set(ref, {
        ...notif,
        createdAt: Timestamp.fromDate(notif.createdAt),
      });
    }

    // Template Stages (6 Phases — 작업+승인 쌍으로 병합)
    const templateStages = [
      { id: "phase0", name: "발의", order: 0, workStageName: "발의검토", gateStageName: "발의승인", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "phase1", name: "기획", order: 1, workStageName: "기획검토", gateStageName: "기획승인", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "phase2", name: "WM", order: 2, workStageName: "WM제작", gateStageName: "WM승인회", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "phase3", name: "Tx", order: 3, workStageName: "Tx단계", gateStageName: "Tx승인회", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "phase4", name: "MSG", order: 4, workStageName: "MasterGatePilot", gateStageName: "MSG승인회", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "phase5", name: "양산/이관", order: 5, workStageName: "양산", gateStageName: "영업이관", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
    ];
    for (const s of templateStages) {
      batch.set(doc(db, "templateStages", s.id), s);
    }

    // Template Departments
    const templateDepartments = [
      { id: "dept1", name: "개발팀", order: 0, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept2", name: "품질팀", order: 1, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept3", name: "영업팀", order: 2, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept4", name: "제조팀", order: 3, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept5", name: "구매팀", order: 4, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept6", name: "CS팀", order: 5, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept7", name: "경영관리팀", order: 6, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept8", name: "글로벌임상팀", order: 7, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept9", name: "디자인연구소", order: 8, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept10", name: "인증팀", order: 9, createdBy: "system", createdAt: Timestamp.now() },
    ];
    for (const d of templateDepartments) {
      batch.set(doc(db, "templateDepartments", d.id), d);
    }

    // Template Items (초기 샘플 — stageId는 페이즈 ID 참조)
    const templateItems = [
      { id: "ti-1", stageId: "phase0", departmentId: "dept1", content: "NABC 문서가 작성되었는가?", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-2", stageId: "phase0", departmentId: "dept1", content: "Needs(필요성) 항목이 작성되었는가?", order: 1, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-3", stageId: "phase0", departmentId: "dept3", content: "시장 니즈 조사 자료가 있는가?", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-4", stageId: "phase1", departmentId: "dept1", content: "요구사항 문서 작성 완료", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-5", stageId: "phase1", departmentId: "dept1", content: "기술 스펙 문서 작성 완료", order: 1, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-6", stageId: "phase1", departmentId: "dept1", content: "관련 부서 검토 완료", order: 2, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-7", stageId: "phase1", departmentId: "dept1", content: "예산 검토 완료", order: 3, isRequired: false, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-8", stageId: "phase1", departmentId: "dept1", content: "일정 검토 완료", order: 4, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-9", stageId: "phase2", departmentId: "dept1", content: "설계 도면 완성 여부 확인", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-10", stageId: "phase2", departmentId: "dept2", content: "품질 계획서가 수립되었는가?", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
    ];
    for (const ti of templateItems) {
      batch.set(doc(db, "templateItems", ti.id), ti);
    }

    await batch.commit();
    console.log("✅ Firestore 초기 데이터 시드 완료");
    return true;
  } catch (error) {
    console.error("❌ Firestore 시드 오류:", error);
    throw error;
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByName(name: string): Promise<User | null> {
  const q = query(collection(db, "users"), where("name", "==", name));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return docToUser(snap.docs[0].id, snap.docs[0].data());
}

export async function getUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => docToUser(d.id, d.data()));
}

export async function createUser(user: Omit<User, "id">): Promise<User> {
  const ref = await addDoc(collection(db, "users"), user);
  return { ...user, id: ref.id };
}

export async function updateUser(id: string, data: Partial<User>): Promise<void> {
  await updateDoc(doc(db, "users", id), data as DocumentData);
}

// ─── Projects ────────────────────────────────────────────────────────────────

export function subscribeProjects(callback: (projects: Project[]) => void) {
  return onSnapshot(collection(db, "projects"), (snap) => {
    const projects = snap.docs.map((d) => docToProject(d.id, d.data()));
    projects.sort((a, b) => a.id.localeCompare(b.id));
    callback(projects);
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, "projects", id));
  if (!snap.exists()) return null;
  return docToProject(snap.id, snap.data());
}

export async function createProject(data: Omit<Project, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "projects"), {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
  });
  return ref.id;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  const payload: DocumentData = { ...data };
  if (data.startDate) payload.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate) payload.endDate = Timestamp.fromDate(data.endDate);
  await updateDoc(doc(db, "projects", id), payload);
}

// ─── Checklist Items ─────────────────────────────────────────────────────────

export function subscribeChecklistItems(
  projectId: string,
  callback: (items: ChecklistItem[]) => void
) {
  const q = query(collection(db, "checklistItems"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => docToChecklistItem(d.id, d.data()));
    callback(items);
  });
}

export function subscribeAllChecklistItems(callback: (items: ChecklistItem[]) => void) {
  return onSnapshot(collection(db, "checklistItems"), (snap) => {
    const items = snap.docs.map((d) => docToChecklistItem(d.id, d.data()));
    callback(items);
  });
}

export function subscribeChecklistItemsByAssignee(
  assigneeName: string,
  callback: (items: ChecklistItem[]) => void
) {
  const q = query(collection(db, "checklistItems"), where("assignee", "==", assigneeName));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => docToChecklistItem(d.id, d.data()));
    callback(items);
  });
}

export async function getChecklistItem(id: string): Promise<ChecklistItem | null> {
  const snap = await getDoc(doc(db, "checklistItems", id));
  if (!snap.exists()) return null;
  return docToChecklistItem(snap.id, snap.data());
}

export async function updateChecklistItem(
  id: string,
  data: Partial<ChecklistItem>
): Promise<void> {
  const payload: DocumentData = { ...data };
  if (data.dueDate) payload.dueDate = Timestamp.fromDate(data.dueDate);
  if (data.completedDate) payload.completedDate = Timestamp.fromDate(data.completedDate);
  await updateDoc(doc(db, "checklistItems", id), payload);
}

export async function completeTask(taskId: string): Promise<void> {
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "completed",
    completedDate: Timestamp.now(),
    approvalStatus: "pending",
  });

  // 자동 알림: 검토자에게 승인 요청 알림 + 프로젝트 통계 재계산
  try {
    const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();

      // 프로젝트 통계 재계산
      if (taskData.projectId) {
        await recalculateProjectStats(taskData.projectId);
      }

      // reviewer 이름으로 사용자 찾기
      const usersQ = query(collection(db, "users"), where("name", "==", taskData.reviewer));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        const reviewerUser = usersSnap.docs[0];
        await addDoc(collection(db, "notifications"), {
          userId: reviewerUser.id,
          type: "approval_request",
          title: "승인 대기",
          message: `${taskData.assignee}님이 "${taskData.title}" 작업을 완료했습니다. 검토가 필요합니다.`,
          link: `/task?projectId=${taskData.projectId}&taskId=${taskId}`,
          read: false,
          createdAt: Timestamp.now(),
        });
      }
    }
  } catch (e) {
    console.error("알림 생성 실패:", e);
  }
}

export async function approveTask(taskId: string, reviewerName: string): Promise<void> {
  await updateDoc(doc(db, "checklistItems", taskId), {
    approvedBy: reviewerName,
    approvedAt: Timestamp.now(),
    approvalStatus: "approved",
  });

  // 자동 알림: 담당자에게 승인 완료 알림 + 프로젝트 통계 재계산
  try {
    const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();

      // 프로젝트 통계 재계산 (승인 → 스테이지 자동 전환 포함)
      if (taskData.projectId) {
        await recalculateProjectStats(taskData.projectId);
      }

      const usersQ = query(collection(db, "users"), where("name", "==", taskData.assignee));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        const assigneeUser = usersSnap.docs[0];
        await addDoc(collection(db, "notifications"), {
          userId: assigneeUser.id,
          type: "approval_request",
          title: "승인 완료",
          message: `${reviewerName}님이 "${taskData.title}" 작업을 승인했습니다.`,
          link: `/task?projectId=${taskData.projectId}&taskId=${taskId}`,
          read: false,
          createdAt: Timestamp.now(),
        });
      }
    }
  } catch (e) {
    console.error("알림 생성 실패:", e);
  }
}

export async function rejectTask(
  taskId: string,
  reviewerName: string,
  reason: string
): Promise<void> {
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "rejected",
    approvalStatus: "rejected",
    rejectedBy: reviewerName,
    rejectedAt: Timestamp.now(),
    rejectionReason: reason,
  });

  // 자동 알림: 담당자에게 반려 알림 + 프로젝트 통계 재계산
  try {
    const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
    if (taskSnap.exists()) {
      const taskData = taskSnap.data();

      // 프로젝트 통계 재계산
      if (taskData.projectId) {
        await recalculateProjectStats(taskData.projectId);
      }

      const usersQ = query(collection(db, "users"), where("name", "==", taskData.assignee));
      const usersSnap = await getDocs(usersQ);
      if (!usersSnap.empty) {
        const assigneeUser = usersSnap.docs[0];
        await addDoc(collection(db, "notifications"), {
          userId: assigneeUser.id,
          type: "approval_request",
          title: "작업 반려",
          message: `${reviewerName}님이 "${taskData.title}" 작업을 반려했습니다. 사유: ${reason}`,
          link: `/task?projectId=${taskData.projectId}&taskId=${taskId}`,
          read: false,
          createdAt: Timestamp.now(),
        });
      }
    }
  } catch (e) {
    console.error("알림 생성 실패:", e);
  }
}

export async function addComment(
  taskId: string,
  userId: string,
  userName: string,
  content: string
): Promise<void> {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (!taskSnap.exists()) return;

  const existing: TaskComment[] = taskSnap.data().comments || [];
  const newComment: TaskComment = {
    id: `comment-${Date.now()}`,
    userId,
    userName,
    content,
    createdAt: new Date(),
  };

  await updateDoc(doc(db, "checklistItems", taskId), {
    comments: [
      ...existing,
      { ...newComment, createdAt: Timestamp.fromDate(newComment.createdAt) },
    ],
  });
}

// ─── File Upload ────────────────────────────────────────────────────────────

export async function uploadTaskFile(
  taskId: string,
  projectId: string,
  file: File,
  uploadedBy: string
): Promise<FileAttachment> {
  const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const storagePath = `tasks/${projectId}/${taskId}/${fileId}_${file.name}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const attachment: FileAttachment = {
    id: fileId,
    name: file.name,
    url,
    uploadedBy,
    uploadedAt: new Date(),
    size: file.size,
  };

  // Firestore에 파일 목록 업데이트
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  if (taskSnap.exists()) {
    const existing: FileAttachment[] = taskSnap.data().files || [];
    await updateDoc(doc(db, "checklistItems", taskId), {
      files: [...existing, { ...attachment, uploadedAt: Timestamp.fromDate(attachment.uploadedAt) }],
    });
  }

  return attachment;
}

// ─── Task Rework (반려 → 재작업) ──────────────────────────────────────────────

export async function restartTask(taskId: string): Promise<void> {
  const taskSnap = await getDoc(doc(db, "checklistItems", taskId));
  await updateDoc(doc(db, "checklistItems", taskId), {
    status: "in_progress",
    approvalStatus: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    completedDate: null,
  });
  // 프로젝트 통계 재계산
  if (taskSnap.exists() && taskSnap.data().projectId) {
    await recalculateProjectStats(taskSnap.data().projectId);
  }
}

// ─── Project Stats Recalculation ─────────────────────────────────────────────

export async function recalculateProjectStats(projectId: string): Promise<void> {
  const q = query(collection(db, "checklistItems"), where("projectId", "==", projectId));
  const snap = await getDocs(q);
  const tasks = snap.docs.map((d) => d.data());

  if (tasks.length === 0) return;

  // Progress: % of tasks completed+approved
  const completedOrApproved = tasks.filter(
    (t) => t.status === "completed" || t.approvalStatus === "approved"
  ).length;
  const progress = Math.round((completedOrApproved / tasks.length) * 100);

  // Risk level: based on overdue tasks
  const now = new Date();
  const overdue = tasks.filter(
    (t) => t.status !== "completed" && t.approvalStatus !== "approved" && toDate(t.dueDate) < now
  ).length;
  const overdueRatio = overdue / tasks.length;
  const riskLevel = overdueRatio > 0.3 ? "red" : overdueRatio > 0.1 ? "yellow" : "green";

  // Current stage: the latest stage that has in_progress or pending tasks
  const stageOrder = [
    "발의검토", "발의승인", "기획검토", "기획승인",
    "WM제작", "WM승인회", "Tx단계", "Tx승인회",
    "MasterGatePilot", "MSG승인회", "양산", "영업이관",
  ];
  let currentStage = stageOrder[0];
  for (const stage of stageOrder) {
    const stageTasks = tasks.filter((t) => t.stage === stage);
    if (stageTasks.length > 0) {
      const allDone = stageTasks.every(
        (t) => t.status === "completed" && (t.approvalStatus === "approved" || !t.approvalStatus)
      );
      if (!allDone) {
        currentStage = stage;
        break;
      }
      currentStage = stage; // keep advancing
    }
  }

  await updateDoc(doc(db, "projects", projectId), {
    progress,
    riskLevel,
    currentStage,
  });
}

// ─── Change Requests ─────────────────────────────────────────────────────────

export function subscribeChangeRequests(
  projectId: string,
  callback: (changes: ChangeRequest[]) => void
) {
  const q = query(collection(db, "changeRequests"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => docToChangeRequest(d.id, d.data()));
    callback(items);
  });
}

export async function createChangeRequest(
  data: Omit<ChangeRequest, "id">
): Promise<string> {
  const ref = await addDoc(collection(db, "changeRequests"), {
    ...data,
    requestedAt: Timestamp.fromDate(data.requestedAt),
  });
  return ref.id;
}

export async function updateChangeRequest(
  id: string,
  data: Partial<ChangeRequest>
): Promise<void> {
  const payload: DocumentData = { ...data };
  if (data.requestedAt) payload.requestedAt = Timestamp.fromDate(data.requestedAt);
  await updateDoc(doc(db, "changeRequests", id), payload);
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function subscribeNotifications(
  userId: string,
  callback: (notifs: Notification[]) => void
) {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  return onSnapshot(q, (snap) => {
    const notifs = snap.docs
      .map((d) => docToNotification(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(notifs);
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function createNotification(
  data: Omit<Notification, "id">
): Promise<void> {
  await addDoc(collection(db, "notifications"), {
    ...data,
    createdAt: Timestamp.fromDate(data.createdAt),
  });
}

// ─── Template Stages & Departments ───────────────────────────────────────────

export async function getTemplateStages() {
  const snap = await getDocs(collection(db, "templateStages"));
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .sort((a: DocumentData, b: DocumentData) => a.order - b.order);
}

export async function getTemplateDepartments() {
  const snap = await getDocs(collection(db, "templateDepartments"));
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .sort((a: DocumentData, b: DocumentData) => a.order - b.order);
}

// ─── Template Items ───────────────────────────────────────────────────────────

export function subscribeTemplateItems(
  stageId: string,
  departmentId: string,
  callback: (items: ChecklistTemplateItem[]) => void
) {
  const q = query(
    collection(db, "templateItems"),
    where("stageId", "==", stageId),
    where("departmentId", "==", departmentId)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({
        ...d.data(),
        id: d.id,
        createdAt: toDate(d.data().createdAt),
        lastModifiedAt: toDate(d.data().lastModifiedAt),
      } as ChecklistTemplateItem))
      .sort((a, b) => a.order - b.order);
    callback(items);
  });
}

export function subscribeAllTemplateItems(
  callback: (items: ChecklistTemplateItem[]) => void
) {
  return onSnapshot(collection(db, "templateItems"), (snap) => {
    const items = snap.docs
      .map((d) => ({
        ...d.data(),
        id: d.id,
        createdAt: toDate(d.data().createdAt),
        lastModifiedAt: toDate(d.data().lastModifiedAt),
      } as ChecklistTemplateItem))
      .sort((a, b) => a.order - b.order);
    callback(items);
  });
}

export async function addTemplateItem(
  data: Omit<ChecklistTemplateItem, "id">
): Promise<string> {
  const ref = await addDoc(collection(db, "templateItems"), {
    ...data,
    createdAt: Timestamp.now(),
    lastModifiedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateTemplateItem(
  id: string,
  data: Partial<ChecklistTemplateItem>
): Promise<void> {
  await updateDoc(doc(db, "templateItems", id), {
    ...data,
    lastModifiedAt: Timestamp.now(),
  });
}

export async function deleteTemplateItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "templateItems", id));
}

export async function reorderTemplateItems(
  items: { id: string; order: number }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    batch.update(doc(db, "templateItems", item.id), {
      order: item.order,
      lastModifiedAt: Timestamp.now(),
    });
  }
  await batch.commit();
}

export async function addTemplateStage(data: {
  name: string;
  workStageName: string;
  gateStageName: string;
  createdBy: string;
}): Promise<string> {
  const stagesSnap = await getDocs(collection(db, "templateStages"));
  const maxOrder = stagesSnap.docs.reduce(
    (max, d) => Math.max(max, d.data().order ?? 0),
    -1
  );
  const ref = await addDoc(collection(db, "templateStages"), {
    ...data,
    order: maxOrder + 1,
    createdAt: Timestamp.now(),
    lastModifiedBy: data.createdBy,
    lastModifiedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function deleteTemplateStage(stageId: string): Promise<void> {
  // 관련 items도 삭제
  const q = query(collection(db, "templateItems"), where("stageId", "==", stageId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "templateStages", stageId));
  await batch.commit();
}

export async function addTemplateDepartment(data: {
  name: string;
  createdBy: string;
}): Promise<string> {
  const deptsSnap = await getDocs(collection(db, "templateDepartments"));
  const maxOrder = deptsSnap.docs.reduce(
    (max, d) => Math.max(max, d.data().order ?? 0),
    -1
  );
  const ref = await addDoc(collection(db, "templateDepartments"), {
    ...data,
    order: maxOrder + 1,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

// ─── Template Item Lookup by Name ────────────────────────────────────────────

export async function getTemplateItemsByStageAndDept(
  stageName: string,
  deptName: string
): Promise<ChecklistTemplateItem[]> {
  // Find the phase whose workStageName or gateStageName matches
  const stagesSnap = await getDocs(collection(db, "templateStages"));
  const stage = stagesSnap.docs.find((d) => {
    const data = d.data();
    return data.name === stageName || data.workStageName === stageName || data.gateStageName === stageName;
  });
  if (!stage) return [];

  // Find the department ID by name
  const deptsSnap = await getDocs(collection(db, "templateDepartments"));
  const dept = deptsSnap.docs.find((d) => d.data().name === deptName);
  if (!dept) return [];

  // Fetch template items for this stage+department
  const q = query(
    collection(db, "templateItems"),
    where("stageId", "==", stage.id),
    where("departmentId", "==", dept.id)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({
      ...d.data(),
      id: d.id,
      createdAt: toDate(d.data().createdAt),
      lastModifiedAt: toDate(d.data().lastModifiedAt),
    } as ChecklistTemplateItem))
    .sort((a, b) => a.order - b.order);
}

export async function deleteTemplateDepartment(deptId: string): Promise<void> {
  // 관련 items도 삭제
  const q = query(collection(db, "templateItems"), where("departmentId", "==", deptId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "templateDepartments", deptId));
  await batch.commit();
}
