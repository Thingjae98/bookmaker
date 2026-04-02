import { NextResponse } from 'next/server';
import { getOrder, cancelOrder } from '@/lib/sweetbook';

// GET /api/orders/[orderUid] — 주문 상세 조회
export async function GET(request, { params }) {
  try {
    const { orderUid } = await params;
    const result = await getOrder(orderUid);
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET order detail error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

// DELETE /api/orders/[orderUid] — 주문 취소
export async function DELETE(request, { params }) {
  try {
    const { orderUid } = await params;
    const body = await request.json();
    const { cancelReason } = body;

    const result = await cancelOrder(orderUid, cancelReason || '고객 요청 취소');
    return NextResponse.json(result);
  } catch (err) {
    console.error('DELETE order error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
