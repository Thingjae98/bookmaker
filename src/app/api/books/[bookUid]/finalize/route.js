import { NextResponse } from 'next/server';
import { finalizeBook } from '@/lib/sweetbook';

// POST /api/books/[bookUid]/finalize — 책 최종화
export async function POST(request, { params }) {
  try {
    const { bookUid } = await params;
    const result = await finalizeBook(bookUid);
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST finalize 상세 에러:', err.response?.data || err.message || err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
