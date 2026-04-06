// src/app/api/webhooks/sweetbook/route.js
// POST /api/webhooks/sweetbook — SweetBook 주문 상태 변경 Webhook 수신 엔드포인트
//
// 스위트북 서버가 주문 상태 전이(CONFIRMED → IN_PRODUCTION → SHIPPED 등) 시
// 이 라우트로 POST 요청을 보냄. 현재는 로그 기록만 수행하며,
// 추후 DB/캐시 연동으로 실시간 상태 동기화를 확장할 예정.

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const payload = await request.json();

    // ── 핵심 필드 파싱 ──
    const {
      orderUid,         // 스위트북 주문 UID
      externalRef,      // 우리 시스템 참조값 (bookmaker-order-{uuid})
      status,           // 변경된 주문 상태 코드 (20, 30, 40, …)
      previousStatus,   // 이전 상태 코드
      updatedAt,        // 상태 변경 시각 (ISO 8601)
      eventType,        // 이벤트 유형 (예: order.status.changed)
    } = payload;

    console.log('[Webhook 수신] SweetBook 주문 상태 변경:', {
      eventType,
      orderUid,
      externalRef,
      previousStatus,
      status,
      updatedAt,
      rawPayload: payload,
    });

    // ── TODO: 상태 동기화 로직 (DB/캐시 연동 시 구현) ──
    // 1. externalRef로 내부 주문 매칭
    // 2. 주문 상태를 DB/캐시에 반영
    // 3. 필요 시 사용자에게 알림 발송 (이메일, 푸시 등)
    // 4. 배송 추적번호(trackingNumber) 수신 시 저장

    // ── 서명 검증 (추후 활성화) ──
    // const signature = request.headers.get('X-Webhook-Signature');
    // if (!verifySignature(payload, signature, process.env.SWEETBOOK_WEBHOOK_SECRET)) {
    //   return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 });
    // }

    // 스위트북 서버에 200 OK 응답 — 미응답 시 재시도 발생
    return NextResponse.json({ success: true, message: 'Webhook received' }, { status: 200 });
  } catch (err) {
    console.error('[Webhook 에러] 파싱 실패:', err.message);
    // 파싱 실패해도 200 반환 — 스위트북의 무한 재시도 방지
    return NextResponse.json({ success: false, message: err.message }, { status: 200 });
  }
}
