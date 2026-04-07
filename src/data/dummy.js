// ─── 더미 이미지 URL ─────────────────────────────────────────────────────────
// picsum.photos — 시드 기반 실제 JPEG, SweetBook API 검증 통과
// placehold.co 는 PNG를 반환하여 SweetBook 파일 헤더 검증에 실패하므로 사용 금지
//
// 템플릿 분기 규칙 (editor/page.jsx 기준):
//   image: URL          + text: "텍스트"  → TPL_WITH_PHOTO  (사진+텍스트)
//   image: URL          + text: ""        → TPL_WITH_PHOTO  (Full-bleed 사진)
//   image: null         + text: "텍스트"  → TPL_TEXT_ONLY   (텍스트 전용)
//
// 표지(frontCover/backCover)는 pages 배열과 완전 분리 — 순수 내지 24장 보장
// 24페이지 구성: 12페이지 텍스트 有 + 12페이지 텍스트 無 (text: "")
// isLandscape: true → 파노라마(1200×600) 이미지 — 갤러리에서 가로형 배지 표시

// ── 이미지 헬퍼 ────────────────────────────────────────────────────────────────

// 아이 그림 테마 picsum (시드 기반 고정 JPEG)
const PLACEHOLDER = (seed) => `https://picsum.photos/seed/${seed}/600/600`;
const PANORAMA = (seed) => `https://picsum.photos/seed/${seed}/1200/600`;

// ─────────────────────────────────────────────────────────────────────────────
// KidCanvas — 우리 아이 그림 작품집 더미 데이터
// 부모가 아이의 그림 사진을 업로드 → AI가 작품 해설/제목 생성 → 미술관 도록 스타일 포토북
//
// 1~12p:  아이 그림 + AI 해설 텍스트 → TPL_WITH_PHOTO
// 13~24p: text: "" Full-bleed 아이 그림 → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const kidcanvasDummy = {
  meta: {
    bookTitle:       '하은이의 작은 미술관',
    childName:       '김하은',
    childAge:        '6세',
    period:          '2025.03 — 2026.02',
    bookDescription: '다섯 살부터 여섯 살까지, 하은이가 그린 세상. 크레파스와 물감으로 표현한 아이만의 시선을 한 권의 작품집으로 남깁니다.',
  },

  frontCover: { image: PLACEHOLDER('kidcanvas-cover-front'), title: '하은이의 작은 미술관' },
  backCover:  { image: PLACEHOLDER('kidcanvas-cover-back') },

  pages: [
    // ── 1~12p: 아이 그림 + AI 작품 해설 ──

    { date: '2025-03', title: '우리 가족', text: '엄마, 아빠, 그리고 나. 세 사람이 손을 잡고 있는 그림이에요. 하은이는 가족을 그릴 때 항상 빨간 하트를 함께 그립니다. 엄마 머리카락이 하늘까지 닿아 있는 건 "엄마가 제일 크니까"라고 합니다.', image: PLACEHOLDER('kid-family-drawing') },

    { date: '2025-04', title: '봄 나들이 나비', text: '유치원 소풍에서 본 나비를 기억하며 그렸어요. 날개에 무지개 색을 모두 넣었습니다. "나비가 예쁜 옷을 입고 있어요"라고 설명해 주었어요. 하늘에 떠 있는 세 개의 구름은 하은이, 엄마, 아빠입니다.', image: PLACEHOLDER('kid-butterfly-spring') },

    { date: '2025-05', title: '비 오는 날', text: '장화를 신고 물웅덩이에서 뛰노는 그림이에요. 빗방울 하나하나를 정성스럽게 파란 동그라미로 그렸습니다. 우산이 꽃 모양인 건 "비가 와도 기분이 좋으니까"라고 합니다. 작은 개구리 한 마리가 웅덩이 옆에서 웃고 있어요.', image: PLACEHOLDER('kid-rainy-day') },

    { date: '2025-06', title: '공룡 친구', text: '하은이의 상상 속 공룡 친구 "뿌뿌"입니다. 초록색 몸에 보라색 뿔이 있고, 아이스크림을 좋아해요. "뿌뿌는 무서운 공룡이 아니라 착한 공룡이야. 나랑 같이 유치원에 가고 싶대"라며 웃습니다.', image: PLACEHOLDER('kid-dinosaur-friend') },

    { date: '2025-07', title: '바다와 물고기', text: '여름 바다 여행의 기억을 담은 그림이에요. 물고기마다 서로 다른 무늬를 가지고 있습니다. 주황 물고기는 니모, 파란 물고기는 도리래요. 바다 밑에 보물상자를 그려 넣은 건 "인어공주 것"이라고 합니다.', image: PLACEHOLDER('kid-ocean-fish') },

    { date: '2025-08', title: '수박 먹는 날', text: '할머니 댁에서 수박을 먹던 날을 그렸어요. 수박이 하은이 몸보다 크게 그려져 있어요. "이만큼 큰 수박이었어!" 씨를 뱉는 모습이 귀엽게 표현되어 있고, 옆에는 부채를 든 할머니가 앉아 계십니다.', image: PLACEHOLDER('kid-watermelon-summer') },

    { date: '2025-09', title: '유치원 운동회', text: '줄넘기와 달리기를 하는 친구들의 모습이에요. 자기 자신을 맨 앞에 그리고 1등 리본을 달았습니다. "진짜로 1등은 못 했지만, 그림에서는 1등이야"라고 말하며 활짝 웃었어요.', image: PLACEHOLDER('kid-sports-day') },

    { date: '2025-10', title: '할로윈 유령', text: '유치원 할로윈 파티 후 그린 그림이에요. 유령이 사탕을 들고 웃고 있습니다. 무섭지 않은 유령을 그린 이유는 "유령도 사탕 먹으면 기분이 좋잖아"라고 합니다. 호박 모자를 쓴 고양이도 함께 있어요.', image: PLACEHOLDER('kid-halloween-ghost') },

    { date: '2025-11', title: '단풍잎 우산', text: '가을 산책에서 주워 온 단풍잎을 크레파스로 그렸어요. 빨강, 주황, 노랑 잎사귀가 비처럼 내려오고, 아이가 잎사귀를 우산 대신 쓰고 있습니다. 다람쥐 한 마리가 도토리를 안고 있는 디테일이 사랑스럽습니다.', image: PLACEHOLDER('kid-autumn-leaves') },

    { date: '2025-12', title: '산타에게 보내는 편지', text: '산타 할아버지에게 선물을 부탁하는 그림편지예요. 루돌프가 하트 모양 코를 가지고 있고, 선물 상자에서 곰인형이 삐져나와 있습니다. "산타 할아버지 감사합니다"라는 글씨를 처음으로 혼자 써서 뿌듯해했어요.', image: PLACEHOLDER('kid-santa-letter') },

    { date: '2026-01', title: '눈사람 가족', text: '첫눈이 온 날 온 가족이 만든 눈사람을 그렸어요. 눈사람 세 개는 아빠, 엄마, 하은이입니다. 가장 작은 눈사람에 분홍 목도리를 둘러주고 "이게 나야!"라고 합니다. 하늘에서 눈송이가 별 모양으로 내리고 있어요.', image: PLACEHOLDER('kid-snowman-family') },

    { date: '2026-02', title: '꿈속 왕국', text: '하은이가 꿈에서 본 왕국을 그렸어요. 구름 위에 성이 있고, 무지개 다리로 연결되어 있습니다. 공주님은 하은이 자신이고, 날개 달린 강아지가 함께 있어요. "여기서는 매일 케이크를 먹을 수 있어"라고 합니다.', image: PLACEHOLDER('kid-dream-castle') },

    // ── 13~24p: text: "" Full-bleed 아이 그림 ──

    { date: '2025-03', title: '무지개 집',           text: '', image: PLACEHOLDER('kid-rainbow-house') },
    { date: '2025-04', title: '꽃밭의 벌',           text: '', image: PLACEHOLDER('kid-flower-bee') },
    { date: '2025-05', title: '로켓 타는 나',        text: '', image: PLACEHOLDER('kid-rocket-ride') },
    { date: '2025-06', title: '아이스크림 왕국',     text: '', image: PLACEHOLDER('kid-icecream-land') },
    { date: '2025-07', title: '해바라기 정원',       text: '', image: PANORAMA('kid-sunflower-garden'), isLandscape: true },
    { date: '2025-08', title: '잠자는 고양이',       text: '', image: PLACEHOLDER('kid-sleeping-cat') },
    { date: '2025-09', title: '자동차 경주',         text: '', image: PLACEHOLDER('kid-car-race') },
    { date: '2025-10', title: '마법사 모자',         text: '', image: PLACEHOLDER('kid-wizard-hat') },
    { date: '2025-11', title: '숲속 친구들',         text: '', image: PLACEHOLDER('kid-forest-friends') },
    { date: '2025-12', title: '크리스마스 트리',     text: '', image: PANORAMA('kid-christmas-tree'), isLandscape: true },
    { date: '2026-01', title: '펭귄 가족',           text: '', image: PLACEHOLDER('kid-penguin-family') },
    { date: '2026-02', title: '하은이의 자화상',     text: '', image: PLACEHOLDER('kid-self-portrait') },
  ],
};

// ─── 서비스 타입 → 더미 데이터 매핑 ──────────────────────────────────────────
export const DUMMY_DATA = {
  kidcanvas: kidcanvasDummy,
};
