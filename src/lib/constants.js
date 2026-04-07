// 서비스 타입별 설정 정보
// KidCanvas — 우리 아이 그림 작품집: 미술관 도록 스타일 포토북
export const SERVICE_TYPES = {
  kidcanvas: {
    key: 'kidcanvas',
    name: 'KidCanvas',
    subtitle: '우리 아이 그림을 한 권의 작품집으로',
    description: '아이가 그린 그림을 사진으로 찍어 업로드하면, AI가 작품 해설을 생성하고 미술관 도록 스타일의 프리미엄 포토북으로 제작합니다.',
    icon: null,
    color: 'from-peach-400 to-peach-500',
    accentColor: '#FF8C5E',
    recommendedSpec: 'SQUAREBOOK_HC',
    templateCategory: 'etc',
    fields: [
      { key: 'bookTitle', label: '작품집 제목', type: 'text', placeholder: '예) 하은이의 작은 미술관', required: true },
      { key: 'childName', label: '아이 이름', type: 'text', placeholder: '예) 김하은', required: true },
      { key: 'childAge', label: '나이', type: 'select', options: ['3세', '4세', '5세', '6세', '7세', '8세', '9세', '10세'], required: true },
      { key: 'period', label: '작품 기간', type: 'text', placeholder: '예) 2025.03 — 2026.02', required: true },
      { key: 'bookDescription', label: '작품집 소개', type: 'textarea', placeholder: '아이의 그림 이야기, 특별한 추억, 엄마아빠의 한마디를 적어주세요.', required: false },
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
    description: '가장 범용적인 판형. 아이 그림을 크고 선명하게 담을 수 있는 정방형 하드커버입니다.',
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
    description: 'A4 사이즈 소프트커버. 세로로 긴 그림을 넉넉하게 담을 수 있는 포토북입니다.',
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
    description: 'A5 사이즈 소프트커버. 가볍고 휴대하기 편한 아담한 작품집입니다.',
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
