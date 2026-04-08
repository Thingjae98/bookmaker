import { NextResponse } from 'next/server';
import { getCredits } from '@/lib/sweetbook';

// 빌드 타임 정적 생성 방지 — 실시간 잔액을 보장하기 위해 항상 동적 렌더링
export const dynamic = 'force-dynamic';

// GET /api/credits — 충전금 잔액 조회
export async function GET() {
  try {
    const result = await getCredits();
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/credits error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
