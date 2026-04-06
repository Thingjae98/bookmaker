// 서비스 타입별 설정 정보
// ARCHIVE — 크리에이터/개발자를 위한 프리미엄 프로젝트 포트폴리오 북
export const SERVICE_TYPES = {
  archive: {
    key: 'archive',
    name: 'ARCHIVE',
    subtitle: '당신의 프로젝트를 한 권의 아카이브로',
    description: '1년간의 프로젝트, 성과, 회고를 프리미엄 하드커버 북으로 아카이빙하세요. 개발자·디자이너·PM을 위한 포트폴리오 북.',
    icon: null,
    color: 'from-neutral-900 to-neutral-800',
    accentColor: '#171717',
    recommendedSpec: 'SQUAREBOOK_HC',
    templateCategory: 'etc',
    fields: [
      { key: 'bookTitle', label: 'Book Title', type: 'text', placeholder: 'e.g. 2025 Annual Archive', required: true },
      { key: 'authorName', label: 'Author / Creator', type: 'text', placeholder: 'e.g. Jimin Park', required: true },
      { key: 'role', label: 'Role', type: 'select', options: ['Frontend Developer', 'Backend Developer', 'Full-Stack Developer', 'Designer', 'PM / PO', 'Data Engineer', 'DevOps / SRE', 'Other'], required: true },
      { key: 'techStack', label: 'Tech Stack', type: 'text', placeholder: 'e.g. React, Next.js, TypeScript, AWS', required: false },
      { key: 'period', label: 'Archive Period', type: 'text', placeholder: 'e.g. 2025.01 — 2025.12', required: true },
      { key: 'bookDescription', label: 'Description', type: 'textarea', placeholder: 'Briefly describe what this archive covers — projects, learnings, milestones.', required: false },
    ],
  },
};

// 판형 정보 — 실제 SweetBook API UID 기준 (GET /book-specs 실제 응답값)
// bs_6a8OUY / bs_3EzPkz / bs_518IVG 는 빈 플레이스홀더로 API가 책 생성을 거부함 (400)
export const BOOK_SPECS = {
  SQUAREBOOK_HC: {
    uid: 'SQUAREBOOK_HC',
    name: '정방형 하드커버',
    size: '243×248mm',
    cover: '하드커버',
    binding: 'PUR 무선철',
    pages: '24~130p',
    pageMin: 24,
    pageIncrement: 2,
    description: '가장 범용적인 판형. 앨범, 일기장, 졸업앨범 등 다양한 용도에 적합합니다.',
  },
  PHOTOBOOK_A4_SC: {
    uid: 'PHOTOBOOK_A4_SC',
    name: 'A4 소프트커버 포토북',
    size: '210×297mm',
    cover: '소프트커버',
    binding: 'PUR 무선철',
    pages: '24~130p',
    pageMin: 24,
    pageIncrement: 2,
    description: 'A4 사이즈 소프트커버. 사진과 텍스트를 넉넉하게 담을 수 있는 포토북입니다.',
  },
  PHOTOBOOK_A5_SC: {
    uid: 'PHOTOBOOK_A5_SC',
    name: 'A5 소프트커버 포토북',
    size: '148×210mm',
    cover: '소프트커버',
    binding: 'PUR 무선철',
    pages: '50~200p',
    pageMin: 50,
    pageIncrement: 2,
    description: 'A5 사이즈 소프트커버. 가볍고 휴대하기 편한 아담한 포토북입니다.',
  },
};

// 판형 UID → 사용자 친화적 한글 이름 매핑
export const BOOK_SPEC_LABELS = {
  SQUAREBOOK_HC: '정방형 하드커버 (243×248mm)',
  PHOTOBOOK_A4_SC: 'A4 소프트커버 포토북 (210×297mm)',
  PHOTOBOOK_A5_SC: 'A5 소프트커버 포토북 (148×210mm)',
};

// 주문 상태 매핑 — SweetBook API 전체 상태 코드
export const ORDER_STATUS = {
  20: { key: 'PAID', label: '결제완료', color: 'blue' },
  25: { key: 'PDF_READY', label: 'PDF 준비완료', color: 'cyan' },
  30: { key: 'CONFIRMED', label: '제작확정', color: 'indigo' },
  40: { key: 'IN_PRODUCTION', label: '제작 진행 중', color: 'yellow' },
  45: { key: 'COMPLETED', label: '항목 제작 완료', color: 'lime' },
  50: { key: 'PRODUCTION_COMPLETE', label: '전체 제작 완료', color: 'green' },
  60: { key: 'SHIPPED', label: '발송완료', color: 'teal' },
  70: { key: 'DELIVERED', label: '배송완료', color: 'emerald' },
  80: { key: 'CANCELLED', label: '취소', color: 'red' },
  81: { key: 'CANCELLED_REFUND', label: '환불 완료', color: 'red' },
  90: { key: 'ERROR', label: '오류', color: 'rose' },
};
