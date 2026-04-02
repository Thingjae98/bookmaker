'use client';

// src/components/Toast.jsx
// 전역 토스트 알림 컨테이너 — layout.jsx에 한 번만 마운트
// toast.js에서 발생한 이벤트를 수신해 화면 우하단에 렌더링

import { useState, useEffect } from 'react';
import { EVENT_NAME } from '@/lib/toast';

const STYLE = {
  success: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', icon: '✅' },
  error:   { bg: 'bg-red-50 border-red-300',         text: 'text-red-800',     icon: '❌' },
  warn:    { bg: 'bg-amber-50 border-amber-300',     text: 'text-amber-800',   icon: '⚠️' },
  info:    { bg: 'bg-blue-50 border-blue-300',       text: 'text-blue-800',    icon: 'ℹ️' },
};

const AUTO_DISMISS_MS = 3500;

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const item = { ...e.detail, visible: true };
      setToasts((prev) => [...prev.slice(-4), item]); // 최대 5개

      // 자동 제거
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, AUTO_DISMISS_MS);
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-4 z-[200] flex flex-col-reverse gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((t) => {
        const s = STYLE[t.type] || STYLE.info;
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm pointer-events-auto animate-fade-up ${s.bg}`}
          >
            <span className="text-base flex-shrink-0 mt-0.5 leading-none">{s.icon}</span>
            <p className={`text-sm font-medium leading-snug flex-1 ${s.text}`}>{t.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={`flex-shrink-0 text-lg leading-none opacity-40 hover:opacity-80 transition-opacity ${s.text}`}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
