'use client';

// 에디터 페이지 — 선 구성(Pre-composition) 방식 포토북 에디터
// 갤러리에서 사진을 업로드하고 역할(앞표지/뒤표지/내지)을 모두 지정한 뒤
// [최종 생성 및 주문] 버튼 한 번으로 Book → Photos → Cover → Contents → Finalize API를 순차 호출한다.

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';
import { toast } from '@/lib/toast';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

// ─── 템플릿 상수 (SQUAREBOOK_HC 기준 실제 검증된 UID) ─────────
// coverPhoto+title+dateRange / photo1+date+title+diaryText / date+title+diaryText
const COVER_TEMPLATE = '79yjMH3qRPly'; // 표지: { coverPhoto, title, dateRange }
const TPL_WITH_PHOTO = '3FhSEhJ94c0T'; // 내지(사진): { photo1, date, title, diaryText }
const TPL_TEXT_ONLY  = 'vHA59XPPKqak'; // 내지(텍스트): { date, title, diaryText }
// 하위 호환: 이전 상수명 유지
const TPL_TEXT_IMAGE = TPL_WITH_PHOTO;
const TPL_IMAGE_ONLY = TPL_WITH_PHOTO;

// ─── 페이지 소모량 계산 ────────────────────────────────────────────
// 기본 1페이지, 양면(Spread) 분할 옵션(useSpread + isLandscape) 적용 시 2페이지 소모
const getPageConsumption = (item) =>
  (item.useSpread && item.isLandscape) ? 2 : 1;

// ─── 유효성 임계값 ─────────────────────────────────────────────
const MIN_CONTENT = 8;   // 구성 미리보기 배지 색상 하한값 (버튼 활성화는 specPageMinUI 기준)

export default function EditorPage() {
  const router = useRouter();
  const [session, setSession]       = useState(null);

  // ── 갤러리 state ─────────────────────────────────────────────
  // item shape: { id, file, previewUrl, role, title, text, date, templateUid, isLandscape, useSpread }
  const [gallery, setGallery]               = useState([]);
  const [selectedIdx, setSelectedIdx]       = useState(null);   // 인라인 편집 패널 대상 인덱스
  const [galleryDragIdx, setGalleryDragIdx] = useState(null);
  const [galleryDropActive, setGalleryDropActive] = useState(false);

  // ── API 상태 ─────────────────────────────────────────────────
  const [loading, setLoading]           = useState(false);
  const [bookCreated, setBookCreated]   = useState(false);
  const [bookUid, setBookUid]           = useState(null);
  const [apiLog, setApiLog]             = useState([]);
  const [showLog, setShowLog]           = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── 세션 복원 + 더미/AI 데이터 → 갤러리로 변환 ──────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    setSession(data);

    // AI 동화 페이지 or 더미 데이터 로드
    const aiRaw = sessionStorage.getItem('bookmaker_ai_pages');
    let initialPages = [];
    if (aiRaw) {
      initialPages = JSON.parse(aiRaw);
      sessionStorage.removeItem('bookmaker_ai_pages');
    } else if (data.useDummy) {
      const dummy = DUMMY_DATA[data.serviceType];
      if (dummy) initialPages = dummy.pages;
    }

    if (initialPages.length > 0) {
      // pages 배열 → 갤러리 아이템으로 통합 변환
      // 첫 번째 → 앞표지, 마지막 → 뒤표지, 나머지 → 내지
      const items = initialPages.map((p, i) => ({
        id:          `init-${i}-${Date.now()}`,
        file:        null,
        previewUrl:  p.image?.startsWith('http')
                       ? p.image
                       : `https://picsum.photos/seed/${data.serviceType}-${i}/600/600`,
        role:        i === 0 ? 'front'
                   : i === initialPages.length - 1 ? 'back'
                   : 'content',
        title:       p.title       || '',
        text:        p.text        || p.teacherComment || '',
        date:        p.date        || new Date().toISOString().slice(0, 10),
        templateUid: null,   // null = 텍스트 유무 자동 분기
        isLandscape: false,
        useSpread:   false,
      }));
      setGallery(items);
    }
  }, [router]);

  const addLog = (msg) =>
    setApiLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

  // ── Canvas API: 이미지 좌/우 정밀 반분할 ──────────────────────
  const splitImageHalves = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const halfW  = Math.floor(img.naturalWidth / 2);
        const rightW = img.naturalWidth - halfW;
        const h      = img.naturalHeight;

        const lc = document.createElement('canvas');
        lc.width = halfW; lc.height = h;
        lc.getContext('2d').drawImage(img, 0, 0, halfW, h, 0, 0, halfW, h);

        const rc = document.createElement('canvas');
        rc.width = rightW; rc.height = h;
        rc.getContext('2d').drawImage(img, halfW, 0, rightW, h, 0, 0, rightW, h);

        Promise.all([
          new Promise((r) => lc.toBlob(r, 'image/jpeg', 1.0)),
          new Promise((r) => rc.toBlob(r, 'image/jpeg', 1.0)),
        ]).then(([lb, rb]) => resolve([lb, rb])).catch(reject);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });

  // ── 가로형 이미지 감지 (width > height × 1.6) ────────────────
  const detectLandscape = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth > img.naturalHeight * 1.6); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    });

  // ── 갤러리 파일 업로드 ────────────────────────────────────────
  const handleGalleryUpload = async (files) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    const newItems = await Promise.all(
      arr.map(async (file) => ({
        id:          `g-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl:  URL.createObjectURL(file),
        role:        null,
        title:       '',
        text:        '',
        date:        new Date().toISOString().slice(0, 10),
        templateUid: null,
        isLandscape: await detectLandscape(file),
        useSpread:   false,
      }))
    );
    setGallery((prev) => [...prev, ...newItems]);
    toast.success(`${arr.length}장이 갤러리에 추가됐습니다`);
  };

  const updateGalleryItem = (idx, updates) =>
    setGallery((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));

  const removeGalleryItem = (idx) => {
    setGallery((prev) => {
      const item = prev[idx];
      if (item?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
    if (selectedIdx === idx) setSelectedIdx(null);
  };

  // 역할 지정 — 앞/뒤표지 중복 시 기존 항목 자동 해제
  const assignGalleryRole = (idx, role) =>
    setGallery((prev) =>
      prev.map((item, i) => {
        if (i === idx) return { ...item, role };
        if (role === 'front' && item.role === 'front') return { ...item, role: null };
        if (role === 'back'  && item.role === 'back')  return { ...item, role: null };
        return item;
      })
    );

  // ── 갤러리 드래그 리오더 ──────────────────────────────────────
  const handleGalleryDragStart = (e, idx) => {
    setGalleryDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleGalleryDragOver = (e, idx) => {
    e.preventDefault();
    if (galleryDragIdx === null || galleryDragIdx === idx) return;
    setGallery((prev) => {
      const next = [...prev];
      const [moved] = next.splice(galleryDragIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setGalleryDragIdx(idx);
  };
  const handleGalleryDragEnd  = () => setGalleryDragIdx(null);
  const handleGalleryZoneDrop = (e) => {
    e.preventDefault();
    setGalleryDropActive(false);
    handleGalleryUpload(e.dataTransfer.files);
  };

  // ── 검증 (파생 상태) ─────────────────────────────────────────
  const frontItems        = useMemo(() => gallery.filter((g) => g.role === 'front'),   [gallery]);
  const backItems         = useMemo(() => gallery.filter((g) => g.role === 'back'),    [gallery]);
  const contentItems      = useMemo(() => gallery.filter((g) => g.role === 'content'), [gallery]);
  // 양면 분할 아이템은 2페이지 소모 — getPageConsumption()으로 합산
  const totalContentPages = useMemo(
    () => contentItems.reduce((sum, item) => sum + getPageConsumption(item), 0),
    [contentItems]
  );
  // 판형 규격 실시간 검증 (session null이면 SQUAREBOOK_HC 기본값 24p, 2p 단위)
  const specPageMinUI = BOOK_SPECS[session?.bookSpecUid]?.pageMin       || 24;
  const specPageIncUI = BOOK_SPECS[session?.bookSpecUid]?.pageIncrement || 2;
  const isPageMinMet  = totalContentPages >= specPageMinUI;
  // 0페이지는 isPageMinMet가 false이므로 별도 처리 불필요; 정확히 specPageIncUI 배수인지 확인
  const isIncrementOk = totalContentPages > 0 && totalContentPages % specPageIncUI === 0;
  const isReady       = frontItems.length === 1 && backItems.length === 1 && isPageMinMet && isIncrementOk;

  // ── 모달 템플릿 선택 헬퍼 ──────────────────────────────────────

  // 1) 판형 일치 + 역할 일치 필터 + 이름 기준 중복 제거
  const getTemplatesForRole = (role) => {
    const all     = session?.allTemplates || [];
    const specUid = session?.bookSpecUid;
    const filtered = all.filter((t) => {
      if (specUid && t.bookSpecUid && t.bookSpecUid !== specUid) return false;
      const kind = (t.templateKind || t.category || '').toLowerCase();
      return (role === 'front' || role === 'back')
        ? kind.includes('cover')
        : kind.includes('content') || kind.includes('page');
    });
    // 이름 기준 중복 제거
    const seen = new Set();
    return filtered.filter((t) => {
      const key = (t.name || t.templateName || t.templateUid || '').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // 2) 템플릿 이름/kind → 와이어프레임 타입 추론
  const inferWireframeType = (t) => {
    const name = (t.name || t.templateName || '').toLowerCase();
    const kind = (t.templateKind || t.category || '').toLowerCase();
    if (kind.includes('cover')) return 'cover';
    if (name.includes('빈') || name.includes('blank')) return 'blank';
    if (name.includes('월') || name.includes('month') || name.includes('calendar')) return 'calendar';
    if ((name.includes('텍스트') || name.includes('text')) &&
        !(name.includes('사진') || name.includes('photo') || name.includes('이미지')))
      return 'text_only';
    if (name.includes('사진') || name.includes('photo') || name.includes('이미지'))
      return name.includes('텍스트') || name.includes('text') ? 'photo_text' : 'photo_only';
    // 기본값: 사진+텍스트
    return 'photo_text';
  };

  // 3) 와이어프레임 렌더링 — Tailwind CSS 미니 레이아웃 (이미지 없을 때 사용)
  const renderWireframe = (type) => {
    if (type === 'cover') return (
      <div className="w-full h-[72px] bg-ink-100 rounded-lg mb-1.5 flex flex-col overflow-hidden">
        <div className="flex-1 bg-ink-200" />
        <div className="px-2 py-1.5 space-y-1 bg-white">
          <div className="h-1.5 bg-ink-300 rounded w-3/4" />
          <div className="h-1   bg-ink-200 rounded w-1/2" />
        </div>
      </div>
    );
    if (type === 'photo_text') return (
      <div className="w-full h-[72px] bg-ink-100 rounded-lg mb-1.5 overflow-hidden flex flex-col">
        <div className="h-9 bg-ink-200" />
        <div className="flex-1 px-2 py-1 space-y-1 bg-white">
          <div className="h-1.5 bg-ink-300 rounded w-5/6" />
          <div className="h-1   bg-ink-200 rounded w-3/5" />
          <div className="h-1   bg-ink-200 rounded w-2/3" />
        </div>
      </div>
    );
    if (type === 'text_only') return (
      <div className="w-full h-[72px] bg-white border border-ink-100 rounded-lg mb-1.5 flex flex-col p-2 space-y-1.5">
        <div className="h-1   bg-ink-200 rounded w-1/3" />
        <div className="h-2   bg-ink-300 rounded w-5/6" />
        <div className="h-1   bg-ink-200 rounded w-4/5" />
        <div className="h-1   bg-ink-200 rounded w-3/4" />
        <div className="h-1   bg-ink-200 rounded w-2/3" />
      </div>
    );
    if (type === 'blank') return (
      <div className="w-full h-[72px] bg-white rounded-lg mb-1.5 border-2 border-dashed border-ink-200 flex items-center justify-center">
        <span className="text-ink-300 text-[10px]">빈 페이지</span>
      </div>
    );
    if (type === 'calendar') return (
      <div className="w-full h-[72px] bg-ink-100 rounded-lg mb-1.5 overflow-hidden">
        <div className="h-4 bg-warm-300 flex items-center px-2">
          <div className="h-1.5 w-10 bg-warm-500 rounded" />
        </div>
        <div className="p-1 grid grid-cols-7 gap-0.5">
          {Array.from({ length: 21 }).map((_, i) => (
            <div key={i} className="h-2 bg-ink-200 rounded-sm" />
          ))}
        </div>
      </div>
    );
    // photo_only
    return (
      <div className="w-full h-[72px] bg-ink-200 rounded-lg mb-1.5 flex items-center justify-center">
        <svg className="text-ink-300" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-1.1 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      </div>
    );
  };

  // 4) 공통 템플릿 선택 카드 그리드 렌더 함수
  const renderTemplateSelector = (role) => {
    const isCover  = role === 'front' || role === 'back'; // 표지 템플릿 여부
    const allTpls  = getTemplatesForRole(role);

    // 내지 역할: 텍스트 입력 유무에 따라 레이아웃 실시간 필터링
    // · 텍스트 있음 → 텍스트 구역을 가진 레이아웃(photo_text, text_only, calendar)만 노출
    // · 텍스트 없음 → 사진 전용 레이아웃(photo_only, blank, photo_text 기본)만 노출
    const TEXT_WIRE_TYPES = new Set(['photo_text', 'text_only', 'calendar']);
    const hasText = !isCover && (modalItem?.text || '').trim().length > 0;
    const visibleTpls = isCover
      ? allTpls
      : allTpls.filter((t) => {
          const wt = (t.thumbnails?.layout || t.thumbnails?.baseLayerOdd || t.thumbnails?.baseLayerEven || t.thumbnailUrl || t.previewUrl || t.imageUrl || t.thumbUrl)
            ? 'photo_text'   // 이미지 있으면 항상 표시
            : inferWireframeType(t);
          return hasText ? TEXT_WIRE_TYPES.has(wt) : !TEXT_WIRE_TYPES.has(wt);
        });

    const autoLabel    = isCover ? '기본 표지형' : '자동 선택';
    const autoDesc     = isCover
      ? '검증된 기본 표지 템플릿 적용'
      : '텍스트 입력 여부에 따라 최적 템플릿 자동 분기';
    const sectionTitle = isCover ? '표지 템플릿' : '내지 템플릿';

    // 필터 안내 문구 (내지 전용)
    const filterHint = !isCover && allTpls.length > 0
      ? hasText
        ? '✍ 텍스트 포함 레이아웃만 표시 중'
        : '🖼 이미지 전용 레이아웃만 표시 중'
      : null;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-ink-700">
            {sectionTitle}
            {allTpls.length === 0 && (
              <span className="ml-1.5 font-normal text-ink-400">(기본값 자동 적용)</span>
            )}
          </p>
          {filterHint && (
            <span className="text-[10px] text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">
              {filterHint}
            </span>
          )}
        </div>

        {/* 표지 전용 — Spread 2장 필수 안내 */}
        {isCover && (
          <div className="flex items-start gap-1.5 mb-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2">
            <span className="text-blue-500 text-sm shrink-0 mt-0.5">ℹ</span>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              이 템플릿은 <strong>앞/뒤표지 2장의 사진이 모두 필요</strong>합니다. 갤러리에서 앞표지와 뒤표지를 각각 지정해 주세요.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {/* ★ 자동 선택 — 전체 너비, 강조 디자인 */}
          <button
            type="button"
            onClick={() => updateGalleryItem(selectedIdx, { templateUid: null })}
            className={`col-span-2 p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 ${
              !modalItem.templateUid
                ? 'border-warm-600 bg-warm-50'
                : 'border-ink-200 hover:border-warm-400 bg-white'
            }`}
          >
            <span className="text-xl shrink-0">⭐</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold leading-tight ${!modalItem.templateUid ? 'text-warm-800' : 'text-ink-800'}`}>
                {autoLabel}
                <span className="ml-1.5 text-[10px] font-normal bg-warm-100 text-warm-700 px-1.5 py-0.5 rounded-full">추천</span>
              </p>
              <p className="text-[11px] text-ink-400 mt-0.5 truncate">{autoDesc}</p>
            </div>
            {!modalItem.templateUid && (
              <span className="shrink-0 text-warm-600 font-bold text-sm">✓</span>
            )}
          </button>

          {/* API 템플릿 카드 — 필터링된 목록 */}
          {visibleTpls.map((t) => {
            const previewImg  = t.thumbnails?.layout || t.thumbnails?.baseLayerOdd || t.thumbnails?.baseLayerEven || t.thumbnailUrl || t.previewUrl || t.imageUrl || t.thumbUrl;
            const wfType      = inferWireframeType(t); // onError 폴백용으로 항상 계산
            const displayName = t.name || t.templateName || t.templateUid;
            const isSelected  = modalItem.templateUid === t.templateUid;
            return (
              <button
                key={t.templateUid}
                type="button"
                onClick={() => updateGalleryItem(selectedIdx, { templateUid: t.templateUid })}
                className={`p-2 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-warm-600 bg-warm-50'
                    : 'border-ink-100 hover:border-ink-300 bg-white'
                }`}
              >
                {previewImg ? (
                  <>
                    {/* 표지 썸네일: 앞표지→우측 절반, 뒤표지→좌측 절반 CSS 크롭 */}
                    <div className="w-full h-[72px] overflow-hidden rounded-lg mb-1.5 relative">
                      <img
                        src={previewImg}
                        alt={displayName}
                        className={`absolute h-full top-0 ${
                          isCover
                            ? role === 'front'
                              ? 'right-0 w-[200%]'   // 오른쪽 절반 = 앞표지
                              : 'left-0 w-[200%]'    // 왼쪽 절반 = 뒤표지
                            : 'left-0 w-full object-cover'  // 내지: 전체 표시
                        }`}
                        onError={(e) => {
                          e.currentTarget.parentElement.style.display = 'none';
                          const fb = e.currentTarget.parentElement.nextElementSibling;
                          if (fb) fb.style.display = 'block';
                        }}
                      />
                    </div>
                    <div style={{ display: 'none' }}>{renderWireframe(wfType)}</div>
                  </>
                ) : (
                  renderWireframe(wfType)
                )}
                <p className={`text-[11px] font-medium leading-tight truncate ${isSelected ? 'text-warm-800' : 'text-ink-700'}`}>
                  {displayName}
                </p>
                {isSelected && (
                  <p className="text-[10px] text-warm-600 mt-0.5">✓ 선택됨</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 책 생성 API — 선 구성 후 순차 처리 (트랜잭션 방식) ───────
  const handleCreateBook = async () => {
    if (!isReady) {
      if (frontItems.length !== 1 || backItems.length !== 1) {
        toast.warn('앞표지와 뒤표지 사진을 모두 지정해 주세요.');
      } else if (!isPageMinMet) {
        toast.warn(`내지 최소 ${specPageMinUI}페이지가 필요합니다 (현재 ${totalContentPages}p).`);
      } else {
        toast.warn(`내지 ${specPageIncUI}페이지 단위로 추가해 주세요 (현재 ${totalContentPages}p).`);
      }
      return;
    }

    setLoading(true);
    try {
      const service = SERVICE_TYPES[session.serviceType];
      const fd      = session.formData || {};
      const name    = fd.babyName || fd.childName || fd.heroName || fd.petName || fd.authorName || '';
      const title   = name
        ? `${name}의 ${service.name}`
        : fd.bookTitle || fd.tripName || service.name;

      // bookSpecUid 검증 — API에서 실제로 책 생성 가능한 UID인지 확인 후 보정
      // bs_ 접두사 UID(bs_6a8OUY 등)는 빈 플레이스홀더로 API가 400 반환 — 반드시 내부 키(SQUAREBOOK_HC 등) 사용
      const VALID_SPEC_UIDS = ['SQUAREBOOK_HC', 'PHOTOBOOK_A4_SC', 'PHOTOBOOK_A5_SC'];
      const rawSpecUid  = session?.bookSpecUid;
      const bookSpecUid = VALID_SPEC_UIDS.includes(rawSpecUid) ? rawSpecUid : 'SQUAREBOOK_HC';
      if (bookSpecUid !== rawSpecUid)
        addLog(`⚠️ bookSpecUid 보정: "${rawSpecUid || '(없음)'}" → "${bookSpecUid}"`);
      addLog(`📐 판형: ${BOOK_SPEC_LABELS[bookSpecUid] || bookSpecUid}`);

      // ── 검증된 하드코딩 템플릿 UID 사용 ─────────────────────────
      // 각 템플릿의 파라미터 이름이 다르므로 직접 find()로 선택하면 잘못된 파라미터 전달 위험
      // 실제 API로 검증된 UID를 고정 사용. SQUAREBOOK_HC 전용.
      const dynamicCoverTpl  = COVER_TEMPLATE; // 79yjMH3qRPly: { coverPhoto, title, dateRange }
      const dynamicImageOnly = TPL_WITH_PHOTO; // 3FhSEhJ94c0T: { photo1, date, title, diaryText }
      const dynamicTextImage = TPL_TEXT_ONLY;  // vHA59XPPKqak: { date, title, diaryText }
      addLog(`📐 템플릿 — 표지: ${dynamicCoverTpl} / 내지(사진): ${dynamicImageOnly} / 내지(텍스트): ${dynamicTextImage}`);

      // ── STEP 1: 책 생성 ────────────────────────────────────────
      addLog(`📗 책 생성 중... (${title})`);
      const bookRes  = await fetchWithRetry('/api/books', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, bookSpecUid, creationType: 'TEST', externalRef: `bookmaker-${Date.now()}` }),
      });
      const bookData = await bookRes.json();
      if (!bookData.success) throw new Error(bookData.message || '책 생성 실패');
      const uid = bookData.data.bookUid;
      setBookUid(uid);
      addLog(`✅ 책 생성 완료: ${uid}`);

      // ── STEP 2: 사진 업로드 ────────────────────────────────────
      setUploadingPhoto(true);
      const totalPhotos = gallery.filter((g) => g.role && g.file).length;
      addLog(`📸 사진 업로드 시작 (${totalPhotos}장)...`);

      // File → Photos API 업로드 헬퍼 (URL 반환)
      const uploadFile = async (file, label) => {
        const form = new FormData();
        form.append('file', file);
        const r   = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: form });
        const d   = await r.json();
        const url = d.data?.url || d.data?.photoUrl || d.data?.fileUrl;
        if (d.success && url) { addLog(`✅ ${label}`); return url; }
        addLog(`⚠️ ${label} 실패: ${d.message}`);
        return null;
      };

      // 앞표지 URL 확보
      const frontItem = frontItems[0];
      let coverFrontUrl = `https://picsum.photos/seed/${session.serviceType}-front/600/600`;
      if (frontItem.file) {
        const url = await uploadFile(frontItem.file, '앞표지 업로드');
        if (url) coverFrontUrl = url;
      } else if (frontItem.previewUrl?.startsWith('http')) {
        coverFrontUrl = frontItem.previewUrl;
      }

      // 뒤표지 URL 확보
      const backItem = backItems[0];
      let coverBackUrl = `https://picsum.photos/seed/${session.serviceType}-back/600/600`;
      if (backItem.file) {
        const url = await uploadFile(backItem.file, '뒤표지 업로드');
        if (url) coverBackUrl = url;
      } else if (backItem.previewUrl?.startsWith('http')) {
        coverBackUrl = backItem.previewUrl;
      }

      // 내지 사진 업로드 + 양면 분할 처리
      const contentPageData = [];
      addLog(`📄 내지 ${contentItems.length}장 처리 중...`);
      for (const item of contentItems) {
        if (item.useSpread && item.isLandscape && item.file) {
          // Canvas API 양면 분할
          addLog(`↔️ 양면 분할: ${item.file.name}`);
          try {
            const [lb, rb]   = await splitImageHalves(item.file);
            const leftFile   = new File([lb], 'spread-left.jpg',  { type: 'image/jpeg' });
            const rightFile  = new File([rb], 'spread-right.jpg', { type: 'image/jpeg' });
            const leftUrl    = await uploadFile(leftFile,  '양면-좌');
            const rightUrl   = await uploadFile(rightFile, '양면-우');
            contentPageData.push({ imageUrl: leftUrl,  text: item.text,  title: item.title, date: item.date, templateUid: item.templateUid });
            contentPageData.push({ imageUrl: rightUrl, text: '',          title: '',         date: item.date, templateUid: dynamicImageOnly });
            addLog('✅ 양면 분할 → 2페이지');
          } catch (e) {
            addLog(`⚠️ 양면 분할 실패(${e.message}) — 원본 단일 업로드`);
            const url = item.file ? await uploadFile(item.file, item.file.name) : item.previewUrl;
            contentPageData.push({ imageUrl: url, text: item.text, title: item.title, date: item.date, templateUid: item.templateUid });
          }
        } else {
          const url = item.file
            ? await uploadFile(item.file, item.file.name)
            : (item.previewUrl?.startsWith('http') ? item.previewUrl : null);
          contentPageData.push({ imageUrl: url, text: item.text, title: item.title, date: item.date, templateUid: item.templateUid });
        }
      }
      setUploadingPhoto(false);

      // API 최소 페이지 수 충족 — pageMin + pageIncrement 수학적 준수
      // SweetBook pageMin = 순수 내지(Contents) API 호출 횟수 기준
      // 뒤표지도 /contents API로 전송하므로 targetContentCount에 포함됨
      // 총 페이지 = 앞표지 1장(/cover) + targetContentCount 장(/contents)
      const specPageMin       = BOOK_SPECS[bookSpecUid]?.pageMin       || 24;
      const specPageIncrement = BOOK_SPECS[bookSpecUid]?.pageIncrement || 2;
      const rawCount          = Math.max(specPageMin, contentPageData.length);
      const rem               = rawCount % specPageIncrement;
      const targetContentCount = rem === 0 ? rawCount : rawCount + (specPageIncrement - rem);
      const targetTotal       = targetContentCount + 1; // 로그용: 앞표지 1 포함 총 페이지

      const paddedPages = [...contentPageData];
      let ri = 0;
      while (paddedPages.length < targetContentCount) {
        paddedPages.push({ ...contentPageData[ri % contentPageData.length] });
        ri++;
      }
      if (paddedPages.length > contentPageData.length)
        addLog(`📋 판형 최소 ${specPageMin}p(내지) / 증분 ${specPageIncrement}p 충족 위해 ${paddedPages.length - contentPageData.length}페이지 패딩 (내지 ${targetContentCount}p → 총 ${targetTotal}p)`);

      // ── STEP 3: 앞표지 추가 ────────────────────────────────────
      // session.coverTemplateUid는 create 단계에서 API가 동적으로 반환한 값으로
      // 검증되지 않은 UID(예: 4MY2fokVjkeY)가 들어올 수 있음 → 항상 검증된 상수 사용
      const coverTplUid = dynamicCoverTpl;
      // 앞/뒤 통합 표지 — 인쇄 규격상 표지는 Spread 1장으로 관리되므로 단일 cover API 호출에 양쪽 URL 전달
      addLog(`🎨 표지 추가 중... (앞+뒤 통합 Spread, 템플릿: ${coverTplUid})`);
      const dateRange = fd.period || fd.semester
        ? `${fd.year || new Date().getFullYear()}년 ${fd.semester || fd.period}`
        : String(new Date().getFullYear());
      const coverRes  = await fetch(`/api/books/${uid}/cover`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          templateUid: coverTplUid,
          parameters:  { coverPhoto: coverFrontUrl, backPhoto: coverBackUrl, title, dateRange },
        }),
      });
      const coverData = await coverRes.json();
      if (coverData.success) {
        addLog('✅ 표지 추가 완료 (앞+뒤 통합)');
      } else {
        const coverDetail = coverData.details ? ` / 상세: ${JSON.stringify(coverData.details)}` : '';
        addLog(`⚠️ 표지 실패: ${coverData.message}${coverDetail}`);
      }

      // ── STEP 4: 내지 추가 ─────────────────────────────────────
      addLog(`📄 내지 ${paddedPages.length}페이지 추가 중...`);
      for (let i = 0; i < paddedPages.length; i++) {
        const page    = paddedPages[i];
        // 사진 유무로 템플릿 분기:
        // - 사진 있음 → TPL_WITH_PHOTO (photo1 파라미터 사용)
        // - 텍스트만  → TPL_TEXT_ONLY  (photo1 불필요)
        const hasImage = !!(page.imageUrl);
        const tplUid  = page.templateUid || (hasImage ? dynamicImageOnly : dynamicTextImage);
        const params  = {
          date:      page.date  || new Date().toISOString().slice(0, 10),
          title:     page.title || `페이지 ${i + 1}`,
          diaryText: page.text  || '',
        };
        // 실제 API 파라미터명: photo1 (diaryPhoto 아님)
        if (page.imageUrl) params.photo1 = page.imageUrl;

        const r = await fetch(`/api/books/${uid}/contents`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ templateUid: tplUid, parameters: params, breakBefore: 'page' }),
        });
        const d = await r.json();
        if (!d.success) {
          const pageDetail = d.details ? ` / 상세: ${JSON.stringify(d.details)}` : '';
          addLog(`⚠️ 페이지 ${i + 1} 실패: ${d.message}${pageDetail}`);
        } else if (i % 5 === 0 || i === paddedPages.length - 1) {
          addLog(`📄 내지 ${i + 1}/${paddedPages.length}`);
        }
      }
      addLog(`✅ 내지 ${paddedPages.length}페이지 완료`);

      // ── STEP 5: 최종화 ────────────────────────────────────────
      addLog('🔒 최종화 중...');
      const finalRes  = await fetch(`/api/books/${uid}/finalize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });
      const finalData = await finalRes.json();

      if (finalData.success) {
        addLog(`✅ 최종화 완료! (${finalData.data?.pageCount || '?'}페이지)`);
        setBookCreated(true);
        toast.success(`책 생성 완료! ${finalData.data?.pageCount || ''}페이지 포토북이 준비됐습니다.`);
        sessionStorage.setItem('bookmaker_session',
          JSON.stringify({ ...session, bookUid: uid, pageCount: finalData.data?.pageCount }));
      } else {
        addLog(`❌ 최종화 실패: ${finalData.message}`);
        toast.warn(`최종화 실패: ${finalData.message}`);
        sessionStorage.setItem('bookmaker_session', JSON.stringify({ ...session, bookUid: uid }));
      }
    } catch (err) {
      addLog(`❌ 오류: ${err.message}`);
      toast.error(`책 생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
      setUploadingPhoto(false);
    }
  };

  // ── 로딩 중 (세션 미복원) ────────────────────────────────────
  if (!session)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner text-warm-600" />
      </div>
    );

  const service      = SERVICE_TYPES[session.serviceType];
  // 인라인 편집 패널 대상 아이템 + 중복 방지용
  const modalItem    = selectedIdx !== null ? gallery[selectedIdx] : null;
  const hasFrontElse = gallery.some((g, i) => g.role === 'front' && i !== selectedIdx);
  const hasBackElse  = gallery.some((g, i) => g.role === 'back'  && i !== selectedIdx);

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="editor" />


      <div className="max-w-5xl mx-auto px-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8 opacity-0 animate-fade-up" style={{ animationFillMode: 'forwards' }}>
          <div>
            <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2">
              <span>{service.icon}</span>
              포토북 구성
            </h1>
            <p className="text-ink-400 text-sm mt-1">
              사진을 업로드하고 앞표지·내지·뒤표지 역할을 지정한 뒤 [최종 생성 및 주문]을 눌러 주세요
              {session.bookSpecUid && (
                <span className="ml-2 text-ink-500">·
                  판형: {BOOK_SPEC_LABELS[session.bookSpecUid] || session.bookSpecUid}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowLog(!showLog)}
            className="btn-secondary text-sm !px-3 !py-2"
          >
            {showLog ? 'API 로그 닫기' : 'API 로그'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── 좌측: 구성 미리보기 패널 ──────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-ink-100 p-4 sticky top-20 space-y-4">
              <h2 className="font-display font-bold text-ink-900">📖 구성 미리보기</h2>

              {/* ── 표지 스프레드 슬롯 ─────────────────────────────── */}
              {/* SweetBook 표지 템플릿은 [뒤표지(좌) | 앞표지(우)] 한 장 Spread로 인쇄됨 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-ink-500">📔 표지 스프레드</p>
                  {frontItems.length === 1 && backItems.length === 1
                    ? <span className="text-xs text-green-600 font-medium">✓ 2장 지정됨</span>
                    : <span className="text-xs text-red-500">앞+뒤 각 1장 필수</span>}
                </div>

                {/* Spread 프레임: 좌=뒤표지, 우=앞표지 */}
                <div className="flex rounded-xl overflow-hidden border-2 border-ink-200 h-24">
                  {/* 뒤표지 슬롯 (좌측) */}
                  <div
                    className={`w-1/2 relative flex items-center justify-center border-r border-ink-200 cursor-pointer overflow-hidden transition-colors ${
                      backItems[0] ? '' : 'bg-ink-50 hover:bg-ink-100'
                    }`}
                    onClick={() => backItems[0] && setSelectedIdx(gallery.indexOf(backItems[0]))}
                    title="뒤표지 슬롯"
                  >
                    {backItems[0] ? (
                      <>
                        <img src={backItems[0].previewUrl} alt="뒤표지" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center">
                          <span className="text-white text-[10px] font-bold drop-shadow">뒤표지</span>
                          <span className="text-white/70 text-[9px] mt-0.5">클릭 편집</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center px-1">
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-ink-300 flex items-center justify-center mx-auto mb-1">
                          <span className="text-ink-300 text-sm">뒤</span>
                        </div>
                        <p className="text-[9px] text-ink-400 leading-tight">뒤표지<br/>미지정</p>
                      </div>
                    )}
                  </div>

                  {/* 앞표지 슬롯 (우측) */}
                  <div
                    className={`w-1/2 relative flex items-center justify-center cursor-pointer overflow-hidden transition-colors ${
                      frontItems[0] ? '' : 'bg-ink-50 hover:bg-ink-100'
                    }`}
                    onClick={() => frontItems[0] && setSelectedIdx(gallery.indexOf(frontItems[0]))}
                    title="앞표지 슬롯"
                  >
                    {frontItems[0] ? (
                      <>
                        <img src={frontItems[0].previewUrl} alt="앞표지" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center">
                          <span className="text-white text-[10px] font-bold drop-shadow">앞표지</span>
                          <span className="text-white/70 text-[9px] mt-0.5">클릭 편집</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center px-1">
                        <div className="w-8 h-8 rounded-full border-2 border-dashed border-ink-300 flex items-center justify-center mx-auto mb-1">
                          <span className="text-ink-300 text-sm">앞</span>
                        </div>
                        <p className="text-[9px] text-ink-400 leading-tight">앞표지<br/>미지정</p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-ink-400 text-center mt-1">← 뒤표지 | 앞표지 →</p>
              </div>

              {/* 내지 목록 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-ink-500">내지</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isPageMinMet && isIncrementOk
                      ? 'bg-green-100 text-green-700'
                      : isPageMinMet
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {totalContentPages}p / 최소 {specPageMinUI}p ({specPageIncUI}p 단위)
                  </span>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {contentItems.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 bg-ink-50 rounded-lg cursor-pointer hover:bg-warm-50 transition-colors group"
                      onClick={() => setSelectedIdx(gallery.indexOf(item))}
                    >
                      <span className="text-[10px] text-ink-400 w-5 shrink-0">#{i + 1}</span>
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="w-8 h-8 object-cover rounded shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-ink-700 truncate">
                          {item.title || `페이지 ${i + 1}`}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {item.text.trim() ? '📝 텍스트' : '🖼️ 이미지'}
                          {item.useSpread ? ' · ↔ 2p' : ''}
                        </p>
                      </div>
                      <span className="text-ink-300 opacity-0 group-hover:opacity-100 text-xs">✏️</span>
                    </div>
                  ))}
                  {contentItems.length === 0 && (
                    <p className="text-xs text-ink-400 text-center py-6">
                      갤러리에서 내지를 지정하세요
                    </p>
                  )}
                </div>
              </div>

              {/* 검증 상태 배너 */}
              <div className={`p-3 rounded-xl text-xs border ${
                isReady
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700'
              }`}>
                {isReady ? (
                  <p className="font-medium">✅ 구성 완료 — 생성 가능</p>
                ) : (
                  <ul className="space-y-0.5">
                    {(frontItems.length !== 1 || backItems.length !== 1) && (
                      <li>• 앞표지와 뒤표지 사진을 모두 지정해 주세요</li>
                    )}
                    {!isPageMinMet && (
                      <li>• 내지 최소 {specPageMinUI}페이지 필요 (현재 {totalContentPages}p, {specPageMinUI - totalContentPages}p 부족)</li>
                    )}
                    {isPageMinMet && !isIncrementOk && (
                      <li>• {specPageIncUI}페이지 단위로 추가해 주세요 (현재 {totalContentPages}p)</li>
                    )}
                  </ul>
                )}
              </div>

            </div>
          </div>

          {/* ── 우측: 갤러리 + 액션 ──────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* 사진 갤러리 */}
            <div className="bg-white rounded-2xl border border-ink-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display font-bold text-ink-900">📷 사진 갤러리</h2>
                  <p className="text-xs text-ink-400 mt-0.5">
                    사진을 업로드하고 썸네일을 클릭해 역할(앞표지·내지·뒤표지)을 지정하세요 · 드래그로 순서 변경
                  </p>
                </div>
                {gallery.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs flex-wrap justify-end">
                    <span className="text-ink-500">총 {gallery.length}장</span>
                    {frontItems.length > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">앞표지 ✓</span>}
                    {backItems.length  > 0 && <span className="bg-blue-100  text-blue-700  px-2 py-0.5 rounded-full">뒤표지 ✓</span>}
                    {contentItems.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full ${
                        isPageMinMet && isIncrementOk
                          ? 'bg-warm-100 text-warm-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        내지 {totalContentPages}p
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* 드래그 앤 드롭 존 */}
              <div
                onDragOver={(e) => { e.preventDefault(); setGalleryDropActive(true); }}
                onDragLeave={() => setGalleryDropActive(false)}
                onDrop={handleGalleryZoneDrop}
                onClick={() => document.getElementById('gallery-upload-input').click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                  galleryDropActive
                    ? 'border-warm-600 bg-warm-50'
                    : 'border-ink-200 hover:border-warm-400 hover:bg-ink-50'
                }`}
              >
                <input
                  id="gallery-upload-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleGalleryUpload(e.target.files)}
                />
                <p className="text-2xl mb-2">📸</p>
                <p className="text-sm font-medium text-ink-600">사진을 드래그하거나 클릭하여 업로드</p>
                <p className="text-xs text-ink-400 mt-1">여러 장 동시 선택 가능 · 가로형 이미지 자동 감지 (↔)</p>
              </div>

              {/* 갤러리 그리드 */}
              {gallery.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {gallery.map((item, idx) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleGalleryDragStart(e, idx)}
                      onDragOver={(e) => handleGalleryDragOver(e, idx)}
                      onDragEnd={handleGalleryDragEnd}
                      onClick={() => setSelectedIdx(idx)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all group select-none ${
                        galleryDragIdx === idx
                          ? 'opacity-40 scale-95'
                          : 'hover:shadow-md'
                      } ${
                        item.role === 'front'   ? 'border-green-500 ring-2 ring-green-200' :
                        item.role === 'back'    ? 'border-blue-500  ring-2 ring-blue-200'  :
                        item.role === 'content' ? 'border-warm-500  ring-2 ring-warm-200'  :
                        'border-transparent hover:border-ink-300'
                      }`}
                    >
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />

                      {/* 역할 뱃지 */}
                      {item.role && (
                        <div className={`absolute top-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                          item.role === 'front'   ? 'bg-green-600 text-white' :
                          item.role === 'back'    ? 'bg-blue-600  text-white' :
                          'bg-warm-600 text-white'
                        }`}>
                          {item.role === 'front' ? '앞' : item.role === 'back' ? '뒤' : '내지'}
                        </div>
                      )}

                      {/* 양면 분할 뱃지 */}
                      {item.useSpread && (
                        <div className="absolute top-1 right-1 text-[10px] bg-sky-600 text-white px-1.5 py-0.5 rounded-md leading-none">
                          2p
                        </div>
                      )}

                      {/* 가로형 표시 */}
                      {item.isLandscape && !item.useSpread && (
                        <div className="absolute top-1 right-1 text-[10px] bg-sky-500/80 text-white px-1 py-0.5 rounded leading-none">
                          ↔
                        </div>
                      )}

                      {/* 내지 텍스트 유무 */}
                      {item.role === 'content' && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5 text-center leading-none">
                          {item.text.trim() ? '📝' : '🖼️'}
                        </div>
                      )}

                      {/* 호버 오버레이 */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                        <span className="text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">
                          ✏️
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">🖼️</p>
                  <p className="text-sm text-ink-400">사진을 업로드하면 여기에 표시됩니다</p>
                  <p className="text-xs text-ink-300 mt-1">
                    썸네일을 클릭해 앞표지·뒤표지·내지 역할을 지정하세요
                  </p>
                </div>
              )}
            </div>

            {/* API 로그 */}
            {showLog && (
              <div className="bg-ink-900 rounded-2xl p-6 text-sm font-mono">
                <h3 className="text-warm-200 font-bold mb-3">📋 API 호출 로그</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {apiLog.length === 0
                    ? <p className="text-ink-400">아직 API 호출 기록이 없습니다.</p>
                    : apiLog.map((log, i) => (
                        <div key={i} className="text-ink-200">
                          <span className="text-ink-400">[{log.time}]</span> {log.msg}
                        </div>
                      ))}
                </div>
              </div>
            )}

            {/* ── 인라인 편집 패널 (사진 선택 시) 또는 책 생성 액션 (미선택 시) ── */}
            {selectedIdx !== null && modalItem ? (
              /* 인라인 속성 편집 패널 — 모달 대체 */
              <div className="bg-white rounded-2xl border-2 border-warm-200 shadow-md animate-fade-up">
                {/* 패널 헤더 */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">✏️</span>
                    <h3 className="font-display font-bold text-ink-900">사진 편집</h3>
                    <span className="text-sm text-ink-400 font-normal">
                      #{selectedIdx + 1} / {gallery.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-ink-500 hover:text-ink-800 rounded-lg hover:bg-ink-50 border border-ink-200 transition-all"
                  >
                    확인 · 닫기 ✕
                  </button>
                </div>

                {/* 패널 본문 — 2열 그리드 */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* 좌: 사진 미리보기 + 역할 선택 */}
                  <div className="space-y-4">
                    <img
                      src={modalItem.previewUrl}
                      alt="미리보기"
                      className="w-full h-44 object-cover rounded-xl"
                    />

                    {/* 역할 지정 */}
                    <div>
                      <p className="text-xs font-bold text-ink-700 mb-2">이 사진의 역할</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { role: 'front',   label: '앞표지', icon: '📗', disabled: hasFrontElse },
                          { role: 'back',    label: '뒤표지', icon: '📘', disabled: hasBackElse  },
                          { role: 'content', label: '내지',   icon: '📄', disabled: false        },
                        ].map(({ role, label, icon, disabled }) => (
                          <button
                            key={role}
                            type="button"
                            disabled={disabled}
                            onClick={() => assignGalleryRole(selectedIdx, modalItem.role === role ? null : role)}
                            className={`py-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                              modalItem.role === role
                                ? 'border-warm-600 bg-warm-50 text-warm-800'
                                : disabled
                                ? 'border-ink-100 text-ink-300 bg-ink-50 cursor-not-allowed'
                                : 'border-ink-200 text-ink-600 hover:border-ink-400'
                            }`}
                          >
                            <span className="text-xl">{icon}</span>
                            <span>{label}</span>
                            {disabled && <span className="text-[10px] text-ink-300">이미 지정됨</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 표지 전용 — 역할별 CSS 크롭 적용한 표지 템플릿 선택 */}
                    {modalItem.role === 'front' && renderTemplateSelector('front')}
                    {modalItem.role === 'back'  && renderTemplateSelector('back')}
                  </div>

                  {/* 우: 내지 전용 편집 컨트롤 */}
                  {modalItem.role === 'content' ? (
                    <div className="space-y-4 overflow-y-auto max-h-[480px] pr-1">
                      {/* 제목 + 날짜 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-ink-700 mb-1">페이지 제목</label>
                          <input
                            type="text"
                            className="input-field text-sm"
                            placeholder="예) 첫 미소"
                            value={modalItem.title}
                            onChange={(e) => updateGalleryItem(selectedIdx, { title: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-700 mb-1">날짜</label>
                          <input
                            type="date"
                            className="input-field text-sm"
                            value={modalItem.date}
                            onChange={(e) => updateGalleryItem(selectedIdx, { date: e.target.value })}
                          />
                        </div>
                      </div>

                      {/* 텍스트 */}
                      <div>
                        <label className="block text-xs font-medium text-ink-700 mb-1">
                          텍스트
                          <span className="ml-1 font-normal text-ink-400">(선택 — 입력 시 텍스트+사진 템플릿 적용)</span>
                        </label>
                        <textarea
                          className="input-field min-h-[80px] text-sm"
                          placeholder="이 페이지에 들어갈 텍스트를 입력하세요"
                          value={modalItem.text}
                          onChange={(e) => updateGalleryItem(selectedIdx, { text: e.target.value })}
                        />
                        <p className={`text-xs mt-1 ${modalItem.text.trim() ? 'text-green-600' : 'text-ink-400'}`}>
                          {modalItem.text.trim() ? '✓ 사진+텍스트 템플릿 적용 예정' : '이미지 전용 템플릿 적용 예정'}
                        </p>
                      </div>

                      {/* 내지 템플릿 선택 */}
                      {renderTemplateSelector('content')}

                      {/* 양면(Spread) 분할 옵션 */}
                      {modalItem.isLandscape && (
                        <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={modalItem.useSpread}
                              onChange={(e) => updateGalleryItem(selectedIdx, { useSpread: e.target.checked })}
                              className="mt-0.5 accent-sky-600"
                            />
                            <div>
                              <p className="text-sm font-medium text-sky-900">↔ 양면(2p) 꽉 차게 배치</p>
                              <p className="text-xs text-sky-600 mt-0.5">
                                Canvas API로 좌/우 정밀 분할 → 연속된 2페이지에 펼침(Spread)으로 배치
                              </p>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 내지가 아닐 때 오른쪽 컬럼 */
                    <div>
                      {!modalItem.role ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-ink-400 py-8">
                          <p className="text-3xl mb-3">👈</p>
                          <p className="text-sm font-medium text-ink-600">왼쪽에서 역할을 지정하세요</p>
                          <p className="text-xs mt-1">앞표지·뒤표지·내지 중 하나를 선택하면<br/>추가 설정 옵션이 나타납니다</p>
                        </div>
                      ) : (
                        /* 표지 역할 — 스프레드 슬롯 미리보기 */
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-ink-700 mb-1">📔 표지 스프레드 미리보기</p>
                            <p className="text-[11px] text-ink-400 leading-relaxed">
                              SweetBook 표지는 <strong>[뒤표지(좌) | 앞표지(우)]</strong> 한 장 Spread로 인쇄됩니다.<br/>
                              두 슬롯을 모두 채워야 책 생성이 가능합니다.
                            </p>
                          </div>

                          {/* Spread 프레임 */}
                          <div className="flex rounded-xl overflow-hidden border-2 border-ink-200 h-32">
                            {/* 뒤표지 슬롯 (좌측) */}
                            <div
                              className={`w-1/2 relative flex items-center justify-center border-r border-ink-200 overflow-hidden ${
                                backItems[0] ? 'cursor-pointer' : 'bg-ink-50 border-dashed'
                              }`}
                              onClick={() => backItems[0] && setSelectedIdx(gallery.indexOf(backItems[0]))}
                            >
                              {backItems[0] ? (
                                <>
                                  <img src={backItems[0].previewUrl} alt="뒤표지" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/30 flex flex-col items-end justify-end p-1.5">
                                    <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">뒤표지 ✓</span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-center p-2">
                                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-ink-300 flex items-center justify-center mx-auto mb-1">
                                    <span className="text-ink-300 font-bold text-xs">뒤</span>
                                  </div>
                                  <p className="text-[10px] text-ink-400 leading-tight">뒤표지<br/>슬롯 비어있음</p>
                                </div>
                              )}
                            </div>

                            {/* 앞표지 슬롯 (우측) */}
                            <div
                              className={`w-1/2 relative flex items-center justify-center overflow-hidden ${
                                frontItems[0] ? 'cursor-pointer' : 'bg-ink-50'
                              }`}
                              onClick={() => frontItems[0] && setSelectedIdx(gallery.indexOf(frontItems[0]))}
                            >
                              {frontItems[0] ? (
                                <>
                                  <img src={frontItems[0].previewUrl} alt="앞표지" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/30 flex flex-col items-end justify-end p-1.5">
                                    <span className="bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">앞표지 ✓</span>
                                  </div>
                                </>
                              ) : (
                                <div className="text-center p-2">
                                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-ink-300 flex items-center justify-center mx-auto mb-1">
                                    <span className="text-ink-300 font-bold text-xs">앞</span>
                                  </div>
                                  <p className="text-[10px] text-ink-400 leading-tight">앞표지<br/>슬롯 비어있음</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-[9px] text-ink-400 text-center">← 뒤표지 | 앞표지 →</p>

                          {/* 미완성 경고 */}
                          {(frontItems.length !== 1 || backItems.length !== 1) && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              <p className="text-[11px] text-amber-700 font-medium">
                                ⚠️ 앞표지와 뒤표지 사진을 모두 지정해 주세요
                              </p>
                              {frontItems.length !== 1 && (
                                <p className="text-[10px] text-amber-600 mt-0.5">• 앞표지 미지정</p>
                              )}
                              {backItems.length !== 1 && (
                                <p className="text-[10px] text-amber-600 mt-0.5">• 뒤표지 미지정</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 패널 하단 — 삭제 + 닫기 */}
                <div className="px-6 py-4 flex gap-3 border-t border-ink-100">
                  <button
                    type="button"
                    onClick={() => removeGalleryItem(selectedIdx)}
                    className="px-4 py-2 rounded-xl text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-all"
                  >
                    이 사진 삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(null)}
                    className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-warm-600 hover:bg-warm-800 transition-all"
                  >
                    확인 · 편집 완료
                  </button>
                </div>
              </div>
            ) : (
              /* 책 생성 액션 패널 */
              <div className="bg-white rounded-2xl border border-ink-100 p-6">
                <div className="mb-4">
                  <h3 className="font-display font-bold text-ink-900">
                    {bookCreated ? '✅ 책이 생성되었습니다!' : '최종 생성 및 주문'}
                  </h3>
                  <p className="text-sm text-ink-400 mt-1">
                    {bookCreated
                      ? `BookUID: ${bookUid} — 아래 버튼으로 다음 단계로 이동하세요`
                      : isReady
                      ? `앞표지 1장 · 내지 ${totalContentPages}p(${specPageMinUI}p 이상, ${specPageIncUI}p 단위) · 뒤표지 1장 — 구성 완료`
                      : !isPageMinMet
                      ? `내지 최소 ${specPageMinUI}페이지 필요 (현재 ${totalContentPages}p)`
                      : !isIncrementOk
                      ? `내지 ${specPageIncUI}페이지 단위로 구성해 주세요 (현재 ${totalContentPages}p)`
                      : '앞표지와 뒤표지 사진을 모두 지정해 주세요'}
                  </p>
                  {/* 페이지 규격 검증 힌트 — 앞/뒤표지는 지정됐지만 페이지 수 미충족일 때 빨간 안내 */}
                  {!isReady && !bookCreated && frontItems.length === 1 && backItems.length === 1 && (
                    <p className="text-xs text-red-600 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {!isPageMinMet
                        ? `최소 ${specPageMinUI}페이지가 필요합니다 (현재 ${totalContentPages}p, ${specPageMinUI - totalContentPages}p 부족)`
                        : `${specPageIncUI}페이지 단위로 추가해 주세요 (현재 ${totalContentPages}p)`}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/create/${session?.serviceType}`}
                    className="btn-secondary flex-1 text-center"
                  >
                    뒤로
                  </Link>

                  {!bookCreated ? (
                    <button
                      onClick={handleCreateBook}
                      disabled={loading || !isReady}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="spinner" />
                          {uploadingPhoto ? '사진 업로드 중...' : 'API 호출 중...'}
                        </>
                      ) : (
                        <>📗 최종 생성 및 주문</>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/preview')}
                      className="btn-primary flex-1"
                    >
                      다음: 미리보기 &amp; 주문 →
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
