import { NextResponse } from 'next/server';
import { addCover } from '@/lib/sweetbook';

// POST /api/books/[bookUid]/cover — 표지 추가
export async function POST(request, { params }) {
  try {
    const { bookUid } = await params;
    const body = await request.json();
    const { templateUid, parameters } = body;

    if (!templateUid) {
      return NextResponse.json({ success: false, message: 'templateUid는 필수입니다' }, { status: 400 });
    }

    const result = await addCover(bookUid, { templateUid, parameters });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST cover 상세 에러:', {
      message: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      details: err.details,
    });
    return NextResponse.json(
      { success: false, message: err.message, details: err.details },
      { status: err.statusCode || 500 }
    );
  }
}
