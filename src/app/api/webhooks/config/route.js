// src/app/api/webhooks/config/route.js
// PUT  /api/webhooks/config — SweetBook Webhook URL 등록/수정
// POST /api/webhooks/config — Webhook 테스트 이벤트 전송
//
// ngrok 터널 사용 시:
//   1. ngrok http 3000 → https://xxxx.ngrok-free.app 획득
//   2. PUT /api/webhooks/config { webhookUrl: "https://xxxx.ngrok-free.app/api/webhooks/sweetbook" }
//   3. POST /api/webhooks/config { action: "test", eventType: "order.created" }

import { NextResponse } from 'next/server';
import { configureWebhook, testWebhook } from '@/lib/sweetbook';

// PUT — Webhook URL 등록/수정
export async function PUT(request) {
  try {
    const body = await request.json();
    const { webhookUrl, events, description } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { success: false, message: 'webhookUrl은 필수입니다' },
        { status: 400 }
      );
    }

    // HTTPS 강제 검증
    if (!webhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, message: 'webhookUrl은 https://로 시작해야 합니다' },
        { status: 400 }
      );
    }

    const result = await configureWebhook({
      webhookUrl,
      events: events || null, // null = 전체 이벤트 구독
      description: description || 'ARCHIVE BookMaker Webhook',
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook URL이 등록되었습니다',
      data: result.data,
    });
  } catch (err) {
    console.error('[Webhook 설정 에러]:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}

// POST — 테스트 이벤트 전송
export async function POST(request) {
  try {
    const body = await request.json();
    const { eventType = 'order.created' } = body;

    const result = await testWebhook(eventType);

    return NextResponse.json({
      success: true,
      message: `테스트 이벤트(${eventType})가 전송되었습니다`,
      data: result.data,
    });
  } catch (err) {
    console.error('[Webhook 테스트 에러]:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: err.statusCode || 500 }
    );
  }
}
