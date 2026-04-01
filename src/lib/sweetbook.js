import axios from 'axios';
import FormData from 'form-data';

const API_BASE = process.env.SWEETBOOK_API_BASE_URL || 'https://api-sandbox.sweetbook.com/v1';
const API_KEY = process.env.SWEETBOOK_API_KEY;

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
  },
  timeout: 30000,
});

// ─── Books API ───────────────────────────────────────────────

export async function createBook({ title, bookSpecUid, creationType = 'TEST', externalRef }) {
  const { data } = await client.post('/books', { title, bookSpecUid, creationType, externalRef });
  return data;
}

export async function listBooks({ limit = 20, offset = 0 } = {}) {
  const { data } = await client.get('/books', { params: { limit, offset } });
  return data;
}

export async function addCover(bookUid, { templateUid, parameters, images = {} }) {
  const form = new FormData();
  form.append('templateUid', templateUid);
  if (parameters) form.append('parameters', JSON.stringify(parameters));
  for (const [key, value] of Object.entries(images)) {
    if (Buffer.isBuffer(value)) {
      form.append(key, value, { filename: `${key}.jpg`, contentType: 'image/jpeg' });
    } else if (typeof value === 'string') {
      // URL — include in parameters instead
    }
  }
  const { data } = await client.post(`/books/${bookUid}/cover`, form, {
    headers: { ...form.getHeaders() },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

export async function uploadPhoto(bookUid, fileBuffer, fileName) {
  const form = new FormData();
  form.append('file', fileBuffer, { filename: fileName, contentType: 'image/jpeg' });
  const { data } = await client.post(`/books/${bookUid}/photos`, form, {
    headers: { ...form.getHeaders() },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

export async function listPhotos(bookUid) {
  const { data } = await client.get(`/books/${bookUid}/photos`);
  return data;
}

export async function addContents(bookUid, { templateUid, parameters, breakBefore = 'page', images = {} }) {
  const form = new FormData();
  form.append('templateUid', templateUid);
  if (parameters) form.append('parameters', JSON.stringify(parameters));
  for (const [key, value] of Object.entries(images)) {
    if (Buffer.isBuffer(value)) {
      form.append(key, value, { filename: `${key}.jpg`, contentType: 'image/jpeg' });
    }
  }
  const { data } = await client.post(`/books/${bookUid}/contents`, form, {
    params: { breakBefore },
    headers: { ...form.getHeaders() },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data;
}

export async function finalizeBook(bookUid) {
  const { data } = await client.post(`/books/${bookUid}/finalization`);
  return data;
}

export async function deleteContents(bookUid) {
  const { data } = await client.delete(`/books/${bookUid}/contents`);
  return data;
}

// ─── Orders API ──────────────────────────────────────────────

export async function createOrder({ items, shipping, externalRef }) {
  const { data } = await client.post('/orders', { items, shipping, externalRef });
  return data;
}

export async function estimateOrder({ items }) {
  const { data } = await client.post('/orders/estimate', { items });
  return data;
}

export async function listOrders({ limit = 20, offset = 0, status } = {}) {
  const params = { limit, offset };
  if (status) params.status = status;
  const { data } = await client.get('/orders', { params });
  return data;
}

export async function getOrder(orderUid) {
  const { data } = await client.get(`/orders/${orderUid}`);
  return data;
}

export async function cancelOrder(orderUid, cancelReason) {
  const { data } = await client.post(`/orders/${orderUid}/cancel`, { cancelReason });
  return data;
}

// ─── Templates API ───────────────────────────────────────────

export async function listTemplates({ bookSpecUid, category, templateKind, limit = 50, offset = 0 } = {}) {
  const params = { limit, offset };
  if (bookSpecUid) params.bookSpecUid = bookSpecUid;
  if (category) params.category = category;
  if (templateKind) params.templateKind = templateKind;
  const { data } = await client.get('/templates', { params });
  return data;
}

export async function getTemplate(templateUid) {
  const { data } = await client.get(`/templates/${templateUid}`);
  return data;
}

export async function listTemplateCategories() {
  const { data } = await client.get('/template-categories');
  return data;
}

// ─── BookSpecs API ───────────────────────────────────────────

export async function listBookSpecs() {
  const { data } = await client.get('/book-specs');
  return data;
}

export async function getBookSpec(bookSpecUid) {
  const { data } = await client.get(`/book-specs/${bookSpecUid}`);
  return data;
}

// ─── Credits API ─────────────────────────────────────────────

export async function getCredits() {
  const { data } = await client.get('/credits');
  return data;
}
