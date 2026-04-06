# ARCHIVE — Premium Project Portfolio Book

> 당신의 프로젝트와 1년의 성과를 한 권의 프리미엄 아카이브로 남기세요.

**크리에이터/개발자를 위한 프로젝트 포트폴리오 북 제작 플랫폼.**
SweetBook Book Print API를 활용하여 프로젝트 스크린샷, 아키텍처 다이어그램, 회고 텍스트를 실제 하드커버 북으로 만들어 드립니다.

---

## 1. 서비스 소개

### 한 문장 설명
프로젝트 포트폴리오를 프리미엄 하드커버 북으로 아카이빙하는 웹 애플리케이션. SweetBook Book Print API로 책 생성부터 주문·배송까지 한 번에 처리합니다.

### 타겟 고객
- 1년 성과를 물리적 아카이브로 남기고 싶은 **개발자**
- 포트폴리오를 책으로 제작하고 싶은 **디자이너/PM**
- 팀 프로젝트 회고를 기념품으로 제작하고 싶은 **스타트업 팀**
- 기술 블로그 콘텐츠를 단행본으로 출간하고 싶은 **테크 크리에이터**

### 주요 기능
- **단일 포트폴리오 서비스**: Black & White 미니멀 매거진 스타일의 Configure → Compose → Preview → Order 4단계 플로우
- **인라인 편집 패널**: 갤러리 썸네일 클릭 → 하단 패널에서 역할·텍스트·레이아웃 설정 (모달 없음)
- **Drag & Drop 갤러리**: 스크린샷, 다이어그램, 팀 사진을 드래그앤드롭으로 업로드 → 역할 지정(표지/내지)
- **표지 Spread 통합**: 앞/뒤표지를 단일 API 호출로 통합 전송, 2-슬롯 UI로 직관적 관리
- **2페이지 Spread 단위 내지 편집**: [L|R] 쌍 단위 관리로 홀수 페이지 원천 차단
- **Canvas API 양면 분할**: 파노라마 스크린샷을 좌/우 정밀 분할 → 연속 2페이지로 전송
- **동적 템플릿 시스템**: API 기반 카테고리 그룹핑 + definitions 바인딩 자동 감지
- **책 넘김(Flip) 미리보기**: CSS Spread 뷰 + 블러 티저(상위 4스프레드 공개)
- **주문 관리**: 견적 조회 → 주문 생성 → 상태 추적(11단계) → 취소 → 배송지 변경
- **Webhook 수신**: 주문 상태 변경 실시간 로깅
- **토스트 알림 & 에러 재시도**: 5xx 3회 자동 재시도 + 지수 백오프
- **더미 데이터**: 개발자 포트폴리오 시나리오 24페이지 즉시 체험

---

## 2. 실행 방법

### 사전 준비
- **Node.js** 18.0 이상
- **npm** 9.0 이상
- **SweetBook Sandbox API Key** ([api.sweetbook.com](https://api.sweetbook.com)에서 발급)

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/Thingjae98/bookmaker.git
cd bookmaker

# 2. 의존성 설치
npm install

# 3. 환경변수 설정
cp .env.example .env
# .env 파일을 열고 API Key를 입력하세요:
#   SWEETBOOK_API_KEY=your_sandbox_api_key_here
#   SWEETBOOK_API_BASE_URL=https://api-sandbox.sweetbook.com/v1

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하면 서비스를 확인할 수 있습니다.

### 빠른 테스트 순서
1. 메인 페이지에서 **"Start Archiving"** 클릭
2. **"Fill Demo Data"** 버튼 클릭 → 포트폴리오 샘플 데이터 자동 입력
3. **"Next: Compose"** → 에디터 진입
4. 갤러리 Drag & Drop 존에 스크린샷/다이어그램 업로드 (또는 더미 이미지 자동 사용)
5. 갤러리 썸네일 클릭 → 인라인 편집 패널에서 표지/내지 역할 지정
6. 에디터 하단 **"책 생성 & 최종화"** 클릭 → API 로그 확인
7. **"다음: 미리보기 & 주문"** → 스프레드 뷰로 결과 확인
8. **"다음: 주문하기"** → 더미 배송지 → **"주문하기"**
9. **"주문 내역"**에서 주문 상태 확인

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
| Orders | `POST` | `/v1/orders/{orderUid}/cancel` | 주문 취소 |
| Orders | `PATCH` | `/v1/orders/{orderUid}/shipping` | 배송지 변경 |
| Templates | `GET` | `/v1/templates` | 템플릿 목록 조회 |
| Templates | `GET` | `/v1/templates/{templateUid}` | 템플릿 상세 조회 |
| BookSpecs | `GET` | `/v1/book-specs` | 판형 목록 조회 |
| Credits | `GET` | `/v1/credits` | 충전금 잔액 조회 |
| Webhooks | `POST` | `/api/webhooks/sweetbook` | 주문 상태 변경 이벤트 수신 |

---

## 4. AI 도구 사용 내역

| AI 도구 | 활용 내용 |
|---------|----------|
| Claude (Anthropic) | 전체 프로젝트 아키텍처 설계, 프론트엔드/백엔드 코드 작성, API 연동 로직 구현 |
| Claude (Anthropic) | API 문서 분석 및 워크플로우 설계, 트러블슈팅 |
| Claude (Anthropic) | 더미 데이터 생성 (포트폴리오 시나리오 24페이지 샘플) |
| Claude (Anthropic) | ARCHIVE 피벗 — B&W 미니멀 매거진 스타일 UI/UX 전면 개편 |
| Claude (Anthropic) | README.md, DECISION_LOG.md 작성 |

---

## 5. 설계 의도

### 왜 "ARCHIVE"를 선택했는지

Book Print API의 핵심 가치는 **"디지털 콘텐츠를 물리적 책으로 만드는 것"**입니다. 개발자/크리에이터에게 1년간의 프로젝트 회고, 아키텍처 의사결정, 스크린샷을 **한 권의 프리미엄 하드커버 북**으로 아카이빙하는 경험을 제공합니다.

### 디자인 철학: Black & White Minimalism

- **Magazine-style Typography**: JetBrains Mono + Noto Serif KR 조합으로 개발자 친화적 타이포그래피
- **Monochrome Palette**: neutral-900 ~ neutral-50 그레이스케일 기반, 콘텐츠에 집중하는 UI
- **Grid System**: 60px 그리드 패턴 배경, 정보 위계를 명확히 하는 레이아웃
- **No Emoji, No Color Noise**: 프로페셔널한 톤앤매너 유지

### 비즈니스 가능성
- **B2B SaaS**: 기업 연간 프로젝트 보고서를 책으로 제작하는 팀 구독 모델
- **개발자 커뮤니티 파트너십**: 컨퍼런스 발표자료 → 아카이브 북 변환
- **프리미엄 포트폴리오**: 면접/이직 시 물리적 포트폴리오 북으로 차별화

### 더 시간이 있었다면 추가했을 기능
- **GitHub API 연동**: 커밋 히스토리·PR 통계를 자동으로 페이지에 배치
- **AI 회고 생성**: 프로젝트 README를 분석하여 자동 회고문 작성
- **Skeleton UI**: 현재 spinner → 콘텐츠 형태의 스켈레톤 로딩
- **사용자 인증**: NextAuth 기반 개인 아카이브 관리
- **다크 모드**: 개발자 친화적 다크 테마

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
| 폰트 | JetBrains Mono, Noto Serif KR, Noto Sans KR |

### 프로젝트 구조

```
bookmaker/
├── src/
│   ├── app/
│   │   ├── page.jsx                          # 메인 랜딩 페이지
│   │   ├── layout.jsx                        # 루트 레이아웃
│   │   ├── globals.css                       # B&W 미니멀 스타일
│   │   ├── create/[serviceType]/page.jsx     # 아카이브 정보 입력
│   │   ├── editor/page.jsx                   # 콘텐츠 에디터
│   │   ├── preview/page.jsx                  # 미리보기 & 가격 확인
│   │   ├── order/page.jsx                    # 주문 (배송지 입력)
│   │   ├── orders/page.jsx                   # 주문 내역
│   │   └── api/                              # 백엔드 API 라우트
│   │       ├── books/                        #   Books API 프록시
│   │       ├── orders/                       #   Orders API 프록시
│   │       ├── templates/                    #   Templates API 프록시
│   │       ├── book-specs/                   #   BookSpecs API 프록시
│   │       ├── credits/                      #   Credits API 프록시
│   │       └── webhooks/sweetbook/           #   Webhook 수신
│   ├── components/
│   │   ├── Header.jsx                        # B&W 헤더/네비게이션
│   │   ├── StepIndicator.jsx                 # 4단계 진행 인디케이터
│   │   ├── ServiceCard.jsx                   # 서비스 카드 (호환용)
│   │   └── Toast.jsx                         # 토스트 알림
│   ├── lib/
│   │   ├── sweetbook.js                      # SweetBook API 클라이언트 (서버 전용)
│   │   ├── constants.js                      # 서비스 타입, 판형, 상태 상수
│   │   ├── toast.js                          # 토스트 이벤트 버스
│   │   └── fetchWithRetry.js                 # fetch 재시도 래퍼
│   └── data/
│       └── dummy.js                          # 포트폴리오 더미 데이터 (24페이지)
├── .env.example
├── .gitignore
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json
└── README.md
```

---

## 7. SweetBook API 스펙 대응 현황

SweetBook API 공식 문서(10개 Concepts 페이지)를 전수 검토하여 구현 상태를 분류했습니다.

### 완전 구현
- **Books API** — 생성, 사진 업로드, 표지, 내지, 최종화 전체 워크플로우
- **Orders API** — 견적, 주문 생성, 목록/상세 조회, 취소, 배송지 변경 (Idempotency-Key 적용)
- **Template Engine** — theme(카테고리) 기반 필터링, templateKind 분리, 파라미터 바인딩 자동 감지
- **Cover Spread** — 앞+뒤표지 통합 API 호출
- **Photo Upload** — multipart Drag & Drop, 갤러리 관리
- **Retry / Backoff** — 5xx 3회 재시도, 지수 백오프
- **페이지 규격 검증** — pageMin/pageIncrement 실시간 체크 + 자동 패딩
- **Special Page Rules** — PUR 제본 첫 내지 Right 배치, breakBefore 동적 제어
- **Webhook 수신** — POST /api/webhooks/sweetbook 개통, payload 파싱 + 200 OK

### 의도적 미구현 (서버 측 자동 처리 또는 고급 UX)
- Element Grouping (visible 토글)
- Column Templates (2/3단 레이아웃)
- Text Processing (서버 측 자동 처리)
- Dynamic Layout 고급 기능 (splittable, isDynamic, lanes)

> 상세 분석: `DECISION_LOG.md` 참조

---

## 8. 보안

- API Key는 **서버 측(API Routes)에서만** 사용되며 클라이언트에 노출되지 않습니다
- `.env` 파일은 `.gitignore`에 등록되어 커밋되지 않습니다
- `.env.example`에는 실제 키 값이 포함되지 않습니다
