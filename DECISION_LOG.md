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
