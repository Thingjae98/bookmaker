# ARCHIVE — Developer Portfolio Book Editor

> 프로젝트의 여정을 한 권의 프리미엄 하드커버 북으로.

**ARCHIVE**는 SweetBook Book Print API 기반의 B2D(Business-to-Developer) 포트폴리오 북 제작 에디터입니다.
프로젝트 스크린샷, 아키텍처 다이어그램, 회고 텍스트를 드래그앤드롭으로 구성하고, 실제 하드커버 북으로 인쇄·배송까지 한 번에 처리합니다.

---

## 핵심 기술 성과

### 1. Idempotency-Safe 트랜잭션 파이프라인
- `crypto.randomUUID()` 기반 `Idempotency-Key` 헤더 자동 주입
- 409 Conflict 안전 처리 — 네트워크 재시도 시 중복 주문/책 생성 원천 차단
- 5xx 에러 3회 자동 재시도 + 지수 백오프 (`fetchWithRetry`)

### 2. breakBefore 기반 동적 레이아웃 페이지 렌더링
- SweetBook Dynamic Layout 엔진의 `breakBefore` 속성을 템플릿 메타데이터에서 동적 해석
- `'page'` (독립 페이지) vs `'none'` (연속 플로우) — 갤러리/일기장/포토북 템플릿별 최적 배치
- rowGallery 템플릿에서 `breakBefore: 'none'` 적용 시 페이지 카운트 불일치 → finalize 400 에러를 분석하여 안전 기본값 `'page'`로 전환

### 3. 유령 템플릿 차단 아키텍처 (3-Layer Defense)
- **Layer 1**: `categoryToTplMap` 글로벌 상수 폴백 완전 제거 — 현재 카테고리 스코프 내 UID만 허용
- **Layer 2**: 카테고리 변경 시 `validUids` Set 교차검증 → 갤러리 아이템의 stale templateUid 즉시 null 초기화
- **Layer 3**: `handleCreateBook` 내지 전송 루프에서 `validUids.has()` 최종 게이트키핑

### 4. Decorative File Binding 분리
- 템플릿 `parameters.definitions`의 `file` 바인딩을 사용자 사진 vs 장식용 에셋으로 정밀 분류
- `DECORATIVE_FILE_KEYS` Set (`lineVertical`, `pencilIcon`, `weatherIcon` 등) — 장식 파일에는 투명 placeholder 자동 주입
- 전 카테고리(일기장A, 알림장A/B/C, 구글포토북A/B/C) API 100% 호환 달성

### 5. Auto Compose — 이미지 기반 자동 페이지 구성
- 갤러리에 이미지 업로드 후 **AUTO COMPOSE** 버튼 클릭 → 자동 페이지 배치
- 첫 장 → 앞표지, 마지막 → 뒤표지, 나머지 → 내지 순서 자동 배정
- 목표 페이지 수 설정 (24~130p, 2 단위) → 부족분 빈 슬롯 자동 패딩
- 구성 후 자유롭게 수정 가능 — 역할 재지정, 순서 변경, 텍스트 추가

### 6. AI 텍스트 생성 — Gemini 기반 페이지별 회고 자동 작성
- 에디터 편집 패널에서 **AI TEXT** 버튼 클릭 → Google Gemini API로 회고/캡션 텍스트 자동 생성
- Create 페이지에서 입력한 프로젝트 정보(제목, 저자, 역할, 기술 스택, 기간, 설명)를 컨텍스트로 활용
- 모델 폴백 체인: `gemini-flash-lite-latest` → `gemini-2.5-flash` → 규칙 기반 폴백 텍스트
- 레거시 텍스트 필드 + 동적 파라미터 long text 필드 모두 지원

### 7. Webhook 주문 상태 실시간 추적
- SweetBook 서버 → `POST /api/webhooks/sweetbook` — 주문 상태 변경 이벤트 수신
- 인메모리 이벤트 저장소 — 수신 이벤트 로그 보관 (최대 200건)
- 주문 내역 페이지에서 Webhook 이벤트 로그 실시간 표시 (30초 폴링)
- **로컬 시연용 시뮬레이터**: `POST /api/webhooks/sweetbook/simulate` — 주문 상태 전이를 수동 시뮬레이션 (PAID → PDF_READY → CONFIRMED → ... → DELIVERED)

---

## 실행 방법

### 사전 준비
- **Node.js** 18.0+
- **npm** 9.0+
- **SweetBook Sandbox API Key** ([api.sweetbook.com](https://api.sweetbook.com))

### 설치 및 실행

```bash
git clone https://github.com/Thingjae98/bookmaker.git
cd bookmaker
npm install

cp .env.example .env
# .env 파일을 열고 API Key 입력:
#   SWEETBOOK_API_KEY=your_sandbox_api_key_here
#   SWEETBOOK_API_BASE_URL=https://api-sandbox.sweetbook.com/v1

npm run dev
```

`http://localhost:3000` 접속 후 서비스를 확인할 수 있습니다.

### 시연 순서 (로컬 영상 녹화용)
1. 메인 페이지 → **"Start Archiving"**
2. **"Fill Demo Data"** → 포트폴리오 샘플 자동 입력
3. **"Next: Compose"** → 에디터 진입
4. 갤러리 Drag & Drop 존에 프로젝트 스크린샷 업로드
5. 썸네일 클릭 → 인라인 편집 패널에서 표지/내지 역할 지정
6. **"책 생성 & 최종화"** → API 로그 실시간 확인
7. **"다음: 미리보기 & 주문"** → 스프레드 뷰 확인
8. **"다음: 주문하기"** → 배송지 입력 → 주문 생성
9. **"주문 내역"**에서 상태 추적

---

## 사용한 API

| API | 메서드 | 엔드포인트 | 용도 |
|-----|--------|-----------|------|
| Books | `POST` | `/v1/books` | 책 생성 (draft) |
| Books | `POST` | `/v1/books/{bookUid}/photos` | 사진 업로드 (multipart) |
| Books | `POST` | `/v1/books/{bookUid}/cover` | 표지 추가 |
| Books | `POST` | `/v1/books/{bookUid}/contents` | 내지 페이지 추가 |
| Books | `POST` | `/v1/books/{bookUid}/finalization` | 최종화 |
| Orders | `POST` | `/v1/orders/estimate` | 가격 견적 |
| Orders | `POST` | `/v1/orders` | 주문 생성 |
| Orders | `GET` | `/v1/orders` | 주문 목록 |
| Orders | `GET` | `/v1/orders/{orderUid}` | 주문 상세 |
| Orders | `POST` | `/v1/orders/{orderUid}/cancel` | 주문 취소 |
| Orders | `PATCH` | `/v1/orders/{orderUid}/shipping` | 배송지 변경 |
| Templates | `GET` | `/v1/templates` | 템플릿 목록 |
| Templates | `GET` | `/v1/templates/{templateUid}` | 템플릿 상세 |
| BookSpecs | `GET` | `/v1/book-specs` | 판형 목록 |
| Credits | `GET` | `/v1/credits` | 충전금 잔액 |
| Webhooks | `POST` | `/api/webhooks/sweetbook` | 주문 상태 이벤트 수신 |

---

## AI 도구 사용 내역

| AI 도구 | 활용 내용 |
|---------|----------|
| Claude (Anthropic) | 프로젝트 아키텍처 설계, 프론트엔드/백엔드 코드 작성, API 연동 |
| Claude (Anthropic) | SweetBook API 문서 분석, 트러블슈팅 (breakBefore, Decorative File) |
| Claude (Anthropic) | README, DECISION_LOG, CLAUDE.md 작성 |
| Gemini (Google) | 에디터 내 페이지별 회고/캡션 텍스트 AI 자동 생성 |

---

## 설계 의도

### 왜 "ARCHIVE"인가
Book Print API의 본질은 **디지털→물리적 변환**입니다. 개발자에게 1년간의 프로젝트 스크린샷, 아키텍처 의사결정, 회고를 한 권의 하드커버 북으로 아카이빙하는 경험을 제공합니다.

### 디자인 철학: Black & White Minimalism
- **Typography**: JetBrains Mono (기술 라벨) + Noto Serif KR (본문)
- **Palette**: neutral-900 ~ neutral-50 그레이스케일, 콘텐츠 집중형 UI
- **Layout**: 직각 보더, uppercase tracking, 정보 위계 명확화

### 비즈니스 확장 가능성
- **B2B SaaS**: 기업 연간 프로젝트 보고서 → 팀 구독 모델
- **컨퍼런스 파트너십**: 발표자료 → 아카이브 북 자동 변환
- **프리미엄 포트폴리오**: 면접/이직 시 물리적 포트폴리오 북 차별화

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 프론트엔드 | React 18, Tailwind CSS |
| AI 텍스트 | Google Gemini API (@google/generative-ai) |
| 백엔드 | Next.js API Routes |
| API 클라이언트 | bookprintapi-nodejs-sdk |
| 파일 업로드 | HTML5 File API + Drag & Drop + FormData |
| 폰트 | JetBrains Mono, Noto Serif KR |

### 프로젝트 구조

```
bookmaker/
├── src/
│   ├── app/
│   │   ├── page.jsx                          # 랜딩 페이지
│   │   ├── create/[serviceType]/page.jsx     # 프로젝트 정보 입력
│   │   ├── editor/page.jsx                   # 콘텐츠 에디터 (핵심)
│   │   ├── preview/page.jsx                  # 미리보기 & 견적
│   │   ├── order/page.jsx                    # 주문 (배송지 입력)
│   │   ├── orders/page.jsx                   # 주문 내역
│   │   └── api/                              # 백엔드 API 프록시
│   │       ├── books/                        #   Books API
│   │       ├── orders/                       #   Orders API
│   │       ├── templates/                    #   Templates API
│   │       ├── book-specs/                   #   BookSpecs API
│   │       ├── credits/                      #   Credits API
│   │       ├── generate-page-text/            #   AI 텍스트 생성 (Gemini)
│   │       └── webhooks/sweetbook/           #   Webhook 수신
│   ├── components/                           # UI 컴포넌트
│   ├── lib/                                  # 유틸리티 (sweetbook.js, fetchWithRetry)
│   └── data/dummy.js                         # 포트폴리오 더미 데이터 (24p)
├── public/images/portfolio/                  # 프로젝트 스크린샷 (시연용)
└── .env.example                              # 환경변수 템플릿
```

---

## SweetBook API 스펙 대응

### 완전 구현
- **Books API** — 생성 → 사진 업로드 → 표지 → 내지 → 최종화 풀 파이프라인
- **Orders API** — 견적 → 주문 → 조회 → 취소 → 배송지 변경 (Idempotency-Key)
- **Template Engine** — theme 기반 카테고리 필터링, definitions 바인딩 자동 감지, breakBefore 동적 제어
- **Photo Upload** — multipart Drag & Drop, 갤러리 관리, 사전 업로드 파이프라인
- **Retry / Backoff** — 5xx 3회 재시도, 지수 백오프
- **페이지 규격** — pageMin/pageIncrement 실시간 검증 + 자동 패딩
- **Special Page Rules** — PUR 제본 첫 내지 Right 배치, spineTitle 자동 바인딩
- **Webhook 수신** — POST /api/webhooks/sweetbook 개통, 인메모리 이벤트 로그, 주문 상세 페이지 실시간 표시
- **Webhook 시뮬레이션** — POST /api/webhooks/sweetbook/simulate 로컬 시연용 상태 전이 시뮬레이터

### 의도적 미구현 (고급 UX)
- Element Grouping (visible 토글)
- Column Templates (2/3단 레이아웃)
- Dynamic Layout 고급 (splittable, isDynamic, lanes)

> 상세 분석: `DECISION_LOG.md` 참조

---

## 보안

- API Key는 **서버 측(API Routes)에서만** 사용 — 클라이언트 노출 없음
- `.env`는 `.gitignore` 등록 — 커밋 불가
- `.env.example`에 실제 키 미포함
