// src/app/api/generate-story/route.js
// AI 페이지 초안 자동 생성 API — Google Gemini 1.5 Flash 기반
// 6가지 서비스 타입 모두 지원: baby / kindergarten / fairytale / travel / selfpublish / pet

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 서비스별 picsum 시드 프리픽스
const SEED_PREFIX = {
  baby: 'baby-ai',
  kindergarten: 'kinder-ai',
  fairytale: 'fairy-ai',
  travel: 'travel-ai',
  selfpublish: 'book-ai',
  pet: 'pet-ai',
};

// ── 서비스별 프롬프트 빌더 ──────────────────────────────────────
function buildPrompt(serviceType, params) {
  const base = `응답은 반드시 아래 JSON 형식으로만 해주세요. 마크다운이나 설명 텍스트는 절대 포함하지 마세요.
pages 배열은 정확히 10개이며, 각 text는 따뜻한 한국어로 2~3문장(100자 내외)입니다.

{
  "title": "책 제목",
  "pages": [
    { "title": "페이지 제목", "text": "내용 (2~3문장)" },
    ...10개
  ]
}`;

  switch (serviceType) {
    case 'baby':
      return `당신은 따뜻한 육아 일기 작가입니다.
아이 이름: ${params.babyName || '아이'}
기록 기간: ${params.period || '6개월'}
${params.message ? `부모의 메시지: ${params.message}` : ''}

${params.period || '6개월'} 동안의 아이 성장 기록 일기를 10페이지 작성해주세요.
- 첫 웃음, 첫 뒤집기, 첫 이유식, 첫 외출 등 월령별 이정표를 시간 순서로 담아주세요.
- 부모의 따뜻한 시선으로 서술해주세요.

${base}`;

    case 'kindergarten':
      return `당신은 유치원 담임 선생님입니다.
원아 이름: ${params.childName || '원아'}
반 이름: ${params.className || '꽃반'}
학기: ${params.semester || '1학기'}

유치원 ${params.semester || '1학기'} 알림장 내용을 10페이지로 작성해주세요.
- 수업 활동, 친구와의 에피소드, 성장 모습, 특별한 행사(소풍, 발표회 등)를 담아주세요.
- 선생님이 학부모에게 보내는 따뜻하고 구체적인 어투로 작성하세요.
- 각 페이지에 날짜(요일 포함)가 들어가도록 title을 구성하세요.

${base}`;

    case 'fairytale':
      return `당신은 창의적인 한국어 어린이 동화 작가입니다.
주인공 이름: ${params.heroName || '주인공'}
주인공 나이: ${params.heroAge || '5살'}
동화 주제: ${params.theme || '숲속 모험'}
담을 교훈: ${params.moralLesson || '용기와 우정'}

10페이지 분량의 동화를 작성해주세요.
- 구성: 시작(1~2장) → 갈등/모험(3~7장) → 해결(8~9장) → 결말과 교훈(10장)
- 아이 눈높이에 맞는 상상력 넘치는 문체로 작성하세요.

${base}`;

    case 'travel':
      return `당신은 감성적인 여행 에세이 작가입니다.
여행지: ${params.destination || '제주도'}
여행 제목: ${params.tripName || '특별한 여행'}
동행인: ${params.companions || '가족'}

${params.destination || '여행지'} 여행 포토북 페이지를 10개 작성해주세요.
- 출발 설레임 → 이동/도착 → 명소 탐방 → 음식 경험 → 특별한 순간들 → 마지막 날 감상 순서로 구성하세요.
- 생생한 현장감과 감성적인 여행 감상이 담기도록 작성하세요.
- 각 페이지 title에 날짜나 장소명을 포함하세요.

${base}`;

    case 'selfpublish':
      return `당신은 전문 편집자입니다.
책 제목: ${params.bookTitle || '나의 책'}
장르: ${params.genre || '에세이'}
책 소개: ${params.bookDescription || '삶의 이야기를 담은 책'}

"${params.bookTitle || '나의 책'}" ${params.genre || '에세이'} 책의 챕터 초안을 10페이지 작성해주세요.
- 각 페이지는 독립적인 챕터(소제목 있음)로 구성하세요.
- 장르(${params.genre || '에세이'})에 맞는 문체와 톤으로 작성하세요.
- 서론 → 본론(주제별 에피소드/시/이미지 설명) → 결론 구조를 갖추세요.

${base}`;

    case 'pet':
      return `당신은 반려동물을 사랑하는 따뜻한 작가입니다.
반려동물 이름: ${params.petName || '우리 아이'}
종류: ${params.petType || '강아지'}
${params.ownerMessage ? `보호자의 메시지: ${params.ownerMessage}` : ''}

${params.petName || '우리 아이'} ${params.petType || '반려동물'}의 성장 앨범 페이지를 10개 작성해주세요.
- 처음 만난 날 → 적응기 → 재롱/에피소드 → 계절별 추억 → 특별한 날 → 현재의 모습 순서로 구성하세요.
- 보호자의 사랑스러운 시선으로, 반려동물에게 말하듯 따뜻하게 작성하세요.

${base}`;

    default:
      return null;
  }
}

// ── 메인 핸들러 ──────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { serviceType = 'fairytale', ...params } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'GEMINI_API_KEY가 서버에 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const prompt = buildPrompt(serviceType, params);
    if (!prompt) {
      return NextResponse.json(
        { success: false, message: `지원하지 않는 서비스 타입: ${serviceType}` },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      console.error('[generate-story] JSON 파싱 실패:', raw.slice(0, 300));
      return NextResponse.json(
        { success: false, message: 'AI 응답 파싱 실패. 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(storyData.pages) || storyData.pages.length === 0) {
      return NextResponse.json(
        { success: false, message: 'AI가 유효한 페이지를 생성하지 못했습니다.' },
        { status: 500 }
      );
    }

    const seed = SEED_PREFIX[serviceType] || 'ai';
    const today = new Date().toISOString().slice(0, 10);

    const pages = storyData.pages.map((p, i) => ({
      id: `ai-${serviceType}-${Date.now()}-${i}`,
      title: p.title || `${i + 1}페이지`,
      text: p.text || '',
      date: today,
      image: `https://picsum.photos/seed/${seed}-${i}/480/640`,
    }));

    return NextResponse.json({
      success: true,
      data: { title: storyData.title || '나의 책', pages },
    });
  } catch (err) {
    console.error('[generate-story] 오류:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
