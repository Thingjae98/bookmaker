import { NextResponse } from 'next/server';
import { addContents } from '@/lib/sweetbook';

// POST /api/books/[bookUid]/contents — 내지 추가
export async function POST(request, { params }) {
  try {
    const { bookUid } = await params;
    const body = await request.json();
    const { templateUid, parameters, breakBefore = 'page' } = body;

    if (!templateUid) {
      return NextResponse.json({ success: false, message: 'templateUid는 필수입니다' }, { status: 400 });
    }

    const result = await addContents(bookUid, { templateUid, parameters, breakBefore });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST contents error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
