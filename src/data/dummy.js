// ─── 더미 이미지 URL ─────────────────────────────────────────────────────────

// picsum.photos — 시드 기반 실제 JPEG, SweetBook API 검증 통과

// placehold.co 는 PNG를 반환하여 SweetBook 파일 헤더 검증에 실패하므로 사용 금지

//

// 템플릿 분기 규칙 (editor/page.jsx 기준):

//   image: PLACEHOLDER(seed)  + text: "텍스트"  → TPL_WITH_PHOTO  (3FhSEhJ94c0T) ← 사진+텍스트

//   image: PLACEHOLDER(seed)  + text: ""        → TPL_WITH_PHOTO  (3FhSEhJ94c0T) ← Full-bleed 사진

//   image: null               + text: "텍스트"  → TPL_TEXT_ONLY   (vHA59XPPKqak) ← 텍스트 전용

//

// 표지(frontCover/backCover)는 pages 배열과 완전 분리 — pages에서 빼지 않으므로 순수 내지 24장 보장

// 24페이지 구성: 12페이지 텍스트 有 + 12페이지 텍스트 無 (text: "")

// isLandscape: true 로 표시된 항목은 파노라마(1200×600) 이미지 — 갤러리에서 가로형 배지 표시



const PLACEHOLDER = (seed) =>

  `https://picsum.photos/seed/${seed}/600/600`;



const PANORAMA = (seed) =>

  `https://picsum.photos/seed/${seed}/1200/600`;



// ─────────────────────────────────────────────────────────────────────────────

// ARCHIVE — 크리에이터/개발자를 위한 프로젝트 포트폴리오 북 더미 데이터

// 1~12p: 프로젝트 회고 텍스트 + 스크린샷/다이어그램 → TPL_WITH_PHOTO

// 13~24p: text: "" Full-bleed 사진 → TPL_WITH_PHOTO

// ─────────────────────────────────────────────────────────────────────────────

export const archiveDummy = {

  meta: {

    bookTitle:       '2025 Annual Archive',

    authorName:      'Jimin Park',

    role:            'Full-Stack Developer',

    techStack:       'React, Next.js, Node.js, PostgreSQL, AWS',

    period:          '2025.01 — 2025.12',

    bookDescription: '풀스택 개발자 1년의 여정. 5개의 프로덕션 프로젝트, 기술적 도전, 그리고 성장의 기록.',

  },

  frontCover: { image: PLACEHOLDER('archive-cover-front'), title: '2025 Annual Archive' },

  backCover:  { image: PLACEHOLDER('archive-cover-back') },

  pages: [

    // ── 1~12p: 프로젝트 회고 텍스트 + 이미지 ──

    { date: '2025-01', title: 'Project Kickoff: BookMaker', text: '올해의 첫 프로젝트는 SweetBook API 기반 포토북 제작 플랫폼이었다. Next.js App Router를 처음 프로덕션에 적용했고, 서버 컴포넌트와 클라이언트 컴포넌트의 경계를 확실히 이해하게 된 계기가 됐다. API 프록시 패턴으로 보안을 잡고, sessionStorage 기반 상태 관리로 DB 없이도 완전한 UX를 구현했다.', image: PLACEHOLDER('arch-kickoff') },

    { date: '2025-02', title: 'Architecture Decision Records', text: '프로젝트 초기 아키텍처 의사결정을 ADR로 체계적으로 기록하기 시작했다. 모노레포 구조, API 프록시 패턴, 클라이언트 상태 전략 등 핵심 결정들을 문서화했다. 특히 "왜 TypeScript를 쓰지 않았는가"에 대한 트레이드오프 분석이 면접에서 좋은 평가를 받았다.', image: PLACEHOLDER('arch-adr') },

    { date: '2025-03', title: 'Canvas API Deep Dive', text: 'Spread 분할 기능을 구현하면서 Canvas API의 깊은 영역에 들어갔다. splitImageHalves() 함수로 파노라마 사진을 좌/우 정밀 분할하고, quality=1.0으로 무손실 JPEG 출력을 보장했다. 브라우저 메모리 관리와 Blob URL 라이프사이클도 이번에 제대로 이해했다.', image: PLACEHOLDER('arch-canvas') },

    { date: '2025-04', title: 'Template System Overhaul', text: '하드코딩된 3개 템플릿 UID 체제에서 API 동적 조회 + 카테고리 그룹핑 시스템으로 전면 개편했다. buildCategoryGroups()와 categoryToTplMap()을 설계하면서 "convention over configuration" 원칙을 처음으로 직접 적용해봤다. 결과적으로 새 템플릿 추가 시 코드 변경 제로를 달성했다.', image: PLACEHOLDER('arch-template') },

    { date: '2025-05', title: 'Error Handling Strategy', text: 'fetchWithRetry로 5xx 에러에 대한 3회 자동 재시도와 지수 백오프를 구현했다. Idempotency-Key 헤더로 중복 주문을 방지하고, 409 Conflict를 안전하게 처리하는 패턴을 만들었다. 이 과정에서 "실패는 정상 플로우의 일부"라는 관점을 갖게 됐다.', image: PLACEHOLDER('arch-error') },

    { date: '2025-06', title: 'Drag & Drop Gallery', text: 'HTML5 Drag & Drop API와 FileReader를 조합해 갤러리 시스템을 구현했다. 다중 파일 업로드, 썸네일 그리드, 드래그 리오더, 역할 지정(표지/내지) 등 복합 인터랙션을 하나의 상태 모델로 관리했다. stagedFilesRef(useRef)로 File 객체를 gallery state와 독립 보관하는 패턴이 핵심이었다.', image: PLACEHOLDER('arch-gallery') },

    { date: '2025-07', title: 'Spread Layout Engine', text: '내지를 항상 2페이지(L+R) Spread 단위로 관리하는 엔진을 설계했다. spreadGroups useMemo, addSpread(), removeSpreadPair(), swapSpreadSlot() — 4개의 핵심 함수로 홀수 페이지 상태를 원천 차단했다. PUR 제본의 첫 내지 Right 배치 규칙도 미리보기에 반영했다.', image: PLACEHOLDER('arch-spread') },

    { date: '2025-08', title: 'Performance Optimization', text: '에디터 페이지가 2000줄을 넘어가면서 렌더링 최적화가 필수가 됐다. useMemo로 spreadGroups와 totalContentPages를 메모이제이션하고, useCallback으로 이벤트 핸들러 안정화. React DevTools Profiler로 불필요한 리렌더를 추적해 제거했다.', image: PLACEHOLDER('arch-perf') },

    { date: '2025-09', title: 'Dynamic Form System', text: '템플릿마다 다른 파라미터(weather, meal, teacherComment 등)를 자동으로 폼 UI에 반영하는 시스템을 구축했다. findDefinitions() 3-layer 폴백 + on-demand enrichment로 API 실패에도 우아하게 대응한다. TEXT_FIELD_LABELS 매핑으로 key→한글 라벨 자동 변환.', image: PLACEHOLDER('arch-dynform') },

    { date: '2025-10', title: 'Preview & Flip Animation', text: '스프레드 뷰 기반 미리보기를 구현했다. CSS perspective + transform으로 책 넘김 효과를 만들고, 키보드 화살표/버튼/도트 인디케이터 3중 네비게이션을 지원한다. 블러 티저(상위 4스프레드 공개 + 나머지 blur-md)로 구매 전환을 유도하는 UX 전략도 적용했다.', image: PLACEHOLDER('arch-preview') },

    { date: '2025-11', title: 'Order & Webhook Pipeline', text: 'Orders API 연동으로 견적→주문→배송 추적 파이프라인을 완성했다. 주문 상태 11단계(PAID~ERROR) 전체를 UI에 매핑하고, Webhook 수신 라우트로 실시간 상태 동기화 기반을 마련했다. 배송지 변경 PATCH API까지 풀스택으로 구현.', image: PLACEHOLDER('arch-orders') },

    { date: '2025-12', title: 'Year in Review', text: '1년간 5개 프로젝트, 847개 커밋, 12만 줄의 코드. 가장 큰 성장은 기술 자체가 아니라 "왜 이 기술을 선택했는가"를 설명할 수 있게 된 것이다. 아키텍처 의사결정의 트레이드오프를 문서화하는 습관, 실패를 디버깅 로그로 남기는 문화가 내 개발 철학이 됐다.', image: PLACEHOLDER('arch-yearend') },

    // ── 13~24p: text: "" Full-bleed 스크린샷/다이어그램 ──

    { date: '2025-01', title: 'System Architecture Diagram',  text: '', image: PLACEHOLDER('arch-sys-diagram') },

    { date: '2025-02', title: 'API Flow Sequence',            text: '', image: PLACEHOLDER('arch-api-flow') },

    { date: '2025-03', title: 'Editor UI Screenshot',         text: '', image: PLACEHOLDER('arch-editor-ui'), isLandscape: true },

    { date: '2025-04', title: 'Template Category Map',        text: '', image: PLACEHOLDER('arch-cat-map') },

    { date: '2025-05', title: 'Error Dashboard',              text: '', image: PLACEHOLDER('arch-error-dash') },

    { date: '2025-06', title: 'Gallery Wireframe',            text: '', image: PANORAMA('arch-gallery-wf'), isLandscape: true },

    { date: '2025-07', title: 'Spread Preview',               text: '', image: PLACEHOLDER('arch-spread-pv') },

    { date: '2025-08', title: 'Lighthouse Report',            text: '', image: PLACEHOLDER('arch-lighthouse') },

    { date: '2025-09', title: 'Component Tree',               text: '', image: PLACEHOLDER('arch-comp-tree') },

    { date: '2025-10', title: 'Flip Animation Demo',          text: '', image: PLACEHOLDER('arch-flip-demo') },

    { date: '2025-11', title: 'Order Status Flow',            text: '', image: PLACEHOLDER('arch-order-flow') },

    { date: '2025-12', title: 'GitHub Contribution Graph',    text: '', image: PLACEHOLDER('arch-github-graph') },

  ],

};



// ─── 서비스 타입 → 더미 데이터 매핑 ──────────────────────────────────────────

export const DUMMY_DATA = {

  archive: archiveDummy,

};