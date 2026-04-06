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
// ─── 고품질 정적 이미지 URL 큐레이션 (Minimal & Tech Vibe) ───────────────────
// 무작위 picsum 대신 흑백, 코드, 아키텍처, 미니멀 워크스페이스 테마의 고정 이미지 사용
const HD_IMG = {
  cover: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80', // 코딩 화면
  back: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80', // 데이터 네트워크
  kickoff: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=600&q=80', // 맥북 셋업
  adr: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=600&q=80', // 알고리즘 노트
  aws: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80', // 서버룸/클라우드
  typing: 'https://images.unsplash.com/photo-1528901166007-3784c7c2a4fc?auto=format&fit=crop&w=600&q=80', // 키보드
  canvas: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?auto=format&fit=crop&w=600&q=80', // UI/UX 와이어프레임
  perf: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80', // 데이터 대시보드
  panorama: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80' // 와이드 타이핑 화면
};

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE — 크리에이터/개발자를 위한 프로젝트 포트폴리오 북 더미 데이터
// ─────────────────────────────────────────────────────────────────────────────
export const archiveDummy = {
  meta: {
    bookTitle:       '2026 Annual Archive',
    authorName:      'Tommy (D-Lab Instructor)',
    role:            'Software Engineer & Educator',
    techStack:       'React, Next.js, Python, C, AWS EC2',
    period:          '2026.01 — 2026.12',
    bookDescription: '코드를 가르치고, 프로덕트를 만드는 개발자의 1년. Sweetbook 아키텍처 설계부터 교육 커리큘럼 혁신까지의 기록.',
  },
  frontCover: { image: HD_IMG.cover, title: '2026 Annual Archive' },
  backCover:  { image: HD_IMG.back },
  pages: [
    // ── 1~12p: 프로젝트 회고 텍스트 + 이미지 ──
    { date: '2026-03', title: 'Sweetbook Project Kickoff', text: 'Sweetbook API 기반 포토북 제작 플랫폼 개발에 착수했다. Skeleton UI와 다크 모드 렌더링 이슈를 해결하고, URL resolution 및 이미지 처리 헬퍼 함수들을 최적화하여 쾌적한 에디터 환경을 구축했다.', image: HD_IMG.kickoff },
    { date: '2026-03', title: 'AWS Cloud Infrastructure', text: 'Python 기반 봇 프로그램인 "JiMaengBot"을 개발하고 AWS EC2 (t3.micro) Ubuntu 인스턴스에 성공적으로 배포했다. .pem 키를 활용한 SSH 보안 접속 트러블슈팅과 nohup 백그라운드 무중단 실행 프로세스를 완벽하게 제어했다.', image: HD_IMG.aws },
    { date: '2026-03', title: 'Algorithmic Curriculum Design', text: 'USACO (USA Computing Olympiad) 대비 학생들을 위한 백준 알고리즘 커리큘럼을 재설계했다. 특히 Bronze 등급을 달성한 우수 학생들을 Python에서 C 언어 트랙으로 원활하게 전환시키는 브릿지 과정을 성공적으로 안착시켰다.', image: HD_IMG.adr },
    { date: '2026-03', title: 'Live Event Leadership', text: 'Google Sheets, CSV, HTML을 통합 연동하여 학생 타자 대회를 기획하고 실시간 리더보드 대시보드를 구축했다. 타자왕 부문 1, 2위에게 집중 포상하고, 참가상은 과감히 배제하여 경쟁력을 높였다. 노력상(Progress King)은 사전에 숨겨두었다가 행사 후반에 깜짝 발표하여 교육적 동기부여를 극대화했다.', image: HD_IMG.typing },
    { date: '2026-04', title: 'Interactive Learning Tools', text: '데이터 사이언스 입문자를 위한 대화형 Jupyter Notebook(.ipynb) 템플릿을 제작했다. 데이터 클리닝부터 시각화, 인사이트 도출까지 퀴즈 형태로 풀어내어 학생들의 자기주도적 학습 효율을 대폭 향상시켰다.', image: HD_IMG.canvas },
    { date: '2026-04', title: 'Idempotency & API Reliability', text: '결제 및 주문 생성 파이프라인(Orders API)에 Idempotency-Key를 적용하여 분산 환경에서의 중복 주문을 원천 차단했다. 400 에러의 원인이었던 다중 갤러리 배열 직렬화와 더미 데이터 충돌 문제를 완벽히 디버깅했다.', image: HD_IMG.perf },
    
    // ... (7~12p는 기존 개발 회고 내용 유지 또는 추가 확장) ...
    { date: '2026-07', title: 'Spread Layout Engine', text: '내지를 항상 2페이지(L+R) Spread 단위로 관리하는 엔진을 설계했다. spreadGroups useMemo, addSpread(), removeSpreadPair() 핵심 함수로 홀수 페이지 상태를 원천 차단했다.', image: HD_IMG.canvas },
    { date: '2026-08', title: 'Performance Optimization', text: '에디터 페이지 렌더링 최적화 진행. useMemo로 spreadGroups와 totalContentPages를 메모이제이션하고, React DevTools Profiler로 불필요한 리렌더를 추적해 제거했다.', image: HD_IMG.perf },
    { date: '2026-09', title: 'Dynamic Form System', text: '템플릿마다 다른 파라미터를 자동으로 폼 UI에 반영하는 시스템을 구축했다. findDefinitions() 폴백 + on-demand enrichment로 API 실패에도 우아하게 대응한다.', image: HD_IMG.kickoff },
    { date: '2026-10', title: 'Preview & Flip Animation', text: '스프레드 뷰 기반 미리보기를 구현했다. CSS perspective + transform으로 책 넘김 효과를 만들고, 3중 네비게이션을 지원한다.', image: HD_IMG.adr },
    { date: '2026-11', title: 'Order & Webhook Pipeline', text: 'Orders API 연동으로 견적→주문 파이프라인을 완성하고, Webhook 수신 라우트로 실시간 상태 동기화 기반을 마련했다.', image: HD_IMG.aws },
    { date: '2026-12', title: 'Year in Review', text: '1년간의 프로젝트, 인프라 배포, 그리고 교육. 아키텍처 의사결정의 트레이드오프를 문서화하는 습관이 내 개발 철학이 되었다.', image: HD_IMG.kickoff },

    // ── 13~24p: text: "" Full-bleed 스크린샷/다이어그램 (기존 구조 유지) ──
    { date: '2026-01', title: 'System Architecture Diagram',  text: '', image: HD_IMG.aws },
    { date: '2026-02', title: 'API Flow Sequence',            text: '', image: HD_IMG.perf },
    { date: '2026-03', title: 'Editor UI Screenshot',         text: '', image: HD_IMG.panorama, isLandscape: true },
    { date: '2026-04', title: 'Template Category Map',        text: '', image: HD_IMG.canvas },
    { date: '2026-05', title: 'Error Dashboard',              text: '', image: HD_IMG.aws },
    { date: '2026-06', title: 'Gallery Wireframe',            text: '', image: HD_IMG.panorama, isLandscape: true },
    { date: '2026-07', title: 'Spread Preview',               text: '', image: HD_IMG.kickoff },
    { date: '2026-08', title: 'Lighthouse Report',            text: '', image: HD_IMG.perf },
    { date: '2026-09', title: 'Component Tree',               text: '', image: HD_IMG.canvas },
    { date: '2026-10', title: 'Flip Animation Demo',          text: '', image: HD_IMG.adr },
    { date: '2026-11', title: 'Order Status Flow',            text: '', image: HD_IMG.perf },
    { date: '2026-12', title: 'GitHub Contribution Graph',    text: '', image: HD_IMG.aws },
  ],
};

// ─── 서비스 타입 → 더미 데이터 매핑 ──────────────────────────────────────────
export const DUMMY_DATA = {
  archive: archiveDummy,
};
