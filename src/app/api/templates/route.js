import { NextResponse } from 'next/server';
import { listTemplates, listTemplateCategories } from '@/lib/sweetbook';

// GET /api/templates — 템플릿 목록 조회
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookSpecUid = searchParams.get('bookSpecUid');
    const category = searchParams.get('category');
    const templateKind = searchParams.get('templateKind');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = await listTemplates({ bookSpecUid, category, templateKind, limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/templates error:', err.response?.data || err.message);
    return NextResponse.json(
      { success: false, message: err.response?.data?.message || err.message },
      { status: err.response?.status || 500 }
    );
  }
}
