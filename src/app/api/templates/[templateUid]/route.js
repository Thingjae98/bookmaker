import { NextResponse } from 'next/server';
import { getTemplate } from '@/lib/sweetbook';

// GET /api/templates/[templateUid] — 개별 템플릿 상세 조회
export async function GET(request, { params }) {
  try {
    const { templateUid } = await params;
    const result = await getTemplate(templateUid);
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/templates/[templateUid] error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
