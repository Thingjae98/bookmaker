# CLAUDE.md — ARCHIVE 프로젝트 지침서

> Claude Code 마스터 지침서. 모든 코드 수정 시 반드시 이 문서의 규칙을 따르세요.

---

## 1. 프로젝트 개요

### 서비스 설명
- **ARCHIVE**: SweetBook Book Print API 기반 개발자/크리에이터 포트폴리오 북 제작 에디터
- 단일 서비스 `archive` — 프로젝트 스크린샷, 아키텍처 다이어그램, 회고 텍스트를 하드커버 북으로 아카이빙
- **디자인 시스템**: Black & White 미니멀 매거진 스타일 (JetBrains Mono + Noto Serif KR)
- **채용 과제**: (주)스위트북 '바이브코딩 풀스택 개발자' 포지션

### 과제 핵심 요구사항 (절대 위반 금지)
1. **Books API + Orders API 필수 사용**
2. **백엔드 프록시** — 프론트엔드에서 api.sweetbook.com 직접 호출 금지
3. **API Key 보안** — .env로만 관리
4. **모노레포** — 프론트엔드 + 백엔드 단일 저장소
5. **더미 데이터** — src/data/dummy.js에 24페이지 포트폴리오 시나리오

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
│   │   ├── create/[serviceType]/page.jsx  # 프로젝트 정보 입력
│   │   ├── editor/page.jsx      # 콘텐츠 에디터 (핵심)
│   │   ├── preview/page.jsx     # 미리보기 & 견적
│   │   ├── order/page.jsx       # 배송지 + 주문
│   │   ├── orders/page.jsx      # 주문 내역
│   │   └── api/                 # 백엔드 API 프록시 + AI 텍스트 생성
│   ├── components/              # Header, StepIndicator, Toast 등
│   ├── lib/                     # sweetbook.js, constants.js, fetchWithRetry.js
│   └── data/dummy.js            # 포트폴리오 더미 데이터 (24p)
└── public/images/portfolio/     # 프로젝트 스크린샷 (시연용)
```

---

## 4. 아키텍처 규칙

### API 통신 흐름 (절대 준수)
```
[브라우저] -> fetch('/api/books') -> [Next.js API Route] -> SweetBook SDK -> [api-sandbox.sweetbook.com]
```

### 핵심 워크플로우
```
1. 에디터 갤러리에 사진 업로드
2. 썸네일 클릭 → 인라인 편집 패널에서 역할 지정 + 텍스트 입력
3. 구성 미리보기에서 확인
4. [최종 생성 및 주문] → POST /books → /photos → /cover → /contents → /finalization
5. POST /orders/estimate → POST /orders
```

### 카테고리 기반 템플릿 시스템
> **절대 규칙**: `theme` 필드(카테고리) + `templateKind`로 필터링. 문자열 파싱 금지.

- `buildCategoryGroups()` — theme별 `{ covers[], withPhoto[], textOnly[], blank[] }` 분류
- `categoryToTplMap()` — 카테고리 그룹 → 템플릿 UID 매핑
- `DECORATIVE_FILE_KEYS` — 장식용 파일 바인딩(`lineVertical`, `pencilIcon` 등) 분리
- `breakBefore` 안전 기본값: `'page'` — 1 content = 1 물리적 페이지 보장
- **Auto Compose**: 갤러리 이미지를 자동으로 표지/내지 배치 (24~130p, 빈 슬롯 자동 패딩)
- **로컬 이미지 지원**: `public/images/portfolio/` 경로 → 프리뷰 표시 + API 업로드 시 fetch→File 변환
- **AI 텍스트 생성**: 에디터 내 `AI TEXT` 버튼 → `/api/generate-page-text` → Gemini API로 페이지별 회고/캡션 자동 작성
- **로컬 경로 안전 처리**: `resolveImageUrl()` + `safePreviewUrl()` — `/images/...` 로컬 경로도 유효 URL로 인정

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
- Tailwind: neutral 그레이스케일, .btn-primary/.input-field 공통 클래스

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

## 7. 향후 작업 우선순위

### P0 — 과제 제출 (마감: 4/8 화 23:59)
- [ ] `npm run build` 최종 성공 확인
- [ ] E2E 플로우 수동 검증 (더미→에디터→책생성→미리보기→주문→주문내역)
- [ ] GitHub 저장소 **Public** 설정 확인
- [ ] 구글폼 서술형 4문항 작성 + GitHub URL 제출

### P1 — 시연 영상 녹화 준비
- [ ] 로컬 환경 시연 영상 녹화 (5분 이내)
- [ ] 모바일 반응형 최종 점검
- [ ] Skeleton UI 로딩 (현재 spinner → 콘텐츠 형태 스켈레톤)

### P2 — 면접 후 개선
- [x] Auto Compose — 이미지 기반 자동 페이지 구성 (규칙 기반 배치, 24~130p 지원)
- [x] AI 텍스트 생성 — 에디터 내 페이지별 회고/캡션 Gemini AI 자동 작성 (AI TEXT 버튼)
- [x] 로컬 이미지 미리보기 수정 — resolveImageUrl + safePreviewUrl 로컬 경로(`/`) 지원
- [ ] 임시저장 & 이어서 편집 (localStorage/IndexedDB → Orders 페이지 연동)
- [ ] Webhook 상태 동기화 로직
- [ ] 사용자 인증 (NextAuth)
- [ ] 다크 모드
