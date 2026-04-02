import { NextResponse } from 'next/server';
import { estimateOrder } from '@/lib/sweetbook';

// POST /api/orders/estimate — 가격 견적 조회
export async function POST(request) {
  try {
    const body = await request.json();
    const { items } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'items는 필수입니다' }, { status: 400 });
    }

    const result = await estimateOrder({ items });
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/orders/estimate error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
