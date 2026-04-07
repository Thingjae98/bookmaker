'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 새 작품집 시작 시 에디터 잔여 상태를 초기화
function clearEditorState() {
  try {
    ['bookmaker_session', 'bookmaker_preview', 'KIDCANVAS_EDITOR_STATE', 'BOOK_DRAFT_kidcanvas']
      .forEach((k) => sessionStorage.removeItem(k));
    console.log('[Clean Slate] 에디터 상태 전체 초기화');
  } catch (e) { /* SSR 무시 */ }
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleNewBook = (e) => {
    e.preventDefault();
    clearEditorState();
    setMenuOpen(false);
    router.push('/create/kidcanvas');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-peach-50/80 backdrop-blur-md border-b border-peach-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-peach-500 flex items-center justify-center rounded-xl shadow-sm">
            <span className="text-white text-sm">🎨</span>
          </div>
          <span className="font-display text-2xl text-ink-900 tracking-tight group-hover:text-peach-600 transition-colors">
            KidCanvas
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button onClick={handleNewBook} className="text-sm text-ink-600 hover:text-peach-600 transition-colors font-medium">
            새 작품집
          </button>
          <Link href="/orders" className="text-sm text-ink-600 hover:text-peach-600 transition-colors font-medium">
            주문 내역
          </Link>
          <a
            href="https://api.sweetbook.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-peach-300 hover:text-peach-500 transition-colors"
          >
            API Docs
          </a>
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden p-2 text-ink-600"
          aria-label="Menu"
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

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-peach-100 px-6 py-4 space-y-3">
          <button onClick={handleNewBook} className="block text-sm text-ink-600 py-2 w-full text-left font-medium">
            새 작품집
          </button>
          <Link href="/orders" onClick={() => setMenuOpen(false)} className="block text-sm text-ink-600 py-2 font-medium">
            주문 내역
          </Link>
          <a href="https://api.sweetbook.com/docs" target="_blank" rel="noopener noreferrer" className="block text-sm text-peach-300 py-2">
            API Docs
          </a>
        </div>
      )}
    </header>
  );
}
