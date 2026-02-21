export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">PC</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">ProcessCheck</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">주요 기능</a>
              <a href="#benefits" className="text-gray-600 hover:text-gray-900 transition-colors">효과</a>
              <a href="#use-cases" className="text-gray-600 hover:text-gray-900 transition-colors">적용 사례</a>
              <button className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium">
                시작하기
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-6">
              <span className="mr-2">🎯</span>
              실무자를 위한 프로세스 관리 시스템
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              30분 걸리던 진행 상황 파악,<br />
              <span className="text-primary-600">이제 3분이면 충분합니다</span>
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              전자제품 개발 프로세스의 투명성 확보 및 부서 간 협업 효율화 시스템
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-4xl font-bold text-primary-600 mb-2">90%</div>
                <div className="text-gray-900 font-medium mb-1">시간 단축</div>
                <div className="text-sm text-gray-500">진행 상황 파악 시간</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-4xl font-bold text-success-500 mb-2">0건</div>
                <div className="text-gray-900 font-medium mb-1">누락 제로</div>
                <div className="text-sm text-gray-500">부서 간 정보 공유</div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="text-4xl font-bold text-warning-500 mb-2">40%</div>
                <div className="text-gray-900 font-medium mb-1">미팅 감소</div>
                <div className="text-sm text-gray-500">불필요한 회의 시간</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button className="px-8 py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold text-lg shadow-lg shadow-primary-200">
                무료로 시작하기
              </button>
              <button className="px-8 py-4 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-lg border-2 border-gray-200">
                데모 보기
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              이런 경험 있으시죠?
            </h2>
            <p className="text-xl text-gray-600">
              매일 반복되는 비효율, 이제 그만
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Problem 1 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">📧</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                정보 찾기에 30분 소요
              </h3>
              <p className="text-gray-600 leading-relaxed">
                이메일 10통 확인 + Teams 메시지 검색 + 사내 시스템 3곳 접속...
                <br /><br />
                &quot;A 프로젝트 지금 어디까지 진행됐지?&quot;
              </p>
            </div>

            {/* Problem 2 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">🤔</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                부서 간 소통 누락
              </h3>
              <p className="text-gray-600 leading-relaxed">
                설계 변경했는데 제조팀은 모르고 진행 중...
                <br /><br />
                &quot;아니 왜 나한테 얘기 안 해줬어요?&quot;
              </p>
            </div>

            {/* Problem 3 */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center mb-6">
                <span className="text-3xl">📅</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                불필요한 미팅 과다
              </h3>
              <p className="text-gray-600 leading-relaxed">
                진행 상황 확인하려고 또 미팅 소집...
                <br /><br />
                &quot;이 미팅, 굳이 해야 하나?&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              이제 한 곳에서 모든 게 해결됩니다
            </h2>
            <p className="text-xl text-gray-600">
              실무자가 직접 디자인한 실용적인 기능들
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Feature 1 */}
            <div>
              <div className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">
                핵심 기능 1
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                역할별 맞춤 대시보드
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                실무자, 부서 관리자, PM 각자에게 필요한 정보만 한눈에.
                불필요한 정보는 과감히 제거했습니다.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">오늘 할 일 자동 정리</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">승인 대기 작업 한눈에</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">프로젝트 진행률 실시간 업데이트</span>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl border border-blue-100 aspect-video flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path>
                </svg>
                <p className="text-sm font-medium">대시보드 화면 이미지</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Feature 2 - Image First */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl border border-green-100 aspect-video flex items-center justify-center order-2 lg:order-1">
              <div className="text-center text-gray-400">
                <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                </svg>
                <p className="text-sm font-medium">자동 알림 화면 이미지</p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center px-3 py-1 bg-success-100 text-success-700 rounded-full text-sm font-medium mb-4">
                핵심 기능 2
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                자동 알림 & 공유 시스템
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                설계 변경 시 관련 부서에 자동으로 알림. 누락 걱정 끝.
                Teams와 연동되어 바로 확인 가능합니다.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">영향 부서 자동 추천</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">읽음 확인 추적</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">미확인 부서 자동 리마인더</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Feature 3 */}
            <div>
              <div className="inline-flex items-center px-3 py-1 bg-warning-100 text-warning-700 rounded-full text-sm font-medium mb-4">
                핵심 기능 3
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                실시간 진행률 & 일정 관리
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                11단계 × 9부서 체크리스트를 한눈에. 지연 위험은 자동으로 감지하여
                조기 대응 가능합니다.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">Red/Yellow/Green 상태 표시</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">간트 차트 자동 생성</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-success-500 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-gray-700">마감일 자동 알림 (3일/1일/당일)</span>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-2xl border border-amber-100 aspect-video flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                </svg>
                <p className="text-sm font-medium">간트 차트 화면 이미지</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              수치로 증명하는 효과
            </h2>
            <p className="text-xl text-gray-600">
              실제 도입 후 측정 가능한 개선 효과
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
              <div className="text-5xl font-bold text-primary-600 mb-3">90%</div>
              <div className="text-xl font-semibold text-gray-900 mb-2">시간 단축</div>
              <div className="text-gray-600 text-sm leading-relaxed">
                30분 → 3분<br />
                진행 상황 파악 시간
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
              <div className="text-5xl font-bold text-success-500 mb-3">0건</div>
              <div className="text-xl font-semibold text-gray-900 mb-2">누락 제로</div>
              <div className="text-gray-600 text-sm leading-relaxed">
                주 1건 → 0건<br />
                설계 변경 누락 사고
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
              <div className="text-5xl font-bold text-warning-500 mb-3">40%</div>
              <div className="text-xl font-semibold text-gray-900 mb-2">미팅 감소</div>
              <div className="text-gray-600 text-sm leading-relaxed">
                3시간 → 1.5시간<br />
                불필요한 미팅 시간
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
              <div className="text-5xl font-bold text-danger-500 mb-3">30%</div>
              <div className="text-xl font-semibold text-gray-900 mb-2">지연 감소</div>
              <div className="text-gray-600 text-sm leading-relaxed">
                조기 감지로<br />
                프로젝트 지연율 감소
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              * 5개 프로젝트 동시 진행, 9개 부서 기준 예상 수치
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              이런 팀에 딱 맞습니다
            </h2>
            <p className="text-xl text-gray-600">
              프로세스가 복잡할수록 효과는 더 커집니다
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex items-start p-6 bg-gray-50 rounded-xl">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">여러 프로젝트 동시 진행</h3>
                <p className="text-gray-600 text-sm">제조업, 개발팀 등 다수의 프로젝트를 관리하는 조직</p>
              </div>
            </div>

            <div className="flex items-start p-6 bg-gray-50 rounded-xl">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">부서 간 협업이 복잡한 조직</h3>
                <p className="text-gray-600 text-sm">5개 이상 부서가 관여하는 프로세스</p>
              </div>
            </div>

            <div className="flex items-start p-6 bg-gray-50 rounded-xl">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">정보 파편화 문제</h3>
                <p className="text-gray-600 text-sm">이메일, Teams, 사내 시스템에 정보가 분산된 팀</p>
              </div>
            </div>

            <div className="flex items-start p-6 bg-gray-50 rounded-xl">
              <div className="flex-shrink-0 w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">프로세스 투명성 확보</h3>
                <p className="text-gray-600 text-sm">실시간 진행 상황 공유가 필요한 조직</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            프로젝트 관리, 더 스마트하게 시작하세요
          </h2>
          <p className="text-xl mb-10 text-blue-100">
            Firebase 기반 안전한 클라우드 서비스로 언제 어디서나 접속 가능
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-8 py-4 bg-white text-primary-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg shadow-xl">
              무료로 시작하기
            </button>
            <button className="px-8 py-4 bg-transparent text-white rounded-lg hover:bg-white/10 transition-colors font-semibold text-lg border-2 border-white">
              데모 요청하기
            </button>
          </div>
          <p className="mt-8 text-sm text-blue-200">
            설치 불필요 · 신용카드 불필요 · 5분이면 시작 가능
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">PC</span>
                </div>
                <span className="text-xl font-semibold text-white">ProcessCheck</span>
              </div>
              <p className="text-sm leading-relaxed">
                전자제품 개발 프로세스의 투명성 확보 및<br />
                부서 간 협업 효율화 시스템
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">제품</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">주요 기능</a></li>
                <li><a href="#benefits" className="hover:text-white transition-colors">효과</a></li>
                <li><a href="#use-cases" className="hover:text-white transition-colors">적용 사례</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">지원</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">문의하기</a></li>
                <li><a href="#" className="hover:text-white transition-colors">문서</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2026 ProcessCheck. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
