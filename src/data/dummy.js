// ─── 더미 이미지 URL (Unsplash placeholder) ─────────────────
// 실제 Sandbox 환경에서는 이미지 URL을 직접 제공하거나 파일 업로드를 사용합니다.

const PLACEHOLDER = (w, h, text) =>
  `https://placehold.co/${w}x${h}/F5E6D3/7A5230?text=${encodeURIComponent(text)}`;

// ─── 육아 일기 포토북 더미 데이터 ─────────────────────────────
export const babyDummy = {
  meta: { babyName: '하은이', birthDate: '2025-01-15', period: '6개월', message: '사랑하는 하은아, 건강하게 자라줘서 고마워 ♥' },
  pages: [
    { date: '2025-01-15', title: '하은이가 태어난 날', text: '오늘 우리 가족에 작은 천사가 찾아왔어요. 3.2kg의 건강한 아기, 하은이를 만났습니다.', image: PLACEHOLDER(600, 600, '탄생') },
    { date: '2025-02-01', title: '첫 미소', text: '오늘 하은이가 처음으로 웃었어요! 세상에서 가장 아름다운 미소였습니다.', image: PLACEHOLDER(600, 600, '미소') },
    { date: '2025-02-14', title: '첫 목욕', text: '따뜻한 물에 들어가니 신기한 표정을 지었어요. 물장구도 치고 귀여웠습니다.', image: PLACEHOLDER(600, 600, '목욕') },
    { date: '2025-03-01', title: '100일 잔치', text: '가족들이 모여서 하은이의 100일을 축하했어요. 떡과 케이크를 준비했습니다.', image: PLACEHOLDER(600, 600, '100일') },
    { date: '2025-03-15', title: '뒤집기 성공!', text: '오늘 하은이가 처음으로 뒤집기에 성공했어요! 스스로 해내서 너무 대견해요.', image: PLACEHOLDER(600, 600, '뒤집기') },
    { date: '2025-04-01', title: '이유식 시작', text: '오늘부터 이유식을 시작했어요. 쌀미음을 한 숟가락 먹었는데 맛있었나봐요!', image: PLACEHOLDER(600, 600, '이유식') },
    { date: '2025-04-20', title: '첫 외출', text: '날씨가 좋아서 가족 나들이를 갔어요. 유모차에서 바깥 구경하며 신기해했어요.', image: PLACEHOLDER(600, 600, '외출') },
    { date: '2025-05-05', title: '어린이날', text: '첫 어린이날! 아직 무슨 날인지 모르겠지만 선물 많이 받았어요.', image: PLACEHOLDER(600, 600, '어린이날') },
    { date: '2025-05-20', title: '옹알이 시작', text: '하은이가 "아~", "우~" 소리를 내기 시작했어요. 말하려는 건지 노래하는 건지!', image: PLACEHOLDER(600, 600, '옹알이') },
    { date: '2025-06-01', title: '앉기 연습', text: '혼자 앉으려고 열심히 노력하는 하은이. 쿵쿵 넘어져도 다시 도전합니다.', image: PLACEHOLDER(600, 600, '앉기') },
    { date: '2025-06-15', title: '첫 이가 났어요', text: '아래 앞니 두 개가 살짝 보이기 시작했어요. 그래서 요즘 좀 보채나봐요.', image: PLACEHOLDER(600, 600, '이빨') },
    { date: '2025-07-01', title: '6개월 기념', text: '벌써 반 년이나 지났어요. 하루하루 다르게 자라는 하은이가 너무 신기해요.', image: PLACEHOLDER(600, 600, '6개월') },
  ],
};

// ─── 유치원 알림장 책 더미 데이터 ─────────────────────────────
export const kindergartenDummy = {
  meta: { childName: '김서준', className: '해바라기반', year: '2025', semester: '1학기', teacherName: '박선생님' },
  pages: [
    { date: '2025-03-03', dayOfWeek: '월요일', teacherComment: '첫날이라 긴장했지만 잘 적응하고 있어요. 점심도 잘 먹었습니다!', parentComment: '서준이가 유치원 이야기를 많이 해줘서 기뻐요.', image: PLACEHOLDER(600, 600, '입학') },
    { date: '2025-03-10', dayOfWeek: '월요일', teacherComment: '친구들과 블록 놀이를 하며 즐겁게 지냈어요. 양보하는 모습이 예뻤습니다.', parentComment: '집에서도 블록 놀이를 좋아해요!', image: PLACEHOLDER(600, 600, '블록놀이') },
    { date: '2025-03-20', dayOfWeek: '목요일', teacherComment: '봄꽃 그리기 수업에서 튤립을 아주 예쁘게 그렸어요!', parentComment: '그림 솜씨가 늘었네요. 감사합니다!', image: PLACEHOLDER(600, 600, '그림그리기') },
    { date: '2025-04-05', dayOfWeek: '토요일', teacherComment: '소풍 가서 즐겁게 놀았어요. 김밥을 맛있게 먹었습니다.', parentComment: '소풍 준비하느라 설레했어요!', image: PLACEHOLDER(600, 600, '소풍') },
    { date: '2025-04-15', dayOfWeek: '화요일', teacherComment: '동물 흉내내기 놀이에서 사자 역할을 맡았어요. 아주 용감했습니다!', parentComment: '요즘 동물에 관심이 많아요.', image: PLACEHOLDER(600, 600, '역할놀이') },
    { date: '2025-05-01', dayOfWeek: '목요일', teacherComment: '카네이션 만들기 수업! 엄마아빠 드릴 거라며 정성껏 만들었어요.', parentComment: '카네이션 받고 감동했습니다 ㅠㅠ', image: PLACEHOLDER(600, 600, '카네이션') },
    { date: '2025-05-15', dayOfWeek: '목요일', teacherComment: '체육 시간에 달리기를 잘했어요. 친구들을 응원하는 모습도 좋았습니다.', parentComment: '운동 좋아하는 서준이!', image: PLACEHOLDER(600, 600, '체육') },
    { date: '2025-06-01', dayOfWeek: '일요일', teacherComment: '물감 놀이를 하며 무지개를 그렸어요. 색감이 아주 좋습니다!', parentComment: '옷에 물감이 묻어왔지만 행복해 보여서 다행이에요 ㅎㅎ', image: PLACEHOLDER(600, 600, '물감놀이') },
    { date: '2025-06-20', dayOfWeek: '금요일', teacherComment: '발표 시간에 자기 꿈을 멋지게 이야기했어요. "과학자가 되고 싶어요"라고!', parentComment: '꿈이 생겼다니 기특해요.', image: PLACEHOLDER(600, 600, '발표') },
    { date: '2025-07-01', dayOfWeek: '화요일', teacherComment: '한 학기 수료식! 많이 성장한 서준이에게 박수를 보냅니다.', parentComment: '선생님 감사합니다. 행복한 한 학기였습니다.', image: PLACEHOLDER(600, 600, '수료식') },
  ],
};

// ─── AI 동화책 더미 데이터 ────────────────────────────────────
export const fairytaleDummy = {
  meta: { heroName: '하은이', heroAge: '5살', theme: '숲속 친구들', moralLesson: '우정과 나눔' },
  pages: [
    { title: '숲속의 아침', text: '어느 맑은 아침, 하은이는 집 뒤에 있는 커다란 숲으로 산책을 나갔어요. 새들이 노래하고 나비들이 춤을 추었답니다.', image: PLACEHOLDER(600, 600, '숲속+아침') },
    { title: '토끼 친구를 만나다', text: '"안녕! 나는 토비야." 풀숲에서 하얀 토끼 한 마리가 나타났어요. 하은이와 토비는 금방 친구가 되었답니다.', image: PLACEHOLDER(600, 600, '토끼+친구') },
    { title: '다람쥐의 부탁', text: '길을 가다 울고 있는 다람쥐를 만났어요. "도토리를 잃어버렸어..." 하은이는 함께 찾아주기로 했어요.', image: PLACEHOLDER(600, 600, '다람쥐') },
    { title: '함께 찾아요', text: '하은이와 토비, 그리고 다람쥐는 힘을 합쳐 숲 곳곳을 뒤졌어요. 나뭇잎 아래, 바위 틈새를 살펴보았답니다.', image: PLACEHOLDER(600, 600, '탐색') },
    { title: '작은 냇가에서', text: '냇가에 도착하자 반짝이는 무언가가 보였어요! 도토리는 냇가 옆 바위 위에 있었답니다.', image: PLACEHOLDER(600, 600, '냇가') },
    { title: '함께 나누는 기쁨', text: '"고마워, 하은아!" 다람쥐가 기뻐하며 도토리 하나를 하은이에게 선물했어요.', image: PLACEHOLDER(600, 600, '선물') },
    { title: '숲속 파티', text: '모든 숲속 친구들이 모여서 작은 파티를 열었어요. 하은이 덕분에 모두가 행복한 하루였답니다.', image: PLACEHOLDER(600, 600, '파티') },
    { title: '약속', text: '"우리 매일 만나자!" 하은이와 친구들은 손가락 걸고 약속했어요. 내일도, 모레도 함께!', image: PLACEHOLDER(600, 600, '약속') },
    { title: '집으로 가는 길', text: '해가 지고 하은이는 집으로 돌아갔어요. 마음속에는 따뜻한 우정이 가득했답니다.', image: PLACEHOLDER(600, 600, '노을') },
    { title: '다시 만날 그날까지', text: '하은이는 침대에 누워 오늘의 모험을 떠올렸어요. 내일은 또 어떤 친구를 만날까? 달콤한 꿈 속으로...', image: PLACEHOLDER(600, 600, '잠자리') },
  ],
};

// ─── 여행 포토북 더미 데이터 ──────────────────────────────────
export const travelDummy = {
  meta: { tripName: '2025 제주도 가족 여행', destination: '제주도', startDate: '2025-05-01', endDate: '2025-05-04', companions: '가족' },
  pages: [
    { date: '2025-05-01', location: '제주공항', text: '드디어 제주도 도착! 맑은 하늘과 따뜻한 바람이 우리를 반겨줬어요.', image: PLACEHOLDER(600, 600, '제주공항') },
    { date: '2025-05-01', location: '용두암', text: '첫 번째 방문지, 용두암! 용이 하늘로 올라가는 모양의 바위가 인상적이었어요.', image: PLACEHOLDER(600, 600, '용두암') },
    { date: '2025-05-01', location: '흑돼지 거리', text: '저녁은 제주 흑돼지! 지글지글 구워먹는 삼겹살이 정말 맛있었습니다.', image: PLACEHOLDER(600, 600, '흑돼지') },
    { date: '2025-05-02', location: '성산일출봉', text: '이른 아침에 성산일출봉을 올랐어요. 정상에서 바라본 풍경이 장관이었습니다!', image: PLACEHOLDER(600, 600, '일출봉') },
    { date: '2025-05-02', location: '섭지코지', text: '섭지코지의 해안 절벽을 따라 걸으며 아름다운 바다를 감상했어요.', image: PLACEHOLDER(600, 600, '섭지코지') },
    { date: '2025-05-02', location: '카페', text: '귤밭 옆 귀여운 카페에서 당근 케이크와 커피 한 잔의 여유를 즐겼어요.', image: PLACEHOLDER(600, 600, '카페') },
    { date: '2025-05-03', location: '한라산', text: '한라산 영실코스에 도전! 힘들었지만 가족과 함께여서 즐거웠습니다.', image: PLACEHOLDER(600, 600, '한라산') },
    { date: '2025-05-03', location: '중문해수욕장', text: '하산 후 중문해수욕장에서 발을 담갔어요. 시원한 바닷물에 피로가 싹~', image: PLACEHOLDER(600, 600, '해수욕장') },
    { date: '2025-05-04', location: '동문시장', text: '마지막 날 아침, 동문시장에서 제주 특산물 쇼핑! 감귤초콜릿을 샀어요.', image: PLACEHOLDER(600, 600, '시장') },
    { date: '2025-05-04', location: '공항', text: '아쉽지만 다음을 기약하며... 안녕 제주도! 곧 다시 올게요.', image: PLACEHOLDER(600, 600, '안녕제주') },
  ],
};

// ─── 1인 출판 더미 데이터 ─────────────────────────────────────
export const selfpublishDummy = {
  meta: { bookTitle: '일상의 조각들', authorName: '김민수', genre: '에세이', bookDescription: '바쁜 일상 속에서 발견한 작은 행복들에 대한 에세이 모음집입니다.' },
  pages: [
    { title: '아침의 의식', text: '매일 같은 시간에 울리는 알람 소리. 하지만 오늘 아침은 조금 달랐다. 창밖으로 들어오는 햇살이 유난히 따뜻했다. 커피 한 잔을 내리며 하루를 시작하는 이 작은 의식이, 사실은 나에게 가장 소중한 시간이다.', image: PLACEHOLDER(600, 600, '아침') },
    { title: '비 오는 날의 산책', text: '우산을 쓰고 걷는 길. 빗소리가 만들어내는 리듬에 발걸음을 맞춘다. 웅덩이에 비친 가로등 불빛이 수채화처럼 번진다. 비 오는 날은 세상이 조금 더 부드러워지는 것 같다.', image: PLACEHOLDER(600, 600, '비') },
    { title: '오래된 책방', text: '골목 안쪽, 낡은 간판의 헌책방. 종이 냄새가 코끝에 닿는 순간, 시간이 멈춘 듯한 기분이 든다. 누군가의 밑줄 그은 문장에서 낯선 위로를 받는다.', image: PLACEHOLDER(600, 600, '책방') },
    { title: '할머니의 된장찌개', text: '어떤 음식도 할머니의 된장찌개를 따라올 수 없다. 레시피가 아니라 기억의 맛이기 때문이다. 어린 시절, 할머니 집 마루에 앉아 먹던 그 맛을 나는 아직도 찾고 있다.', image: PLACEHOLDER(600, 600, '된장찌개') },
    { title: '새벽 버스', text: '텅 빈 새벽 버스에 앉아 있으면, 세상은 나만을 위해 조용해진 것 같다. 창밖으로 스쳐 지나가는 가로등 불빛들이 하나의 이야기를 만들어낸다.', image: PLACEHOLDER(600, 600, '새벽버스') },
    { title: '편의점 도시락', text: '편의점 앞 파란색 의자에 앉아 먹는 도시락. 누군가에게는 초라해 보일지 모르지만, 나에게는 하루의 가장 솔직한 한 끼다.', image: PLACEHOLDER(600, 600, '도시락') },
    { title: '가을 은행나무', text: '노란 은행잎이 발밑에서 바스락거린다. 1년 중 가장 아름다운 2주. 이 짧은 황금빛 계절을 놓치지 않으려고, 나는 매일 같은 길로 출근한다.', image: PLACEHOLDER(600, 600, '은행나무') },
    { title: '잠들기 전의 시간', text: '하루의 끝, 불을 끄고 누워 천장을 바라본다. 오늘 하루도 무사히 지나갔다. 별것 아닌 하루가 모여 내 삶이 되어간다. 그것만으로도 충분하다.', image: PLACEHOLDER(600, 600, '밤') },
  ],
};

// ─── 반려동물 성장 앨범 더미 데이터 ───────────────────────────
export const petDummy = {
  meta: { petName: '뽀삐', petType: '강아지', petBreed: '말티즈', adoptDate: '2024-06-01', ownerMessage: '뽀삐야, 우리 가족이 되어줘서 고마워! 매일매일 행복해.' },
  pages: [
    { date: '2024-06-01', title: '우리 집에 온 날', text: '오늘 뽀삐가 우리 가족이 되었어요! 작고 하얀 솜뭉치 같은 아이. 새로운 집에 와서 조금 떨었지만, 금방 안정을 찾았어요.', image: PLACEHOLDER(600, 600, '입양') },
    { date: '2024-07-01', title: '첫 산책', text: '오늘 처음으로 밖에 나갔어요! 풀 냄새를 맡으며 꼬리를 살랑살랑. 세상이 신기한가 봐요.', image: PLACEHOLDER(600, 600, '산책') },
    { date: '2024-08-01', title: '수영을 배우다', text: '여름이라 작은 수영장을 사줬어요. 처음엔 무서워했지만 금방 적응해서 철벅철벅!', image: PLACEHOLDER(600, 600, '수영') },
    { date: '2024-09-01', title: '가을 나들이', text: '코스모스가 핀 공원에서 사진 찰칵! 가을 바람에 귀가 펄럭거려서 너무 귀여웠어요.', image: PLACEHOLDER(600, 600, '가을') },
    { date: '2024-10-01', title: '할로윈 코스튬', text: '호박 옷을 입은 뽀삐! 세상에서 가장 귀여운 호박이에요 🎃', image: PLACEHOLDER(600, 600, '할로윈') },
    { date: '2024-11-01', title: '첫 미용', text: '미용실에 다녀왔어요. 동글동글 곰돌이 컷으로 변신! 완전 새로운 강아지 같아요.', image: PLACEHOLDER(600, 600, '미용') },
    { date: '2024-12-01', title: '크리스마스', text: '산타 모자를 쓴 뽀삐에게 새 장난감을 선물했어요. 신나게 물어뜯는 중!', image: PLACEHOLDER(600, 600, '크리스마스') },
    { date: '2025-01-01', title: '새해 첫날', text: '새해에도 함께! 뽀삐와 함께하는 모든 날이 행복합니다.', image: PLACEHOLDER(600, 600, '새해') },
    { date: '2025-03-01', title: '봄이 왔어요', text: '벚꽃이 피었어요! 분홍빛 꽃잎 아래에서 산책하는 뽀삐. 봄이 가장 잘 어울리는 아이.', image: PLACEHOLDER(600, 600, '벚꽃') },
    { date: '2025-06-01', title: '1주년 기념', text: '뽀삐와 함께한 지 1년! 세상에서 가장 사랑스러운 우리 막내. 앞으로도 쭉 함께하자 ♥', image: PLACEHOLDER(600, 600, '1주년') },
  ],
};

// 서비스 타입 → 더미 데이터 매핑
export const DUMMY_DATA = {
  baby: babyDummy,
  kindergarten: kindergartenDummy,
  fairytale: fairytaleDummy,
  travel: travelDummy,
  selfpublish: selfpublishDummy,
  pet: petDummy,
};
