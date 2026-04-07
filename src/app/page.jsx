'use client';

import { useRouter } from 'next/navigation';

// 에디터/세션 관련 sessionStorage 키 — 새 작품집 시작 시 초기화 대상
const EDITOR_SESSION_KEYS = [
  'bookmaker_session',       // 에디터 워크플로우 세션
  'bookmaker_preview',       // 미리보기 스프레드 데이터
  'KIDCANVAS_EDITOR_STATE',  // 에디터 갤러리 자동 저장
  'BOOK_DRAFT_kidcanvas',    // Create 페이지 폼 초안
];

// 새 작품집 시작 시 이전 에디터 상태를 완전히 초기화하는 헬퍼
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
    router.push('/create/kidcanvas');
  };

  return (
    <div className="min-h-screen bg-peach-50 page-transition">
      {/* Hero — Warm & Playful */}
      <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
        {/* Background dots pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle, #FF8C5E 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Floating decorative elements */}
        <div className="absolute top-20 left-[10%] text-6xl opacity-20 animate-float">🖍️</div>
        <div className="absolute top-40 right-[15%] text-5xl opacity-15 animate-float delay-200">🎨</div>
        <div className="absolute bottom-32 left-[20%] text-4xl opacity-15 animate-float delay-400">⭐</div>
        <div className="absolute bottom-20 right-[10%] text-5xl opacity-20 animate-float delay-300">🌈</div>

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="text-peach-400 font-body text-sm tracking-[0.2em] uppercase mb-6 opacity-0 animate-fade-up">
            우리 아이 그림 작품집
          </p>

          <h1 className="font-display font-bold text-6xl md:text-8xl lg:text-9xl text-ink-900 tracking-tight leading-[0.95] mb-6 opacity-0 animate-fade-up delay-100">
            KidCanvas
          </h1>

          <div className="flex items-center justify-center gap-3 mb-8 opacity-0 animate-fade-up delay-200">
            <div className="w-8 h-1 bg-peach-300 rounded-full" />
            <div className="w-3 h-3 bg-butter-400 rounded-full" />
            <div className="w-8 h-1 bg-mint-300 rounded-full" />
          </div>

          <p className="text-ink-600 text-lg md:text-xl leading-relaxed max-w-xl mx-auto mb-12 opacity-0 animate-fade-up delay-200">
            아이가 그린 세상을<br />
            한 권의 프리미엄 작품집으로 남겨주세요.
          </p>

          <button
            onClick={handleStartNew}
            className="group inline-flex items-center gap-3 px-8 py-4 bg-peach-500 text-white text-sm font-semibold tracking-wider rounded-full transition-all hover:bg-peach-600 hover:shadow-lg hover:shadow-peach-200 opacity-0 animate-fade-up delay-300"
          >
            작품집 만들기
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Process — Friendly Steps */}
      <section className="border-t border-peach-100 py-24 bg-white/50">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-peach-400 font-body text-sm tracking-[0.2em] uppercase text-center mb-4">
            How it works
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-ink-900 text-center mb-16">
            이렇게 만들어요
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
            {[
              { num: '01', emoji: '📸', title: '사진 찍기', desc: '아이가 그린 그림을 사진으로 찍어 업로드해 주세요' },
              { num: '02', emoji: '🎨', title: '꾸미기', desc: 'AI가 작품 해설을 자동 생성하고, 직접 수정할 수 있어요' },
              { num: '03', emoji: '📖', title: '미리보기', desc: '미술관 도록 스타일의 완성된 작품집을 미리 확인해요' },
              { num: '04', emoji: '🎁', title: '선물하기', desc: '하드커버 작품집으로 제작해 배송받으세요' },
            ].map((item) => (
              <div key={item.num} className="text-center group">
                <div className="w-16 h-16 mx-auto mb-4 bg-peach-50 border-2 border-peach-200 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 group-hover:border-peach-400 transition-all">
                  {item.emoji}
                </div>
                <span className="font-mono text-xs text-peach-300 block mb-2">{item.num}</span>
                <h3 className="font-display text-xl text-ink-900 mb-2">{item.title}</h3>
                <p className="text-sm text-ink-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — Warm Card Grid */}
      <section className="border-t border-peach-100 bg-peach-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-peach-400 font-body text-sm tracking-[0.2em] uppercase text-center mb-4">
            Features
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-ink-900 text-center mb-16">
            아이의 그림이 작품이 되는 순간
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { emoji: '📚', title: '하드커버 제본', desc: '243x248mm 정방형 하드커버. 아이의 그림을 오래 간직할 수 있는 프리미엄 품질.' },
              { emoji: '🤖', title: 'AI 작품 해설', desc: '아이 그림에 어울리는 해설과 제목을 AI가 자동으로 생성해 드려요.' },
              { emoji: '🖼️', title: '미술관 도록 스타일', desc: '전문 미술관 도록처럼 세련된 레이아웃으로 아이 그림의 가치를 높여요.' },
              { emoji: '✋', title: '드래그 & 드롭', desc: '스마트폰으로 찍은 그림 사진을 끌어다 놓기만 하면 자동 배치.' },
              { emoji: '👀', title: '실시간 미리보기', desc: '책 넘김 애니메이션으로 완성본을 주문 전에 미리 확인해요.' },
              { emoji: '🎁', title: '특별한 선물', desc: '생일, 졸업, 크리스마스 — 세상에 하나뿐인 우리 아이 작품집 선물.' },
            ].map((item) => (
              <div key={item.title} className="p-6 bg-white border-2 border-peach-100 rounded-2xl card-hover">
                <span className="text-2xl block mb-3">{item.emoji}</span>
                <h3 className="font-display text-lg text-ink-900 mb-2">{item.title}</h3>
                <p className="text-sm text-ink-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-peach-100 py-24 bg-white/50">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-ink-900 mb-6">
            우리 아이의 첫 작품집을 만들어 보세요
          </h2>
          <p className="text-ink-600 mb-10">
            더미 데이터로 즉시 체험하거나, 아이의 그림을 직접 업로드해 시작할 수 있어요.
          </p>
          <button
            onClick={handleStartNew}
            className="inline-flex items-center gap-3 px-8 py-4 bg-peach-500 text-white text-sm font-semibold tracking-wider rounded-full transition-all hover:bg-peach-600 hover:shadow-lg hover:shadow-peach-200"
          >
            작품집 만들기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-peach-100 py-8 bg-peach-50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-ink-400">
          <p>KidCanvas — Powered by <a href="https://api.sweetbook.com" className="text-peach-500 hover:underline" target="_blank" rel="noopener noreferrer">SweetBook Book Print API</a></p>
          <p>&copy; 2026 KidCanvas. Built for SweetBook Vibe Coding Challenge.</p>
        </div>
      </footer>
    </div>
  );
}
