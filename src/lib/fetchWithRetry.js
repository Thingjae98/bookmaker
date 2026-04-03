// src/lib/fetchWithRetry.js
// 5xx 서버 에러 및 네트워크 장애 시 자동 재시도하는 fetch 래퍼
// 사용법: import { fetchWithRetry } from '@/lib/fetchWithRetry';
//         const res = await fetchWithRetry('/api/books', { method: 'POST', ... });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} maxRetries  — 최대 재시도 횟수 (기본 3)
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);

      // 5xx 서버 에러 또는 429(Too Many Requests)일 때만 재시도
      // 400·401·403·404 등 4xx 클라이언트 에러는 재시도해도 동일하게 실패하므로 즉시 반환
      if ((res.status >= 500 || res.status === 429) && attempt < maxRetries - 1) {
        const wait = 250 * Math.pow(2, attempt); // 250ms → 500ms → 1000ms
        console.warn(`[fetchWithRetry] ${res.status} 오류 (${url}) — ${wait}ms 후 재시도 (${attempt + 1}/${maxRetries})`);
        await sleep(wait);
        continue;
      }

      // 2xx / 4xx(429 제외): 그대로 반환
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const wait = 250 * Math.pow(2, attempt);
        console.warn(`[fetchWithRetry] 네트워크 오류 (${url}) — ${wait}ms 후 재시도 (${attempt + 1}/${maxRetries}):`, err.message);
        await sleep(wait);
      }
    }
  }

  throw lastError || new Error(`최대 재시도 횟수(${maxRetries}) 초과: ${url}`);
}
