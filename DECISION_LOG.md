# DECISION_LOG.md — KidCanvas 핵심 기술 의사결정 기록

> 개발 중 주요 기술 선택 이유와 문제 해결 과정을 기록합니다.

---

## ADR-00 — Auto Compose: 이미지 기반 자동 페이지 구성

### 배경
24페이지를 하나씩 편집하는 것은 사용자에게 높은 허들. 사진만 올리면 자동으로 표지/내지를 구성해 주는 기능 필요.

### 결정
AI Vision 분석 없이 **규칙 기반 자동 배치** 채택 (이미지 분석은 향후 AI 텍스트 생성과 통합 예정):
- 첫 이미지 → 앞표지, 마지막 → 뒤표지
- 중간 이미지 → 내지 순서대로 배치
- 목표 페이지 수 - 실제 이미지 수 = 빈 슬롯(text-only) 자동 패딩
- 2페이지 단위 정렬(Spread 규격 준수)
- 구성 후 사용자가 자유롭게 수정 가능 (비파괴적 워크플로우)

### UI
갤러리 상단에 `AUTO COMPOSE` 버튼 (이미지 1장 이상 업로드 시 노출) → 클릭 시 페이지 수 입력 패널 확장 (24~130p) → `COMPOSE` 버튼으로 즉시 실행.

### 로컬 이미지 지원
dummy.js 및 `public/images/kidcanvas/` 로컬 경로(`/images/...`) 지원 추가:
- `makePageUrl()`: `startsWith('/')` 조건 추가로 로컬 경로 프리뷰 허용
- `handleCreateBook`: 로컬 경로 이미지를 `fetch()` → `Blob` → `File` 변환 후 Photos API 업로드

---

## ADR-01 — breakBefore: 'page' 발견과 동적 레이아웃 페이지 렌더링

### 문제
SweetBook API에서 24장의 내지를 성공적으로 전송했음에도 `POST /finalization`에서 400 에러 반환. 전 카테고리에서 일기장A만 정상 동작.

### 근본 원인 발견
SweetBook Dynamic Layout 엔진의 `breakBefore` 속성이 페이지 카운트에 직접적 영향을 미치는 것을 발견:
- `breakBefore: 'none'` (연속 플로우) → rowGallery 템플릿에서 여러 content가 한 물리적 페이지에 합쳐져 실제 렌더링 페이지 수 < 전송한 content 수 → pageMin 미달 → 400
- `breakBefore: 'page'` (독립 페이지) → 1 content = 1 물리적 페이지 → 페이지 수 예측 가능

### 결정
안전 기본값을 `'page'`로 설정. 각 content가 독립 페이지로 배치되어 `pageCount = 내지 전송 수`와 일치하게 보장.

```javascript
const resolvedBreakBefore = meta.breakBefore || 'page';
```

### 결과
전 카테고리(일기장A, 알림장A/B/C, 구글포토북A/B/C) finalize 100% 성공.

---

## ADR-02 — Decorative File Binding 분리 아키텍처

### 문제
알림장A 카테고리에서 `POST /contents` 500 에러 발생. 원인: `lineVertical`, `pencilIcon` 등의 파라미터가 `binding: 'file'`로 정의되어 있어 `hasFileBinding()` 함수가 이를 사용자 사진으로 오분류 → `withPhoto` 카테고리에 배치 → 잘못된 파라미터 전송.

### 결정
`DECORATIVE_FILE_KEYS` Set을 도입하여 장식용 파일 바인딩과 사용자 사진 바인딩을 명확히 분리:

```javascript
const DECORATIVE_FILE_KEYS = new Set([
  'lineVertical', 'pencilIcon', 'weatherIcon', 'parentBalloon',
  'teacherBalloon', 'heartIcon', 'starIcon', 'lineHorizontal',
  'borderImage', 'backgroundImage', 'watermark', 'logo', 'pointColor',
]);
```

- `hasFileBinding()`: 장식용 키 제외 후 사용자 사진 바인딩만 감지
- `handleCreateBook`: 장식용 파일에는 투명 placeholder 이미지 자동 주입
- `isDecorativeFile(key)` 헬퍼: 장식 여부 O(1) 판별

### 영향
7개 카테고리 전체에서 API 호환성 100% 달성. 템플릿 분류 정확도 향상.

---

## ADR-03 — 유령 템플릿 차단 3-Layer Defense

### 문제
카테고리 변경 시 이전 카테고리의 templateUid가 갤러리 아이템에 잔존 → 다른 카테고리의 UID로 API 호출 → 400 에러.

### 결정: 3중 방어 체계

| Layer | 위치 | 메커니즘 |
|-------|------|----------|
| 1 | `categoryToTplMap` | 글로벌 상수 폴백 제거 — 현재 카테고리 스코프 UID만 허용 |
| 2 | `useEffect([selectedCategory])` | `validUids` Set 교차검증 → stale UID null 초기화 |
| 3 | `handleCreateBook` 루프 | `validUids.has()` 최종 게이트키핑 |

### 결과
카테고리 전환 → 즉시 책 생성 시에도 400 에러 제로.

---

## ADR-04 — Idempotency-Safe 트랜잭션 파이프라인

### 문제
네트워크 불안정 시 `fetchWithRetry`의 자동 재시도가 중복 주문/책 생성을 유발할 수 있음.

### 결정
- `crypto.randomUUID()` 기반 `Idempotency-Key` 헤더를 모든 상태 변경 요청(POST/PATCH/DELETE)에 자동 주입
- 409 Conflict 응답을 정상 흐름으로 안전 처리 (이미 처리된 요청)
- 주문 생성 시 `externalRef: bookmaker-order-${uuid}`로 고유 참조 ID 확보

### 결과
5xx 재시도 시에도 중복 리소스 생성 원천 차단.

---

## ADR-05 — Category 기반 템플릿 아키텍처 (API 필드만 신뢰)

### 문제
기존 `templateName.split('_')[0]` 문자열 파싱 방식은 API 네이밍 규칙 불규칙 → 테마명 오분류 → 400 에러.

### 결정
API 공식 필드만 사용하는 Top-Down 아키텍처:
- `theme` 필드 → 1차 카테고리 그룹화
- `templateKind` → 2차 역할 분류 (cover/content/divider/publish)
- `parameters.definitions[key].binding` → 3차 세분화 (file/text/rowGallery/collageGallery)

문자열 파싱 함수(`classifyTemplateRole`, `parseThemeName`, `KNOWN_THEME_PREFIXES`) 전부 삭제.

### 결과
- 새 카테고리 추가 시 코드 수정 불필요 (API 응답 자동 반영)
- templateKind 교차 사용 원천 차단

---

## ADR-06 — URL Query 파라미터 기반 스마트 상태 관리

### 문제
- Main → Create → Editor → back → Create: 폼 데이터 유실
- Main → Editor: 이전 세션 데이터 잔존으로 에디터 오염
- DRAFT 저장이 debounce(500ms) 대기 중 router.push로 누락

### 결정
`?isNew=true` URL 쿼리 파라미터로 신규 프로젝트 vs 뒤로가기를 구분:
- `isNew=true`: ARCHIVE_EDITOR_STATE 삭제 → 클린 상태로 초기화
- `isNew` 없음: ARCHIVE_EDITOR_STATE에서 gallery + selectedCategory 복원
- Create 제출 시 DRAFT 즉시 저장 (debounce 우회)
- Main/Header `clearEditorState()`: 4개 sessionStorage 키 전체 삭제

### 결과
뒤로가기/새로고침 시 100% 상태 보존, 신규 시작 시 클린 슬레이트 보장.

---

## ADR-07 — Photos API fileName 참조 체계

### 문제
`POST /books/{bookUid}/photos` 응답에 URL 필드가 없음. 기존 코드가 `url`, `photoUrl`, `fileUrl` 등 14개 필드를 탐색해도 모두 null.

### 발견
SweetBook Photos API는 `fileName`(`photo260404064434599.PNG`)을 반환. 이것이 SweetBook 내부 사진 참조 ID이며, 템플릿 파라미터에 fileName을 전달하면 렌더링 엔진이 book 스코프 내에서 자동 조회.

### 결정
- `uploadFile()` 반환값을 `fileName`으로 통일
- 미리보기 렌더링용 URL은 `safePreviewUrl()` 헬퍼로 원본 갤러리 `previewUrl` 사용 (fileName을 `<img src>`에 넣으면 404)
- `resolveImageUrl()` 안전망: `http/blob/data:` 이외 문자열은 null 반환

---

## ADR-08 — 프로덕트 피벗: '북메이커' → 'ARCHIVE' → 'KidCanvas'

### 배경 (1차 피벗: ARCHIVE)
기존 6개 카테고리(육아·여행·동화 등) 범용 포토북 플랫폼 → "무엇이든 할 수 있지만 아무것도 특별하지 않은" 서비스라는 피드백.

### 결정 (1차)
**단일 서비스 `archive`** — 개발자/크리에이터를 위한 프리미엄 포트폴리오 북.

### 배경 (2차 피벗: KidCanvas)
ARCHIVE는 기술적으로 완성도 높았으나, **감성+기술+비즈니스** 3요소를 모두 강하게 어필하기 어려움. 포토북 제작의 핵심 수요를 분석한 결과:
- 아이 그림은 시간이 지나면 버려지지만, 책으로 남기고 싶은 부모의 욕구가 매우 강함 (감성 ★★★★★)
- 유아교육 시장 + 어린이집/유치원 B2B 연간 계약 가능 (비즈니스 ★★★★★)
- 유사 서비스가 거의 없음 (독창성 ★★★★★)
- 기존 기술(Auto Compose, AI TEXT, Webhook)을 100% 재활용 가능 (기술 ★★★★★)

### 결정 (2차)
**단일 서비스 `kidcanvas`** — 부모가 아이 그림 사진을 업로드 → AI 작품 해설 → 미술관 도록 스타일 포토북.

| 변경 | 내용 |
|------|------|
| 서비스 | `archive` → `kidcanvas` |
| 디자인 | B&W neutral → 따뜻한 파스텔(peach/butter/mint), 둥근 UI |
| 폰트 | JetBrains Mono → Nanum Pen Script (손글씨 느낌) |
| AI 프롬프트 | 개발자 회고 → 미술관 큐레이터 스타일 아이 그림 해설 |
| 더미 데이터 | 포트폴리오 → Gemini 생성 아이 그림 26장(+커버 2장) 시나리오 |
| 추천 템플릿 | `구글포토북A` → `일기장B` (동화책 스타일) |

엔진 코드(sweetbook.js, API 라우트, 에디터 핵심 로직)는 전면 무변경.

### 더미 데이터 고급화 (2026-04-07)
- picsum.photos 플레이스홀더 → **Gemini 생성 아이 그림 이미지 28장**으로 교체
- 이미지 경로: `public/images/kidcanvas/` (cover_front/back.png + row-{1~4}-column-{1~7}.png)
- date 포맷: `YYYY-MM` → `YYYY-MM-DD` (템플릿 date/dayLabel/dateLabel 바인딩 완전 호환)
- 페이지 수: 24p → 26p (이미지 26장 전량 활용)
- 각 이미지 내용에 맞는 제목 + 미술관 큐레이터 스타일 해설 텍스트 재작성

### 템플릿 선택 근거
| 카테고리 | 적합도 | 근거 |
|---------|--------|------|
| `일기장B` | ★★★★★ | 동화책/스토리북 구조, 사진+텍스트 레이아웃, 날짜 기록 지원 — 아이 그림+해설에 최적 |
| `일기장A` | ★★★★ | 육아 일기 스타일, 날짜/제목/본문이 작품 기록과 유사 |
| `구글포토북A` | ★★★ | 유연한 사진 중심 레이아웃, 다양한 크기 아트워크 배치 |
| `알림장B` | ★★ | 유치원 알림장 특화, 작품집 포맷과는 결이 다름 |

---

## ADR-09 — 로컬 이미지 경로 안전 처리 (Preview 흰 화면 수정)

### 문제
더미 데이터 또는 로컬 이미지(`/images/portfolio/...`)를 사용한 페이지가 최종화 후 미리보기(preview)에서 흰 화면으로 표시. 텍스트만 렌더링되고 이미지 영역이 비어 있음.

### 근본 원인
두 곳의 URL 검증 함수가 로컬 경로(`/`로 시작)를 유효하지 않은 URL로 거부:
- `resolveImageUrl()` (preview/page.jsx): `^(https?:|blob:|data:)` 정규식에 `/images/...` 불매칭 → null 반환
- `safePreviewUrl()` (editor/page.jsx): 동일 정규식 → 에디터에서 미리보기 데이터 저장 시 로컬 경로 누락

### 결정
두 함수 모두에 `|| src.startsWith('/')` 조건 추가:
```javascript
if (/^(https?:|blob:|data:)/i.test(src) || src.startsWith('/')) return src;
```

### 결과
로컬 이미지 + picsum + 업로드 이미지 모두 미리보기에서 정상 렌더링.

---

## ADR-10 — Gemini 기반 페이지별 AI 텍스트 생성

### 배경
24페이지의 회고/캡션 텍스트를 사용자가 직접 작성하는 것은 높은 진입 장벽. Create 페이지에서 입력한 프로젝트 정보를 활용해 AI가 초안을 생성해 주는 기능 필요.

### 결정
- `/api/generate-page-text` API Route 신설 — Google Gemini API 호출
- 모델 폴백 체인: `gemini-flash-lite-latest` → `gemini-2.5-flash` → 규칙 기반 폴백 텍스트
- 프롬프트 컨텍스트: bookTitle, authorName, role, techStack, period, bookDescription + 페이지 제목/인덱스
- 에디터 편집 패널에 `AI TEXT` 버튼 추가 — 레거시 textarea와 동적 long text 필드 모두 지원
- 생성된 텍스트는 사용자가 자유롭게 수정 가능 (비파괴적)

### UI
편집 패널 내 텍스트 입력 필드 옆에 `AI TEXT` 버튼 (로딩 시 `AI...` 표시). 클릭 시 해당 페이지의 텍스트 필드에 AI 생성 텍스트 자동 입력.

### 결과
한 번의 클릭으로 프로젝트 맥락에 맞는 2~3문장 회고 텍스트 자동 생성. 전 템플릿 카테고리 호환.

---

## ADR-11 — Webhook 완전 구현: 서명 검증 + ngrok 연동 + 시뮬레이션

### 배경
SweetBook API가 Webhook을 지원하지만 기존 구현은 `console.log`만 수행. 로컬(localhost)에서 외부 Webhook 수신 불가.

### 결정: 3-Layer Webhook 아키텍처

**Layer 1 — 수신 + 검증** (`POST /api/webhooks/sweetbook`):
- SweetBook 공식 이벤트 8종 파싱 (`order.created`, `production.confirmed`, `shipping.departed` 등)
- HMAC-SHA256 서명 검증: `X-Webhook-Signature` + `X-Webhook-Timestamp` → `crypto.timingSafeEqual()`
- `X-Webhook-Delivery` ID로 중복 이벤트 무시
- `SWEETBOOK_WEBHOOK_SECRET` 미설정 시 검증 스킵 (개발 환경 친화적)

**Layer 2 — ngrok 연동** (`PUT/POST /api/webhooks/config`):
- SweetBook API `PUT /webhooks/config` 프록시 — ngrok URL 입력 → 자동 등록
- `POST /webhooks/test` 프록시 — 테스트 이벤트 전송
- 주문 내역 페이지에 설정 패널 UI (URL 입력 + 이벤트 유형별 테스트 버튼)

**Layer 3 — 시뮬레이션** (`POST /api/webhooks/sweetbook/simulate`):
- ngrok 없이도 상태 전이 시뮬레이션 가능
- 주문 상세 모달에 "다음 상태로 전이" 버튼

### SweetBook 공식 이벤트 플로우
```
order.created → production.confirmed → production.started → production.completed → shipping.departed → shipping.delivered
```

### 로컬 시연 시나리오
```bash
# 방법 A: ngrok 사용 (실제 SweetBook Webhook 수신)
ngrok http 3000
# → 주문 내역 > Webhook 설정 > ngrok URL 입력 > 등록 > 테스트 전송

# 방법 B: 시뮬레이션 (ngrok 없이)
# → 주문 상세 > "다음 상태로 전이" 반복 클릭 > 이벤트 로그 확인
```

### 시뮬레이션 서명 호환
시뮬레이션 엔드포인트(`simulate/route.js`)가 내부 Webhook 엔드포인트를 호출할 때, `SWEETBOOK_WEBHOOK_SECRET`이 설정되어 있으면 동일한 HMAC-SHA256 서명을 생성하여 헤더에 포함. 시크릿 설정 유무와 관계없이 시뮬레이션이 정상 작동.

### 한계
- 인메모리 → 서버 재시작 시 로그 초기화 (프로덕션: DB/Redis 필요)
- 시뮬레이션은 UI 전용 — SweetBook API 실제 상태 미변경

---

## ADR-12 — API 검증 파이프라인: 업로드/최종화 이중 검증

### 배경
책 생성 파이프라인에서 사진 업로드와 최종화가 성공했다고 가정만 하고, 실제 서버 상태를 검증하지 않았음. 업로드 누락이나 최종화 이상이 있어도 감지 불가.

### 결정
2개의 기존 미사용 API를 파이프라인에 추가:

**검증 1 — 사진 업로드 검증** (STEP 2-c):
- 모든 사진 업로드 완료 후 `GET /api/books/{bookUid}/photos` 호출
- API 서버에 등록된 사진 수 vs 로컬 전송 수를 교차검증
- 누락 시 API 로그에 경고 표시

**검증 2 — 책 상태 검증** (STEP 6):
- 최종화 완료 후 `GET /api/books/{bookUid}` 호출
- 실제 책 상태(status), 페이지 수, 제목, 판형 확인
- sessionStorage에 `bookStatus` 저장

### 구현
- `sweetbook.js`: `getBook(bookUid)` 함수 — `listBooks()` + UID 필터링 방식 (아래 ADR-13 참조)
- `GET /api/books/[bookUid]/route.js`: 신규 API 라우트
- `editor/page.jsx`: 사진 업로드 후 + 최종화 후 2회 검증 호출
- `preview/page.jsx`: 3개 API 병렬 호출 (책 상태 + 사진 수 + 충전금 잔액)

### 결과
- 사진 누락을 최종화 전에 조기 감지 가능
- 최종화 후 실제 서버 상태를 확인하여 신뢰도 향상
- API 활용 깊이 증가 (Books API 5개 엔드포인트 사용)

---

## ADR-13 — getBook: listBooks 필터링 우회 전략

### 배경
`GET /books/{bookUid}` 단건 조회 API가 SweetBook 서버에서 **405 Method Not Allowed** 반환 (빈 응답 body). SDK `client.books.get(bookUid)`도 동일 405. `sweetFetch`가 빈 응답에 `res.json()` 호출 시 "Unexpected end of JSON input" 에러 발생 → 미리보기 페이지에서 "책 상태 확인 중..." 무한 스피너.

### 결정
`listBooks({ limit: 100 })` → 전체 목록 조회 후 `bookUid`로 필터링하여 단건 조회 대체.

### 근거
- `GET /books` (목록 조회)는 정상 동작 확인
- 목록 응답에 `status`, `pageCount`, `title`, `createdAt` 등 필요 필드 모두 포함
- 단건 API 미지원은 SweetBook Sandbox 제한으로 추정 — 우회가 유일한 방법

### 구현
```javascript
export async function getBook(bookUid) {
  const { data: books } = await listBooks({ limit: 100 });
  const list = Array.isArray(books) ? books : (books?.books || books?.items || []);
  const found = list.find((b) => b.bookUid === bookUid || b.uid === bookUid);
  if (!found) throw new Error(`Book not found: ${bookUid}`);
  return ok(found);
}
```

### 프론트엔드 폴백
- `preview/page.jsx`의 `fetchBookDetail`에서 API 실패 시 `{ _error: true }` 설정
- 에러 시에도 "상태: finalized" 배지 표시 (최종화 완료 후 진입하므로 상태 확정)
- 무한 스피너 방지

---

## 이전 디버깅 기록 요약

| 버그 | 원인 | 해결 |
|------|------|------|
| sweetFetch ok() 누락 | API 응답 래핑 불일치 | 전체 SDK 함수 ok() 래핑 통일 |
| 잘못된 bookSpecUid | `bs_` 접두사 빈 플레이스홀더 | 실제 UID(`SQUAREBOOK_HC`) 교체 |
| 잘못된 템플릿 UID | `tpl_F8d15af9fd` 등 미동작 | 실제 검증 UID 교체 |
| Photos API URL 추출 실패 | API가 URL 반환 안 함 | `fileName` 참조 체계 발견 |
| 미리보기 File 객체 크래시 | File 객체가 `<img src>`에 주입 | `resolveImageUrl()` + objectURL |
| 미리보기 404 | fileName이 상대경로로 해석 | `safePreviewUrl()` 헬퍼 |
| 판형 필터링 느슨 조건 | `bookSpecUid` null 통과 | 엄격 필터 `===` 교체 |
| 갤러리 배열 병합 오류 | 1:1 원칙 위반 (look-ahead) | consumed Set 삭제, 페이지 스코프 제한 |
| 더미 데이터 pageMin 위반 | 표지/내지 미분리 | frontCover/backCover 속성 분리 |
| Create→back 폼 유실 | debounce 대기 중 navigate | 즉시 저장 + 이중 복원 |
| DELIVERED(70) 시뮬레이션 오작동 | 경계 검사 누락 → CONFIRMED(30) 폴백 | `currentIdx >= STATUS_FLOW.length - 1` 명시적 400 처리 |
| 주문 모달 시뮬레이션 버튼 잘림 | `max-h-[80vh]`로 740px 뷰포트 초과 | `max-h-[90vh]`로 확장 |

---

## BUG-W1 — Webhook 시뮬레이션 DELIVERED(70) 폴백 버그

### 증상
`currentStatus: 70` (DELIVERED, STATUS_FLOW 마지막 항목)으로 시뮬레이션 요청 시
`"시뮬레이션 완료: CONFIRMED (30)"` 응답 반환 — 이미 최종 상태임에도 무한 루프 가능.

### 원인
```javascript
// 버그가 있던 코드 (simulate/route.js)
const currentIdx = STATUS_FLOW.findIndex((s) => s.status === currentStatus);
nextStatus = STATUS_FLOW[currentIdx + 1].status; // currentIdx = 7 (마지막), [8]은 undefined
// → nextStatus = undefined
if (!nextStatus) {
  nextStatus = 30; // 기본값 CONFIRMED(30)으로 폴백! ← 버그
}
```

`currentIdx + 1`이 배열 범위를 벗어나 `STATUS_FLOW[8]`이 `undefined` → `nextStatus`가 `undefined` → `if (!nextStatus)` 조건에 걸려 기본값 30(CONFIRMED)으로 폴백.

### 해결
경계 검사를 `nextStatus` 할당 전에 명시적으로 수행:

```javascript
if (currentIdx >= STATUS_FLOW.length - 1) {
  const lastLabel = STATUS_FLOW[STATUS_FLOW.length - 1].label;
  return NextResponse.json(
    { success: false, message: `이미 최종 상태(${lastLabel})입니다. 더 이상 전이할 상태가 없습니다.` },
    { status: 400 }
  );
}
nextStatus = STATUS_FLOW[currentIdx + 1].status;
```

### 검증
```bash
# DELIVERED에서 다음 상태 요청 → 400 오류 반환 확인
curl -X POST http://localhost:3000/api/webhooks/sweetbook/simulate \
  -H "Content-Type: application/json" \
  -d '{"orderUid":"Y2TZAJ8W","currentStatus":70}'
# → {"success":false,"message":"이미 최종 상태(DELIVERED)입니다. 더 이상 전이할 상태가 없습니다."}

# SHIPPED(60) → DELIVERED(70) 정상 전이 확인
curl -X POST http://localhost:3000/api/webhooks/sweetbook/simulate \
  -H "Content-Type: application/json" \
  -d '{"orderUid":"Y2TZAJ8W","currentStatus":60}'
# → {"success":true,"message":"시뮬레이션 완료: DELIVERED (70)",...}
```

---

## BUG-W2 — 주문 상세 모달 하단 버튼 잘림

### 증상
740px 이하 높이 뷰포트(예: 노트북 화면)에서 주문 상세 모달의 "Webhook 시뮬레이션" 섹션 및 "다음 상태로 전이" 버튼이 모달 하단 밖으로 잘려 접근 불가.

### 원인
모달 컨테이너에 `max-h-[80vh]` 적용 — 740px 뷰포트 기준 80% = 592px. 주문 상세 내용(주문번호, 상태, 항목, 배송지, 취소 버튼, 시뮬레이션 버튼)이 592px 초과 → 하단 잘림.

### 해결
`src/app/orders/page.jsx`의 모달 컨테이너 클래스 변경:
```jsx
// Before
<div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 modal-enter"
// After
<div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 modal-enter"
```

90vh = 740px 뷰포트 기준 666px — 전체 모달 내용 + 시뮬레이션 섹션 포함 가능.
