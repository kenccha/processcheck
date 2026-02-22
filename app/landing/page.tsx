"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-surface-0 text-slate-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-1/80 backdrop-blur-xl border-b border-surface-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center shadow-glow-sm">
                <span className="text-white font-bold text-xs tracking-tighter font-mono">PC</span>
              </div>
              <span className="text-base font-semibold text-slate-100 tracking-tight">
                Process<span className="text-primary-400">Check</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">주요 기능</a>
              <a href="#benefits" onClick={(e) => { e.preventDefault(); scrollTo("benefits"); }} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">효과</a>
              <a href="#use-cases" onClick={(e) => { e.preventDefault(); scrollTo("use-cases"); }} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">적용 사례</a>
              <button className="btn-primary text-sm" onClick={() => router.push(basePath + "/")}>시작하기</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 bg-grid opacity-60" />
        {/* Radial glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary-500/5 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-1.5 bg-primary-500/10 border border-primary-500/20 text-primary-300 rounded-full text-sm font-medium mb-8 animate-fade-in">
              실무자를 위한 프로세스 관리 시스템
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-50 mb-6 leading-tight tracking-tight animate-fade-in-delay-1 opacity-0">
              30분 걸리던 진행 상황 파악,<br />
              <span className="text-primary-400 glow-text">이제 3분이면 충분합니다</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 mb-14 max-w-2xl mx-auto animate-fade-in-delay-2 opacity-0">
              전자제품 개발 프로세스의 투명성 확보 및 부서 간 협업 효율화 시스템
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-14 animate-fade-in-delay-3 opacity-0">
              <div className="bg-surface-2 border border-surface-3 p-6 rounded-2xl hover:border-primary-500/30 hover:shadow-glow-sm transition-all">
                <div className="stat-value text-primary-400 mb-1">90%</div>
                <div className="text-sm font-medium text-slate-200 mb-0.5">시간 단축</div>
                <div className="text-xs text-slate-500">진행 상황 파악 시간</div>
              </div>
              <div className="bg-surface-2 border border-surface-3 p-6 rounded-2xl hover:border-success-500/30 transition-all">
                <div className="stat-value text-success-400 mb-1">0건</div>
                <div className="text-sm font-medium text-slate-200 mb-0.5">누락 제로</div>
                <div className="text-xs text-slate-500">부서 간 정보 공유</div>
              </div>
              <div className="bg-surface-2 border border-surface-3 p-6 rounded-2xl hover:border-warning-500/30 transition-all">
                <div className="stat-value text-warning-400 mb-1">40%</div>
                <div className="text-sm font-medium text-slate-200 mb-0.5">미팅 감소</div>
                <div className="text-xs text-slate-500">불필요한 회의 시간</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-delay-4 opacity-0">
              <button className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-400 transition-all font-semibold text-lg shadow-glow hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]" onClick={() => router.push(basePath + "/")}>
                무료로 시작하기
              </button>
              <button className="px-8 py-4 bg-surface-2 text-slate-200 rounded-xl hover:bg-surface-3 transition-all font-semibold text-lg border border-surface-3 hover:border-surface-4" onClick={() => scrollTo("features")}>
                데모 보기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-1 border-t border-b border-surface-3">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-50 mb-4 tracking-tight">
              이런 경험 있으시죠?
            </h2>
            <p className="text-lg text-slate-400">
              매일 반복되는 비효율, 이제 그만
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-2 border border-surface-3 p-8 rounded-2xl hover:border-danger-500/30 transition-all group">
              <div className="w-12 h-12 bg-danger-500/10 border border-danger-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.15)] transition-shadow">
                <svg className="w-6 h-6 text-danger-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-3">
                정보 찾기에 30분 소요
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                이메일 10통 확인 + Teams 메시지 검색 + 사내 시스템 3곳 접속...
              </p>
              <p className="text-sm text-slate-500 mt-3 italic">
                &quot;A 프로젝트 지금 어디까지 진행됐지?&quot;
              </p>
            </div>

            <div className="bg-surface-2 border border-surface-3 p-8 rounded-2xl hover:border-warning-500/30 transition-all group">
              <div className="w-12 h-12 bg-warning-500/10 border border-warning-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:shadow-[0_0_15px_rgba(245,158,11,0.15)] transition-shadow">
                <svg className="w-6 h-6 text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-3">
                부서 간 소통 누락
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                설계 변경했는데 제조팀은 모르고 진행 중...
              </p>
              <p className="text-sm text-slate-500 mt-3 italic">
                &quot;아니 왜 나한테 얘기 안 해줬어요?&quot;
              </p>
            </div>

            <div className="bg-surface-2 border border-surface-3 p-8 rounded-2xl hover:border-primary-500/30 transition-all group">
              <div className="w-12 h-12 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-shadow">
                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-3">
                불필요한 미팅 과다
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                진행 상황 확인하려고 또 미팅 소집...
              </p>
              <p className="text-sm text-slate-500 mt-3 italic">
                &quot;이 미팅, 굳이 해야 하나?&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-50 mb-4 tracking-tight">
              이제 한 곳에서 모든 게 해결됩니다
            </h2>
            <p className="text-lg text-slate-400">
              실무자가 직접 디자인한 실용적인 기능들
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <div className="badge-primary mb-4">핵심 기능 1</div>
              <h3 className="text-3xl font-bold text-slate-50 mb-4 tracking-tight">
                역할별 맞춤 대시보드
              </h3>
              <p className="text-base text-slate-400 mb-8 leading-relaxed">
                실무자, 부서 관리자, PM 각자에게 필요한 정보만 한눈에.
                불필요한 정보는 과감히 제거했습니다.
              </p>
              <ul className="space-y-3">
                {["오늘 할 일 자동 정리", "승인 대기 작업 한눈에", "프로젝트 진행률 실시간 업데이트"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-success-500/15 border border-success-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface-2 border border-surface-3 rounded-2xl aspect-video flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-grid opacity-40" />
              <div className="text-center relative">
                <svg className="w-16 h-16 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <p className="text-xs text-slate-500 font-medium">대시보드 화면</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="bg-surface-2 border border-surface-3 rounded-2xl aspect-video flex items-center justify-center order-2 lg:order-1 relative overflow-hidden">
              <div className="absolute inset-0 bg-grid opacity-40" />
              <div className="text-center relative">
                <svg className="w-16 h-16 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-xs text-slate-500 font-medium">자동 알림 화면</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="badge-success mb-4">핵심 기능 2</div>
              <h3 className="text-3xl font-bold text-slate-50 mb-4 tracking-tight">
                자동 알림 & 공유 시스템
              </h3>
              <p className="text-base text-slate-400 mb-8 leading-relaxed">
                설계 변경 시 관련 부서에 자동으로 알림. 누락 걱정 끝.
                Teams와 연동되어 바로 확인 가능합니다.
              </p>
              <ul className="space-y-3">
                {["영향 부서 자동 추천", "읽음 확인 추적", "미확인 부서 자동 리마인더"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-success-500/15 border border-success-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="badge-warning mb-4">핵심 기능 3</div>
              <h3 className="text-3xl font-bold text-slate-50 mb-4 tracking-tight">
                실시간 진행률 & 일정 관리
              </h3>
              <p className="text-base text-slate-400 mb-8 leading-relaxed">
                11단계 x 9부서 체크리스트를 한눈에. 지연 위험은 자동으로 감지하여
                조기 대응 가능합니다.
              </p>
              <ul className="space-y-3">
                {["Red/Yellow/Green 상태 표시", "간트 차트 자동 생성", "마감일 자동 알림 (3일/1일/당일)"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-success-500/15 border border-success-500/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface-2 border border-surface-3 rounded-2xl aspect-video flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-grid opacity-40" />
              <div className="text-center relative">
                <svg className="w-16 h-16 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-xs text-slate-500 font-medium">간트 차트 화면</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-24 px-4 sm:px-6 lg:px-8 bg-surface-1 border-t border-b border-surface-3">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-50 mb-4 tracking-tight">
              수치로 증명하는 효과
            </h2>
            <p className="text-lg text-slate-400">
              실제 도입 후 측정 가능한 개선 효과
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: "90%", label: "시간 단축", detail: "30분 → 3분\n진행 상황 파악 시간", color: "text-primary-400" },
              { value: "0건", label: "누락 제로", detail: "주 1건 → 0건\n설계 변경 누락 사고", color: "text-success-400" },
              { value: "40%", label: "미팅 감소", detail: "3시간 → 1.5시간\n불필요한 미팅 시간", color: "text-warning-400" },
              { value: "30%", label: "지연 감소", detail: "조기 감지로\n프로젝트 지연율 감소", color: "text-danger-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-2 border border-surface-3 p-8 rounded-2xl text-center">
                <div className={`stat-value ${stat.color} mb-2`}>{stat.value}</div>
                <div className="text-base font-semibold text-slate-200 mb-2">{stat.label}</div>
                <div className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">{stat.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-slate-600">
              * 5개 프로젝트 동시 진행, 9개 부서 기준 예상 수치
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-50 mb-4 tracking-tight">
              이런 팀에 딱 맞습니다
            </h2>
            <p className="text-lg text-slate-400">
              프로세스가 복잡할수록 효과는 더 커집니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              { title: "여러 프로젝트 동시 진행", desc: "제조업, 개발팀 등 다수의 프로젝트를 관리하는 조직" },
              { title: "부서 간 협업이 복잡한 조직", desc: "5개 이상 부서가 관여하는 프로세스" },
              { title: "정보 파편화 문제", desc: "이메일, Teams, 사내 시스템에 정보가 분산된 팀" },
              { title: "프로세스 투명성 확보", desc: "실시간 진행 상황 공유가 필요한 조직" },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4 p-5 bg-surface-2 border border-surface-3 rounded-2xl hover:border-primary-500/30 transition-all">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden border-t border-surface-3">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary-500/8 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-50 mb-6 tracking-tight">
            프로젝트 관리,<br />더 스마트하게 시작하세요
          </h2>
          <p className="text-lg mb-12 text-slate-400">
            Firebase 기반 안전한 클라우드 서비스로 언제 어디서나 접속 가능
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-400 transition-all font-semibold text-lg shadow-glow hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]" onClick={() => router.push(basePath + "/")}>
              무료로 시작하기
            </button>
            <button className="px-8 py-4 bg-surface-2 text-slate-200 rounded-xl hover:bg-surface-3 transition-all font-semibold text-lg border border-surface-3" onClick={() => router.push(basePath + "/")}>
              데모 요청하기
            </button>
          </div>
          <p className="mt-8 text-sm text-slate-600">
            설치 불필요 · 신용카드 불필요 · 5분이면 시작 가능
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-surface-1 border-t border-surface-3">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-7 h-7 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs tracking-tighter font-mono">PC</span>
                </div>
                <span className="text-base font-semibold text-slate-200">
                  Process<span className="text-primary-400">Check</span>
                </span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">
                전자제품 개발 프로세스의 투명성 확보 및<br />
                부서 간 협업 효율화 시스템
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3">제품</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo("features"); }} className="text-slate-500 hover:text-slate-300 transition-colors">주요 기능</a></li>
                <li><a href="#benefits" onClick={(e) => { e.preventDefault(); scrollTo("benefits"); }} className="text-slate-500 hover:text-slate-300 transition-colors">효과</a></li>
                <li><a href="#use-cases" onClick={(e) => { e.preventDefault(); scrollTo("use-cases"); }} className="text-slate-500 hover:text-slate-300 transition-colors">적용 사례</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3">지원</h4>
              <ul className="space-y-2 text-sm">
                <li><span className="text-slate-500">문의하기</span></li>
                <li><span className="text-slate-500">문서</span></li>
                <li><span className="text-slate-500">FAQ</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-surface-3 pt-8 text-center text-xs text-slate-600">
            <p>&copy; 2026 ProcessCheck. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
