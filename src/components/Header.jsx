'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-cream/80 backdrop-blur-md border-b border-ink-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl">📚</span>
          <span className="font-display font-bold text-xl text-ink-900 group-hover:text-warm-600 transition-colors">
            북메이커
          </span>
        </Link>

        {/* 데스크톱 네비게이션 */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/" className="text-sm text-ink-600 hover:text-ink-900 transition-colors">
            서비스 선택
          </Link>
          <Link href="/orders" className="text-sm text-ink-600 hover:text-ink-900 transition-colors">
            주문 내역
          </Link>
          <a
            href="https://api.sweetbook.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
          >
            API 문서 ↗
          </a>
        </nav>

        {/* 모바일 메뉴 토글 */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-ink-600"
          aria-label="메뉴"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {menuOpen && (
        <div className="md:hidden bg-cream border-t border-ink-100 px-6 py-4 space-y-3">
          <Link href="/" onClick={() => setMenuOpen(false)} className="block text-sm text-ink-600 py-2">
            서비스 선택
          </Link>
          <Link href="/orders" onClick={() => setMenuOpen(false)} className="block text-sm text-ink-600 py-2">
            주문 내역
          </Link>
          <a href="https://api.sweetbook.com/docs" target="_blank" rel="noopener noreferrer" className="block text-sm text-ink-400 py-2">
            API 문서 ↗
          </a>
        </div>
      )}
    </header>
  );
}
