// ─── 더미 이미지 URL ─────────────────────────────────────────────────────────
// picsum.photos — 시드 기반 실제 JPEG, SweetBook API 검증 통과
// placehold.co 는 PNG를 반환하여 SweetBook 파일 헤더 검증에 실패하므로 사용 금지
//
// 템플릿 분기 규칙 (editor/page.jsx 기준):
//   image: PLACEHOLDER(seed)  + text: "텍스트"  → TPL_WITH_PHOTO  (3FhSEhJ94c0T) ← 사진+텍스트
//   image: PLACEHOLDER(seed)  + text: ""        → TPL_WITH_PHOTO  (3FhSEhJ94c0T) ← Full-bleed 사진
//   image: null               + text: "텍스트"  → TPL_TEXT_ONLY   (vHA59XPPKqak) ← 텍스트 전용
//
// 표지(frontCover/backCover)는 pages 배열과 완전 분리 — pages에서 빼지 않으므로 순수 내지 24장 보장
// 24페이지 구성: 12페이지 텍스트 有 + 12페이지 텍스트 無 (text: "")
// isLandscape: true 로 표시된 항목은 파노라마(1200×600) 이미지 — 갤러리에서 가로형 배지 표시

const PLACEHOLDER = (seed) =>
  `https://picsum.photos/seed/${seed}/600/600`;

const PANORAMA = (seed) =>
  `https://picsum.photos/seed/${seed}/1200/600`;

// ─────────────────────────────────────────────────────────────────────────────
// 1. 육아 일기 포토북 — 하은이의 1년
//    1~12p: 감성 장문 텍스트 + 사진   → TPL_WITH_PHOTO
//   13~24p: text: "" (Full-bleed 사진) → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const babyDummy = {
  meta: {
    babyName:  '하은이',
    birthDate: '2025-01-15',
    period:    '1년',
    message:   '사랑하는 하은아, 네가 세상에 나온 그 날부터 우리의 모든 것이 달라졌어. 건강하게 자라줘서 정말 고마워 ♥',
  },
  frontCover: { image: PLACEHOLDER('baby-cover-front'), title: '하은이의 1년' },
  backCover:  { image: PLACEHOLDER('baby-cover-back') },
  pages: [
    // ── 1~12p: 텍스트 있는 페이지 ──
    { date: '2025-01-15', title: '하은이가 태어난 날', text: '오늘 우리 가족에 작은 천사가 찾아왔어요. 새벽 2시 32분, 3.2kg의 건강한 울음 소리. 아빠는 눈물을 참지 못했고, 엄마는 너무 지쳐서 잠들었지만 손을 꼭 쥔 채였어요. 하은아, 이 순간 우리는 완전한 가족이 됐단다.', image: PLACEHOLDER('baby-born') },
    { date: '2025-02-01', title: '첫 미소', text: '오늘 하은이가 처음으로 웃었어요. 아직 의미가 있는 미소인지 모르겠지만, 그것만으로도 하루 종일 힘든 것이 싹 사라지는 기분이에요. 세상에서 가장 아름다운 미소를 가진 아이가 우리 딸이라니.', image: PLACEHOLDER('baby-smile') },
    { date: '2025-02-14', title: '첫 목욕', text: '따뜻한 욕조에 들어가던 순간의 표정! 처음엔 꽥꽥 울다가 포근함이 느껴지자 점점 눈을 감더라고요. 물속에서 편안히 팔다리를 뻗는 모습이 얼마나 사랑스럽던지. 목욕 후 파우더 냄새가 아직도 코끝에 남아요.', image: PLACEHOLDER('baby-bath') },
    { date: '2025-03-01', title: '100일 잔치', text: '할머니 할아버지, 외할머니 외할아버지, 고모 삼촌까지 온 가족이 모였어요. 하은이는 자기가 주인공인 줄도 모르고 내내 잘 잤지만, 덕분에 사진은 정말 예쁘게 찍혔답니다. 100일 떡은 정말 맛있었어요!', image: PLACEHOLDER('baby-100days') },
    { date: '2025-03-15', title: '뒤집기 성공!', text: '아침부터 얼마나 뒤집으려고 용을 쓰던지, 발을 동동 구르고 옆으로 기울이기를 반복하더니 마침내 성공! 아빠랑 엄마가 박수를 치자 하은이도 뿌듯한 얼굴로 웃었어요. 이렇게 하나씩 해내는 모습이 너무 대견해요.', image: PLACEHOLDER('baby-rollover') },
    { date: '2025-04-01', title: '이유식 시작', text: '첫 이유식은 쌀미음이었어요. 숟가락 하나를 입에 넣어주자 표정이 묘하게 찡그러지다가, 삼키고 나더니 입을 벌리는 거예요. 더 달라는 신호! 이제 진짜 밥을 먹기 시작하는구나 싶어 뭉클했어요.', image: PLACEHOLDER('baby-food') },
    { date: '2025-04-20', title: '첫 나들이', text: '봄날의 공원을 처음 경험한 하은이. 유모차에서 두리번거리며 나뭇잎과 꽃을 바라보는 눈빛이 반짝반짝했어요. 바람에 흔들리는 민들레 홀씨를 보고는 손을 뻗더라고요. 세상이 신기한 거겠지요?', image: PLACEHOLDER('baby-outing') },
    { date: '2025-05-05', title: '어린이날', text: '하은이의 첫 어린이날이에요. 아직 무슨 날인지 모르겠지만 선물을 잔뜩 받았답니다. 딸랑이 하나에 그렇게 좋아하는 걸 보니, 큰 선물이 필요 없겠구나 싶었어요. 오늘도 웃음이 가득한 하루였습니다.', image: PLACEHOLDER('baby-childday') },
    { date: '2025-05-20', title: '옹알이 시작', text: '"아~", "우~", "에에에~" 말인지 노래인지 모를 소리를 하루 종일 내더라고요. 눈을 마주치고 이야기하면 더 신나서 떠들어요. 이 소리가 언제쯤 "엄마"가 될지 매일 기대되고 설레요.', image: PLACEHOLDER('baby-babble') },
    { date: '2025-06-15', title: '이가 났어요', text: '아래 앞니 두 개가 살짝 보이기 시작했어요. 손가락을 넣었다가 깜짝 놀랐답니다. 이유 없이 보채던 이유가 있었구나 싶어서 미안했어요. 작은 치아 두 개가 나온 것뿐인데 엄청나게 어른스러워 보여요.', image: PLACEHOLDER('baby-tooth') },
    { date: '2025-07-01', title: '앉기 성공', text: '드디어 혼자 앉아요! 몇 번이나 쿵 넘어지면서도 포기 안 하고 계속 도전하더니 오늘은 10초 넘게 버텼어요. 우리 하은이 정말 끈질기고 대단해요. 앉아서 장난감 잡는 모습이 너무 사랑스러워요.', image: PLACEHOLDER('baby-sit') },
    { date: '2025-07-15', title: '반 돌', text: '벌써 반 년이 지났어요. 갓 태어났을 때 그 작던 아이가 이제 앉고 웃고 떠들어요. 하루하루 다른 표정과 행동들이 얼마나 감사하고 신기한지. 앞으로 남은 반 년도, 그 다음 1년도, 모두 기록해두고 싶어요.', image: PLACEHOLDER('baby-6months') },
    // ── 13~24p: text: "" Full-bleed 사진 ──
    { date: '2025-08-01', title: '수영장 데뷔',   text: '', image: PLACEHOLDER('baby-pool') },
    { date: '2025-08-15', title: '이유식 도전기', text: '', image: PLACEHOLDER('baby-mess') },
    { date: '2025-09-01', title: '기어다니기',    text: '', image: PLACEHOLDER('baby-crawl') },
    { date: '2025-09-20', title: '까꿍 놀이',     text: '', image: PLACEHOLDER('baby-peekaboo') },
    { date: '2025-10-05', title: '가을 나들이',   text: '', image: PLACEHOLDER('baby-fall') },
    { date: '2025-10-20', title: '첫 독서',       text: '', image: PLACEHOLDER('baby-book') },
    { date: '2025-11-01', title: '첫 걸음마',     text: '', image: PLACEHOLDER('baby-walk') },
    { date: '2025-11-15', title: '생일 준비',     text: '', image: PLACEHOLDER('baby-bday-prep') },
    { date: '2026-01-15', title: '돌잔치',        text: '', image: PLACEHOLDER('baby-doljabi') },
    { date: '2026-01-16', title: '첫 생일 케이크',text: '', image: PLACEHOLDER('baby-cake') },
    { date: '2026-01-17', title: '가족사진',      text: '', image: PLACEHOLDER('baby-family') },
    { date: '2026-01-18', title: '사랑해 하은아', text: '', image: PLACEHOLDER('baby-love') },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. 유치원 졸업 앨범 — 김서준의 해바라기반 1학기
//    1~12p: 선생님·부모 코멘트 텍스트 + 사진 → TPL_WITH_PHOTO
//   13~24p: text: "" (활동 사진 Full-bleed)  → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const kindergartenDummy = {
  meta: {
    childName:   '김서준',
    className:   '해바라기반',
    year:        '2025',
    semester:    '1학기',
    teacherName: '박선생님',
  },
  frontCover: { image: PLACEHOLDER('kinder-cover-front'), title: '해바라기반 1학기' },
  backCover:  { image: PLACEHOLDER('kinder-cover-back') },
  pages: [
    // ── 1~12p: 텍스트 있는 페이지 ──
    { date: '2025-03-03', title: '입학 첫날', teacherComment: '긴장한 듯 보였지만 점심도 잘 먹고 첫날을 잘 보냈어요!', text: '긴장한 듯 보였지만 점심도 잘 먹고 첫날을 훌륭하게 마쳤어요. 새 친구들과 금방 친해지는 서준이가 대견합니다.', image: PLACEHOLDER('kinder-first-day') },
    { date: '2025-03-10', title: '블록 쌓기', teacherComment: '친구와 힘을 합쳐 가장 높은 탑을 만들었어요!', text: '친구와 힘을 합쳐 가장 높은 탑을 만들었어요. 자기가 만든 작품이 무너지자 "괜찮아, 다시 하면 돼!"라고 하더라고요. 멋진 한마디였습니다.', image: PLACEHOLDER('kinder-blocks') },
    { date: '2025-03-20', title: '봄꽃 그리기', teacherComment: '노란 민들레와 분홍 벚꽃을 너무 예쁘게 그렸어요!', text: '노란 민들레와 분홍 벚꽃을 색연필로 꼼꼼하게 색칠했어요. "엄마한테 드릴 거예요"라며 정성껏 마무리하는 모습이 너무 사랑스러웠습니다.', image: PLACEHOLDER('kinder-drawing') },
    { date: '2025-04-05', title: '봄 소풍', teacherComment: '도시락을 친구들과 나눠 먹는 모습이 정말 예뻤어요.', text: '봄 소풍에서 김밥을 친구들과 나눠 먹었어요. "선생님도 드세요!" 하며 자기 김밥을 내미는 서준이. 나눌 줄 아는 아이로 자라고 있어요.', image: PLACEHOLDER('kinder-picnic') },
    { date: '2025-04-15', title: '동물 역할놀이', teacherComment: '사자 역할을 맡아 아주 용감하게 표현했어요!', text: '오늘 동물 역할놀이에서 사자 역할을 맡았어요. "어흥!" 하며 친구들을 깜짝 놀라게 했지만, 놀라는 친구들을 보며 배꼽 잡고 웃었답니다.', image: PLACEHOLDER('kinder-roleplay') },
    { date: '2025-05-01', title: '카네이션 만들기', teacherComment: '엄마 드릴 거라며 제일 정성스럽게 만들었어요.', text: '어버이날을 앞두고 카네이션을 만들었어요. 꽃잎을 하나하나 구기며 "엄마가 좋아할 것 같아요"라고 했어요. 집에 가져가서 엄마한테 드렸더니 엄마가 울었다고 해요.', image: PLACEHOLDER('kinder-carnation') },
    { date: '2025-05-15', title: '체육 달리기', teacherComment: '달리기에서 1등을 했어요. 친구들을 응원하는 모습도 예뻤어요.', text: '오늘 달리기에서 1등을 했어요! 결승선을 통과하고 나서 뒤에 오는 친구들을 향해 "파이팅!" 하고 외쳤답니다. 이기는 것만큼 응원하는 것도 중요하다는 걸 아는 것 같아요.', image: PLACEHOLDER('kinder-running') },
    { date: '2025-05-28', title: '자연 관찰', teacherComment: '화단에서 지렁이를 발견하고 친구들에게 소개했어요.', text: '유치원 화단에서 지렁이를 발견! 처음엔 무서워하다가 손바닥에 올려놓고 친구들에게 설명해줬어요. "지렁이는 땅을 건강하게 해줘요"라고 배운 걸 그대로 이야기하는 모습이 기특했습니다.', image: PLACEHOLDER('kinder-nature') },
    { date: '2025-06-10', title: '물감 놀이', teacherComment: '무지개 색깔을 모두 써서 그림을 완성했어요!', text: '물감 놀이 시간에 무지개를 그렸는데 옷에 물감이 잔뜩 묻어왔어요. 그래도 그림이 얼마나 예쁜지 엄마 아빠가 냉장고에 붙여뒀답니다.', image: PLACEHOLDER('kinder-paint') },
    { date: '2025-06-20', title: '꿈 발표', teacherComment: '"과학자가 되고 싶어요"라고 자신 있게 발표했어요.', text: '"커서 뭐가 되고 싶어요?" 발표 시간에 서준이는 "과학자요! 우주를 연구할 거예요"라고 당당하게 말했어요. 친구들이 "와아~" 하는 소리에 수줍게 웃던 표정이 기억에 남아요.', image: PLACEHOLDER('kinder-dream') },
    { date: '2025-06-25', title: '수료식 리허설', teacherComment: '노래 연습을 열심히 해줘서 감사해요!', text: '수료식에서 부를 노래를 연습했어요. 가사를 잊어버려도 당황하지 않고 옆 친구를 힐끗 보며 따라 부르는 모습이 너무 귀여웠습니다.', image: PLACEHOLDER('kinder-rehearsal') },
    { date: '2025-07-01', title: '1학기 수료식', teacherComment: '한 학기 동안 눈부시게 성장한 서준이에게 박수를 보냅니다!', text: '반 년 동안 함께한 해바라기반 친구들과 수료식을 했어요. 박선생님이 한 명 한 명에게 칭찬 편지를 써주셨는데, 서준이 편지를 읽으며 눈물이 났어요. 감사합니다, 선생님.', image: PLACEHOLDER('kinder-graduation') },
    // ── 13~24p: text: "" Full-bleed 활동 사진 ──
    { date: '2025-03-05', title: '미술 시간',     text: '', image: PLACEHOLDER('kinder-art-class') },
    { date: '2025-03-18', title: '바깥 놀이',     text: '', image: PLACEHOLDER('kinder-playground') },
    { date: '2025-04-02', title: '요리 수업',     text: '', image: PLACEHOLDER('kinder-cooking') },
    { date: '2025-04-22', title: '과학 놀이',     text: '', image: PLACEHOLDER('kinder-science') },
    { date: '2025-05-08', title: '음악 시간',     text: '', image: PLACEHOLDER('kinder-music') },
    { date: '2025-05-20', title: '모래 놀이',     text: '', image: PLACEHOLDER('kinder-sand') },
    { date: '2025-06-01', title: '수영 수업',     text: '', image: PLACEHOLDER('kinder-swim') },
    { date: '2025-06-12', title: '독서 시간',     text: '', image: PLACEHOLDER('kinder-reading') },
    { date: '2025-06-18', title: '전시회 관람',   text: '', image: PLACEHOLDER('kinder-museum') },
    { date: '2025-06-22', title: '친구와 함께',   text: '', image: PLACEHOLDER('kinder-friends') },
    { date: '2025-06-28', title: '선생님과 함께', text: '', image: PLACEHOLDER('kinder-teacher') },
    { date: '2025-07-01', title: '수료식 기념',   text: '', image: PLACEHOLDER('kinder-grad-group') },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. AI 동화책 — 하은이의 우주 탐험 (10페이지 이야기 + 14페이지 삽화)
//    1~12p: 이야기 텍스트 + 일러스트   → TPL_WITH_PHOTO
//   13~24p: text: "" (챕터 Full-bleed 삽화) → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const fairytaleDummy = {
  meta: {
    heroName:    '하은이',
    heroAge:     '6살',
    theme:       '우주 탐험',
    moralLesson: '용기와 도전',
  },
  frontCover: { image: PLACEHOLDER('fairy-cover-front'), title: '하은이의 우주 탐험' },
  backCover:  { image: PLACEHOLDER('fairy-cover-back') },
  pages: [
    // ── 1~12p: 이야기 텍스트 있는 페이지 ──
    { date: '2025-04-01', title: '별빛 아이 하은이', text: '어느 날 밤, 하은이의 방 창문으로 작은 별빛이 쏟아져 들어왔어요. "하은아, 함께 우주를 탐험하지 않을래?" 별빛이 속삭였어요. 하은이는 용기를 내어 침대에서 일어났답니다.', image: PLACEHOLDER('fairy-starlight') },
    { date: '2025-04-01', title: '로켓 발사!', text: '"3, 2, 1, 발사!" 하은이가 탄 작은 로켓이 구름을 뚫고 하늘 높이 솟아올랐어요. 아래로 지구가 작아지는 걸 보니 가슴이 두근두근! 무서우면서도 신나는 이 기분, 뭐라고 해야 할까요?', image: PLACEHOLDER('fairy-rocket') },
    { date: '2025-04-01', title: '달님 마을', text: '로켓이 달에 도착했어요. 달 표면에는 작고 하얀 토끼들이 살고 있었어요. "어서 와! 우리는 달빛 토끼야." 토끼들은 하은이에게 달콤한 달떡을 나눠줬어요.', image: PLACEHOLDER('fairy-moon') },
    { date: '2025-04-01', title: '빨간 별의 용감한 사자', text: '빨간 별 위에는 거대한 모래폭풍이 불고 있었어요. 그 안에 갇힌 작은 사자 한 마리! 하은이는 무서웠지만 로켓에서 뛰어내려 사자를 구했어요.', image: PLACEHOLDER('fairy-redstar') },
    { date: '2025-04-01', title: '토성의 고리를 건너며', text: '토성의 고리를 건널 때였어요. 얼음 조각들이 반짝반짝 빛났어요. "이 예쁜 조각 하나 가져가도 될까요?" 하은이가 물었더니 토성이 낮은 목소리로 대답했어요. "모두의 것이니 바라보는 것으로 충분하단다."', image: PLACEHOLDER('fairy-saturn') },
    { date: '2025-04-01', title: '은하수 다리', text: '은하수를 건너는 무지개 다리가 나타났어요. 다리 위에는 수천 개의 별자리가 빛나고 있었고, 각 별자리는 지구의 어린이들 이야기를 담고 있었어요. 하은이의 별자리도 있었어요.', image: PLACEHOLDER('fairy-galaxy') },
    { date: '2025-04-01', title: '외계인 친구 보비', text: '"안녕? 나는 보비야. 초록 별에서 왔어." 통통한 외계인이 손을 흔들었어요. 말은 달랐지만 웃음은 같았어요. 하은이와 보비는 언어가 달라도 금방 친구가 됐답니다.', image: PLACEHOLDER('fairy-alien') },
    { date: '2025-04-01', title: '우주 미아가 될 뻔!', text: '그런데 로켓 엔진이 멈춰버렸어요! 하은이의 심장이 철렁 내려앉았어요. 그때 보비가 초록별의 에너지 수정을 건네줬어요. "친구를 혼자 두지 않아." 다시 엔진이 작동하기 시작했어요.', image: PLACEHOLDER('fairy-crisis') },
    { date: '2025-04-01', title: '지구가 보인다!', text: '드디어 멀리 파란 지구가 보이기 시작했어요. 하은이는 울컥해서 눈물이 났어요. "집이다!" 창문 너머로 바라보이는 파란 지구는 그 어떤 별보다 아름다웠어요.', image: PLACEHOLDER('fairy-earth') },
    { date: '2025-04-01', title: '꿈에서 깨어나며', text: '눈을 떠보니 따뜻한 침대 안이었어요. 창밖으로 새벽빛이 스며들었어요. 꿈이었을까요? 하지만 손안에 빛나는 은하수 별조각 하나가 있었어요. "용기 있는 어린이에게 주는 선물이야"라는 쪽지와 함께.', image: PLACEHOLDER('fairy-dream-end') },
    { date: '2025-04-01', title: '하은이의 우주 일기', text: '하은이는 일기장을 꺼내 오늘의 탐험을 기록했어요. "달님 마을, 사자 구출, 보비와의 우정, 그리고 지구의 아름다움." 언젠가 진짜 우주에 가면 이 일기를 다시 꺼내보리라 다짐하며 잠들었어요.', image: PLACEHOLDER('fairy-diary') },
    { date: '2025-04-01', title: '보비에게 보내는 편지', text: '"초록별의 보비에게. 네 덕분에 집에 올 수 있었어. 언젠가 너의 별을 방문하고 싶어. 그날까지 건강하게 지내. 지구의 하은이가." 편지를 접어 별빛에 실어 보냈어요.', image: PLACEHOLDER('fairy-letter') },
    // ── 13~24p: text: "" Full-bleed 삽화 ──
    { date: '2025-04-01', title: '우주 전경',       text: '', image: PLACEHOLDER('fairy-space-view') },
    { date: '2025-04-01', title: '달 표면',         text: '', image: PLACEHOLDER('fairy-moon-surface') },
    { date: '2025-04-01', title: '빨간 행성',       text: '', image: PLACEHOLDER('fairy-red-planet') },
    { date: '2025-04-01', title: '토성 고리',       text: '', image: PLACEHOLDER('fairy-saturn-ring') },
    { date: '2025-04-01', title: '은하수',          text: '', image: PLACEHOLDER('fairy-milkyway') },
    { date: '2025-04-01', title: '외계인 마을',     text: '', image: PLACEHOLDER('fairy-alien-village') },
    { date: '2025-04-01', title: '우주 비행',       text: '', image: PLACEHOLDER('fairy-flight') },
    { date: '2025-04-01', title: '별자리 지도',     text: '', image: PLACEHOLDER('fairy-constellation') },
    { date: '2025-04-01', title: '파란 지구',       text: '', image: PLACEHOLDER('fairy-blue-earth') },
    { date: '2025-04-01', title: '창문 속 별빛',    text: '', image: PLACEHOLDER('fairy-window') },
    { date: '2025-04-01', title: '우주 탐험가 배지', text: '', image: PLACEHOLDER('fairy-badge') },
    { date: '2025-04-01', title: '다음 탐험을 기다리며', text: '', image: PLACEHOLDER('fairy-next') },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. 여행 포토북 — 2025 제주도 4박 5일
//    1~12p: 장소·감성 캡션 + 사진      → TPL_WITH_PHOTO
//   13~24p: text: "" (Full-bleed 풍경)  → TPL_WITH_PHOTO
//   파노라마 2장 포함: isLandscape: true (1200×600px, 가로형 배지 표시)
// ─────────────────────────────────────────────────────────────────────────────
export const travelDummy = {
  meta: {
    tripName:    '2025 제주도 4박 5일',
    destination: '제주도',
    startDate:   '2025-05-01',
    endDate:     '2025-05-05',
    companions:  '가족 4명',
  },
  frontCover: { image: PLACEHOLDER('jeju-cover-front'), title: '2025 제주도 4박 5일' },
  backCover:  { image: PLACEHOLDER('jeju-cover-back') },
  pages: [
    // ── 1~12p: 텍스트 있는 페이지 ──
    { date: '2025-05-01', title: '제주 도착, 봄볕이 반긴다', text: '비행기에서 내리자마자 코끝에 닿는 바닷바람. 제주의 공기는 서울과 확실히 달랐어요. 아이들이 달려나가며 "바다!"를 외치는 소리에 지난 몇 달의 피로가 한 번에 사라지는 것 같았습니다.', image: PLACEHOLDER('jeju-arrive') },
    { date: '2025-05-01', title: '용두암, 용이 된 돌', text: '전설 속 용이 하늘로 오르다 굳어버렸다는 용두암. 파도가 철썩이는 소리를 들으며 바위 앞에 서니, 정말로 그 전설이 느껴지는 것 같았어요. 오후의 햇살이 바위에 황금빛을 입혀줬습니다.', image: PLACEHOLDER('jeju-dragon-rock') },
    { date: '2025-05-01', title: '흑돼지와 함께한 첫 저녁', text: '제주에 왔으니 흑돼지는 필수! 지글지글 구워지는 소리와 함께 고소한 냄새가 가게 안을 가득 채웠어요. 쌈 한 장에 두툼한 삼겹살, 된장에 찍어 한 입. 이게 여행의 맛이죠.', image: PLACEHOLDER('jeju-pork') },
    { date: '2025-05-02', title: '성산일출봉 새벽 등반', text: '새벽 5시에 일어나 성산일출봉을 올랐어요. 숨이 차오를 때쯤 정상에 도착하니, 지평선 너머로 붉은 해가 솟아오르고 있었어요. 그 순간만큼은 말이 필요 없었습니다. 그냥 바라보았어요.', image: PLACEHOLDER('jeju-sunrise') },
    { date: '2025-05-02', title: '섭지코지 해안 산책', text: '섭지코지의 해안 절벽을 따라 걸으면 왼쪽은 바다, 오른쪽은 초록 언덕. 제주 들판에 핀 유채꽃이 노란 물결을 이루고, 그 너머로 성산이 우뚝 서 있었어요. 사진이 아무리 찍어도 이 풍경을 다 담을 수 없었습니다.', image: PLACEHOLDER('jeju-seongsan') },
    { date: '2025-05-02', title: '감귤 밭 카페', text: '귤 나무들 사이에 조용히 숨어있는 카페. 직접 딴 감귤로 만든 주스 한 잔을 마시며 아무것도 안 하는 시간을 가졌어요. 여행에서 가장 기억에 남는 건 늘 이런 아무것도 아닌 순간들이더라고요.', image: PLACEHOLDER('jeju-tangerine') },
    { date: '2025-05-03', title: '한라산 영실코스', text: '한라산 영실코스는 생각보다 훨씬 아름다웠어요. 오름마다 다른 꽃이 피어 있고, 위로 올라갈수록 구름 속으로 들어가는 기분. 정상은 구름에 가렸지만 그것도 한라산의 모습이라 생각하기로 했어요.', image: PLACEHOLDER('jeju-hallasan') },
    { date: '2025-05-03', title: '중문 바다에서 쉬어가기', text: '등산 후 중문해수욕장에 발을 담갔어요. 검은 현무암 돌멩이 위로 청록빛 파도가 밀려왔다 빠져나가기를 반복했어요. 이 파도가 쉬지 않고 수천 년을 이렇게 왔다갔다 했을 텐데.', image: PLACEHOLDER('jeju-jungmun') },
    { date: '2025-05-04', title: '동문시장의 아침', text: '새벽부터 열리는 동문시장의 활기가 좋았어요. 갓 구운 빵, 싱싱한 해산물, 오렌지처럼 쌓인 감귤들. 여행의 마지막 날 아침을 시장에서 시작하는 건 언제나 옳은 선택이에요.', image: PLACEHOLDER('jeju-market') },
    { date: '2025-05-04', title: '마지막 해안 드라이브', text: '제주 해안도로를 따라 드라이브를 했어요. 창문을 열고 바닷바람을 맞으며 달리니, 이 여행을 절대 잊지 말자고 다짐하게 됐어요. 다음에 또 오자는 말을 가족 모두가 동시에 했어요.', image: PLACEHOLDER('jeju-coastroad') },
    { date: '2025-05-04', title: '안녕, 제주도', text: '짐을 싸면서 돌아보니 4박 5일이 너무 짧게 느껴졌어요. 공항으로 향하는 버스 창밖으로 유채꽃 밭이 펼쳐졌어요. 제주야, 다음에 또 올게. 꼭.', image: PLACEHOLDER('jeju-goodbye') },
    { date: '2025-05-01', title: '제주 파노라마', text: '성산일출봉에서 바라본 탁 트인 제주의 지평선. 왼쪽 끝에서 오른쪽 끝까지 펼쳐진 바다와 하늘. 이 넓음 앞에서 내 걱정들이 얼마나 작은지 새삼 느꼈어요.', image: PANORAMA('jeju-panorama-sunrise'), isLandscape: true },
    // ── 13~24p: text: "" Full-bleed 풍경 사진 ──
    { date: '2025-05-01', title: '공항 활주로',     text: '', image: PLACEHOLDER('jeju-runway') },
    { date: '2025-05-01', title: '제주 시내',       text: '', image: PLACEHOLDER('jeju-city') },
    { date: '2025-05-02', title: '새벽 하늘',       text: '', image: PLACEHOLDER('jeju-dawn') },
    { date: '2025-05-02', title: '유채꽃 밭',       text: '', image: PLACEHOLDER('jeju-canola') },
    { date: '2025-05-02', title: '에메랄드 바다',   text: '', image: PLACEHOLDER('jeju-emerald') },
    { date: '2025-05-02', title: '오름 정상',       text: '', image: PLACEHOLDER('jeju-oreum') },
    { date: '2025-05-03', title: '구름 위 한라산',  text: '', image: PLACEHOLDER('jeju-cloud') },
    { date: '2025-05-03', title: '검은 모래해변',   text: '', image: PLACEHOLDER('jeju-blackbeach') },
    { date: '2025-05-04', title: '새벽 시장',       text: '', image: PLACEHOLDER('jeju-morning-market') },
    { date: '2025-05-04', title: '제주 파노라마 2', text: '', image: PANORAMA('jeju-panorama-coast'), isLandscape: true },
    { date: '2025-05-04', title: '이별의 노을',     text: '', image: PLACEHOLDER('jeju-sunset') },
    { date: '2025-05-05', title: '다시 서울로',     text: '', image: PLACEHOLDER('jeju-plane-back') },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. 감성 에세이 — 일상의 온도
//    text_only 템플릿 매력 극대화를 위한 교차 배치:
//    홀수 페이지 (1, 3, 5...): image: null + 장문 텍스트 → TPL_TEXT_ONLY (텍스트 전용)
//    짝수 페이지 (2, 4, 6...): PLACEHOLDER + text: ""    → TPL_WITH_PHOTO (Full-bleed 풍경)
//    → 12 text-only + 12 photo-only 교차 배치
// ─────────────────────────────────────────────────────────────────────────────
export const selfpublishDummy = {
  meta: {
    bookTitle:       '일상의 온도',
    authorName:      '김민수',
    genre:           '에세이',
    bookDescription: '계절이 바뀌듯 감정도 바뀐다. 봄의 설렘, 여름의 지침, 가을의 쓸쓸함, 겨울의 고요함을 담았다.',
  },
  frontCover: { image: PLACEHOLDER('essay-cover-front'), title: '일상의 온도' },
  backCover:  { image: PLACEHOLDER('essay-cover-back') },
  pages: [
    // ── 1p: 텍스트 전용 (image: null) ──
    { date: '2025-01-01', title: '아침의 의식', text: '매일 같은 시간에 울리는 알람 소리. 하지만 오늘 아침은 조금 달랐다. 창밖으로 들어오는 햇살이 유난히 따뜻했다. 커피 한 잔을 내리며 하루를 시작하는 이 작은 의식이, 사실은 나에게 가장 소중한 시간이다. 아무도 방해하지 않는 이 새벽의 고요함 속에서만 나는 진짜 나와 이야기할 수 있다.', image: null },
    // ── 2p: 사진 전용 ──
    { date: '2025-01-02', title: '겨울 창가', text: '', image: PLACEHOLDER('essay-winter-window') },
    // ── 3p: 텍스트 전용 ──
    { date: '2025-01-15', title: '비 오는 날의 산책', text: '우산을 쓰고 걷는 길. 빗소리가 만들어내는 리듬에 발걸음을 맞춘다. 웅덩이에 비친 가로등 불빛이 수채화처럼 번진다. 비 오는 날은 세상이 조금 더 부드러워지는 것 같다. 모든 소음이 빗소리에 감싸여 사라지고, 나만 남는 이 기분.', image: null },
    // ── 4p: 사진 전용 ──
    { date: '2025-01-16', title: '빗속 골목',  text: '', image: PLACEHOLDER('essay-rain-alley') },
    // ── 5p: 텍스트 전용 ──
    { date: '2025-02-01', title: '오래된 책방', text: '골목 안쪽, 낡은 간판의 헌책방. 종이 냄새가 코끝에 닿는 순간, 시간이 멈춘 듯한 기분이 든다. 누군가의 밑줄 그은 문장에서 낯선 위로를 받는다. 책 한 권을 들고 읽다 보면 어느새 두 시간이 흘러 있다. 이 작은 공간이 없었다면 이 도시가 훨씬 삭막했을 것이다.', image: null },
    // ── 6p: 사진 전용 ──
    { date: '2025-02-02', title: '헌책방 서가', text: '', image: PLACEHOLDER('essay-bookshelf') },
    // ── 7p: 텍스트 전용 ──
    { date: '2025-02-15', title: '할머니의 된장찌개', text: '어떤 음식도 할머니의 된장찌개를 따라올 수 없다. 레시피가 아니라 기억의 맛이기 때문이다. 어린 시절, 할머니 집 마루에 앉아 먹던 그 맛을 나는 아직도 찾고 있다. 된장찌개를 끓일 때마다 할머니 목소리가 들리는 것 같아서, 나는 된장찌개를 자주 끓인다.', image: null },
    // ── 8p: 사진 전용 ──
    { date: '2025-02-16', title: '부엌 풍경', text: '', image: PLACEHOLDER('essay-kitchen') },
    // ── 9p: 텍스트 전용 ──
    { date: '2025-03-01', title: '새벽 버스', text: '텅 빈 새벽 버스에 앉아 있으면, 세상은 나만을 위해 조용해진 것 같다. 창밖으로 스쳐 지나가는 가로등 불빛들이 하나의 이야기를 만들어낸다. 어딘가로 향하고 있다는 사실만으로도 충분히 살아있다는 기분이 든다. 목적지보다 이 여정이 더 소중할 때가 있다.', image: null },
    // ── 10p: 사진 전용 ──
    { date: '2025-03-02', title: '새벽 가로등', text: '', image: PLACEHOLDER('essay-streetlight') },
    // ── 11p: 텍스트 전용 ──
    { date: '2025-04-05', title: '봄의 첫 문장', text: '벚꽃이 피었다. 다들 카메라를 꺼내 들고 사진을 찍었지만, 나는 그냥 서서 바라만 봤다. 꽃이 지는 속도를 눈에 담아두고 싶었다. 아름다운 것은 항상 빠르게 지나간다. 그래서 더 아름답다.', image: null },
    // ── 12p: 사진 전용 ──
    { date: '2025-04-06', title: '벚꽃 터널', text: '', image: PLACEHOLDER('essay-cherry') },
    // ── 13p: 텍스트 전용 ──
    { date: '2025-06-10', title: '편의점 도시락', text: '편의점 앞 파란색 의자에 앉아 먹는 도시락. 누군가에게는 초라해 보일지 모르지만, 나에게는 하루의 가장 솔직한 한 끼다. 잘난 척 없이, 꾸밈 없이. 이 순간만큼은 내가 나다운 것 같다.', image: null },
    // ── 14p: 사진 전용 ──
    { date: '2025-06-11', title: '여름 거리', text: '', image: PLACEHOLDER('essay-summer-street') },
    // ── 15p: 텍스트 전용 ──
    { date: '2025-08-15', title: '열대야', text: '잠이 오지 않는 여름밤. 에어컨 소리만 가득한 방에서 뒤척이다 일어났다. 베란다에 나가 밤하늘을 올려다봤다. 별은 없었다. 하지만 이 무더운 밤을 나 혼자 견디고 있다는 사실이, 이상하게도 위로가 됐다.', image: null },
    // ── 16p: 사진 전용 ──
    { date: '2025-08-16', title: '여름밤 도시', text: '', image: PLACEHOLDER('essay-night-city') },
    // ── 17p: 텍스트 전용 ──
    { date: '2025-10-01', title: '가을 은행나무', text: '노란 은행잎이 발밑에서 바스락거린다. 1년 중 가장 아름다운 2주. 이 짧은 황금빛 계절을 놓치지 않으려고, 나는 매일 같은 길로 출근한다. 은행나무 아래 서면 시간이 느려지는 것 같다.', image: null },
    // ── 18p: 사진 전용 ──
    { date: '2025-10-02', title: '은행나무 가로수', text: '', image: PLACEHOLDER('essay-ginkgo') },
    // ── 19p: 텍스트 전용 ──
    { date: '2025-11-11', title: '첫 눈 예보', text: '오늘 첫 눈이 예보됐다. 아침부터 하늘을 올려다보는 횟수가 늘었다. 어른이 되어서도 눈에 설레는 건 변하지 않는다. 첫 눈이 내리면 무언가 소원을 빌어야 할 것 같은, 그 이유 모를 설렘.', image: null },
    // ── 20p: 사진 전용 ──
    { date: '2025-11-12', title: '첫 눈', text: '', image: PLACEHOLDER('essay-firstsnow') },
    // ── 21p: 텍스트 전용 ──
    { date: '2025-12-01', title: '잠들기 전의 시간', text: '하루의 끝, 불을 끄고 누워 천장을 바라본다. 오늘 하루도 무사히 지나갔다. 별것 아닌 하루가 모여 내 삶이 되어간다. 그것만으로도 충분하다. 내일도 이렇게 하루를 마무리할 수 있으면 좋겠다.', image: null },
    // ── 22p: 사진 전용 ──
    { date: '2025-12-02', title: '겨울 침묵', text: '', image: PLACEHOLDER('essay-winter-silence') },
    // ── 23p: 텍스트 전용 (에필로그) ──
    { date: '2025-12-31', title: '마지막 페이지를 넘기며', text: '이 에세이를 읽는 당신에게. 당신의 일상에도 이런 온도가 있기를 바랍니다. 크게 뜨겁지도, 차갑지도 않은. 적당히 따뜻한, 그 온도. 살아있다는 건 그 온도를 느끼는 것이니까요.', image: null },
    // ── 24p: 사진 전용 (마지막 풍경) ──
    { date: '2025-12-31', title: '한 해의 끝',  text: '', image: PLACEHOLDER('essay-year-end') },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. 반려동물 성장 앨범 — 뽀삐의 1년
//    1~12p: 감성 캡션 텍스트 + 사진    → TPL_WITH_PHOTO
//   13~24p: text: "" (Full-bleed 사진)  → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const petDummy = {
  meta: {
    petName:      '뽀삐',
    petType:      '강아지',
    petBreed:     '말티즈',
    adoptDate:    '2024-06-01',
    ownerMessage: '뽀삐야, 네가 우리 가족이 된 그날부터 집이 달라졌어. 매일 꼬리 흔드는 너 덕분에 나도 같이 행복해진단다. 사랑해.',
  },
  frontCover: { image: PLACEHOLDER('pet-cover-front'), title: '뽀삐의 1년' },
  backCover:  { image: PLACEHOLDER('pet-cover-back') },
  pages: [
    // ── 1~12p: 텍스트 있는 페이지 ──
    { date: '2024-06-01', title: '우리 집에 온 날', text: '오늘 뽀삐가 우리 가족이 됐어요! 작은 박스 안에서 올려다보던 그 눈빛. 무서운 건지 신기한 건지 모를 표정으로 집 안을 두리번거리다가, 소파 밑으로 쏙 들어가더니 나오질 않았어요. 괜찮아, 천천히 적응하자.', image: PLACEHOLDER('pet-adopt-day') },
    { date: '2024-06-15', title: '첫 산책', text: '리드줄을 처음 채우던 날. 낯선 느낌에 계속 돌아봤지만 냄새를 맡기 시작하더니 어느새 코를 바닥에 바짝 붙이고 탐색 삼매경. 풀 냄새, 흙 냄새, 낯선 개 냄새. 세상 모든 것이 흥미로운 뽀삐였어요.', image: PLACEHOLDER('pet-first-walk') },
    { date: '2024-07-04', title: '목욕의 굴욕', text: '첫 목욕은 전쟁이었어요. 욕조에 넣자마자 탈출을 시도하더니 온 욕실에 물을 튀겼어요. 결국 나도 같이 젖었고, 뽀삐는 드라이 내내 삐진 얼굴로 있었답니다. 목욕 끝에 간식을 줬더니 그제야 꼬리가 올라갔어요.', image: PLACEHOLDER('pet-bath') },
    { date: '2024-08-10', title: '수영 데뷔', text: '여름에 소형 수영장을 샀어요. 처음엔 발을 담그는 것조차 거부하더니, 간식 하나로 설득하자 조심스럽게 앞발을 넣었어요. 그러더니 철벅철벅! 수영을 즐기는 뽀삐를 발견했어요.', image: PLACEHOLDER('pet-swim') },
    { date: '2024-09-15', title: '가을 코스모스', text: '코스모스가 핀 공원에서 산책했어요. 바람에 흔들리는 꽃들 사이에서 뽀삐의 귀도 같이 펄럭거렸어요. 그 모습이 너무 귀여워서 한참을 웃었답니다. 가을이 뽀삐에게 잘 어울려요.', image: PLACEHOLDER('pet-cosmos') },
    { date: '2024-10-31', title: '할로윈 코스튬', text: '호박 모양 옷을 입은 뽀삐! 처음에는 옷이 불편한지 계속 한쪽 발을 들고 있었지만, 간식을 주자 달려왔어요. 세상에서 제일 귀여운 호박이 등장했습니다.', image: PLACEHOLDER('pet-halloween') },
    { date: '2024-11-20', title: '첫 미용', text: '동글동글 곰돌이 컷으로 변신! 미용실에서 데려온 뽀삐를 보고 잠깐 누구냐고 했어요. 완전히 새로운 강아지 같은데 눈빛만은 우리 뽀삐가 맞았어요.', image: PLACEHOLDER('pet-grooming') },
    { date: '2024-12-25', title: '첫 크리스마스', text: '산타 모자를 씌우자 뽀삐가 벗으려고 계속 앞발로 머리를 긁었어요. 그 모습이 너무 웃겨서 사진 찍는 내내 웃음이 멈추질 않았답니다. 장난감 선물을 받고는 밤새 물어뜯었어요.', image: PLACEHOLDER('pet-xmas') },
    { date: '2025-01-01', title: '새해 첫 날', text: '새해 아침 뽀삐가 침대 위로 올라와 얼굴을 핥아줬어요. "새해 복 많이 받으세요!" 인사를 이렇게 받는 사람이 얼마나 될까요. 올해도 같이 건강하게 보내자, 뽀삐야.', image: PLACEHOLDER('pet-newyear') },
    { date: '2025-03-15', title: '봄 벚꽃 산책', text: '벚꽃이 핀 길을 뽀삐와 걸었어요. 분홍빛 꽃잎이 떨어질 때마다 점프해서 잡으려는 뽀삐. 잡히지 않는 꽃잎에 당황한 표정이 너무 귀여웠어요.', image: PLACEHOLDER('pet-spring-walk') },
    { date: '2025-05-01', title: '강아지 운동회', text: '근처 공원에서 열린 강아지 운동회에 참가했어요! 뽀삐는 달리기에서 꼴찌를 했지만 응원을 가장 많이 받았답니다. 내년에는 더 열심히 연습하자.', image: PLACEHOLDER('pet-sports-day') },
    { date: '2025-06-01', title: '입양 1주년', text: '뽀삐와 함께한 지 딱 1년이 됐어요. 작은 케이크를 만들어 생일처럼 축하했어요. 뽀삐는 케이크보다 포장지에 더 관심이 있었지만. 앞으로도 오래오래 함께하자, 우리 막내.', image: PLACEHOLDER('pet-anniversary') },
    // ── 13~24p: text: "" Full-bleed 사진 ──
    { date: '2024-06-05', title: '낮잠 중인 뽀삐',    text: '', image: PLACEHOLDER('pet-nap') },
    { date: '2024-06-20', title: '장난감과 뽀삐',      text: '', image: PLACEHOLDER('pet-toy') },
    { date: '2024-07-20', title: '더위 먹은 뽀삐',     text: '', image: PLACEHOLDER('pet-summer') },
    { date: '2024-08-25', title: '음식 앞에서',        text: '', image: PLACEHOLDER('pet-food') },
    { date: '2024-09-05', title: '소파 위 뽀삐',      text: '', image: PLACEHOLDER('pet-sofa') },
    { date: '2024-10-10', title: '이불 속 뽀삐',      text: '', image: PLACEHOLDER('pet-blanket') },
    { date: '2024-11-05', title: '낙엽 밟기',         text: '', image: PLACEHOLDER('pet-leaves') },
    { date: '2024-12-10', title: '겨울 산책',         text: '', image: PLACEHOLDER('pet-winter') },
    { date: '2025-02-14', title: '발렌타인',          text: '', image: PLACEHOLDER('pet-valentine') },
    { date: '2025-03-01', title: '봄을 맞이하며',     text: '', image: PLACEHOLDER('pet-spring') },
    { date: '2025-04-20', title: '공원의 오후',       text: '', image: PLACEHOLDER('pet-park') },
    { date: '2025-06-01', title: '1주년 기념',        text: '', image: PLACEHOLDER('pet-1year') },
  ],
};

// ─── 서비스 타입 → 더미 데이터 매핑 ──────────────────────────────────────────
export const DUMMY_DATA = {
  baby:         babyDummy,
  kindergarten: kindergartenDummy,
  fairytale:    fairytaleDummy,
  travel:       travelDummy,
  selfpublish:  selfpublishDummy,
  pet:          petDummy,
};
