/**
 * seed-launch-templates.mjs
 *
 * Seeds Firestore with launch template data:
 *   1. launchPipelineStages  (5 stages)
 *   2. launchCategories      (14 categories)
 *   3. launchTemplateItems   (171 items)
 *
 * Usage:
 *   cd processcheck-html && node scripts/seed-launch-templates.mjs
 *
 * Set GOOGLE_APPLICATION_CREDENTIALS env var to a service account JSON path,
 * or rely on Application Default Credentials.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ─── Firebase Init ──────────────────────────────────────────────────────────

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log(`Using service account from GOOGLE_APPLICATION_CREDENTIALS`);
}
initializeApp({ projectId: "processsss-appp" });
const db = getFirestore();

// ─── Pipeline Stages (from DEFAULT_EXEC_STAGES in sales.js) ─────────────────

const PIPELINE_STAGES = [
  { key: "product_info", label: "제품 정보", icon: "📋" },
  { key: "materials",    label: "자료 제작", icon: "📸" },
  { key: "distribution", label: "거래처 배포", icon: "📢" },
  { key: "education",    label: "교육/행사", icon: "🎓" },
  { key: "launch_check", label: "출시 확인", icon: "✅" },
];

// ─── Category Labels (from LAUNCH_CATEGORY_LABELS in firestore-service.js) ──

const LAUNCH_CATEGORY_LABELS = {
  brand:          "브랜드/포지셔닝",
  photo:          "사진/영상",
  print:          "인쇄물/문서",
  digital:        "디지털 콘텐츠",
  pricing:        "가격/견적/계약",
  sales_training: "영업 교육/역량",
  dealer_notify:  "거래처 통보/관리",
  cs:             "CS/서비스 준비",
  regulatory:     "규제/인허가/등록",
  logistics:      "물류/재고/출하",
  launch_event:   "런칭 이벤트/PR",
  kol:            "KOL/학회/임상",
  insurance:      "보험급여/조달",
  post_launch:    "출시 후 모니터링",
};

// Map each category to its pipeline stage key (from DEFAULT_EXEC_STAGES.categories)
const CATEGORY_TO_STAGE = {
  pricing:        "product_info",
  regulatory:     "product_info",
  brand:          "materials",
  photo:          "materials",
  print:          "materials",
  digital:        "materials",
  dealer_notify:  "distribution",
  sales_training: "distribution",
  launch_event:   "education",
  kol:            "education",
  cs:             "launch_check",
  logistics:      "launch_check",
  insurance:      "launch_check",
  post_launch:    "launch_check",
};

// ─── Template Items (from getLaunchTemplateItems() in firestore-service.js) ──
// 171 items across 14 categories

const TEMPLATE_ITEMS = [
  // Pre-A: 브랜드/포지셔닝 (8)
  { code: "P-01", category: "brand", title: "제품 브랜드명 확정 (상표 검색 포함)", department: "마케팅+법무", dDayOffset: -240, durationDays: 14, isRequired: true },
  { code: "P-02", category: "brand", title: "제품 로고 디자인 개발 (2~3안)", department: "디자인+마케팅", dDayOffset: -220, durationDays: 10, isRequired: true },
  { code: "P-03", category: "brand", title: "브랜드 가이드라인 문서 작성", department: "디자인+마케팅", dDayOffset: -210, durationDays: 7, isRequired: true },
  { code: "P-04", category: "brand", title: "제품 포지셔닝 전략서 작성 (타깃 시장/USP/메시지)", department: "마케팅+영업", dDayOffset: -200, durationDays: 10, isRequired: true },
  { code: "P-05", category: "brand", title: "바이어 페르소나 정의", department: "마케팅+영업", dDayOffset: -200, durationDays: 5, isRequired: true },
  { code: "P-06", category: "brand", title: "경쟁사 분석 보고서", department: "마케팅+영업", dDayOffset: -190, durationDays: 10, isRequired: true },
  { code: "P-07", category: "brand", title: "핵심 마케팅 메시지 확정 (슬로건/태그라인)", department: "마케팅", dDayOffset: -180, durationDays: 7, isRequired: true },
  { code: "P-08", category: "brand", title: "브랜드 템플릿 라이브러리 구축", department: "디자인+마케팅", dDayOffset: -170, durationDays: 7, isRequired: false },
  // A: 사진/영상 (15)
  { code: "A-01", category: "photo", title: "제품 외관 사진 촬영 기획안 작성", department: "마케팅", dDayOffset: -180, durationDays: 3, isRequired: true },
  { code: "A-02", category: "photo", title: "제품 스튜디오 사진 촬영", department: "마케팅", dDayOffset: -170, durationDays: 2, isRequired: true },
  { code: "A-03", category: "photo", title: "제품 사용 장면 사진 촬영 (모델+병원 환경)", department: "마케팅", dDayOffset: -160, durationDays: 3, isRequired: true },
  { code: "A-04", category: "photo", title: "사진 보정 및 리사이즈 (웹/인쇄/SNS)", department: "마케팅", dDayOffset: -155, durationDays: 5, isRequired: true },
  { code: "A-05", category: "photo", title: "제품 소개 영상 촬영 기획안 (콘티/스크립트)", department: "마케팅", dDayOffset: -150, durationDays: 5, isRequired: true },
  { code: "A-06", category: "photo", title: "제품 소개 영상 촬영 (1~3분)", department: "마케팅", dDayOffset: -140, durationDays: 3, isRequired: true },
  { code: "A-07", category: "photo", title: "제품 사용법 교육 영상 촬영", department: "마케팅+CS", dDayOffset: -135, durationDays: 3, isRequired: true },
  { code: "A-08", category: "photo", title: "영상 편집 및 자막/더빙 작업", department: "마케팅", dDayOffset: -130, durationDays: 7, isRequired: true },
  { code: "A-09", category: "photo", title: "3D 렌더링 제작 (포토리얼리스틱)", department: "디자인", dDayOffset: -160, durationDays: 14, isRequired: false },
  { code: "A-10", category: "photo", title: "MOA(기전) 애니메이션 제작", department: "디자인+개발", dDayOffset: -150, durationDays: 14, isRequired: false },
  { code: "A-11", category: "photo", title: "조립/분해 시퀀스 애니메이션", department: "디자인+CS", dDayOffset: -140, durationDays: 10, isRequired: false },
  { code: "A-12", category: "photo", title: "의료진 인터뷰 영상 촬영", department: "마케팅+임상", dDayOffset: -120, durationDays: 5, isRequired: false },
  { code: "A-13", category: "photo", title: "해외 시장용 영상 현지화", department: "마케팅", dDayOffset: -110, durationDays: 10, isRequired: false },
  { code: "A-14", category: "photo", title: "인터랙티브 제품 데모 제작", department: "마케팅+개발", dDayOffset: -120, durationDays: 21, isRequired: false },
  { code: "A-15", category: "photo", title: "사진/영상 자산 최종 검수 및 아카이빙", department: "마케팅", dDayOffset: -100, durationDays: 2, isRequired: true },
  // B: 인쇄물/문서 (18)
  { code: "B-01", category: "print", title: "제품 카탈로그 원고 작성", department: "마케팅+개발", dDayOffset: -150, durationDays: 7, isRequired: true },
  { code: "B-02", category: "print", title: "카탈로그 디자인 시안 제작 (2~3안)", department: "디자인+마케팅", dDayOffset: -140, durationDays: 7, isRequired: true },
  { code: "B-03", category: "print", title: "카탈로그 내부 검토 및 수정", department: "마케팅+품질", dDayOffset: -130, durationDays: 5, isRequired: true },
  { code: "B-04", category: "print", title: "카탈로그 인쇄 발주 (리드타임 2~3주)", department: "마케팅", dDayOffset: -120, durationDays: 21, isRequired: true },
  { code: "B-05", category: "print", title: "기술 데이터 시트 작성", department: "개발+마케팅", dDayOffset: -140, durationDays: 5, isRequired: true },
  { code: "B-06", category: "print", title: "기술 데이터 시트 규격 검증", department: "품질+개발", dDayOffset: -130, durationDays: 3, isRequired: true },
  { code: "B-07", category: "print", title: "임상 백서 초안 작성", department: "임상+마케팅", dDayOffset: -130, durationDays: 14, isRequired: false },
  { code: "B-08", category: "print", title: "임상 백서 내부 검토", department: "임상", dDayOffset: -110, durationDays: 7, isRequired: false },
  { code: "B-09", category: "print", title: "영업 교육 자료 작성 (PPT+스크립트)", department: "영업+마케팅", dDayOffset: -100, durationDays: 7, isRequired: true },
  { code: "B-10", category: "print", title: "영업 교육 자료 — 경쟁사 비교표", department: "영업+마케팅", dDayOffset: -90, durationDays: 3, isRequired: true },
  { code: "B-11", category: "print", title: "FAQ 문서 작성 (예상 질문 50개+)", department: "영업+CS+개발", dDayOffset: -90, durationDays: 7, isRequired: true },
  { code: "B-12", category: "print", title: "병원 내부품의서 양식 작성", department: "영업", dDayOffset: -80, durationDays: 5, isRequired: true },
  { code: "B-13", category: "print", title: "제품 비교 분석표 작성", department: "영업+마케팅", dDayOffset: -80, durationDays: 5, isRequired: true },
  { code: "B-14", category: "print", title: "TCO 산출표 작성 (병원 제출용)", department: "CS+영업", dDayOffset: -70, durationDays: 5, isRequired: false },
  { code: "B-15", category: "print", title: "학술 포스터/논문 초록 준비", department: "임상+마케팅", dDayOffset: -90, durationDays: 14, isRequired: false },
  { code: "B-16", category: "print", title: "해외 시장용 카탈로그 번역", department: "마케팅", dDayOffset: -100, durationDays: 14, isRequired: false },
  { code: "B-17", category: "print", title: "납품 제안서 표준 템플릿 작성", department: "영업", dDayOffset: -60, durationDays: 5, isRequired: true },
  { code: "B-18", category: "print", title: "인쇄물 최종 재고 확인 및 배포 계획", department: "마케팅", dDayOffset: -30, durationDays: 2, isRequired: true },
  // C: 디지털 콘텐츠 (14)
  { code: "C-01", category: "digital", title: "웹사이트 제품 페이지 기획 (SEO 포함)", department: "마케팅", dDayOffset: -90, durationDays: 5, isRequired: true },
  { code: "C-02", category: "digital", title: "웹사이트 제품 페이지 디자인/개발", department: "마케팅+개발", dDayOffset: -80, durationDays: 14, isRequired: true },
  { code: "C-03", category: "digital", title: "웹사이트 제품 페이지 QA 및 라이브", department: "마케팅", dDayOffset: -60, durationDays: 3, isRequired: true },
  { code: "C-04", category: "digital", title: "SNS 콘텐츠 기획 (티저+런칭)", department: "마케팅", dDayOffset: -60, durationDays: 5, isRequired: true },
  { code: "C-05", category: "digital", title: "SNS 콘텐츠 제작 (이미지+영상+카피)", department: "마케팅", dDayOffset: -50, durationDays: 10, isRequired: true },
  { code: "C-06", category: "digital", title: "SNS 런칭 캠페인 일정표 확정", department: "마케팅", dDayOffset: -40, durationDays: 2, isRequired: true },
  { code: "C-07", category: "digital", title: "이메일 캠페인 세그먼트 정의", department: "마케팅", dDayOffset: -50, durationDays: 3, isRequired: false },
  { code: "C-08", category: "digital", title: "이메일 캠페인 콘텐츠 및 A/B 테스트", department: "마케팅", dDayOffset: -40, durationDays: 7, isRequired: false },
  { code: "C-09", category: "digital", title: "온라인 광고 소재 제작", department: "마케팅", dDayOffset: -40, durationDays: 7, isRequired: false },
  { code: "C-10", category: "digital", title: "온라인 광고 매체 선정 및 예산 배분", department: "마케팅+경영", dDayOffset: -35, durationDays: 3, isRequired: false },
  { code: "C-11", category: "digital", title: "리드 수집용 랜딩 페이지 제작", department: "마케팅", dDayOffset: -45, durationDays: 7, isRequired: false },
  { code: "C-12", category: "digital", title: "블로그/뉴스레터 원고 작성", department: "마케팅", dDayOffset: -30, durationDays: 5, isRequired: false },
  { code: "C-13", category: "digital", title: "보도자료 작성 및 배포", department: "마케팅+경영", dDayOffset: -14, durationDays: 5, isRequired: false },
  { code: "C-14", category: "digital", title: "해외 디지털 콘텐츠 현지화", department: "마케팅", dDayOffset: -45, durationDays: 14, isRequired: false },
  // D: 가격/견적/계약 (16)
  { code: "D-01", category: "pricing", title: "원가 분석 및 목표 마진율 설정", department: "경영+영업", dDayOffset: -120, durationDays: 7, isRequired: true },
  { code: "D-02", category: "pricing", title: "국내 가격 전략 확정", department: "영업+경영", dDayOffset: -110, durationDays: 5, isRequired: true },
  { code: "D-03", category: "pricing", title: "해외 가격 전략 확정 (FOB/CIF)", department: "영업+경영", dDayOffset: -110, durationDays: 5, isRequired: true },
  { code: "D-04", category: "pricing", title: "표준 가격표 작성 (국내)", department: "영업", dDayOffset: -100, durationDays: 3, isRequired: true },
  { code: "D-05", category: "pricing", title: "해외 가격표 작성 (통화별)", department: "영업", dDayOffset: -100, durationDays: 3, isRequired: true },
  { code: "D-06", category: "pricing", title: "대리점 마진 구조 확정", department: "영업+경영", dDayOffset: -90, durationDays: 5, isRequired: true },
  { code: "D-07", category: "pricing", title: "거래처별 견적서 작성", department: "영업", dDayOffset: -60, durationDays: 1, isRequired: true, perCustomer: true },
  { code: "D-08", category: "pricing", title: "거래처별 공급 계약서 준비", department: "영업+법무", dDayOffset: -60, durationDays: 3, isRequired: true, perCustomer: true },
  { code: "D-09", category: "pricing", title: "거래처별 공급 계약 체결", department: "영업", dDayOffset: -30, durationDays: 7, isRequired: true, perCustomer: true },
  { code: "D-10", category: "pricing", title: "수출 계약서 준비 (해외 법인/파트너)", department: "영업+법무", dDayOffset: -60, durationDays: 7, isRequired: true, perCustomer: true },
  { code: "D-11", category: "pricing", title: "HIRA 급여 등재 신청", department: "인증+영업", dDayOffset: -90, durationDays: 60, isRequired: false },
  { code: "D-12", category: "pricing", title: "나라장터(조달청) 등록 준비", department: "영업", dDayOffset: -60, durationDays: 14, isRequired: false },
  { code: "D-13", category: "pricing", title: "할부/렌탈/리스 조건 확정", department: "영업+경영", dDayOffset: -45, durationDays: 7, isRequired: false },
  { code: "D-14", category: "pricing", title: "초도 물량 배분 계획 (거래처별)", department: "영업+제조", dDayOffset: -30, durationDays: 3, isRequired: true, perCustomer: true },
  { code: "D-15", category: "pricing", title: "첫 출하 스케줄 확정 (거래처별 납기)", department: "영업+제조", dDayOffset: -14, durationDays: 3, isRequired: true, perCustomer: true },
  { code: "D-16", category: "pricing", title: "거래처 서류 수집 (사업자등록증 등)", department: "영업", dDayOffset: -45, durationDays: 7, isRequired: true, perCustomer: true },
  // E: 영업 교육/역량 (14)
  { code: "E-01", category: "sales_training", title: "영업 교육 커리큘럼 수립", department: "영업+마케팅", dDayOffset: -90, durationDays: 5, isRequired: true },
  { code: "E-02", category: "sales_training", title: "제품 교육 세션 실시 (사내 영업팀)", department: "영업+개발", dDayOffset: -60, durationDays: 2, isRequired: true },
  { code: "E-03", category: "sales_training", title: "제품 교육 세션 실시 (대리점/딜러)", department: "영업", dDayOffset: -45, durationDays: 3, isRequired: true },
  { code: "E-04", category: "sales_training", title: "해외 법인/파트너 제품 교육", department: "영업", dDayOffset: -45, durationDays: 5, isRequired: true },
  { code: "E-05", category: "sales_training", title: "데모기 수량 확정 및 제조 요청", department: "영업+제조", dDayOffset: -60, durationDays: 1, isRequired: true },
  { code: "E-06", category: "sales_training", title: "데모기 제작 완료 확인", department: "제조", dDayOffset: -30, durationDays: 0, isRequired: true },
  { code: "E-07", category: "sales_training", title: "데모기 배포 (영업+주요 대리점)", department: "영업", dDayOffset: -21, durationDays: 5, isRequired: true },
  { code: "E-08", category: "sales_training", title: "영업 롤플레이 연습 (모의 상담)", department: "영업", dDayOffset: -30, durationDays: 2, isRequired: true },
  { code: "E-09", category: "sales_training", title: "파일럿 사이트 선정 (2~3개 병원)", department: "영업", dDayOffset: -90, durationDays: 7, isRequired: false },
  { code: "E-10", category: "sales_training", title: "파일럿 사이트 설치 및 피드백 수집", department: "영업+CS", dDayOffset: -60, durationDays: 30, isRequired: false },
  { code: "E-11", category: "sales_training", title: "파일럿 결과 정리 및 레퍼런스 확보", department: "영업+마케팅", dDayOffset: -30, durationDays: 5, isRequired: false },
  { code: "E-12", category: "sales_training", title: "KOL 섭외 및 관계 구축", department: "영업+임상", dDayOffset: -90, durationDays: 0, isRequired: false },
  { code: "E-13", category: "sales_training", title: "학회 전시 부스 예약 및 준비", department: "마케팅+영업", dDayOffset: -60, durationDays: 14, isRequired: false },
  { code: "E-14", category: "sales_training", title: "영업 목표 설정 (분기/연간 판매 계획)", department: "영업+경영", dDayOffset: -30, durationDays: 5, isRequired: true },
  // F: 거래처 통보/관리 (10)
  { code: "F-01", category: "dealer_notify", title: "거래처별 출시 사전 통보 (1차 — 제품 소개)", department: "영업", dDayOffset: -60, durationDays: 1, isRequired: true, perCustomer: true },
  { code: "F-02", category: "dealer_notify", title: "거래처별 출시 확정 통보 (2차 — 가격/납기)", department: "영업", dDayOffset: -30, durationDays: 1, isRequired: true, perCustomer: true },
  { code: "F-03", category: "dealer_notify", title: "거래처별 교육 일정 안내", department: "영업", dDayOffset: -45, durationDays: 1, isRequired: true, perCustomer: true },
  { code: "F-04", category: "dealer_notify", title: "주요 병원 구매부서 사전 미팅", department: "영업", dDayOffset: -45, durationDays: 0, isRequired: true, perCustomer: true },
  { code: "F-05", category: "dealer_notify", title: "병원 내부품의 지원 (견적+기술자료)", department: "영업", dDayOffset: -30, durationDays: 2, isRequired: true, perCustomer: true },
  { code: "F-06", category: "dealer_notify", title: "해외 법인 런칭 킥오프 미팅", department: "영업", dDayOffset: -30, durationDays: 1, isRequired: true, perCustomer: true },
  { code: "F-07", category: "dealer_notify", title: "대리점 인센티브 프로그램 안내", department: "영업+경영", dDayOffset: -30, durationDays: 3, isRequired: false },
  { code: "F-08", category: "dealer_notify", title: "VIP 고객 대상 사전 체험 행사", department: "영업+마케팅", dDayOffset: -14, durationDays: 3, isRequired: false, perCustomer: true },
  { code: "F-09", category: "dealer_notify", title: "런칭 이벤트 초대장 발송", department: "마케팅+영업", dDayOffset: -14, durationDays: 2, isRequired: false, perCustomer: true },
  { code: "F-10", category: "dealer_notify", title: "출시 후 1주일 거래처 피드백 수집", department: "영업", dDayOffset: 7, durationDays: 1, isRequired: true, perCustomer: true },
  // G: CS/서비스 준비 (18)
  { code: "G-01", category: "cs", title: "A/S 원가 분석 (부품비+인건비+물류비)", department: "CS+경영", dDayOffset: -90, durationDays: 7, isRequired: true },
  { code: "G-02", category: "cs", title: "A/S 가격 결정 (손익분기 기반)", department: "CS+경영", dDayOffset: -80, durationDays: 5, isRequired: true },
  { code: "G-03", category: "cs", title: "보증 기간 및 조건 확정", department: "CS+법무", dDayOffset: -80, durationDays: 5, isRequired: true },
  { code: "G-04", category: "cs", title: "보증서 양식 작성 (국문/영문)", department: "CS", dDayOffset: -70, durationDays: 3, isRequired: true },
  { code: "G-05", category: "cs", title: "서비스 부품 가격표 작성", department: "CS+구매", dDayOffset: -70, durationDays: 5, isRequired: true },
  { code: "G-06", category: "cs", title: "서비스 부품 초기 재고 확보", department: "CS+구매", dDayOffset: -45, durationDays: 14, isRequired: true },
  { code: "G-07", category: "cs", title: "A/S 접수 프로세스 정의", department: "CS", dDayOffset: -60, durationDays: 7, isRequired: true },
  { code: "G-08", category: "cs", title: "A/S 접수 채널 개설 (전화/이메일/웹폼)", department: "CS", dDayOffset: -45, durationDays: 5, isRequired: true },
  { code: "G-09", category: "cs", title: "서비스 매뉴얼 작성 (분해/조립/교정)", department: "CS+개발", dDayOffset: -60, durationDays: 14, isRequired: true },
  { code: "G-10", category: "cs", title: "CS 담당자 제품 교육 (실습 포함)", department: "CS+개발", dDayOffset: -30, durationDays: 3, isRequired: true },
  { code: "G-11", category: "cs", title: "고객 상담 매뉴얼 작성 (응대 스크립트)", department: "CS", dDayOffset: -30, durationDays: 7, isRequired: true },
  { code: "G-12", category: "cs", title: "원격 진단/지원 체계 구축", department: "CS+개발", dDayOffset: -30, durationDays: 7, isRequired: false },
  { code: "G-13", category: "cs", title: "해외 A/S 체계 구축 (현지 파트너 연계)", department: "CS+영업", dDayOffset: -45, durationDays: 14, isRequired: true },
  { code: "G-14", category: "cs", title: "설치 가이드 작성 (설치형 장비)", department: "CS+개발", dDayOffset: -45, durationDays: 7, isRequired: true },
  { code: "G-15", category: "cs", title: "교정(Calibration) 절차서 작성", department: "CS+품질", dDayOffset: -45, durationDays: 7, isRequired: false },
  { code: "G-16", category: "cs", title: "소모품/액세서리 판매 계획 수립", department: "CS+영업", dDayOffset: -30, durationDays: 5, isRequired: false },
  { code: "G-17", category: "cs", title: "고객 만족도 조사 양식 준비", department: "CS", dDayOffset: -14, durationDays: 3, isRequired: false },
  { code: "G-18", category: "cs", title: "CS KPI 목표 설정", department: "CS+경영", dDayOffset: -14, durationDays: 3, isRequired: true },
  // H: 규제/인허가/등록 (14)
  { code: "H-01", category: "regulatory", title: "MFDS 품목허가/인증 취득 완료 확인", department: "인증", dDayOffset: -180, durationDays: 0, isRequired: true },
  { code: "H-02", category: "regulatory", title: "허가 사항 vs 실제 제품 일치 확인", department: "인증+품질", dDayOffset: -60, durationDays: 3, isRequired: true },
  { code: "H-03", category: "regulatory", title: "UDI-DI (기기식별자) 발급", department: "인증", dDayOffset: -90, durationDays: 14, isRequired: true },
  { code: "H-04", category: "regulatory", title: "UDI-PI 체계 구축 (로트/시리얼)", department: "인증+제조", dDayOffset: -60, durationDays: 7, isRequired: true },
  { code: "H-05", category: "regulatory", title: "UDI 데이터베이스 등록", department: "인증", dDayOffset: -45, durationDays: 7, isRequired: true },
  { code: "H-06", category: "regulatory", title: "라벨링 최종 확인 (제품/포장/IFU)", department: "인증+품질", dDayOffset: -45, durationDays: 5, isRequired: true },
  { code: "H-07", category: "regulatory", title: "병원 조달 등록 서류 준비", department: "인증+영업", dDayOffset: -30, durationDays: 7, isRequired: true },
  { code: "H-08", category: "regulatory", title: "CE 인증 완료 확인 (유럽 수출 시)", department: "인증", dDayOffset: -120, durationDays: 0, isRequired: false },
  { code: "H-09", category: "regulatory", title: "FDA 510(k) clearance 확인 (미국)", department: "인증", dDayOffset: -120, durationDays: 0, isRequired: false },
  { code: "H-10", category: "regulatory", title: "수출 허가/면허 취득 확인", department: "인증", dDayOffset: -60, durationDays: 14, isRequired: false },
  { code: "H-11", category: "regulatory", title: "수출 통관 서류 준비", department: "인증+영업", dDayOffset: -30, durationDays: 7, isRequired: false },
  { code: "H-12", category: "regulatory", title: "GMP 적합성 인정서 유효 확인", department: "인증+품질", dDayOffset: -90, durationDays: 0, isRequired: true },
  { code: "H-13", category: "regulatory", title: "HIRA 급여 등재 신청 (해당 시)", department: "인증", dDayOffset: -120, durationDays: 60, isRequired: false },
  { code: "H-14", category: "regulatory", title: "의료기기 광고 사전심의 (해당 시)", department: "인증+마케팅", dDayOffset: -30, durationDays: 14, isRequired: false },
  // I: 물류/재고/출하 (10)
  { code: "I-01", category: "logistics", title: "제품 포장 사양 확정", department: "제조+디자인", dDayOffset: -45, durationDays: 5, isRequired: true },
  { code: "I-02", category: "logistics", title: "포장재 인쇄 발주", department: "구매", dDayOffset: -40, durationDays: 14, isRequired: true },
  { code: "I-03", category: "logistics", title: "물류 채널 확정 (택배/화물/직배송)", department: "영업+경영", dDayOffset: -30, durationDays: 3, isRequired: true },
  { code: "I-04", category: "logistics", title: "초도 생산 물량 확정", department: "영업+제조", dDayOffset: -30, durationDays: 2, isRequired: true },
  { code: "I-05", category: "logistics", title: "창고 입고/출고 프로세스 확인", department: "영업+제조", dDayOffset: -21, durationDays: 3, isRequired: true },
  { code: "I-06", category: "logistics", title: "수출 물류 준비 (포워더/보험)", department: "영업", dDayOffset: -21, durationDays: 7, isRequired: false },
  { code: "I-07", category: "logistics", title: "초도 물량 생산 완료 확인", department: "제조", dDayOffset: -14, durationDays: 0, isRequired: true },
  { code: "I-08", category: "logistics", title: "초도 물량 출하 검사 통과", department: "품질", dDayOffset: -7, durationDays: 3, isRequired: true },
  { code: "I-09", category: "logistics", title: "첫 출하 실행", department: "영업+제조", dDayOffset: 0, durationDays: 1, isRequired: true },
  { code: "I-10", category: "logistics", title: "출하 후 배송 추적 및 도착 확인", department: "영업", dDayOffset: 3, durationDays: 3, isRequired: true },
  // J: 런칭 이벤트/PR (8)
  { code: "J-01", category: "launch_event", title: "런칭 이벤트 기획", department: "마케팅+영업", dDayOffset: -60, durationDays: 7, isRequired: false },
  { code: "J-02", category: "launch_event", title: "런칭 이벤트 장소/플랫폼 섭외", department: "마케팅", dDayOffset: -45, durationDays: 3, isRequired: false },
  { code: "J-03", category: "launch_event", title: "런칭 이벤트 초대 및 참석자 관리", department: "마케팅+영업", dDayOffset: -21, durationDays: 7, isRequired: false },
  { code: "J-04", category: "launch_event", title: "런칭 이벤트 실행", department: "전체", dDayOffset: 0, durationDays: 1, isRequired: false },
  { code: "J-05", category: "launch_event", title: "보도자료 배포 (언론사/업계지)", department: "마케팅", dDayOffset: -7, durationDays: 3, isRequired: false },
  { code: "J-06", category: "launch_event", title: "SNS 런칭 캠페인 실행", department: "마케팅", dDayOffset: 0, durationDays: 7, isRequired: true },
  { code: "J-07", category: "launch_event", title: "출시 후 초기 반응 모니터링", department: "마케팅", dDayOffset: 1, durationDays: 14, isRequired: true },
  { code: "J-08", category: "launch_event", title: "출시 후 2주 리뷰 미팅 (전 부서)", department: "경영+전체", dDayOffset: 14, durationDays: 1, isRequired: true },
  // L: KOL/학회/임상 마케팅 (10)
  { code: "L-01", category: "kol", title: "KOL 후보 리스트 작성 (전문 분야별 3~5명)", department: "임상+영업", dDayOffset: -180, durationDays: 7, isRequired: true },
  { code: "L-02", category: "kol", title: "KOL 섭외 및 자문 계약 체결", department: "임상+영업", dDayOffset: -160, durationDays: 14, isRequired: true },
  { code: "L-03", category: "kol", title: "KOL 자문 회의 실시 (제품 피드백)", department: "임상+개발", dDayOffset: -140, durationDays: 3, isRequired: true },
  { code: "L-04", category: "kol", title: "KOL 대상 제품 사전 체험 프로그램", department: "영업+임상", dDayOffset: -90, durationDays: 30, isRequired: false },
  { code: "L-05", category: "kol", title: "KOL 추천사/추천 영상 확보", department: "마케팅+임상", dDayOffset: -45, durationDays: 14, isRequired: false },
  { code: "L-06", category: "kol", title: "학회 발표 일정 확인 (연관 학회 캘린더)", department: "마케팅+임상", dDayOffset: -180, durationDays: 3, isRequired: true },
  { code: "L-07", category: "kol", title: "학회 전시 부스 예약", department: "마케팅", dDayOffset: -120, durationDays: 1, isRequired: false },
  { code: "L-08", category: "kol", title: "학회 전시 부스 디자인 및 제작", department: "마케팅+디자인", dDayOffset: -60, durationDays: 21, isRequired: false },
  { code: "L-09", category: "kol", title: "학회 발표 초록/포스터 준비", department: "임상+마케팅", dDayOffset: -90, durationDays: 14, isRequired: false },
  { code: "L-10", category: "kol", title: "학회 후 리드(잠재고객) 후속 연락", department: "영업", dDayOffset: 7, durationDays: 7, isRequired: false },
  // M: 보험급여/조달/시장접근 (8)
  { code: "M-01", category: "insurance", title: "건강보험 급여 적용 여부 판단", department: "인증+영업", dDayOffset: -120, durationDays: 5, isRequired: true },
  { code: "M-02", category: "insurance", title: "HIRA 급여 등재 신청 (해당 시)", department: "인증", dDayOffset: -120, durationDays: 120, isRequired: false },
  { code: "M-03", category: "insurance", title: "건강보험 수가 산정 자료 준비", department: "인증+경영", dDayOffset: -90, durationDays: 14, isRequired: false },
  { code: "M-04", category: "insurance", title: "나라장터 등록 준비 (공공기관 납품용)", department: "영업", dDayOffset: -60, durationDays: 14, isRequired: false },
  { code: "M-05", category: "insurance", title: "나라장터 등록 완료", department: "영업", dDayOffset: -30, durationDays: 14, isRequired: false },
  { code: "M-06", category: "insurance", title: "보건경제성 분석 자료 작성", department: "임상+경영", dDayOffset: -60, durationDays: 21, isRequired: false },
  { code: "M-07", category: "insurance", title: "병원 구매위원회 발표 자료 준비", department: "영업", dDayOffset: -45, durationDays: 7, isRequired: true },
  { code: "M-08", category: "insurance", title: "해외 보험급여/상환 전략 수립", department: "인증+영업", dDayOffset: -90, durationDays: 21, isRequired: false },
  // N: 출시 후 모니터링/성과 추적 (8)
  { code: "N-01", category: "post_launch", title: "출시 후 1주 — 초기 판매 실적 집계", department: "영업+경영", dDayOffset: 7, durationDays: 1, isRequired: true },
  { code: "N-02", category: "post_launch", title: "출시 후 1주 — 고객 피드백 수집", department: "영업+CS", dDayOffset: 7, durationDays: 7, isRequired: true },
  { code: "N-03", category: "post_launch", title: "출시 후 2주 — 전 부서 리뷰 미팅", department: "경영+전체", dDayOffset: 14, durationDays: 1, isRequired: true },
  { code: "N-04", category: "post_launch", title: "출시 후 1개월 — 판매 목표 대비 실적 분석", department: "영업+경영", dDayOffset: 30, durationDays: 3, isRequired: true },
  { code: "N-05", category: "post_launch", title: "출시 후 1개월 — CS 이슈 취합", department: "CS", dDayOffset: 30, durationDays: 3, isRequired: true },
  { code: "N-06", category: "post_launch", title: "출시 후 1개월 — FAQ 보완", department: "CS+영업", dDayOffset: 30, durationDays: 5, isRequired: true },
  { code: "N-07", category: "post_launch", title: "출시 후 3개월 — 분기 실적 분석", department: "영업+경영", dDayOffset: 90, durationDays: 5, isRequired: true },
  { code: "N-08", category: "post_launch", title: "출시 후 3개월 — 마케팅 채널별 ROI 분석", department: "마케팅+경영", dDayOffset: 90, durationDays: 5, isRequired: true },
];

// ─── Ordered category list (for consistent ordering) ────────────────────────

const CATEGORY_ORDER = [
  "pricing", "regulatory",                         // product_info stage
  "brand", "photo", "print", "digital",            // materials stage
  "dealer_notify", "sales_training",               // distribution stage
  "launch_event", "kol",                           // education stage
  "cs", "logistics", "insurance", "post_launch",   // launch_check stage
];

// ─── Batch helper ───────────────────────────────────────────────────────────

const BATCH_LIMIT = 450;

async function commitBatches(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    for (const op of chunk) {
      op(batch);
    }
    await batch.commit();
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  // Check if data already exists
  const stagesSnap = await db.collection("launchPipelineStages").limit(1).get();
  if (!stagesSnap.empty) {
    console.log("launchPipelineStages already has documents — skipping seed.");
    process.exit(0);
  }

  // 1) Seed pipeline stages
  console.log(`Seeding ${PIPELINE_STAGES.length} pipeline stages...`);
  {
    const ops = PIPELINE_STAGES.map((stage, idx) => (batch) => {
      const ref = db.collection("launchPipelineStages").doc(stage.key);
      batch.set(ref, {
        key: stage.key,
        label: stage.label,
        icon: stage.icon,
        order: idx,
      });
    });
    await commitBatches(ops);
  }
  console.log("  Done.");

  // 2) Seed categories
  console.log(`Seeding ${CATEGORY_ORDER.length} categories...`);
  {
    const ops = CATEGORY_ORDER.map((catKey, idx) => (batch) => {
      const ref = db.collection("launchCategories").doc(catKey);
      batch.set(ref, {
        key: catKey,
        label: LAUNCH_CATEGORY_LABELS[catKey],
        pipelineStageId: CATEGORY_TO_STAGE[catKey],
        order: idx,
      });
    });
    await commitBatches(ops);
  }
  console.log("  Done.");

  // 3) Seed template items
  console.log(`Seeding ${TEMPLATE_ITEMS.length} template items...`);
  {
    const ops = TEMPLATE_ITEMS.map((item) => (batch) => {
      const ref = db.collection("launchTemplateItems").doc(item.code);
      batch.set(ref, {
        code: item.code,
        categoryKey: item.category,
        title: item.title,
        department: item.department,
        dDayOffset: item.dDayOffset,
        durationDays: item.durationDays,
        isRequired: item.isRequired,
        perCustomer: item.perCustomer || false,
      });
    });
    await commitBatches(ops);
  }
  console.log("  Done.");

  console.log("\nSeed complete!");
  console.log(`  - ${PIPELINE_STAGES.length} pipeline stages`);
  console.log(`  - ${CATEGORY_ORDER.length} categories`);
  console.log(`  - ${TEMPLATE_ITEMS.length} template items`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
