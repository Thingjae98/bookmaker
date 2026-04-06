// src/app/api/generate-page-text/route.js
// 에디터 내 개별 페이지 AI 텍스트 생성 API — Google Gemini 기반
// 프로젝트 정보(Create 페이지 입력값)를 참고하여 페이지별 회고/캡션 텍스트 자동 생성

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
      authorName = '',
      bookDescription = '',
      techStack = '',
      role = '',
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

    const prompt = `당신은 개발자/크리에이터 포트폴리오 북의 편집자입니다.

프로젝트 정보:
- 책 제목: ${bookTitle}
- 저자: ${authorName}
- 역할: ${role}
- 기술 스택: ${techStack}
- 기간: ${period}
- 설명: ${bookDescription}

이 책의 ${totalPages}페이지 중 ${pageIndex + 1}번째 페이지입니다.
${pageTitle ? `이 페이지의 제목: "${pageTitle}"` : ''}

이 페이지에 어울리는 회고/캡션 텍스트를 한국어로 2~3문장 작성해 주세요.
개발자답게 기술적이면서도 감성적인 톤으로, 프로젝트 경험을 회고하는 느낌으로 써주세요.

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
      ? `${pageTitle}에 대한 기록입니다. ${bookDescription || '이 프로젝트에서 많은 것을 배웠습니다.'}`
      : `${bookTitle || '프로젝트'} ${pageIndex + 1}번째 페이지. ${bookDescription || '개발 여정의 한 페이지를 기록합니다.'}`;

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
