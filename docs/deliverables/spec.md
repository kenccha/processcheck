# ProcessCheck 개발자용 기능 명세서

> **문서 버전**: 1.0
> **작성일**: 2026-03-11
> **대상 독자**: 개발자, QA 엔지니어, 시스템 관리자

---

## 1. 시스템 개요

### 1.1 목적

ProcessCheck는 **전자 의료기기 제품 개발 프로세스 관리 시스템**이다. 제품의 발의부터 양산/영업이관까지 6개 Phase에 걸친 체크리스트 기반 업무 추적, 승인 워크플로우, 부서간 협업을 지원한다.

### 1.2 대상 사용자

| 역할 | 코드 | 설명 |
|------|------|------|
| 실무자 (Worker) | `worker` | 태스크 수행, 체크리스트 완료, 파일 업로드, 코멘트 작성 |
| 매니저 (Manager) | `manager` | 부서별 관리자. Work Stage 작업 승인/반려, 자기 부서 체크리스트 편집 |
| 기획조정실 (Observer) | `observer` | 전체 프로젝트 모니터링, Gate Stage 최종 승인, 스테이지/부서 관리 |

### 1.3 핵심 가치

- **투명성**: 모든 부서가 프로젝트 진행 상황을 실시간으로 확인
- **프로세스 준수**: ISO 13485 / IEC 62304 / FDA 규제 기반 193개 템플릿 체크리스트
- **부서간 협업**: 10개 부서 × 6 Phase 매트릭스 기반 업무 배분
- **이중 승인 체계**: 매니저 승인(Work Stage) + 위원회 승인(Gate Stage)

---

## 2. 기술 스택 상세

### 2.1 Next.js App (Primary)

| 항목 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (React) | 15 (React 18) |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 3.4 |
| Backend | Firebase Firestore / Auth / Storage | SDK v12.9 |
| Build Mode | Static Export (`output: "export"`) | - |
| Deployment | GitHub Pages (GitHub Actions) | - |
| Linting | ESLint (`next/core-web-vitals`, `next/typescript`) | - |

### 2.2 HTML Port (`processcheck-html/`)

| 항목 | 기술 | 버전 |
|------|------|------|
| Framework | None (Vanilla JS ES Modules) | - |
| Firebase SDK | CDN via `<script type="importmap">` | v11.3.0 |
| Styling | CSS Custom Properties (`css/styles.css`) | - |
| Dev Server | `python3 -m http.server 8080` | - |

HTML Port는 Next.js 앱의 수동 포팅 버전으로, 빌드 없이 배포 가능하다. 동일한 Firestore 백엔드를 공유한다.

### 2.3 테마 시스템

- **기본**: 라이트 모드 (`:root` CSS 변수)
- **다크 모드**: `[data-theme="dark"]` 속성 기반 CSS 변수 오버라이드
- **저장**: `localStorage("pc-theme")`
- **플래시 방지**: 각 HTML 파일의 `<head>`에 inline `<script>`로 테마 즉시 적용

---

## 3. 인증 체계

### 3.1 데모 카드 로그인

빌드 단계 없이 즉시 테스트 가능한 데모 인증 방식이다.

| 카드 | 이름 | 역할 | 부서 |
|------|------|------|------|
| 1 | 김철수 | worker | 개발팀 |
| 2 | 이영희 | manager | 개발팀 |
| 3 | 박민수 | observer | 경영관리팀 |

**흐름**: 카드 클릭 -> `getUserByName()` 으로 Firestore 조회 -> `localStorage("pc_user")`에 저장 -> 대시보드 이동

### 3.2 Microsoft OAuth 로그인

Firebase Authentication과 연동된 실제 인증 방식이다.

**흐름**:
1. `OAuthProvider("microsoft.com")` + `signInWithPopup()` 호출
2. 기존 사용자: `getUserByEmail()`로 Firestore 조회 -> 바로 대시보드
3. 신규 사용자: 역할(3종) + 부서(10종) 선택 화면 표시 -> `createUser()` -> 대시보드
4. `authProvider: "microsoft"` 필드로 데모 사용자와 구분

### 3.3 세션 관리

| 항목 | 방식 |
|------|------|
| 저장소 | `localStorage` (키: `pc_user`) |
| 형식 | JSON 직렬화된 User 객체 |
| 페이지 가드 | `guardPage()` -- 미인증 시 `index.html`로 리다이렉트 |
| 로그아웃 | `localStorage` 제거 + Firebase `signOut()` |

### 3.4 고객 포털 인증

- `sessionStorage` 기반 이메일 인증
- `portalLoginEmail` 일치 확인 + `portalEnabled` 체크
- 읽기 전용 접근 (프로젝트 진행 상황 확인용)

---

## 4. 데이터 모델

### 4.1 Firestore 컬렉션 목록

| 컬렉션 | 용도 | 문서 수 (시드) |
|--------|------|---------------|
| `users` | 사용자 정보 | 7 |
| `projects` | 프로젝트 메타 | 10 |
| `checklistItems` | 작업(체크리스트) 항목 | ~193/프로젝트 |
| `changeRequests` | 설계 변경 요청 | 4 |
| `notifications` | 내부 알림 | 7+ |
| `customers` | 대리점/법인/고객 | 6 |
| `launchChecklists` | 출시 준비 체크리스트 | ~177/프로젝트 |
| `portalNotifications` | 고객 포털 알림 | 3+ |
| `templateStages` | 체크리스트 템플릿 단계 | 6 |
| `templateDepartments` | 체크리스트 템플릿 부서 | 10 |
| `templateItems` | 체크리스트 템플릿 항목 | 193 |

### 4.2 `users` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `name` | string | Y | 사용자 이름 (한국어) |
| `email` | string | Y | 이메일 |
| `role` | string | Y | `"worker"` / `"manager"` / `"observer"` |
| `department` | string | Y | 소속 부서명 |
| `profileImage` | string | N | 프로필 이미지 URL |
| `authProvider` | string | N | `"microsoft"` (OAuth 사용자만) |

### 4.3 `projects` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `name` | string | Y | 프로젝트명 |
| `productType` | string | Y | 제품 유형 (체성분 분석기, 혈압계 등) |
| `projectType` | string | Y | `"신규개발"` / `"설계변경"` |
| `changeScale` | string | N | `"minor"` / `"medium"` / `"major"` (설계변경일 때) |
| `status` | string | Y | `"active"` / `"completed"` / `"on_hold"` |
| `progress` | number | Y | 0-100 (자동 계산) |
| `startDate` | Timestamp | Y | 시작일 |
| `endDate` | Timestamp | Y | 종료일 |
| `pm` | string | Y | PM 이름 |
| `riskLevel` | string | Y | `"green"` / `"yellow"` / `"red"` (자동 계산) |
| `currentStage` | string | Y | 현재 단계명 (자동 계산) |

### 4.4 `checklistItems` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `projectId` | string | Y | 소속 프로젝트 ID |
| `stage` | string | Y | 12개 개별 stage name (예: `"WM제작"`, `"WM승인회"`) |
| `department` | string | Y | 담당 부서명 |
| `title` | string | Y | 작업 제목 |
| `description` | string | Y | 상세 설명 (기본값: `""`) |
| `assignee` | string | Y | 담당자 이름 |
| `reviewer` | string | Y | 검토자(매니저) 이름 |
| `status` | string | Y | `"pending"` / `"in_progress"` / `"completed"` / `"rejected"` |
| `dueDate` | Timestamp | Y | 마감일 |
| `completedDate` | Timestamp | N | 완료일 |
| `files` | array | N | 첨부 파일 배열 `[{id, name, url, uploadedBy, uploadedAt, size}]` |
| `comments` | array | N | 코멘트 배열 `[{id, userId, userName, content, createdAt}]` |
| `dependencies` | array | N | 의존 task ID 배열 |
| `approvalStatus` | string | N | `"pending"` / `"approved"` / `"rejected"` |
| `approvedBy` | string | N | 승인자 이름 |
| `approvedAt` | Timestamp | N | 승인 시각 |
| `rejectedBy` | string | N | 반려자 이름 |
| `rejectedAt` | Timestamp | N | 반려 시각 |
| `rejectionReason` | string | N | 반려 사유 |
| `isRequired` | boolean | N | 필수 항목 여부 |
| `templateItemId` | string | N | 원본 템플릿 항목 ID |

### 4.5 `changeRequests` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `projectId` | string | Y | 관련 프로젝트 ID |
| `title` | string | Y | 변경 요청 제목 |
| `description` | string | Y | 변경 내용 설명 |
| `requestedBy` | string | Y | 요청 부서 |
| `requestedAt` | Timestamp | Y | 요청일 |
| `affectedDepartments` | array | Y | 영향받는 부서 목록 |
| `scale` | string | Y | `"minor"` / `"medium"` / `"major"` |
| `status` | string | Y | `"pending"` / `"in_review"` / `"approved"` / `"rejected"` |
| `readBy` | map | Y | 부서별 읽음 여부 `{"개발팀": true, ...}` |
| `requestSource` | string | N | `"internal"` / `"customer"` |
| `customerId` | string | N | 고객 ID (고객 출처일 때) |
| `customerName` | string | N | 고객명 |
| `customerContactName` | string | N | 고객 담당자명 |
| `customerRequestDate` | Timestamp | N | 고객 요청일 |
| `customerRequestDetail` | string | N | 고객 요청 상세 |

### 4.6 `notifications` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `userId` | string | Y | 대상 사용자 ID |
| `type` | string | Y | `"task_assigned"` / `"approval_request"` / `"deadline_approaching"` / `"change_request"` |
| `title` | string | Y | 알림 제목 |
| `message` | string | Y | 알림 본문 |
| `link` | string | N | 클릭 시 이동 URL |
| `read` | boolean | Y | 읽음 여부 |
| `createdAt` | Timestamp | Y | 생성 시각 |

### 4.7 `customers` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `name` | string | Y | 고객명 |
| `type` | string | Y | `"dealer"` / `"subsidiary"` / `"hospital"` / `"online"` |
| `region` | string | Y | 지역 |
| `contactName` | string | Y | 담당자명 |
| `contactEmail` | string | Y | 담당자 이메일 |
| `contactPhone` | string | Y | 담당자 전화번호 |
| `salesRep` | string | Y | 영업 담당자명 |
| `contractStatus` | string | Y | `"active"` / `"negotiating"` / `"inactive"` |
| `products` | array | Y | 연결된 프로젝트 ID 배열 |
| `notes` | string | N | 메모 |
| `portalEnabled` | boolean | Y | 포털 접근 허용 여부 |
| `portalLoginEmail` | string | N | 포털 로그인 이메일 |
| `portalAccessLevel` | string | N | `"basic"` / `"detailed"` |
| `createdAt` | Timestamp | Y | 생성일 |
| `updatedAt` | Timestamp | Y | 수정일 |

### 4.8 `launchChecklists` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `projectId` | string | Y | 프로젝트 ID |
| `category` | string | Y | 카테고리 코드 (brand, regulatory, sales 등) |
| `code` | string | Y | 항목 코드 (P-01, R-01 등) |
| `title` | string | Y | 항목 제목 |
| `department` | string | Y | 담당 부서 |
| `dDayOffset` | number | Y | D-Day 기준 오프셋 (음수=D-Day 전) |
| `durationDays` | number | Y | 소요 일수 |
| `isRequired` | boolean | Y | 필수 여부 |
| `status` | string | Y | `"pending"` / `"in_progress"` / `"completed"` |
| `assignee` | string | Y | 담당자 |
| `dueDate` | Timestamp | Y | 마감일 (endDate + dDayOffset 자동 계산) |
| `completedDate` | Timestamp | N | 완료일 |
| `customerId` | string | N | 거래처별 항목일 때 고객 ID |
| `customerName` | string | N | 고객명 |
| `checkedBy` | string | N | 확인자 |
| `checkedAt` | Timestamp | N | 확인 시각 |
| `checkedNote` | string | N | 확인 메모 |

### 4.9 `templateStages` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | `"phase0"` ~ `"phase5"` |
| `name` | string | Y | 페이즈명 (발의, 기획, WM, Tx, MSG, 양산/이관) |
| `order` | number | Y | 정렬 순서 (0-5) |
| `workStageName` | string | Y | 작업 단계명 (발의검토, 기획검토 등) |
| `gateStageName` | string | Y | 승인 단계명 (발의승인, 기획승인 등) |
| `createdBy` | string | Y | 생성자 |
| `createdAt` | Timestamp | Y | 생성일 |
| `lastModifiedBy` | string | Y | 수정자 |
| `lastModifiedAt` | Timestamp | Y | 수정일 |

### 4.10 `templateItems` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 항목 ID (`"ti-1"` ~ `"ti-193"`) |
| `stageId` | string | Y | Phase ID 참조 (`"phase0"` ~ `"phase5"`) |
| `departmentId` | string | Y | 부서 ID (`"dept1"` ~ `"dept10"`) |
| `content` | string | Y | 항목 내용 |
| `order` | number | Y | 부서 내 정렬 순서 |
| `isRequired` | boolean | Y | 필수 여부 |
| `createdBy` | string | Y | 생성자 |
| `createdAt` | Timestamp | Y | 생성일 |
| `lastModifiedBy` | string | Y | 수정자 |
| `lastModifiedAt` | Timestamp | Y | 수정일 |

### 4.11 `portalNotifications` 컬렉션

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | string | Y | 문서 ID |
| `customerId` | string | Y | 대상 고객 ID |
| `projectId` | string | Y | 관련 프로젝트 ID |
| `type` | string | Y | `"phase_completed"` / `"request_resolved"` |
| `title` | string | Y | 알림 제목 |
| `message` | string | Y | 알림 본문 |
| `read` | boolean | Y | 읽음 여부 |
| `createdAt` | Timestamp | Y | 생성 시각 |

---

## 5. API / 서비스 함수 목록

> `firestore-service.js` (HTML Port) 및 `firestoreService.ts` (Next.js)에서 추출한 전체 exported 함수 목록이다.

### 5.1 데이터베이스 시드

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `seedDatabaseIfEmpty()` | - | `Promise<boolean>` | users 컬렉션이 비어있을 때 전체 시드 데이터 생성 (사용자, 프로젝트, 변경요청, 알림, 고객, 템플릿, 체크리스트) |

### 5.2 사용자 (Users)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `getUserByName(name)` | `name: string` | `Promise<User\|null>` | 이름으로 사용자 조회 |
| `getUserByEmail(email)` | `email: string` | `Promise<User\|null>` | 이메일로 사용자 조회 |
| `getUsers()` | - | `Promise<User[]>` | 전체 사용자 목록 |
| `createUser(user)` | `user: {name, email, role, department, authProvider?}` | `Promise<User>` | 사용자 생성 |
| `updateUser(id, data)` | `id: string, data: Partial<User>` | `Promise<void>` | 사용자 정보 업데이트 |

### 5.3 프로젝트 (Projects)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribeProjects(callback)` | `callback: (projects: Project[]) => void` | `Unsubscribe` | 전체 프로젝트 실시간 구독 |
| `getProject(id)` | `id: string` | `Promise<Project\|null>` | 단일 프로젝트 조회 |
| `createProject(data)` | `data: ProjectData` | `Promise<string>` | 프로젝트 생성, ID 반환 |
| `updateProject(id, data)` | `id: string, data: Partial<Project>` | `Promise<void>` | 프로젝트 업데이트 |

### 5.4 체크리스트 항목 (Checklist Items)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribeChecklistItems(projectId, callback)` | `projectId, callback` | `Unsubscribe` | 프로젝트별 체크리스트 실시간 구독 |
| `subscribeAllChecklistItems(callback)` | `callback` | `Unsubscribe` | 전체 체크리스트 실시간 구독 |
| `subscribeChecklistItemsByAssignee(name, callback)` | `name, callback` | `Unsubscribe` | 담당자별 체크리스트 구독 |
| `getChecklistItem(id)` | `id: string` | `Promise<ChecklistItem\|null>` | 단일 체크리스트 조회 |
| `updateChecklistItem(id, data)` | `id, data` | `Promise<void>` | 체크리스트 항목 업데이트 |
| `createChecklistItem(data)` | `data` | `Promise<string>` | 새 체크리스트 항목 생성 |
| `completeTask(taskId)` | `taskId: string` | `Promise<void>` | 작업 완료 처리 + `approvalStatus: "pending"` 자동 설정 + 검토자 알림 생성 + 프로젝트 통계 재계산 |
| `approveTask(taskId, reviewerName)` | `taskId, reviewerName` | `Promise<void>` | 작업 승인 + 담당자 알림 + 프로젝트 통계 재계산 + Gate Stage시 포털 알림 |
| `rejectTask(taskId, reviewerName, reason)` | `taskId, reviewerName, reason` | `Promise<void>` | 작업 반려 + 담당자 알림 + 프로젝트 통계 재계산 |
| `restartTask(taskId)` | `taskId: string` | `Promise<void>` | 반려된 작업 재시작 (`in_progress`) + 승인 필드 초기화 + 프로젝트 통계 재계산 |
| `addComment(taskId, userId, userName, content)` | 4개 인자 | `Promise<void>` | 체크리스트 항목에 코멘트 추가 |

### 5.5 프로젝트 통계 자동 계산

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `recalculateProjectStats(projectId)` | `projectId: string` | `Promise<void>` | 프로젝트의 `progress`, `riskLevel`, `currentStage`를 체크리스트 데이터 기반으로 재계산하여 업데이트 |

**계산 로직**:
- `progress`: `(completed 또는 approved 항목 수) / 전체 항목 수 * 100`
- `riskLevel`: 지연 비율 > 30% -> `"red"`, > 10% -> `"yellow"`, 이하 `"green"`
- `currentStage`: 12개 stage 순서대로 탐색, 모든 작업이 완료+승인되지 않은 첫 stage

### 5.6 변경 요청 (Change Requests)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribeChangeRequests(projectId, callback)` | `projectId, callback` | `Unsubscribe` | 프로젝트별 변경 요청 구독 |
| `subscribeAllChangeRequests(callback)` | `callback` | `Unsubscribe` | 전체 변경 요청 구독 |
| `createChangeRequest(data)` | `data` | `Promise<string>` | 변경 요청 생성 |
| `updateChangeRequest(id, data)` | `id, data` | `Promise<void>` | 변경 요청 업데이트 + 고객 출처 승인/반려 시 포털 알림 자동 생성 |

### 5.7 알림 (Notifications)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribeNotifications(userId, callback)` | `userId, callback` | `Unsubscribe` | 사용자별 알림 구독 (최신순 정렬) |
| `markNotificationRead(id)` | `id: string` | `Promise<void>` | 알림 읽음 처리 |
| `createNotification(data)` | `data` | `Promise<void>` | 알림 직접 생성 |

### 5.8 템플릿 관리 (Template Management)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `getTemplateStages()` | - | `Promise<TemplateStage[]>` | 템플릿 단계 목록 (order 순) |
| `getTemplateDepartments()` | - | `Promise<TemplateDepartment[]>` | 템플릿 부서 목록 (order 순) |
| `subscribeAllTemplateItems(callback)` | `callback` | `Unsubscribe` | 전체 템플릿 항목 실시간 구독 |
| `subscribeTemplateItems(stageId, deptId, callback)` | 3개 인자 | `Unsubscribe` | 특정 stage+dept 템플릿 항목 구독 |
| `addTemplateItem(data)` | `data` | `Promise<string>` | 템플릿 항목 추가 |
| `updateTemplateItem(id, data)` | `id, data` | `Promise<void>` | 템플릿 항목 수정 |
| `deleteTemplateItem(id)` | `id: string` | `Promise<void>` | 템플릿 항목 삭제 |
| `reorderTemplateItems(items)` | `items: [{id, order}]` | `Promise<void>` | 템플릿 항목 순서 변경 (batch) |
| `addTemplateStage(data)` | `data: {name, workStageName, gateStageName, createdBy}` | `Promise<string>` | 새 단계 추가 |
| `deleteTemplateStage(stageId)` | `stageId: string` | `Promise<void>` | 단계 삭제 (소속 항목도 함께 삭제) |
| `addTemplateDepartment(data)` | `data` | `Promise<string>` | 새 부서 추가 |
| `deleteTemplateDepartment(deptId)` | `deptId: string` | `Promise<void>` | 부서 삭제 (소속 항목도 함께 삭제) |

### 5.9 템플릿 적용

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `applyTemplateToProject(projectId, projectType, changeScale?)` | 3개 인자 | `Promise<number>` | 193개 템플릿을 프로젝트 유형에 맞게 필터링하여 checklistItems 생성. 생성된 항목 수 반환 |

### 5.10 고객 관리 (Customers)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribeCustomers(callback)` | `callback` | `Unsubscribe` | 전체 고객 실시간 구독 (이름순 정렬) |
| `getCustomer(id)` | `id: string` | `Promise<Customer\|null>` | 단일 고객 조회 |
| `createCustomer(data)` | `data` | `Promise<string>` | 고객 생성 |
| `updateCustomer(id, data)` | `id, data` | `Promise<void>` | 고객 정보 업데이트 |
| `deleteCustomer(id)` | `id: string` | `Promise<void>` | 고객 삭제 |

### 5.11 출시 준비 체크리스트 (Launch Checklists)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribeLaunchChecklists(projectId, callback)` | `projectId, callback` | `Unsubscribe` | 프로젝트별 출시 체크리스트 구독 (dDayOffset 순) |
| `subscribeAllLaunchChecklists(callback)` | `callback` | `Unsubscribe` | 전체 출시 체크리스트 구독 |
| `updateLaunchChecklist(id, data)` | `id, data` | `Promise<void>` | 출시 체크리스트 항목 업데이트 |
| `completeLaunchChecklist(id)` | `id: string` | `Promise<void>` | 출시 체크리스트 완료 처리 |
| `confirmLaunchChecklist(id, checkedBy, note?)` | 3개 인자 | `Promise<void>` | 거래처 확인 처리 |
| `applyLaunchChecklistToProject(projectId, projectType, changeScale, endDate, customers?)` | 5개 인자 | `Promise<number>` | 출시 준비 체크리스트 생성 (177개 기본 템플릿). 거래처별 항목은 customers 배열로 곱해짐 |
| `recalculateLaunchDueDates(projectId, newEndDate)` | 2개 인자 | `Promise<number>` | endDate 변경 시 미완료 항목의 dueDate 일괄 재계산 |

### 5.12 포털 알림 (Portal Notifications)

| 함수명 | 파라미터 | 반환값 | 설명 |
|--------|---------|--------|------|
| `subscribePortalNotifications(customerId, callback)` | `customerId, callback` | `Unsubscribe` | 고객별 포털 알림 구독 |
| `createPortalNotification(data)` | `data` | `Promise<void>` | 포털 알림 생성 |
| `markPortalNotificationRead(id)` | `id: string` | `Promise<void>` | 포털 알림 읽음 처리 |

---

## 6. 페이지별 기능 명세

### 6.1 `index.html` -- 로그인

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `seedDatabaseIfEmpty()`, `getUserByName()`, `loginWithMicrosoft()` |
| **기능** | 데모 카드 3개 표시, Microsoft OAuth 버튼, DB 시딩 중 스피너, 신규 사용자 역할/부서 선택 |
| **권한** | 미인증 페이지 |
| **인터랙션** | 카드 클릭 -> 로그인 -> 대시보드 이동 |

### 6.2 `dashboard.html` -- 대시보드

| 항목 | 내용 |
|------|------|
| **데이터 소스** | 역할별 구독 분리: worker=`subscribeChecklistItemsByAssignee`, manager/observer=`subscribeAllChecklistItems`, `subscribeProjects`, `subscribeNotifications`, `subscribeAllChangeRequests` |
| **기능** | 통계 카드 5개(작업대기, 승인대기, 프로젝트, 알림, 고객요청), 작업 대기 목록, 승인 대기 목록, 프로젝트 현황, 알림 목록, 고객 요청 |
| **권한** | 인증 필수. 역할별 데이터 필터링 |
| **인터랙션** | 통계 카드 클릭(스크롤/네비게이션), 행 클릭(task.html/project.html 이동) |

### 6.3 `projects.html` -- 프로젝트 목록

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `subscribeProjects()`, `subscribeAllChecklistItems()` |
| **기능** | 7개 뷰(테이블/매트릭스/카드/간트/칸반/타임라인/캘린더), 신규개발/설계변경 탭, 정렬(이름/상태/PM/진행률/시작일) |
| **권한** | 인증 필수 |
| **인터랙션** | 뷰 전환, 프로젝트 행 클릭 -> project.html, 캘린더 월 이동 |

### 6.4 `project.html` -- 프로젝트 상세

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `getProject()`, `subscribeChecklistItems()`, `subscribeChangeRequests()`, `subscribeLaunchChecklists()`, `subscribeCustomers()` |
| **기능** | 4개 탭(개요/체크리스트/설계변경/출시준비), Stat 카드 5개(클릭가능), 프로젝트 상태 요약 카드, 체크리스트 필터, 작업 추가 모달, 변경 요청 등록 모달, 템플릿 적용 버튼, 출시 준비 적용 버튼 |
| **권한** | 인증 필수. 매니저/옵저버만 변경 요청 승인/반려 가능 |
| **인터랙션** | Stat 카드 클릭 -> 체크리스트 탭+필터, 작업 행 클릭 -> task.html |

### 6.5 `task.html` -- 작업 상세

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `getChecklistItem()`, `getProject()`, Firestore onSnapshot |
| **기능** | 작업 정보 표시, 타임라인(이벤트별 날짜+행위자), 코멘트, 파일 첨부 UI, 상태 변경 버튼 |
| **권한** | worker: 완료/재작업 버튼, manager: Work Stage 승인/반려, observer: Gate Stage 승인/반려 |
| **인터랙션** | 완료 -> `completeTask()`, 승인 -> `approveTask()`, 반려 -> `rejectTask()`, 재작업 -> `restartTask()`, 코멘트 추가 -> `addComment()` |

### 6.6 `admin-checklists.html` -- 체크리스트 템플릿 관리

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `getTemplateStages()`, `getTemplateDepartments()`, `subscribeAllTemplateItems()`, `subscribeTemplateItems()` |
| **기능** | 3개 뷰(매트릭스/트리/리스트), CRUD(항목 추가/수정/삭제), 드래그앤드롭 순서 변경, 단계/부서 추가 삭제 |
| **권한** | manager: 자기 부서만 편집, observer: 전체 편집 + 단계/부서 추가 삭제 |
| **인터랙션** | 매트릭스 셀 클릭 -> 트리 뷰 전환, 리스트 편집 아이콘 -> 트리 뷰 전환 |

### 6.7 `customers.html` -- 고객 관리

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `subscribeCustomers()`, `subscribeProjects()` |
| **기능** | 고객 목록, 고객 추가/수정/삭제, 연결 프로젝트 표시, 포털 설정 |
| **권한** | 인증 필수 |
| **인터랙션** | 고객 카드 클릭 -> 상세 보기, CRUD 모달 |

### 6.8 `customer-portal.html` -- 고객 포털

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `subscribePortalNotifications()`, `subscribeProjects()`, `subscribeAllChecklistItems()` |
| **기능** | 이메일 인증, 연결된 프로젝트 진행 상황 읽기 전용 뷰, 포털 알림 |
| **권한** | 이메일 인증 필수 (portalLoginEmail 일치 + portalEnabled 체크) |
| **인터랙션** | 프로젝트 진행 단계 확인, 알림 확인 |

### 6.9 `sales.html` -- 영업 출시 대시보드

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `subscribeProjects()`, `subscribeAllLaunchChecklists()`, `subscribeCustomers()` |
| **기능** | 전체 프로젝트 출시 준비 현황, 카테고리별 진행률, D-Day 카운트다운, 거래처별 준비 상태 |
| **권한** | 인증 필수 |
| **인터랙션** | 프로젝트 선택, 카테고리 필터, 항목 완료/확인 처리 |

### 6.10 `manual.html` -- 사용자 매뉴얼

| 항목 | 내용 |
|------|------|
| **데이터 소스** | `docs/manual.md` (빌드 타임 임베드) |
| **기능** | 좌측 사이드바 TOC, ScrollSpy, 실시간 검색, 스크린샷 14개, 10개 섹션 + 용어집 |
| **권한** | 인증 불필요 (누구나 접근 가능) |
| **인터랙션** | 섹션 네비게이션, 검색, 모바일 플로팅 TOC |

### 6.11 `landing.html` -- 랜딩 페이지

| 항목 | 내용 |
|------|------|
| **데이터 소스** | 없음 (정적) |
| **기능** | 제품 소개, 기능 안내, CTA |
| **권한** | 인증 불필요 |

---

## 7. 역할별 권한 매트릭스

| 기능 | 실무자 (worker) | 매니저 (manager) | 기획조정실 (observer) |
|------|:---:|:---:|:---:|
| **대시보드 조회** | O (자기 작업) | O (자기 부서) | O (전체) |
| **프로젝트 목록 조회** | O | O | O |
| **프로젝트 상세 조회** | O | O | O |
| **작업 완료 처리** | O | - | - |
| **작업 재시작 (반려 후)** | O | - | - |
| **Work Stage 승인/반려** | - | O | - |
| **Gate Stage 승인/반려** | - | - | O |
| **코멘트 작성** | O | O | O |
| **파일 업로드** | O | O | O |
| **변경 요청 등록** | O | O | O |
| **변경 요청 승인/반려** | - | O | O |
| **템플릿 항목 편집** | - | O (자기 부서) | O (전체) |
| **단계/부서 추가/삭제** | - | - | O |
| **고객 관리 (CRUD)** | O | O | O |
| **프로젝트 생성** | - | O | O |
| **템플릿 적용** | - | O | O |
| **출시 체크리스트 적용** | - | O | O |

---

## 8. 승인 워크플로우 상세

### 8.1 이중 승인 구조

```
[작업 수행]
    |
    v
[실무자] -- completeTask() --> status: "completed", approvalStatus: "pending"
    |                                  |
    |                            (자동 알림: 검토자에게)
    v                                  v
[매니저 승인 (Work Stage)]       [기획조정실 승인 (Gate Stage)]
    |                                  |
    +------ approveTask() ------+------+
    |                           |
    v                           v
approvalStatus: "approved"   approvalStatus: "approved"
    |                           |
    |                     (Gate Stage인 경우)
    |                     (포털 알림 자동 생성)
    |                           |
    +------ rejectTask() ------+
    |
    v
status: "rejected", approvalStatus: "rejected"
    |
    v
[실무자] -- restartTask() --> status: "in_progress"
```

### 8.2 Work Stage vs Gate Stage

| 구분 | Work Stage | Gate Stage |
|------|-----------|------------|
| **대상 단계** | 발의검토, 기획검토, WM제작, Tx단계, MasterGatePilot, 양산 | 발의승인, 기획승인, WM승인회, Tx승인회, MSG승인회, 영업이관 |
| **승인 주체** | 매니저 (manager) | 기획조정실 (observer) |
| **선행 조건** | 없음 | 해당 Work Stage 전체 작업이 매니저 승인 완료 |
| **사이드 이펙트** | 프로젝트 통계 재계산 | 프로젝트 통계 재계산 + 포털 알림 |

### 8.3 상태 전이 다이어그램

```
pending --> in_progress --> completed --> [승인 대기]
                               |              |
                               |         approved (최종)
                               |              |
                               +--- rejected -+
                               |
                          in_progress (재작업)
```

### 8.4 판별 로직

`utils.js`의 `GATE_STAGES` 배열로 판별:
```javascript
const GATE_STAGES = ["발의승인", "기획승인", "WM승인회", "Tx승인회", "MSG승인회", "영업이관"];
```
- `GATE_STAGES.includes(task.stage)` -> observer만 승인 가능
- 그 외 -> manager만 승인 가능

---

## 9. 설계변경 프로세스

### 9.1 프로젝트 유형별 차이

| 유형 | 빈도 | 기간 | Phase | 비고 |
|------|------|------|-------|------|
| **신규개발** | 연 5-6건 | ~1년 | 6 Phase 전체 | 193개 전체 템플릿 |
| **설계변경 major** | - | - | 6 Phase 전체 | 신규개발과 동일 |
| **설계변경 medium** | - | - | 6 Phase 전체 | `isRequired` 항목만 (~140-150개) |
| **설계변경 minor** | 월 ~50건 | 짧은 사이클 | 3 Phase (발의/Tx/양산이관) | `isRequired` + 3 Phase만 (~50-60개) |

### 9.2 템플릿 필터링 규칙

```
applyTemplateToProject(projectId, projectType, changeScale)

if (projectType === "신규개발") {
    -> 전체 193개 항목
}

if (projectType === "설계변경") {
    switch (changeScale) {
        case "minor":
            -> isRequired=true AND stageId in ["phase0", "phase3", "phase5"]
        case "medium":
            -> isRequired=true (전체 phase)
        case "major":
            -> 전체 193개 항목 (신규개발과 동일)
    }
}
```

### 9.3 설계변경 Minor Phase 매핑

| 허용 Phase | Phase ID | 작업 단계 | 승인 게이트 |
|-----------|----------|----------|------------|
| 발의 | phase0 | 발의검토 | 발의승인 |
| Tx | phase3 | Tx단계 | Tx승인회 |
| 양산/이관 | phase5 | 양산 | 영업이관 |

---

## 10. 알림 체계

### 10.1 자동 알림 생성 이벤트

| 트리거 이벤트 | 알림 대상 | 알림 유형 | 메시지 패턴 |
|-------------|---------|---------|-----------|
| `completeTask()` | 검토자 (reviewer) | `approval_request` | `"{assignee}님이 "{title}" 작업을 완료했습니다. 검토가 필요합니다."` |
| `approveTask()` | 담당자 (assignee) | `approval_request` | `"{reviewerName}님이 "{title}" 작업을 승인했습니다."` |
| `rejectTask()` | 담당자 (assignee) | `approval_request` | `"{reviewerName}님이 "{title}" 작업을 반려했습니다. 사유: {reason}"` |

### 10.2 포털 알림 (고객용)

| 트리거 이벤트 | 알림 대상 | 알림 유형 | 조건 |
|-------------|---------|---------|------|
| `approveTask()` (Gate Stage) | 프로젝트 연결 고객 (`portalEnabled=true`) | `phase_completed` | `GATE_STAGES.includes(task.stage)` |
| `updateChangeRequest()` (승인/반려) | 변경요청 고객 (`requestSource=customer`) | `request_resolved` | `cr.requestSource === "customer" && cr.customerId` |

### 10.3 알림 링크 형식

| 알림 유형 | 링크 패턴 |
|---------|---------|
| 작업 관련 | `task.html?projectId={projectId}&taskId={taskId}` |
| 프로젝트 관련 | `project.html?id={projectId}` |

---

## 11. Known Gaps & TODO

### 11.1 미구현 기능

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| 파일 업로드 | UI만 존재, Firebase Storage 연동 없음 | P1 |
| 스테이지 자동 전환 | 태스크 승인 후 다음 스테이지로 자동 전환 없음 | P2 |
| 부서별 개별 승인 | 변경 요청의 부서별 개별 승인 흐름 없음 | P2 |
| 테스트 프레임워크 | 현재 미설정 | P1 |
| 서버사이드 기능 | Static Export 모드로 API Routes, SSR, Middleware 사용 불가 | P3 |
| Firestore 보안 규칙 | 클라이언트 사이드에서 직접 Firestore 접근, 보안 규칙 미정의 | P0 |
| 이미지 최적화 | Static Export 호환을 위해 비활성화 | P3 |

### 11.2 구현 완료된 주요 기능 (최근)

- 태스크 생성 모달 (project-detail.js)
- 프로젝트 정렬 (projects.js 테이블 뷰)
- 템플릿 적용 / 출시 준비 적용 버튼 (project-detail.js)
- 영업 대시보드 (sales.html)
- 매뉴얼 스크린샷 14개 (Puppeteer)
- Firebase Auth Microsoft OAuth 연동
- 프로젝트 통계 자동 재계산 (`recalculateProjectStats()`)
- 자동 알림 생성 (completeTask/approveTask/rejectTask)
- 고객 포털 이메일 인증
- 포털 알림 자동 생성 (Gate 승인, 변경요청 승인/반려)

---

## 부록: 6 Phase / 12 Stage 매핑표

| Phase | Phase ID | 작업 단계 (Work Stage) | 승인 게이트 (Gate Stage) | 템플릿 항목 수 |
|-------|----------|---------------------|----------------------|-------------|
| 발의 | phase0 | 발의검토 | 발의승인 | 22 |
| 기획 | phase1 | 기획검토 | 기획승인 | 37 |
| WM | phase2 | WM제작 | WM승인회 | 35 |
| Tx | phase3 | Tx단계 | Tx승인회 | 39 |
| MSG | phase4 | MasterGatePilot | MSG승인회 | 31 |
| 양산/이관 | phase5 | 양산 | 영업이관 | 29 |
| **합계** | | | | **193** |
