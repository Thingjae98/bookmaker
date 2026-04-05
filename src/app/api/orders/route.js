import { NextResponse } from 'next/server';
import { createOrder, listOrders } from '@/lib/sweetbook';

// GET /api/orders — 주문 목록 조회
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    const result = await listOrders({ limit, offset, status: status ? parseInt(status) : undefined });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/orders 상세 에러:', err.response?.data || err.message || err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

// POST /api/orders — 주문 생성
export async function POST(request) {
  try {
    const body = await request.json();
    const { items, shipping, externalRef } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'items는 필수입니다' }, { status: 400 });
    }

    if (!shipping || !shipping.recipientName || !shipping.recipientPhone || !shipping.postalCode || !shipping.address1) {
      return NextResponse.json({ success: false, message: '배송지 정보가 불완전합니다' }, { status: 400 });
    }

    const result = await createOrder({ items, shipping, externalRef });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error('POST /api/orders 상세 에러:', err.response?.data || err.message || err);
    // 409 Conflict — SweetBook 중복 요청 (DUPLICATE_REQUEST) 그대로 전달
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, message: status === 409 ? '이미 처리 중인 주문 요청입니다. 잠시 후 다시 시도해주세요.' : err.message },
      { status }
    );
  }
}
