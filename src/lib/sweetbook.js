// src/lib/sweetbook.js
// SweetBook API 클라이언트 — 공식 bookprintapi-nodejs-sdk 기반
// 서버 사이드 전용 (Next.js API Route에서만 import할 것)

import { SweetbookClient } from 'bookprintapi-nodejs-sdk';

const client = new SweetbookClient({
  apiKey: process.env.SWEETBOOK_API_KEY,
  baseUrl: process.env.SWEETBOOK_API_BASE_URL,
  timeout: 30000,
});

// API 응답을 프론트엔드가 기대하는 { success, data } 구조로 래핑
function ok(data) {
  return { success: true, data };
}

// ─── Books API ───────────────────────────────────────────────

export async function createBook({ title, bookSpecUid, creationType = 'TEST', externalRef }) {
  const data = await client.books.create({ title, bookSpecUid, creationType, externalRef });
  return ok(data);
}

export async function listBooks({ limit = 20, offset = 0 } = {}) {
  const data = await client.books.list({ limit, offset });
  return ok(data);
}

export async function addCover(bookUid, { templateUid, parameters }) {
  const data = await client.covers.create(bookUid, templateUid, parameters || {});
  return ok(data);
}

export async function uploadPhoto(bookUid, fileBuffer, fileName) {
  // Buffer → Blob → File (Node.js 18+ 내장)
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  const file = new File([blob], fileName, { type: 'image/jpeg' });
  const data = await client.photos.upload(bookUid, file);
  return ok(data);
}

export async function listPhotos(bookUid) {
  const data = await client.photos.list(bookUid);
  return ok(data);
}

export async function addContents(bookUid, { templateUid, parameters, breakBefore = 'page' }) {
  const data = await client.contents.insert(bookUid, templateUid, parameters || {}, { breakBefore });
  return ok(data);
}

export async function finalizeBook(bookUid) {
  const data = await client.books.finalize(bookUid);
  return ok(data);
}

export async function deleteContents(bookUid) {
  await client.contents.clear(bookUid);
  return ok({});
}

// ─── Orders API ──────────────────────────────────────────────

export async function createOrder({ items, shipping, externalRef }) {
  const data = await client.orders.create({ items, shipping, externalRef });
  return ok(data);
}

export async function estimateOrder({ items }) {
  const data = await client.orders.estimate({ items });
  return ok(data);
}

export async function listOrders({ limit = 20, offset = 0, status } = {}) {
  const data = await client.orders.list({ limit, offset, status });
  return ok(data);
}

export async function getOrder(orderUid) {
  const data = await client.orders.get(orderUid);
  return ok(data);
}

export async function cancelOrder(orderUid, cancelReason) {
  const data = await client.orders.cancel(orderUid, cancelReason);
  return ok(data);
}

// ─── Credits API ─────────────────────────────────────────────

export async function getCredits() {
  const data = await client.credits.getBalance();
  return ok(data);
}

// ─── Templates & BookSpecs API (SDK 미지원 — fetch 직접 호출) ─

const API_BASE = process.env.SWEETBOOK_API_BASE_URL || 'https://api-sandbox.sweetbook.com/v1';
const API_KEY = process.env.SWEETBOOK_API_KEY;

async function sweetFetch(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  ).toString();
  const url = `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`스위트북 API 상세 에러 [${res.status}] ${path}:`, json);
  }
  return json;
}

export async function listTemplates({ bookSpecUid, category, templateKind, limit = 50, offset = 0 } = {}) {
  return sweetFetch('/templates', { bookSpecUid, category, templateKind, limit, offset });
}

export async function getTemplate(templateUid) {
  return sweetFetch(`/templates/${templateUid}`);
}

export async function listTemplateCategories() {
  return sweetFetch('/template-categories');
}

export async function listBookSpecs() {
  return sweetFetch('/book-specs');
}

export async function getBookSpec(bookSpecUid) {
  return sweetFetch(`/book-specs/${bookSpecUid}`);
}
