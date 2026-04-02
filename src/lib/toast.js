// src/lib/toast.js
// 이벤트 기반 토스트 알림 — React 컨텍스트 없이 어느 컴포넌트에서나 호출 가능
// 사용법: import { toast } from '@/lib/toast';  toast.success('완료!');

const EVENT_NAME = 'bookmaker:toast';

function dispatch(type, message) {
  if (typeof window === 'undefined') return; // SSR 방어
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { type, message, id: Date.now() + Math.random() } })
  );
}

export const toast = {
  success: (msg) => dispatch('success', msg),
  error:   (msg) => dispatch('error',   msg),
  info:    (msg) => dispatch('info',    msg),
  warn:    (msg) => dispatch('warn',    msg),
};

export { EVENT_NAME };
