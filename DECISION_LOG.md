# DECISION_LOG.md — 핵심 기술 의사결정 기록

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
dummy.js 및 `public/images/portfolio/` 로컬 경로(`/images/...`) 지원 추가:
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

## ADR-08 — 프로덕트 피벗: '북메이커' → 'ARCHIVE'

### 배경
기존 6개 카테고리(육아·여행·동화 등) 범용 포토북 플랫폼 → "무엇이든 할 수 있지만 아무것도 특별하지 않은" 서비스라는 피드백.

### 결정
**단일 서비스 `archive`** — 개발자/크리에이터를 위한 프리미엄 포트폴리오 북.

| 변경 | 내용 |
|------|------|
| UI/UX | Black & White 미니멀 매거진 스타일, JetBrains Mono |
| 서비스 | 6개 → `archive` 1개 |
| 디자인 | cream/warm → neutral 그레이스케일, 둥근 모서리 → 직각 |

엔진 코드(sweetbook.js, API 라우트, 에디터 핵심 로직)는 전면 무변경.

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
