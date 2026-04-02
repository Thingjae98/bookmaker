# DECISION_LOG.md — 의사결정 & 트러블슈팅 기록

> 개발 중 주요 기술 선택 이유와 문제 해결 과정을 기록합니다.
> 구글폼 서술형 문항 작성 시 참고용.

---

## 📅 2026-04-02 — 프로젝트 초기 설계

### 기술 스택 선택

**프레임워크: Next.js 14 (App Router)**
- 선택 이유: 프론트엔드 + 백엔드를 단일 프로젝트로 구성 가능 (모노레포 요구사항 자연 충족)
- App Router의 API Routes를 백엔드 프록시로 활용 → 별도 Express 서버 불필요
- 대안 검토: React + Express 분리 → 설정 복잡, 배포 2곳 → 탈락

**스타일링: Tailwind CSS**
- 선택 이유: 빠른 프로토타이핑, 반응형 자동 지원, 일관된 디자인 토큰
- 시연 영상 UI 완성도가 평가에 중요하므로 빠르게 퀄리티 확보 가능
- 대안 검토: styled-components(런타임 비용), CSS Modules(반응형 느림)

**HTTP 클라이언트: Axios + form-data**
- 선택 이유: cover/contents API가 multipart/form-data 필수 → form-data 라이브러리 필요
- Axios + form-data 조합이 Node.js에서 가장 안정적
- 대안 검토: fetch API → FormData 헤더 자동설정 이슈

### 서비스 컨셉

**"올인원 북메이커" — 6가지 서비스 유형 통합**
- 단일 서비스보다 다양한 시나리오 시연이 API 활용도 입증에 유리
- 각 서비스별 맞춤 폼 + 더미 데이터로 심사위원 테스트 편의 극대화
- B2B2C 화이트라벨 확장 가능성도 설계 의도에 포함

### 아키텍처

**프론트엔드 → Next.js API Routes → SweetBook API (3-tier)**
- API Key는 서버 환경변수에만 존재, 프론트엔드 노출 원천 차단
- sweetbook.js 단일 모듈에서 모든 외부 API 통신 관리 (단일 책임)
- 에러를 백엔드에서 1차 처리 후 프론트에 표준 형식으로 전달

---

## 📅 2026-04-02 — [설계 결정] 통신 방식: 직접 호출(Axios)에서 공식 Node.js SDK로 전환

### 결정 내용

`src/lib/sweetbook.js`의 Axios 기반 직접 API 호출 코드를 공식 [`bookprintapi-nodejs-sdk`](https://github.com/sweet-book/bookprintapi-nodejs-sdk)로 전환.

### 원인 및 근거

- **바이브코딩 직무 성향**: 이미 제공된 공식 도구를 적극 활용하여 개발 생산성과 구현 속도를 극대화하는 것이 역할에 부합. 직접 HTTP 클라이언트를 작성하는 대신 SDK가 제공하는 인증, 재시도, 에러 클래스 등의 기반 기능을 그대로 활용.
- **자사 SDK 사용성 검증**: API 플랫폼 팀 합류를 목표로 하는 만큼, SDK를 직접 프로덕션 수준으로 사용해 보며 DX(개발자 경험)를 검증하는 것 자체가 과제의 부가 목적과 일치.
- **SDK 품질**: 자동 재시도(지수 백오프), `SweetbookApiError` / `SweetbookNetworkError` / `SweetbookValidationError` 분리, `Idempotency-Key` 자동 삽입 등이 내장되어 있어 별도 구현이 불필요.

### 트레이드오프 (Trade-off)

| 항목 | Axios 직접 호출 | 공식 SDK |
|------|----------------|----------|
| Next.js fetch 캐싱(Data Cache) 제어 | `next: { revalidate }` 옵션으로 100% 제어 가능 | **SDK 내부 `fetch` 호출이라 캐시 옵션 미노출** |
| 에러 핸들링 | `err.response?.data` 직접 파싱 필요 | `SweetbookApiError.statusCode`, `.message` 구조화 |
| 재시도 로직 | 직접 구현 필요 | 500/429에 대한 지수 백오프 내장 |
| 의존성 크기 | axios + form-data (추가 설치) | SDK 자체 (fetch 내장, dotenv만 의존) |

- 캐싱 제어 손실은 **책 생성·주문 같은 실시간 Mutation 작업**에서는 실질적 영향 없음. 오히려 캐싱되면 안 되는 작업이 대부분이므로 SDK 방식이 더 안전.
- Templates / BookSpecs처럼 SDK가 미지원하는 읽기 전용 엔드포인트는 기존 `fetch` 직접 호출 방식을 유지.

### 구현 변경 사항

- `npm install git+https://github.com/sweet-book/bookprintapi-nodejs-sdk.git`
- `src/lib/sweetbook.js`: `SweetbookClient` 인스턴스 생성 후 `client.books.*`, `client.orders.*`, `client.covers.*`, `client.contents.*`, `client.credits.*` 메서드로 교체
- 모든 API Route catch 블록: `err.response?.status` → `err.statusCode`, `err.response?.data?.message` → `err.message` 로 단순화
- 응답 래핑: SDK가 `body.data`만 반환하므로 `ok(data)` 헬퍼로 `{ success: true, data }` 구조 유지 (프론트 호환성 보장)

---

## 📅 2026-04-02 — [UI/UX 설계] 전략적 미리보기(Blurred Preview) 기능 구현

### 배경

모든 페이지를 미리보기로 노출할 경우 발생할 수 있는 콘텐츠 무단 복제 방지 및 사용자의 결제 전환율(Conversion Rate)을 높이기 위한 비즈니스적 장치 마련. 음원·전자책 플랫폼의 "맛보기 재생", 전자상거래의 "회원 전용 콘텐츠" UX 패턴을 포토북 도메인에 적용.

### 구현 기술

CSS Filter (blur) 속성과 인덱스 기반 조건부 렌더링을 활용하여 상위 5페이지만 선명하게 노출하고, 나머지 페이지는 `blur-md` 클래스로 시각적으로 제한함.

| 항목 | 내용 |
|------|------|
| 선명 노출 | 상위 `PREVIEW_THRESHOLD = 5` 페이지 |
| 블러 처리 | 나머지 전체 페이지에 `blur-md` 적용, `pointer-events: none`으로 인터랙션 차단 |
| 오버레이 CTA | 블러 영역 위에 그라디언트 오버레이 + 자물쇠 아이콘 + "주문하러 가기" 버튼 배치 |
| 이미지 소스 | 더미 데이터의 picsum 시드 이미지 활용 (서비스 타입별 일관된 시각 테마 유지) |
| 반응형 그리드 | `grid-cols-2 → sm:grid-cols-3 → md:grid-cols-5`로 화면 크기별 자동 대응 |

### 비즈니스 효과

- **전환율 제고**: "더 보려면 주문해야 한다"는 심리적 동기 부여로 이탈률 감소 기대
- **콘텐츠 보호**: 스크린샷·복사로 전체 내용을 무단 취득하는 행위를 기술적으로 억제
- **UX 일관성**: 오버레이 버튼이 하단의 "다음: 주문하기" 버튼과 동일한 `btn-primary` 스타일을 공유하여 시각적 통일성 유지

---

## 📅 2026-04-02 — [기능 구현] 사진 직접 업로드 (Drag & Drop + Photos API 연동)

### 배경 & 문제

기존 에디터는 이미지 URL 텍스트 입력만 지원했음. 사용자가 직접 보유한 사진을 업로드할 방법이 없어, 더미 데이터(picsum URL)에만 의존해야 했음. 과제 평가 항목 "Photos API 활용도"를 충족시키기 위해 파일 업로드 UI를 구현.

### 구현 내용

| 항목 | 내용 |
|------|------|
| 업로드 UI | 에디터 페이지 각 페이지 편집 패널 내 Drag & Drop 존 + 클릭 파일 선택 |
| 미리보기 | 파일 선택 즉시 `URL.createObjectURL(file)`로 blob URL 생성, 로컬 미리보기 표시 |
| 업로드 시점 | "책 생성 & 최종화" 버튼 클릭 시 → 책 생성(POST /books) 후, staged 파일을 Photos API(POST /books/{uid}/photos)로 순차 업로드 |
| URL 교체 | 업로드 완료 후 반환된 실제 URL로 blob URL 자동 교체 → 내지 contents API 파라미터에 주입 |
| Fallback | URL 직접 입력 필드 유지 (더미 데이터, 외부 이미지 URL 지원) |
| 상태 표시 | 로딩 버튼에 "사진 업로드 중..." 텍스트 + 업로드 대기 파일 수 뱃지 표시 |

### 기술 결정

- **staged 파일 패턴**: `stagedFiles` state를 `{ pageId: File }` 맵으로 관리. 각 페이지당 최대 1개 파일. blob URL은 미리보기 전용, 실제 API 요청에는 업로드된 URL만 사용.
- **업로드 시점 지연**: Photos API는 bookUid 없이 호출 불가. 책 생성 직후 업로드하는 순서를 `handleCreateBook` 내부에서 보장.
- **에러 격리**: 개별 사진 업로드 실패 시 전체 플로우를 중단하지 않고 로그에 경고 기록 후 계속 진행.

---

## 📅 2026-04-02 — [기능 확장] 외부 LLM 연동을 통한 동화책 자동 생성 로직 구현

### 배경

'AI 동화책' 서비스가 기존에는 더미 데이터(picsum 이미지 + 하드코딩 텍스트)를 단순 재사용하는 방식이었음. 과제에서 요구하는 "바이브코딩 역량" 어필과 실질적인 AI 기능 시연을 위해, 생성형 AI를 실제 콘텐츠 파이프라인에 연결하는 작업이 필요했음.

### AI 모델 선택: Google Gemini 2.0 Flash

| 항목 | Claude API | Gemini 2.0 Flash |
|------|-----------|-----------------|
| 무료 티어 | 제한적 | **분당 15회 / 월 150만 토큰** (2026년 기준) |
| 한국어 품질 | 최상 | 상 (동화 생성에 충분) |
| 레이턴시 | 중간 | **빠름** (Flash 모델) |
| SDK | @anthropic-ai/sdk | **@google/generative-ai** |

→ 무료 티어와 속도를 고려해 **Gemini 2.0 Flash** 채택. 동화 생성이라는 단순 텍스트 태스크에서 Claude와 품질 차이 없음.

### 구현 아키텍처

```
[create/fairytale 폼]
  → "AI 동화 생성하기" 버튼 클릭
  → POST /api/generate-story { heroName, heroAge, theme, moralLesson }
  → Gemini API 호출 (JSON 구조화 출력 프롬프트)
  → 10페이지 pages[] 배열 반환
  → sessionStorage('bookmaker_ai_pages') 임시 저장
  → /editor 이동
  → editor useEffect: AI 페이지 우선 로드 & sessionStorage 즉시 삭제
  → 사용자 편집 후 → 기존 책 생성 플로우 그대로 진행
```

### 프롬프트 설계

- **출력 형식 강제**: "순수한 JSON만 반환하세요" + 마크다운 코드 블록 제거 처리
- **페이지 수 고정**: 정확히 10개 요구 → API 최소 24p 조건 충족을 위해 에디터에서 반복 패딩
- **서사 구조 지정**: 시작(1~2) → 갈등/모험(3~7) → 해결(8~9) → 결말과 교훈(10)
- **안전 처리**: JSON 파싱 실패 시 별도 에러 메시지 반환, 빈 pages 배열 방어 코드

### 구현된 파일

| 파일 | 변경 내용 |
|------|---------|
| `src/app/api/generate-story/route.js` | 신규 — Gemini 연동 API 라우트 |
| `src/app/create/[serviceType]/page.jsx` | AI 생성 패널(버튼 + 로딩 UI + 에러) 추가 |
| `src/app/editor/page.jsx` | AI 페이지 우선 로드 로직 + AI 생성 배지 표시 |
| `.env.example` | `GEMINI_API_KEY` 항목 추가 |
| `package.json` | `@google/generative-ai` 의존성 추가 |

### UX 설계: 로딩 화면

시연 영상 임팩트를 위해 로딩 중 3단계 힌트 메시지를 순차적으로 페이드인:
1. "이야기 구조 설계 중..."
2. "캐릭터와 배경 구성 중..."
3. "각 장면 집필 중..."

버튼 텍스트도 `"AI가 {heroName}을(를) 위한 동화를 집필 중입니다..."` 로 동적 변경.

---

## 📅 2026-04-02 — [기능 확장] 에디터 내 AI 페이지 초안 생성 — 6개 서비스 전체 지원

### 배경 & 목적

이전 구현에서 AI 생성 기능은 "AI 동화책" 서비스의 정보 입력 단계(create 페이지)에만 한정되어 있었음. 이를 **에디터(페이지 구성 단계)로 이동**하고, **6개 서비스 전체**가 AI 도움을 받을 수 있도록 확장.

사용자 니즈: "정보 입력 단계가 아닌, 실제 페이지를 구성하는 에디터 단계에서 AI 도움을 받고 싶다."
→ 에디터의 페이지 목록 패널에 "✨ AI로 페이지 초안 생성" 버튼을 배치하고, 클릭 시 서비스별 입력 폼 모달을 노출.

### 구현 내용

| 항목 | 내용 |
|------|------|
| 진입점 | 에디터 페이지 좌측 패널 상단 "✨ AI로 페이지 초안 생성" 버튼 |
| 모달 폼 | 서비스 타입별 최소 입력 필드 (2~4개) — 서비스 진입 맥락을 이미 알고 있으므로 경량 설계 |
| API 확장 | `POST /api/generate-story`에 `serviceType` 필드 추가, 6개 전용 프롬프트 템플릿 분기 |
| 결과 처리 | 기존 페이지 없으면 자동 교체 / 있으면 "교체 or 추가" 컨펌 다이얼로그 |
| 로딩 UX | 단계별 힌트 메시지 페이드인 ("아이디어 구상 중..." → "문장 구성 중..." → "페이지 편집 중...") |

### 서비스별 프롬프트 설계 전략

| 서비스 | 핵심 입력 | 프롬프트 지시 |
|--------|----------|-------------|
| baby | 아이 이름, 기록 기간 | 월령별 성장 이정표 10개 (첫 미소, 뒤집기, 이유식...) |
| kindergarten | 원아 이름, 반, 학기 | 수업·활동·행사 알림장 10개, 선생님 어투 |
| fairytale | 주인공, 주제, 교훈 | 시작→갈등→해결→결말 구조 동화 10페이지 |
| travel | 여행지, 제목, 동행인 | 출발→명소→음식→감상 여행 일기 10개 |
| selfpublish | 제목, 장르, 소개 | 장르에 맞는 챕터 초안 10개 |
| pet | 이름, 종류, 메시지 | 반려동물 시선의 성장 앨범 10페이지 |

### 아키텍처 결정: create 페이지 AI 패널 유지

- fairytale 서비스의 create 페이지 AI 패널은 그대로 유지. 정보 입력 단계에서 바로 생성하는 "빠른 경로"와 에디터에서 생성하는 "세밀 조정 경로" 두 가지를 모두 제공.
- 두 경로 모두 동일한 `/api/generate-story` 엔드포인트 호출.

---

## 📅 2026-04-02 — [버그 수정] Gemini 429 할당량 초과 대응 + 빌드 오류 수정

### 문제 1: Gemini API 429 Too Many Requests

**증상**
```
[GoogleGenerativeAI Error]: Error fetching from ... 429 Too Many Requests
Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
limit: 0, model: gemini-2.0-flash
```
무료 계정 한도 초과로 모든 Gemini 모델 호출 불가.

**해결 전략: 순차 모델 폴백 + 로컬 템플릿 폴백**

1. `GEMINI_MODELS` 배열 도입: `['gemini-1.5-flash-8b', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-pro']`
   - 무료 한도가 비교적 넉넉한 경량 모델부터 순차 시도
2. `callGemini()` 함수: 각 모델 실패 시 다음 모델로 이동, 전체 실패 시 `{ok: false}` 반환
3. `generateFallback()` 함수: Gemini 전체 실패 시 6개 서비스별 한국어 콘텐츠 템플릿(10페이지씩) 내장
   - picsum.photos seed 이미지로 시각적 완성도 유지
4. 응답에 `source: 'gemini' | 'fallback'` 필드 포함 → 클라이언트가 출처 구분 가능
5. 폴백 사용 시 `notice` 메시지 포함 → 에디터에서 안내 알림 표시

**결과**: Gemini API가 완전히 불가한 상황에서도 AI 초안 생성 버튼이 항상 10페이지를 반환

---

### 문제 2: 빌드 오류 — `today`, `seed` 변수 중복 정의

**증상**
```
x the name `today` is defined multiple times
x the name `seed` is defined multiple times
```
`generateFallback()` 함수 내 41-42줄과 138-139줄에 동일한 변수가 이중 선언됨. 이전 작성 시 함수 구조 리팩토링 과정에서 발생한 잔존 코드.

**수정**: 137번 이후 중복 선언 2줄 제거 (함수 상단 선언만 유지)

---

---

## 📅 2026-04-02 — [고도화] 사용자 선택권 보장을 위한 AI 초안 미리보기 및 조건부 적용(교체/추가) 로직 구현

### 배경 & 목적

기존 AI 초안 생성은 `window.confirm`으로 교체/추가를 선택한 뒤 즉시 페이지에 반영했음.
이는 생성 결과를 확인하지 않고 적용하게 되어 사용자 선택권이 낮고, 시각적으로도 빈약했음.
→ **생성 완료 후 내용을 먼저 미리본 다음** 교체/추가/취소 중 하나를 명시적으로 선택하도록 UX 개선.

### Step 1 — Gemini 통신 로직 개선

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 모델명 형식 | `gemini-1.5-flash` (축약형) | `models/gemini-1.5-flash` (정식 명칭) |
| 모델 시도 간 대기 | 없음 | 시도 사이마다 1,000ms 대기 (`RETRY_DELAY_MS`) |
| 전체 실패 시 로그 | `console.warn` (간략) | `console.error`로 각 모델의 에러 메시지 전체 출력 |

- `delay()` 헬퍼 함수 추가 — `Promise + setTimeout` 패턴
- for-loop 인덱스로 첫 번째 시도는 대기 없이, 2번째부터 대기 후 재시도

### Step 2 — `draftData` 임시 상태 및 미리보기 모달

`editor/page.jsx`에 두 가지 상태 추가:
```js
const [draftData, setDraftData] = useState(null);        // 생성된 초안 임시 저장
const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
```

`handleAiGenerate()` 수정:
- 기존: API 응답을 바로 `setPages()` 호출
- 변경: `setDraftData(data.data)` 저장 → `setIsPreviewModalOpen(true)` 모달 오픈

### Step 3 — AI 초안 미리보기 모달 + 3-버튼 액션

**모달 구성**:
- 헤더: 생성 출처(Gemini AI / 기본 템플릿), 페이지 수
- 폴백 사용 시 amber 색상 안내 배너
- 책 제목 표시
- 스크롤 가능한 페이지 목록 (제목 + 본문 2줄 미리보기)

**버튼 3종**:

| 버튼 | 로직 |
|------|------|
| 전체 페이지 교체 | `setPages(draftData.pages)` → 모달 닫기 |
| 페이지 뒤에 추가 | `setPages(prev => [...prev, ...draftData.pages])` → 모달 닫기 |
| 작업 취소 | `setDraftData(null)` → 모달 닫기, 기존 pages 무변경 |

### 아키텍처 결정

- 미리보기 모달은 입력 폼 모달(`showAiPanel`)과 별도로 독립 관리 — 두 모달이 동시에 열리지 않도록 생성 완료 시 폼 모달은 닫고 미리보기 모달 오픈
- `draftData`가 null이면 미리보기 모달 렌더링 자체를 스킵 (조건부 렌더링)
- 3버튼 중 어떤 것을 눌러도 반드시 `setDraftData(null)` + `setIsPreviewModalOpen(false)` 실행 → 상태 오염 없음

<!-- 새 기록 추가 시 아래 템플릿 복사 -->
<!--
## 📅 YYYY-MM-DD — 제목

### 결정/문제
(설명)

### 해결 과정
(과정)

### 결과
(결과)
-->
