// src/app/api/orders/[orderUid]/shipping/route.js
// PATCH /api/orders/[orderUid]/shipping — 배송지 변경 프록시
// 허용 상태: PAID(20), PDF_READY(25), CONFIRMED(30) 이하에서만 가능

import { NextResponse } from 'next/server';
import { updateShipping } from '@/lib/sweetbook';

export async function PATCH(request, { params }) {
  try {
    const { orderUid } = await params;
    const body = await request.json();

    const { recipientName, recipientPhone, postalCode, address1, address2, shippingMemo } = body;

    if (!recipientName || !recipientPhone || !postalCode || !address1) {
      return NextResponse.json(
        { success: false, message: '수령인, 연락처, 우편번호, 주소는 필수입니다.' },
        { status: 400 }
      );
    }

    const result = await updateShipping(orderUid, {
      recipientName,
      recipientPhone,
      postalCode,
      address1,
      address2: address2 || '',
      shippingMemo: shippingMemo || '',
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('PATCH shipping 에러:', err.response?.data || err.message || err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
