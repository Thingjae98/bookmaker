# KidCanvas 면접 예상 질문 & 답변 가이드

> 스위트북 '바이브코딩 풀스택 개발자' 면접 대비 자료

---

## 1. 기술 스택 선택

### Q: Next.js를 선택한 이유는?

**핵심 답변**: API Key 보안과 풀스택 단일 저장소 요구사항을 동시에 충족하는 최적의 프레임워크.

**상세**:
- **과제 요구사항**: "백엔드 서버가 API Key를 관리하고 Book Print API와 통신" → 서버 사이드 필수
- **API Routes**: `src/app/api/` 디렉토리에 백엔드 프록시를 Next.js 프로젝트 내부에 구현 → 별도 Express 서버 불필요
- **모노레포**: 프론트엔드 + 백엔드가 하나의 저장소에서 동일한 의존성과 배포 파이프라인 공유
- **App Router**: React Server Components, 파일 기반 라우팅, 레이아웃 시스템 등 최신 React 패턴 활용
- **대안 검토**: CRA + Express(2개 서버 관리 복잡), Remix(API 프록시 패턴이 Next.js보다 불편), Vite + Hono(생태계 작음)

### Q: Tailwind CSS를 선택한 이유는?

- 빠른 프로토타이핑 — 클래스명으로 즉시 스타일링, CSS 파일 분리 불필요
- 디자인 시스템 통합 — `tailwind.config.js`에서 `peach`, `butter`, `mint` 등 커스텀 파스텔 팔레트 정의 → 전체 프로젝트 일관성
- 반응형 유틸리티 — `sm:`, `md:` 브레이크포인트로 모바일 대응
- 번들 사이즈 — PurgeCSS 내장으로 사용하지 않는 스타일 자동 제거

### Q: TypeScript를 사용하지 않은 이유는?

- 과제 안내문에 "TypeScript 사용 금지" 명시
- 대신 JSDoc 주석과 명확한 변수명으로 타입 안전성 보완
- `sweetbook.js`의 `ok()` 래퍼 등 일관된 응답 구조로 런타임 안정성 확보

---

## 2. 서비스 기획

### Q: 왜 "아이 그림 작품집"을 선택했는가?

**핵심 답변**: 감성 + 비즈니스 + 독창성 + 기술 활용 4가지 축에서 모두 최고점.

**상세**:
- **감성**: 아이 그림은 시간이 지나면 잊혀지지만, 부모에게는 가장 소중한 작품. "버려질 수 있는 것을 영구적으로 남긴다"는 본질이 Book Print API와 완벽히 일치
- **비즈니스**: 유아교육 시장(어린이집/유치원) B2B 연간 계약 모델 가능. 학기별 작품집 → 반복 매출
- **독창성**: 기존 예시 서비스(여행 포토북, 웨딩 앨범 등)와 차별화. 유사 서비스가 거의 없음
- **AI 시너지**: Gemini Vision으로 아이 그림을 분석 → 미술관 큐레이터 스타일 해설 자동 생성. 단순 사진 앨범이 아닌 "작품집"으로 가치 상승

### Q: 서비스 피벗 과정(북메이커 → ARCHIVE → KidCanvas)을 설명해 주세요

1. **북메이커**(초기): 6개 카테고리 범용 포토북 → "무엇이든 할 수 있지만 특별하지 않은" 서비스
2. **ARCHIVE**: 개발자 포트폴리오 북 → 기술적으로 완성도 높으나 감성/비즈니스 어필 약함
3. **KidCanvas**: 아이 그림 작품집 → 감성+비즈니스+기술 3요소 모두 강력

**교훈**: 기술 스택(sweetbook.js, API Routes, 에디터 엔진)은 전면 무변경. 서비스 레이어(디자인, 더미 데이터, AI 프롬프트)만 교체 → 엔진/서비스 분리 아키텍처의 효과

---

## 3. 아키텍처 & API 설계

### Q: API 프록시 구조를 설명해 주세요

```
[브라우저] → fetch('/api/books') → [Next.js API Route] → SweetBook SDK → [api-sandbox.sweetbook.com]
```

- 프론트엔드는 자체 API Route만 호출 → API Key가 클라이언트에 절대 노출되지 않음
- API Route에서 `sweetbook.js` 라이브러리의 함수를 호출 → SDK가 인증 헤더 주입
- 에러 발생 시 `err.statusCode`를 HTTP 응답 코드로 전파

### Q: Idempotency Key를 왜 구현했는가?

- **문제**: `fetchWithRetry`가 5xx 에러 시 3회 자동 재시도 → 같은 POST 요청이 중복 실행될 수 있음
- **해결**: `crypto.randomUUID()` 기반 `Idempotency-Key` 헤더를 모든 상태 변경 요청에 주입
- **409 Conflict**: 이미 처리된 요청은 409 반환 → 안전하게 무시
- **실무 관점**: 결제/주문 시스템에서 중복 방지는 필수. 네트워크 불안정 환경에서 데이터 무결성 보장

### Q: `getBook` 405 에러를 어떻게 해결했는가?

- **발견**: `GET /books/{bookUid}` 단건 조회가 SweetBook Sandbox에서 405 반환 (빈 body)
- **영향**: `res.json()` 호출 시 "Unexpected end of JSON input" → 미리보기 무한 스피너
- **해결**: `listBooks({ limit: 100 })` → 전체 목록 조회 후 `bookUid`로 `find()` 필터링
- **방어**: 프론트엔드에서도 API 실패 시 `{ _error: true }` 설정 → 무한 스피너 방지
- **교훈**: 외부 API는 문서대로 동작하지 않을 수 있음. 우회 전략과 폴백 항상 준비

### Q: breakBefore 문제를 어떻게 발견하고 해결했는가?

- **증상**: 24장 내지 전송 성공 → `POST /finalization` 400 에러. 일기장A만 정상
- **디버깅**: 일기장A의 템플릿 메타데이터와 다른 카테고리를 비교 → `breakBefore` 속성 발견
- **원인**: `breakBefore: 'none'`(연속 플로우)이면 여러 content가 한 물리적 페이지에 합쳐져 실제 페이지 수 < 전송 수 → `pageMin` 미달
- **해결**: `breakBefore: 'page'`를 안전 기본값으로 설정 → 1 content = 1 물리적 페이지 보장
- **결과**: 전 카테고리(7개) finalize 100% 성공

---

## 4. AI 활용

### Q: Gemini Vision을 어떻게 활용했는가?

**개별 생성** (`AI TEXT` 버튼):
- `/api/generate-page-text` → Gemini API로 페이지별 텍스트 생성
- 메타데이터(제목, 인덱스, 프로젝트 정보)만 사용

**일괄 생성** (`AI 텍스트 일괄 생성` 버튼):
- 26장 이미지를 브라우저에서 base64 인코딩
- 5장씩 6배치로 분할 → `/api/generate-batch-text` 순차 호출
- Gemini 2.5 Flash Vision이 실제 그림을 분석 → 색감, 구도, 표현 기법 해석
- 미술관 큐레이터 스타일 프롬프트 → 부모가 감동할 수 있는 해설 생성

### Q: 왜 5장씩 배치 분할하는가?

- **문제**: 26장 PNG(~8.7MB) → base64(~11.6MB)가 Next.js API Route body 제한 초과
- **해결**: 5장씩 분할 → 각 배치 ~2MB → 6회 순차 API 호출
- **사용자 경험**: 진행률 표시("배치 3/6 처리 중...") → 체감 대기 시간 단축
- **장애 격리**: 한 배치 실패 시 해당 배치만 폴백 텍스트 → 나머지 정상 결과 유지

### Q: Claude 대신 Gemini를 선택한 이유는?

- Gemini: 영구 무료 티어(250 RPD), Vision 기본 지원, `@google/generative-ai` SDK 간편
- Claude: API 호출당 과금, 무료 티어 없음
- 과제 특성상 평가자가 직접 실행할 수 있어야 하므로 무료 API 우선

---

## 5. Webhook 구현

### Q: Webhook 아키텍처를 설명해 주세요

**3-Layer 구조**:

| Layer | 역할 | 엔드포인트 |
|-------|------|-----------|
| 1. 수신 + 검증 | HMAC-SHA256 서명 검증, 중복 방지 | `POST /api/webhooks/sweetbook` |
| 2. ngrok 연동 | SweetBook에 Webhook URL 등록/테스트 | `PUT/POST /api/webhooks/config` |
| 3. 시뮬레이션 | ngrok 없이 로컬에서 상태 전이 시연 | `POST /api/webhooks/sweetbook/simulate` |

**서명 검증 상세**:
```
HMAC-SHA256(timestamp + '.' + body, secret) → hex digest → X-Webhook-Signature 비교
```
- `crypto.timingSafeEqual()` 사용 → 타이밍 공격 방어
- `X-Webhook-Delivery` ID로 중복 이벤트 필터링

### Q: 시뮬레이션을 왜 구현했는가?

- **문제**: ngrok 없이는 로컬에서 Webhook 수신 불가 → 시연/평가 시 외부 도구 의존
- **해결**: 시뮬레이션 엔드포인트가 실제 Webhook 핸들러를 내부 호출 → 동일한 서명 검증 파이프라인 통과
- **UX**: 주문 상세 모달에서 "다음 상태로 전이" 버튼 → order.created → production → shipping → delivered 풀 플로우 시연 가능

---

## 6. 트러블슈팅

### Q: 개발 중 가장 어려웠던 기술적 문제는?

**유령 템플릿 문제** (3-Layer Defense):
- **증상**: 카테고리 변경 후 책 생성 시 400 에러
- **원인**: 이전 카테고리의 `templateUid`가 갤러리 아이템에 잔존 → 다른 카테고리 UID로 API 호출
- **깊이**: 단순 초기화로는 불충분. 3중 방어 체계 필요
  1. `categoryToTplMap` — 현재 카테고리 스코프 UID만 허용
  2. `useEffect([selectedCategory])` — stale UID 즉시 null 초기화
  3. `handleCreateBook` — `validUids.has()` 최종 게이트키핑
- **교훈**: 상태 관리가 복잡해지면 단일 방어선은 불충분. 방어를 계층화하여 어디서든 잘못된 값이 새어도 다음 층에서 잡는 구조

### Q: Decorative File Binding 문제는 어떻게 해결했는가?

- **증상**: 알림장A 카테고리에서 `POST /contents` 500 에러
- **원인**: `lineVertical`, `pencilIcon` 등이 `binding: 'file'`로 정의 → 사용자 사진으로 오분류 → 잘못된 파라미터 전송
- **해결**: `DECORATIVE_FILE_KEYS` Set 도입 → 장식용 vs 사용자 사진 파일 바인딩 명확 분리
- **효과**: 전 카테고리(7개) API 100% 호환

---

## 7. 코드 품질 & 설계

### Q: 상태 관리를 어떻게 처리했는가? (외부 라이브러리 없이)

- **sessionStorage**: 페이지 간 상태 공유 (에디터 → 미리보기 → 주문)
- **URL Query Params**: `?isNew=true`로 신규 vs 복원 모드 구분
- **React useState/useEffect**: 컴포넌트 내부 상태
- **이유**: 과제 규모에서 Redux/Zustand는 오버엔지니어링. 단일 사용자 흐름이므로 브라우저 내장 스토리지로 충분

### Q: 에러 처리 전략은?

- **API Routes**: `try/catch` + `err.statusCode` HTTP 전파
- **fetchWithRetry**: 5xx 3회 자동 재시도, 지수 백오프 (1s → 2s → 4s)
- **프론트엔드**: API 호출 실패 시 폴백 UI (에러 배지, Toast 알림)
- **AI 배치**: 개별 배치 실패 시 폴백 텍스트 → 전체 실패 없이 부분 성공

### Q: 코드 구조에서 가장 신경 쓴 부분은?

**엔진/서비스 분리**:
- `sweetbook.js` (엔진): SweetBook API 통신, SDK 래핑, 재시도 로직 → 서비스 변경에 무관
- `editor/page.jsx` (서비스): 갤러리 UI, 템플릿 바인딩, AI 통합 → 엔진에 의존하지만 교체 가능
- **증거**: ARCHIVE → KidCanvas 피벗 시 엔진 코드 0줄 변경

---

## 8. 비즈니스 & 확장성

### Q: 프로덕션 배포 시 추가로 필요한 것은?

- **인증**: NextAuth.js → 사용자별 작품집 관리
- **DB**: PostgreSQL + Prisma → 주문 이력, 사용자 데이터 영속화
- **이미지 저장**: S3/R2 → 현재 임시 파일 → 영구 저장
- **Webhook**: Redis/DB 기반 이벤트 로그 → 현재 인메모리
- **결제**: Toss Payments/카카오페이 → 실결제 연동
- **모니터링**: Sentry(에러), Datadog(APM)

### Q: B2B 확장은 어떻게 구상하는가?

- **어린이집/유치원 연간 계약**: 학기별 작품집 일괄 제작
- **관리자 대시보드**: 원별 학생 관리, 일괄 주문, 진도 추적
- **구독 모델**: 월/분기 정기 작품집 제작 → MRR(월간 반복 매출)
- **API 확장**: 대량 주문 API, 학급별 템플릿 커스터마이징

---

## 9. 바이브코딩 & AI 활용

### Q: Claude를 어떻게 활용했는가?

- **아키텍처 설계**: API 프록시 구조, 템플릿 시스템, Webhook 아키텍처
- **코드 작성**: 프론트엔드/백엔드 전체 코드, API 연동, 에러 핸들링
- **트러블슈팅**: SweetBook API 문서 분석, breakBefore 발견, 405 우회
- **문서 작성**: README, DECISION_LOG, CLAUDE.md
- **코드 리뷰**: 보안 취약점 검토, 성능 최적화 제안

### Q: AI 활용의 장단점은?

**장점**:
- 반복적인 보일러플레이트 코드 작성 시간 대폭 단축
- API 문서 분석 + 트러블슈팅에서 패턴 인식 능력 활용
- 여러 대안을 빠르게 비교 검토 (DECISION_LOG에 기록)

**단점/주의점**:
- AI가 생성한 코드를 이해하지 못하면 디버깅 불가 → 반드시 코드 리뷰
- 외부 API와의 연동은 실제 테스트가 필수 (AI가 API 스펙을 정확히 알지 못할 수 있음)
- 코드 생성 속도가 빨라도 설계 결정은 개발자의 판단이 필수

### Q: 바이브코딩에서 가장 중요한 역량은?

- **방향 설정 능력**: AI에게 무엇을 시킬지 결정하는 것이 가장 중요. 잘못된 방향의 코드를 빠르게 생성하면 오히려 손해
- **검증 능력**: AI 출력물의 정확성과 보안성을 판단할 수 있는 기술적 역량
- **디버깅 능력**: AI가 해결하지 못하는 문제(예: breakBefore, 405 등)를 직접 분석하고 해결하는 능력
- **기획력**: 기술이 아닌 "무엇을 만들 것인가"에 대한 판단 → KidCanvas 서비스 기획

---

## 10. 빈출 기술 질문

### Q: React의 렌더링 최적화를 어떻게 적용했는가?

- `useMemo`: 카테고리 그룹 정렬(`catNames`), 유효 템플릿 UID Set 등 비용이 큰 연산 캐싱
- `useCallback`: 이벤트 핸들러 메모이제이션 (불필요한 자식 리렌더링 방지)
- 조건부 렌더링: 스켈레톤 UI → 데이터 로드 완료 시 실제 컴포넌트 교체

### Q: Next.js App Router vs Pages Router 차이는?

- **App Router**: 파일 기반 라우팅(`app/` 디렉토리), React Server Components, Layout 시스템, Loading/Error UI
- **Pages Router**: `pages/` 디렉토리, `getServerSideProps`/`getStaticProps`
- **선택 이유**: App Router가 Next.js 14의 권장 방식이며, API Routes와 페이지를 동일 구조로 관리 가능

### Q: CORS 이슈는 없었는가?

- Next.js API Routes는 같은 도메인(`localhost:3000`)에서 서빙 → CORS 불필요
- 브라우저 → 자체 API Route → SweetBook API 구조이므로 브라우저가 외부 API를 직접 호출하지 않음
- 이것이 바로 API 프록시 패턴의 장점
