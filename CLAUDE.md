# CLAUDE.md — KidCanvas 프로젝트 지침서

> Claude Code 마스터 지침서. 모든 코드 수정 시 반드시 이 문서의 규칙을 따르세요.

---

## 1. 프로젝트 개요

### 서비스 설명
- **KidCanvas**: SweetBook Book Print API 기반 우리 아이 그림 작품집 제작 에디터
- 단일 서비스 `kidcanvas` — 부모가 아이 그림 사진을 업로드 → AI가 작품 해설/제목 생성 → 미술관 도록 스타일 하드커버 포토북으로 제작
- **디자인 시스템**: 따뜻한 파스텔 톤 + 귀여운 둥근 UI (Nanum Pen Script + Noto Sans KR)
- **채용 과제**: (주)스위트북 '바이브코딩 풀스택 개발자' 포지션

### 과제 핵심 요구사항 (절대 위반 금지)
1. **Books API + Orders API 필수 사용**
2. **백엔드 프록시** — 프론트엔드에서 api.sweetbook.com 직접 호출 금지
3. **API Key 보안** — .env로만 관리
4. **모노레포** — 프론트엔드 + 백엔드 단일 저장소
5. **더미 데이터** — src/data/dummy.js에 26페이지 아이 그림 작품집 시나리오 (Gemini 생성 이미지 28장)

### 서비스 차별화
- **감성**: 아이 그림은 시간이 지나면 버려지지만, 책으로 남기고 싶은 욕구가 매우 강함
- **비즈니스**: 유아교육 시장, 어린이집/유치원 B2B 연간 계약 가능
- **독창성**: 기존 예시 서비스 중 없음, 검색해도 유사 서비스 거의 없음
- **AI 활용**: 아이 그림에 대한 미술관 큐레이터 스타일 해설 자동 생성

### 마감
- **2026년 4월 8일(화) 23:59** — GitHub Public + 구글폼 제출

---

## 2. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 14.x |
| 프론트엔드 | React | 18.x |
| 스타일링 | Tailwind CSS | 3.x |
| API 클라이언트 | bookprintapi-nodejs-sdk | 1.x |
| AI 텍스트 생성 | Google Gemini API (@google/generative-ai) | latest |

### 사용하면 안 되는 것
- TypeScript, 외부 상태관리 라이브러리, DB

---

## 3. 프로젝트 구조

```
bookmaker/
├── CLAUDE.md / DECISION_LOG.md / README.md
├── .env.example / .env (gitignore)
├── src/
│   ├── app/
│   │   ├── page.jsx             # 랜딩 페이지
│   │   ├── create/[serviceType]/page.jsx  # 작품집 정보 입력
│   │   ├── editor/page.jsx      # 콘텐츠 에디터 (핵심)
│   │   ├── preview/page.jsx     # 미리보기 & 견적
│   │   ├── order/page.jsx       # 배송지 + 주문
│   │   ├── orders/page.jsx      # 주문 내역
│   │   └── api/                 # 백엔드 API 프록시 + AI 텍스트 생성
│   ├── components/              # Header, StepIndicator, Toast 등
│   ├── lib/                     # sweetbook.js, constants.js, fetchWithRetry.js
│   └── data/dummy.js            # 아이 그림 작품집 더미 데이터 (26p, Gemini 생성)
└── public/images/kidcanvas/     # Gemini 생성 아이 그림 이미지 28장 (커버 2 + 내지 26)
```

---

## 4. 아키텍처 규칙

### API 통신 흐름 (절대 준수)
```
[브라우저] -> fetch('/api/books') -> [Next.js API Route] -> SweetBook SDK -> [api-sandbox.sweetbook.com]
```

### 핵심 워크플로우
```
1. 에디터 갤러리에 아이 그림 사진 업로드
2. 썸네일 클릭 → 인라인 편집 패널에서 역할 지정 + AI 해설 생성
3. 구성 미리보기에서 확인
4. [최종 생성 및 주문] → POST /books → /photos → GET /photos(검증) → /cover → /contents → /finalization → GET /books/{uid}(검증)
5. POST /orders/estimate → POST /orders
```

### 카테고리 기반 템플릿 시스템
> **절대 규칙**: `theme` 필드(카테고리) + `templateKind`로 필터링. 문자열 파싱 금지.

- **추천 템플릿**: `일기장B` (동화책 스타일) — 아이 그림 + 스토리텔링 구조에 최적
- **Secondary**: `일기장A` (육아 일기) — 성장 기록 스타일
- **Fallback**: `구글포토북A` — 유연한 사진 중심 레이아웃

### 템플릿 추천 근거
| 카테고리 | 적합도 | 이유 |
|---------|--------|------|
| `일기장B` | ★★★★★ | 동화책/스토리북 구조, 사진+텍스트 레이아웃, 날짜 기록 지원 |
| `일기장A` | ★★★★ | 육아 일기 스타일, 날짜/제목/본문 구조가 작품 기록에 적합 |
| `구글포토북A` | ★★★ | 유연한 사진 레이아웃, 다양한 크기 아트워크 배치 가능 |
| `알림장B` | ★★ | 유치원 구조이나 알림장 특화, 작품집과는 결이 다름 |

- `buildCategoryGroups()` — theme별 `{ covers[], withPhoto[], textOnly[], blank[] }` 분류
- `categoryToTplMap()` — 카테고리 그룹 → 템플릿 UID 매핑
- `DECORATIVE_FILE_KEYS` — 장식용 파일 바인딩(`lineVertical`, `pencilIcon` 등) 분리
- `breakBefore` 안전 기본값: `'page'` — 1 content = 1 물리적 페이지 보장
- **Auto Compose**: 갤러리 이미지를 자동으로 표지/내지 배치 (24~130p, 2p 단위, 빈 슬롯 자동 패딩)
- **로컬 이미지 지원**: `public/images/kidcanvas/` 경로 → 프리뷰 표시 + API 업로드 시 fetch→File 변환
- **AI 텍스트 생성**: 에디터 내 `AI TEXT` 버튼 → `/api/generate-page-text` → Gemini API로 아이 그림 작품 해설 자동 작성
- **로컬 경로 안전 처리**: `resolveImageUrl()` + `safePreviewUrl()` — `/images/...` 로컬 경로도 유효 URL로 인정
- **Gemini 생성 더미 이미지**: AI 생성 아이 그림 28장, date(YYYY-MM-DD) 포맷 + 제목 + 해설 완비
- **API 검증 파이프라인**: 사진 업로드 후 `GET /photos` 카운트 검증 + 최종화 후 `GET /books/{uid}` 상태 확인

### 판형 (BookSpec)
- `SQUAREBOOK_HC` — 243×248mm, 하드커버, PUR 무선철, 24~130p (**기본**)
- `PHOTOBOOK_A4_SC` — 210×297mm, 소프트커버, 24~130p
- `PHOTOBOOK_A5_SC` — 148×210mm, 소프트커버, 50~200p

### API 문서
- 전체: https://api.sweetbook.com/docs
- Books: https://api.sweetbook.com/docs/api/books/
- Orders: https://api.sweetbook.com/docs/api/orders/

---

## 5. 코딩 컨벤션

- 프론트엔드: .jsx, PascalCase
- API 라우트: route.js, 디렉토리 기반
- 에러 핸들링: try/catch + `err.statusCode` 전파
- Tailwind: peach/butter/mint 파스텔 팔레트, .btn-primary/.input-field 공통 클래스
- UI 스타일: 둥근 모서리(rounded-2xl), 부드러운 그림자, 따뜻한 색감

---

## 6. 작업 시 주의사항

### 절대 하면 안 되는 것
- .env 커밋, 클라이언트에 API Key 노출
- sweetbook.js를 클라이언트에서 import
- TypeScript 변환

### 변경 후 확인
- `npm run build` 에러 없는지
- API 라우트 정상 응답
- 모바일 반응형 (640px 이하)

---

## 7. 과제 필수 요구사항 충족 현황

> 출처: 스위트북_개발과제_안내문.pdf

### 기능 요구사항
- [x] Books API + Orders API 필수 사용
- [x] 최종 사용자(고객)가 사용하는 프론트엔드 UI가 있는 웹 애플리케이션
- [x] 백엔드 서버가 API Key를 관리하고 Book Print API와 통신
- [x] 콘텐츠 더미 데이터를 레포에 포함 (`src/data/dummy.js`)

### 실행 환경
- [x] README.md 안내대로 로컬에서 실행 가능 (`npm install` → `npm run dev`)
- [x] 환경변수로 API Key 설정 (`.env.example` 포함, 키 값 미커밋)
- [ ] GitHub 저장소 **Public** 설정 확인

### README 필수 항목 (과제 안내문 기준)
- [x] 서비스 소개 — 한 문장 설명 + 타겟 고객 + 주요 기능 목록
- [x] 실행 방법 — 복사-붙여넣기만으로 실행 가능
- [x] 사용한 API 목록 — 엔드포인트별 용도 테이블
- [x] AI 도구 사용 내역 — 도구별 활용 내용 테이블
- [x] 설계 의도 — 서비스 선택 이유 + 비즈니스 가능성 + 추가 기능 계획

---

## 8. 할일 목록

### P0 — 과제 제출 (마감: 4/8 화 23:59)
- [x] `npm run build` 최종 성공 확인
- [ ] E2E 플로우 수동 검증 (더미→에디터→책생성→미리보기→주문→주문내역)
- [ ] GitHub 저장소 **Public** 설정 확인
- [ ] 구글폼 서술형 4문항 작성 + GitHub URL 제출

### P1 — UX 폴리시 (제출 전 가능하면)
- [x] Skeleton UI 로딩 — spinner → 콘텐츠 형태 스켈레톤 (에디터/미리보기/주문/주문내역)
- [x] 페이지 전환 애니메이션 — 전 페이지 fade + translateY 트랜지션 (page-transition)
- [x] 디자인 피벗 — ARCHIVE(B&W) → KidCanvas(따뜻한 파스텔, 둥근 UI)
- [ ] 모바일 반응형 최종 점검 (640px 이하)

### P2 — 면접 준비
- [ ] 프레젠테이션 자료 제작 (5분 이내, 화면 캡처/영상 녹화 활용, AI 활용 권장)
- [ ] 서비스 설계 의도 + 기술적 의사결정 설명 준비 (DECISION_LOG.md 기반)

### 완료된 기능
- [x] Auto Compose — 이미지 기반 자동 페이지 구성 (규칙 기반 배치, 24~130p 지원)
- [x] AI 텍스트 생성 — 에디터 내 페이지별 작품 해설 Gemini AI 자동 작성 (AI TEXT 버튼)
- [x] 로컬 이미지 미리보기 — resolveImageUrl + safePreviewUrl 로컬 경로(`/`) 지원
- [x] Webhook 완전 구현 — 수신 + HMAC 서명 검증 + ngrok 연동 + 로컬 시뮬레이션
- [x] 서비스 피벗 — ARCHIVE → KidCanvas (따뜻한 파스텔 디자인 + 아이 그림 작품집)
- [x] 더미 데이터 고급화 — Gemini 생성 아이 그림 이미지 28장 + YYYY-MM-DD date + 작품 해설

### 향후 개선 (면접 후)
- [ ] 사용자 인증 (NextAuth)
- [ ] 다크 모드
- [ ] AI 이미지 분석 — Gemini Vision으로 아이 그림 자동 캡션/태깅
- [ ] B2B 기능 — 어린이집/유치원 단체 주문, 연간 구독
