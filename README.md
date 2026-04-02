# 📚 북메이커 BookMaker

> Book Print API를 활용한 맞춤형 포토북 제작 플랫폼

**나만의 특별한 책을 손쉽게 만들어 보세요.**  
육아 일기, 여행 포토북, AI 동화책, 유치원 알림장, 1인 출판, 반려동물 앨범까지 — 6가지 서비스 중 원하는 유형을 선택하고, 사진과 텍스트를 입력하면 Book Print API를 통해 실제 인쇄 가능한 포토북이 만들어집니다.

---

## 1. 서비스 소개

### 한 문장 설명
다양한 주제(육아, 여행, 동화, 졸업앨범 등)의 포토북을 간편한 스텝 UI로 구성하고, SweetBook Book Print API를 통해 책 생성부터 주문까지 한 번에 처리하는 웹 애플리케이션입니다.

### 타겟 고객
- 아이의 성장 기록을 책으로 남기고 싶은 **부모**
- 한 학기 알림장을 졸업 앨범으로 만들고 싶은 **유치원 / 어린이집**
- 여행 사진을 멋진 포토북으로 정리하고 싶은 **여행자**
- 자신만의 에세이, 시집, 사진집을 출판하고 싶은 **1인 창작자**
- 반려동물의 성장을 기록하고 싶은 **반려인**

### 주요 기능
- **6가지 서비스 유형 선택**: 육아일기 포토북, 유치원 알림장 책, AI 동화책, 여행 포토북, 1인 출판, 반려동물 성장 앨범
- **서비스별 맞춤 입력 폼**: 각 서비스 유형에 최적화된 정보 입력 필드
- **콘텐츠 에디터**: 페이지 추가/삭제/순서변경, 텍스트·이미지 편집, 실시간 미리보기
- **다중 이미지 Drag & Drop 업로드 + 갤러리 UI**: 여러 사진을 한 번에 업로드하고 썸네일 그리드로 확인 (구현 예정)
- **표지 직접 지정**: 갤러리에서 썸네일을 클릭해 앞표지·뒤표지를 사용자가 직접 선택 — 자동 지정 없음 (구현 예정)
- **템플릿 동적 분기**: 텍스트 입력 여부에 따라 스위트북 템플릿 자동 선택 (텍스트 있음 → 사진+텍스트형, 없음 → 이미지 전용) (구현 예정)
- **가로형 사진 양면(Spread) 분할**: Canvas API로 가로 사진을 좌/우 2장으로 분할 → 양면 페이지로 전송 (구현 예정)
- **내지 사진 업로드**: 각 페이지 편집 영역 내 Drag & Drop 또는 파일 선택
- **AI 동화책 생성**: 입력 폼에서 Gemini AI가 동화 10페이지 자동 생성 (AI 동화책 서비스 전용)
- **토스트 알림**: 모든 작업 성공/실패 시 우하단 토스트 표시 (3.5초 자동 소멸)
- **에러 재시도**: API 5xx 오류 시 최대 3회 자동 재시도 (지수 백오프)
- **판형 선택**: 정방형 하드커버(243×248mm), A4 소프트커버, A5 소프트커버 등 API 실시간 조회 후 선택 (서비스별 추천 판형 자동 표시)
- **더미 데이터 자동 채우기**: 테스트용 샘플 데이터로 즉시 체험 가능
- **API 호출 로그**: 책 생성 → 표지/내지 사진 업로드 → 앞표지 → 내지 → 뒤표지 → 최종화 과정을 실시간 로그로 확인
- **블러 미리보기**: 상위 5페이지만 공개, 나머지는 블러 처리 → 구매 유도 오버레이
- **가격 견적 조회**: 주문 전 예상 금액 확인 (상품금액 + 배송비 + 포장비)
- **주문 생성 & 관리**: 배송지 입력 → 주문 → 주문 내역 조회 → 주문 취소

---

## 2. 실행 방법

### 사전 준비
- **Node.js** 18.0 이상
- **npm** 9.0 이상
- **SweetBook Sandbox API Key** ([api.sweetbook.com](https://api.sweetbook.com)에서 발급)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/YOUR_USERNAME/bookmaker.git
cd bookmaker

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env 파일을 열고 API Key를 입력하세요:
#   SWEETBOOK_API_KEY=your_sandbox_api_key_here
#   SWEETBOOK_API_BASE_URL=https://api-sandbox.sweetbook.com/v1
#   GEMINI_API_KEY=your_gemini_api_key_here  ← AI 동화 생성 기능에 필요 (https://aistudio.google.com 무료 발급)

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하면 서비스를 확인할 수 있습니다.

### 빠른 테스트 순서
1. 메인 페이지에서 원하는 서비스 선택 (예: 여행 포토북)
2. **"더미 데이터 채우기"** 버튼 클릭 → 샘플 데이터 자동 입력
3. 에디터 좌측 **"📖 표지 이미지"** 에서 앞표지·뒤표지 이미지 업로드 (선택)
4. **"📸 사진 일괄 업로드"** 로 내지 사진 한번에 배정 (선택)
5. 에디터에서 페이지 내용 확인 후 **"📗 책 생성 & 최종화"** 클릭
6. API 로그에서 앞표지→내지→뒤표지→최종화 과정 확인
7. **"다음: 미리보기 & 주문"** → 가격 확인
8. **"다음: 주문하기"** → 더미 배송지 채우기 → **"📦 주문하기"**
9. 주문 완료! **"주문 내역 보기"**에서 확인

---

## 3. 사용한 API 목록

| API | 메서드 | 엔드포인트 | 용도 |
|-----|--------|-----------|------|
| Books | `POST` | `/v1/books` | 새 책 생성 (draft 상태) |
| Books | `GET` | `/v1/books` | 책 목록 조회 |
| Books | `POST` | `/v1/books/{bookUid}/photos` | 사용자 사진 업로드 (multipart) |
| Books | `GET` | `/v1/books/{bookUid}/photos` | 업로드된 사진 목록 조회 |
| Books | `POST` | `/v1/books/{bookUid}/cover` | 표지 추가 (템플릿 + 파라미터) |
| Books | `POST` | `/v1/books/{bookUid}/contents` | 내지 페이지 추가 (반복 호출) |
| Books | `POST` | `/v1/books/{bookUid}/finalization` | 책 최종화 (편집 완료) |
| Orders | `POST` | `/v1/orders` | 주문 생성 (충전금 차감) |
| Orders | `POST` | `/v1/orders/estimate` | 주문 전 가격 견적 조회 |
| Orders | `GET` | `/v1/orders` | 주문 목록 조회 |
| Orders | `GET` | `/v1/orders/{orderUid}` | 주문 상세 조회 |
| Orders | `POST` | `/v1/orders/{orderUid}/cancel` | 주문 취소 (PAID 상태일 때) |
| Templates | `GET` | `/v1/templates` | 템플릿 목록 조회 |
| BookSpecs | `GET` | `/v1/book-specs` | 판형 목록 조회 |
| Credits | `GET` | `/v1/credits` | 충전금 잔액 조회 |

---

## 4. AI 도구 사용 내역

| AI 도구 | 활용 내용 |
|---------|----------|
| Claude (Anthropic) | 전체 프로젝트 아키텍처 설계, 프론트엔드/백엔드 코드 작성, API 연동 로직 구현 |
| Claude (Anthropic) | API 문서 분석 및 워크플로우 설계 |
| Claude (Anthropic) | 더미 데이터 생성 (6가지 서비스 유형별 10~12개 샘플 페이지) |
| Claude (Anthropic) | README.md 작성 |
| Gemini (Google) | AI 페이지 초안 생성 기능 — 에디터 내 서비스별 10페이지 콘텐츠 자동 생성 |
| Gemini (Google) | 모델 404 에러 해결 — `gemini-1.5-flash` 계열이 v1beta API에서 미지원임을 ListModels API로 확인, `gemini-flash-lite-latest` → `gemini-2.5-flash` 순으로 대체 |
| Gemini (Google) | 429 할당량 초과 에러 해결 — 모델 순차 폴백(gemini-flash-lite-latest → 2.5-flash → 2.5-pro) + 시도 간 1초 delay + 로컬 템플릿 폴백 구현 |
| Gemini (Google) | 6개 서비스 타입별 한국어 프롬프트 작성 및 JSON 스키마 응답 파싱 |

---

## 5. 설계 의도

### 왜 이 서비스를 선택했는지

Book Print API의 핵심 가치는 **"콘텐츠를 책으로 만드는 것"**입니다. 하지만 최종 고객(일반 사용자)에게 API를 직접 노출하는 것은 현실적이지 않습니다. 그래서 **다양한 사용 시나리오를 하나의 플랫폼에 모아**, 각 시나리오에 맞는 UX를 제공하는 "올인원 북 메이커"를 설계했습니다.

6가지 서비스 유형은 실제 포토북 시장에서 수요가 큰 카테고리를 기반으로 선정했습니다:
- **육아/반려동물**: 감정적 가치가 높아 재주문률이 높음
- **여행/졸업앨범**: 이벤트 기반으로 시즌 수요가 명확함
- **1인 출판/AI 동화**: 창작자 시장의 성장세와 AI 트렌드를 반영

### 비즈니스 가능성

- **SaaS 모델**: 월정액으로 일정 권수 무료 → 초과분 과금
- **B2B2C 파트너십**: 유치원, 어린이집, 여행사, 동물병원 등과 제휴하여 화이트라벨 서비스 제공
- **AI 기능 확장**: AI 동화책을 시작으로, AI 자서전, AI 레시피북 등 자동 콘텐츠 생성 서비스로 확장

### 더 시간이 있었다면 추가했을 기능

- **이미지 파일 직접 업로드**: 현재 URL 방식만 지원 → Drag & Drop 업로드 + Photos API 연동
- **실시간 페이지 미리보기**: 템플릿 레이아웃을 프론트엔드에서 시각적으로 렌더링
- **AI 자동 구성**: 사진만 올리면 AI가 날짜/장소 분석하여 자동으로 포토북 구성
- **템플릿 선택 UI**: GET /templates로 가져온 템플릿을 시각적으로 탐색·선택
- **웹훅 연동**: 주문 상태 변경 시 실시간 알림 (SSE/WebSocket)
- **사용자 인증**: NextAuth 등으로 사용자별 책/주문 관리
- **결제 연동**: Sandbox → Live 전환 시 실제 PG 결제 플로우

---

## 6. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 프론트엔드 | React 18, Tailwind CSS |
| 백엔드 | Next.js API Routes (서버리스) |
| API 클라이언트 | bookprintapi-nodejs-sdk (공식 SDK) |
| API 연동 | SweetBook Book Print API (Sandbox) |
| 파일 업로드 | HTML5 File API + Drag & Drop + FormData |
| AI 생성 | Google Gemini 2.0 Flash (@google/generative-ai) |

### 프로젝트 구조

```
bookmaker/
├── src/
│   ├── app/
│   │   ├── page.jsx                          # 메인 — 서비스 선택
│   │   ├── layout.jsx                        # 루트 레이아웃
│   │   ├── globals.css                       # 글로벌 스타일
│   │   ├── create/[serviceType]/page.jsx     # 서비스별 정보 입력
│   │   ├── editor/page.jsx                   # 콘텐츠 에디터
│   │   ├── preview/page.jsx                  # 미리보기 & 가격 확인
│   │   ├── order/page.jsx                    # 주문 (배송지 입력)
│   │   ├── orders/page.jsx                   # 주문 내역
│   │   └── api/                              # 백엔드 API 라우트
│   │       ├── books/route.js                #   POST /api/books, GET /api/books
│   │       ├── books/[bookUid]/cover/        #   POST 표지 추가
│   │       ├── books/[bookUid]/contents/     #   POST 내지 추가
│   │       ├── books/[bookUid]/finalize/     #   POST 최종화
│   │       ├── books/[bookUid]/photos/       #   POST 사진업로드, GET 목록
│   │       ├── orders/route.js               #   POST 주문생성, GET 목록
│   │       ├── orders/estimate/              #   POST 가격견적
│   │       ├── orders/[orderUid]/            #   GET 상세, DELETE 취소
│   │       ├── templates/                    #   GET 템플릿 목록
│   │       ├── book-specs/                   #   GET 판형 목록
│   │       └── credits/                      #   GET 충전금 잔액
│   ├── components/
│   │   ├── Header.jsx                        # 공통 헤더/네비게이션
│   │   ├── ServiceCard.jsx                   # 서비스 선택 카드
│   │   └── StepIndicator.jsx                 # 진행 단계 인디케이터
│   ├── lib/
│   │   ├── sweetbook.js                      # SweetBook API 클라이언트 (서버 전용)
│   │   └── constants.js                      # 서비스 타입, 판형, 상태 상수
│   └── data/
│       └── dummy.js                          # 6가지 서비스별 더미 데이터
├── .env.example                              # 환경변수 예시
├── .gitignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
└── README.md
```

---

## 7. 보안

- API Key는 **서버 측(API Routes)에서만** 사용되며 클라이언트에 노출되지 않습니다
- `.env` 파일은 `.gitignore`에 등록되어 커밋되지 않습니다
- `.env.example`에는 실제 키 값이 포함되지 않습니다
