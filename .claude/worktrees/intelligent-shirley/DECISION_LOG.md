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
