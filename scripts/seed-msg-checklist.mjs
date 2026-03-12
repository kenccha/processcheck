// Seed MSG (시생산 완료 승인회) checklist items into templateItems
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

// MSG = phase4 (MasterGatePilot / MSG승인회)
const STAGE_ID = "phase4";

// Department IDs matching set-departments.mjs
const ITEMS = [
  // ── 개발 / R&D파트 (dept-rnd) ──
  { dept: "dept-rnd", content: "시생산에서 발생한 문제 확인 & 개선", order: 0, isRequired: true },
  { dept: "dept-rnd", content: "다국어 프로그램 IB280 탑재 (국, 영, 중, 미, 일 제작 완료 / 나머지 다국어는 출시 일정 맞춰서 배포 예정)", order: 1, isRequired: true },

  // ── 디자인 / 디자인연구소 (dept-design) ──
  { dept: "dept-design", content: "국문, 영문 사용 설명서 및 UI 제작", order: 0, isRequired: true },
  { dept: "dept-design", content: "해외출시국 대상 다국어 관련 번역 및 사용설명서 준비", order: 1, isRequired: true },
  { dept: "dept-design", content: "광고심의 리소스 제작(카탈로그)", order: 2, isRequired: true },

  // ── 품질 / 품질파트 (dept-quality) ──
  { dept: "dept-quality", content: "품질 마스터 게이터 평가(인바디 – 최우진 대리 / 생산성)", order: 0, isRequired: true },
  { dept: "dept-quality", content: "양산 Ready는 500대까지 생산(마스터)", order: 1, isRequired: true },
  { dept: "dept-quality", content: "원자재 양산성 검증 → 신부품(31종) 관리 항목 update", order: 2, isRequired: true },

  // ── 제조 / 제조그룹 (dept-manufacturing) ──
  { dept: "dept-manufacturing", content: "Pilot 3차례 진행, 50대 제작", order: 0, isRequired: true },
  { dept: "dept-manufacturing", content: "시생산 계획 : 2/23(월) ~ 3/06(금) 50대 제작", order: 1, isRequired: true },
  { dept: "dept-manufacturing", content: "마스터 500대 생산 후 양산 진행", order: 2, isRequired: true },

  // ── 구매 / 구매파트 (dept-procurement) ──
  { dept: "dept-procurement", content: "시생산 자재 구매(로드셀 2,000ea 발주, 5월초 입고 예정, 시생산 자재는 2/13 입고 완료)", order: 0, isRequired: true },
  { dept: "dept-procurement", content: "신규 업체(10개) 구매 계약서 작성 완료", order: 1, isRequired: true },

  // ── 영업 / 영업그룹 (dept-sales) ──
  { dept: "dept-sales", content: "국가별 출시 일정 및 타임라인", order: 0, isRequired: true },
  { dept: "dept-sales", content: "판매 가격 선정(3/11) 및 국내 영업 준비(카탈로그, 마케팅 자료 등)", order: 1, isRequired: true },
  { dept: "dept-sales", content: "데모 테스트", order: 2, isRequired: true },

  // ── CS / 글로벌CS팀 (dept-cs) ──
  { dept: "dept-cs", content: "TS Manual (기존 장비와의 CS 시 차이점 및 분해/조립 시 유의 사항)", order: 0, isRequired: true },
  { dept: "dept-cs", content: "Call Manual (상담 시 필요한 기본적인 장비 정보 및 유의 사항)", order: 1, isRequired: true },
  { dept: "dept-cs", content: "CS Parts List & Pricing (자재 가격 산정 및 부품 ASSY화)", order: 2, isRequired: true },
  { dept: "dept-cs", content: "국내 지사 대상 CS 교육 / 해외 거점 대상 CS 교육 (출시 전)", order: 3, isRequired: true },
  { dept: "dept-cs", content: "Chatbot 시뮬레이터 제작", order: 4, isRequired: true },
  { dept: "dept-cs", content: "분해 조립 영상 가이드 제작", order: 5, isRequired: true },

  // ── 인증 / 전략인증팀 (dept-certification) ──
  { dept: "dept-certification", content: "국내 식약처, 미국 FDA, 캐나다 의료기기 인허가 완료", order: 0, isRequired: true },
  { dept: "dept-certification", content: "유럽 등 해외 62개국 인허가 진행 중(각 국가 출시 일정에 맞춰서 인허가 진행)", order: 1, isRequired: true },
];

async function run() {
  // 1. Delete existing phase4 items only
  const existing = await getDocs(
    query(collection(db, "templateItems"), where("stageId", "==", STAGE_ID))
  );
  if (existing.docs.length > 0) {
    const delBatch = writeBatch(db);
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`Deleted ${existing.docs.length} existing phase4 items`);
  } else {
    console.log("No existing phase4 items");
  }

  // 2. Add new items
  const batch = writeBatch(db);
  let idx = 0;
  for (const item of ITEMS) {
    const id = `ti-msg-${idx}`;
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
  console.log(`Added ${ITEMS.length} MSG checklist items\n`);

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
