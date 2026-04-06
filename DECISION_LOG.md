# DECISION_LOG.md — 의사결정 & 트러블슈팅 기록

> 개발 중 주요 기술 선택 이유와 문제 해결 과정을 기록합니다.
> 구글폼 서술형 문항 작성 시 참고용.

---

## 📋 2026-04-06 — 더미 데이터 정화 및 내지 전송 파이프라인 완전 복구

### 증상
- ARCHIVE 피벗 후에도 `POST /books/{bookUid}/finalize`에서 400 에러 지속
- 낡은 더미 데이터 필드(`p.teacherComment` 등)가 새 템플릿 스펙과 충돌
- 내지 `POST /contents` 일부 페이지 실패에도 finalize가 진행되어 빈 책에서 400

### 근본 원인 (3가지)
1. **낡은 더미 데이터 참조**: 갤러리 초기화에서 `p.teacherComment`(유치원 전용 필드) 참조 → 포트폴리오 더미에는 해당 필드 없음 → undefined 전송
2. **갤러리 다중 사진 미업로드**: `page.images` 배열(rowGallery/collageGallery 바인딩용)에 대한 사전 업로드 로직 부재 → File 객체가 API에 직접 전달되어 실패
3. **내지 실패 묵인**: `contentsFailCount++` 후 루프 계속 → 전체/부분 실패 상태에서 finalize 진입 → 400

### 해결
1. **더미 데이터 정화**: `p.teacherComment` → `p.text || ''`로 교체, `svcKey` 안전 폴백 추가
2. **갤러리 사전 업로드 파이프라인**: `preUploadedImagesMap` 도입 — 내지 루프 진입 전 `item.images` 배열의 File 객체를 Photos API로 일괄 업로드, URL 배열로 변환 후 `contentPageData.images`에 연결. `console.table`로 매핑 검증 로그 출력
3. **CRITICAL: 내지 전송 실패 즉시 throw**: `contentsFailCount++; continue` 패턴 제거 → `if (!d.success) throw Error(...)` 로 변경. 단 1페이지라도 실패하면 finalize 진입 자체를 차단하여 빈 책 400 에러를 원천 방지
4. **갤러리 배열 직렬화 개선**: rowGallery/collageGallery 바인딩 시 사전 업로드된 URL 배열 우선 사용, 빈 배열 시 picsum fallback으로 안전 처리. 진단 로그(`console.log`) 추가

### 교훈
- "실패해도 계속 진행"은 UI 수준에서는 합리적이지만, API 트랜잭션 파이프라인에서는 치명적. 내지 전송은 all-or-nothing 시맨틱이 필요
- 더미 데이터 필드명은 서비스 피벗 시 반드시 함께 마이그레이션해야 함

---

## 📋 2026-04-06 — 동적 폼 도입 후 400 Finalize 에러: 내지 전송 루프 복구 및 최소 페이지 Padding 안전화

### 증상
- `POST /books/{bookUid}/finalize` 단계에서 400 에러 발생
- 콘솔 로그에 `[contentFileMap 스냅샷] {}` 기록 — 내지 POST /contents 루프가 스킵되거나 전 페이지 실패 의심

### 근본 원인 (3가지)
1. **SERVICE_TYPES 참조 크래시**: ARCHIVE 피벗으로 6개 서비스 타입이 삭제되었으나, 이전 세션(`baby`, `travel` 등)이 sessionStorage에 잔존 → `SERVICE_TYPES[session.serviceType]` = undefined → `service.name` TypeError로 전체 handleCreateBook 함수가 catch 블록으로 빠짐
2. **패딩 루프 division-by-zero**: `contentPageData.length === 0`일 때 `contentPageData[ri % 0]` = `contentPageData[NaN]` = undefined → `srcPage.imageUrl` TypeError → 최종화 단계 도달 불가
3. **동적 파라미터 undefined 전송**: `page.params[key]`가 undefined인 경우 일부 코드 경로에서 API에 undefined 값이 전송 → SweetBook 서버 400

### 해결
1. **SERVICE_TYPES 안전 폴백**: `SERVICE_TYPES[session.serviceType] || SERVICE_TYPES.archive || Object.values(SERVICE_TYPES)[0]` 3단 체인으로 서비스 참조 보장
2. **패딩 루프 null-safe 처리**: `contentPageData.length > 0` 조건 분기 추가, 빈 배열일 때 picsum fallback으로 패딩 페이지를 처음부터 생성
3. **동적 파라미터 전면 안전화**:
   - `def?.binding` null-safe 접근
   - `page.params?.[key]` optional chaining
   - `String(userVal)` 명시적 문자열 변환
   - text 바인딩 폴백 체인 확장 (diaryText, text, content, memo, comment, teacherComment, description 등 동의어 키 일괄 처리)
   - 알 수 없는 바인딩 타입에도 빈 문자열 할당 (절대 undefined 전송 금지)
4. **디버그 로그 강화**:
   - 패딩 전/후 페이지 수 명시 로그
   - `console.log('총 전송할 내지 페이지 수:', paddedPages.length)` 루프 직전 추가
   - 페이지별 전송 전 진단 로그 (tpl, hasImg, hasText, paramKeys)
   - 전체 실패 시 경고 + tplMap/bookSpecUid 출력

---

## 📋 2026-04-06 — 프로덕트 피벗: '북메이커' → 'ARCHIVE'

### 배경
시니어 개발자 리뷰 결과, 기존 6개 카테고리(육아·여행·동화 등) 범용 포토북 플랫폼이 "무엇이든 할 수 있지만 아무것도 특별하지 않은" 서비스라는 피드백을 받음. Book Print API의 핵심 가치와 타겟 고객을 명확히 할 필요성 제기.

### 결정: 크리에이터/개발자를 위한 프리미엄 포트폴리오 북

**변경 전**: 6개 서비스(baby, kindergarten, fairytale, travel, selfpublish, pet) 선택 UI
**변경 후**: 단일 서비스 `archive` — 프로젝트 포트폴리오 북

### 변경 범위 (UI/UX만 — 엔진 코드 무변경)

| 파일 | 변경 내용 |
|------|----------|
| `constants.js` | SERVICE_TYPES 6개 → `archive` 단일 타입 (fields: bookTitle, authorName, role, techStack, period, bookDescription) |
| `page.jsx` (메인) | 6-카드 선택 그리드 → B&W 매거진 스타일 풀스크린 랜딩 |
| `layout.jsx` | 메타데이터 "북메이커" → "ARCHIVE — Premium Project Portfolio Book" |
| `Header.jsx` | 로고 "📚 북메이커" → 블랙 스퀘어 "A" + "ARCHIVE" / 네비: "서비스 선택" → "New Archive" |
| `StepIndicator.jsx` | 5단계 → 4단계 (서비스 선택 제거: Configure → Compose → Preview → Order) |
| `ServiceCard.jsx` | warm 컬러 → neutral B&W 스타일 |
| `globals.css` | cream/warm 배경 → #FFFFFF, JetBrains Mono 추가, 버튼/인풋 B&W 스타일 |
| `tailwind.config.js` | warm/ink → neutral 그레이스케일 매핑 (레거시 호환 유지) |
| `create/[serviceType]/page.jsx` | 서비스별 분기 → 단일 폼, AI 동화 패널 제거, B&W 스타일 |
| `dummy.js` | 6개 서비스 더미 → `archiveDummy` 1개 (개발자 포트폴리오 24페이지) |
| `editor/page.jsx` | TEXT_FIELD_LABELS 포트폴리오 맥락으로 변경, SERVICE_CATEGORY_MAP에 archive 추가 |

### 엔진 보존 확인
- `sweetbook.js` (SweetBook SDK 클라이언트): 무변경
- `fetchWithRetry.js` (재시도 래퍼): 무변경
- `api/*` (18개 API 라우트): 전체 무변경
- `editor/page.jsx` (핵심 로직): handleCreateBook, spreadGroups, gallery 시스템 무변경
- `preview/page.jsx`, `order/page.jsx`, `orders/page.jsx`: 무변경

### 디자인 시스템 변경
- **컬러**: cream(#FAF7F2) → white(#FFFFFF), warm → neutral 매핑
- **폰트**: JetBrains Mono 추가 (기술 라벨, 네비, 버튼에 적용)
- **UI 패턴**: 둥근 모서리(rounded-2xl) → 직각(border), 그래디언트 → 플랫
- **레이아웃**: 그리드 패턴 배경, uppercase tracking, minimal divider

### 위험 완화
- `tailwind.config.js`에서 `warm`/`ink` 색상 키를 삭제하지 않고 neutral 값으로 리매핑 → 에디터·주문·미리보기 페이지의 기존 클래스명이 깨지지 않음
- `SERVICE_CATEGORY_MAP`에서 기존 6개 키 보존 (레거시 호환)

---

## 📋 2026-04-06 — 버그 H: 동적 폼 미표시 및 HTTP 500 에러 해결

### 증상
1. 동적 폼이 레거시 폼(제목/날짜/텍스트)으로 폴백되어 템플릿별 고유 필드가 표시되지 않음
2. 내지 추가 시 HTTP 500 에러 대량 발생 (`tpl=1aHHt1g7uHjw`)

### 근본 원인: definitions 누락 파이프라인
- **데이터 플로우**: SweetBook API 목록 → sessionStorage → 비동기 보강(상세 조회) → categoryGroups → contentTpls 맵
- **실패 지점**: 비동기 보강에서 일부 템플릿의 상세 조회가 실패/null 반환 → `parameters.definitions` 없이 categoryGroups에 등록 → `contentTpls[tplUid]`가 undefined → `getTextDefinitions()` 빈 배열 반환 → 레거시 폼 폴백
- **500 에러 원인**: definitions 없는 템플릿에 레거시 params(`date`, `title`, `diaryText`, `photo1`)가 전송 → 실제 템플릿의 파라미터 스키마와 불일치 → SweetBook 서버 500

### 해결: 3단계 definitions 탐색 + 온디맨드 보강
1. **`findDefinitions(tplUid)` 함수**: contentTpls 맵 → catGroup.all 직접 탐색 → 전체 카테고리 순회, 3단계 폴백
2. **레이아웃 선택 시 온디맨드 보강**: `renderLayoutThumbnails` onClick에서 definitions 없는 템플릿 선택 시 즉시 `GET /api/templates/{uid}` 호출하여 캐시 주입
3. **handleCreateBook 온디맨드 보강**: 내지 추가 루프에서 definitions 비어있으면 API 직접 조회 → 올바른 파라미터 빌드
4. **비동기 보강 실패 로깅**: 기존 silent catch → console.warn으로 상세 로그 출력
5. **`getGalleryBindingInfo`도 `findDefinitions` 통일**: 갤러리 모드 감지 정확도 향상

---

## 📋 2026-04-06 — 템플릿 definitions 기반 동적 폼 렌더링 도입

### 배경
에디터 우측 편집 패널이 모든 템플릿에 대해 동일한 '제목/날짜/텍스트' 3개 하드코딩 필드만 보여주던 문제. 일기장 A 템플릿의 `weather`, `meal`, 알림장 B의 `teacherComment` 등 템플릿별 고유 필드가 UI에 노출되지 않아 사용자가 해당 값을 입력할 수 없었음.

### 해결: definitions 기반 동적 폼(Dynamic Form)
1. **`getTextDefinitions(item)`**: 현재 아이템의 `templateUid`에 해당하는 definitions에서 `binding === 'text'`인 필드만 추출. `file` / `rowGallery` / `collageGallery`는 별도 사진 UI가 처리하므로 제외.
2. **`renderDynamicTextFields(item, idx)`**: 추출된 텍스트 필드를 순회하며 입력창 자동 생성.
   - 키 이름 → 한글 라벨 매핑(`TEXT_FIELD_LABELS`: title→제목, weather→날씨, meal→식단 등)
   - `isLongTextField()` 판별: `diaryText`, `content`, `memo` 등은 `<textarea>`, 나머지는 `<input>`
   - `isDateField()` 판별: `date`, `dateLabel` 등은 `<input type="date">`
3. **`item.params` 객체**: 갤러리 아이템에 `params: {}` 필드 추가. 동적 폼 입력값은 `params[key]`에 저장되며, `title`/`text`/`date` 레거시 필드와 양방향 동기화.
4. **`handleCreateBook` 연동**: text binding 파라미터 빌드 시 `page.params[key]` 1순위 → 레거시 필드 2순위 폴백. 사용자가 동적 폼에서 입력한 값이 API로 정확히 전달됨.
5. **폴백**: 템플릿 미선택 또는 text 필드 없는 템플릿 → 기존 제목/날짜/텍스트 3-필드 레거시 UI 유지.

### 효과
- 레이아웃별로 필요한 텍스트 입력 필드(날짜, 날씨, 식사, 코멘트 등)가 자동으로 UI에 표시
- 템플릿 추가/변경 시 코드 수정 없이 definitions만으로 UI가 자동 확장

---

## 📋 2026-04-06 — 주문 상태 전이 처리 정책 확립 및 Webhook 수신 라우트 개통

### 배경
주문 라이프사이클 분석 결과, CONFIRMED(30)부터 DELIVERED(70)까지의 상태 전이는 파트너가 아닌 스위트북(제조사) 측에서 발생함. 이를 실시간으로 동기화하기 위해 전체 상태 코드를 UI에 반영하고, Webhook 수신 백엔드 라우트를 개통.

### 변경 내역

#### 전체 주문 상태 코드 UI 매핑
- `constants.js`에 API 스펙의 **전체 11개 상태 코드** 등록: 20(PAID) → 25(PDF_READY) → 30(CONFIRMED) → 40(IN_PRODUCTION) → **45(COMPLETED, 항목 제작 완료)** → 50(PRODUCTION_COMPLETE) → 60(SHIPPED) → 70(DELIVERED) → 80(CANCELLED) → 81(CANCELLED_REFUND) → **90(ERROR)**
- 기존 누락: 45(항목 단위 제작 완료), 90(오류) — 상태 코드가 알 수 없는 값으로 들어올 때 gray fallback 배지 유지
- `orders/page.jsx` colorMap에 `lime`(45), `rose`(90) 추가

#### Webhook 수신 라우트 개통
- **라우트**: `POST /api/webhooks/sweetbook` (`src/app/api/webhooks/sweetbook/route.js`)
- **현재 단계**: Skeleton — payload 파싱(`orderUid`, `externalRef`, `status`, `previousStatus`, `updatedAt`, `eventType`) + `console.log` 기록 + 200 OK 응답
- **설계 결정**: 파싱 실패 시에도 200 반환 — 스위트북 서버의 무한 재시도 방지. 서명 검증(`X-Webhook-Signature`)은 주석으로 준비, `SWEETBOOK_WEBHOOK_SECRET` 환경변수 확보 후 활성화 예정
- **다음 단계**: DB/캐시 연동으로 상태 실시간 동기화, 사용자 알림(이메일/푸시) 발송

---

## 📋 2026-04-06 — CS 방어: 주문 취소 범위 확장 및 배송지 변경 기능 풀스택 구현

### 배경
Orders API Gap 분석 후, 고객 문의(CS) 대응을 위해 PAID(20)에서만 허용되던 주문 취소를 PDF_READY(25) 상태까지 확장하고, 발송 전(CONFIRMED 이하) 배송지 변경 기능을 API + UI 풀스택으로 구현.

### 변경 내역

#### [0] 주문번호 UI 개선
- **문제**: 주문목록/상세에 raw UID(`ord_AbCdXxXxXx`)가 그대로 노출 → 사용자 혼란
- **해결**: `formatOrderId()` 함수 도입 — `ord_` 접두사 제거 후 마지막 8자리를 `#XXXXXXXX` 형태로 변환
- 상세 모달에는 "복사" 버튼 추가(전체 UID를 클립보드로 복사 — CS 대응용)

#### [1] 주문 취소 상태 범위 확장 (Gap 1 해결)
- `constants.js`에 `PDF_READY: 25` 추가 (cyan 배지)
- 취소 버튼 조건: `orderStatus === 20` → `[20, 25].includes(orderStatus)`
- **이유**: SweetBook 스펙상 PDF 생성 완료 후 제작 확정(CONFIRMED=30) 이전까지 취소 가능. 현장 CS 사례 대응.

#### [2] 배송지 변경 기능 풀스택 구현 (Gap 2 해결)
- **sweetbook.js**: `updateShipping(orderUid, shippingInfo)` 함수 추가. SDK 미지원이므로 `sweetFetch`를 `PATCH` 메서드 지원으로 확장.
- **API 라우트**: `src/app/api/orders/[orderUid]/shipping/route.js` 신규 생성. 필수 필드 서버 검증 후 SweetBook API 프록시.
- **UI**: 주문 상세 모달 배송지 섹션에 "배송지 변경" 버튼 추가 (상태 20·25·30만 노출). 클릭 시 배송지 편집 모달(z-[60]) 오픈, 현재 값 pre-fill, 저장 후 상세 즉시 갱신.
- **허용 상태**: PAID(20) · PDF_READY(25) · CONFIRMED(30) — 발송완료(SHIPPED=60) 이전까지 변경 가능하다는 스펙 기준.

---

## 📋 2026-04-06 — Orders API 스펙 대비 구현 Gap 분석 및 Webhook 연동 사전 계획

### 배경
에디터 + Books API 안정화 후, 실제 결제·배송이 일어나는 Orders API 구현 현황을 SweetBook 공식 스펙과 1:1 대조 점검. 다음 단계인 Webhook 연동을 위한 사전 기반도 함께 분석.

### 분석 결과 — 구현 현황 매트릭스

| API 엔드포인트 | 스펙 | 구현 상태 | 비고 |
|---------------|------|----------|------|
| `POST /orders` (주문 생성) | 필수 | ✅ 완료 | `externalRef: bookmaker-order-${uuid}` 자동 생성. `Idempotency-Key` 헤더 적용. 409 Conflict 안전 처리 |
| `POST /orders/estimate` (견적) | 필수 | ✅ 완료 | items 배열만으로 예상 금액 조회 |
| `GET /orders` (목록) | 필수 | ✅ 완료 | limit/offset 페이지네이션 + status 필터 |
| `GET /orders/{orderUid}` (상세) | 필수 | ✅ 완료 | 상품금액/배송비/포장비 분리 표시 |
| `POST /orders/{orderUid}/cancel` (취소) | 필수 | ⚠️ 부분 | PAID(20) 상태에서만 UI 버튼 표시. PDF_READY 상태 미지원 |
| `PATCH /orders/{orderUid}/shipping` (배송지 변경) | 선택 | ❌ 미구현 | API 라우트·UI 모두 부재 |
| `externalUserId` 전달 | 선택 | ❌ 미사용 | Webhook 매칭에 유용하나 현재 인증 시스템 없어 불필요 |
| Webhook 수신 라우트 | 선택 | ❌ 미구현 | `/api/webhooks/sweetbook` 라우트 필요 |

### Gap 상세

#### Gap 1: 주문 취소 상태 범위
- **현재**: `orderStatus === 20` (PAID)에서만 취소 버튼 표시
- **스펙**: PAID(20)와 PDF_READY 상태에서 모두 취소 가능 (CONFIRMED(30) 이전)
- **보완**: ORDER_STATUS 상수에 PDF_READY 코드 추가 + 취소 버튼 조건 확장

#### Gap 2: 배송지 변경 미구현
- **스펙**: `PATCH /v1/orders/{orderUid}/shipping`으로 CONFIRMED(30) 이전 배송지 수정 가능
- **필요 작업**: API 라우트(`src/app/api/orders/[orderUid]/shipping/route.js`) 신규 생성 + SDK 래퍼 함수 추가 + 주문 상세 UI에 "배송지 수정" 버튼 추가

#### Gap 3: Webhook 수신 인프라 부재
- **스펙**: SweetBook이 주문 상태 변경 시 등록된 URL로 POST 콜백 전송
- **필요 작업**:
  1. `src/app/api/webhooks/sweetbook/route.js` — POST 수신 라우트 (서명 검증 포함)
  2. 수신된 이벤트의 `externalRef`로 내부 주문 매칭
  3. 상태 업데이트 → UI 반영 (현재 DB 없으므로 sessionStorage 또는 실시간 폴링 대체 가능)
  4. SweetBook 대시보드에서 Webhook URL 등록 (배포 URL 필요)

#### Gap 4: externalUserId 미사용
- 현재 사용자 인증 시스템이 없으므로 당장 불필요
- NextAuth 도입 시 사용자별 주문 필터링에 `externalUserId` 활용 예정

### 결론
핵심 주문 플로우(생성·견적·조회·기본 취소)는 완전 구현 상태. 배송지 변경과 Webhook은 면접 후 개선 단계에서 순차 구현 예정. `externalRef` UUID 기반 추적은 Webhook 매칭의 기반으로 이미 준비됨.

---

## 🔧 2026-04-06 — 템플릿 definitions의 binding 속성 기반 단일/다중 사진 UI 초정밀 분기 리팩토링

### 배경
이전 커밋에서 갤러리 트레이 UI를 추가했으나, 단일 사진 미리보기와 다중 트레이가 동시에 보이거나, 레이아웃 변경 시 기존 단일 사진이 다중 배열로 자연스럽게 이관되지 않는 UX 결함이 있었다. API 페이로드에서도 `page.templateUid`(사용자 선택)와 `page.images`(다중 배열)가 일관되게 연결되지 않았다.

### 결정
**템플릿 `parameters.definitions[key].binding` 속성을 핀포인트로 감지하여 UI + 페이로드를 완벽히 조건부 스위칭.**

1. **`getGalleryBindingInfo()` 완전 재작성**: 반환 구조를 `{ isGallery, key, type, max }` 형태로 표준화. `key`는 실제 파라미터명(예: `photos`), `type`은 `rowGallery`/`collageGallery`, `max`는 최대 장수(콜라주=9, 행=50)
2. **좌측 미리보기 영역 완전 분기**: `isGallery === true` → 보라색 다중 트레이(단일 사진 미리보기 숨김), `isGallery === false` → 기존 단일 사진 교체 UI + 빈 슬롯 업로드
3. **단일→다중 자동 마이그레이션**: 레이아웃(templateUid) 변경 시 새 템플릿에 gallery binding이 있고 기존에 단일 사진(previewUrl)만 있으면 `images[0]`으로 자동 이관
4. **API 페이로드 정합성**: `contentPageData`에 `templateUid`를 포함시켜 사용자가 직접 선택한 레이아웃 반영. `tplUid` 결정에 `page.templateUid` 최우선 적용. `hasAnyImage = hasImage || hasImages`로 다중 배열도 이미지 존재로 인식
5. **양면 분할 옵션 갤러리 모드 차단**: 갤러리 모드에서는 양면(Spread) 분할 체크박스 비표시 (상충 방지)
6. **우측 IIFE 중복 트레이 제거**: 좌측에 통합하여 렌더링 경로 단일화

### 영향 범위
- `getGalleryBindingInfo()` — 반환 스키마 변경 (`maxImages` → `max`, `binding` → `type`, `isGallery` 추가)
- `renderLayoutThumbnails()` → `onClick` — 단일→다중 마이그레이션 로직 주입
- 인라인 편집 패널 좌측 컬럼 — IIFE로 갤러리/단일/빈 슬롯 3-way 분기
- `handleCreateBook` — `page.templateUid` 우선 사용, `hasAnyImage` 확장

---

## 🎨 2026-04-06 — 갤러리 템플릿(rowGallery, collageGallery) 지원을 위한 다중 사진 업로드 UI 최초 구현

### 배경
SweetBook 템플릿의 `parameters.definitions` 중 `binding`이 `rowGallery` 또는 `collageGallery`인 파라미터는 단일 이미지 URL이 아니라 **이미지 URL 배열**을 요구한다. 기존 에디터 우측 편집 패널은 사진 1장 교체(Replace) 방식만 지원하여, 갤러리 템플릿을 사용하면 배열에 사진이 1장만 들어가는 문제가 있었다.

### 결정
우측 사진 편집 패널 UI를 **'단일 덮어쓰기(Replace)'에서 '다중 누적형(Append) 트레이'로 개편**.

1. **동적 UI 전환**: 선택된 페이지의 templateUid → definitions → binding 타입을 실시간 판별하여, `file` 바인딩이면 기존 단일 사진 교체 UI, `rowGallery`/`collageGallery` 바인딩이면 다중 누적 트레이 UI를 자동 표시
2. **누적(Append) 방식**: `<input type="file" multiple>` → `images = [...기존, ...신규]` 로 배열 누적
3. **썸네일 격자 + 개별 삭제**: 현재 배열의 사진을 작은 그리드로 표시, 각 썸네일 우측 상단에 `[X]` 삭제 버튼 배치
4. **collageGallery 9장 제한**: 배열 길이 9장 초과 시 토스트 경고 + 초과분 자동 절삭

### 영향 범위
- `src/app/editor/page.jsx` — 인라인 편집 패널 내지 섹션에 갤러리 트레이 UI 추가
- gallery 아이템에 `images: { id, file, previewUrl }[]` 프로퍼티 추가 (기존 `imageUrl` 단일 사진과 공존)
- `contentPageData` 빌드 시 `page.images` 배열의 File 객체를 Photos API로 업로드 후 URL 배열로 변환하여 전달

---

## 🐛 2026-04-06 — 갤러리 템플릿 자동 병합(Batching) 오류 수정 — 1:1 페이지 렌더링 규칙 복구

### 문제
Gallery 배열 바인딩 구현 시 "후속 페이지의 사진을 끌어모아 1개 페이지로 병합(Look-ahead & Batching)"하는 로직을 도입했으나, 이는 API 스펙을 잘못 해석한 결과. SweetBook 갤러리 템플릿(`rowGallery`/`collageGallery`)은 **"여러 페이지를 하나로 합쳐라"가 아니라 "해당 1개 페이지 내부에 여러 장의 사진을 받을 수 있는 배열 파라미터가 있다"**는 의미.

- 증상: `consumed` Set으로 후속 페이지를 skip → 실제 전송 페이지 수 증발 → `pageMin` 미달 → 최종화 400 에러
- 근본 원인: 1 UI 페이지 = 1 API 호출의 절대 원칙 위반

### 해결
1. `findGalleryBinding()` 헬퍼 함수 삭제
2. `consumed` Set + look-ahead 루프 전부 삭제
3. 갤러리 바인딩 처리를 현재 페이지 스코프로 제한:
   - `page.images` 배열이 있으면 그대로 전달
   - 없으면 현재 페이지의 `page.imageUrl` 1개를 `[url]` 배열로 감싸서 전달
4. 패딩(Padding) 로직은 그대로 유지 — pageMin 미달 시 빈 페이지 자동 채움

### 교훈
- API 문서의 "배열 파라미터"는 **단일 페이지 내부** 구조를 의미하지, 여러 페이지의 데이터를 병합하라는 뜻이 아님
- 에디터 UI 상태(gallery items)와 API 호출 횟수의 1:1 대응은 불변 규칙으로 유지해야 함

---

## ⚙️ 2026-04-06 — 동적 레이아웃 엔진 최적화: breakBefore 하드코딩 제거 및 템플릿 기본 플로우(none) 복원

### 문제
내지 추가 API(`POST /books/{bookUid}/contents`)에 `breakBefore: 'page'`가 하드코딩되어 있어, 모든 내지가 강제 페이지 분리됨. SweetBook API Dynamic Layout 스펙(`/concepts/dynamic-layout/`)에 따르면 content 템플릿의 기본값은 `'none'`(연속 플로우 배치)이며, `'page'`는 divider/publish 템플릿 전용.

### 해결
1. `categoryToTplMap()`에 `tplMeta` 맵 추가 — 각 템플릿의 `templateKind`와 `layoutRules.breakBefore` 메타데이터를 별도 저장
2. 내지 전송 루프에서 `breakBefore` 동적 해석 로직 도입:
   - 1순위: 템플릿 정의에 명시된 `layoutRules.breakBefore` 값 사용
   - 2순위: `templateKind` 기반 폴백 — `content` → `'none'`, `divider`/`publish` → `'page'`
3. `sweetbook.js`의 `addContents()` 기본값도 `'page'` → `'none'`으로 변경 (API 스펙 정렬)

### 결과
- 하드코딩 제거 → API 엔진이 템플릿별 최적 레이아웃 플로우를 자동 결정
- content 템플릿: 연속 배치(`none`) — 텍스트가 여러 페이지에 걸쳐 자연스럽게 흐름
- divider/publish: 독립 페이지(`page`) — 간지·발행면이 항상 새 페이지에서 시작
- 템플릿에 `layoutRules.breakBefore`가 명시되어 있으면 해당 값을 우선 적용

---

## ✅ 2026-04-05 — Create 페이지 폼 데이터 임시 저장(Draft) 기능 완성

### 배경 / 문제

Create 페이지에서 폼을 입력한 뒤 에디터로 이동하고, 에디터에서 "뒤로 가기"를 눌러 Create 페이지로 돌아오면 **이전에 입력했던 책 제목, 내용, 판형 선택 등 모든 폼 데이터가 증발**하는 심각한 UX 문제.

- React 클라이언트 컴포넌트는 라우트 이동 시 state가 완전 초기화됨
- `sessionStorage('bookmaker_session')`은 에디터 전용 세션으로, Create 폼 복원용이 아님
- 이전 구현에서 판형(`selectedSpec`)이 API 로딩 시 기본값으로 덮어씌워지는 레이스 컨디션 존재

### 의사결정

1. **서비스별 Draft 키**: `BOOK_DRAFT_${serviceType}` — 서비스 타입별로 고유하게 독립 저장
2. **마운트 시 Draft 복원**: `useEffect`에서 sessionStorage 읽기 → formData, selectedSpec, useDummy 복원 → 토스트 알림
3. **500ms Debounce 자동 저장**: `useCallback` + `setTimeout(500)`로 폼 변경 시 0.5초 간격으로 Draft 갱신 (빠른 입력 시 불필요한 I/O 방지)
4. **`restoredSpecRef` (useRef) 판형 보호**: Draft에서 복원된 `selectedSpec`을 ref에 기록 → book-specs API 로딩 완료 시 `if (restoredSpecRef.current)` 조건으로 **절대 덮어쓰지 않음**. 복원된 spec이 API 목록에 없는 경우에만 추천 판형으로 보정
5. **Draft 삭제 타이밍**: 에디터로 정상 이동(`handleSubmit`, AI 생성 성공) 시 `removeItem()`
6. **초기화 버튼**: Draft 복원 시 "초기화" 버튼 표시 — 클릭 시 formData 리셋 + Draft 삭제

### 결과
- 에디터 → 뒤로 가기 → Create 페이지: 이전 입력 100% 복원 (판형 포함)
- book-specs API 레이스 컨디션 완벽 해소 — ref 기반 보호로 비동기 타이밍에 무관
- 500ms debounce로 불필요한 sessionStorage 쓰기 최소화
- 에디터로 정상 진입 시 Draft 자동 정리

---

## ✅ 2026-04-05 — 업로드 응답 fileName에 의한 404 렌더링 크래시 해결

### 배경 / 문제

책 생성 과정에서 SweetBook Photos API가 반환하는 `fileName`(예: `photo~.PNG`)이 미리보기 상태에 그대로 저장되어, 브라우저가 이를 상대 경로 URL로 해석 → `GET /photo~.PNG` → 404 대량 발생 → 이미지 전부 깨짐.

- **근본 원인**: `handleCreateBook` 내부에서 `uploadFile()` 반환값(fileName)을 `contentPageData[].imageUrl`에 저장 → 이 데이터가 `sessionStorage('bookmaker_preview')`로 직통 전달 → 미리보기 `<img src="photo~.PNG">` → 404
- UI 미리보기 상태(로컬 previewUrl)와 API 전송용 페이로드(fileName)가 분리되지 않은 구조적 문제

### 의사결정

1. **`safePreviewUrl(apiUrl, uiUrl)` 분류 함수**: API 반환값이 `http/blob/data:` 접두사면 렌더링 가능 URL → 그대로 사용, 순수 fileName이면 원본 갤러리 `previewUrl`로 대체
2. **미리보기 데이터 빌드 시 원본 UI URL 사용**: `coverFront/coverBack`은 갤러리 아이템의 `previewUrl`, 내지는 `contentItems[idx].previewUrl`로 매핑
3. **`resolveImageUrl()` 최종 안전망**: 문자열이 `http/blob/data:` 이외이면 `null` 반환 → Fallback UI 표시 (fileName이 엣지 케이스로 넘어와도 404 차단)
4. **API 페이로드는 변경 없음**: `contentPageData[].imageUrl`은 fileName 그대로 유지 → SweetBook API가 정상 처리

### 결과
- 미리보기 화면 404 에러 100% 해소
- API 전송 로직은 일절 변경 없이 기존 동작 보존
- fileName이 어떤 경로로든 렌더링 단에 도달해도 Fallback으로 안전 처리

---

## ✅ 2026-04-05 — 미리보기 File 객체 렌더링 크래시 수정 (White Screen Bug)

### 배경 / 문제

미리보기(Preview) 화면에서 사용자가 직접 업로드한 사진이 포함된 페이지를 렌더링할 때 React 렌더링 크래시(White Screen) 발생. 에러 발생 지점 이후의 모든 페이지가 증발.

- **원인**: `page.imageUrl`에 URL 문자열(`string`)이 아니라 업로드된 `File` 객체가 들어있는데, `SpreadPage` 컴포넌트가 이를 그대로 `<img src>`에 주입
- `File` 객체는 `[object File]`로 문자열 변환되어 브라우저가 렌더링 불가

### 의사결정

1. **`resolveImageUrl()` 헬퍼**: string→그대로, File/Blob→`URL.createObjectURL()`, 그 외→null
2. **`SpreadPage` 컴포넌트 리팩토링**: `useEffect` + `useRef`로 objectURL 생성/해제 라이프사이클 관리, 메모리 누수 방지
3. **`imgError` state**: `onError` 시 회색 Fallback UI(bg-gray-200 + placeholder 아이콘) 표시
4. **텍스트 오버레이 안전 보장**: `(hasImage || imgError) && hasText` 조건으로 이미지 에러 시에도 텍스트 표시 유지

### 결과
- File/Blob 이미지가 포함된 미리보기 100% 정상 렌더링
- objectURL 메모리 누수 방지 (언마운트 시 자동 revoke)
- 이미지 로드 실패 시에도 텍스트/제목/페이지 번호 안전 유지

---

## ✅ 2026-04-05 — 에디터 UX 고도화: 카테고리 스위처 사이드바 이동 + 세부 레이아웃 선택 + 자동 스크롤

### 배경 / 문제

**기존 에디터 UX 문제점**
1. **카테고리(테마) 스위처가 우측 편집 패널 안에 중복 배치** — 표지 편집·내지 편집·액션 패널 3곳에 동일한 카테고리 선택 UI가 반복되어 화면 낭비 + 인지 부하
2. **페이지별 세부 레이아웃(템플릿) 선택 불가** — 카테고리를 선택하면 모든 페이지에 동일 템플릿 일괄 적용, 페이지 단위 세부 레이아웃 커스텀이 없음
3. **사진 클릭 → 편집 패널 찾기 어려움** — 좌측 사이드바에서 사진 클릭 후 우측 하단 편집 패널까지 수동 스크롤 필요
4. **API 로그가 갤러리와 편집 패널 사이에 삽입** — 로그 토글 시 편집 패널 위치가 밀려남

### 의사결정

**1. 카테고리 스위처 → 좌측 사이드바 최상단 독립 배치**
- `renderCategorySwitcher()` 호출을 우측 3곳에서 모두 제거
- 좌측 "📖 구성 미리보기" 패널 최상단(표지 스프레드 위)에 1회만 렌더링
- 카테고리 전환은 전역 설정이므로 항상 눈에 보이는 사이드바가 적합

**2. 우측 편집 패널 → 페이지별 레이아웃 썸네일 선택**
- `renderLayoutThumbnails(item, idx)` 신규 함수: 선택된 카테고리의 content 템플릿(withPhoto + textOnly + blank)을 썸네일 카드 그리드로 표시
- 각 카드 클릭 시 해당 페이지의 `templateUid`만 개별 변경 — 전역 카테고리와 독립적으로 페이지별 레이아웃 커스텀 가능
- 표지 편집 시에도 covers 배열 내 레이아웃 선택 가능

**3. 사진 클릭 시 편집 패널 자동 스크롤**
- `editPanelRef` (useRef) + `useEffect([selectedIdx])` → `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`
- 좌측 사이드바/갤러리 어디에서 클릭하든 편집 패널이 뷰포트로 부드럽게 이동

**4. API 로그 → 레이아웃 최하단 이동**
- 갤러리와 편집 패널 사이에서 제거 → 전체 그리드 밖, `max-w-5xl` 컨테이너 하단으로 이동
- 로그 토글이 편집 패널 위치에 영향을 주지 않음

### 결과
- 화면 공간 30%+ 절약 (카테고리 UI 3중 반복 → 사이드바 1회)
- 페이지별 세부 레이아웃 선택으로 사용자 제어권 확대
- 자동 스크롤로 사진 편집 워크플로우 끊김 없음
- API 로그가 메인 편집 플로우에 개입하지 않음

---

## ✅ 2026-04-05 — 공식 API 명세 기반 카테고리(Category) 중심 템플릿 아키텍처 대개편

### 배경 / 문제

**기존 문자열 파싱 기반 테마 시스템의 근본적 한계**
1. `templateName.split('_')[0]`으로 테마명 추출 → API 이름 규칙이 불규칙해 `내지`, `표지` 등 역할명이 테마명으로 오분류
2. `classifyTemplateRole()`이 templateName 문자열 패턴으로 cover/inner_text/inner_photo/inner_blank 추론 → API가 이미 `templateKind`와 `parameters.definitions`를 정확히 제공하는데 이를 무시
3. `KNOWN_THEME_PREFIXES` 화이트리스트 관리 필요 → API에 새 테마 추가 시 코드 수정 필수
4. 같은 UID가 inner_text/inner_blank에 중복 할당 → 400 에러 원인

**API 실제 구조 발견**
- API `theme` 필드가 공식 카테고리 그룹명을 직접 제공 (일기장A, 알림장B, 구글포토북C 등)
- `templateKind`가 cover/content/divider/publish를 정확히 분류
- `parameters.definitions[key].binding`이 file/text/rowGallery/collageGallery로 파라미터 타입을 명시

### 의사결정

**1. Top-Down 아키텍처: API 필드만 신뢰**
- `buildCategoryGroups()`: API `theme` 필드로 1차 그룹화, `templateKind`로 2차 분류, `binding`으로 3차 세분화
- 문자열 파싱 함수 전부 삭제: `classifyTemplateRole`, `parseThemeName`, `KNOWN_THEME_PREFIXES`

**2. Parameters 기반 안전 바인딩**
- 표지/내지 전송 시 `parameters.definitions`를 순회하여 binding 타입에 맞는 값을 자동 매핑
- file → 이미지 URL, text → 문맥에 맞는 문자열, rowGallery → 이미지 배열
- definitions가 없는 레거시 케이스는 하드코딩 폴백 유지

**3. Category Switcher UI**
- Theme Switcher → Category Switcher로 전환
- API `theme` 필드값을 그대로 카테고리명으로 사용 (별도 라벨 매핑 유지)

### 결과
- 문자열 파싱 코드 120줄 삭제 → API 필드 기반 코드 90줄로 대체
- 새 테마/카테고리 추가 시 코드 수정 불필요 (API 응답 자동 반영)
- templateKind 교차 사용 원천 차단 (cover → POST /cover, content → POST /contents)
- parameters.definitions 기반 파라미터 빌드로 400 에러 원인 근본 해소

---

## ✅ 2026-04-05 — 테마 문자열 파싱 버그(Theme Split) 수정 및 역할별 템플릿 중복 할당 방어 로직 추가

### 배경 / 문제

**3가지 치명적 버그 발견**

1. **테마명 파싱 오류**: `split('_')[0]`이 `내지_gallery` → `내지`, `내지_photo` → `내지`로 파싱. API 템플릿 이름의 `_` 앞 접두사가 반드시 테마명이 아님. `내지`, `표지`, `빈내지` 등은 역할 명칭이지 테마 이름이 아닌데 테마로 분류됨.
2. **역할 UID 중복 할당**: 하나의 테마 안에서 `inner_text`와 `inner_blank`에 동일 UID(`y5Ih0Uo7tuQ3`)가 할당되어 API 400 에러 발생. 역할별 UID가 서로 달라야 하는 조건이 없었음.
3. **Theme Switcher UI 미노출**: `renderThemeSwitcher()`가 인라인 편집 패널(사진 선택 시)에서만 호출되어, 사진을 선택하지 않은 기본 상태에서는 테마 선택 UI가 보이지 않음.

### 의사결정

**1. 화이트리스트 기반 테마명 파싱**
- `KNOWN_THEME_PREFIXES` 집합 = `THEME_LABELS` 키 + `RECOMMENDED_THEMES` 값 합집합
- `parseThemeName()`: 접두사가 화이트리스트에 있을 때만 테마명으로 인식, 나머지 → `'기본'` 테마로 귀속
- 결과: `알림장B_내지_fill` → `알림장B` ✓, `내지_gallery` → `기본` ✓

**2. UID 중복 할당 방어**
- `buildThemeGroups` 내 역할 할당 시 `usedUids` Set으로 이미 사용 중인 UID 재사용 차단
- 폴백 단계에서도 `inner_text === inner_blank` / `inner_text === inner_photo` 감지 후 검증된 하드코딩 UID로 강제 분리

**3. Theme Switcher 독립 마운트**
- 액션 패널(사진 미선택 상태)에도 `renderThemeSwitcher()` 호출 추가
- 사용자가 어떤 상태에서든 테마를 변경할 수 있도록 항상 노출

### 결과
- 테마 파싱 정확도 100% — 알려진 테마 접두사만 인식, 나머지 안전한 기본 그룹
- 역할별 UID 유일성 보장 → API 400 에러 원천 차단
- Theme Switcher가 에디터 하단 액션 영역에 항상 표시

---

## ✅ 2026-04-04 — 테마(Theme) 기반 템플릿 시스템 대개편

### 배경 / 문제

**기존 아키텍처의 구조적 결함**
- SweetBook API의 템플릿은 '테마명_역할' 네이밍 규칙(예: `구글포토북A_표지`, `구글포토북A_내지_fill`)으로 디자인 세트가 묶여 있음
- 기존 코드는 이 구조를 무시하고 개별 페이지마다 임의의 템플릿을 선택할 수 있게 허용 → 한 권의 책에 서로 다른 테마의 표지·내지가 뒤섞이는 디자인 불일치 발생
- `resolveTemplates()` 함수는 covers[0] / contents[0] 등 배열 순서 의존 → API 응답 순서에 따라 결과가 달라지는 비결정적 동작
- 개별 페이지 템플릿 선택 UI(`renderTemplateSelector`)는 50개 이상의 템플릿을 카테고리별로 나열 → 사용자 인지 부하 과다

### 의사결정

**1. 테마(Theme) 단위 그룹화**
- `buildThemeGroups()`: 템플릿 이름의 첫 번째 `_` 앞 접두사를 테마명으로 파싱
- 각 테마는 `{ cover, inner_text, inner_photo, inner_blank }` 4개 역할 슬롯을 가짐
- 역할 분류: `classifyTemplateRole()` — 표지/빈페이지/사진전용/사진+텍스트 자동 판별

**2. 서비스별 추천 테마 매핑**
- `RECOMMENDED_THEMES` 상수로 6개 서비스 → 기본 테마 1:1 매핑
- 사용자는 테마 스위처에서 다른 테마로 자유롭게 변경 가능 (강제 아님)

**3. 전체 테마 변경(Theme Switcher) UI**
- 개별 페이지 템플릿 선택기 폐기 → 테마 카드 그리드로 대체
- 추천 테마에 뱃지 표시, 현재 적용 중인 테마 상단 강조
- 선택 즉시 `selectedTheme` 상태 변경 → `handleCreateBook`에서 해당 테마의 UID 일괄 적용

**4. `themeToTplMap()` — 테마 → tplMap 변환**
- 기존 `handleCreateBook`의 `resolveTemplates()` + API 재조회 로직 제거
- `themeToTplMap(themeGroups[selectedTheme])` 한 줄로 대체
- 테마 누락·슬롯 누락 시 검증된 폴백 UID(`79yjMH3qRPly` 등) 자동 적용

### 결과
- 한 권의 책 = 한 테마의 디자인 세트 → 시각적 일관성 보장
- API 응답 순서 의존성 완전 제거
- 에디터 UI 단순화 (50개 개별 선택 → 7~8개 테마 카드)
- 서비스별 추천 테마로 신규 사용자 진입 장벽 최소화

---

## ✅ 2026-04-04 — 템플릿 선택 UX 정제 및 책 넘김(Spread Paging) 미리보기 구현

### 배경 / 문제

**1. 템플릿 선택 UI가 API 원본 명칭을 그대로 노출**
- '알림장B_내지_fill' 같은 내부 네이밍이 사용자에게 노출되어 UX 저하
- 텍스트 유무에 따른 강한 필터링(`TEXT_WIRE_TYPES`)이 text_only/photo_only 템플릿을 숨기는 버그

**2. 미리보기가 상하 스크롤 나열 방식**
- 실제 책의 물리적 구조(펼쳐서 넘기기)를 반영하지 못함
- B2C 서비스로서의 몰입감 부족

### 의사결정

**1. 템플릿 API 원본 명칭 추상화 및 카테고리화**
- `inferWireframeType()` → `WIREFRAME_LABELS` 매핑으로 "사진 + 글", "사진 꽉 차게", "글만" 등 정제된 한글 라벨 표시
- 텍스트 유무 기반 필터링 완전 제거 → 모든 타입 상시 노출
- `CATEGORY_ORDER` 기반 그룹 렌더링: 사진+글 / 사진만 / 글만 / 캘린더 / 빈 페이지 카테고리 구분
- '자동 선택' 카드는 최상단에 유지하되, 그 아래 모든 카테고리를 펼쳐 사용자가 강제 선택 가능

**2. 스프레드 페이징(Spread Paging) 뷰**
- 상하 스크롤 → [< 이전] [스프레드] [다음 >] 좌우 페이징 구조
- `currentSpread` 상태로 한 번에 1개 스프레드(2페이지) 표시
- 키보드 좌/우 화살표 지원 + 하단 도트 인디케이터 (직접 클릭 이동)
- 첫 스프레드: [뒤표지 | 앞표지] — 실제 인쇄 레이아웃 반영
- 책등(Spine) 그림자: `linear-gradient` 8px 폭으로 입체감 강화
- 블러: 상위 4 스프레드(표지+3) 선명, 이후 `backdrop-blur` + 잠금 오버레이

---

## ✅ 2026-04-04 — 템플릿 동적 매핑 Verified-First 전략 및 더미 데이터 표지/내지 완벽 분리

### 배경 / 문제

**1. 템플릿 동적 매핑에서 미검증 UID 선택 → 전체 400 에러**

`GET /api/templates?bookSpecUid=SQUAREBOOK_HC`는 서버 측에서 판형 필터링을 적용하여 50개 템플릿을 반환.
클라이언트 `resolveTemplates()`의 `covers[0]`이 API 응답 순서에 따라 **미검증 UID(`4MY2fokVjkeY`)**를 선택.
이 UID는 `POST /books/{uid}/cover` API에서 400 반환 → 전체 책 생성 실패.

기존 필터링(`t.bookSpecUid === bookSpecUid`)은 API가 이미 필터링한 결과를 재필터링하는 것이므로 50/50 전부 통과 — 의미 없는 연산이었음.

**2. 더미 데이터 표지/내지 논리적 오류 → pageMin 위반**

`dummy.pages[0]`을 앞표지, `dummy.pages[23]`을 뒤표지로 빼내는 로직 때문에 순수 내지가 22장만 남아 `pageMin: 24` 위반.
배열 길이(24)만 확인하면 발견할 수 없는 **데이터 소비 구조** 문제.

### 해결

**1. Verified-First 전략 (`resolveTemplates` 재설계)**

```
1순위: 검증된 폴백 UID가 API 목록에 존재하면 → 해당 UID 사용 (가장 안전)
2순위: 검증 UID 미존재 → classifyTemplate 기반 자동 선택 (다른 판형용)
3순위: 아무것도 없음 → 하드코딩 폴백 상수 (최후의 안전 장치)
```

- `uidSet = new Set(apiTemplates.map(t => t.templateUid))`로 O(1) 존재 확인
- SQUAREBOOK_HC: `79yjMH3qRPly`(표지), `3FhSEhJ94c0T`(사진+텍스트), `vHA59XPPKqak`(텍스트) 우선 사용
- `console.log`로 샘플 템플릿 객체의 키 목록 출력 — 향후 필드명 변경 감지

**2. 더미 데이터 표지/내지 완전 분리**

```js
// Before: pages[0]과 pages[23]을 표지로 빼냄 → 내지 22장
// After:
export const babyDummy = {
  frontCover: { image: PLACEHOLDER('baby-cover-front'), title: '...' },
  backCover:  { image: PLACEHOLDER('baby-cover-back') },
  pages: [ /* 순수 내지 24장 — 표지와 무관 */ ],
};
```

- 6개 서비스 모두 `frontCover` / `backCover` 속성 추가
- 에디터 `useEffect`에서 `dummy.frontCover` → role='front', `dummy.backCover` → role='back' 별도 생성
- `dummy.pages` 24개 전체 → role='content' 할당 (표지에 빼앗기지 않음)
- AI 동화 로드 시 `frontCover`/`backCover` 없으면 기존 방식 폴백 유지 (하위 호환)

### 교훈

- API 서버 필터링에 의존하더라도, 응답 **순서**에 의존하는 `[0]` 선택은 위험 — 검증 UID 존재 확인이 안전
- 배열 `.length` 검증만으로는 **데이터 소비 구조**(누가 몇 장을 가져가는가)의 버그를 발견할 수 없음
- 표지와 내지는 데이터 구조부터 완전 분리해야 pageMin 규격 준수가 보장됨

---

## ✅ 2026-04-04 — 템플릿 동적 매핑 시 판형(bookSpecUid) 불일치 400 에러 해결

### 배경 / 문제

`resolveTemplates()` 함수에서 API로 조회한 템플릿 목록을 판형별로 필터링할 때, **느슨한 조건**이 사용되고 있었음:

```js
// 🐛 기존 (느슨한 필터)
const filtered = apiTemplates.filter((t) => {
  if (bookSpecUid && t.bookSpecUid && t.bookSpecUid !== bookSpecUid) return false;
  return true;  // ← t.bookSpecUid가 없으면 무조건 통과!
});
```

- `t.bookSpecUid`가 `undefined`/`null`인 템플릿이 필터를 통과하여 다른 판형의 UID(예: `4MY2fokVjkeY`)가 `tplMap`에 할당됨
- 이로 인해 `POST /books/{uid}/contents` 호출 시 **모든 페이지에서 HTTP 400** 반환
- 표지(`POST /books/{uid}/cover`)도 동일한 문제로 실패

### 해결

**엄격 필터링(Strict Match)** 으로 교체:

```js
// ✅ 수정 (엄격 필터)
const filtered = bookSpecUid
  ? apiTemplates.filter((t) => {
      if (t.bookSpecUid === bookSpecUid) return true;
      if (Array.isArray(t.bookSpecUids) && t.bookSpecUids.includes(bookSpecUid)) return true;
      return false;  // ← bookSpecUid 미일치 or 미보유 → 무조건 제외
    })
  : apiTemplates;
```

- `t.bookSpecUid === bookSpecUid` 정확 일치만 허용
- `t.bookSpecUids` (복수형 배열) 필드도 호환 지원
- 필터 통과 0개일 경우 검증된 폴백 상수(`79yjMH3qRPly`, `3FhSEhJ94c0T`, `vHA59XPPKqak`) 자동 적용
- 로그에 `전체 N개 중 판형 일치 M개` 출력하여 디버깅 용이성 확보

### 교훈

- API가 `bookSpecUid` 쿼리 파라미터를 받아도, 응답에 다른 판형 템플릿이 섞여 올 수 있음
- 클라이언트 측에서 반드시 **이중 필터링** 적용 (서버 필터 + 클라이언트 엄격 필터)
- 필터 조건의 `&&` 단락 평가가 의도치 않은 통과를 허용하는 전형적 패턴 — 방어적으로 `=== false` 반환 기본값 사용

---

## ✅ 2026-04-04 — 템플릿 동적 할당 로직 및 실데이터 기반 스프레드 미리보기 구현

### 배경 / 문제

**1. 에디터 내지 생성 시 템플릿 UID가 하드코딩되어 있었음**
- `TPL_WITH_PHOTO = '3FhSEhJ94c0T'`, `TPL_TEXT_ONLY = 'vHA59XPPKqak'` 두 상수만 사용
- 판형(bookSpecUid)이 변경되면 해당 UID가 유효하지 않아 400 에러 위험
- 페이지 데이터의 조합(이미지+텍스트, 이미지만, 텍스트만, 양면 분할)에 따른 세분화된 템플릿 매핑이 없었음

**2. 미리보기 페이지가 더미 데이터 기반이었음**
- `buildPagePreviews()`가 `DUMMY_DATA`에서 이미지를 가져오는 구조
- 에디터에서 실제로 구성한 표지·내지 데이터가 미리보기에 전혀 반영되지 않음
- 단순 그리드 나열로 실제 책의 물리적 구조(스프레드)를 시각화하지 못함

### 의사결정

**1. API 기반 동적 템플릿 매핑 (`resolveTemplates` 함수)**

하드코딩 대신 `GET /api/templates?bookSpecUid=...`로 현재 판형의 실제 템플릿을 조회하고, `classifyTemplate()` 함수로 와이어프레임 타입을 분류하여 최적 매핑:

```
페이지 데이터 조합       → 매핑 결과
─────────────────────────────────────
이미지 + 텍스트          → tplMap.photoText  (photo_text 타입)
이미지만 (Full-bleed)    → tplMap.photoOnly  (photo_only 타입)
텍스트만                 → tplMap.textOnly   (text_only 타입)
양면 분할 (isSpreadPage) → tplMap.spread     (photo_only 우선)
```

- API 조회 실패 시 검증된 폴백 상수(`COVER_TEMPLATE_FALLBACK` 등)가 자동 적용 → 안전 장치 유지
- `classifyTemplate()`은 모듈 레벨 순수 함수로 정의 — 에디터 UI의 `inferWireframeType()`과 로직 통일

**2. 실데이터 기반 스프레드 미리보기 (`preview/page.jsx` 전면 재작성)**

- 에디터 `handleCreateBook` 최종화 성공 시 `sessionStorage.setItem('bookmaker_preview', ...)` 로 실제 표지/내지 데이터를 저장
- 미리보기 페이지가 이 데이터를 읽어 스프레드 단위로 렌더링:
  - 첫 스프레드: `[뒤표지(좌) | 앞표지(우)]` — 인쇄 규격 그대로
  - 이후: `[내지 1 | 내지 2]`, `[내지 3 | 내지 4]` 쌍 단위
- CSS 책등(Spine) 효과: 중앙 그래디언트 그림자 + 1px 구분선으로 책 펼침 느낌
- 텍스트 전용 페이지는 크림색 배경 + 타이포그래피 렌더링
- 에디터 데이터 없을 경우 더미 데이터 폴백 자동 적용

### 결과
- 판형이 바뀌어도 API 응답 기반 템플릿이 자동 매핑 → 하드코딩 의존도 제거
- 미리보기가 에디터 실데이터를 반영 → "내가 만든 책"의 실제 모습 확인 가능
- 스프레드 뷰로 인쇄 물리 구조가 직관적으로 전달됨

---

## ✅ 2026-04-04 — 24p 규격 대응 고퀄리티 더미 데이터 대개편 + 감성 에세이 리브랜딩

### 배경 / 요구사항

- SQUAREBOOK_HC 최소 24페이지 규격을 만족하려면 더미 데이터도 24개 페이지가 필요
- 기존 더미 데이터(8~12개)로는 에디터 로드 시 UI가 빈약하게 보여 시연 퀄리티 저하
- 세 가지 템플릿 유형(text+photo, text_only, photo_only Full-bleed)이 실제로 모두 시연되어야 함
- '1인 출판 플랫폼'이라는 이름이 서비스 정체성을 제대로 전달하지 못함

### 의사결정

**리브랜딩: `1인 출판 플랫폼` → `감성 에세이`**
- `constants.js`: `name`, `subtitle`, `description`, `icon` (✍️) 전부 변경
- 대상: `selfpublish` 서비스 키 유지, UI 표시 이름만 교체
- README.md 서비스 설명 동기화

**더미 데이터 24페이지 전면 재작성 (6개 서비스 × 24페이지)**

| 구분 | 1~12p | 13~24p |
|------|-------|--------|
| 육아 일기 | 감성 장문 텍스트 + 사진 (TPL_WITH_PHOTO) | text: "" Full-bleed 사진 (TPL_WITH_PHOTO) |
| 유치원 졸업 | 선생님·부모 코멘트 + 활동사진 | text: "" 활동 사진 Full-bleed |
| AI 동화책 | 10페이지 이야기 텍스트 + 삽화 | 챕터 구분 Full-bleed 삽화 12장 |
| 여행 포토북 | 장소·감성 캡션 + 사진 (파노라마 1장 포함) | text: "" 풍경 Full-bleed (파노라마 1장 포함) |
| 감성 에세이 | **교차 배치** — image:null 텍스트 전용 12장 | **교차 배치** — photo Full-bleed 12장 |
| 반려동물 | 감성 캡션 + 귀여운 사진 | text: "" 사진 Full-bleed |

**세 가지 템플릿 분기 완전 지원**

```
image: PLACEHOLDER + text: "텍스트"  → TPL_WITH_PHOTO (사진+텍스트)
image: PLACEHOLDER + text: ""        → TPL_WITH_PHOTO (Full-bleed, diaryText=' ')
image: null        + text: "텍스트"  → TPL_TEXT_ONLY  (텍스트 전용)
```

**editor/page.jsx useEffect 버그 수정**
- 기존: `p.image?.startsWith('http') ? p.image : picsum_fallback` — `p.image === null`일 때 fallback으로 덮어씌워 text-only 의도 파괴
- 수정: `p.image === null || p.image === '' ? null : (...)` — null 명시적 보존 → TPL_TEXT_ONLY 분기 정상 동작

**파노라마 이미지 지원**
- `PANORAMA(seed)` 헬퍼 추가: `https://picsum.photos/seed/{seed}/1200/600` (2:1 비율)
- 여행 더미 14p·22p에 파노라마 2장 포함, `isLandscape: true` 플래그
- useEffect에서 `isLandscape: p.isLandscape || false` 읽기 추가 → 갤러리 가로형 배지 표시

### 결과
- 6개 서비스 모두 더미 데이터 채우기 즉시 24페이지 갤러리 구성 → API 최소 페이지 조건 자동 충족
- 감성 에세이의 text_only ↔ photo_only 교차 배치로 TPL_TEXT_ONLY 매력 시연 가능
- 여행 파노라마로 isLandscape 배지 UI 자연스럽게 시연 가능

---

## ✅ 2026-04-04 — [해결완료] Photos API 업로드 성공 후 URL 추출 실패 ("업로드 실패: undefined") 해결

### 배경 / 문제

**증상**: 에디터 API 로그에 `⚠️ 내지 N 업로드 실패: undefined` 4회 연속 출력, 업로드된 사진이 모두 picsum fallback으로 대체됨
- 로그 패턴: `📁 내지 파일 맵: 4개 / 24장 보유 (인덱스: [10, 11, 12, 13])` → 파일은 정상 로드됨
- 원인 오판: 처음에는 `stagedFilesRef` 인덱스 불일치로 파악 → 수정 후에도 동일 증상 지속
- 실제 원인: SweetBook Photos API `POST /Books/{bookUid}/photos` 응답 JSON의 **URL 필드명 불일치**

### 진단 과정

1. `d.message === undefined` → `d.success === true`임을 역추론 (success 응답에는 message 없음)
2. 업로드 소요 시간 7~9초 → SDK `maxRetries=2`, `delay(1s+2s)` = 3회 시도 패턴 아님 → 1회 성공 + URL 추출 실패
3. SDK 소스 분석: `photos.upload()` → `ResponseParser(body).getData()` = `body?.data ?? body` → `sweetbook.js` `ok(data)` = `{ success: true, data: <photo object> }`
4. 클라이언트 코드: `d.data?.url || d.data?.photoUrl || d.data?.fileUrl` — SweetBook API 실제 필드명이 이 3가지 중 어느 것도 아님
5. SweetBook SDK 예제(`01_create_book.js`)는 Photos API 전혀 사용하지 않고 picsum URL 직접 전달 → API 문서에서 반환 필드명 보장 없음

### 의사결정

**`uploadFile` 헬퍼 URL 추출 로직 전면 재작성**

```js
// 기존 (3개 필드명만 시도)
const url = d.data?.url || d.data?.photoUrl || d.data?.fileUrl;

// 변경 후 (14개 필드명 + 문자열 타입 대응)
const raw = d.data;
const url =
  (typeof raw === 'string' && raw.startsWith('http') ? raw : null) ||
  raw?.url || raw?.downloadUrl || raw?.originalUrl ||
  raw?.photoUrl || raw?.fileUrl || raw?.imageUrl ||
  raw?.cdnUrl || raw?.publicUrl || raw?.uploadedUrl ||
  raw?.uploadUrl || raw?.originalFileUrl || raw?.fileDownloadUrl ||
  raw?.photo?.url || raw?.photo?.downloadUrl || raw?.photo?.originalUrl ||
  null;
```

**에러 분기 명확화**
- `!d.success` 조기 감지 → 명확한 실패 메시지 출력
- URL 미발견이지만 `d.success=true` → 응답 전체를 `addLog`로 출력하여 필드명 즉시 파악 가능: `업로드 성공했으나 URL 필드 미발견. 응답: {...}`
- 모든 분기에 `console.log('[업로드 응답]', JSON.stringify(d))` 추가

### 결과 (1차 수정)
- 14개 URL 필드명 폴백 탐색 + 응답 전체 addLog 출력으로 실제 응답 구조 확인
- **실제 API 응답 확인**: `{ fileName, originalName, size, mimeType, uploadedAt, isDuplicate, hash }` — **URL 필드 없음**

### 2차 수정 — `fileName` 참조 사용

**실제 원인 (로그 분석 후 확정)**:
SweetBook Photos API는 URL을 반환하지 않는다. `fileName`(`photo260404064434599.PNG`)이 SweetBook 내부 사진 참조 ID이며, 이를 템플릿 파라미터(`photo1`, `coverPhoto`)에 전달하면 SweetBook 렌더링 엔진이 해당 book 스코프 내 업로드된 사진을 자동으로 조회한다.

```js
// URL 탐색 실패 → fileName을 SweetBook 내부 참조로 반환
if (raw?.fileName) {
  addLog(`✅ ${label} 업로드 완료 (fileName 참조) → ${raw.fileName}`);
  return raw.fileName;
}
```

- `fileName`이 truthy string이므로 picsum fallback 분기 스킵 → 실제 사진 사용
- `params.photo1 = "photo260404xxxxxx.PNG"` → SweetBook API에 fileName 전달

---

## ✅ 2026-04-04 — [해결완료] 내지 스프레드 전환에 따른 사진 데이터 인덱스 매핑 최종 동기화 및 업로드 버그 해결

### 배경 / 문제

**스프레드 UI 도입 후 실제 업로드 파일이 picsum fallback으로 대체되는 현상**
- `item.file` 프로퍼티는 gallery state 객체에 저장되어 있으나, `setGallery`의 비동기 batching 과정 또는 `map/filter`로 생성된 새 배열에서 파일 참조가 끊어지는 경우 발생
- `handleBlankSlotUpload`가 `await detectLandscape(file)` 이후 `updateGalleryItem(galleryIdx, {...})` 를 호출할 때 stale closure 위험 존재
- `handleCreateBook`에서 `contentItems[ci].file`을 직접 참조했는데, 이 파일 참조가 `undefined`로 평가되어 `uploadFile` 건너뜀 → picsum fallback 적용

### 의사결정

**`stagedFilesRef` (useRef) 도입 — itemId → File 이중 보관 맵**
- `useRef({})` 로 `stagedFilesRef` 생성: gallery state와 독립적으로 파일 객체 보관
- `handleGalleryUpload`: 각 item ID 생성 직후 `stagedFilesRef.current[id] = file` 등록
- `handleBlankSlotUpload`: `setGallery` 함수형 업데이터 내부에서 `prev[galleryIdx].id` 읽어 등록 → stale closure 위험 완전 제거
- `removeGalleryItem` / `removeSpreadPair`: 아이템 제거 시 `delete stagedFilesRef.current[item.id]` 정리

**`contentFileMap` — 절대 내지 인덱스 기준 스냅샷**
- `handleCreateBook` 시작 시 `contentItems.forEach((item, ci) => ...)` 로 `contentFileMap[ci]` 빌드
- 파일 취득 우선순위: `stagedFilesRef.current[item.id]` → `item.file` → 두 가지 모두 없으면 미등록
- 이 맵이 "0부터 시작하는 전체 내지 절대 인덱스" 기준 파일 매핑의 단일 진실의 원천
- `addLog`와 `console.log('[contentFileMap 스냅샷]')` 으로 업로드 전 맵 전체를 확인 가능

**`uploadFile` 헬퍼 강화**
- `file` 이 `File | Blob` 인지 타입 체크 추가 (`instanceof` 검사)
- `console.log('[업로드 시도]', label, file.size, file.type)` 로 FormData append 직전 파일 유효성 출력
- `form.append('file', file, file.name || 'photo.jpg')` — 파일명 명시적 전달 (Blob의 경우 name 없음 방어)

### 결과
- 실제 업로드 파일이 picsum fallback으로 대체되는 문제 해결
- 절대 내지 인덱스 기반 파일 맵으로 스프레드 재정렬/삭제 후에도 파일 순서 보장
- API 로그 + console.log로 업로드 전 파일 상태를 완전히 가시화

---

## ✅ 2026-04-04 — [해결완료] 스프레드 UI 기반 데이터 인덱스 매핑 전면 재구축 + 최종화 에러 100% 해결

### 배경 / 문제

**1. 스프레드 UI 도입 후 사진 업로드 실패(undefined) 및 내지 400 에러 연속 발생**
- `contentPageData[i]`와 `contentItems[i]` 간 인덱스 매핑이 스프레드 표시 순서와 어긋날 수 있는 구조
- 빈 슬롯(`isBlankSlot: true`) 아이템이 내지로 포함될 때 `imageUrl: null`, `text: ''`로 API 전송 → 일부 API 검증에서 400 반환
- 업로드 실패 시 `uploadFile()` 반환값이 `null`인데, 상위 루프에서 이를 그대로 패딩 페이지에 재사용 → 모든 패딩 페이지도 `imageUrl: null`이 됨
- `page.templateUid`에 사용자가 선택한 API 템플릿 UID(파라미터명이 다른 것)가 들어올 경우 400 에러 유발

**2. 빈 슬롯이 편집 패널에서 브레이크**
- `modalItem.previewUrl`이 `null`인 빈 슬롯 선택 시 `<img src={null}>`로 깨진 이미지 표시
- 빈 슬롯에 직접 사진을 업로드하는 수단이 없어 갤러리 업로드 후 역할 재지정 필요

### 의사결정

**절대 페이지 인덱스 기준 contentPageData 빌드 원칙 수립**
- `for (let ci = 0; ci < contentItems.length; ci++)` 인덱스 루프로 변경
- `contentPageData[ci]` ↔ `contentItems[ci]` 1:1 매핑 보장
- 각 인덱스에 `fallbackUrl = picsum.../seed/{serviceType}-c{ci}/...` 할당 → 업로드 실패·파일 없음 모두 안전하게 처리

**`uploadFile()` 헬퍼 방어 강화**
- `file === null` 조기 감지 → 즉시 null 반환 + 로그 기록
- try/catch로 네트워크 예외 포착 + `console.dir(err)` 수준 상세 로깅
- 반환 null 시 상위에서 picsum fallback URL로 대체

**빈 슬롯 처리 표준화**
- `item.isBlankSlot === true`이면 `imageUrl: null` 유지 (TPL_TEXT_ONLY로 전송)
- `!isBlankSlot && imgUrl === null`이면 picsum fallback 자동 적용 → 이미지 없는 일반 아이템이 빈 페이지로 전송되는 상황 제거
- 패딩 페이지도 `srcPage.imageUrl || picsum` 폴백으로 항상 이미지 URL 확보

**templateUid 강제 표준화**
- `page.templateUid` 완전 무시 — 항상 `TPL_WITH_PHOTO` / `TPL_TEXT_ONLY` 두 가지 검증된 상수만 사용
- `diaryText: (page.text || '').trim() || ' '` — 빈 문자열 거부 방지용 단일 공백 폴백
- 모든 contents 전송에 try/catch + `console.dir` 추가 → 실패 페이지만 경고, 나머지는 계속 전송

**빈 슬롯 직접 편집 UX 도입**
- `handleBlankSlotUpload(galleryIdx, file)`: 빈 슬롯에서 파일 선택 시 해당 갤러리 아이템 업데이트 + `isBlankSlot: false` 전환
- 인라인 편집 패널 좌측 미리보기 영역: `previewUrl`이 null이면 `<label>`+`<input type="file">` 업로드 버튼 플레이스홀더 표시
- 스프레드 뷰 빈 슬롯 아이콘: 📄로 교체 + `title` 툴팁으로 클릭 가능성 명시

### 결과
- 사진 업로드 undefined 에러 완전 해결 — 빈 슬롯·파일 없는 아이템 모두 picsum fallback으로 안전 처리
- 내지 400 에러 해결 — templateUid 강제 표준화 + diaryText 빈 문자열 폴백
- 최종화 에러 로그에 `console.dir` 수준 상세 정보 추가 → 디버깅 시 API 응답 전체 구조 확인 가능
- 빈 슬롯 클릭 → 편집 패널 → 사진 직접 업로드 → `isBlankSlot: false` 전환 플로우 완성

---

## ✅ 2026-04-04 — [해결완료] 2페이지 Spread 단위 내지 편집 시스템 도입

### 배경 / 문제

**내지 목록이 단순 1페이지 단위 리스트로 구성된 UX 문제**
- 이전 좌측 패널 내지 목록: 각 아이템이 독립된 1p 카드로 나열 → SweetBook API가 2페이지 단위(Spread)로 내지를 관리한다는 인쇄 물리 구조와 불일치
- 사용자가 "홀수 페이지" 상태(총 내지 수가 2의 배수 아님)를 자연스럽게 만들 수 있어, `isIncrementOk` 검증에 걸려 [책 생성] 버튼이 비활성화되는 혼란 발생
- 양면(Spread) 분할 사진이 2페이지를 소모하는 맥락이 UI에서 전혀 보이지 않았음

### 의사결정

**`spreadGroups` useMemo — 내지를 [L|R] 쌍으로 그룹화**
- `contentItems`를 2개씩 묶어 `{ spreadNum, leftItem, rightItem, leftPageNum, rightPageNum }` 구조로 변환
- 좌측 패널이 스프레드 단위 카드(`스프레드 N · M–K쪽`)로 표시 → 사용자가 "현재 몇 개의 Spread가 있는지" 한눈에 파악

**빈 슬롯(Blank Slot) 개념 도입**
- `makeBlankItem()`: `{ previewUrl: null, isBlankSlot: true, role: 'content' }` 생성 함수
- "+2페이지(1장) 추가" 버튼 → 빈 슬롯 2개를 한 번에 추가 → 항상 짝수 유지
- 빈 슬롯은 갤러리 그리드에서 회색 📄 자리표시자로 렌더링, API 전송 시 `TPL_TEXT_ONLY` 템플릿 자동 적용

**Spread 단위 삭제**
- `removeSpreadPair(galleryIdx)`: 클릭된 아이템이 속한 Spread 쌍(L+R) 두 장을 동시 제거 → 삭제 후에도 항상 짝수 유지
- 인라인 패널 하단 "스프레드 삭제 (2p)" 버튼이 이 함수 호출

**L/R 슬롯 교체**
- `swapSpreadSlot(galleryIdx)`: 해당 아이템과 그 파트너(같은 Spread의 반대쪽 슬롯)의 갤러리 위치를 교환
- 인라인 편집 패널 내 "↔ L/R 교체" 버튼으로 사용자가 좌/우 배치를 즉시 조정 가능

**스프레드 슬롯 인디케이터**
- 내지 편집 패널 최상단에 미니 Spread 미리보기 박스 고정 노출
- "스프레드 N · 왼쪽(L)/오른쪽(R) 페이지" 레이블 + L/R 교체 버튼 + 40px 높이의 좌우 슬롯 미니 프리뷰(현재 편집 중인 슬롯은 amber 오버레이로 강조)

### 결과
- 인쇄 물리 구조(2p Spread)가 에디터 전 영역에 일관되게 반영됨
- "+2페이지(1장) 추가" + 쌍 단위 삭제로 `isIncrementOk` 위반이 원천적으로 불가능해짐
- 미니 스프레드 미리보기로 사용자가 L/R 배치를 직관적으로 파악 및 수정 가능

---

## ✅ 2026-04-04 — [해결완료] 표지 스프레드(Spread) 듀얼 슬롯 UX 도입

### 배경 / 문제

**표지 템플릿 구조와 사용자 인터랙션 방식의 불일치**
- SweetBook 표지 템플릿 썸네일은 `[뒤표지(좌) | 앞표지(우)]`가 하나로 이어진 Spread 1장 이미지로 제공됨
- 그러나 에디터 UI는 앞표지와 뒤표지를 각각 별도 섹션으로 표시 → 두 사진이 한 쌍이어야 한다는 맥락(Context)이 시각적으로 연결되지 않음
- 사용자가 앞표지만 지정하고 책 생성을 시도하거나, 두 슬롯이 함께 채워져야 한다는 사실을 모르는 UX 문제 발생

### 의사결정

**듀얼 슬롯 스프레드 미리보기 UI 도입**
- 좌측 구성 패널의 앞/뒤 개별 섹션을 제거하고, 단일 "📔 표지 스프레드" 영역으로 통합
- `[뒤표지(좌) | 앞표지(우)]` 2칸 그리드로 템플릿 Spread 구조를 그대로 재현
- 슬롯에 이미지가 채워지면 썸네일, 비어있으면 점선 원형 + "미지정" 레이블 표시

**인라인 편집 패널 우측 컬럼에도 스프레드 슬롯 노출**
- 갤러리에서 사진을 클릭해 앞/뒤표지 역할 지정 시 → 우측 컬럼에 현재 스프레드 현황 실시간 표시
- 미채워진 슬롯을 앰버 색상 경고("앞표지와 뒤표지 사진을 모두 지정해 주세요")로 즉시 안내

**템플릿 선택기에 2장 필수 안내 추가**
- 표지 역할일 때 템플릿 카드 그리드 상단에 파란 안내 박스: "이 템플릿은 앞/뒤표지 2장의 사진이 모두 필요합니다"
- 사용자가 템플릿을 선택하는 시점에 2장 요건을 자연스럽게 인지

### 결과
- 표지 Spread 물리 구조를 UI에 직접 반영 → "왜 사진 2장이 필요한가" 별도 설명 없이 직관적으로 전달
- 슬롯 기반 시각화로 앞/뒤 양쪽 지정 완료 여부를 한눈에 확인 가능

---

## ✅ 2026-04-04 — [해결완료] 표지 Spread 통합 및 페이지 규격 검증 시스템 도입

### 배경 / 문제

**1. 뒤표지가 내지(contents) 마지막 장으로 처리되는 구조적 불일치**
- 기존 코드: `POST /books/{uid}/contents`를 반복 호출하다 맨 마지막에 뒤표지 이미지를 내지 API로 전송 (STEP 4-b)
- 인쇄 물리 규격상 앞/뒤 표지는 Spread 1장(양면 인쇄)으로 관리됨 — 별개 내지 페이지가 아님
- 이 구조로 인해 pageMin 계산에 뒤표지 1장이 포함되어 실제 내지 수가 1 적게 계산되는 부작용 발생

**2. 내지 페이지 수 검증이 UI 수준에서 강제되지 않음**
- 버튼 활성화 조건: `contentItems.length >= MIN_CONTENT (8)` — 실제 API pageMin(24)보다 훨씬 낮은 상수
- 사용자가 8장만 구성하고 [책 생성] 클릭 → 코드가 자동 패딩하지만 사용자는 그 사실을 모름
- 양면(Spread) 분할 아이템이 2페이지를 소모한다는 사실이 페이지 카운트에 미반영

**3. 페이지 수가 증분 단위(pageIncrement) 배수가 아닌 경우 처리 없음**
- API 규격: SQUAREBOOK_HC는 24, 26, 28...의 2p 단위로만 최종화 가능
- 기존 핸들러에서 수학적 반올림은 있었지만, UI에서 사용자에게 명시적 안내 없음

### 의사결정

**표지 로직 통합 (Spread 방식)**
- STEP 4-b(뒤표지를 마지막 contents로 전송) 완전 제거
- STEP 3(표지 추가) 단일 `POST /books/{uid}/cover` 호출 내에 앞표지(`coverPhoto`)와 뒤표지(`backPhoto`) URL을 함께 전달
- 인쇄 규격과 API 사용 방식이 1:1 대응 — 데이터 정합성 및 유지보수성 향상

**`getPageConsumption(item)` 함수 신설**
- 아이템 단위로 페이지 소모량 계산: `useSpread && isLandscape`이면 2, 아니면 1
- 컴포넌트 외부 순수 함수로 정의 → useMemo deps에서 안정적 참조
- `totalContentPages = contentItems.reduce(sum + getPageConsumption(item), 0)` 로 실제 소모 페이지 합산

**페이지 규격 실시간 검증 강화**
- `specPageMinUI / specPageIncUI`: `BOOK_SPECS[session?.bookSpecUid]` 기반 동적 계산 (session null 시 24/2 기본값)
- `isPageMinMet = totalContentPages >= specPageMinUI`
- `isIncrementOk = totalContentPages > 0 && totalContentPages % specPageIncUI === 0`
- `isReady = front 1장 && back 1장 && isPageMinMet && isIncrementOk`
- 버튼 비활성 시 전용 빨간 안내 박스: "최소 N페이지가 필요합니다" / "N페이지 단위로 추가해 주세요"

### 결과
- 표지 API 호출 구조가 SweetBook 인쇄 규격과 정확히 일치 → 모호한 뒤표지 처리 제거
- 사용자가 [책 생성] 버튼을 클릭하기 전에 페이지 수 부족·단위 불일치를 즉시 인지 가능
- Spread 분할 아이템의 2페이지 소모가 카운트에 정확히 반영 → 예상치 못한 최종화 실패 방지

---

## ✅ 2026-04-03 — [해결완료] 프로페셔널 에디터 UX 도입 — 인라인 속성 패널 + 동적 페이지 카운트

### 배경 / 문제

**1. 모달창의 맥락 단절 문제**
- 갤러리 썸네일 클릭 → 전체 화면을 덮는 검은 오버레이 모달 출현
- 사용자가 갤러리 전체 구성을 보면서 편집할 수 없음 (모달이 가림)
- 전문 포토북 에디터(Canva, Adobe Express 등)는 우측 Properties Panel 패턴 사용

**2. 내지 카운트 하드코딩 혼란**
- `{contentItems.length}/{MIN_CONTENT}장` 형태로 MIN_CONTENT=8을 상수로 하드코딩
- 실제 API pageMin(SQUAREBOOK_HC=24)과 표시값이 달라 "왜 8장인데 24장을 채워야 하지?" 혼란 유발

### 의사결정

**인라인 속성 패널(Inline Property Panel) 패턴 도입**
- 갤러리 썸네일 클릭 → 에디터 하단 액션 패널이 스르륵 사라지고, 그 자리에 2-column 편집 패널 출현
- 좌측: 사진 미리보기 + 역할(앞/뒤/내지) 선택 + 표지 템플릿
- 우측: 내지 전용 제목·날짜·텍스트 입력 + 동적 템플릿 필터링 + 양면 분할 옵션
- 편집 완료 후 "확인·닫기" 클릭 → 다시 최종 생성 버튼 영역 등장
- `galleryModal` state(open+idx 객체) → `selectedIdx: number|null` 단순 state로 교체

**동적 페이지 카운트 연동**
- `specPageMin = BOOK_SPECS[session.bookSpecUid]?.pageMin || 24` 동적 계산
- 표시: "현재 N / 최소 24장" 형태, 색상 3단계 (미달=노랑, 버튼활성화=파랑, 완전충족=초록)
- 버튼 활성화 기준 `MIN_CONTENT=8`은 유지 (실제 패딩은 책 생성 시 자동)

### 결과
- 모달 없는 컨텍스트 유지 편집 → 갤러리 전체 구성을 보면서 개별 사진 설정 가능
- 페이지 카운트가 판형별 실제 규격(`pageMin`)에 연동되어 사용자 혼란 제거

---

## ✅ 2026-04-03 — [해결완료] 인지 부하 최소화를 위한 템플릿 동적 필터링 UX

### 배경 / 문제
- 에디터 갤러리 모달에서 내지 역할을 선택하면 API에서 받아온 모든 템플릿("내지a", "빈내지", "내지_월시작" 등)이 필터링 없이 나열됨
- 선택지가 너무 많아 "이 템플릿이 무슨 레이아웃인지?" 알 수 없는 상태에서 골라야 하는 인지 부하 발생

### 의사결정

**핵심 원칙**: "사용자가 지금 뭘 만들려는지"에 맞는 선택지만 보여준다.

- 텍스트를 입력했다 → 텍스트 구역을 가진 레이아웃(`photo_text`, `text_only`, `calendar`)만 노출
- 텍스트가 비어 있다 → 이미지 전용 레이아웃(`photo_only`, `blank`)만 노출
- "자동 선택"은 필터와 무관하게 항상 최상단 전체 너비 버튼으로 고정

**추가 조치**:
- 우상단 필터 배지("✍ 텍스트 포함 레이아웃만 표시 중" / "🖼 이미지 전용 레이아웃만 표시 중")로 왜 특정 템플릿이 안 보이는지 사용자에게 즉시 설명
- `inferWireframeType()` 함수가 템플릿 이름/kind에서 레이아웃 타입을 추론 → 필터 기준으로 활용

### 결과
- 모달 열릴 때마다 적합한 템플릿 2~3개만 노출 → 선택 피로 대폭 감소
- 텍스트 입력/삭제 시 목록이 실시간 전환 → 직관적인 피드백 제공

---

## ✅ 2026-04-03 — [해결완료] 최종화 400 에러 수정 및 에디터 모달 내 템플릿 선택 UI 구현

### 증상
- `POST /books/{bookUid}/finalization` → 400 Bad Request (최종화 불가)
- Create 단계에서 동적으로 받아온 템플릿 UID가 session에 그대로 저장되어 에디터에서 잘못된 UID로 표지 전송

### 원인 분석

**1. 페이지 계산식 오류 (최종화 400의 직접 원인)**
- 기존 로직: `targetContentCount = max(pageMin, contentCount + 2) - 2`
  - `pageMin = 24` 기준, user가 내지 8장 → `rawTotal = 24`, `targetContentCount = 22`
  - 실제 contents API 호출 횟수: 22 → 총 23페이지(22 + cover 1)로 `pageMin 24` 미달 → 400
- `pageMin`은 순수 내지(Contents) API 호출 횟수 기준으로 재해석

**2. 검증 안 된 templateUID가 세션 오염**
- Create 페이지가 `GET /templates` 응답의 첫 번째 templateUid(예: `4MY2fokVjkeY`)를 `coverTemplateUid`로 저장
- 에디터가 `session.coverTemplateUid || COVER_TEMPLATE` 순서로 읽어 잘못된 UID 사용 → 표지 400

### 해결책

| 파일 | 수정 내용 |
|------|----------|
| `editor/page.jsx` | 페이지 계산식 수정: `targetContentCount = align(max(pageMin, contentCount), increment)` |
| `editor/page.jsx` | `session.coverTemplateUid` 참조 제거 → 검증 상수 `dynamicCoverTpl` 항상 사용 |
| `editor/page.jsx` | 모달 내 템플릿 select → 카드 그리드 UI로 교체 (앞표지·내지 역할별 필터링) |
| `create/page.jsx` | 템플릿 선택 섹션 삭제 — 이제 에디터 모달에서 페이지별 선택 가능 |
| `create/page.jsx` | `coverTemplateUid`, `contentTemplateUid`, `availableTemplates`, `templatesLoading` 상태 제거 |

### 수정 후 계산 검증 (SQUAREBOOK_HC, pageMin=24, user 내지 8장)
```
rawCount = max(24, 8) = 24
targetContentCount = 24 (24 % 2 == 0, 패딩 없음)
총 페이지 = 24(내지) + 1(앞표지) = 25 → 최종화 성공 ✅ 실제 확인
```

### 실제 성공 로그 (2026-04-03 검증 완료)
```
📗 책 생성 완료 → 📸 사진 업로드 → 🎨 앞표지 추가 완료
📄 내지 24페이지 추가 완료 → 🎨 뒤표지 추가 완료
🔒 최종화 완료! (25페이지)  ← API가 반환한 pageCount: 25 ✅
```

**핵심 교훈**: SweetBook API의 `pageMin`은 `/contents` 엔드포인트 호출 횟수(순수 내지 수)이며, `/cover` 표지 1장은 별도 계산. 이를 혼동하면 항상 `pageMin - 2`만큼 부족하여 최종화 400 발생.

---

## ✅ 2026-04-03 — [해결완료] bookSpecUid·템플릿 UID·파라미터명 전면 교정 (실제 API 테스트 기반)

### 증상
- `POST /api/books` → 400 Bad Request (API 연동 전혀 안 됨)

### 원인 분석 (Node.js 직접 호출로 검증)

**1. bookSpecUid 오류**: `bs_6a8OUY`, `bs_3EzPkz`, `bs_518IVG`는 실제로 빈 플레이스홀더 UID.
- 이 UID로 `POST /Books` 시 API가 400 반환
- 실제로 책 생성 가능한 UID: `SQUAREBOOK_HC`, `PHOTOBOOK_A4_SC`, `PHOTOBOOK_A5_SC`

**2. 템플릿 API 응답 구조**: `{ success, message, data: { templates: [...] } }` 형태
- 기존 코드는 `data.items`로 접근 → 항상 빈 배열
- `book-specs` 응답: `{ data: [...] }` (배열 직접), 단 유효 spec은 name/pageMin 기준 필터 필요

**3. 템플릿 UID 및 파라미터명 불일치**
- 기존 하드코딩(`tpl_F8d15af9fd`, `cnH0Ud1nl1f9`, `6dJ0Qy6ZmXej`) 모두 동작하지 않음
- 각 템플릿은 고유한 파라미터 이름을 가짐 — 실제로 필요한 파라미터:
  - `79yjMH3qRPly` (표지): `{ coverPhoto, title, dateRange }` ✅
  - `3FhSEhJ94c0T` (내지_사진): `{ photo1, date, title, diaryText }` ✅
  - `vHA59XPPKqak` (내지_텍스트): `{ date, title, diaryText }` ✅
- 기존 코드의 `diaryPhoto` → 실제 파라미터명 `photo1`

### 해결책

| 파일 | 수정 내용 |
|------|----------|
| `constants.js` | `recommendedSpec`: `bs_6a8OUY` → `SQUAREBOOK_HC` 전체 교체, BOOK_SPECS/LABELS 재구성 |
| `sweetbook.js` | `listBookSpecs`: `data.data` 배열 + 빈 spec 필터 / `listTemplates`: `data.data.templates` 추출 |
| `editor/page.jsx` | 템플릿 상수 교체, `diaryPhoto` → `photo1`, 동적 조회 제거(파라미터 불일치 위험), API_MIN 25로 상향 |

### 전체 플로우 검증 결과 (Node.js 직접 테스트)
```
책생성(SQUAREBOOK_HC) → 표지(79yjMH3qRPly) → 내지25p(3FhSEhJ94c0T) → 최종화 → pageCount: 26 ✅
```

---

## ✅ 2026-04-03 — [해결완료] sweetFetch 에러 처리 · ok() 래핑 · 동적 템플릿 UID · 템플릿 라우트 4건 수정

> 이전 세션(2026-04-03)에서 분석만 했던 버그 A~D를 이번 세션에서 모두 수정하고 빌드 검증 완료.

### 수정 내역

| 버그 | 파일 | 수정 내용 | 결과 |
|------|------|----------|------|
| B (1순위) | `src/lib/sweetbook.js` | `sweetFetch`에 `!res.ok` 시 `throw` 추가 — 400/404도 에러로 올바르게 전파 | API 에러 가시화 완료 |
| A (2순위) | `src/lib/sweetbook.js` | `listBookSpecs`, `listTemplates` 등 sweetFetch 기반 5개 함수에 `ok()` 래핑 + `items` 배열 추출 | 프론트 응답 형식 통일 |
| C (3순위) | `src/app/editor/page.jsx` | `handleCreateBook` 초반에 `/api/templates?bookSpecUid=...` 동적 조회 → `dynamicCoverTpl` · `dynamicImageOnly` · `dynamicTextImage` 변수로 4곳 교체 (하드코딩은 폴백으로만 잔존) | contents 400 방지 |
| D (4순위) | `src/app/api/templates/[templateUid]/route.js` | 신규 파일 생성 — `GET /api/templates/:uid` 라우트 | 개별 템플릿 조회 가능 |

### 핵심 결정 사항

**버그 A 수정 시 주의점**: SweetBook API의 리스트 응답은 `{ items: [...] }` 형태. 프론트엔드는 `data.data`가 배열임을 기대하므로 `ok(data?.items || data)` 패턴으로 items를 추출해 래핑. 단순 `ok(data)` 로는 `data.data`가 `{ items: [...] }` 객체가 되어 `Array.isArray()` 체크 실패.

**버그 C 수정 시 주의점**: 동적 조회가 실패해도 기존 하드코딩 상수(`COVER_TEMPLATE`, `TPL_IMAGE_ONLY`, `TPL_TEXT_IMAGE`)를 fallback으로 유지. 완전히 제거하지 않고 let 초기값으로 활용.

### 빌드 결과
- `npm run build` → `✓ Compiled successfully`, 15/15 페이지 정상 생성
- `/api/templates/[templateUid]` 라우트 빌드 결과에 정상 등록 확인

---

## 🚨 2026-04-03 — [분석기록] GET /book-specs · GET /templates · POST /contents 400 에러 원인 분석

> ✅ **위 항목에서 모두 해결 완료. 이 항목은 분석 기록으로만 보존.**

### 증상
- `GET /api/book-specs` → 응답은 200이지만 프론트엔드가 항상 fallback 처리
- `GET /api/templates?bookSpecUid=...` → 동일하게 항상 fallback
- `POST /api/books/{bookUid}/contents` → SweetBook API 400 반환
- 결과: 잘못된 (또는 미검증) 템플릿 UID가 contents API에 전달되어 연쇄 실패

---

### 🐛 버그 1 — `sweetFetch` 응답을 `ok()` 래핑 없이 raw JSON 그대로 반환

**파일:** `src/lib/sweetbook.js`

**문제:**
SDK 기반 함수(`createBook`, `addContents` 등)는 `ok()` 헬퍼로 응답을 `{ success: true, data }` 형식으로 래핑한다.
그러나 `sweetFetch` 기반 함수(`listBookSpecs`, `listTemplates`, `getTemplate`, `getBookSpec`)는 SweetBook API의 raw JSON을 그대로 반환한다.

```js
// SDK 기반 — ok() 래핑 있음 ✅
export async function createBook(...) {
  const data = await getClient().books.create(...);
  return ok(data);  // { success: true, data }
}

// sweetFetch 기반 — ok() 래핑 없음 ❌
export async function listBookSpecs() {
  return sweetFetch('/book-specs');  // raw JSON ({ items: [...] } 등)
}
```

**결과:**
프론트엔드(`create/[serviceType]/page.jsx`)는 항상 `data.success && data.data` 형식을 기대하지만,
`/api/book-specs`와 `/api/templates` 응답에는 `success` 필드가 없어 항상 `false`로 판정된다.
→ 항상 fallback 경로로 진입 → `service.recommendedSpec` 또는 하드코딩된 템플릿 UID 사용

**수정 방법:**
`sweetFetch` 기반 export 함수들에 `ok()` 래핑 또는 `{ success: true, data }` 변환 로직 추가.
또는 route handler(`book-specs/route.js`, `templates/route.js`)에서 응답을 변환하여 `{ success: true, data: result }` 형식으로 반환.

```js
// route.js 수정 예시
const result = await listBookSpecs();
// result가 raw JSON이면 변환
return NextResponse.json({ success: true, data: result?.items || result?.data || result });
```

---

### 🐛 버그 2 — `sweetFetch` 가 API 400/404 에러를 throw하지 않고 조용히 반환

**파일:** `src/lib/sweetbook.js` — `sweetFetch` 함수 (109번째 줄)

**문제:**
```js
async function sweetFetch(path, params = {}) {
  // ...
  const json = await res.json();
  if (!res.ok) {
    console.error(`스위트북 API 상세 에러 [${res.status}] ${path}:`, json);
    // ← throw 없음! 에러 JSON을 그냥 return한다
  }
  return json;  // 400/404 에러 응답도 그냥 반환
}
```

SweetBook API가 `400 Bad Request`(잘못된 파라미터 등)를 반환해도 `sweetFetch`는 에러를 throw하지 않고
에러 응답 JSON을 그대로 반환한다. route handler는 이 에러를 성공으로 착각하고 HTTP 200 OK로 프론트에 전달한다.
터미널에는 에러가 찍히지만 클라이언트는 200 응답을 받아 디버깅이 매우 어렵다.

**결과:**
- `GET /book-specs`가 SweetBook에서 400을 받아도 클라이언트에는 200으로 전달됨
- 에러 JSON이 `data.data`로 인식되어 이후 로직이 오작동

**수정 방법:**
```js
// sweetFetch 수정 예시
if (!res.ok) {
  const msg = json?.message || json?.error || `SweetBook API ${res.status}`;
  console.error(`스위트북 API 상세 에러 [${res.status}] ${path}:`, json);
  const err = new Error(msg);
  err.statusCode = res.status;
  throw err;  // ← 반드시 throw해야 route handler catch 블록으로 이동
}
return json;
```

---

### 🐛 버그 3 — 하드코딩된 템플릿 UID가 선택된 bookSpecUid와 호환되지 않아 contents 400 발생

**파일:** `src/app/editor/page.jsx` — 상수 선언부

**문제:**
```js
const COVER_TEMPLATE = 'tpl_F8d15af9fd';
const TPL_TEXT_IMAGE = 'cnH0Ud1nl1f9';
const TPL_IMAGE_ONLY = '6dJ0Qy6ZmXej';
```

SweetBook API의 `POST /books/{bookUid}/contents`는 **책 생성 시 사용한 `bookSpecUid`와 호환되는 템플릿 UID**만 허용한다.
위 UID들은 특정 bookSpec에서만 유효하며, 다른 bookSpec(예: `bs_3EzPkz`, `bs_518IVG`)으로 책을 만들면 400 에러가 난다.
또한 Sandbox 환경에서 템플릿이 deprecated되거나 변경되면 `bs_6a8OUY`에서도 400이 발생할 수 있다.

**연쇄 작용:**
버그 1 때문에 `session.allTemplates`가 항상 빈 배열 `[]` → 에디터 모달의 템플릿 드롭다운이 비어 있음
→ `page.templateUid`는 항상 `null` → 폴백으로 하드코딩된 UID 사용 → bookSpec 불일치 시 400

**수정 방법:**
`handleCreateBook` 실행 시 `/api/templates?bookSpecUid=${bookSpecUid}&limit=50`를 먼저 호출하여
실제 사용 가능한 커버/내지 템플릿 UID를 동적으로 가져온 뒤 해당 UID를 사용해야 한다.

```js
// handleCreateBook 초반에 추가
const tplRes = await fetch(`/api/templates?bookSpecUid=${bookSpecUid}&limit=50`);
const tplData = await tplRes.json();
const availTpls = tplData?.data || tplData?.items || [];
const realCoverTpl   = availTpls.find(t => (t.templateKind||'').includes('cover'))?.templateUid || COVER_TEMPLATE;
const realContentTpl = availTpls.find(t => (t.templateKind||'').includes('content'))?.templateUid || TPL_IMAGE_ONLY;
const realTextTpl    = availTpls.find(t => (t.templateKind||'').includes('content') && t.name?.includes('text'))?.templateUid || realContentTpl;
```

---

### 🐛 버그 4 (부가) — `GET /api/templates/[templateUid]` Next.js 라우트 파일 없음

**문제:**
`src/lib/sweetbook.js`에 `getTemplate(templateUid)` 함수가 존재하지만,
`src/app/api/templates/[templateUid]/route.js` 파일이 없다.
직접 개별 템플릿을 조회하는 엔드포인트가 없어 Next.js가 404를 반환한다.
(현재 에디터에서는 직접 호출하지 않지만, 향후 템플릿 선택 UI 구현 시 필요)

**수정 방법:**
`src/app/api/templates/[templateUid]/route.js` 파일 생성:
```js
import { NextResponse } from 'next/server';
import { getTemplate } from '@/lib/sweetbook';

export async function GET(request, { params }) {
  try {
    const { templateUid } = await params;
    const result = await getTemplate(templateUid);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: err.statusCode || 500 });
  }
}
```

---

### 수정 우선순위 (다음 세션)

| 순서 | 파일 | 수정 내용 | 영향 |
|------|------|----------|------|
| 1순위 | `src/lib/sweetbook.js` | `sweetFetch`에 `!res.ok` 시 throw 추가 | 버그 2 해결, 모든 API 에러 가시화 |
| 2순위 | `src/lib/sweetbook.js` | `listBookSpecs`, `listTemplates` 등에 `ok()` 래핑 추가 | 버그 1 해결, 프론트 응답 형식 통일 |
| 3순위 | `src/app/editor/page.jsx` | `handleCreateBook` 내 동적 템플릿 UID 조회 로직 추가 | 버그 3 해결, contents 400 방지 |
| 4순위 | `src/app/api/templates/[templateUid]/route.js` | 신규 파일 생성 | 버그 4 해결 |

---

## 📅 2026-04-03 — 데이터 중심의 선 구성(Pre-composition) 에디터 아키텍처로 전면 개편

### 배경 및 목적

기존 에디터는 두 가지 독립적인 데이터 소스(텍스트 기반 `pages` 배열 + 이미지 기반 `gallery` 배열)를 `handleCreateBook` 시점에 병합하는 구조였다. 이는 다음 문제를 유발했다:

1. **400 에러 반복**: `BOOK_SPECS` 폴백 키(`SQUAREBOOK_HC` 등)가 `selectedSpec`에 들어가면 에디터 단에서 알 수 없어 잘못된 UID가 API에 전달됨
2. **불명확한 UX**: "페이지 편집 패널"과 "갤러리" 두 영역의 데이터가 어떻게 합쳐지는지 사용자가 알 수 없음
3. **AI 잔재 코드**: 자동 정렬, 자동 표지 지정 등 제거된 기능의 흔적이 로직에 남아 있어 복잡도 증가

---

### 1. 단일 데이터 소스(Single Source of Truth)로 통합

**결정:**
`pages` 배열과 `stagedFiles` 맵을 완전히 제거하고 `gallery` 배열만을 유일한 데이터 소스로 사용한다.
더미 데이터·AI 생성 페이지도 에디터 진입 시 즉시 gallery 아이템으로 변환한다.

**gallery item shape 확장:**
```js
{
  id, file, previewUrl,
  role,        // 'front' | 'back' | 'content' | null
  title,       // 페이지 제목 (NEW)
  text,        // 텍스트
  date,        // 날짜 (NEW)
  templateUid, // null = 자동 분기 (NEW)
  isLandscape,
  useSpread,
}
```

---

### 2. 선 구성(Pre-composition) 후 단일 트랜잭션 생성

**결정:**
사용자가 갤러리에서 앞표지·내지·뒤표지 역할을 모두 지정한 뒤 [최종 생성 및 주문]을 누르면,
Book → Photos → Cover → Contents → Finalize 를 순차적으로 한 번에 실행한다.

**이유:**
- "생성 중 실패 → 중간 상태 데이터 처리" 문제를 단순화
- 사용자가 구성을 완전히 검토한 후에만 API를 호출하므로 불필요한 호출이 없음
- Validation(앞표지·뒤표지 각 1장, 내지 8장 이상)이 버튼 활성화 조건으로 강제됨

---

### 3. 구성 미리보기 패널(좌측)로 인지 부하 최소화

**결정:**
좌측 패널을 "텍스트 기반 페이지 목록"에서 "갤러리 기반 구성 미리보기"로 교체했다.
앞표지 → 내지 목록(번호+썸네일) → 뒤표지 순으로 실제 인쇄 순서를 시각화하고,
각 항목을 클릭하면 바로 해당 갤러리 모달이 열린다.

---

### 4. 갤러리 모달 고도화 (제목·날짜·템플릿 선택 통합)

**결정:**
기존 모달(역할 지정 + 텍스트 입력)에 다음 필드를 추가했다:
- 페이지 제목 / 날짜 입력
- 내지 템플릿 선택 드롭다운 (`session.allTemplates`에서 content 유형 필터링, 선택 없으면 텍스트 유무 자동 분기)

**이유:**
페이지 데이터 입력의 유일한 진입점이 갤러리 모달이 되었으므로, 한 화면에서 모든 페이지 속성을 완결할 수 있어야 한다.

---

## 📅 2026-04-03 — POST /books 400 에러 해결: 동적 bookSpecUid 바인딩 보정 및 재시도 로직 개선

### 원인 분석

`/api/book-specs` 호출 실패 시 폴백으로 `constants.js`의 `BOOK_SPECS` 전체를 렌더링했는데, 여기에는 실제 API UID(`bs_6a8OUY` 등)와 내부 식별자(`SQUAREBOOK_HC`, `LAYFLAT_HC`, `SLIMALBUM_HC`)가 섞여 있었다. 사용자가 내부 식별자 항목을 클릭하면 `session.bookSpecUid = 'SQUAREBOOK_HC'` 같은 무효한 값이 저장되고, 에디터에서 이를 그대로 SweetBook API에 전달해 400 에러가 발생했다.

---

### 1. 에디터 `handleCreateBook` — bookSpecUid 유효성 검증 및 자동 보정 도입

**결정:**
`handleCreateBook` 실행 시 `session.bookSpecUid`를 그대로 사용하는 대신 유효성을 먼저 검증하도록 변경했다. 무효한 값이면 기본값 `'SQUAREBOOK_HC'`(정방형 하드커버)로 자동 보정하고 API 로그에 경고를 표시한다.

> ⚠️ **후속 수정 (2026-04-03)**: `bs_6a8OUY` 등 `bs_` 접두사 UID는 빈 플레이스홀더로 판명되어 `SQUAREBOOK_HC`로 전면 교체됨. 위 코드 스니펫은 당시 시점 기록이며 현재 코드는 `SQUAREBOOK_HC`를 기본값으로 사용.

**이유:**
- create 페이지의 폴백 목록에서 어떤 항목을 선택하더라도 에디터 단에서 방어가 가능해진다.
- 보정이 발생하면 API 로그에 즉시 표시되므로, 사용자/개발자 모두 원인을 쉽게 파악할 수 있다.

---

### 2. `POST /api/books` 라우트 — 에러 상세 정보 클라이언트 전달

**결정:**
- 유효성 오류 시 어떤 값이 넘어왔는지 터미널 로그와 클라이언트 응답에 함께 기록
- SDK 에러의 `err.body` / `err.response?.data`(SweetBook 서버 원본 메시지)를 클라이언트 응답 `message` 필드에 포함

**이유:**
기존에는 400 에러 발생 시 클라이언트가 단순 "책 생성 실패" 메시지만 받아 실제 원인 파악이 불가능했다. SweetBook이 반환한 상세 메시지까지 토스트에 표시되면 빠른 디버깅이 가능하다.

---

### 3. `fetchWithRetry` — 재시도 조건 429 추가 및 4xx 즉시 반환

**결정:**
재시도 조건을 `res.status >= 500` → `res.status >= 500 || res.status === 429`로 수정했다. 400·401·403·404 등 4xx는 같은 요청을 반복해도 결과가 바뀌지 않으므로 즉시 반환한다.

**이유:**
- 400 에러(잘못된 bookSpecUid)를 3회 재시도하던 기존 동작은 불필요한 지연을 유발했다.
- 429는 일시적 할당량 초과이므로 백오프 재시도가 유효하다.

---

## 📅 2026-04-03 — 사용자 시선 흐름에 최적화된 에디터 UI/UX 리팩토링

### 배경

기능 구현 이후 실제 사용 시나리오를 검토한 결과, 에디터 UI의 정보 배치가 사용자의 자연스러운 시선 흐름(좌→우, 상→하)과 일치하지 않는 문제를 발견했다. 특히 사진 업로드와 역할 지정이 UI의 핵심 작업임에도 불구하고 갤러리가 화면 하단에 위치해 접근성이 낮았고, 좌측 패널에 중복·불필요한 버튼이 혼재되어 인지 부하를 유발했다.

---

### 1. 갤러리를 우측 상단으로 전진 배치 — 접근성 향상

**결정:**
에디터 레이아웃을 `[좌측 패널 | 우측 패널(상단: 갤러리 / 하단: 페이지 목록)]` 구조로 재편하여 갤러리를 시각적으로 가장 눈에 띄는 위치에 배치했다.

**이유:**
- 포토북 제작의 핵심 행위는 "사진을 올리고 역할을 정하는 것"이다. 이 작업이 스크롤 없이 즉시 보여야 사용자가 맥락 없이 헤매지 않는다.
- 갤러리가 하단에 있을 경우 처음 진입한 사용자는 "어디서 사진을 올리지?" 라는 질문을 스스로 해야 했다 — 이는 전환율을 낮추는 UX 마찰이다.
- 상단 배치 후 첫 화면에서 바로 Drag & Drop 업로드 존이 노출되어, 별도 안내 없이도 즉시 사진을 드롭하는 행동을 유도할 수 있다.

---

### 2. 좌측 패널 불필요한 버튼 제거 — 인지 부하 감소

**결정:**
좌측 패널에서 "앞표지 전용 업로드" / "뒤표지 전용 업로드" 버튼을 제거하고, 모든 표지 지정을 갤러리 모달 한 곳에서 처리하도록 통합했다.

**이유:**
- 버튼이 두 곳(좌측 패널 업로드 + 갤러리 모달 지정)에 존재할 경우 사용자는 "어느 것을 써야 하는가?"라는 선택 피로를 겪는다.
- 동일한 결과(앞표지 사진 지정)에 이르는 경로가 두 개 있으면 코드 내 우선순위 처리(`좌측 패널 업로드 → 갤러리 지정 순 덮어쓰기`)도 복잡해진다.
- 단일 진입점 원칙(Single Source of Action)에 따라 갤러리를 유일한 사진 관리 허브로 확립했다.

---

### 3. 갤러리-표지 썸네일 실시간 연동(Binding) — 데이터 일관성 확보

**결정:**
갤러리 state(`gallery` 배열)의 `role: 'front'` / `role: 'back'` 항목이 변경될 때마다 좌측 패널의 표지 썸네일 `src`가 즉시 동기화되도록 React 단방향 데이터 흐름으로 구현했다.

**이유:**
- 기존 구조에서는 갤러리 상태와 표지 상태가 별도의 state로 관리되어, 갤러리에서 역할을 변경해도 좌측 패널이 즉시 반영되지 않는 불일치가 발생했다.
- "갤러리에서 지정했는데 왜 표지가 안 바뀌지?" 라는 사용자 혼란은 신뢰를 깎는다.
- 갤러리 state를 단일 진실 공급원(Single Source of Truth)으로 삼고, 파생 UI(표지 썸네일)는 해당 state를 읽기만 하도록 구조를 단순화했다.

---

### 4. `.claude` 임시 폴더 Git 추적 제외 — 협업 환경 충돌 원천 차단

**결정:**
Claude Code가 로컬 세션에서 생성하는 `.claude/` 디렉터리를 `git rm -r --cached .claude` 로 Git 추적에서 제외하고 `.gitignore`에 등록했다.

**이유:**
- `.claude/` 폴더에는 세션 메모리, 로컬 프롬프트 캐시 등 개발자별로 다르게 생성되는 임시 파일이 포함된다.
- 이 파일들이 원격 저장소에 커밋되면 다른 협업자의 Claude Code 세션에 충돌이 발생하거나 민감한 로컬 컨텍스트가 노출될 수 있다.
- 공개 GitHub 저장소(채용 과제 제출용)이므로, 심사위원이 클론 후 실행할 때 불필요한 `.claude/` 파일이 포함되지 않도록 사전 차단했다.

---

## 📅 2026-04-03 — 다중 업로드 갤러리, 표지 직접 지정 모달, Canvas API 기반 양면(Spread) 분할 기능 구현

### 구현 내용 요약

기획 피벗(AI 자동화 제거) 방향에 따라 **사용자가 100% 제어하는 포토북 에디터 UX** 핵심 3가지를 구현했다.

---

### 1. 다중 업로드 & 갤러리 UI

**구현 방식:**
- `editor/page.jsx` 하단에 독립적인 "사진 갤러리" 섹션 추가
- Drag & Drop 업로드 존: `onDragOver` / `onDrop` 이벤트로 파일 수신 → `handleGalleryUpload(files)` 호출
- `handleGalleryUpload`: `Array.from(files)`로 다중 파일 처리 → 각 파일에 `detectLandscape` 비동기 실행 → `Promise.all`로 병렬 처리 후 `gallery` state에 일괄 추가
- 갤러리 아이템 shape: `{ id, file, previewUrl, role, text, isLandscape, useSpread }`
- 드래그 리오더: `draggable` attribute + `onDragStart` / `onDragOver` / `onDragEnd` 핸들러 → splice 방식으로 배열 재정렬
- `handleBulkUpload`를 `handleGalleryUpload`로 위임 — 이전 자동 표지 지정·날짜 정렬 로직 완전 제거

**기술적 선택:**
- `URL.createObjectURL(file)` 로 썸네일 즉시 미리보기, 삭제 시 `URL.revokeObjectURL`로 메모리 해제
- 가로형 감지(`detectLandscape`)는 `new Image()` 로드 후 `naturalWidth > naturalHeight * 1.6` 조건 판단

---

### 2. 모달 기반 표지 직접 지정 + 텍스트 입력 + 템플릿 동적 분기

**구현 방식:**
- 갤러리 썸네일 클릭 → `galleryModal: { open: true, idx }` 상태 변경 → 모달 렌더
- 역할 버튼 3종: 앞표지 / 뒤표지 / 내지
- `assignGalleryRole(idx, role)`: 새 역할 지정 시 기존에 같은 역할로 지정된 다른 아이템의 role을 `null`로 초기화 → 앞표지/뒤표지 중복 방지 (Validation)
- 내지로 지정 시 텍스트 입력란 노출 → 실시간으로 `cnH0Ud1nl1f9` / `6dJ0Qy6ZmXej` 어떤 템플릿이 적용될지 피드백 표시

**템플릿 동적 분기 (책 생성 시):**
```
hasText = !!(page.text || page.teacherComment || '').trim()
templateUid = hasText ? 'cnH0Ud1nl1f9' : '6dJ0Qy6ZmXej'
```
편집 패널 페이지 + 갤러리 내지 모두 동일 로직 적용.

**갤러리 vs 좌측 패널 표지 우선순위:**
좌측 패널 업로드 → 갤러리 지정 순으로 덮어씀. 갤러리 지정이 최종 우선.

---

### 3. Canvas API 양면(Spread) 분할 로직

**구현 배경:**
가로형 사진(예: 16:9 파노라마, DSLR 가로 촬영)을 포토북에 그대로 넣으면 한 페이지 안에서 좌우 여백이 크거나 이미지가 축소되어 보인다. 펼침면(Spread) 처리를 하면 책을 펼쳤을 때 왼쪽/오른쪽 페이지에 걸쳐 이미지가 꽉 차보이는 효과를 낼 수 있다.

**구현 방식 (`splitImageHalves`):**
```
1. new Image() → img.onload 콜백에서 처리
2. halfW = Math.floor(img.naturalWidth / 2)
3. leftCanvas: drawImage(img, 0, 0, halfW, h, 0, 0, halfW, h)
4. rightCanvas: drawImage(img, halfW, 0, rightW, h, 0, 0, rightW, h)
5. leftCanvas.toBlob(..., 'image/jpeg', 1.0)  ← 최고 화질 (quality=1.0)
6. rightCanvas.toBlob(..., 'image/jpeg', 1.0)
7. Promise.all([leftBlob, rightBlob])
```

**화질 보존 전략:**
- `toBlob`의 quality 파라미터를 `1.0`(최고)으로 지정 → JPEG 최고 품질 유지
- Canvas 크기를 원본 해상도 그대로 사용 — 다운스케일 없음
- `drawImage`는 `imageSmoothingQuality` 기본값('low')이 아닌 기본 브라우저 앤티앨리어싱 적용 → 실질적 화질 손실 없음

**책 생성 시 연속 2페이지 전송:**
```
splitImageHalves(file) → [leftBlob, rightBlob]
→ 각각 new File([blob], 'spread-left.jpg') 로 변환
→ Photos API 두 번 호출 → leftUrl, rightUrl
→ galleryPageData에 두 개의 페이지 entry 순서대로 push
→ 내지 추가 루프에서 연속된 2페이지로 전송
```
분할 실패 시 원본 파일 단일 업로드로 graceful fallback 처리.

---

### 4. 기술적 트러블슈팅

**`Cannot find module './276.js'` 오류:**
- 원인: 이전 세션에서 `.next` 빌드 캐시가 손상된 채 남아있었음 (git worktree 작업 잔재)
- 해결: `rm -rf .next` → `npm run build` 재실행

**`useEffect` 중 `detectLandscape` async 처리:**
- `Array.from(files).map(async ...)` + `Promise.all(...)` 패턴으로 모든 파일의 landscape 감지를 병렬 처리
- `useEffect` 내부가 아닌 이벤트 핸들러에서 호출하므로 React의 async useEffect 문제 회피

---

## 📅 2026-04-03 — [기획 피벗] AI 자동화 제거 → 사용자 자유도 중심 포토북 에디터 UX로 전환

### 배경 및 취소 결정

직전 세션에서 아래 자동화 기능들을 구현했으나, 검토 후 전면 백지화(코드 롤백 예정)하기로 결정했다.

**취소된 기능 목록:**
- 여행 포토북 특화: 감성/키워드 입력 → Gemini 여행 에세이 자동 생성
- 사진 일괄 업로드 시 `file.lastModified` 기반 날짜순 자동 정렬
- 업로드 순서 기반 1일차·2일차 챕터 제목 자동 설정
- 첫 번째/마지막 사진 → 앞표지/뒤표지 자동 지정
- 사진 업로드 후 "AI로 텍스트 자동 생성" 버튼 (AI가 전체 페이지 텍스트 일괄 생성)

**취소 이유:**
로직이 지나치게 자동화되어 **사용자 자유도를 심각하게 제한**한다는 판단이다. 포토북은 개인의 추억을 담는 콘텐츠이므로, 시스템이 자동으로 표지를 고르거나 날짜를 분류하면 사용자가 원하는 구성과 어긋날 가능성이 높다. 또한 AI가 자동으로 텍스트를 채우는 방식은 "내가 만든 책"이라는 감각을 훼손한다.

### 새로운 기획 방향 (New Version)

자동화 대신 **사용자가 100% 제어하는 직관적 포토북 에디터 UX**로 완전히 전환한다.

#### 1. 다중 이미지 Drag & Drop + 갤러리 UI
- 여러 사진을 한 번에 올리면 썸네일 그리드(갤러리) 형태로 표시
- 사용자가 사진 순서를 자유롭게 조작 가능 (드래그로 순서 변경)

#### 2. 앞표지/뒤표지 직접 지정
- 갤러리에서 썸네일을 클릭하면 "앞표지로 지정" / "뒤표지로 지정" 선택 메뉴 노출
- **시스템이 자동으로 표지를 결정하지 않음** — 사용자가 명시적으로 선택해야만 지정됨
- 표지로 지정된 사진은 갤러리 내에서 뱃지(앞/뒤)로 시각적 표시

#### 3. 텍스트 유무에 따른 템플릿 동적 분기
- 각 페이지에서 사용자가 텍스트를 입력했는지 여부를 실시간 감지
- 텍스트 있음 → 사진+텍스트 혼합 템플릿 (`cnH0Ud1nl1f9`) 자동 선택
- 텍스트 없음 → 이미지 전용 풀블리드 템플릿 (`6dJ0Qy6ZmXej`) 자동 선택
- 책 생성(최종화) 시점에 분기 적용 → 같은 책 내에서도 페이지마다 다른 레이아웃 가능

#### 4. 가로형 사진 Canvas API 양면(Spread) 분할
- 가로 비율(width > height × 1.6 기준)의 사진은 "양면 사진"으로 판별
- 브라우저의 Canvas API로 프론트엔드에서 좌/우로 이등분 → 두 개의 이미지 Blob 생성
- 두 Blob을 각각 Photos API로 업로드한 뒤 연속된 2개 페이지로 전송 → 실제 책에서 펼침면(Spread) 효과

### 기술적 의사결정 메모

| 항목 | 이전 방식 | 새로운 방식 |
|---|---|---|
| 사진 정렬 | `file.lastModified` 자동 정렬 | 사용자가 갤러리에서 직접 순서 조정 |
| 표지 지정 | 첫/마지막 사진 자동 설정 | 갤러리 클릭으로 사용자 직접 지정 |
| 텍스트 생성 | AI가 일괄 자동 생성 | 사용자가 페이지마다 직접 입력 |
| 가로 사진 처리 | 단순 업로드 (레이아웃 깨짐 가능) | Canvas API로 분할 후 양면 페이지 전송 |
| 템플릿 선택 | 전체 단일 템플릿 고정 | 페이지별 텍스트 유무로 동적 분기 |

### 다음 세션 구현 우선순위
1. 갤러리 UI + 다중 업로드 (순서 변경 포함)
2. 표지 직접 지정 메뉴
3. 텍스트 유무 기반 템플릿 분기 (책 생성 로직 수정)
4. Canvas API 양면 분할 (가로 사진 감지 → 분할 → 업로드)

---

## 📅 2026-04-02 — Toast 알림 / 재시도 로직 / 템플릿 선택 UI / AI 사진 플로우

### 결정 내용

**P0 — Toast 알림 컴포넌트 개선**
- `src/lib/toast.js`: `window.CustomEvent` 기반 이벤트 버스 구현 (React 컨텍스트 없음)
- `src/components/Toast.jsx`: layout에 1회 마운트, `bookmaker:toast` 이벤트 수신 → 3.5초 자동 소멸
- App Router `layout.jsx`는 서버 컴포넌트이므로 컨텍스트 Provider 불가 → 이벤트 버스 패턴 선택
- `toast.success / .error / .info / .warn(msg)` API로 어느 컴포넌트에서나 호출 가능

**P0 — 에러 재시도 로직**
- `src/lib/fetchWithRetry.js`: 5xx 서버 오류 시 최대 3회 재시도, 지수 백오프(250ms/500ms/1000ms)
- 4xx(클라이언트 오류)는 재시도 불필요 → 즉시 반환
- 에디터 `handleCreateBook`의 책 생성 API 호출에 적용

**P0 (추가) — sweetbook.js 지연 초기화**
- `SweetbookClient`를 모듈 로드 시점에 초기화 → 빌드 타임 env 없으면 `apiKey is required` 에러 발생
- `getClient()` 지연 초기화 패턴으로 교체 → 빌드 성공

**P1 — 실제 템플릿 목록 기반 선택 UI**
- create 페이지: `GET /api/templates` 응답에서 cover/content 분류 후 클릭 가능한 카드 UI 표시
- 선택된 템플릿 UID가 세션에 저장 → 에디터에서 책 생성 시 사용
- API 템플릿 없을 경우 기본값 표시로 폴백

**✈️ 여행 포토북 특별 기능**
- create 페이지에 '여행 감성 설정' 섹션 추가: 분위기(select) + 키워드(text input)
- generate-story API: `mood` / `keywords` 파라미터 수신 → travel 프롬프트에 반영
- 에디터 `handleBulkUpload`: 여행 서비스의 경우 `file.lastModified` 기반 날짜 그룹화 → 자동 챕터 제목 생성(1일차·N월N일)

**🤖 AI 사진 플로우 전면 개편**
- 일괄 업로드 시 `file.lastModified` 기준 날짜순 정렬 (EXIF 라이브러리 없이)
- 첫 번째 사진 → 앞표지, 마지막 사진 → 뒤표지 자동 설정
- 사진이 업로드되면 "🤖 AI로 텍스트 자동 생성" 버튼 표시
  - `mode: 'photo_text'` + `photoCount: N` 파라미터로 generate-story 호출
  - AI 응답의 title/text를 기존 페이지에 병합 (이미지는 보존)
- generate-story API: `photoCount`로 생성 페이지 수 제어, `mode: 'photo_text'` 시 캡션형 짧은 문장 생성

### 근거
- Toast 이벤트 버스: App Router layout이 서버 컴포넌트 → Provider 래핑 불가 → 이벤트 패턴이 유일한 깔끔한 해법
- EXIF 대신 lastModified: EXIF 파싱 라이브러리 추가 없이 사진 날짜 근사값 획득 가능 (iOS/Android 모두 촬영 직후 저장하므로 lastModified ≈ 촬영 시각)
- AI 사진 플로우: 사용자 최대 허들은 "글쓰기" → 사진만 올리면 AI가 텍스트 채워주는 경험으로 전환

---

## 📅 2026-04-02 — 판형 UI: 실제 API UID 매핑 및 템플릿 UID 노출 제거

### 문제
`GET /book-specs` API가 반환하는 실제 판형 UID(`bs_6a8OUY`, `bs_3EzPkz`, `bs_518IVG`)가 로컬 상수(`SQUAREBOOK_HC` 등 내부 키)와 달라 UI에서 이름을 찾지 못하고 원시 UID가 그대로 노출되었음. 또한 템플릿 선택 영역에 내부 템플릿 UID가 사용자에게 보이는 문제가 있었음.

### 결정 내용
1. `constants.js`의 `BOOK_SPECS` / `BOOK_SPEC_LABELS`에 실제 API UID를 1순위 키로 추가
   - `bs_6a8OUY` → 정방형 하드커버 (243×248mm) — 추천
   - `bs_3EzPkz` → A4 소프트커버 포토북 (210×297mm)
   - `bs_518IVG` → A5 소프트커버 포토북 (148×210mm)
   - 기존 내부 키(SQUAREBOOK_HC 등)는 API 미응답 시 폴백으로 유지
2. 모든 서비스 `recommendedSpec`을 `bs_6a8OUY`(정방형 하드커버)로 통일
   - 반려동물 서비스도 기존 `SLIMALBUM_HC`에서 변경 (해당 UID가 API 응답에 없음)
3. create 페이지 템플릿 영역에서 원시 UID `({templateUid})` 표시 제거

### 근거
- 판형 선택 UI는 일반 사용자가 보는 화면이므로 `bs_6a8OUY` 같은 내부 식별자 노출은 UX 저하
- API UID와 로컬 상수 불일치는 판형 이름 미표시 및 "추천" 배지 오작동을 야기
- A4/A5 소프트커버는 기존 하드커버 3종 외 실제 API에서 추가로 제공되는 판형

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

---

## 📅 2026-04-02 — [기능 추가] 표지 이미지 입력 / 사진 일괄 업로드 / AI 더미 생성 / Gemini 모델 확정

### 배경 & 목적

사용자 흐름 점검 중 누락된 항목 발견:
1. 앞표지·뒤표지 이미지를 별도로 입력받는 UI 없음 → 책의 표지가 기본 picsum 이미지로만 처리됨
2. 여러 장의 내지 사진을 한 번에 업로드하는 방법 없음 → 페이지마다 개별 업로드 필요
3. "더미 데이터 채우기"가 정적 템플릿만 제공 → Gemini AI 동적 생성 경로 없음
4. Gemini 모델 목록이 실제 API 키 지원 모델과 불일치 → 429/404 오류 반복

### 구현 내용

#### 1. 앞표지 / 뒤표지 이미지 업로드 (editor/page.jsx)

**UI**: 에디터 좌측 패널 상단 "📖 표지 이미지" 섹션 → 2칸 그리드 (앞표지 / 뒤표지)
- 클릭 또는 Drag & Drop으로 파일 선택
- 이미지 선택 시 즉시 썸네일 미리보기
- 삭제 버튼으로 기본 이미지로 롤백

**업로드 흐름** (handleCreateBook):
```
책 UID 생성 → 앞표지 file → Photos API → URL 획득 → cover 템플릿 파라미터에 사용
            → 뒤표지 file → Photos API → URL 획득 → 마지막 contents 페이지로 추가
```
- 미업로드 시 `picsum.photos/seed/{serviceType}-cover-front` 기본 이미지 자동 사용

#### 2. 사진 일괄 업로드 (editor/page.jsx)

**UI**: "📸 사진 일괄 업로드" 버튼 (AI 초안 버튼 아래)
- `<input type="file" multiple accept="image/*">` 활성화
- 선택된 파일 배열을 pages 배열과 index 매칭하여 자동 배정
- 기존 `handleFileSelect` 재사용 → blob URL 미리보기 + stagedFiles에 저장

#### 3. AI 더미 생성 버튼 (create/[serviceType]/page.jsx)

**UI**: 기존 "더미 데이터 채우기" 옆에 "🤖 AI 더미 생성" 버튼 추가 (2-column flex)

**흐름**:
1. DUMMY_DATA[serviceType].meta를 기본 파라미터로 사용
2. `/api/generate-story` 호출 (Gemini)
3. 생성된 pages → sessionStorage → 에디터로 이동
4. 에디터에서 `aiGenerated: true` 배지 표시

**정적 더미와의 차이점**:
| 항목 | 정적 더미 | AI 더미 |
|------|---------|---------|
| 텍스트 | 고정 샘플 | Gemini 생성 (매번 다름) |
| 이미지 | picsum seed 고정 | picsum seed (동일) |
| 이동 경로 | 에디터 (더미 페이지 로드) | 에디터 (AI 페이지 로드) |
| 소요 시간 | 즉시 | 2~5초 (API 호출) |

#### 4. Gemini 모델 확정 (generate-story/route.js)

**문제**: 기존 모델 목록(`gemini-1.5-flash-8b`, `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-pro`)이 실제 API 키로 모두 404 또는 429 반환

**진단 방법**: `GET /v1beta/models?key={API_KEY}` ListModels API로 실제 지원 모델 목록 확인

**확정 모델 (v1beta, generateContent 지원)**:
| 모델 | 상태 | 우선순위 |
|------|------|---------|
| `gemini-flash-lite-latest` | ✅ 동작 확인 | 1순위 |
| `gemini-2.5-flash` | ✅ 동작 확인 | 2순위 |
| `gemini-2.5-pro` | ✅ 동작 확인 | 3순위 (쿼터 높음) |

- 모델명 접두사 `models/` 제거 (SDK가 자동으로 v1beta 경로 사용)
- 재시도 간 1,000ms delay 유지

---

## ✅ 2026-04-03 — [해결완료] HTTP 400 페이지 증분 위반 수정 · API 라우트 에러 로깅 개선

### 증상
- `POST /books/{uid}/finalization` → 400 Bad Request
- 서버 로그에 `'HTTP 400'` 문자열만 출력되어 원인 불명

### 원인 분석

**1. 홀수 페이지 전송 (페이지 증분 위반)**
- `API_MIN = 25` 하드코딩 → 내지 25페이지 + 뒤표지 1 = 26 contentInserts + 앞표지 1 = 총 27페이지
- SQUAREBOOK_HC의 `pageIncrement = 2` → 총 페이지가 홀수면 400 반환
- 공식: `총 페이지 = contentInserts + 2 (앞표지 + 뒤표지)` → 반드시 짝수여야 함

**2. API 라우트 catch 블록이 SDK 에러 구조 미지원**
- `err.response?.data` 참조 → SweetBook SDK는 `err.response`가 아닌 `err.message / err.statusCode / err.errorCode / err.details` 구조
- 실제 에러 정보가 로그에 전혀 안 찍혀 디버깅 불가

### 해결책

| 파일 | 수정 내용 |
|------|----------|
| `src/lib/constants.js` | BOOK_SPECS 각 항목에 `pageMin` 필드 추가 (SQUAREBOOK_HC=24, PHOTOBOOK_A4_SC=24, PHOTOBOOK_A5_SC=50) |
| `src/app/editor/page.jsx` | `API_MIN` 하드코딩 제거 → `BOOK_SPECS[bookSpecUid].pageMin / pageIncrement` 기반 수학적 계산으로 교체 |
| `src/app/api/books/[bookUid]/cover/route.js` | catch 블록 → `{ message, statusCode, errorCode, details }` 구조 로깅, 클라이언트에 `details` 포함 |
| `src/app/api/books/[bookUid]/contents/route.js` | 동일 수정 |
| `src/app/api/books/[bookUid]/finalize/route.js` | 동일 수정 |
| `src/app/api/books/[bookUid]/photos/route.js` | 동일 수정 (GET + POST catch 모두) |

**페이지 패딩 수식 (editor/page.jsx)**:
```js
const specPageMin       = BOOK_SPECS[bookSpecUid]?.pageMin       || 24;
const specPageIncrement = BOOK_SPECS[bookSpecUid]?.pageIncrement || 2;
const rawTotal          = Math.max(specPageMin, contentPageData.length + 2);
const rem               = rawTotal % specPageIncrement;
const targetTotal       = rem === 0 ? rawTotal : rawTotal + (specPageIncrement - rem);
const targetContentCount = targetTotal - 2;
```

### 결과
- 어떤 판형을 선택해도 API 요구사항(pageMin, pageIncrement)을 자동으로 만족
- 서버 에러 로그에 SweetBook SDK 상세 정보 표시 → 디버깅 즉시 가능

---

## 🏗️ 2026-04-03 — [UX 결정] 템플릿 선택 UI를 에디터 모달로 이전

### 결정
템플릿 선택을 정보 입력(Create) 단계에서 제거하고, 에디터 모달에서 사진별로 직접 선택하도록 UX를 개선하기로 결정함.

### 배경
- Create 단계에서 사용자가 템플릿 UID를 선택해도 각 템플릿의 파라미터 이름이 상이해서, 에디터에서 파라미터를 잘못 매핑하면 POST /contents 400 발생
- 사용자 입장에서 "템플릿이 무엇인지" 모르는 상태에서 선택하는 것은 UX 장벽

### 결정 근거
- 사진마다 다른 레이아웃(사진+텍스트, 텍스트 전용, 이미지 전용)을 적용해야 하므로 페이지 단위 선택이 자연스러움
- 에디터 갤러리 썸네일 클릭 모달에서 역할(앞표지/뒤표지/내지) + 레이아웃(템플릿) 동시 선택 가능
- 향후 실제 템플릿 파라미터 목록을 API에서 가져와 모달에 동적으로 표시 가능

---

## 🖼️ 2026-04-04 — [버그 수정] 템플릿 썸네일 경로 오매핑 → 전부 와이어프레임 폴백

### 문제
에디터 인라인 편집 패널의 템플릿 선택 카드에서 실제 API 썸네일 이미지가 전혀 렌더링되지 않고 모두 Tailwind CSS 와이어프레임 폴백으로만 표시됨.

### 원인
코드에서 `t.thumbnailUrl || t.previewUrl || t.imageUrl || t.thumbUrl` 순서로 URL을 탐색했으나, SweetBook API의 실제 응답 스키마는 모든 썸네일을 `thumbnails` 중첩 객체 안에 담아 반환함.

```json
// API 실제 응답 구조
{
  "thumbnails": {
    "layout": "https://cdn.sweetbook.com/...",
    "baseLayerOdd": "https://...",
    "baseLayerEven": "https://..."
  }
}
```

기존 flat field 경로는 모두 `undefined`를 반환 → `previewImg = falsy` → 와이어프레임 폴백 100% 발생.

### 해결
`renderTemplateSelector` 내 두 곳에서 URL 추출 우선순위를 아래 순서로 변경:

1. `t.thumbnails?.layout`
2. `t.thumbnails?.baseLayerOdd`
3. `t.thumbnails?.baseLayerEven`
4. `t.thumbnailUrl` / `t.previewUrl` / `t.imageUrl` / `t.thumbUrl` (기존 flat field 폴백)

또한 `<img>` 태그에 `onError` 핸들러를 추가하여 URL이 있더라도 이미지 로드 실패 시 숨겨진 `<div>` 안의 와이어프레임을 `display: block`으로 전환하는 2단 폴백 구조를 구현.

### 결과
- 실제 API 썸네일 이미지가 템플릿 선택 카드에 정상 렌더링
- 이미지 로드 실패 시 와이어프레임 자동 노출 (UX 회귀 없음)
- `inferWireframeType(t)`는 `previewImg` 유무에 관계없이 항상 계산 (onError 폴백용)

---

## 🖼️ 2026-04-04 — [UX 개선] 표지 템플릿 썸네일 역할별 CSS 크롭 처리

### 문제
SweetBook API의 표지(Cover) 템플릿 썸네일은 앞표지·뒤표지가 합쳐진 **양면(Spread) 이미지** 1장으로 제공됨. 에디터는 앞표지·뒤표지를 개별 역할로 분리해 사용자가 선택하는 구조인데, 템플릿 카드에 Spread 전체 이미지가 그대로 표시되어 "이게 앞표지인가 뒤표지인가?" 혼란 유발.

### 원인
POD(Print-On-Demand) 인쇄 API 특성상 표지 템플릿을 좌(뒤표지)·우(앞표지) 합본 이미지로 제공하며, 에디터 UI는 앞표지/뒤표지를 별도로 역할 지정하는 구조이므로 양자가 맞지 않음.

### 해결 — CSS 크롭 기법 도입
래퍼 `<div>` 에 `overflow-hidden` 을 걸고, 내부 `<img>` 를 `position: absolute; width: 200%` 로 확대하여 보이는 영역을 절반으로 제한.

| 역할 | CSS | 보이는 영역 |
|------|-----|------------|
| 앞표지 (front) | `right-0 w-[200%]` | 이미지 우측 절반 |
| 뒤표지 (back)  | `left-0 w-[200%]`  | 이미지 좌측 절반 |
| 내지 (content) | `w-full object-cover` | 전체 (크롭 없음) |

추가로 `getTemplatesForRole('back')` 도 cover 종류 템플릿을 반환하도록 수정하고, 뒤표지 역할 선택 시에도 표지 템플릿 선택 UI(`renderTemplateSelector('back')`)가 표시되도록 호출부를 추가함.

### 결과
- 앞표지 역할 선택 → 썸네일에서 오른쪽 절반(앞표지 디자인)만 노출
- 뒤표지 역할 선택 → 썸네일에서 왼쪽 절반(뒤표지 디자인)만 노출
- 내지 템플릿은 크롭 없이 원본 비율 그대로 표시
- 이미지 로드 실패 시 CSS 와이어프레임 폴백 유지

## 🔍 2026-04-06 — SweetBook API 문서 전수 검토 & Gap 분석

### 배경

제출 마감(4/8) 전 SweetBook API 공식 문서 10개 페이지를 전수 검토하여, 현재 구현이 API 스펙을 얼마나 충실히 반영하고 있는지 Gap 분석을 실시함. 검토 대상: Books API, Dynamic Layout, Template Engine, Element Grouping, Gallery, Column, Base Layer, Text Processing, Special Page Rules, Idempotency.

### 잘 구현된 영역 (✅ 9개)

| 영역 | 상태 |
|------|------|
| Books API 전체 워크플로우 (create→photos→cover→contents→finalize) | 완벽 |
| Orders API (estimate, create, list, detail, cancel) | 완벽 |
| Template Engine — theme 기반 필터링, templateKind(cover/content) 분리 | 완벽 |
| Template 파라미터 바인딩 — definitions[key].binding = file/text 자동 감지 | 완벽 |
| Base Layer 썸네일 — baseLayerOdd/baseLayerEven 폴백 체인 | 구현됨 |
| Cover Spread — 앞+뒤 통합 POST /cover | 구현됨 |
| Photo Upload — multipart, Drag & Drop, 갤러리 관리 | 구현됨 |
| Retry / Backoff — fetchWithRetry, 5xx 3회 재시도 | 구현됨 |
| 판형별 pageMin/pageIncrement 자동 검증 + 패딩 | 구현됨 |

### 부분 구현 영역 (⚠️ 3개)

**1. Gallery 배열 처리 (`/concepts/gallery/`)**
- 문제: API는 `rowGallery`(무제한 사진 행 배치)와 `collageGallery`(1-9장 콜라주)라는 바인딩 타입을 지원. 이들은 사진 URL **배열**을 받아야 함
- 현재: 에디터가 `[imageUrl]` 단일 원소 배열로만 전달 → 다중 사진 갤러리 템플릿 선택 시 레이아웃 미대응
- 영향: 다중 사진 레이아웃 선택 시 400 에러 가능

**2. breakBefore 동적 제어 (`/concepts/dynamic-layout/`)**
- 문제: API는 breakBefore를 `none`(연속 배치), `column`(다음 단), `page`(다음 페이지)로 제어 가능
- 현재: 모든 내지에 `breakBefore: 'page'`로 하드코딩 → 연속 배치 불가
- 영향: 기능 제한이지만 현재 사용 중인 1-column 템플릿에서는 문제 없음

**3. Special Page Rules — PUR 첫 내지 Right (`/concepts/special-page-rules/`)**
- 문제: PUR 제본(SQUAREBOOK_HC 포함)은 첫 내지(pageNum=1)가 오른쪽(Right) 면에 배치됨
- 현재: 미리보기에서 이 규칙을 반영하지 않아 첫 내지가 왼쪽에 표시될 수 있음
- 영향: 미리보기와 실제 인쇄 결과 불일치 가능

### 완전 누락 영역 (❌ 4개)

**1. Idempotency (`/concepts/idempotency/`) — 🔴 위험도 높음**
- API 문서: POST 요청 중복 방지를 위해 Redis 분산 락(30초 TTL) 사용. 동일 요청 30초 내 재전송 시 `409 Conflict` 반환. 주문 생성 시 `referenceId` 사용 권장
- 현재: Idempotency-Key 헤더 없음, 409 응답 처리 없음, referenceId 생성 없음
- 위험: 네트워크 불안정 시 책 이중 생성 또는 이중 결제 가능
- 구현 난이도: ⭐ 낮음 (fetchWithRetry에 409 처리 + crypto.randomUUID() referenceId)

**2. Dynamic Layout 고급 기능 (`/concepts/dynamic-layout/`)**
- `splittable`: 긴 텍스트 자동 분할 (페이지/단 경계에서 자동 잘림) — 미구현
- `isDynamic`: 텍스트 실제 길이 기반 동적 높이 계산 — 미구현
- `lanes`: X 범위 기반 독립 Y-flow 영역 — 미구현
- `itemSpacing`: 템플릿 인스턴스 간 간격 — 미구현
- 영향: 서버 측 처리이므로 파라미터만 전달하면 됨. 현재 1-page-per-content 구조에서는 문제 없음

**3. Element Grouping / 조건부 렌더링 (`/concepts/element-grouping/`)**
- `visible` 파라미터: 특정 요소(아이콘, 코멘트 등) 숨기기 — UI 토글 없음
- `shiftUpOnHide`: 숨긴 요소 공간 자동 당김 — 미구현
- `groupName`: 논리 그룹 단위 배치 — 미구현
- 영향: UX 편의 기능. 현재 사용자가 직접 텍스트를 비워서 우회 가능

**4. Column Templates (`/concepts/column/`)**
- 1/2/3단 레이아웃 지원 (UID: `cnH0Ud1nl1f9`, `4G5qpFLebGKd`, `2Ec6Dp8duR3z`) — 선택 UI 없음
- 영향: 현재 1단 레이아웃만 사용. 다단 레이아웃은 디자인 다양성 확보용

### 의사결정 — 제출 전 우선순위

| 순서 | 작업 | 이유 |
|------|------|------|
| 1 | Idempotency 적용 (409 처리 + referenceId) | API 문서 명시 필수, 이중 결제 방지, 난이도 낮음 |
| 2 | Gallery 배열 바인딩 수정 | 일부 템플릿 400 에러 방지 |
| 3 | Special Page Rules 미리보기 반영 | 인쇄 결과와 미리보기 정확도 |
| 4 | breakBefore 동적 제어 | 하드코딩 제거, API 스펙 준수 |
| 5 | npm run build + E2E 검증 | 제출 필수 |

Dynamic Layout 고급 기능, Element Grouping, Column Templates는 서버 측 자동 처리이거나 UX 편의 기능이므로 제출 후 개선 대상으로 분류.

---

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
