// ═══════════════════════════════════════════════════════════════════════════════
// Sales / Launch Management Service — Firestore CRUD + real-time subscriptions
// Independent module replacing hardcoded sales logic in firestore-service.js
// ═══════════════════════════════════════════════════════════════════════════════

import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, writeBatch, onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase-init.js";

// ─── Timestamp helpers ──────────────────────────────────────────────────────

function toDate(val) {
  if (val && typeof val.toDate === "function") return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") return new Date(val);
  return new Date();
}

// ─── Document converters ────────────────────────────────────────────────────

function docToPipelineStage(id, data) {
  return { ...data, id };
}

function docToCategory(id, data) {
  return { ...data, id };
}

function docToTemplateItem(id, data) {
  return { ...data, id };
}

function docToLaunchChecklist(id, data) {
  return {
    ...data,
    id,
    dueDate: data.dueDate ? toDate(data.dueDate) : undefined,
    completedDate: data.completedDate ? toDate(data.completedDate) : undefined,
    checkedBy: data.checkedBy || null,
    checkedAt: data.checkedAt ? toDate(data.checkedAt) : null,
    checkedNote: data.checkedNote || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline Stages CRUD — launchPipelineStages collection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 파이프라인 단계 실시간 구독 (order 순)
 * @param {Function} callback - 단계 배열을 받는 콜백
 * @returns {Function} unsubscribe 함수
 */
export function subscribeLaunchPipelineStages(callback) {
  const q = query(collection(db, "launchPipelineStages"), orderBy("order"));
  return onSnapshot(q, (snap) => {
    const stages = snap.docs.map(d => docToPipelineStage(d.id, d.data()));
    callback(stages);
  });
}

/**
 * 파이프라인 단계 추가
 */
export async function addLaunchPipelineStage({ key, label, icon, order }) {
  const docRef = await addDoc(collection(db, "launchPipelineStages"), {
    key,
    label,
    icon,
    order,
  });
  return docRef.id;
}

/**
 * 파이프라인 단계 수정
 */
export async function updateLaunchPipelineStage(id, data) {
  await updateDoc(doc(db, "launchPipelineStages", id), data);
}

/**
 * 파이프라인 단계 삭제
 * — 이 단계를 참조하는 카테고리가 있으면 삭제 불가
 */
export async function deleteLaunchPipelineStage(id) {
  // 참조 확인: 이 stage를 사용하는 카테고리가 있는지 체크
  const q = query(collection(db, "launchCategories"), where("pipelineStageId", "==", id));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("이 단계에 속한 카테고리가 있어 삭제할 수 없습니다.");
  }
  await deleteDoc(doc(db, "launchPipelineStages", id));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Categories CRUD — launchCategories collection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 카테고리 실시간 구독 (order 순)
 * @param {Function} callback - 카테고리 배열을 받는 콜백
 * @returns {Function} unsubscribe 함수
 */
export function subscribeLaunchCategories(callback) {
  const q = query(collection(db, "launchCategories"), orderBy("order"));
  return onSnapshot(q, (snap) => {
    const categories = snap.docs.map(d => docToCategory(d.id, d.data()));
    callback(categories);
  });
}

/**
 * 카테고리 추가
 */
export async function addLaunchCategory({ key, label, pipelineStageId, order }) {
  const docRef = await addDoc(collection(db, "launchCategories"), {
    key,
    label,
    pipelineStageId,
    order,
  });
  return docRef.id;
}

/**
 * 카테고리 수정
 */
export async function updateLaunchCategory(id, data) {
  await updateDoc(doc(db, "launchCategories", id), data);
}

/**
 * 카테고리 삭제
 * — 이 카테고리를 참조하는 템플릿 항목이 있으면 삭제 불가
 */
export async function deleteLaunchCategory(id) {
  // 카테고리 문서에서 key를 가져온다
  const catSnap = await getDoc(doc(db, "launchCategories", id));
  if (!catSnap.exists()) return;
  const catKey = catSnap.data().key;

  // 참조 확인: 이 categoryKey를 사용하는 템플릿 항목이 있는지 체크
  const q = query(collection(db, "launchTemplateItems"), where("categoryKey", "==", catKey));
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("이 카테고리에 속한 항목이 있어 삭제할 수 없습니다.");
  }
  await deleteDoc(doc(db, "launchCategories", id));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template Items CRUD — launchTemplateItems collection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 템플릿 항목 실시간 구독
 * @param {Function} callback - 템플릿 항목 배열을 받는 콜백
 * @returns {Function} unsubscribe 함수
 */
export function subscribeLaunchTemplateItems(callback) {
  return onSnapshot(collection(db, "launchTemplateItems"), (snap) => {
    const items = snap.docs.map(d => docToTemplateItem(d.id, d.data()));
    callback(items);
  });
}

/**
 * 템플릿 항목 추가
 * @param {Object} data - { code, categoryKey, title, department, dDayOffset, durationDays, isRequired, perCustomer }
 */
export async function addLaunchTemplateItem(data) {
  const docRef = await addDoc(collection(db, "launchTemplateItems"), {
    code: data.code,
    categoryKey: data.categoryKey,
    title: data.title,
    department: data.department,
    dDayOffset: data.dDayOffset,
    durationDays: data.durationDays,
    isRequired: data.isRequired ?? false,
    perCustomer: data.perCustomer ?? false,
  });
  return docRef.id;
}

/**
 * 템플릿 항목 수정
 */
export async function updateLaunchTemplateItem(id, data) {
  await updateDoc(doc(db, "launchTemplateItems", id), data);
}

/**
 * 템플릿 항목 삭제
 */
export async function deleteLaunchTemplateItem(id) {
  await deleteDoc(doc(db, "launchTemplateItems", id));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Launch Checklists (project-specific) — launchChecklists collection
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 특정 프로젝트의 출시 체크리스트 실시간 구독
 * @param {string} projectId
 * @param {Function} callback
 * @returns {Function} unsubscribe 함수
 */
export function subscribeLaunchChecklistsByProject(projectId, callback) {
  const q = query(collection(db, "launchChecklists"), where("projectId", "==", projectId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => docToLaunchChecklist(d.id, d.data()));
    items.sort((a, b) => a.dDayOffset - b.dDayOffset);
    callback(items);
  });
}

/**
 * 특정 담당자의 미완료 출시 체크리스트 실시간 구독
 * @param {string} assigneeName
 * @param {Function} callback
 * @returns {Function} unsubscribe 함수
 */
export function subscribeLaunchChecklistsByAssignee(assigneeName, callback) {
  const q = query(
    collection(db, "launchChecklists"),
    where("assignee", "==", assigneeName),
    where("status", "!=", "completed"),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => docToLaunchChecklist(d.id, d.data()));
    items.sort((a, b) => a.dDayOffset - b.dDayOffset);
    callback(items);
  });
}

/**
 * 전체 출시 체크리스트 구독 (command center 뷰용)
 * @param {Function} callback
 * @returns {Function} unsubscribe 함수
 */
export function subscribeAllLaunchChecklists(callback) {
  return onSnapshot(collection(db, "launchChecklists"), (snap) => {
    const items = snap.docs.map(d => docToLaunchChecklist(d.id, d.data()));
    items.sort((a, b) => a.dDayOffset - b.dDayOffset);
    callback(items);
  });
}

/**
 * 출시 체크리스트 완료 처리
 */
export async function completeLaunchChecklist(id) {
  await updateDoc(doc(db, "launchChecklists", id), {
    status: "completed",
    completedDate: Timestamp.now(),
  });
}

/**
 * 출시 체크리스트 일반 업데이트
 */
export async function updateLaunchChecklist(id, payload) {
  const data = { ...payload };
  if (data.dueDate instanceof Date) data.dueDate = Timestamp.fromDate(data.dueDate);
  if (data.completedDate instanceof Date) data.completedDate = Timestamp.fromDate(data.completedDate);
  await updateDoc(doc(db, "launchChecklists", id), data);
}

/**
 * 출시 체크리스트 확인 처리 (담당자 확인)
 */
export async function confirmLaunchChecklist(id, checkedBy, checkedNote = "") {
  await updateDoc(doc(db, "launchChecklists", id), {
    checkedBy,
    checkedAt: Timestamp.now(),
    checkedNote,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Apply Template to Project
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 출시 준비 템플릿을 프로젝트에 적용
 * — Firestore의 launchTemplateItems를 읽어 launchChecklists에 생성
 * — perCustomer 항목은 고객 수만큼 곱해서 생성
 *
 * @param {string} projectId
 * @param {Date|string} endDate - 프로젝트 종료일 (D-Day 기준)
 * @param {Array} customers - [{id, name}] 고객 목록
 * @returns {number} 생성된 항목 수
 */
export async function applyLaunchTemplate(projectId, endDate, customers = []) {
  // 1. Firestore에서 템플릿 항목 읽기
  const templateSnap = await getDocs(collection(db, "launchTemplateItems"));
  if (templateSnap.empty) {
    throw new Error("출시 준비 템플릿이 비어있습니다.");
  }

  const templates = templateSnap.docs.map(d => ({ ...d.data(), _docId: d.id }));
  const baseDate = endDate instanceof Date ? endDate : new Date(endDate);

  // 고객 목록 정규화: [{id, name}] 또는 [id] (하위호환)
  const custList = customers.map(c => (typeof c === "string" ? { id: c, name: "" } : c));

  // 2. 체크리스트 항목 생성
  const items = [];
  for (const tmpl of templates) {
    if (tmpl.perCustomer && custList.length > 0) {
      // 거래처별 항목: 각 고객마다 하나씩 생성
      for (const cust of custList) {
        items.push({
          projectId,
          categoryKey: tmpl.categoryKey,
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
          templateItemId: tmpl._docId,
        });
      }
    } else {
      items.push({
        projectId,
        categoryKey: tmpl.categoryKey,
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
        templateItemId: tmpl._docId,
      });
    }
  }

  // 3. Batch write (450 limit)
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

// ═══════════════════════════════════════════════════════════════════════════════
// Sync Template to Projects
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 템플릿 변경사항을 기존 프로젝트 체크리스트에 동기화
 * — 제목/필수 여부 변경 반영
 * — 새로운 템플릿 항목을 기존 프로젝트에 추가
 *
 * @returns {{ updated: number, added: number }}
 */
export async function syncLaunchTemplateToProjects() {
  // 1. 전체 템플릿 항목 읽기
  const templateSnap = await getDocs(collection(db, "launchTemplateItems"));
  const templates = {};
  templateSnap.docs.forEach(d => {
    templates[d.id] = { ...d.data(), _docId: d.id };
  });

  // 2. templateItemId가 있는 모든 체크리스트 읽기
  const checklistSnap = await getDocs(collection(db, "launchChecklists"));
  const checklists = checklistSnap.docs
    .filter(d => d.data().templateItemId)
    .map(d => ({ ...d.data(), _ref: d.ref, _docId: d.id }));

  // 프로젝트별로 존재하는 templateItemId 매핑
  const projectTemplateMap = {}; // { projectId: Set<templateItemId> }
  const projectEndDates = {};     // { projectId: dueDate 역산용 }

  for (const cl of checklists) {
    if (!projectTemplateMap[cl.projectId]) {
      projectTemplateMap[cl.projectId] = new Set();
    }
    projectTemplateMap[cl.projectId].add(cl.templateItemId);
    // endDate 역산: dueDate - dDayOffset
    if (!projectEndDates[cl.projectId] && cl.dueDate && cl.dDayOffset !== undefined) {
      const due = cl.dueDate instanceof Date ? cl.dueDate : toDate(cl.dueDate);
      projectEndDates[cl.projectId] = new Date(due.getTime() - cl.dDayOffset * 86400000);
    }
  }

  let updated = 0;
  let added = 0;
  const BATCH_LIMIT = 450;
  const writes = [];

  // 3. 기존 체크리스트 업데이트 (제목/필수 여부 변경)
  for (const cl of checklists) {
    const tmpl = templates[cl.templateItemId];
    if (!tmpl) continue;

    const changes = {};
    if (cl.title !== tmpl.title) changes.title = tmpl.title;
    if (cl.isRequired !== tmpl.isRequired) changes.isRequired = tmpl.isRequired;

    if (Object.keys(changes).length > 0) {
      writes.push({ type: "update", ref: cl._ref, data: changes });
      updated++;
    }
  }

  // 4. 새로운 템플릿 항목을 기존 프로젝트에 추가
  for (const [projectId, existingSet] of Object.entries(projectTemplateMap)) {
    const baseDate = projectEndDates[projectId];
    if (!baseDate) continue;

    for (const [tmplId, tmpl] of Object.entries(templates)) {
      if (existingSet.has(tmplId)) continue;

      // 새로운 항목 추가
      writes.push({
        type: "add",
        data: {
          projectId,
          categoryKey: tmpl.categoryKey,
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
          templateItemId: tmplId,
        },
      });
      added++;
    }
  }

  // 5. Batch commit
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH_LIMIT).forEach(w => {
      if (w.type === "update") {
        batch.update(w.ref, w.data);
      } else {
        batch.set(doc(collection(db, "launchChecklists")), w.data);
      }
    });
    await batch.commit();
  }

  console.log(`✅ 템플릿 동기화 완료: ${updated}건 업데이트, ${added}건 추가`);
  return { updated, added };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Recalculate Due Dates
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * D-Day 재계산: 프로젝트 endDate 변경 시 미완료 launchChecklist의 dueDate 업데이트
 *
 * @param {string} projectId
 * @param {Date|string} newEndDate
 * @returns {number} 업데이트된 항목 수
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

// ═══════════════════════════════════════════════════════════════════════════════
// Category Labels — backward compat + dynamic Firestore version
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 하드코딩 카테고리 레이블 (하위호환용)
 */
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

/**
 * Firestore launchCategories 컬렉션에서 동적으로 카테고리 레이블을 구독
 * — 콜백에 { key: label } 맵을 전달
 *
 * @param {Function} callback - { [key]: label } 객체를 받는 콜백
 * @returns {Function} unsubscribe 함수
 */
export function getLaunchCategoryLabelsFromFirestore(callback) {
  const q = query(collection(db, "launchCategories"), orderBy("order"));
  return onSnapshot(q, (snap) => {
    const labels = {};
    snap.docs.forEach(d => {
      const data = d.data();
      labels[data.key] = data.label;
    });
    callback(labels);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Constants re-export
// ═══════════════════════════════════════════════════════════════════════════════

export const CUSTOMER_TYPE_LABELS = {
  dealer: "대리점",
  subsidiary: "해외 법인",
  hospital: "병원/의료기관",
  online: "온라인 채널",
};
