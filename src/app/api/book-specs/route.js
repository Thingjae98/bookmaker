import { NextResponse } from 'next/server';
import { listBookSpecs, getBookSpec } from '@/lib/sweetbook';

// GET /api/book-specs — 판형 목록 조회
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (uid) {
      const result = await getBookSpec(uid);
      return NextResponse.json(result);
    }

    const result = await listBookSpecs();
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/book-specs error:', err.response?.data || err.message);
    return NextResponse.json(
      { success: false, message: err.response?.data?.message || err.message },
      { status: err.response?.status || 500 }
    );
  }
}
