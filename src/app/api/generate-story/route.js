// src/app/api/generate-story/route.js
// AI 페이지 초안 자동 생성 API — Google Gemini 기반
// 6가지 서비스 타입 모두 지원: baby / kindergarten / fairytale / travel / selfpublish / pet
// 모델 우선순위: models/gemini-1.5-flash-8b → models/gemini-1.5-flash → models/gemini-2.0-flash → models/gemini-pro → 로컬 템플릿 폴백

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 실제 동작 확인된 모델 순서 — 쿼터 소진 시 순차 폴백
// gemini-1.5-* 계열은 이 API 키에서 404, gemini-2.0-* 계열은 429 → 2.5 계열 사용
const GEMINI_MODELS = [
  'gemini-flash-lite-latest',   // 경량·빠름, 쿼터 여유
  'gemini-2.5-flash',           // 고성능, 쿼터 소진 시 대기
  'gemini-2.5-pro',             // 최후 수단
];

// 모델 시도 간 지연 (동일 API Key 쿼터 과부하 방지)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRY_DELAY_MS = 1000;

const SEED_PREFIX = {
  baby: 'baby-ai', kindergarten: 'kinder-ai', fairytale: 'fairy-ai',
  travel: 'travel-ai', selfpublish: 'book-ai', pet: 'pet-ai',
};

// ── 서비스별 프롬프트 빌더 ──────────────────────────────────────
function buildPrompt(serviceType, params) {
  const jsonSchema = `응답은 순수 JSON만 반환하세요 (마크다운 없이). pages 배열은 정확히 10개, 각 text는 한국어 2~3문장.
{"title":"책 제목","pages":[{"title":"페이지 제목","text":"내용"},…10개]}`;

  const prompts = {
    baby: `따뜻한 육아 일기 작가로서, ${params.babyName || '아이'}의 ${params.period || '6개월'} 성장 기록을 10페이지로 작성하세요. 첫 웃음·뒤집기·이유식 등 월령별 이정표를 시간순으로, 부모 시선으로 따뜻하게. ${jsonSchema}`,
    kindergarten: `유치원 담임으로서, ${params.childName || '원아'}(${params.className || '꽃반'}) ${params.semester || '1학기'} 알림장 10페이지를 작성하세요. 수업·친구 에피소드·행사·성장 모습 포함. 선생님 어투. ${jsonSchema}`,
    fairytale: `어린이 동화 작가로서, ${params.heroName || '주인공'}(${params.heroAge || '5살'})이 주인공인 "${params.theme || '숲속 모험'}" 동화를 10페이지로 작성하세요. 교훈: ${params.moralLesson || '용기와 우정'}. 시작→갈등→해결→결말 구조. ${jsonSchema}`,
    travel: `여행 에세이 작가로서, ${params.destination || '여행지'} 여행("${params.tripName || '특별한 여행'}") 포토북 10페이지를 작성하세요. 출발 설렘→명소→음식→감상 순. ${jsonSchema}`,
    selfpublish: `편집자로서, "${params.bookTitle || '나의 책'}"(${params.genre || '에세이'}) 챕터 초안 10페이지를 작성하세요. 장르에 맞는 문체, 서론→본론→결론 구조. ${jsonSchema}`,
    pet: `반려동물 앨범 작가로서, ${params.petName || '우리 아이'}(${params.petType || '강아지'})의 성장 앨범 10페이지를 작성하세요. 첫 만남→적응→에피소드→계절 추억→현재. 보호자 시선으로 따뜻하게. ${jsonSchema}`,
  };

  return prompts[serviceType] || null;
}

// ── 로컬 템플릿 폴백 (API 완전 실패 시) ──────────────────────
function generateFallback(serviceType, params) {
  const today = new Date().toISOString().slice(0, 10);
  const seed = SEED_PREFIX[serviceType] || 'ai';

  const templates = {
    baby: {
      title: `${params.babyName || '아이'}의 성장 일기`,
      pages: [
        { title: '처음 만난 날', text: `${params.babyName || '아이'}가 세상에 태어난 날, 온 가족이 기쁨으로 맞이했습니다. 작고 소중한 손과 발을 보며 감동의 눈물을 흘렸습니다.` },
        { title: '첫 번째 미소', text: `오늘 처음으로 방긋 웃어주었어요. 세상에서 가장 아름다운 미소였습니다. 그 순간을 평생 기억할 것 같아요.` },
        { title: '뒤집기 성공!', text: `드디어 혼자 뒤집기에 성공했어요! 온 힘을 다해 도전하는 모습이 너무 대견했습니다. 박수를 쳐주었더니 더 신이 나는 것 같았어요.` },
        { title: '이유식 첫날', text: `오늘부터 이유식을 시작했습니다. 쌀미음을 한 숟가락 먹었는데 오물오물 맛있게 먹었어요. 새로운 세상을 만난 것 같은 표정이 귀여웠습니다.` },
        { title: '옹알이 시작', text: `"아~", "우~" 소리를 내기 시작했어요. 무슨 말을 하고 싶은 걸까요? 우리끼리만 아는 언어로 이야기하는 것 같아 행복했습니다.` },
        { title: '첫 외출', text: `날씨 좋은 날 유모차를 타고 첫 외출을 했어요. 바깥 세상이 신기한 듯 두리번거리는 모습이 너무 사랑스러웠습니다.` },
        { title: '앉기 연습', text: `혼자 앉으려고 열심히 노력하는 중이에요. 쿵쿵 넘어져도 다시 도전하는 모습에 응원을 보냅니다. 이렇게 조금씩 자라는구나, 싶었습니다.` },
        { title: '첫 이가 났어요', text: `아래 앞니가 살짝 보이기 시작했어요. 그래서 요즘 조금 보채는 건지도 모르겠어요. 이제 진짜 아기티를 벗어가고 있네요.` },
        { title: '특별한 하루', text: `오늘도 하루 종일 함께하면서 수많은 추억을 쌓았습니다. 사진으로는 다 담을 수 없는 소중한 순간들이 마음속에 가득합니다.` },
        { title: `${params.period || '6개월'}의 기록을 마치며`, text: `이렇게 빨리 자라줘서 고맙고, 또 아쉽기도 합니다. 이 모든 순간이 우리 가족의 가장 소중한 보물입니다. 사랑해, ${params.babyName || '우리 아이'}야.` },
      ],
    },
    kindergarten: {
      title: `${params.childName || '원아'}의 유치원 알림장`,
      pages: [
        { title: '3월 1주 — 입학 첫날', text: `첫날이라 긴장했지만 금방 적응하는 모습을 보여주었어요. 친구들과 인사도 잘 하고, 선생님 말씀도 잘 들었습니다.` },
        { title: '3월 2주 — 블록 놀이', text: `블록 놀이 시간에 높은 탑을 쌓으며 친구들과 협동했어요. 양보하고 나눠 쓰는 모습이 정말 예뻤습니다.` },
        { title: '3월 3주 — 미술 수업', text: `봄꽃 그리기 수업에서 튤립을 아주 예쁘게 표현했어요. 색감이 풍부하고 창의적인 작품을 만들었습니다.` },
        { title: '4월 1주 — 봄 소풍', text: `오늘은 기다리던 봄 소풍 날이었어요! 도시락을 맛있게 먹고 친구들과 즐겁게 뛰어놀았습니다.` },
        { title: '4월 3주 — 역할 놀이', text: `역할 놀이 시간에 적극적으로 참여하여 친구들을 이끌어가는 모습을 보여주었어요. 리더십이 보입니다!` },
        { title: '5월 1주 — 어린이날 행사', text: `어린이날을 맞아 특별한 행사를 진행했어요. 작은 선물도 받고 신나게 놀았습니다. 내년에도 기대해요!` },
        { title: '5월 3주 — 체육 활동', text: `체육 시간에 달리기와 공 던지기를 했어요. 열심히 참여하며 친구들을 응원하는 모습도 보기 좋았습니다.` },
        { title: '6월 2주 — 과학 탐구', text: `씨앗 심기 실험을 통해 식물이 자라는 과정을 배웠어요. 호기심 있게 관찰하는 모습이 인상적이었습니다.` },
        { title: '6월 4주 — 꿈 발표', text: `발표 시간에 자신의 꿈을 당당하게 이야기해주었어요. 멋진 꿈을 갖고 있는 우리 친구, 앞으로가 기대됩니다.` },
        { title: `${params.semester || '1학기'} 수료를 마치며`, text: `한 학기 동안 정말 많이 성장했어요. 처음보다 훨씬 자신감 있고 씩씩해진 모습, 선생님도 너무 자랑스럽습니다!` },
      ],
    },
    fairytale: {
      title: `${params.heroName || '주인공'}의 ${params.theme || '신나는 모험'}`,
      pages: [
        { title: '이야기의 시작', text: `어느 맑은 날, ${params.heroName || '주인공'}는 집 뒤 커다란 숲으로 산책을 나갔어요. 새들이 노래하고 나비들이 춤을 추는 아름다운 곳이었습니다.` },
        { title: '신기한 친구를 만나다', text: `숲속 오솔길을 걷다 보니 작은 친구를 만났어요. "안녕! 같이 놀래?" 둘은 금방 친한 친구가 되었답니다.` },
        { title: '어려운 상황이 생겼어요', text: `즐겁게 놀다 보니 갑자기 문제가 생겼어요. ${params.heroName || '주인공'}는 잠깐 걱정이 되었지만, 포기하지 않기로 했습니다.` },
        { title: '용기를 내요', text: `"할 수 있어!" ${params.heroName || '주인공'}는 두 주먹을 꼭 쥐었어요. 무서웠지만 한 걸음씩 나아갔습니다.` },
        { title: '함께라면 괜찮아', text: `친구들이 옆에서 응원해주었어요. 함께라면 어떤 어려움도 이겨낼 수 있다는 걸 알게 되었습니다.` },
        { title: '지혜로운 해결책', text: `모두 머리를 맞대고 생각했어요. 결국 좋은 방법을 찾아냈고, 문제를 해결할 수 있게 되었습니다.` },
        { title: '드디어 성공!', text: `"우리가 해냈어!" 모두 손을 잡고 기뻐했어요. 노력하면 못 할 일이 없다는 걸 깨달았습니다.` },
        { title: '새로운 친구들', text: `이번 모험에서 많은 친구들을 사귀게 되었어요. 서로 돕고 나누는 것이 얼마나 소중한지 배웠습니다.` },
        { title: '집으로 돌아오는 길', text: `해가 뉘엿뉘엿 질 무렵, ${params.heroName || '주인공'}는 집으로 향했어요. 마음속에는 따뜻한 기억이 가득했습니다.` },
        { title: '달콤한 꿈 속에서', text: `${params.heroName || '주인공'}는 침대에 누워 오늘의 모험을 떠올렸어요. "${params.moralLesson || '용기와 우정'}이 가장 소중한 거야." 그렇게 달콤한 꿈 속으로 빠져들었답니다.` },
      ],
    },
    travel: {
      title: params.tripName || `${params.destination || '여행지'} 여행`,
      pages: [
        { title: '설레는 출발', text: `드디어 ${params.destination || '여행지'}로 떠나는 날이 왔어요! ${params.companions || '우리'}는 새벽부터 일어나 짐을 챙기며 설레는 마음을 감출 수 없었습니다.` },
        { title: '도착! 첫인상', text: `${params.destination || '여행지'}에 도착하자마자 탄성이 절로 나왔어요. 사진으로만 보던 풍경이 눈앞에 펼쳐지니 꿈만 같았습니다.` },
        { title: '첫 번째 명소', text: `여행의 첫 목적지에 도착했어요. 구석구석을 걸으며 이곳만의 특별한 분위기를 온몸으로 느꼈습니다.` },
        { title: '맛있는 현지 음식', text: `현지 식당에서 주문한 음식이 나왔어요. 한 입 먹자마자 "이게 바로 여행의 맛이야!" 라는 말이 나왔습니다.` },
        { title: '우연한 발견', text: `지도에 없던 골목을 걷다가 예쁜 가게를 발견했어요. 계획에 없던 순간이 여행을 더욱 특별하게 만들어주었습니다.` },
        { title: '노을 지는 시간', text: `해가 지는 시간, 멋진 뷰포인트에서 노을을 바라봤어요. 말이 필요 없는, 그냥 행복한 순간이었습니다.` },
        { title: '야경과 함께한 밤', text: `밤이 되자 도시가 반짝이기 시작했어요. 화려한 야경을 배경으로 오늘 하루를 돌아보며 행복함을 느꼈습니다.` },
        { title: '현지인처럼 하루', text: `오늘은 관광지보다 현지 시장을 거닐었어요. 살아있는 일상의 모습이 어떤 관광지보다 인상적이었습니다.` },
        { title: '마지막 날의 여운', text: `벌써 마지막 날이라니. 아쉬운 마음에 ${params.destination || '여행지'}의 공기를 깊이 들이마셨어요. 이 순간을 오래 기억하고 싶었습니다.` },
        { title: '여행을 마치며', text: `${params.destination || '여행지'}에서의 모든 순간이 소중한 추억이 되었어요. 다음에는 또 어디로 떠나볼까요? 이미 다음 여행을 기다리고 있습니다.` },
      ],
    },
    selfpublish: {
      title: params.bookTitle || '나의 이야기',
      pages: [
        { title: '프롤로그 — 이 책을 쓰게 된 이유', text: `이 책은 나의 이야기입니다. 오랫동안 마음속에 담아두었던 생각들을 이제야 꺼내어 글로 쓰게 되었습니다.` },
        { title: '1장 — 시작', text: `모든 것은 작은 시작에서 비롯됩니다. 처음에는 아무것도 몰랐지만, 한 걸음씩 나아가다 보니 이 자리까지 오게 되었습니다.` },
        { title: '2장 — 두 번째 이야기', text: `살아가면서 만나는 수많은 순간들이 있습니다. 그 순간들이 모여 지금의 내가 되었다는 것을 깨달았습니다.` },
        { title: '3장 — 전환점', text: `어느 날 갑자기 모든 것이 달라졌습니다. 그 전환점이 없었다면 지금의 이야기도 없었을 것입니다.` },
        { title: '4장 — 도전과 성장', text: `두렵고 힘든 순간도 있었습니다. 하지만 그 과정을 통해 더 강해지고 성장할 수 있었습니다.` },
        { title: '5장 — 사람들', text: `내 삶에 소중한 사람들이 있습니다. 그들이 없었다면 이 이야기는 완성될 수 없었을 것입니다.` },
        { title: '6장 — 나만의 방식', text: `남들과 다른 길을 걷는 것이 두려웠습니다. 하지만 나만의 방식이 결국 옳았다는 것을 알게 되었습니다.` },
        { title: '7장 — 멈추고 돌아보기', text: `가끔은 멈추고 지나온 길을 돌아보는 것이 필요합니다. 그 자리에서 많은 것을 배우게 됩니다.` },
        { title: '8장 — 앞으로', text: `아직 써내려가야 할 이야기가 많이 남아있습니다. 미래가 기대되고, 또 설렙니다.` },
        { title: '에필로그 — 독자에게', text: `이 책을 읽어주셔서 감사합니다. 제 이야기가 여러분의 마음 한 켠에 작은 위로가 되기를 바랍니다.` },
      ],
    },
    pet: {
      title: `${params.petName || '우리 아이'}의 성장 앨범`,
      pages: [
        { title: '처음 만난 날', text: `${params.petName || '우리 아이'}를 처음 만난 날을 잊을 수 없어요. 작고 떨리는 몸으로 저를 바라보던 눈빛이 아직도 생생합니다.` },
        { title: '적응기', text: `처음에는 새로운 환경이 낯선지 구석에 숨어있었어요. 조금씩 용기를 내어 집을 탐험하는 모습을 보며 마음이 녹았습니다.` },
        { title: '첫 번째 장난', text: `오늘은 집안 곳곳을 뛰어다니며 난리가 났어요. 혼을 내야 했지만, 너무 귀여워서 웃음이 먼저 나왔습니다.` },
        { title: '함께하는 일상', text: `아침에 일어나면 가장 먼저 달려와 반겨줘요. ${params.petName || '우리 아이'}가 있어서 매일매일이 특별합니다.` },
        { title: '첫 산책', text: `드디어 첫 산책을 나갔어요! 바깥 세상이 신기한 듯 코를 킁킁거리며 열심히 탐험했습니다.` },
        { title: '최애 장소 발견', text: `${params.petName || '우리 아이'}만의 특별한 자리를 발견했어요. 거기서 낮잠을 자는 모습이 세상에서 제일 평화로워 보입니다.` },
        { title: '특별한 하루', text: `오늘은 특별히 맛있는 간식을 챙겨줬어요. 기뻐하며 먹는 모습에 저도 덩달아 행복해졌습니다.` },
        { title: '계절이 바뀌어도', text: `봄, 여름, 가을, 겨울 모든 계절에 ${params.petName || '우리 아이'}와 함께했어요. 어떤 계절도 함께라면 아름답습니다.` },
        { title: '이제 제법 컸어요', text: `처음 만났을 때와 비교하면 이제 제법 많이 자랐어요. 시간이 이렇게 빨리 가다니, 새삼 감사한 마음입니다.` },
        { title: `${params.petName || '우리 아이'}에게`, text: `${params.ownerMessage || `사랑해, ${params.petName || '우리 아이'}야. 우리 곁에 와줘서 정말 고마워.`} 네가 행복한 만큼 나도 행복하단다.` },
      ],
    },
  };

  const template = templates[serviceType] || templates.fairytale;

  return {
    title: template.title,
    pages: template.pages.map((p, i) => ({
      id: `ai-${serviceType}-${Date.now()}-${i}`,
      title: p.title,
      text: p.text,
      date: today,
      image: `https://picsum.photos/seed/${seed}-${i}/480/640`,
    })),
  };
}

// ── Gemini API 호출 (모델 순차 시도, 시도 간 1초 지연) ──────
async function callGemini(apiKey, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const errors = [];

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const modelName = GEMINI_MODELS[i];

    // 첫 번째 시도 이외에는 이전 실패 후 1초 대기
    if (i > 0) {
      console.log(`[generate-story] ${RETRY_DELAY_MS}ms 대기 후 다음 모델 시도...`);
      await delay(RETRY_DELAY_MS);
    }

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();

      const jsonStr = raw
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
        console.log(`[generate-story] 모델 성공: ${modelName}`);
        return { ok: true, data: parsed, model: modelName };
      }
    } catch (err) {
      console.warn(`[generate-story] ${modelName} 실패:`, err.message.slice(0, 120));
      errors.push(`${modelName}: ${err.message.slice(0, 80)}`);
    }
  }

  // 모든 모델 실패 — 상세 에러 로그 출력 후 폴백
  console.error(
    '[generate-story] 모든 Gemini 모델 실패. 로컬 템플릿 폴백으로 전환합니다.\n' +
    '에러 목록:\n' +
    errors.map((e, i) => `  [${i + 1}] ${e}`).join('\n')
  );

  return { ok: false, errors };
}

// ── 메인 핸들러 ──────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json();
    const { serviceType = 'fairytale', ...params } = body;

    const prompt = buildPrompt(serviceType, params);
    if (!prompt) {
      return NextResponse.json(
        { success: false, message: `지원하지 않는 서비스 타입: ${serviceType}` },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const seed = SEED_PREFIX[serviceType] || 'ai';
    const apiKey = process.env.GEMINI_API_KEY;

    // Gemini API 시도
    if (apiKey) {
      const geminiResult = await callGemini(apiKey, prompt);

      if (geminiResult.ok) {
        const pages = geminiResult.data.pages.map((p, i) => ({
          id: `ai-${serviceType}-${Date.now()}-${i}`,
          title: p.title || `${i + 1}페이지`,
          text: p.text || '',
          date: today,
          image: `https://picsum.photos/seed/${seed}-${i}/480/640`,
        }));

        return NextResponse.json({
          success: true,
          source: 'gemini',
          model: geminiResult.model,
          data: { title: geminiResult.data.title || '나의 책', pages },
        });
      }

      // 모든 모델 실패 → 폴백 사용
      console.warn('[generate-story] 모든 Gemini 모델 실패, 로컬 템플릿 폴백 사용');
    }

    // 폴백: 로컬 템플릿 기반 구조화 초안
    const fallback = generateFallback(serviceType, params);
    return NextResponse.json({
      success: true,
      source: 'fallback',
      notice: 'AI API 할당량 초과로 기본 템플릿을 사용했습니다. 내용을 자유롭게 수정해주세요.',
      data: fallback,
    });
  } catch (err) {
    console.error('[generate-story] 예외:', err.message);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}
