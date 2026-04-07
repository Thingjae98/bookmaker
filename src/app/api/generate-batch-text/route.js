// src/app/api/generate-batch-text/route.js
// AI 텍스트 일괄 생성 API — Gemini Vision으로 이미지 분석 + 작품 해설 일괄 생성
// 이미지를 5장씩 배치로 나눠 Gemini Vision에 전송 → 페이지별 제목 + 해설 JSON 반환

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const VISION_MODEL = 'gemini-2.5-flash';
const BATCH_SIZE = 5; // 한 번에 처리할 이미지 수
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 단일 배치를 Gemini Vision으로 처리
async function processBatch(genAI, batchPages, artistName, bookContext) {
  const parts = [];

  parts.push({
    text: `당신은 어린이 미술 전시회의 큐레이터이자, 아이 그림 작품집의 편집자입니다.

${bookContext}

아래에 ${batchPages.length}장의 아이 그림이 순서대로 제공됩니다.
각 그림을 자세히 관찰하고 분석하여 미술관 도록 스타일의 작품 해설을 작성해 주세요.

규칙:
1. 각 그림의 색감, 구도, 표현 기법, 주제를 관찰하고 해석하세요.
2. 아이의 순수한 시선과 상상력을 따뜻하게 해석해 주세요.
3. 부모가 읽으면 감동하고, 아이가 자라서 읽으면 추억이 될 수 있는 톤으로 써주세요.
4. 각 작품마다 "title"(작품 제목, 5자 이내)과 "text"(해설, 2~3문장)를 생성하세요.
5. 기존 제목이 있으면 존중하되 더 적합한 제목이 있으면 제안하세요.
6. 해설은 각 작품마다 서로 다르게, 그림의 특징을 반영하여 작성하세요.

응답 형식 (JSON 배열만 반환, 마크다운 코드블록 없이):
[
  { "index": 0, "title": "작품 제목", "text": "작품 해설 텍스트..." }
]

반드시 ${batchPages.length}개의 항목을 반환하세요. index는 제공된 순서 그대로 유지하세요.
`,
  });

  for (const page of batchPages) {
    if (page.imageBase64) {
      parts.push({
        inlineData: {
          mimeType: page.mimeType || 'image/png',
          data: page.imageBase64,
        },
      });
      parts.push({
        text: `[index: ${page.index}, ${page.index + 1}번째 작품${page.title ? ` — 기존 제목: "${page.title}"` : ''}]`,
      });
    } else {
      parts.push({
        text: `[index: ${page.index}, ${page.index + 1}번째 페이지 — 이미지 없음${page.title ? `, 기존 제목: "${page.title}"` : ''}]`,
      });
    }
  }

  const model = genAI.getGenerativeModel({ model: VISION_MODEL });
  const result = await model.generateContent({ contents: [{ parts }] });
  const rawText = result.response.text().trim();

  // JSON 파싱 (마크다운 코드블록 제거)
  const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return JSON.parse(jsonStr);
}

export const maxDuration = 60; // Vercel 등 서버리스 타임아웃 확장

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      bookTitle = '',
      childName = '',
      bookDescription = '',
      childAge = '',
      period = '',
      pages = [], // [{ index, title, imageBase64, mimeType }]
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    if (pages.length === 0) {
      return NextResponse.json(
        { success: false, message: '페이지 데이터가 없습니다' },
        { status: 400 }
      );
    }

    const artistName = childName || '우리 아이';
    const bookContext = `작품집 정보:
- 작품집 제목: ${bookTitle}
- 작가(아이 이름): ${artistName}
- 나이: ${childAge}
- 작품 기간: ${period}
- 작품집 소개: ${bookDescription}
- 총 페이지 수: ${pages.length}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const allResults = [];
    const totalBatches = Math.ceil(pages.length / BATCH_SIZE);

    // 이미지를 BATCH_SIZE장씩 나눠서 처리
    for (let b = 0; b < totalBatches; b++) {
      const batchPages = pages.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      // 배치 간 rate limit 대응
      if (b > 0) await delay(1500);

      try {
        const batchResults = await processBatch(genAI, batchPages, artistName, bookContext);
        if (Array.isArray(batchResults)) {
          allResults.push(...batchResults);
        }
        console.log(`[generate-batch-text] 배치 ${b + 1}/${totalBatches} 완료 (${batchResults.length}건)`);
      } catch (err) {
        console.error(`[generate-batch-text] 배치 ${b + 1}/${totalBatches} 실패:`, err.message?.slice(0, 300));
        // 실패한 배치는 폴백 텍스트로 채움
        for (const p of batchPages) {
          allResults.push({
            index: p.index,
            title: p.title || `작품 ${p.index + 1}`,
            text: `${artistName}의 작품. ${bookDescription || '아이만의 시선으로 세상을 표현한 소중한 그림입니다.'}`,
          });
        }
      }
    }

    // index 순서 정렬
    allResults.sort((a, b) => a.index - b.index);

    const visionCount = allResults.filter((r) => r.text && !r.text.includes('아이만의 시선으로')).length;

    return NextResponse.json({
      success: true,
      results: allResults,
      model: visionCount > 0 ? VISION_MODEL : 'fallback',
      imageCount: pages.filter((p) => p.imageBase64).length,
      totalPages: pages.length,
      batchCount: totalBatches,
    });
  } catch (err) {
    console.error('[generate-batch-text] 예외:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
