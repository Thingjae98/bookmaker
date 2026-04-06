// ─── 더미 이미지 URL ─────────────────────────────────────────────────────────
// picsum.photos — 시드 기반 실제 JPEG, SweetBook API 검증 통과
// placehold.co 는 PNG를 반환하여 SweetBook 파일 헤더 검증에 실패하므로 사용 금지
//
// 로컬 프로젝트 스크린샷: public/images/portfolio/*.png — Next.js 정적 서빙
// 시연 시 에디터 갤러리에서 직접 업로드 가능 (Drag & Drop)
//
// 템플릿 분기 규칙 (editor/page.jsx 기준):
//   image: URL          + text: "텍스트"  → TPL_WITH_PHOTO  (사진+텍스트)
//   image: URL          + text: ""        → TPL_WITH_PHOTO  (Full-bleed 사진)
//   image: null         + text: "텍스트"  → TPL_TEXT_ONLY   (텍스트 전용)
//
// 표지(frontCover/backCover)는 pages 배열과 완전 분리 — 순수 내지 24장 보장
// 24페이지 구성: 12페이지 텍스트 有 + 12페이지 텍스트 無 (text: "")
// isLandscape: true → 파노라마(1200×600) 이미지 — 갤러리에서 가로형 배지 표시

// ── 이미지 헬퍼 ────────────────────────────────────────────────────────────────

// 로컬 프로젝트 스크린샷 (public/images/portfolio/)
const LOCAL = (filename) => `/images/portfolio/${filename}`;

// CS/개발 테마 picsum (시드 기반 고정 JPEG)
const PLACEHOLDER = (seed) => `https://picsum.photos/seed/${seed}/600/600`;
const PANORAMA = (seed) => `https://picsum.photos/seed/${seed}/1200/600`;

// ── 로컬 프로젝트 스크린샷 매핑 ──────────────────────────────────────────────
const IMG = {
  tommy_profile:   LOCAL('59546864-742c-4287-b42a-fe7ddfbf59ff.png'),
  tommy_readbook:  LOCAL('547c60b3-b08a-4b7b-8dee-604cf0003c5b.png'),
  tommy_activity:  LOCAL('ec7bfc77-ac12-4ba5-a039-fd463c042f07.png'),
  tommy_homework:  LOCAL('d61ddd9d-ff35-4ca0-82bd-98617f4097d2.png'),
  tommy_report:    LOCAL('25d88842-175e-450b-a54b-e8370af9a5ad.png'),
  tommy_detail:    LOCAL('f0802447-dd2b-4596-a7b0-168b6116053b.png'),
  chart_candle:    LOCAL('47fecb06-1292-4b4e-b2ed-4b71408f0539.png'),
  chart_predict:   LOCAL('b2f7d433-1c43-43cb-a68a-a9f2b140937f.png'),
  dlab_report:     LOCAL('d02c24db-29b1-4d02-996c-0f7249ecd36e.png'),
};

// ─────────────────────────────────────────────────────────────────────────────
// ARCHIVE — 풀스택 개발자 포트폴리오 북 더미 데이터
// 1~9p:   실제 프로젝트 스크린샷 + 회고 텍스트 → TPL_WITH_PHOTO
// 10~12p: 텍스트 전용 회고 → TPL_WITH_PHOTO (CS 테마 picsum)
// 13~24p: text: "" Full-bleed 스크린샷 → TPL_WITH_PHOTO
// ─────────────────────────────────────────────────────────────────────────────
export const archiveDummy = {
  meta: {
    bookTitle:       '2025 Developer Archive',
    authorName:      'Myeongjae Weon',
    role:            'Full-Stack Developer',
    techStack:       'React, Next.js, Node.js, Python, PostgreSQL',
    period:          '2025.01 — 2025.12',
    bookDescription: '풀스택 개발자 1년의 여정. 학원 관리 시스템, 주가 분석 도구, 알고리즘 교육 플랫폼을 만들며 쌓은 기술과 성장의 기록.',
  },

  frontCover: { image: PLACEHOLDER('archive-cover-dev'), title: '2025 Developer Archive' },
  backCover:  { image: PLACEHOLDER('archive-cover-back-dev') },

  pages: [
    // ── 1~9p: 실제 프로젝트 스크린샷 + 회고 텍스트 ──

    { date: '2025-01', title: 'Tommy: 학원 관리 플랫폼', text: '올해의 첫 프로젝트. 9명의 선생님이 동시에 사용하는 학원 관리 시스템을 설계했다. 프로필 선택 화면부터 사용자 경험을 고민했고, 색상 코딩된 아바타 시스템으로 한눈에 선생님을 구분할 수 있게 만들었다. Next.js App Router를 처음 프로덕션에 적용한 프로젝트.', image: IMG.tommy_profile },

    { date: '2025-02', title: '리드북 현황 대시보드', text: '126명 학생의 학습 현황을 한 화면에 보여주는 대시보드를 구현했다. 카드 그리드 뷰로 학생별 진도, 과제 완료율, 출석을 실시간 모니터링할 수 있다. 데이터 시각화에서 가장 중요한 건 "한눈에 이상치를 발견할 수 있는가"라는 걸 배웠다.', image: IMG.tommy_readbook },

    { date: '2025-03', title: '수업 활동 트래킹', text: '수업 중 활동 기록 시스템을 구축했다. 교재 진도, 숙제 제출, 시험 점수를 통합 관리하고, 선생님이 수업 중에도 실시간으로 기록할 수 있는 인터페이스를 설계했다. 모바일 반응형이 핵심이었다 — 태블릿으로 수업하면서 기록하니까.', image: IMG.tommy_activity },

    { date: '2025-04', title: '과제 관리 시스템', text: '숙제 배정에서 채점까지의 전체 라이프사이클을 관리하는 시스템을 만들었다. 과제 유형별 자동 분류, 마감일 알림, 미제출 학생 하이라이트 기능을 구현했다. 선생님들이 가장 많이 쓰는 기능이 됐다.', image: IMG.tommy_homework },

    { date: '2025-05', title: '학습 리포트 자동 생성', text: '주차별 학습 진행도를 자동 분석하는 리포트 시스템을 구현했다. 기초 입출력부터 그리디 알고리즘까지, 단원별 달성률을 컬러 프로그레스바로 시각화한다. 학부모 상담 자료로 활용되면서 학원 운영 효율이 크게 올랐다.', image: IMG.tommy_report },

    { date: '2025-06', title: '수업 상세 데이터 관리', text: '개별 수업의 상세 기록 관리 화면을 구현했다. 수강생별 교재 진도, 과제 이력, 시험 점수를 한 눈에 볼 수 있는 통합 뷰를 만들었다. PostgreSQL의 윈도우 함수를 활용한 성적 추이 쿼리가 핵심이었다.', image: IMG.tommy_detail },

    { date: '2025-07', title: '주가 차트 분석 도구', text: '삼성전자 3개월 캔들차트를 TradingView 스타일로 구현했다. 지지선/저항선 자동 탐지 알고리즘을 직접 작성했다. Python pandas로 이동평균선 교차 패턴을 감지하고, Next.js API Route로 차트 데이터를 서빙하는 풀스택 구조를 설계했다.', image: IMG.chart_candle },

    { date: '2025-08', title: 'AI 주가 예측 알고리즘', text: 'RSI, 정배열, 차트 점수 기반의 종목 추천 시스템을 구축했다. 삼성전자 종합점수 65/100, 단기 중립/관망 → 중기 방향성 확인 필요. 추천 종목 Top 10 랭킹 시스템으로 확장했다. 투자는 기술만으로 되는 게 아니라는 걸 다시 한번 배웠다.', image: IMG.chart_predict },

    { date: '2025-09', title: 'D-Lab 알고리즘 학습 리포트', text: '알고리즘 교육 플랫폼 D-Lab의 학습 리포트 시스템을 개발했다. 출석률 100%, 전체 달성율 52%, 종합 점수 4.0/5.0. 데이터 구조부터 그리디까지 단원별 진행도를 시각화한다. PDF 인쇄/저장 기능으로 오프라인 공유도 지원한다.', image: IMG.dlab_report },

    // ── 10~12p: CS 테마 이미지 + 회고 텍스트 ──

    { date: '2025-10', title: 'API 아키텍처 설계', text: 'SweetBook API 기반 포토북 제작 플랫폼 BookMaker를 설계했다. Next.js API Route로 프록시 패턴을 구현하고, fetchWithRetry로 5xx 자동 재시도와 지수 백오프를 적용했다. Idempotency-Key로 중복 주문을 원천 차단하는 안전한 트랜잭션 파이프라인을 완성했다.', image: PLACEHOLDER('dev-api-arch') },

    { date: '2025-11', title: 'Template Engine Deep Dive', text: '하드코딩 3개 템플릿에서 API 동적 조회 + 카테고리 그룹핑 시스템으로 전면 개편했다. breakBefore 속성이 페이지 카운트에 미치는 영향을 발견하고, 장식용 파일 바인딩(lineVertical, pencilIcon)과 사용자 사진을 정밀 분리하는 아키텍처를 설계했다. 결과: 7개 전 카테고리 API 100% 호환.', image: PLACEHOLDER('dev-template-engine') },

    { date: '2025-12', title: 'Year in Review', text: '1년간 3개 프로젝트, 500개 커밋. 가장 큰 성장은 "왜 이 기술을 선택했는가"를 설명할 수 있게 된 것이다. 아키텍처 의사결정의 트레이드오프를 문서화하는 습관, 실패를 디버깅 로그로 남기는 문화가 내 개발 철학이 됐다. DECISION_LOG.md가 그 증거다.', image: PLACEHOLDER('dev-year-review') },

    // ── 13~24p: text: "" Full-bleed 스크린샷/다이어그램 ──

    { date: '2025-01', title: 'System Architecture Diagram',  text: '', image: PLACEHOLDER('dev-sys-diagram') },
    { date: '2025-02', title: 'Database Schema Design',       text: '', image: PLACEHOLDER('dev-db-schema') },
    { date: '2025-03', title: 'API Flow Sequence',             text: '', image: PLACEHOLDER('dev-api-flow') },
    { date: '2025-04', title: 'Editor UI Screenshot',          text: '', image: PANORAMA('dev-editor-ui'), isLandscape: true },
    { date: '2025-05', title: 'Component Tree',                text: '', image: PLACEHOLDER('dev-comp-tree') },
    { date: '2025-06', title: 'Error Dashboard',               text: '', image: PLACEHOLDER('dev-error-dash') },
    { date: '2025-07', title: 'Performance Profiler',          text: '', image: PLACEHOLDER('dev-perf-profile') },
    { date: '2025-08', title: 'CI/CD Pipeline',                text: '', image: PLACEHOLDER('dev-cicd-pipeline') },
    { date: '2025-09', title: 'Code Review Workflow',          text: '', image: PLACEHOLDER('dev-code-review') },
    { date: '2025-10', title: 'Monitoring Dashboard',          text: '', image: PANORAMA('dev-monitoring'), isLandscape: true },
    { date: '2025-11', title: 'Git Contribution Graph',        text: '', image: PLACEHOLDER('dev-git-graph') },
    { date: '2025-12', title: 'Deployment Architecture',       text: '', image: PLACEHOLDER('dev-deploy-arch') },
  ],
};

// ─── 서비스 타입 → 더미 데이터 매핑 ──────────────────────────────────────────
export const DUMMY_DATA = {
  archive: archiveDummy,
};
