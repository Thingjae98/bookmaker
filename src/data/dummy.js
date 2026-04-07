// ─── KidCanvas 더미 데이터 ──────────────────────────────────────────────────
//
// 로컬 이미지 경로: public/images/kidcanvas/ (Gemini 생성 아이 그림 28장)
//   - cover_front.png, cover_back.png: 표지 전용
//   - row-{1~4}-column-{1~7}.png: 내지 26장
//
// 템플릿 분기 규칙 (editor/page.jsx 기준):
//   image: URL + text: "텍스트"  → TPL_WITH_PHOTO  (사진+텍스트)
//   image: URL + text: ""        → TPL_WITH_PHOTO  (Full-bleed 사진)
//   image: null + text: "텍스트" → TPL_TEXT_ONLY   (텍스트 전용)
//
// 표지(frontCover/backCover)는 pages 배열과 완전 분리 — 순수 내지 26장
// 26페이지 구성: 13페이지 텍스트 有 + 13페이지 텍스트 無 (text: "")
// date 형식: YYYY-MM-DD (템플릿 date/dayLabel/dateLabel 바인딩 호환)
// ─────────────────────────────────────────────────────────────────────────────

// ── 로컬 이미지 경로 헬퍼 ────────────────────────────────────────────────────
const IMG = (filename) => `/images/kidcanvas/${filename}`;

// ─────────────────────────────────────────────────────────────────────────────
// KidCanvas — 우리 아이 그림 작품집 더미 데이터
// 부모가 아이의 그림 사진을 업로드 → AI가 작품 해설/제목 생성 → 미술관 도록 스타일 포토북
//
// 1~13p:  아이 그림 + AI 해설 텍스트 → TPL_WITH_PHOTO
// 14~26p: text: "" Full-bleed 아이 그림 → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const kidcanvasDummy = {
  meta: {
    bookTitle:       '하은이의 작은 미술관',
    childName:       '김하은',
    childAge:        '6세',
    period:          '2025.03 — 2026.02',
    bookDescription: '다섯 살부터 여섯 살까지, 하은이가 그린 세상. 크레파스와 물감으로 표현한 아이만의 시선을 한 권의 작품집으로 남깁니다.',
  },

  frontCover: { image: IMG('cover_front.png'), title: '하은이의 작은 미술관' },
  backCover:  { image: IMG('cover_back.png') },

  pages: [
    // ── 1~13p: 아이 그림 + AI 작품 해설 ──

    { date: '2025-03-08', title: '색깔 소용돌이', text: '크레파스를 꼭 쥐고 빙글빙글 동그라미를 그렸어요. 보라, 파랑, 빨강, 주황, 초록… 모든 색이 한데 모여 춤을 추는 것 같습니다. "나는 색깔 회오리바람을 만들었어!" 하은이는 자기가 만든 소용돌이가 무지개를 닮았다고 합니다.', image: IMG('row-1-column-3.png') },

    { date: '2025-03-22', title: '손바닥 도장 놀이', text: '물감을 손바닥에 가득 묻히고 힘차게 꾹꾹 눌렀어요. 파란색, 빨간색, 초록색 손바닥이 도화지 위에 꽃처럼 피었습니다. "내 손이 꽃이 됐어!" 물감이 얼굴에도 묻었지만 하은이는 아랑곳하지 않고 신나게 찍어냈습니다.', image: IMG('row-1-column-7.png') },

    { date: '2025-04-15', title: '우리 가족', text: '엄마, 아빠, 그리고 나. 세 사람이 나란히 서서 웃고 있어요. 엄마 머리카락은 갈색, 아빠는 초록 옷, 가운데 하은이는 노란 옷을 입고 있습니다. 머리 위에 떠 있는 빨간 하트는 "우리 가족은 사랑이 많으니까"라고 합니다.', image: IMG('row-1-column-5.png') },

    { date: '2025-05-10', title: '우리 집', text: '노란 벽에 빨간 지붕, 굴뚝에서는 회색 연기가 모락모락 피어오릅니다. 울타리 옆에 초록 나무가 서 있고, 해님이 환하게 웃고 있어요. 하은이는 "우리 집은 이렇게 생겼어. 마당에 강아지도 키우고 싶다"며 집 옆에 갈색 점을 찍었습니다.', image: IMG('row-1-column-4.png') },

    { date: '2025-06-03', title: '단짝 친구', text: '두 아이가 손을 잡고 나무 사이를 걸어가고 있어요. 머리 위에 빨간 하트가 떠 있고, 바닥에는 형형색색 꽃이 피어 있습니다. "이건 소율이랑 나야. 우리는 매일 같이 놀아!" 구름도 함께 웃고 있는 그림입니다.', image: IMG('row-1-column-6.png') },

    { date: '2025-07-20', title: '우주 괴물 삼총사', text: '초록 뿔 괴물, 파란 눈 괴물, 주황 이빨 괴물이 나란히 서 있어요. 무섭게 생겼지만 사실은 착한 괴물들이래요. "이 괴물들은 나쁜 괴물을 물리치는 슈퍼 히어로야!" 하은이는 괴물마다 이름도 지어주었습니다.', image: IMG('row-2-column-3.png') },

    { date: '2025-08-12', title: '바닷속 물고기', text: '파란 바닷물 속에 노란 물고기, 주황 물고기, 파란 물고기가 헤엄치고 있어요. 초록 해초가 물결에 흔들리고, 모래 위에는 조개가 놓여 있습니다. "물고기들은 바다에서 숨바꼭질해. 해초 뒤에 숨으면 아무도 못 찾아!"', image: IMG('row-2-column-4.png') },

    { date: '2025-09-05', title: '핑크 공룡', text: '분홍색 몸에 긴 목을 가진 공룡이 초록 풀밭 위에 서 있어요. 동글동글한 눈에 살짝 미소를 짓고 있습니다. "이 공룡은 뿌뿌야. 풀만 먹고 절대 안 물어. 나랑 같이 유치원에 가고 싶대!" 하은이의 상상 속 단짝입니다.', image: IMG('row-3-column-1.png') },

    { date: '2025-10-18', title: '줄무늬 고양이', text: '주황색과 갈색 줄무늬를 가진 고양이가 정면을 바라보고 있어요. 뾰족한 귀, 긴 수염, 분홍 코가 세밀하게 표현되어 있습니다. "옆집 고양이 나비를 그렸어. 나비는 맨날 담벼락에서 낮잠 자. 나도 같이 자고 싶다."', image: IMG('row-3-column-3.png') },

    { date: '2025-11-08', title: '로봇 친구', text: '네모난 회색 몸에 안테나 달린 로봇이 서 있어요. 가슴에는 알록달록한 버튼이 있고, 안테나에서 노란 번개가 나옵니다. 빨간 동그란 손이 귀여워요. "이 로봇은 내가 만든 거야. 청소도 하고 간식도 만들어 줘!"', image: IMG('row-3-column-4.png') },

    { date: '2025-12-20', title: '우주 로켓', text: '빨간색과 흰색 로켓이 주황색 불꽃을 내뿜으며 하늘로 솟아오르고 있어요. 옆에는 큰 노란 행성과 작은 파란 지구가 떠 있고, 하얀 별들이 반짝입니다. "나는 커서 우주비행사가 될 거야. 토성 고리 위에서 미끄럼틀 탈 거야!"', image: IMG('row-2-column-5.png') },

    { date: '2026-01-15', title: '봄날의 꽃밭', text: '파란 하늘 아래 초록 풀밭에 빨간 꽃, 노란 꽃, 분홍 꽃이 피어 있어요. 하얀 구름이 솜사탕처럼 두둥실 떠 있습니다. "여기는 비밀 정원이야. 나비랑 벌이랑 다 와서 놀아." 바람이 불면 꽃들이 춤을 춘다고 합니다.', image: IMG('row-3-column-5.png') },

    { date: '2026-02-28', title: '하늘을 나는 비행기', text: '하얀 비행기가 파란 하늘을 가르며 날아가고 있어요. 동글동글한 창문이 달려 있고, 파란색 날개가 멋집니다. 하얀 구름 사이를 지나가는 모습이 마치 장난감 비행기 같습니다. "이 비행기 타고 할머니 집에 갈 거야!"', image: IMG('row-4-column-7.png') },

    // ── 14~26p: text: "" Full-bleed 아이 그림 ──

    { date: '2025-03-15', title: '무지개 낙서',           text: '', image: IMG('row-2-column-1.png') },
    { date: '2025-04-22', title: '우리 동네 집',          text: '', image: IMG('row-2-column-2.png') },
    { date: '2025-05-18', title: '엄마와 춤을',           text: '', image: IMG('row-2-column-7.png') },
    { date: '2025-06-25', title: '아기 공룡',             text: '', image: IMG('row-3-column-2.png') },
    { date: '2025-07-10', title: '알록달록 자동차',       text: '', image: IMG('row-3-column-6.png') },
    { date: '2025-08-28', title: '노란 자동차',           text: '', image: IMG('row-3-column-7.png') },
    { date: '2025-09-12', title: '파란 자동차',           text: '', image: IMG('row-4-column-1.png') },
    { date: '2025-10-05', title: '빨간 자동차',           text: '', image: IMG('row-4-column-2.png') },
    { date: '2025-11-20', title: '나와 내 친구',          text: '', image: IMG('row-4-column-3.png') },
    { date: '2025-12-08', title: '우리 둘',               text: '', image: IMG('row-4-column-4.png') },
    { date: '2026-01-22', title: '나무 두 그루',          text: '', image: IMG('row-4-column-5.png') },
    { date: '2026-01-30', title: '큰 나무 작은 나무',     text: '', image: IMG('row-4-column-6.png') },
    { date: '2026-02-14', title: '달나라 여행',           text: '', image: IMG('row-2-column-6.png') },
  ],
};

// ─── 서비스 타입 → 더미 데이터 매핑 ──────────────────────────────────────────
export const DUMMY_DATA = {
  kidcanvas: kidcanvasDummy,
};
