import { NextResponse } from 'next/server';
import { getBook } from '@/lib/sweetbook';

// GET /api/books/[bookUid] — 책 상세 조회
export async function GET(request, { params }) {
  try {
    const { bookUid } = await params;
    const result = await getBook(bookUid);
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/books/[bookUid] 상세 에러:', {
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
    return NextResponse.json(
      { success: false, message: err.message, details: err.details },
      { status: err.statusCode || 500 }
    );
  }
}
