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
    console.error('GET /api/books error:', err.response?.data || err.message);
    return NextResponse.json(
      { success: false, message: err.response?.data?.message || err.message },
      { status: err.response?.status || 500 }
    );
  }
}

// POST /api/books — 책 생성
export async function POST(request) {
  try {
    const body = await request.json();
    const { title, bookSpecUid, creationType, externalRef } = body;

    if (!title || !bookSpecUid) {
      return NextResponse.json(
        { success: false, message: 'title과 bookSpecUid는 필수입니다' },
        { status: 400 }
      );
    }

    const result = await createBook({ title, bookSpecUid, creationType, externalRef });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/books error:', err.response?.data || err.message);
    return NextResponse.json(
      { success: false, message: err.response?.data?.message || err.message },
      { status: err.response?.status || 500 }
    );
  }
}
