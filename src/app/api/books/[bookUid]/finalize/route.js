import { NextResponse } from 'next/server';
import { finalizeBook } from '@/lib/sweetbook';

// POST /api/books/[bookUid]/finalize — 책 최종화
export async function POST(request, { params }) {
  try {
    const { bookUid } = await params;
    const result = await finalizeBook(bookUid);
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST finalize error:', err.response?.data || err.message);
    return NextResponse.json(
      { success: false, message: err.response?.data?.message || err.message },
      { status: err.response?.status || 500 }
    );
  }
}
