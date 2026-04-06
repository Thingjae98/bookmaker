// src/app/api/webhooks/sweetbook/route.js
// POST /api/webhooks/sweetbook — SweetBook 주문 상태 변경 Webhook 수신 엔드포인트
// GET  /api/webhooks/sweetbook — 수신된 이벤트 로그 조회 (주문 내역 페이지에서 폴링)
//
// 스위트북 서버가 주문 상태 전이(CONFIRMED → IN_PRODUCTION → SHIPPED 등) 시
// 이 라우트로 POST 요청을 보냄. 인메모리 이벤트 로그에 저장하여
// 주문 내역 페이지에서 실시간 상태 변경 이력을 확인할 수 있음.
//
// 로컬 환경(localhost)에서는 외부 Webhook을 직접 수신할 수 없으므로
// 시연용 시뮬레이션 엔드포인트도 함께 제공.

import { NextResponse } from 'next/server';

// ── 인메모리 이벤트 저장소 (서버 프로세스 생존 기간 동안 유지) ──
// 프로덕션에서는 DB/Redis로 교체 필요
const webhookEvents = [];
const MAX_EVENTS = 200; // 최대 보관 이벤트 수

// ── POST: Webhook 수신 ──
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
      trackingNumber,   // 배송 추적번호 (발송 시)
      trackingUrl,      // 배송 추적 URL
    } = payload;

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: new Date().toISOString(),
      eventType: eventType || 'order.status.changed',
      orderUid,
      externalRef,
      previousStatus,
      status,
      updatedAt,
      trackingNumber: trackingNumber || null,
      trackingUrl: trackingUrl || null,
      simulated: payload._simulated || false,
    };

    // 이벤트 저장 (FIFO — 최대 MAX_EVENTS)
    webhookEvents.unshift(event);
    if (webhookEvents.length > MAX_EVENTS) {
      webhookEvents.length = MAX_EVENTS;
    }

    console.log('[Webhook 수신]', {
      eventType: event.eventType,
      orderUid,
      previousStatus,
      status,
      trackingNumber: event.trackingNumber,
      receivedAt: event.receivedAt,
    });

    // 스위트북 서버에 200 OK 응답 — 미응답 시 재시도 발생
    return NextResponse.json({ success: true, message: 'Webhook received', eventId: event.id }, { status: 200 });
  } catch (err) {
    console.error('[Webhook 에러] 파싱 실패:', err.message);
    // 파싱 실패해도 200 반환 — 스위트북의 무한 재시도 방지
    return NextResponse.json({ success: false, message: err.message }, { status: 200 });
  }
}

// ── GET: 이벤트 로그 조회 ──
// ?orderUid=xxx — 특정 주문 이벤트만 필터링
// ?limit=N     — 최근 N개만 반환 (기본 50)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderUid = searchParams.get('orderUid');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), MAX_EVENTS);

    let filtered = webhookEvents;
    if (orderUid) {
      filtered = webhookEvents.filter((e) => e.orderUid === orderUid);
    }

    return NextResponse.json({
      success: true,
      totalEvents: webhookEvents.length,
      events: filtered.slice(0, limit),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
