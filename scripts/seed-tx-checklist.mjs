// Seed Tx (Pilot 완료 승인회 / Product Readiness Approval) checklist items into templateItems
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  Timestamp,
  query,
  where,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
  authDomain: "processsss-appp.firebaseapp.com",
  projectId: "processsss-appp",
  storageBucket: "processsss-appp.firebasestorage.app",
  messagingSenderId: "1041230235574",
  appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Tx = phase3
const STAGE_ID = "phase3";

const ITEMS = [
  // ── 개발 / R&D파트 (dept-rnd) ──
  { dept: "dept-rnd", content: "제품 기준서 내 포함 자료 준비 : 품질지도서(BOM, 수입검사), 조립지도서(공정도, 조립, 검사), DHR(제조이력 기록), 도면(기구, 전자) 후가공 지도서, 승인원", order: 0, isRequired: true },
  { dept: "dept-rnd", content: "개발보고서 : 시제품(T0 ~ 생산이관) 단계에서 진행한 기계/아날로그/디지털/SW) 관련 개발 내용", order: 1, isRequired: true },
  { dept: "dept-rnd", content: "개발 단계별 검토보고서(기술/품질) : 기계설계/아날로그/디지털/디자인 분야별 제품개발 이력 작성(기획&설계&테스트 내역) 개발검토위원 분야별 검토 보고", order: 2, isRequired: true },
  { dept: "dept-rnd", content: "생산검토(생산이관 체크리스트) : Pilot 제품 대상으로 생산검토 진행", order: 3, isRequired: true },
  { dept: "dept-rnd", content: "다국어(영업계획 고려) 개발", order: 4, isRequired: true },
  { dept: "dept-rnd", content: "법인 테스트용 파일럿 제품 발송", order: 5, isRequired: true },
  { dept: "dept-rnd", content: "프로그램 체크리스트(아날로그, 디지털)", order: 6, isRequired: true },
  { dept: "dept-rnd", content: "웹 기술서 (카탈로그 기준으로 웹 기술서 작업, 공식 홈페이지 제작이 3월 완료 예정으로 이 시기에 맞춰서 제작 예정)", order: 7, isRequired: false },

  // ── 디자인 / 디자인연구소 (dept-design) ──
  { dept: "dept-design", content: "사용자 매뉴얼, 명판/박스라벨, 카탈로그, 결과지 읽기 검토, 제품 고화질 이미지", order: 0, isRequired: true },

  // ── 품질 / 품질파트 (dept-quality) ──
  { dept: "dept-quality", content: "김구현테스트 진행 및 결과 보고서 작성", order: 0, isRequired: true },
  { dept: "dept-quality", content: "마스터 게이트 평가(인바디 – 최우진 대리 / 생산성, 부품, 성능, 신뢰성 테스트)", order: 1, isRequired: true },
  { dept: "dept-quality", content: "생산 제반사항 검토(라이팅 툴, 수입검사 지그, 공정 테스트 지그, 공정 치공구)", order: 2, isRequired: true },
  { dept: "dept-quality", content: "펌웨어 검토", order: 3, isRequired: true },
  { dept: "dept-quality", content: "제품 기준서 검토", order: 4, isRequired: true },
  { dept: "dept-quality", content: "제품 EAN / UPC(소매/낱개 단위 상품용) 바코드 발급 및 공유", order: 5, isRequired: true },
  { dept: "dept-quality", content: "RoHS(전기전자제품 유해물질 사용제한 지침) 검토", order: 6, isRequired: true },
  { dept: "dept-quality", content: "수입검사", order: 7, isRequired: true },

  // ── 영업 / 영업그룹 (dept-sales) ── (국내사업파트)
  { dept: "dept-sales", content: "IB280 국내 런칭은 KIMES 기점으로 시작 → '26년은 270S와 병행 판매 예정(월 100대 예상)", order: 0, isRequired: true },

  // ── 제조 / 제조그룹 (dept-manufacturing) ──
  { dept: "dept-manufacturing", content: "Pilot 제작(모델/수량 상이)", order: 0, isRequired: true },
  { dept: "dept-manufacturing", content: "ERP내 M-BOM 구성", order: 1, isRequired: true },
  { dept: "dept-manufacturing", content: "시생산 계획 수립", order: 2, isRequired: true },

  // ── 구매 / 구매파트 (dept-procurement) ──
  { dept: "dept-procurement", content: "Pilot 자재구매", order: 0, isRequired: true },
  { dept: "dept-procurement", content: "M-BOM, 양산 부품 계약", order: 1, isRequired: true },

  // ── 경영관리 / 경영관리그룹 (dept-management) ── (회계팀)
  { dept: "dept-management", content: "제조원가 산정(MC, 생산담당자, 일생산량, 생산시간 등 정보 정리), IB280 영업이익 시나리오 작성", order: 0, isRequired: true },

  // ── 인증 / 전략인증팀 (dept-certification) ──
  { dept: "dept-certification", content: "인증 규격시험(Pilot 제품 수취 → 개발에 의견 전달, 인증 Standard 결과 보고서 작성), 국가별 출시 시점 협의 준비(영업)", order: 0, isRequired: true },
];

async function run() {
  // 1. Delete existing phase3 items only
  const existing = await getDocs(
    query(collection(db, "templateItems"), where("stageId", "==", STAGE_ID))
  );
  if (existing.docs.length > 0) {
    const delBatch = writeBatch(db);
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`Deleted ${existing.docs.length} existing phase3 items`);
  } else {
    console.log("No existing phase3 items");
  }

  // 2. Add new items
  const batch = writeBatch(db);
  let idx = 0;
  for (const item of ITEMS) {
    const id = `ti-tx-${idx}`;
    batch.set(doc(db, "templateItems", id), {
      stageId: STAGE_ID,
      departmentId: item.dept,
      content: item.content,
      order: item.order,
      isRequired: item.isRequired,
      createdBy: "system",
      createdAt: Timestamp.now(),
      lastModifiedBy: "system",
      lastModifiedAt: Timestamp.now(),
    });
    idx++;
  }
  await batch.commit();
  console.log(`Added ${ITEMS.length} Tx checklist items\n`);

  // Summary
  const deptCounts = {};
  for (const item of ITEMS) {
    deptCounts[item.dept] = (deptCounts[item.dept] || 0) + 1;
  }
  console.log("Summary by department:");
  for (const [dept, count] of Object.entries(deptCounts)) {
    console.log(`  ${dept}: ${count}개`);
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
