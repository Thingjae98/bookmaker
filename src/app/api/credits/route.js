import { NextResponse } from 'next/server';
import { getCredits } from '@/lib/sweetbook';

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
