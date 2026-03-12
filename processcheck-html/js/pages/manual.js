// ═══════════════════════════════════════════════════════════════════════════════
// Manual Page — 사용자 매뉴얼 (좌측 TOC + 우측 콘텐츠 + ScrollSpy + 검색)
// ═══════════════════════════════════════════════════════════════════════════════

import { getUser } from "../auth.js";
import { renderNav, initTheme } from "../components.js";
initTheme();

// 인증 불필요 — 누구나 접근 가능
const user = getUser();
if (user) {
  renderNav(document.getElementById("nav-root"));
} else {
  // 비로그인 시에도 간단한 헤더 표시
  const navRoot = document.getElementById("nav-root");
  navRoot.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <div class="flex items-center gap-8">
          <a href="index.html" class="nav-logo" style="text-decoration:none">
            <div class="nav-logo-icon"><span>PC</span></div>
            <span class="nav-logo-text">Process<span class="accent">Check</span></span>
          </a>
        </div>
        <div class="nav-right">
          <a href="index.html" class="btn-primary btn-sm" style="text-decoration:none">로그인</a>
        </div>
      </div>
    </nav>
  `;
}

// ─── 매뉴얼 콘텐츠 정의 ─────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "getting-started",
    title: "1. 시작하기",
    children: [
      { id: "login", title: "1.1 로그인" },
      { id: "roles", title: "1.2 역할 소개" },
      { id: "dashboard-overview", title: "1.3 대시보드 둘러보기" },
    ],
  },
  {
    id: "project-management",
    title: "2. 프로젝트 관리",
    children: [
      { id: "project-list", title: "2.1 프로젝트 목록" },
      { id: "project-detail", title: "2.2 프로젝트 상세" },
      { id: "project-stages", title: "2.3 프로젝트 단계 (6 Phase)" },
      { id: "checklist-matrix", title: "2.4 체크리스트 매트릭스" },
    ],
  },
  {
    id: "task-management",
    title: "3. 작업 관리",
    children: [
      { id: "task-flow", title: "3.1 작업 상태 흐름" },
      { id: "task-complete", title: "3.2 작업 완료 및 승인 요청" },
      { id: "task-reject", title: "3.3 반려 및 재작업" },
      { id: "task-files", title: "3.4 파일 첨부 및 코멘트" },
    ],
  },
  {
    id: "approval-workflow",
    title: "4. 승인 워크플로우",
    children: [
      { id: "manager-approval", title: "4.1 매니저 승인" },
      { id: "gate-approval", title: "4.2 게이트 승인" },
      { id: "approval-matrix", title: "4.3 승인 권한 매트릭스" },
    ],
  },
  {
    id: "launch-management",
    title: "5. 출시 준비 관리",
    children: [
      { id: "launch-checklist", title: "5.1 출시 준비 체크리스트" },
      { id: "launch-dday", title: "5.2 D-Day 일정 관리" },
      { id: "launch-alerts", title: "5.3 자동 알림 트리거" },
    ],
  },
  {
    id: "customer-management",
    title: "6. 고객 관리",
    children: [
      { id: "customer-list", title: "6.1 고객 목록" },
      { id: "customer-portal", title: "6.2 고객 포털" },
    ],
  },
  {
    id: "template-admin",
    title: "7. 체크리스트 템플릿 관리",
    children: [
      { id: "template-views", title: "7.1 3가지 뷰 모드" },
      { id: "template-crud", title: "7.2 항목 추가/수정/삭제" },
      { id: "template-structure", title: "7.3 단계/부서 관리" },
    ],
  },
  {
    id: "role-guides",
    title: "8. 역할별 가이드",
    children: [
      { id: "guide-worker", title: "8.1 실무자 가이드" },
      { id: "guide-manager", title: "8.2 매니저 가이드" },
      { id: "guide-observer", title: "8.3 기획조정실 가이드" },
    ],
  },
  {
    id: "faq",
    title: "9. FAQ",
    children: [],
  },
  {
    id: "glossary",
    title: "용어집",
    children: [],
  },
];

// ─── 콘텐츠 HTML ─────────────────────────────────────────────────────────────

function badge(role) {
  const colors = { "실무자": "primary", "매니저": "warning", "기획조정실": "success" };
  return `<span class="badge badge-${colors[role] || "neutral"}">${role}</span>`;
}

function tip(text) {
  return `<div class="manual-tip"><strong>팁:</strong> ${text}</div>`;
}

function warn(text) {
  return `<div class="manual-warning"><strong>주의:</strong> ${text}</div>`;
}

// Screenshot description → image file mapping
const SCREENSHOT_MAP = {
  "로그인 화면 — 3개의 사용자 카드": "manual-login.png",
  "대시보드 메인 화면": "manual-dashboard.png",
  "프로젝트 목록 — 테이블 뷰": "manual-projects.png",
  "프로젝트 상세 — 체크리스트 탭": "manual-checklist.png",
  "체크리스트 매트릭스 — 단계×부서 격자": "manual-matrix.png",
  "작업 상세 — 작업 완료 버튼": "manual-task-complete.png",
  "작업 상세 — 매니저 승인/반려 버튼": "manual-task-approve.png",
  "프로젝트 상세 — 출시 준비 탭": "manual-launch.png",
  "고객 목록 페이지": "manual-customers.png",
  "고객 포털 — 프로젝트 진행 현황": "manual-portal.png",
  "체크리스트 관리 — 트리 뷰": "manual-admin.png",
};

function screenshot(desc) {
  const imgFile = SCREENSHOT_MAP[desc];
  if (imgFile) {
    return `<div class="manual-screenshot-img"><img src="img/${imgFile}" alt="${desc}" loading="lazy"><div class="manual-screenshot-caption">${desc}</div></div>`;
  }
  return `<div class="manual-screenshot"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg> 스크린샷: ${desc}</div>`;
}

function getContentHtml() {
  return `
<!-- 1. 시작하기 -->
<section id="getting-started" class="manual-section">
  <h2>1. 시작하기</h2>
  <p>ProcessCheck는 의료기기 개발 프로세스를 체계적으로 관리하는 시스템입니다. 부서 간 투명성을 높이고, ISO 13485/IEC 62304 기반의 193개 체크리스트 항목으로 개발 품질을 보장합니다.</p>
</section>

<section id="login" class="manual-section">
  <h3>1.1 로그인</h3>
  <p>ProcessCheck는 이름 기반 간편 로그인을 사용합니다.</p>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span>로그인 페이지에 접속합니다</div>
    <div class="manual-step"><span class="manual-step-num">2</span>3개의 샘플 사용자 카드 중 하나를 클릭합니다</div>
    <div class="manual-step"><span class="manual-step-num">3</span>선택한 역할로 즉시 대시보드로 이동합니다</div>
  </div>
  ${screenshot("로그인 화면 — 3개의 사용자 카드")}
  ${tip("최초 접속 시 데이터베이스 초기화(시딩)가 자동으로 진행됩니다. 스피너가 표시되며, 완료 후 사용자 카드가 나타납니다.")}
</section>

<section id="roles" class="manual-section">
  <h3>1.2 역할 소개</h3>
  <p>ProcessCheck는 3가지 역할을 지원합니다.</p>
  <table class="manual-table">
    <thead><tr><th>역할</th><th>설명</th><th>주요 권한</th></tr></thead>
    <tbody>
      <tr><td>${badge("실무자")}</td><td>실제 업무 담당자</td><td>태스크 수행, 파일 업로드, 코멘트 작성, 작업 완료 보고</td></tr>
      <tr><td>${badge("매니저")}</td><td>부서별 관리자</td><td>작업 단계(Work Stage) 승인/반려, 자기 부서 체크리스트 관리</td></tr>
      <tr><td>${badge("기획조정실")}</td><td>전체 프로젝트 모니터링</td><td>승인 게이트(Gate Stage) 최종 승인, 단계/부서 관리, 전체 열람</td></tr>
    </tbody>
  </table>
  ${warn("매니저는 자기 부서의 작업 단계만 승인 가능. 기획조정실만 게이트 승인 수행 가능.")}
</section>

<section id="dashboard-overview" class="manual-section">
  <h3>1.3 대시보드 둘러보기</h3>
  ${screenshot("대시보드 메인 화면")}
  <h4>통계 카드 (상단)</h4>
  <p>4개의 통계 카드가 표시되며, 모두 <strong>클릭 가능</strong>합니다:</p>
  <table class="manual-table">
    <thead><tr><th>카드</th><th>클릭 시 동작</th></tr></thead>
    <tbody>
      <tr><td>작업 대기</td><td>아래 작업 대기 섹션으로 스크롤</td></tr>
      <tr><td>승인 대기</td><td>아래 승인 대기 섹션으로 스크롤</td></tr>
      <tr><td>프로젝트</td><td>프로젝트 목록 페이지로 이동</td></tr>
      <tr><td>알림</td><td>아래 알림 섹션으로 스크롤</td></tr>
    </tbody>
  </table>
  <h4>역할별 데이터 범위</h4>
  <ul>
    <li>${badge("실무자")} 자기에게 배정된 작업만 (마감 3일 이내 우선)</li>
    <li>${badge("매니저")} 자기 부서의 전체 작업</li>
    <li>${badge("기획조정실")} 모든 프로젝트의 전체 작업</li>
  </ul>
</section>

<!-- 2. 프로젝트 관리 -->
<section id="project-management" class="manual-section">
  <h2>2. 프로젝트 관리</h2>
  <p>ProcessCheck에서 프로젝트는 제품 개발의 전체 수명주기를 관리하는 단위입니다.</p>
</section>

<section id="project-list" class="manual-section">
  <h3>2.1 프로젝트 목록</h3>
  ${screenshot("프로젝트 목록 — 테이블 뷰")}
  <p>7가지 뷰 모드를 지원합니다. 상단 탭에서 전환할 수 있습니다.</p>
  <table class="manual-table">
    <thead><tr><th>뷰</th><th>설명</th></tr></thead>
    <tbody>
      <tr><td><strong>테이블</strong> (기본)</td><td>프로젝트를 표 형태로 정렬</td></tr>
      <tr><td><strong>매트릭스</strong></td><td>프로젝트×단계 매트릭스</td></tr>
      <tr><td><strong>카드</strong></td><td>카드 형태 요약</td></tr>
      <tr><td><strong>간트</strong></td><td>타임라인 일정 관리</td></tr>
      <tr><td><strong>칸반</strong></td><td>상태별 보드</td></tr>
      <tr><td><strong>타임라인</strong></td><td>시간순 이벤트 흐름</td></tr>
      <tr><td><strong>캘린더</strong></td><td>월별 일정</td></tr>
    </tbody>
  </table>
</section>

<section id="project-detail" class="manual-section">
  <h3>2.2 프로젝트 상세</h3>
  <p>프로젝트 상세 페이지는 <strong>3개 탭</strong>으로 구성됩니다:</p>
  ${screenshot("프로젝트 상세 — 체크리스트 탭")}
  <ol>
    <li><strong>개요+작업</strong>: 체크리스트와 활동 타임라인</li>
    <li><strong>스케줄</strong>: 간트 차트와 Phase별 상세 테이블</li>
    <li><strong>병목</strong>: Phase×부서 히트맵과 지연 원인 분석</li>
  </ol>
</section>

<section id="project-stages" class="manual-section">
  <h3>2.3 프로젝트 단계 (6 Phase)</h3>
  <p>모든 프로젝트는 6개의 Phase를 순차적으로 거칩니다. 각 Phase는 <strong>작업 단계</strong>와 <strong>승인 게이트</strong> 쌍으로 구성됩니다.</p>
  <table class="manual-table">
    <thead><tr><th>Phase</th><th>작업 단계</th><th>승인 게이트</th><th>주요 활동</th></tr></thead>
    <tbody>
      <tr><td><strong>발의</strong></td><td>발의 검토</td><td>발의 승인</td><td>제품 컨셉, NABC 분석, 시장 기회</td></tr>
      <tr><td><strong>기획</strong></td><td>기획 검토</td><td>기획 승인</td><td>설계 입력, 위험관리, 인허가 전략</td></tr>
      <tr><td><strong>WM</strong></td><td>W/M 제작</td><td>W/M 승인회</td><td>시제품 제작, 설계 검증, 디자인 확정</td></tr>
      <tr><td><strong>Tx</strong></td><td>Tx 단계</td><td>Tx 승인회</td><td>설계 확인, 시험, 임상, 인허가</td></tr>
      <tr><td><strong>MSG</strong></td><td>Master Gate Pilot</td><td>MSG 승인회</td><td>양산 도면, 시생산, 밸리데이션</td></tr>
      <tr><td><strong>양산/이관</strong></td><td>양산</td><td>영업 이관</td><td>양산 가동, 영업 교육, A/S 구축</td></tr>
    </tbody>
  </table>
  ${tip("작업 단계의 모든 체크리스트가 매니저 승인을 받아야 승인 게이트로 진행 가능합니다.")}
</section>

<section id="checklist-matrix" class="manual-section">
  <h3>2.4 체크리스트 매트릭스</h3>
  ${screenshot("체크리스트 매트릭스 — 단계×부서 격자")}
  <ul>
    <li>각 셀 클릭 → 해당 단계+부서 체크리스트 항목 펼침</li>
    <li>셀 안의 숫자: <code>완료/전체</code> 형식</li>
    <li>색상: 초록(완료), 파랑(진행 중), 회색(대기)</li>
  </ul>
  <h4>체크리스트 자동 생성</h4>
  <p>${badge("실무자")} ${badge("매니저")} ${badge("기획조정실")}</p>
  <p>새 프로젝트에 체크리스트가 없으면 <strong>"템플릿에서 체크리스트 생성"</strong> 버튼이 표시됩니다.</p>
  <table class="manual-table">
    <thead><tr><th>프로젝트 유형</th><th>생성 항목</th></tr></thead>
    <tbody>
      <tr><td>신규개발</td><td>전체 193개 항목</td></tr>
    </tbody>
  </table>
</section>

<!-- 3. 작업 관리 -->
<section id="task-management" class="manual-section">
  <h2>3. 작업(태스크) 관리</h2>
</section>

<section id="task-flow" class="manual-section">
  <h3>3.1 작업 상태 흐름</h3>
  <div class="manual-flow">
    <span class="badge badge-neutral">대기 중</span> → <span class="badge badge-primary">진행 중</span> → <span class="badge badge-success">완료</span> → <span class="badge badge-warning">승인 대기</span> → <span class="badge badge-success">승인</span>
  </div>
  <p style="text-align:center;margin-top:0.5rem;color:var(--slate-300)">반려 시: <span class="badge badge-danger">반려</span> → <span class="badge badge-primary">재작업(진행 중)</span></p>
</section>

<section id="task-complete" class="manual-section">
  <h3>3.2 작업 완료 및 승인 요청</h3>
  <p>${badge("실무자")}</p>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span>작업 상세 페이지에서 <strong>"작업 완료"</strong> 버튼 클릭</div>
    <div class="manual-step"><span class="manual-step-num">2</span>상태가 <code>완료</code>로 변경, 자동 <code>승인 대기</code></div>
    <div class="manual-step"><span class="manual-step-num">3</span>검토자에게 자동 알림 발송</div>
  </div>
  ${screenshot("작업 상세 — 작업 완료 버튼")}
</section>

<section id="task-reject" class="manual-section">
  <h3>3.3 반려 및 재작업</h3>
  <p>${badge("매니저")} ${badge("기획조정실")}</p>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span>검토자가 반려 사유를 입력하고 반려</div>
    <div class="manual-step"><span class="manual-step-num">2</span>실무자에게 자동 알림 발송</div>
    <div class="manual-step"><span class="manual-step-num">3</span>실무자가 <strong>"재작업 시작"</strong> 버튼 클릭 → 수정 후 재완료</div>
  </div>
  ${warn("반려 시 반드시 사유를 입력해야 합니다.")}
</section>

<section id="task-files" class="manual-section">
  <h3>3.4 파일 첨부 및 코멘트</h3>
  <p>${badge("실무자")} ${badge("매니저")} ${badge("기획조정실")}</p>
  <h4>파일 첨부</h4>
  <ul><li>"파일" 섹션에서 <strong>파일 선택</strong> 버튼 클릭 → 업로드</li></ul>
  <h4>코멘트</h4>
  <ul><li>하단 코멘트 입력란에 내용 입력 → <strong>"등록"</strong> 클릭</li></ul>
</section>

<!-- 4. 승인 워크플로우 -->
<section id="approval-workflow" class="manual-section">
  <h2>4. 승인 워크플로우</h2>
  <p>ProcessCheck는 <strong>2단계 승인 구조</strong>를 사용합니다. 매니저 승인(작업 단계)과 기획조정실 승인(게이트 단계)이 분리되어 있습니다.</p>
</section>

<section id="manager-approval" class="manual-section">
  <h3>4.1 매니저 승인 (Work Stage)</h3>
  <p>${badge("매니저")}</p>
  <p>대상: 발의 검토, 기획 검토, W/M 제작, Tx 단계, Master Gate Pilot, 양산</p>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span>대시보드에서 승인 대기 작업 확인</div>
    <div class="manual-step"><span class="manual-step-num">2</span>작업 상세 페이지에서 내용 검토</div>
    <div class="manual-step"><span class="manual-step-num">3</span><strong>"승인"</strong> 또는 <strong>"반려"</strong> 버튼 클릭</div>
  </div>
  ${screenshot("작업 상세 — 매니저 승인/반려 버튼")}
</section>

<section id="gate-approval" class="manual-section">
  <h3>4.2 게이트 승인 (Gate Stage)</h3>
  <p>${badge("기획조정실")}</p>
  <p>대상: 발의 승인, 기획 승인, W/M 승인회, Tx 승인회, MSG 승인회, 영업 이관</p>
  ${warn("해당 Phase의 모든 작업 단계 체크리스트가 매니저 승인 완료된 후에만 진행 가능합니다.")}
</section>

<section id="approval-matrix" class="manual-section">
  <h3>4.3 승인 권한 매트릭스</h3>
  <table class="manual-table">
    <thead><tr><th>기능</th><th>실무자</th><th>매니저</th><th>기획조정실</th></tr></thead>
    <tbody>
      <tr><td>작업 완료 보고</td><td>✅</td><td>—</td><td>—</td></tr>
      <tr><td>작업 단계 승인/반려</td><td>—</td><td>✅ (자기 부서)</td><td>—</td></tr>
      <tr><td>게이트 단계 승인/반려</td><td>—</td><td>—</td><td>✅</td></tr>
      <tr><td>체크리스트 열람</td><td>자기 작업</td><td>자기 부서</td><td>전체</td></tr>
      <tr><td>체크리스트 편집</td><td>—</td><td>자기 부서</td><td>전체</td></tr>
      <tr><td>단계/부서 추가·삭제</td><td>—</td><td>—</td><td>✅</td></tr>
    </tbody>
  </table>
</section>

<!-- 5. 출시 준비 관리 -->
<section id="launch-management" class="manual-section">
  <h2>5. 출시 준비 관리</h2>
</section>

<section id="launch-checklist" class="manual-section">
  <h3>5.1 출시 준비 체크리스트</h3>
  ${screenshot("프로젝트 상세 — 출시 준비 탭")}
  <p>14개 카테고리로 분류됩니다: 사진/영상, 브랜드, 인쇄물, 디지털, 가격, 영업 교육, 딜러, CS/A/S, 규제, 물류, 런칭 이벤트, KOL, 보험/수가, 출시 후</p>
</section>

<section id="launch-dday" class="manual-section">
  <h3>5.2 D-Day 일정 관리</h3>
  <ul>
    <li><strong>D-Day</strong>: 프로젝트 종료일(출시 예정일) 기준</li>
    <li><strong>음수</strong>: 출시 전 (D-180 = 출시 180일 전)</li>
    <li><strong>양수</strong>: 출시 후 (D+30 = 출시 30일 후)</li>
  </ul>
  ${tip("프로젝트 종료일이 변경되면 모든 출시 준비 항목의 마감일이 자동으로 재계산됩니다.")}
</section>

<section id="launch-alerts" class="manual-section">
  <h3>5.3 자동 알림 트리거</h3>
  <table class="manual-table">
    <thead><tr><th>Gate 승인</th><th>알림 대상</th><th>알림 내용</th></tr></thead>
    <tbody>
      <tr><td>WM 승인</td><td>마케팅</td><td>사진 촬영 준비 시작</td></tr>
      <tr><td>Tx 승인</td><td>마케팅+영업+인증</td><td>인쇄물/웹/MFDS 확인</td></tr>
      <tr><td>MSG 승인</td><td>영업+CS+마케팅</td><td>가격표/SNS/A/S/데모기</td></tr>
      <tr><td>양산 시작</td><td>전체</td><td>D-30 런칭 카운트다운</td></tr>
    </tbody>
  </table>
</section>

<!-- 7. 고객 관리 -->
<section id="customer-management" class="manual-section">
  <h2>6. 고객 관리</h2>
</section>

<section id="customer-list" class="manual-section">
  <h3>6.1 고객 목록</h3>
  ${screenshot("고객 목록 페이지")}
  <table class="manual-table">
    <thead><tr><th>고객 유형</th><th>설명</th></tr></thead>
    <tbody>
      <tr><td>대리점 (Dealer)</td><td>국내/해외 제품 유통 대리점</td></tr>
      <tr><td>해외법인 (Subsidiary)</td><td>해외 지사/법인</td></tr>
      <tr><td>병원 (Hospital)</td><td>직거래 병원/의료기관</td></tr>
      <tr><td>온라인 (Online)</td><td>온라인 판매 채널</td></tr>
    </tbody>
  </table>
</section>

<section id="customer-portal" class="manual-section">
  <h3>6.2 고객 포털</h3>
  <p>거래처/법인이 프로젝트 진행 상황을 확인할 수 있는 <strong>읽기 전용</strong> 페이지입니다.</p>
  ${screenshot("고객 포털 — 프로젝트 진행 현황")}
  <p><strong>볼 수 있는 정보:</strong> 프로젝트 Phase 진행률, 출시 준비 현황</p>
  <p><strong>볼 수 없는 정보:</strong> 내부 체크리스트 상세, 내부 직원, 위험도, 다른 고객 정보</p>
</section>

<!-- 7. 체크리스트 템플릿 관리 -->
<section id="template-admin" class="manual-section">
  <h2>7. 체크리스트 템플릿 관리</h2>
  <p>${badge("기획조정실")} ${badge("매니저")}</p>
</section>

<section id="template-views" class="manual-section">
  <h3>7.1 3가지 뷰 모드</h3>
  ${screenshot("체크리스트 관리 — 트리 뷰")}
  <table class="manual-table">
    <thead><tr><th>뷰</th><th>설명</th><th>용도</th></tr></thead>
    <tbody>
      <tr><td><strong>트리</strong> (기본)</td><td>단계 사이드바 + 부서 탭 + 항목</td><td>항목 추가/수정/삭제</td></tr>
      <tr><td><strong>매트릭스</strong></td><td>단계×부서 표</td><td>전체 현황 파악</td></tr>
      <tr><td><strong>리스트</strong></td><td>전체 flat list + 검색</td><td>특정 항목 찾기</td></tr>
    </tbody>
  </table>
</section>

<section id="template-crud" class="manual-section">
  <h3>7.2 항목 추가/수정/삭제</h3>
  <p>${badge("기획조정실")}</p>
  <ul>
    <li><strong>추가:</strong> 트리 뷰에서 단계+부서 선택 → "+ 항목 추가" 클릭</li>
    <li><strong>수정:</strong> 편집 아이콘 클릭 → 내용 수정 후 저장</li>
    <li><strong>삭제:</strong> 삭제 아이콘 클릭 → 확인 후 삭제</li>
  </ul>
  ${warn("템플릿 수정은 새로 생성되는 프로젝트에만 적용됩니다. 기존 프로젝트에는 영향 없음.")}
</section>

<section id="template-structure" class="manual-section">
  <h3>7.3 단계/부서 관리</h3>
  <p>${badge("기획조정실")}</p>
  <ul>
    <li><strong>단계 추가:</strong> 기존 6개 Phase 외 새 단계 추가 가능</li>
    <li><strong>부서 추가:</strong> 기존 10개 부서 외 새 부서 추가 가능</li>
    <li><strong>삭제:</strong> 삭제 시 해당 단계/부서의 모든 템플릿 항목도 함께 삭제</li>
  </ul>
</section>

<!-- 9. 역할별 가이드 -->
<section id="role-guides" class="manual-section">
  <h2>8. 역할별 가이드</h2>
</section>

<section id="guide-worker" class="manual-section">
  <h3>8.1 실무자(Worker) 가이드</h3>
  <p>${badge("실무자")} — 실제 업무를 수행하는 담당자</p>
  <h4>일일 워크플로우</h4>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span><strong>대시보드 확인</strong> → 오늘 마감 작업, 알림 확인</div>
    <div class="manual-step"><span class="manual-step-num">2</span><strong>작업 수행</strong> → 배정된 작업 상세 페이지에서 진행</div>
    <div class="manual-step"><span class="manual-step-num">3</span><strong>파일 업로드</strong> → 완료 근거 자료 첨부</div>
    <div class="manual-step"><span class="manual-step-num">4</span><strong>작업 완료</strong> → "작업 완료" 클릭 → 매니저에게 자동 승인 요청</div>
    <div class="manual-step"><span class="manual-step-num">5</span><strong>반려 시</strong> → 사유 확인 → "재작업 시작" → 수정 후 재완료</div>
  </div>
</section>

<section id="guide-manager" class="manual-section">
  <h3>8.2 매니저(Manager) 가이드</h3>
  <p>${badge("매니저")} — 부서별 관리자</p>
  <h4>일일 워크플로우</h4>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span><strong>대시보드 확인</strong> → 승인 대기 작업 확인 (자기 부서)</div>
    <div class="manual-step"><span class="manual-step-num">2</span><strong>작업 검토</strong> → 내용, 첨부파일 확인</div>
    <div class="manual-step"><span class="manual-step-num">3</span><strong>승인/반려</strong> → 반려 시 사유 입력</div>
    <div class="manual-step"><span class="manual-step-num">4</span><strong>모니터링</strong> → 자기 부서 프로젝트 진행 확인</div>
  </div>
</section>

<section id="guide-observer" class="manual-section">
  <h3>8.3 기획조정실(Observer) 가이드</h3>
  <p>${badge("기획조정실")} — 전체 프로젝트 모니터링</p>
  <h4>일일 워크플로우</h4>
  <div class="manual-steps">
    <div class="manual-step"><span class="manual-step-num">1</span><strong>대시보드 확인</strong> → 전체 현황, 위험 프로젝트</div>
    <div class="manual-step"><span class="manual-step-num">2</span><strong>게이트 승인</strong> → Gate Stage 최종 승인</div>
    <div class="manual-step"><span class="manual-step-num">3</span><strong>전체 모니터링</strong> → 진행률, 위험도, 지연 확인</div>
    <div class="manual-step"><span class="manual-step-num">4</span><strong>템플릿 관리</strong> → 체크리스트 항목 관리</div>
  </div>
</section>

<!-- 9. FAQ -->
<section id="faq" class="manual-section">
  <h2>9. FAQ</h2>
  <div class="manual-faq">
    <details class="manual-faq-item"><summary>처음 접속했는데 데이터가 없어요.</summary><p>최초 접속 시 자동으로 샘플 데이터가 생성됩니다. 로딩 스피너가 표시되며, 보통 몇 초 내에 완료됩니다.</p></details>
    <details class="manual-faq-item"><summary>다른 역할로 전환하고 싶어요.</summary><p>로그아웃 후 로그인 페이지에서 다른 역할의 사용자 카드를 클릭하면 됩니다.</p></details>
    <details class="manual-faq-item"><summary>작업을 완료했는데 승인이 안 와요.</summary><p>작업 완료 시 검토자에게 자동 알림이 발송됩니다. 검토자가 대시보드에서 승인 대기 목록을 확인하면 됩니다.</p></details>
    <details class="manual-faq-item"><summary>반려된 작업은 어떻게 처리하나요?</summary><p>"재작업 시작" 버튼을 클릭하면 상태가 다시 진행 중으로 변경됩니다. 수정 후 다시 완료하세요.</p></details>
    <details class="manual-faq-item"><summary>매니저인데 다른 부서 작업을 승인할 수 없어요.</summary><p>매니저는 자기 부서의 작업 단계만 승인 가능합니다. 게이트 단계는 기획조정실이 처리합니다.</p></details>
    <details class="manual-faq-item"><summary>체크리스트 템플릿을 수정하면 기존 프로젝트에도 반영되나요?</summary><p>아니요. 수정된 템플릿은 새로 생성되는 프로젝트에만 적용됩니다.</p></details>
    <details class="manual-faq-item"><summary>프로젝트 진행률은 어떻게 계산되나요?</summary><p>(완료+승인 항목 수 / 전체 항목 수) × 100으로 자동 계산됩니다.</p></details>
    <details class="manual-faq-item"><summary>다크모드는 어떻게 전환하나요?</summary><p>상단 네비게이션 바의 테마 아이콘을 클릭하면 전환됩니다. 설정은 브라우저에 저장됩니다.</p></details>
    <details class="manual-faq-item"><summary>출시 준비 체크리스트의 마감일이 맞지 않아요.</summary><p>프로젝트 종료일이 변경된 경우, 출시 준비 탭에서 "일정 재계산" 버튼을 클릭하세요.</p></details>
    <details class="manual-faq-item"><summary>고객 포털 URL은 어디서 확인하나요?</summary><p>고객 관리 페이지에서 포털이 활성화된 고객의 customer-portal.html?id=고객ID로 접근합니다.</p></details>
  </div>
</section>

<!-- 용어집 -->
<section id="glossary" class="manual-section">
  <h2>용어집</h2>
  <table class="manual-table">
    <thead><tr><th>용어</th><th>설명</th></tr></thead>
    <tbody>
      <tr><td><strong>Phase</strong></td><td>프로젝트의 큰 단계 (6개: 발의→기획→WM→Tx→MSG→양산/이관)</td></tr>
      <tr><td><strong>Work Stage</strong></td><td>실제 업무 수행 단계. 매니저가 승인</td></tr>
      <tr><td><strong>Gate Stage</strong></td><td>위원회 승인 단계. 기획조정실이 승인</td></tr>
      <tr><td><strong>NABC</strong></td><td>Need, Approach, Benefit, Competition 분석</td></tr>
      <tr><td><strong>eBOM</strong></td><td>Engineering BOM — 설계 자재 명세서</td></tr>
      <tr><td><strong>mBOM</strong></td><td>Manufacturing BOM — 제조 자재 명세서</td></tr>
      <tr><td><strong>WM</strong></td><td>Working Model — 시제품</td></tr>
      <tr><td><strong>Tx</strong></td><td>Transfer — 설계→양산 이전</td></tr>
      <tr><td><strong>MSG</strong></td><td>Master Gate — 양산 전 최종 게이트</td></tr>
      <tr><td><strong>DHF</strong></td><td>Design History File — 설계 이력 파일</td></tr>
      <tr><td><strong>D-Day</strong></td><td>출시 예정일. 출시 준비 체크리스트 기준일</td></tr>
      <tr><td><strong>FMEA</strong></td><td>Failure Mode and Effects Analysis</td></tr>
      <tr><td><strong>PMS</strong></td><td>Post-Market Surveillance — 시판 후 감시</td></tr>
      <tr><td><strong>CAPA</strong></td><td>Corrective and Preventive Action</td></tr>
      <tr><td><strong>UDI</strong></td><td>Unique Device Identification</td></tr>
      <tr><td><strong>MFDS</strong></td><td>식품의약품안전처</td></tr>
      <tr><td><strong>ISO 13485</strong></td><td>의료기기 품질경영시스템 표준</td></tr>
      <tr><td><strong>IEC 62304</strong></td><td>의료기기 소프트웨어 수명주기 표준</td></tr>
      <tr><td><strong>ISO 14971</strong></td><td>의료기기 위험관리 표준</td></tr>
    </tbody>
  </table>
</section>
  `;
}

// ─── 렌더링 ─────────────────────────────────────────────────────────────────

const app = document.getElementById("app");

function renderTOC() {
  return SECTIONS.map(s => `
    <div class="manual-toc-group">
      <a href="#${s.id}" class="manual-toc-link manual-toc-parent" data-target="${s.id}">${s.title}</a>
      ${s.children.map(c => `
        <a href="#${c.id}" class="manual-toc-link manual-toc-child" data-target="${c.id}">${c.title}</a>
      `).join("")}
    </div>
  `).join("");
}

function render() {
  app.innerHTML = `
    <div class="manual-layout">
      <!-- Mobile TOC Toggle -->
      <button class="manual-mobile-toc-btn" id="manual-toc-toggle">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h7"/></svg>
        목차
      </button>

      <!-- Sidebar -->
      <aside class="manual-sidebar" id="manual-sidebar">
        <div class="manual-sidebar-header">
          <h3 class="manual-sidebar-title">사용자 매뉴얼</h3>
          <input type="text" class="manual-search input-field" id="manual-search" placeholder="검색..." />
        </div>
        <nav class="manual-toc" id="manual-toc">
          ${renderTOC()}
        </nav>
      </aside>

      <!-- Main Content -->
      <div class="manual-content" id="manual-content">
        <div class="manual-content-header">
          <h1>ProcessCheck 사용자 매뉴얼</h1>
          <p class="text-soft">의료기기 개발 프로세스 관리 시스템 — 부서 간 투명성과 협업을 위한 체크리스트 기반 프로젝트 관리 도구</p>
        </div>
        ${getContentHtml()}
      </div>
    </div>
  `;

  bindEvents();
}

// ─── 이벤트 바인딩 ──────────────────────────────────────────────────────────

function bindEvents() {
  // TOC link clicks — smooth scroll
  document.querySelectorAll(".manual-toc-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        // Close mobile TOC
        document.getElementById("manual-sidebar").classList.remove("open");
      }
    });
  });

  // Mobile TOC toggle
  const toggleBtn = document.getElementById("manual-toc-toggle");
  const sidebar = document.getElementById("manual-sidebar");
  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener("click", (e) => {
    if (sidebar.classList.contains("open") &&
        !sidebar.contains(e.target) &&
        e.target !== toggleBtn &&
        !toggleBtn.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  });

  // Search
  const searchInput = document.getElementById("manual-search");
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    const tocGroups = document.querySelectorAll(".manual-toc-group");
    const sections = document.querySelectorAll(".manual-section");

    if (!query) {
      tocGroups.forEach(g => g.style.display = "");
      sections.forEach(s => s.style.display = "");
      return;
    }

    // Filter TOC
    tocGroups.forEach(g => {
      const links = g.querySelectorAll(".manual-toc-link");
      let groupVisible = false;
      links.forEach(link => {
        const text = link.textContent.toLowerCase();
        if (text.includes(query)) {
          link.style.display = "";
          groupVisible = true;
        } else {
          link.style.display = "none";
        }
      });
      g.style.display = groupVisible ? "" : "none";
    });

    // Filter sections
    sections.forEach(s => {
      const text = s.textContent.toLowerCase();
      s.style.display = text.includes(query) ? "" : "none";
    });
  });

  // ScrollSpy — IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Remove all active
        document.querySelectorAll(".manual-toc-link.active").forEach(a => a.classList.remove("active"));
        // Add active to matching link
        const link = document.querySelector(`.manual-toc-link[data-target="${entry.target.id}"]`);
        if (link) link.classList.add("active");
      }
    });
  }, {
    rootMargin: "-80px 0px -70% 0px",
    threshold: 0,
  });

  document.querySelectorAll(".manual-section").forEach(section => {
    observer.observe(section);
  });
}

// ─── CSS 삽입 ────────────────────────────────────────────────────────────────

const style = document.createElement("style");
style.textContent = `
  /* Manual Layout */
  .manual-layout {
    display: flex;
    min-height: calc(100vh - 56px);
    max-width: 1400px;
    margin: 0 auto;
    position: relative;
  }

  /* Sidebar */
  .manual-sidebar {
    width: 280px;
    min-width: 280px;
    border-right: 1px solid var(--surface-3);
    background: var(--surface-1);
    position: sticky;
    top: 56px;
    height: calc(100vh - 56px);
    overflow-y: auto;
    padding: 1.5rem 0;
    z-index: 20;
  }

  .manual-sidebar-header {
    padding: 0 1.25rem 1rem;
    border-bottom: 1px solid var(--surface-3);
    margin-bottom: 0.75rem;
  }

  .manual-sidebar-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--slate-200);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .manual-search {
    width: 100%;
    font-size: 0.8125rem;
    padding: 0.5rem 0.75rem;
  }

  /* TOC */
  .manual-toc {
    padding: 0 0.5rem;
  }

  .manual-toc-group {
    margin-bottom: 0.25rem;
  }

  .manual-toc-link {
    display: block;
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--slate-400);
    text-decoration: none;
    border-radius: 0.375rem;
    transition: all 0.15s ease;
    cursor: pointer;
  }

  .manual-toc-link:hover {
    color: var(--slate-200);
    background: var(--surface-2);
  }

  .manual-toc-link.active {
    color: var(--primary-300);
    background: rgba(var(--primary-rgb, 59, 130, 246), 0.1);
    font-weight: 600;
  }

  .manual-toc-parent {
    font-weight: 600;
    color: var(--slate-300);
  }

  .manual-toc-child {
    padding-left: 1.5rem;
    font-size: 0.75rem;
  }

  /* Mobile TOC Button */
  .manual-mobile-toc-btn {
    display: none;
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 30;
    background: var(--primary-500);
    color: white;
    border: none;
    border-radius: 2rem;
    padding: 0.75rem 1.25rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    align-items: center;
    gap: 0.5rem;
  }

  /* Main Content */
  .manual-content {
    flex: 1;
    padding: 2rem 3rem 4rem;
    max-width: 900px;
  }

  .manual-content-header {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--surface-3);
  }

  .manual-content-header h1 {
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--slate-100);
    margin-bottom: 0.5rem;
  }

  /* Sections */
  .manual-section {
    margin-bottom: 2rem;
    scroll-margin-top: 80px;
  }

  .manual-section h2 {
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--slate-100);
    margin-bottom: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--surface-3);
  }

  .manual-section h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--slate-200);
    margin-bottom: 0.5rem;
  }

  .manual-section h4 {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--slate-300);
    margin: 1rem 0 0.5rem;
  }

  .manual-section p {
    color: var(--slate-400);
    line-height: 1.7;
    margin-bottom: 0.75rem;
  }

  .manual-section ul, .manual-section ol {
    color: var(--slate-400);
    line-height: 1.7;
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
  }

  .manual-section li {
    margin-bottom: 0.25rem;
  }

  .manual-section code {
    background: var(--surface-2);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    color: var(--primary-300);
  }

  /* Tables */
  .manual-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    font-size: 0.8125rem;
  }

  .manual-table th {
    background: var(--surface-2);
    color: var(--slate-300);
    font-weight: 600;
    text-align: left;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--surface-3);
  }

  .manual-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--surface-3);
    color: var(--slate-400);
  }

  .manual-table tr:hover td {
    background: var(--surface-2);
  }

  /* Steps */
  .manual-steps {
    margin: 1rem 0;
  }

  .manual-step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.625rem 0;
    color: var(--slate-400);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .manual-step-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    background: var(--primary-500);
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  /* Tip & Warning */
  .manual-tip {
    background: rgba(16, 185, 129, 0.08);
    border-left: 3px solid var(--success-400);
    padding: 0.75rem 1rem;
    border-radius: 0 0.5rem 0.5rem 0;
    margin: 0.75rem 0;
    font-size: 0.8125rem;
    color: var(--slate-400);
  }

  .manual-warning {
    background: rgba(245, 158, 11, 0.08);
    border-left: 3px solid var(--warning-400);
    padding: 0.75rem 1rem;
    border-radius: 0 0.5rem 0.5rem 0;
    margin: 0.75rem 0;
    font-size: 0.8125rem;
    color: var(--slate-400);
  }

  /* Screenshot with image */
  .manual-screenshot-img {
    margin: 0.75rem 0;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--surface-3);
  }

  .manual-screenshot-img img {
    width: 100%;
    height: auto;
    display: block;
  }

  .manual-screenshot-caption {
    padding: 0.5rem 0.75rem;
    background: var(--surface-2);
    font-size: 0.75rem;
    color: var(--slate-300);
    text-align: center;
  }

  /* Screenshot placeholder (fallback) */
  .manual-screenshot {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--surface-2);
    border: 1px dashed var(--surface-3);
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    margin: 0.75rem 0;
    color: var(--slate-300);
    font-size: 0.8125rem;
  }

  .manual-screenshot svg {
    color: var(--slate-300);
    flex-shrink: 0;
  }

  /* Flow diagram */
  .manual-flow {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
    padding: 1rem;
    background: var(--surface-2);
    border-radius: 0.5rem;
    margin: 0.75rem 0;
    font-size: 0.8125rem;
    color: var(--slate-400);
  }

  /* FAQ */
  .manual-faq {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .manual-faq-item {
    background: var(--surface-1);
    border: 1px solid var(--surface-3);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .manual-faq-item summary {
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--slate-200);
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .manual-faq-item summary::before {
    content: "▶";
    font-size: 0.625rem;
    transition: transform 0.2s ease;
    color: var(--slate-300);
  }

  .manual-faq-item[open] summary::before {
    transform: rotate(90deg);
  }

  .manual-faq-item p {
    padding: 0 1rem 0.75rem 1.75rem;
    font-size: 0.8125rem;
    color: var(--slate-400);
    line-height: 1.6;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .manual-sidebar {
      position: fixed;
      left: -300px;
      top: 0;
      height: 100vh;
      transition: left 0.3s ease;
      box-shadow: none;
      z-index: 100;
    }

    .manual-sidebar.open {
      left: 0;
      box-shadow: 4px 0 20px rgba(0,0,0,0.3);
    }

    .manual-mobile-toc-btn {
      display: flex;
    }

    .manual-content {
      padding: 1.5rem 1rem 5rem;
    }

    .manual-content-header h1 {
      font-size: 1.375rem;
    }

    .manual-table {
      font-size: 0.75rem;
    }

    .manual-flow {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .manual-content {
      padding: 1rem 0.75rem 5rem;
    }
  }
`;
document.head.appendChild(style);

// ─── 초기화 ─────────────────────────────────────────────────────────────────

render();
