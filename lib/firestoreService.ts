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
import { db } from "./firebase";
import type {
  User,
  Project,
  ChecklistItem,
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

    // Template Stages
    const templateStages = [
      { id: "stage-0", name: "0. 발의 검토", order: 0, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-1", name: "1. 발의 승인", order: 1, type: "gate", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-2", name: "2. 기획 검토", order: 2, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-3", name: "3. 기획 승인", order: 3, type: "gate", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-4", name: "4. W/M 제작", order: 4, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-5", name: "5. W/M 승인회", order: 5, type: "gate", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-6", name: "6. Tx 단계", order: 6, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-7", name: "7. Tx 승인회", order: 7, type: "gate", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-8", name: "8. Master Gate Pilot", order: 8, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-9", name: "9. MSG 승인회", order: 9, type: "gate", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-10", name: "10. 양산", order: 10, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "stage-11", name: "11. 영업 이관", order: 11, type: "work", createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
    ];
    for (const s of templateStages) {
      batch.set(doc(db, "templateStages", s.id), s);
    }

    // Template Departments
    const templateDepartments = [
      { id: "dept-dev", name: "개발팀", order: 0, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-quality", name: "품질팀", order: 1, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-sales", name: "영업팀", order: 2, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-mfg", name: "제조팀", order: 3, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-purchase", name: "구매팀", order: 4, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-cs", name: "CS팀", order: 5, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-mgmt", name: "경영관리팀", order: 6, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-clinical", name: "글로벌임상팀", order: 7, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-design", name: "디자인연구소", order: 8, createdBy: "system", createdAt: Timestamp.now() },
      { id: "dept-cert", name: "인증팀", order: 9, createdBy: "system", createdAt: Timestamp.now() },
    ];
    for (const d of templateDepartments) {
      batch.set(doc(db, "templateDepartments", d.id), d);
    }

    // Template Items (초기 샘플)
    const templateItems = [
      { id: "ti-1", stageId: "stage-0", departmentId: "dept-dev", content: "NABC 문서가 작성되었는가?", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-2", stageId: "stage-0", departmentId: "dept-dev", content: "Needs(필요성) 항목이 작성되었는가?", order: 1, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-3", stageId: "stage-0", departmentId: "dept-sales", content: "시장 니즈 조사 자료가 있는가?", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-4", stageId: "stage-2", departmentId: "dept-dev", content: "요구사항 문서 작성 완료", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-5", stageId: "stage-2", departmentId: "dept-dev", content: "기술 스펙 문서 작성 완료", order: 1, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-6", stageId: "stage-2", departmentId: "dept-dev", content: "관련 부서 검토 완료", order: 2, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-7", stageId: "stage-2", departmentId: "dept-dev", content: "예산 검토 완료", order: 3, isRequired: false, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-8", stageId: "stage-2", departmentId: "dept-dev", content: "일정 검토 완료", order: 4, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-9", stageId: "stage-4", departmentId: "dept-dev", content: "설계 도면 완성 여부 확인", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
      { id: "ti-10", stageId: "stage-4", departmentId: "dept-quality", content: "품질 계획서가 수립되었는가?", order: 0, isRequired: true, createdBy: "system", createdAt: Timestamp.now(), lastModifiedBy: "system", lastModifiedAt: Timestamp.now() },
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
  });
}

export async function approveTask(taskId: string, reviewerName: string): Promise<void> {
  // 실제 서비스에서는 별도 "approved" 상태를 추가하거나
  // 현재 구조에서는 completed = 최종 승인 완료로 처리
  // 여기서는 approvedBy, approvedAt 필드를 추가
  await updateDoc(doc(db, "checklistItems", taskId), {
    approvedBy: reviewerName,
    approvedAt: Timestamp.now(),
    approvalStatus: "approved",
  });
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
  type: "work" | "gate";
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

export async function deleteTemplateDepartment(deptId: string): Promise<void> {
  // 관련 items도 삭제
  const q = query(collection(db, "templateItems"), where("departmentId", "==", deptId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "templateDepartments", deptId));
  await batch.commit();
}
