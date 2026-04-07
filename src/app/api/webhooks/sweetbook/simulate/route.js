// src/app/api/webhooks/sweetbook/simulate/route.js
// POST /api/webhooks/sweetbook/simulate — 로컬 시연용 Webhook 시뮬레이션
//
// 로컬 환경(localhost)에서는 SweetBook 서버가 Webhook을 보낼 수 없으므로
// 이 엔드포인트를 통해 주문 상태 변경 이벤트를 수동 시뮬레이션.
// 내부적으로 /api/webhooks/sweetbook POST를 호출하여 동일한 로직 경유.

import { NextResponse } from 'next/server';
import crypto from 'crypto';

// SweetBook 주문 상태 코드 & 전이 순서
const STATUS_FLOW = [
  { status: 20, label: 'PAID' },
  { status: 25, label: 'PDF_READY' },
  { status: 30, label: 'CONFIRMED' },
  { status: 40, label: 'IN_PRODUCTION' },
  { status: 45, label: 'COMPLETED' },
  { status: 50, label: 'PRODUCTION_COMPLETE' },
  { status: 60, label: 'SHIPPED' },
  { status: 70, label: 'DELIVERED' },
];

export async function POST(request) {
  try {
    const body = await request.json();
    const { orderUid, currentStatus, targetStatus } = body;

    if (!orderUid) {
      return NextResponse.json(
        { success: false, message: 'orderUid는 필수입니다' },
        { status: 400 }
      );
    }

    // targetStatus가 지정되면 해당 상태로, 아니면 다음 상태로 전이
    let nextStatus = targetStatus;
    if (!nextStatus && currentStatus !== undefined) {
      const currentIdx = STATUS_FLOW.findIndex((s) => s.status === currentStatus);
      if (currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1) {
        nextStatus = STATUS_FLOW[currentIdx + 1].status;
      }
    }
    if (!nextStatus) {
      nextStatus = 30; // 기본: CONFIRMED
    }

    // Webhook 이벤트 페이로드 구성
    const webhookPayload = {
      eventType: 'order.status.changed',
      orderUid,
      externalRef: body.externalRef || `bookmaker-order-simulated`,
      previousStatus: currentStatus || null,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      _simulated: true, // 시뮬레이션 마커
    };

    // 배송 단계면 추적번호 추가
    if (nextStatus === 60) {
      webhookPayload.trackingNumber = `SIM${Date.now().toString().slice(-8)}`;
      webhookPayload.trackingUrl = 'https://tracking.example.com/' + webhookPayload.trackingNumber;
    }

    // 내부 Webhook 엔드포인트 호출 (같은 서버)
    const origin = request.headers.get('origin') || request.headers.get('host');
    const protocol = origin?.startsWith('https') ? 'https' : 'http';
    const baseUrl = origin?.startsWith('http') ? origin : `${protocol}://${origin}`;

    const rawBody = JSON.stringify(webhookPayload);

    // HMAC-SHA256 서명 생성 (SWEETBOOK_WEBHOOK_SECRET 설정 시)
    const headers = { 'Content-Type': 'application/json' };
    const secret = process.env.SWEETBOOK_WEBHOOK_SECRET;
    if (secret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');
      headers['x-webhook-signature'] = signature;
      headers['x-webhook-timestamp'] = timestamp;
      headers['x-webhook-event'] = 'order.status.changed';
      headers['x-webhook-delivery'] = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    const webhookRes = await fetch(`${baseUrl}/api/webhooks/sweetbook`, {
      method: 'POST',
      headers,
      body: rawBody,
    });
    const webhookResult = await webhookRes.json();

    const statusLabel = STATUS_FLOW.find((s) => s.status === nextStatus)?.label || `STATUS_${nextStatus}`;

    return NextResponse.json({
      success: true,
      message: `시뮬레이션 완료: ${statusLabel} (${nextStatus})`,
      simulatedEvent: webhookPayload,
      webhookResponse: webhookResult,
    });
  } catch (err) {
    console.error('[Webhook 시뮬레이션 에러]:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
