# CLAUDE.md — 북메이커(BookMaker) 프로젝트 지침서

> 이 파일은 Claude Code가 프로젝트를 이해하고 작업할 때 참조하는 마스터 지침서입니다.
> 모든 코드 수정, 기능 추가, 리팩토링 시 반드시 이 문서의 규칙을 따르세요.

---

## 1. 프로젝트 개요

### 서비스 설명
- **북메이커(BookMaker)**: SweetBook Book Print API를 활용한 맞춤형 포토북 제작 플랫폼
- 6가지 서비스 유형(육아일기, 유치원 알림장, AI 동화책, 여행 포토북, **감성 에세이**, 반려동물 앨범) 중 선택하여 책을 만들고 주문하는 웹앱
- `selfpublish` 서비스 키의 표시 이름: `1인 출판 플랫폼` → `감성 에세이` (2026-04-04 변경)
- **채용 과제**: (주)스위트북 '바이브코딩 풀스택 개발자' 포지션

### 과제 핵심 요구사항 (절대 위반 금지)
1. **Books API + Orders API 필수 사용** — 서비스 플로우 내에서 두 API 모두 호출
2. **백엔드 프록시** — 프론트엔드에서 api.sweetbook.com 직접 호출 절대 금지. 반드시 /api/* 라우트를 통해 통신
3. **API Key 보안** — 코드에 하드코딩 절대 금지. .env로만 관리. .env.example 필수 제공
4. **모노레포** — 프론트엔드 + 백엔드를 하나의 저장소로 구성
5. **더미 데이터** — 실행 즉시 콘텐츠가 꽉 차 보이도록 src/data/dummy.js에 샘플 데이터 포함 (24페이지 × 6개 서비스, 3종 템플릿 시나리오 완전 대응)

### 마감
- **2026년 4월 8일(화) 23:59** — GitHub Public 저장소 + 구글폼 제출

---

## 2. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 14.x |
| 프론트엔드 | React | 18.x |
| 스타일링 | Tailwind CSS | 3.x |
| API 클라이언트 | bookprintapi-nodejs-sdk | 1.x |
| 패키지 매니저 | npm | - |

### 사용하면 안 되는 것
- TypeScript (현재 JS로 구성, 추가하지 말 것)
- 외부 상태관리 라이브러리 (현재 sessionStorage 기반)
- DB (이 프로젝트는 DB 없이 API 중계 역할만 함)

---

## 3. 프로젝트 구조

```
bookmaker/
├── CLAUDE.md                <- 이 파일 (Claude Code 지침)
├── DECISION_LOG.md          <- 기술 의사결정 & 트러블슈팅 기록
├── README.md                <- 심사위원용 실행 가이드
├── .env.example             <- 환경변수 템플릿 (API Key 빈칸)
├── .env                     <- 실제 API Key (gitignore 대상)
├── .gitignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
└── src/
    ├── app/
    │   ├── layout.jsx           # 루트 레이아웃 (Header 포함)
    │   ├── globals.css          # Tailwind + 커스텀 스타일
    │   ├── page.jsx             # 메인 — 서비스 선택 (랜딩)
    │   ├── create/
    │   │   └── [serviceType]/
    │   │       └── page.jsx     # 서비스별 정보 입력 폼
    │   ├── editor/
    │   │   └── page.jsx         # 콘텐츠 에디터 + API 호출
    │   ├── preview/
    │   │   └── page.jsx         # 가격 견적 확인
    │   ├── order/
    │   │   └── page.jsx         # 배송지 입력 + 주문 생성
    │   ├── orders/
    │   │   └── page.jsx         # 주문 내역 조회
    │   └── api/                 # 백엔드 API 라우트 (서버 전용)
    │       ├── books/
    │       │   ├── route.js             # POST 생성, GET 목록
    │       │   └── [bookUid]/
    │       │       ├── cover/route.js   # POST 표지
    │       │       ├── contents/route.js # POST 내지
    │       │       ├── finalize/route.js # POST 최종화
    │       │       └── photos/route.js  # POST 업로드, GET 목록
    │       ├── orders/
    │       │   ├── route.js             # POST 생성, GET 목록
    │       │   ├── estimate/route.js    # POST 견적
    │       │   └── [orderUid]/route.js  # GET 상세, DELETE 취소
    │       ├── templates/route.js       # GET 목록
    │       ├── book-specs/route.js      # GET 판형 목록
    │       └── credits/route.js         # GET 잔액
    ├── components/
    │   ├── Header.jsx           # 공통 헤더 + 모바일 메뉴
    │   ├── ServiceCard.jsx      # 서비스 선택 카드
    │   ├── StepIndicator.jsx    # 진행 단계 표시
    │   └── Toast.jsx            # 전역 토스트 컨테이너 (layout에 1회 마운트)
    ├── lib/
    │   ├── sweetbook.js         # SweetBook API 클라이언트 (서버 전용!, 지연 초기화)
    │   ├── constants.js         # 서비스 타입, 판형, 주문상태 상수
    │   ├── toast.js             # 토스트 이벤트 버스 (클라이언트 전용)
    │   └── fetchWithRetry.js    # fetch 재시도 래퍼 (5xx 3회 재시도)
    └── data/
        └── dummy.js             # 6가지 서비스별 더미 데이터
```

---

## 4. 아키텍처 규칙

### 4-1. API 통신 흐름 (절대 준수)
```
[브라우저] -> fetch('/api/books') -> [Next.js API Route] -> SweetBook SDK -> [api-sandbox.sweetbook.com]
```
- 프론트엔드(브라우저)는 절대로 api.sweetbook.com이나 api-sandbox.sweetbook.com에 직접 요청하지 않음
- 모든 외부 API 호출은 src/lib/sweetbook.js를 통해 서버 사이드에서만 실행
- API Key는 process.env.SWEETBOOK_API_KEY로만 접근 (클라이언트에 노출 금지)

### 4-2. 새 API 엔드포인트 추가 시 패턴
1. src/lib/sweetbook.js에 SweetBook API 호출 함수 추가
2. src/app/api/{경로}/route.js에 Next.js API Route 생성
3. 프론트엔드에서 fetch('/api/{경로}')로 호출

### 4-3. 새 페이지 추가 시 패턴
1. src/app/{경로}/page.jsx 생성 ('use client' 디렉티브 포함)
2. 필요 시 src/components/에 재사용 컴포넌트 분리
3. StepIndicator에 단계 추가 필요 시 constants.js 수정

---

## 5. SweetBook API 참조

### Base URL
- Sandbox: https://api-sandbox.sweetbook.com/v1
- Live: https://api.sweetbook.com/v1
- 현재 프로젝트는 Sandbox 전용

### 인증
```
Authorization: Bearer {SWEETBOOK_API_KEY}
```

### 핵심 워크플로우 (선 구성 → 트랜잭션 생성 → 주문)

```
1. 에디터 갤러리에 사진 업로드
2. 썸네일 클릭 → 인라인 편집 패널에서 앞표지/내지/뒤표지 역할 지정 + 제목·날짜·텍스트 입력
   (모달 방식 폐기 — 에디터 하단 액션 패널 자리에서 인라인 편집)
3. 구성 미리보기 패널에서 앞표지·내지·뒤표지 확인
   (내지 최소 기준: 버튼 활성화 8장 이상 / API pageMin은 판형별 동적 적용 — SQUAREBOOK_HC: 24장, 부족분 자동 패딩)
4. [최종 생성 및 주문] 클릭 → 아래 API 순차 호출 (트랜잭션)
   4-1. POST /books                           — 책 생성 (draft)
   4-2. POST /books/{bookUid}/photos          — 앞표지 사진 업로드 (multipart)
   4-2. POST /books/{bookUid}/photos          — 뒤표지 사진 업로드 (multipart)
   4-2. POST /books/{bookUid}/photos          — 내지 사진들 업로드 (multipart, 반복)
   4-3. POST /books/{bookUid}/cover           — 앞표지 추가 (업로드된 URL 사용)
   4-4. POST /books/{bookUid}/contents        — 내지 추가 (multipart, 반복)
   4-4. POST /books/{bookUid}/contents        — 뒤표지 추가 (마지막 contents 페이지)
   4-5. POST /books/{bookUid}/finalization    — 최종화 (편집 완료)
5. POST /orders/estimate                 — 가격 견적 조회
6. POST /orders                          — 주문 생성 (충전금 차감)
```

### 이미지 업로드 전략
- **앞표지**: 에디터 갤러리에서 썸네일 클릭 → 인라인 편집 패널에서 "앞표지" 역할 지정 → 책 생성 시 Photos API 업로드 → URL 획득 → cover 템플릿에 자동 연동
- **뒤표지**: 에디터 갤러리에서 썸네일 클릭 → 인라인 편집 패널에서 "뒤표지" 역할 지정 → Photos API 업로드 → 마지막 contents 페이지로 자동 추가
- **내지 이미지**: 갤러리에서 "내지" 역할 지정 → 페이지 순서대로 자동 배정 → 책 생성 시 Photos API 일괄 업로드; 업로드 수가 pageMin 미달이면 자동 패딩
- **일괄 업로드**: 갤러리 Drag & Drop 존에 여러 사진을 한 번에 드롭 → 썸네일 그리드 표시 → 역할 지정 후 페이지 순서 확정
- **양면(Spread) 분할**: 인라인 편집 패널에서 "양면 펼침" 체크 → Canvas API `splitImageHalves()`로 좌/우 반분할 → 연속 2페이지로 전송
- **미업로드 시 기본값**: picsum.photos seed 기반 랜덤 이미지 자동 사용

### AI 동화 생성 API (`/api/generate-story`)
- **AI 동화책 서비스 전용** — create 페이지에서 주인공 이름·나이·주제 입력 후 "🪄 AI 동화 생성하기" 버튼 클릭
- Gemini AI가 10페이지 분량의 동화(제목 + 각 페이지 텍스트)를 자동 생성 → sessionStorage 저장 → 에디터로 이동
- 적용 서비스: **fairytale 단독** (다른 5개 서비스는 사용자가 직접 텍스트 입력)
- 모델 우선순위: gemini-flash-lite-latest → gemini-2.5-flash → gemini-2.5-pro → 로컬 템플릿 폴백
- 환경변수: `GEMINI_API_KEY` (Google AI Studio에서 무료 발급)
- Gemini는 텍스트만 생성. 이미지는 사용자 직접 업로드 또는 picsum 자동 배정

### 사용 가능한 템플릿 UID (SQUAREBOOK_HC 기준, 실제 API 검증 완료)

| 용도 | UID | 필수 파라미터 |
|------|-----|-------------|
| 표지 | `79yjMH3qRPly` | `coverPhoto`, `title`, `dateRange` |
| 내지 (사진+텍스트) | `3FhSEhJ94c0T` | `photo1`, `date`, `title`, `diaryText` |
| 내지 (텍스트 전용) | `vHA59XPPKqak` | `date`, `title`, `diaryText` |

> ⚠️ **주의**: `tpl_F8d15af9fd`, `cnH0Ud1nl1f9`, `6dJ0Qy6ZmXej`는 동작하지 않는 잘못된 UID였음. 사용 금지.
> 파라미터명도 템플릿마다 다름 — 위 표 기준 엄수. (`diaryPhoto` X → `photo1` O)

### 템플릿 썸네일 UI 렌더링 규칙
- API 응답의 썸네일 URL 탐색 순서: `thumbnails.layout` → `thumbnails.baseLayerOdd` → `thumbnails.baseLayerEven` → flat field 폴백
- **표지 썸네일은 선택 역할에 따라 CSS로 좌/우 분할 노출**:
  - 앞표지(`front`): `right-0 w-[200%]` — 이미지 우측 절반만 표시
  - 뒤표지(`back`): `left-0 w-[200%]` — 이미지 좌측 절반만 표시
  - 내지(`content`): `w-full object-cover` — 전체 표시 (크롭 없음)
- 이미지 로드 실패 시 `onError`로 CSS 와이어프레임(`renderWireframe(wfType)`) 자동 대체

### 표지 듀얼 슬롯 UI 규칙 (2026-04-04 추가)
- SweetBook 표지 템플릿은 `[뒤표지(좌) | 앞표지(우)]` Spread 1장 구조 — 반드시 2장의 사진이 한 쌍으로 필요
- **좌측 구성 패널**: 앞/뒤 개별 섹션 대신 통합 "📔 표지 스프레드" 2-slot 프레임으로 표시
  - 채워진 슬롯: 사진 썸네일 + 배지 레이블
  - 빈 슬롯: 점선 원형 아이콘 + "미지정" 텍스트
- **인라인 편집 패널 우측 컬럼**: 표지 역할 지정 시 현재 Spread 현황 실시간 반영 + 미완성 경고 박스
- **템플릿 선택기**: 표지 역할(`isCover=true`)일 때 카드 그리드 상단에 파란 안내 박스 고정 표시
- Validation: `frontItems.length === 1 && backItems.length === 1` 미충족 시 "앞표지와 뒤표지 사진을 모두 지정해 주세요" 메시지

### 내지 2페이지 Spread 단위 편집 규칙 (2026-04-04 추가)
- 내지는 항상 2페이지(L+R) 한 쌍의 Spread 단위로 관리 — 홀수 상태 방지
- **`makeBlankItem()`**: `isBlankSlot: true`, `previewUrl: null` 빈 슬롯 생성 함수
- **`addSpread()`**: 빈 슬롯 2개를 동시 추가 → 항상 짝수 유지
- **`removeSpreadPair(galleryIdx)`**: 클릭 아이템이 속한 Spread 쌍(L+R) 2장 동시 제거
- **`swapSpreadSlot(galleryIdx)`**: 같은 Spread 내 L/R 위치 교환
- **`spreadGroups` useMemo**: `contentItems`를 2개씩 묶어 `{ spreadNum, leftItem, rightItem, leftPageNum, rightPageNum }` 구조 생성
- **좌측 패널**: `spreadGroups.map()`으로 스프레드 카드("스프레드 N · M–K쪽") 렌더링, 하단에 "+2페이지(1장) 추가" 버튼
- **인라인 편집 패널 내지 섹션 최상단**: 스프레드 슬롯 인디케이터 박스 — "스프레드 N · 왼쪽(L)/오른쪽(R) 페이지" + 미니 L/R 프리뷰(현재 슬롯 amber 강조) + "↔ L/R 교체" 버튼
- **삭제 버튼**: 내지 아이템일 때 "스프레드 삭제 (2p)" 레이블로 `removeSpreadPair()` 호출; 표지 아이템은 기존 "이 사진 삭제" 유지
- 빈 슬롯은 갤러리 그리드에서 회색 📄 자리표시자 렌더링; API 전송 시 `TPL_TEXT_ONLY` 자동 적용

### ✅ 해결된 버그 (2026-04-04 추가)

#### 버그 E — Photos API `uploadFile` URL 필드명 불일치 → **해결**
- 증상: `⚠️ 내지 N 업로드 실패: undefined` — `d.message`가 undefined = `d.success=true`이지만 URL 추출 실패
- 원인: `d.data?.url || d.data?.photoUrl || d.data?.fileUrl` 3개 필드명이 SweetBook 실제 응답 필드명과 불일치
- 해결: 14개 필드명(`downloadUrl`, `originalUrl`, `imageUrl`, `cdnUrl`, `publicUrl`, `uploadedUrl`, `uploadUrl`, `originalFileUrl`, `fileDownloadUrl`, 중첩 `photo.url` 등) 순차 탐색 + `d.data`가 문자열 URL인 경우 직접 반환 + 성공/실패 분기 명확화 + 응답 전체 `addLog` 출력

### ✅ 해결된 버그 (2026-04-03)

#### 버그 A — `sweetFetch` ok() 래핑 누락 → **해결**
- `listTemplates`: `data.data.templates` 배열 추출 (실제 API 응답 구조 반영)
- `listBookSpecs`: `data.data` 배열 + `name && pageMin > 0` 필터로 빈 플레이스홀더 제거
- `getTemplate` / `getBookSpec`: `data.data` 단일 객체 추출 후 `ok()` 래핑

#### 버그 B — `sweetFetch` 에러 응답 미throw → **해결**
- `!res.ok` 시 `statusCode` 포함 Error throw로 수정
- route handler catch 블록으로 에러 올바르게 전파

#### 버그 C — 잘못된 bookSpecUid + 템플릿 UID + 파라미터명 → **해결**
- `bs_6a8OUY` 등 `bs_` 접두사 UID는 빈 플레이스홀더 → `POST /Books` 시 400 반환
- 실제 동작 UID: `SQUAREBOOK_HC`, `PHOTOBOOK_A4_SC`, `PHOTOBOOK_A5_SC`
- `constants.js` `recommendedSpec` 전부 `SQUAREBOOK_HC`로 교체
- 템플릿 UID 전면 교체 (위 표 참고), `diaryPhoto` → `photo1` 파라미터명 수정
- 동적 템플릿 조회 제거 — 파라미터명 불일치 위험으로 검증된 상수 고정 사용

#### 버그 D — `GET /api/templates/[templateUid]` 라우트 없음 → **해결**
- `src/app/api/templates/[templateUid]/route.js` 신규 생성 완료

### 판형 (BookSpec) — 실제 API 동작 UID
> `bs_6a8OUY`, `bs_3EzPkz`, `bs_518IVG`는 **빈 플레이스홀더** — `POST /Books` 400 반환. 절대 사용 금지.

- `SQUAREBOOK_HC` — 243×248mm, 하드커버, PUR 무선철, 24~130p (**기본 추천**)
- `PHOTOBOOK_A4_SC` — 210×297mm, 소프트커버, PUR 무선철, 24~130p
- `PHOTOBOOK_A5_SC` — 148×210mm, 소프트커버, PUR 무선철, 50~200p

### 페이지 규칙
- SQUAREBOOK_HC 최소 **24페이지** 이상이어야 최종화 가능 (코드 내 API_MIN=25로 여유분 포함)
- 2페이지 단위 증가 (24, 26, 28, ...)
- 내지 콘텐츠 25개 이상 권장 (자동 패딩 로직 포함)

### API 문서 링크
- 전체 문서: https://api.sweetbook.com/docs
- Books API: https://api.sweetbook.com/docs/api/books/
- Orders API: https://api.sweetbook.com/docs/api/orders/
- Templates: https://api.sweetbook.com/docs/api/templates/
- BookSpecs: https://api.sweetbook.com/docs/api/book-specs/
- Credits: https://api.sweetbook.com/docs/api/credits/

---

## 6. 코딩 컨벤션

### 파일 작성 규칙
- 프론트엔드 컴포넌트: .jsx 확장자, PascalCase 파일명
- API 라우트: route.js, 디렉토리 기반 라우팅
- 유틸/라이브러리: .js 확장자, camelCase 파일명
- 모든 파일 상단에 한글 주석으로 역할 설명

### 에러 핸들링 패턴 (API Route)
```javascript
try {
  const result = await sweetbookFunction(params);
  return NextResponse.json(result, { status: 201 });
} catch (err) {
  console.error('에러 컨텍스트:', err.message);
  return NextResponse.json(
    { success: false, message: err.message },
    { status: err.statusCode || 500 }
  );
}
```

### Tailwind 사용 규칙
- 커스텀 색상: cream, warm-*, ink-* (tailwind.config.js에 정의됨)
- 공통 클래스: .btn-primary, .btn-secondary, .input-field, .card-hover (globals.css)
- 반응형: sm:, md:, lg: breakpoint 사용
- 애니메이션: animate-fade-up, animate-fade-in (config에 정의됨)

---

## 7. 시연 최적화 (필수 구현 항목)

영상 녹화용으로 다음이 반드시 포함되어야 함:

1. **로딩 UI**: API 호출 중 spinner 클래스 또는 스켈레톤 UI
2. **토스트 알림**: 성공/실패 시 사용자에게 직관적 피드백
3. **에러 핸들링**: API 실패 시 에러 메시지를 화면에 표시 (빨간 배경 박스)
4. **더미 데이터**: "더미 데이터 채우기" 버튼으로 즉시 체험 가능
5. **API 로그**: 에디터에서 책 생성 과정을 실시간 로그로 표시
6. **갤러리 기반 표지 지정 및 사진 배치**: 에디터 우측 상단 갤러리에서 사진 일괄 업로드 → 썸네일 클릭 → 모달에서 앞표지·뒤표지·내지 역할 직접 지정 → 갤러리 상태가 표지 썸네일에 실시간 반영 (Canvas API 양면 분할 포함)
7. **블러 미리보기**: 상위 5페이지 선명 노출 + 나머지 blur-md 처리 + 구매 유도 오버레이
8. **AI 동화책 10페이지 자동 생성**: AI 동화책 서비스의 create 단계에서 Gemini AI가 동화 10페이지 자동 생성 → 에디터로 이동해 자유롭게 수정 가능

---

## 8. 작업 시 주의사항

### 절대 하면 안 되는 것
- .env 파일을 git에 커밋
- 프론트엔드 코드에 API Key 노출
- src/lib/sweetbook.js를 클라이언트 컴포넌트에서 import
- API 응답 구조를 임의로 변경 (SweetBook 표준 응답 형식 유지)
- TypeScript로 변환 (현재 JS 기반 유지)

### 변경 후 반드시 확인할 것
- npm run build 에러 없는지 확인
- npm run dev로 로컬 실행 확인
- 모든 API 라우트가 정상 응답하는지 확인
- 모바일 반응형 확인 (640px 이하)

### 기능 추가/수정 후 업데이트할 파일
- README.md — 새 기능이나 API 추가 시 업데이트
- DECISION_LOG.md — 기술 선택 이유나 트러블슈팅 기록
- 이 파일 (CLAUDE.md) — 구조 변경 시 업데이트

---

## 9. 향후 구현 우선순위 (TODO)


### P0 — 과제 제출 전 필수
- [x] Books API 연동 (생성, 표지, 내지, 최종화)
- [x] Orders API 연동 (견적, 생성, 목록, 상세, 취소)
- [x] 6가지 서비스별 더미 데이터 (24페이지 × 6개 서비스, 3종 템플릿 시나리오 전체 대응)
- [x] README.md 완성
- [x] 실제 Sandbox API Key 연동 (.env 설정)
- [x] Toast 알림 컴포넌트 — 이벤트 버스 기반, success/error/info/warn, 3.5초 자동 소멸
- [x] 에러 발생 시 재시도 로직 — fetchWithRetry, 5xx 3회 재시도, 지수 백오프
- [x] 다중 이미지 Drag & Drop 업로드 + 갤러리 UI (업로드된 사진을 썸네일 그리드로 표시, 드래그 리오더)
- [x] 앞표지/뒤표지 직접 지정 UI (갤러리 썸네일 클릭 → 모달 → 역할 지정, 중복 방지 Validation)
- [x] 텍스트 유무에 따른 템플릿 동적 분기 (텍스트 있음 → 3FhSEhJ94c0T, 없음 → vHA59XPPKqak)
- [x] 가로형 사진 Canvas API 양면(Spread) 분할 — splitImageHalves()로 좌/우 2장 분할 후 연속 2페이지 전송 (quality=1.0)
- [x] 판형별 pageMin + pageIncrement 수학적 준수 — pageMin=순수 내지 수 기준으로 재해석, 표지 제외 패딩 계산 수정 → 최종화 400 완벽 해결 ✅
- [x] API 라우트 catch 블록 SDK 에러 구조 대응 — err.statusCode / err.errorCode / err.details 로깅 및 클라이언트 전달
- [x] 에디터 갤러리 모달에서 사진별 레이아웃(템플릿) 선택 UI — 앞표지·내지 역할별 카드 그리드 구현, allTemplates 필터링, templateUid 즉시 반영
- [x] 텍스트 입력 유무 기반 템플릿 동적 필터링 — 텍스트 있음→텍스트 포함 레이아웃만, 없음→이미지 전용 레이아웃만 실시간 노출 (인지 부하 최소화)
- [x] 미니 와이어프레임 UI — API 미리보기 없을 때 cover/photo_text/text_only/blank/calendar/photo_only 6종 Tailwind CSS 와이어프레임 렌더링
- [x] 모달 → 인라인 속성 패널(Inline Property Panel) 전환 — galleryModal state 제거, selectedIdx로 단순화, 액션 패널과 편집 패널 토글
- [x] 내지 카운트 동적 연동 — MIN_CONTENT 하드코딩 제거, specPageMin(판형 API 기준) 3색 배지 표시
- [x] 템플릿 썸네일 경로 수정 — SweetBook API `thumbnails` 객체(layout→baseLayerOdd→baseLayerEven) 우선 탐색, `onError` 2단 폴백 구조 적용
- [x] 표지 썸네일 역할별 CSS 크롭 — SweetBook 표지 템플릿은 양면(Spread) 이미지 1장으로 제공됨. 앞표지 선택 시 `right-0 w-[200%]`(우측 절반), 뒤표지 선택 시 `left-0 w-[200%]`(좌측 절반), 내지는 크롭 없이 전체 표시
- [x] 표지 Spread 통합 완료 — 앞/뒤표지를 단일 `POST /books/{uid}/cover` 호출(coverPhoto + backPhoto)로 통합. 뒤표지를 내지 마지막 장으로 처리하던 STEP 4-b 방식 제거
- [x] 페이지 규격 실시간 검증 도입 — `getPageConsumption(item)` 함수(Spread 2p 소모 반영) + `totalContentPages` useMemo + `isPageMinMet` + `isIncrementOk`로 버튼 활성화 조건 강화. 미충족 시 버튼 옆 빨간 안내 문구 표시
- [x] 표지 듀얼 슬롯 UX 구현 — 좌측 패널: `[뒤표지 슬롯 | 앞표지 슬롯]` Spread 프레임으로 통합. 인라인 패널 우측 컬럼: 표지 역할 지정 시 현재 Spread 현황 실시간 표시 + 미완성 경고. 템플릿 선택기: "2장 필수" 안내 박스 상단 고정
- [x] 2페이지 Spread 단위 내지 편집 시스템 — `spreadGroups` useMemo로 내지 쌍 그룹화, 좌측 패널 스프레드 카드 뷰, "+2페이지(1장) 추가" 버튼, 쌍 단위 삭제(`removeSpreadPair`), L/R 교체(`swapSpreadSlot`), 인라인 패널 스프레드 슬롯 인디케이터(미니 프리뷰 + 현재 슬롯 amber 강조 + L/R 교체 버튼), 빈 슬롯(isBlankSlot) → TPL_TEXT_ONLY 자동 적용
- [x] 빈 슬롯 직접 편집 기능 — 스프레드 뷰에서 빈 슬롯 클릭 → 인라인 편집 패널 열림, `<label>+<input>` 업로드 플레이스홀더로 사진 직접 업로드, `handleBlankSlotUpload()` → `isBlankSlot: false` 전환
- [x] 스프레드 UI 데이터 인덱스 매핑 재구축 — 절대 페이지 인덱스(0~N) 기준 `contentPageData` 빌드, picsum fallback URL로 업로드 실패·빈 슬롯·패딩 페이지 100% 커버
- [x] 내지 전송 400 에러 해결 — templateUid 강제 표준화(항상 TPL_WITH_PHOTO / TPL_TEXT_ONLY), `diaryText` 빈 문자열 폴백(단일 공백), 실패 페이지 `console.dir` 수준 로깅
- [x] 최종화 에러 100% 해결 — 모든 내지 전송 성공 보장 + 최종화 실패 시 `console.dir(finalizeError)` 상세 로깅
- [x] 사진 업로드 인덱스 매핑 최종 동기화 — `stagedFilesRef` (useRef, itemId→File) 도입으로 gallery state와 독립적으로 파일 이중 보관. `handleCreateBook` 시작 시 `contentFileMap[ci]` 스냅샷으로 절대 내지 인덱스 기준 파일 매핑. `uploadFile()` 헬퍼에 instanceof 타입 체크 + `console.log` 진단 로그 추가

### P1 — 면접 전 개선
- [x] 이미지 파일 직접 업로드 (Drag & Drop + Photos API) — 에디터 내 구현 완료
- [x] 표지 이미지 (앞/뒤) 전용 업로드 UI — 에디터 좌측 패널
- [x] 미리보기 블러 티저 UI (상위 5p 공개 + 구매 유도 오버레이)
- [x] GET /templates로 실제 템플릿 목록 가져와서 선택 UI — 에디터 모달 내 카드 그리드 (create 페이지에서 이동)
- [x] DECISION_LOG.md 내용 보강 — 최종화 400 해결·템플릿 동적 필터링 UX 의사결정 상세 기록
- [ ] 페이지 미리보기 시각화 (템플릿 레이아웃 렌더링)
- [ ] Skeleton UI 로딩 (현재 spinner만 있음)

### P2 — 시간 여유 시
- [ ] 웹훅 연동 (주문 상태 변경 실시간 알림)
- [ ] 사용자 인증 (NextAuth)
- [ ] 다크 모드
