// src/app/api/webhooks/sweetbook/route.js
// POST /api/webhooks/sweetbook — SweetBook Webhook 수신 엔드포인트
// GET  /api/webhooks/sweetbook — 수신된 이벤트 로그 조회 (주문 내역 페이지에서 폴링)
//
// SweetBook 공식 Webhook 이벤트:
//   order.created, order.cancelled, order.restored,
//   production.confirmed, production.started, production.completed,
//   shipping.departed, shipping.delivered, webhook.exhausted
//
// 서명 검증 헤더:
//   X-Webhook-Signature: sha256=HMAC-SHA256(secretKey, "{timestamp}.{body}")
//   X-Webhook-Timestamp: Unix timestamp (seconds)
//   X-Webhook-Event: 이벤트 타입
//   X-Webhook-Delivery: 고유 전송 ID (중복 방지)

import { NextResponse } from 'next/server';
import crypto from 'crypto';

// ── 인메모리 이벤트 저장소 (서버 프로세스 생존 기간 동안 유지) ──
// 프로덕션에서는 DB/Redis로 교체 필요
const webhookEvents = [];
const MAX_EVENTS = 200;

// ── HMAC-SHA256 서명 검증 ──
function verifySignature(rawBody, signature, timestamp) {
  const secret = process.env.SWEETBOOK_WEBHOOK_SECRET;
  if (!secret) return null; // 시크릿 미설정 → 검증 스킵 (개발 환경)

  if (!signature || !timestamp) return false;

  // 타임스탬프 유효성 (5분 이내)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;

  const payload = `${timestamp}.${rawBody}`;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // timing-safe comparison
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── POST: Webhook 수신 ──
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // 서명 검증 (SWEETBOOK_WEBHOOK_SECRET 설정 시 활성화)
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    const webhookEvent = request.headers.get('x-webhook-event');
    const deliveryId = request.headers.get('x-webhook-delivery');

    const sigResult = verifySignature(rawBody, signature, timestamp);
    if (sigResult === false) {
      console.warn('[Webhook] 서명 검증 실패 — 요청 거부');
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 401 }
      );
    }

    // ── SweetBook 공식 이벤트 페이로드 파싱 ──
    const {
      event: eventType,   // 공식 필드명: event
      orderUid,
      status,
      timestamp: eventTimestamp,
      isTest,
      // order.created
      bookUid, quantity, totalCredits, shippingAddress,
      // order.cancelled
      cancelledAt, cancelReason, refundedCredits,
      // production.*
      confirmedAt, estimatedShipDate, startedAt, completedAt,
      // shipping.*
      trackingNumber, trackingCarrier, shippedAt, deliveredAt,
    } = payload;

    const event = {
      id: deliveryId || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      receivedAt: new Date().toISOString(),
      eventType: webhookEvent || eventType || payload.eventType || 'unknown',
      orderUid,
      status,
      isTest: isTest || false,
      timestamp: eventTimestamp,
      // 이벤트별 추가 데이터
      ...(trackingNumber && { trackingNumber, trackingCarrier }),
      ...(estimatedShipDate && { estimatedShipDate }),
      ...(cancelReason && { cancelReason }),
      ...(completedAt && { completedAt }),
      ...(deliveredAt && { deliveredAt }),
      // 시뮬레이션 마커
      simulated: payload._simulated || false,
      // 레거시 호환 (simulate 엔드포인트)
      previousStatus: payload.previousStatus || null,
      externalRef: payload.externalRef || null,
    };

    // 중복 방지 (같은 deliveryId 재전송)
    if (deliveryId && webhookEvents.some((e) => e.id === deliveryId)) {
      return NextResponse.json({ success: true, message: 'Duplicate — already processed' }, { status: 200 });
    }

    // 이벤트 저장 (FIFO)
    webhookEvents.unshift(event);
    if (webhookEvents.length > MAX_EVENTS) {
      webhookEvents.length = MAX_EVENTS;
    }

    console.log('[Webhook 수신]', {
      eventType: event.eventType,
      orderUid,
      status,
      deliveryId: event.id,
      isTest: event.isTest,
      simulated: event.simulated,
    });

    return NextResponse.json({ success: true, message: 'Webhook received', eventId: event.id }, { status: 200 });
  } catch (err) {
    console.error('[Webhook 에러] 파싱 실패:', err.message);
    return NextResponse.json({ success: false, message: err.message }, { status: 200 });
  }
}

// ── GET: 이벤트 로그 조회 ──
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
