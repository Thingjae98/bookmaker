import { NextResponse } from 'next/server';
import { createBook, listBooks } from '@/lib/sweetbook';

// GET /api/books — 책 목록 조회
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await listBooks({ limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/books 상세 에러:', err.response?.data || err.message || err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

// POST /api/books — 책 생성
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: '요청 본문 파싱 실패 (JSON 형식 확인)' }, { status: 400 });
  }

  const { title, bookSpecUid, creationType, externalRef } = body;

  if (!title || !bookSpecUid) {
    console.error('POST /api/books 유효성 오류: title 또는 bookSpecUid 누락', { title, bookSpecUid });
    return NextResponse.json(
      { success: false, message: `title과 bookSpecUid는 필수입니다 (받은 값 — title: "${title}", bookSpecUid: "${bookSpecUid}")` },
      { status: 400 }
    );
  }

  try {
    const result = await createBook({ title, bookSpecUid, creationType, externalRef });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // SDK 에러는 err.body 또는 err.response?.data에 SweetBook 서버 메시지 포함
    const sweetbookDetail = err.body ?? err.response?.data ?? null;
    console.error('POST /api/books SweetBook API 에러:', {
      message: err.message,
      statusCode: err.statusCode,
      detail: sweetbookDetail,
      request: { title, bookSpecUid, creationType },
    });
    const clientMessage = sweetbookDetail
      ? `${err.message} — ${typeof sweetbookDetail === 'object' ? JSON.stringify(sweetbookDetail) : sweetbookDetail}`
      : err.message;
    return NextResponse.json(
      { success: false, message: clientMessage },
      { status: err.statusCode || 500 }
    );
  }
}
