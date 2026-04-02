// src/app/api/generate-story/route.js
// AI 동화 자동 생성 API — Google Gemini 1.5 Flash 기반
// 주인공 이름/나이/주제/교훈을 받아 10페이지 분량의 한국어 동화를 JSON으로 반환

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// picsum 시드 기반 일러스트 플레이스홀더
const illustrationUrl = (seed) =>
  `https://picsum.photos/seed/fairy-ai-${seed}/480/640`;

export async function POST(request) {
  try {
    const { heroName, heroAge, theme, moralLesson } = await request.json();

    if (!heroName || !theme) {
      return NextResponse.json(
        { success: false, message: '주인공 이름과 주제는 필수입니다.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'GEMINI_API_KEY가 서버에 설정되지 않았습니다. .env 파일을 확인하세요.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `당신은 따뜻하고 창의적인 한국어 어린이 동화 작가입니다.
아래 정보를 바탕으로 딱 10페이지 분량의 동화를 작성해 주세요.

- 주인공 이름: ${heroName}
- 주인공 나이: ${heroAge || '5살'}
- 동화 주제: ${theme}
- 담을 교훈: ${moralLesson || '용기와 우정'}

응답은 반드시 아래 JSON 형식으로만 해주세요. 마크다운이나 설명 텍스트는 절대 포함하지 마세요.

{
  "title": "동화 제목 (${heroName}이(가) 주인공임을 알 수 있게)",
  "pages": [
    { "title": "1장 제목", "text": "2~3문장 내용. 아이 눈높이에 맞는 따뜻한 문체로." },
    { "title": "2장 제목", "text": "..." },
    { "title": "3장 제목", "text": "..." },
    { "title": "4장 제목", "text": "..." },
    { "title": "5장 제목", "text": "..." },
    { "title": "6장 제목", "text": "..." },
    { "title": "7장 제목", "text": "..." },
    { "title": "8장 제목", "text": "..." },
    { "title": "9장 제목", "text": "..." },
    { "title": "10장 제목", "text": "마지막 장. 교훈과 행복한 결말로 마무리." }
  ]
}

요구사항:
- pages 배열은 정확히 10개여야 합니다.
- 각 페이지 text는 2~3문장, 100자 내외.
- 시작(1~2장) → 갈등/모험(3~7장) → 해결(8~9장) → 결말과 교훈(10장) 구조.
- 순수한 JSON만 반환하세요.`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // 마크다운 코드 블록 제거 후 JSON 파싱
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let storyData;
    try {
      storyData = JSON.parse(jsonStr);
    } catch {
      console.error('Gemini 응답 파싱 실패:', raw);
      return NextResponse.json(
        { success: false, message: 'AI 응답을 파싱하는 데 실패했습니다. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(storyData.pages) || storyData.pages.length === 0) {
      return NextResponse.json(
        { success: false, message: 'AI가 유효한 페이지를 생성하지 못했습니다.' },
        { status: 500 }
      );
    }

    // 에디터 page 객체 구조로 변환
    const today = new Date().toISOString().slice(0, 10);
    const pages = storyData.pages.map((p, i) => ({
      id: `ai-page-${Date.now()}-${i}`,
      title: p.title || `${i + 1}장`,
      text: p.text || '',
      date: today,
      image: illustrationUrl(i),
    }));

    return NextResponse.json({
      success: true,
      data: { title: storyData.title, pages },
    });
  } catch (err) {
    console.error('generate-story error:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
