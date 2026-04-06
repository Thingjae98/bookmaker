'use client';

import { useRouter } from 'next/navigation';

// 에디터/세션 관련 sessionStorage 키 — 새 아카이브 시작 시 초기화 대상
const EDITOR_SESSION_KEYS = [
  'bookmaker_session',  // 에디터 워크플로우 세션
  'bookmaker_preview',  // 미리보기 스프레드 데이터
  // 주의: BOOK_DRAFT_{serviceType}는 Create 페이지 초안이므로 여기서 지우지 않음
];

// 새 아카이브 시작 시 이전 에디터 상태를 완전히 초기화하는 헬퍼
function clearEditorState() {
  try {
    EDITOR_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
    console.log('[Clean Slate] 에디터 상태 초기화 완료:', EDITOR_SESSION_KEYS);
  } catch (e) {
    // SSR 환경에서 sessionStorage 접근 실패 — 무시
  }
}

export default function HomePage() {
  const router = useRouter();

  const handleStartNew = (e) => {
    e.preventDefault();
    clearEditorState();
    router.push('/create/archive');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero — Full-screen Black & White */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="text-neutral-400 font-mono text-xs tracking-[0.3em] uppercase mb-8 opacity-0 animate-fade-up">
            Premium Project Portfolio Book
          </p>

          <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl text-neutral-900 tracking-tight leading-[0.95] mb-8 opacity-0 animate-fade-up delay-100">
            ARCHIVE
          </h1>

          <div className="w-16 h-px bg-neutral-900 mx-auto mb-8 opacity-0 animate-fade-up delay-200" />

          <p className="text-neutral-500 text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-12 opacity-0 animate-fade-up delay-200">
            당신의 프로젝트와 1년의 성과를<br />
            한 권의 프리미엄 아카이브로 남기세요.
          </p>

          <button
            onClick={handleStartNew}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-neutral-900 text-white text-sm font-medium tracking-wider uppercase transition-all hover:bg-neutral-800 opacity-0 animate-fade-up delay-300"
          >
            Start Archiving
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Process — Minimal Steps */}
      <section className="border-t border-neutral-200 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-neutral-400 font-mono text-xs tracking-[0.3em] uppercase text-center mb-16">
            How it works
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
            {[
              { num: '01', title: 'Configure', desc: '프로젝트 정보와 아카이브 기간을 설정합니다' },
              { num: '02', title: 'Compose', desc: '스크린샷, 다이어그램, 회고를 페이지별로 구성합니다' },
              { num: '03', title: 'Preview', desc: '스프레드 뷰로 전체 레이아웃을 확인합니다' },
              { num: '04', title: 'Order', desc: '하드커버 북으로 제작 · 배송합니다' },
            ].map((item) => (
              <div key={item.num} className="text-center md:text-left">
                <span className="font-mono text-3xl font-light text-neutral-200 block mb-3">{item.num}</span>
                <h3 className="font-display font-bold text-lg text-neutral-900 mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — Magazine Grid */}
      <section className="border-t border-neutral-200 bg-neutral-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-neutral-400 font-mono text-xs tracking-[0.3em] uppercase text-center mb-4">
            Features
          </p>
          <h2 className="font-display font-bold text-2xl md:text-3xl text-neutral-900 text-center mb-16">
            프로젝트의 가치를 물성으로
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Hardcover Binding', desc: '243x248mm 정방형 하드커버. PUR 무선철 제본으로 오래 보관할 수 있는 견고한 품질.' },
              { title: 'Spread Layout', desc: '실제 책을 펼쳐놓은 듯한 2페이지 스프레드 단위 편집. 프로젝트 스크린샷과 회고가 함께.' },
              { title: 'Smart Templates', desc: 'API 기반 동적 템플릿 매칭. 사진+텍스트, 텍스트 전용, 갤러리 레이아웃 자동 추천.' },
              { title: 'Drag & Drop', desc: '아키텍처 다이어그램, UI 스크린샷, 팀 사진을 드래그앤드롭으로 간편하게 업로드.' },
              { title: 'Real-time Preview', desc: '책 넘김 애니메이션과 블러 티저로 완성본을 주문 전 미리 확인.' },
              { title: 'API Powered', desc: 'SweetBook Book Print API 기반. 책 생성부터 주문·배송 추적까지 자동화.' },
            ].map((item) => (
              <div key={item.title} className="p-6 bg-white border border-neutral-200">
                <h3 className="font-mono text-sm font-medium text-neutral-900 mb-3 tracking-wide">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-200 py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display font-bold text-2xl md:text-3xl text-neutral-900 mb-6">
            나의 첫 아카이브를 만들어 보세요
          </h2>
          <p className="text-neutral-500 mb-10">
            더미 데이터로 즉시 체험하거나, 실제 프로젝트 정보를 입력해 시작할 수 있습니다.
          </p>
          <button
            onClick={handleStartNew}
            className="inline-flex items-center gap-3 px-8 py-4 bg-neutral-900 text-white text-sm font-medium tracking-wider uppercase transition-all hover:bg-neutral-800"
          >
            Create Archive
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <p>ARCHIVE — Powered by <a href="https://api.sweetbook.com" className="text-neutral-600 hover:underline" target="_blank" rel="noopener noreferrer">SweetBook Book Print API</a></p>
          <p>&copy; 2026 ARCHIVE. Built for SweetBook Vibe Coding Challenge.</p>
        </div>
      </footer>
    </div>
  );
}
