// src/app/api/generate-page-text/route.js
// 에디터 내 개별 페이지 AI 텍스트 생성 API — Google Gemini 기반
// 아이 그림에 대한 작품 해설/캡션 텍스트 자동 생성

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      bookTitle = '',
      childName = '',
      authorName = '',
      bookDescription = '',
      childAge = '',
      period = '',
      pageTitle = '',
      pageIndex = 0,
      totalPages = 24,
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    const artistName = childName || authorName || '우리 아이';

    const prompt = `당신은 어린이 미술 전시회의 큐레이터이자, 아이 그림 작품집의 편집자입니다.

작품집 정보:
- 작품집 제목: ${bookTitle}
- 작가(아이 이름): ${artistName}
- 나이: ${childAge}
- 작품 기간: ${period}
- 작품집 소개: ${bookDescription}

이 작품집의 ${totalPages}페이지 중 ${pageIndex + 1}번째 페이지입니다.
${pageTitle ? `이 작품의 제목: "${pageTitle}"` : ''}

이 페이지에 어울리는 작품 해설 텍스트를 한국어로 2~3문장 작성해 주세요.
미술관 도록의 작품 해설처럼, 아이의 순수한 시선과 상상력을 따뜻하게 해석해 주세요.
부모가 읽으면 감동하고, 아이가 자라서 읽으면 추억이 될 수 있는 톤으로 써주세요.
아이의 표현력과 창의성을 존중하면서도, 전문 큐레이터의 시선으로 해석해 주세요.

응답은 순수 텍스트만 반환하세요 (JSON, 마크다운 없이). 따옴표도 넣지 마세요.`;

    const genAI = new GoogleGenerativeAI(apiKey);

    for (let i = 0; i < GEMINI_MODELS.length; i++) {
      if (i > 0) await delay(1000);
      try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODELS[i] });
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        if (text) {
          return NextResponse.json({
            success: true,
            text,
            model: GEMINI_MODELS[i],
          });
        }
      } catch (err) {
        console.warn(`[generate-page-text] ${GEMINI_MODELS[i]} 실패:`, err.message?.slice(0, 100));
      }
    }

    // 모든 모델 실패 → 간단한 폴백 텍스트
    const fallbackText = pageTitle
      ? `${artistName}의 작품 "${pageTitle}". ${bookDescription || '아이만의 시선으로 세상을 표현한 소중한 그림입니다.'}`
      : `${bookTitle || '우리 아이 작품집'} ${pageIndex + 1}번째 페이지. ${bookDescription || '크레파스와 물감으로 표현한 아이만의 세상을 담았습니다.'}`;

    return NextResponse.json({
      success: true,
      text: fallbackText,
      model: 'fallback',
    });
  } catch (err) {
    console.error('[generate-page-text] 예외:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
