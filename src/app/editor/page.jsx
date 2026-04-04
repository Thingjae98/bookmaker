'use client';

// 에디터 페이지 — 선 구성(Pre-composition) 방식 포토북 에디터
// 갤러리에서 사진을 업로드하고 역할(앞표지/뒤표지/내지)을 모두 지정한 뒤
// [최종 생성 및 주문] 버튼 한 번으로 Book → Photos → Cover → Contents → Finalize API를 순차 호출한다.

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';
import { toast } from '@/lib/toast';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

// ─── 템플릿 폴백 상수 (SQUAREBOOK_HC 기준 실제 검증된 UID) ─────────
// API 동적 조회 실패 시에만 사용되는 안전 장치
const COVER_TEMPLATE_FALLBACK = '79yjMH3qRPly'; // 표지: { coverPhoto, title, dateRange }
const TPL_WITH_PHOTO_FALLBACK = '3FhSEhJ94c0T'; // 내지(사진): { photo1, date, title, diaryText }
const TPL_TEXT_ONLY_FALLBACK  = 'vHA59XPPKqak'; // 내지(텍스트): { date, title, diaryText }
// 하위 호환
const COVER_TEMPLATE = COVER_TEMPLATE_FALLBACK;
const TPL_WITH_PHOTO = TPL_WITH_PHOTO_FALLBACK;
const TPL_TEXT_ONLY  = TPL_TEXT_ONLY_FALLBACK;
const TPL_TEXT_IMAGE = TPL_WITH_PHOTO;
const TPL_IMAGE_ONLY = TPL_WITH_PHOTO;

// ─── 템플릿 와이어프레임 타입 추론 (모듈 레벨) ────────────────────
// API 템플릿 객체에서 레이아웃 유형을 추론하여 동적 매핑에 활용
const classifyTemplate = (t) => {
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
  return 'photo_text'; // 기본값
};

// ─── API 기반 동적 템플릿 매핑 ─────────────────────────────────────
// GET /api/templates?bookSpecUid=... 응답에서 역할·와이어프레임 타입별 최적 템플릿을 선택
//
// 핵심 원칙: **검증된 폴백 UID 우선 사용 (Verified-First)**
//   1. API 결과 내에 검증된 UID가 존재하면 → 해당 UID 사용 (가장 안전)
//   2. 검증된 UID가 없으면 → classifyTemplate 기반 자동 선택 (다른 판형용)
//   3. 아무것도 없으면 → 하드코딩 폴백 상수 (최후의 안전 장치)
//
// 배경: API가 bookSpecUid 쿼리로 서버 필터링을 하므로 응답 50개가 모두 해당 판형일 수 있음.
//       하지만 covers[0]이 4MY2fokVjkeY 같은 미검증 UID를 선택하여 400 에러 유발.
//       classifyTemplate 이름 기반 추론은 API 네이밍 변경에 취약 — 검증 UID 우선 전략으로 해결.
const resolveTemplates = (apiTemplates, bookSpecUid) => {
  // ── 검증된 UID가 API 목록에 존재하는지 우선 확인 ──
  const uidSet = new Set(apiTemplates.map((t) => t.templateUid));
  const hasFallback = (uid) => uidSet.has(uid);

  // 검증된 UID가 API 목록에 있으면 그대로 사용, 없으면 classifyTemplate 기반 탐색
  const covers   = apiTemplates.filter((t) => classifyTemplate(t) === 'cover');
  const contents = apiTemplates.filter((t) => classifyTemplate(t) !== 'cover');
  const findByType = (list, type) => list.find((t) => classifyTemplate(t) === type);

  // 표지: 검증 UID 우선 → classify 기반 → 폴백 상수
  const coverUid = hasFallback(COVER_TEMPLATE_FALLBACK)
    ? COVER_TEMPLATE_FALLBACK
    : (covers[0]?.templateUid || COVER_TEMPLATE_FALLBACK);

  // 사진+텍스트: 검증 UID 우선
  const photoTextUid = hasFallback(TPL_WITH_PHOTO_FALLBACK)
    ? TPL_WITH_PHOTO_FALLBACK
    : (findByType(contents, 'photo_text')?.templateUid || TPL_WITH_PHOTO_FALLBACK);

  // 텍스트 전용: 검증 UID 우선
  const textOnlyUid = hasFallback(TPL_TEXT_ONLY_FALLBACK)
    ? TPL_TEXT_ONLY_FALLBACK
    : (findByType(contents, 'text_only')?.templateUid || TPL_TEXT_ONLY_FALLBACK);

  // 사진 전용 / 스프레드: photoText 겸용
  const photoOnlyUid = hasFallback(TPL_WITH_PHOTO_FALLBACK)
    ? TPL_WITH_PHOTO_FALLBACK
    : (findByType(contents, 'photo_only')?.templateUid || photoTextUid);

  // 진단 로그: API 템플릿 첫 객체의 필드명 출력 (디버깅용)
  if (apiTemplates.length > 0) {
    const sample = apiTemplates[0];
    console.log('[resolveTemplates] 샘플 템플릿 객체 키:', Object.keys(sample));
    console.log('[resolveTemplates] 샘플:', { uid: sample.templateUid, name: sample.name, kind: sample.templateKind, bookSpecUid: sample.bookSpecUid });
  }

  return {
    cover:      coverUid,
    photoText:  photoTextUid,
    photoOnly:  photoOnlyUid,
    textOnly:   textOnlyUid,
    spread:     photoOnlyUid,
    source:     apiTemplates.length > 0 ? (hasFallback(COVER_TEMPLATE_FALLBACK) ? 'API+검증' : 'API') : 'fallback',
    totalFiltered: apiTemplates.length,
    totalRaw:      apiTemplates.length,
  };
};

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

  // ── stagedFiles: itemId → File 보조 맵 ──────────────────────
  // gallery state 업데이트와 독립적으로 파일 객체를 보관.
  // gallery.filter/map/splice 등이 새 배열을 만들어도 파일 참조가 끊어지지 않도록 이중 보관.
  // 키: 갤러리 아이템의 고유 id (문자열), 값: File | Blob 객체
  const stagedFilesRef = useRef({});

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
    let frontCoverData = null;
    let backCoverData  = null;
    if (aiRaw) {
      initialPages = JSON.parse(aiRaw);
      sessionStorage.removeItem('bookmaker_ai_pages');
    } else if (data.useDummy) {
      const dummy = DUMMY_DATA[data.serviceType];
      if (dummy) {
        // 표지와 내지 완전 분리 — pages에서 표지를 빼지 않음
        frontCoverData = dummy.frontCover || null;
        backCoverData  = dummy.backCover  || null;
        initialPages   = dummy.pages;
      }
    }

    if (initialPages.length > 0 || frontCoverData || backCoverData) {
      const ts = Date.now();
      const items = [];

      // 표지 생성 헬퍼
      const makePageUrl = (p, fallbackSeed) =>
        (p?.image === null || p?.image === '') ? null
        : (p?.image?.startsWith('http') ? p.image : `https://picsum.photos/seed/${fallbackSeed}/600/600`);

      // ── 앞표지 (frontCover에서 가져옴 — pages 배열과 무관) ──
      if (frontCoverData) {
        items.push({
          id: `init-front-${ts}`, file: null,
          previewUrl: makePageUrl(frontCoverData, `${data.serviceType}-cover-front`),
          role: 'front', title: frontCoverData.title || '', text: '', date: new Date().toISOString().slice(0, 10),
          templateUid: null, isLandscape: false, useSpread: false,
        });
      }

      // ── 뒤표지 (backCover에서 가져옴 — pages 배열과 무관) ──
      if (backCoverData) {
        items.push({
          id: `init-back-${ts}`, file: null,
          previewUrl: makePageUrl(backCoverData, `${data.serviceType}-cover-back`),
          role: 'back', title: backCoverData.title || '', text: '', date: new Date().toISOString().slice(0, 10),
          templateUid: null, isLandscape: false, useSpread: false,
        });
      }

      // ── 내지 24장 (pages 배열 전체 — 표지에 빼앗기지 않음) ──
      initialPages.forEach((p, i) => {
        items.push({
          id:          `init-${i}-${ts}`,
          file:        null,
          previewUrl:  makePageUrl(p, `${data.serviceType}-${i}`),
          role:        'content',
          title:       p.title       || '',
          text:        p.text        || p.teacherComment || '',
          date:        p.date        || new Date().toISOString().slice(0, 10),
          templateUid: null,
          isLandscape: p.isLandscape || false,
          useSpread:   false,
        });
      });

      // AI 동화 로드 시 frontCover/backCover 없으면 기존 방식 폴백 (첫/끝 페이지 표지 지정)
      if (!frontCoverData && !backCoverData && items.length > 0) {
        items[0].role = 'front';
        if (items.length > 1) items[items.length - 1].role = 'back';
      }

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
      arr.map(async (file) => {
        const id = `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // stagedFilesRef에 파일 등록 — gallery state와 독립적으로 보관
        stagedFilesRef.current[id] = file;
        return {
          id,
          file,
          previewUrl:  URL.createObjectURL(file),
          role:        null,
          title:       '',
          text:        '',
          date:        new Date().toISOString().slice(0, 10),
          templateUid: null,
          isLandscape: await detectLandscape(file),
          useSpread:   false,
        };
      })
    );
    setGallery((prev) => [...prev, ...newItems]);
    toast.success(`${arr.length}장이 갤러리에 추가됐습니다`);
  };

  const updateGalleryItem = (idx, updates) =>
    setGallery((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));

  const removeGalleryItem = (idx) => {
    setGallery((prev) => {
      const item = prev[idx];
      if (item?.id) delete stagedFilesRef.current[item.id]; // stagedFiles 정리
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

  // ── 빈 슬롯 사진 교체 — 인라인 패널에서 직접 파일 선택 시 ─────
  // setGallery 함수형 업데이트 내부에서 아이템 ID를 읽어 stagedFilesRef에 이중 등록
  const handleBlankSlotUpload = async (galleryIdx, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const isLandscape = await detectLandscape(file);
    setGallery((prev) => {
      const item = prev[galleryIdx];
      // stagedFilesRef에 itemId 기반으로 파일 등록 — 절대 누락되지 않도록 이중 보관
      if (item?.id) {
        stagedFilesRef.current[item.id] = file;
        console.log(`[stagedFiles] 빈 슬롯 파일 등록 | itemId: ${item.id} | 파일:`, file);
      }
      return prev.map((it, i) =>
        i === galleryIdx
          ? { ...it, file, previewUrl, isLandscape, isBlankSlot: false }
          : it
      );
    });
    toast.success('사진이 슬롯에 등록됐습니다');
  };

  // ── 스프레드(2페이지 쌍) 관련 헬퍼 ──────────────────────────
  // 빈 내지 슬롯 생성 — previewUrl: null로 갤러리에서 특수 렌더링
  const makeBlankItem = () => ({
    id:          `blank-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file:        null,
    previewUrl:  null,
    role:        'content',
    title:       '',
    text:        '',
    date:        new Date().toISOString().slice(0, 10),
    templateUid: null,
    isLandscape: false,
    useSpread:   false,
    isBlankSlot: true,
  });

  // 스프레드 1장(2페이지) 추가 — pageIncrement: 2 규격 준수
  const addSpread = () => {
    setGallery((prev) => [...prev, makeBlankItem(), makeBlankItem()]);
    toast.success('스프레드 1장(2페이지)이 추가됐습니다');
  };

  // 스프레드 쌍 삭제 — 내지 아이템의 파트너까지 함께 제거해 항상 짝수 유지
  const removeSpreadPair = (galleryIdx) => {
    setGallery((prev) => {
      const item    = prev[galleryIdx];
      const cItems  = prev.filter((g) => g.role === 'content');
      const cIdx    = cItems.findIndex((c) => c === item);
      if (cIdx === -1) {
        // 내지가 아니면 단순 삭제
        if (item?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
        return prev.filter((_, i) => i !== galleryIdx);
      }
      const spreadStart = Math.floor(cIdx / 2) * 2;
      const pairSet     = new Set(
        [cItems[spreadStart], cItems[spreadStart + 1]]
          .filter(Boolean)
          .map((p) => prev.indexOf(p))
      );
      prev.forEach((it, i) => {
        if (pairSet.has(i)) {
          if (it?.id) delete stagedFilesRef.current[it.id]; // stagedFiles 정리
          if (it?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(it.previewUrl);
        }
      });
      return prev.filter((_, i) => !pairSet.has(i));
    });
    setSelectedIdx(null);
  };

  // 스프레드 내 L/R 슬롯 교체 — 내지 아이템을 갤러리에서 파트너와 swap
  const swapSpreadSlot = (galleryIdx) => {
    setGallery((prev) => {
      const item   = prev[galleryIdx];
      const cItems = prev.filter((g) => g.role === 'content');
      const cIdx   = cItems.findIndex((c) => c === item);
      if (cIdx === -1) return prev;
      const isLeft  = cIdx % 2 === 0;
      const pCIdx   = isLeft ? cIdx + 1 : cIdx - 1;
      if (pCIdx < 0 || pCIdx >= cItems.length) return prev;
      const partner = cItems[pCIdx];
      const pGIdx   = prev.indexOf(partner);
      const next    = [...prev];
      [next[galleryIdx], next[pGIdx]] = [next[pGIdx], next[galleryIdx]];
      return next;
    });
    setSelectedIdx(null); // swap 후 패널 닫기 (인덱스가 바뀌어 혼란 방지)
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

  // 스프레드 그룹: 내지 2장씩 묶어 [L슬롯 | R슬롯] 쌍으로 관리
  const spreadGroups = useMemo(() => {
    const groups = [];
    for (let i = 0; i < contentItems.length; i += 2) {
      groups.push({
        spreadNum:    Math.floor(i / 2) + 1,
        leftItem:     contentItems[i]     ?? null,
        rightItem:    contentItems[i + 1] ?? null,
        leftPageNum:  i + 1,
        rightPageNum: i + 2,
      });
    }
    return groups;
  }, [contentItems]);

  // ── 모달 템플릿 선택 헬퍼 ──────────────────────────────────────

  // 1) 판형 일치 + 역할 일치 필터 + 이름 기준 중복 제거
  const getTemplatesForRole = (role) => {
    const all     = session?.allTemplates || [];
    // 판형 필터는 API 서버에서 이미 적용됨 (bookSpecUid 쿼리 파라미터)
    // 클라이언트에서는 역할(cover/content)만 필터링
    const filtered = all.filter((t) => {
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
    return 'photo_text';
  };

  // 2-b) 와이어프레임 타입 → 사용자 친화적 한글 라벨 매핑
  const WIREFRAME_LABELS = {
    cover:      '표지',
    photo_text: '사진 + 글',
    photo_only: '사진 꽉 차게',
    text_only:  '글만',
    blank:      '빈 페이지',
    calendar:   '캘린더',
  };
  const getTemplateLabel = (t) => {
    const wt = inferWireframeType(t);
    return WIREFRAME_LABELS[wt] || '사진 + 글';
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
  // 모든 타입의 템플릿을 카테고리 그룹으로 보여주되, API 원본 이름은 숨기고 정제된 한글 라벨 표시
  const renderTemplateSelector = (role) => {
    const isCover  = role === 'front' || role === 'back';
    const allTpls  = getTemplatesForRole(role);

    const autoLabel    = isCover ? '기본 표지형' : '자동 선택';
    const autoDesc     = isCover
      ? '검증된 기본 표지 템플릿 적용'
      : '텍스트 입력 여부에 따라 최적 템플릿 자동 분기';
    const sectionTitle = isCover ? '표지 템플릿' : '내지 템플릿';

    // 내지: 카테고리별 그룹화 (표지는 그룹 없이 전체 표시)
    const CATEGORY_ORDER = ['photo_text', 'photo_only', 'text_only', 'calendar', 'blank'];
    const CATEGORY_LABELS = {
      photo_text: '사진 + 글',
      photo_only: '사진 꽉 차게',
      text_only:  '글만',
      calendar:   '캘린더',
      blank:      '빈 페이지',
    };
    const CATEGORY_ICONS = {
      photo_text: '🖼',
      photo_only: '📷',
      text_only:  '✍',
      calendar:   '📅',
      blank:      '📄',
    };

    // 카테고리별 템플릿 그룹 생성
    const grouped = {};
    allTpls.forEach((t) => {
      const wt = inferWireframeType(t);
      const cat = CATEGORY_ORDER.includes(wt) ? wt : 'photo_text';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    // 개별 템플릿 카드 렌더
    const renderTplCard = (t) => {
      const previewImg  = t.thumbnails?.layout || t.thumbnails?.baseLayerOdd || t.thumbnails?.baseLayerEven || t.thumbnailUrl || t.previewUrl || t.imageUrl || t.thumbUrl;
      const wfType      = inferWireframeType(t);
      const label       = getTemplateLabel(t);
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
              <div className="w-full h-[72px] overflow-hidden rounded-lg mb-1.5 relative bg-ink-100">
                <img
                  src={previewImg}
                  alt={label}
                  className={`absolute h-full top-0 ${
                    isCover
                      ? role === 'front'
                        ? 'right-0 w-[200%]'
                        : 'left-0 w-[200%]'
                      : 'left-0 w-full object-cover'
                  }`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const wf = e.currentTarget.parentElement.querySelector('[data-wf]');
                    if (wf) wf.style.display = 'block';
                  }}
                />
                <div data-wf="1" style={{ display: 'none' }}>{renderWireframe(wfType)}</div>
              </div>
            </>
          ) : (
            renderWireframe(wfType)
          )}
          <p className={`text-[11px] font-medium leading-tight truncate ${isSelected ? 'text-warm-800' : 'text-ink-700'}`}>
            {label}
          </p>
          {isSelected && (
            <p className="text-[10px] text-warm-600 mt-0.5">✓ 선택됨</p>
          )}
        </button>
      );
    };

    return (
      <div>
        <p className="text-xs font-medium text-ink-700 mb-2">
          {sectionTitle}
          {allTpls.length === 0 && (
            <span className="ml-1.5 font-normal text-ink-400">(기본값 자동 적용)</span>
          )}
        </p>

        {/* 표지 전용 — Spread 2장 필수 안내 */}
        {isCover && (
          <div className="flex items-start gap-1.5 mb-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2">
            <span className="text-blue-500 text-sm shrink-0 mt-0.5">ℹ</span>
            <p className="text-[11px] text-blue-700 leading-relaxed">
              이 템플릿은 <strong>앞/뒤표지 2장의 사진이 모두 필요</strong>합니다.
            </p>
          </div>
        )}

        {/* ★ 자동 선택 카드 */}
        <button
          type="button"
          onClick={() => updateGalleryItem(selectedIdx, { templateUid: null })}
          className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center gap-3 mb-3 ${
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

        {/* 표지: 그룹 없이 전체 표시 */}
        {isCover && allTpls.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {allTpls.map(renderTplCard)}
          </div>
        )}

        {/* 내지: 카테고리별 그룹으로 분리 표시 — 모든 타입 노출 */}
        {!isCover && CATEGORY_ORDER.map((cat) => {
          const catTpls = grouped[cat];
          if (!catTpls || catTpls.length === 0) return null;
          return (
            <div key={cat} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs">{CATEGORY_ICONS[cat]}</span>
                <span className="text-[11px] font-semibold text-ink-600">{CATEGORY_LABELS[cat]}</span>
                <span className="text-[10px] text-ink-400">({catTpls.length})</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {catTpls.map(renderTplCard)}
              </div>
            </div>
          );
        })}
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

      // ── API 기반 동적 템플릿 매핑 ────────────────────────────────
      // GET /templates?bookSpecUid=... 으로 현재 판형의 실제 사용 가능한 템플릿 목록을 조회하고,
      // 와이어프레임 타입(cover, photo_text, photo_only, text_only)별로 최적 매핑
      let tplMap = resolveTemplates([], bookSpecUid); // 초기값: 폴백
      try {
        const tplRes = await fetch(`/api/templates?bookSpecUid=${bookSpecUid}&limit=50`);
        const tplData = await tplRes.json();
        const apiTpls = tplData?.data || tplData?.items || [];
        if (Array.isArray(apiTpls) && apiTpls.length > 0) {
          tplMap = resolveTemplates(apiTpls, bookSpecUid);
          addLog(`📐 템플릿 매핑 (${tplMap.source}) — API ${tplMap.totalRaw}개 조회`);
          addLog(`   표지: ${tplMap.cover} / 사진+텍스트: ${tplMap.photoText} / 텍스트: ${tplMap.textOnly}`);
        } else {
          addLog(`⚠️ 템플릿 API 응답 없음 — 검증된 폴백 UID 사용`);
        }
      } catch (tplErr) {
        addLog(`⚠️ 템플릿 조회 실패(${tplErr.message}) — 검증된 폴백 UID 사용`);
      }

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
      // ▸ 인덱스 매핑 원칙
      //   contentFileMap[ci] = contentItems[ci]의 파일 (절대 내지 인덱스 0~N)
      //   파일 취득 우선순위: stagedFilesRef[item.id] → item.file → previewUrl(http) → fallback
      //   스프레드 재정렬·삭제 후에도 itemId 기반으로 파일이 안전하게 보존됨
      setUploadingPhoto(true);

      // ── 절대 내지 인덱스 기준 파일 맵 스냅샷 ──────────────────────
      // handleCreateBook 호출 시점의 contentItems 순서를 확정 스냅샷으로 고정
      const contentFileMap = {}; // ci(0~N) → File|Blob
      contentItems.forEach((item, ci) => {
        // 1순위: stagedFilesRef(ID 기반, 가장 신뢰도 높음)
        // 2순위: item.file (gallery state에 저장된 참조)
        const f = stagedFilesRef.current[item.id] ?? item.file;
        if (f instanceof File || f instanceof Blob) {
          contentFileMap[ci] = f;
        }
      });
      const fileCount = Object.keys(contentFileMap).length;
      addLog(`📁 내지 파일 맵: ${fileCount}개 / ${contentItems.length}장 보유 (인덱스: [${Object.keys(contentFileMap).join(', ')||'없음'}])`);
      console.log('[contentFileMap 스냅샷]', contentFileMap);

      // 앞/뒤 표지 파일도 stagedFilesRef 우선으로 취득
      const frontItem = frontItems[0];
      const backItem  = backItems[0];
      const frontFile = stagedFilesRef.current[frontItem.id] ?? frontItem.file;
      const backFile  = stagedFilesRef.current[backItem.id]  ?? backItem.file;

      const totalPhotos = fileCount + (frontFile ? 1 : 0) + (backFile ? 1 : 0);
      addLog(`📸 사진 업로드 시작 (로컬 파일 총 ${totalPhotos}장)...`);

      // File → Photos API 업로드 헬퍼 (URL 반환)
      // 실패 시 null 반환 (throw 하지 않음 — 상위 루프에서 폴백 처리)
      const uploadFile = async (file, label) => {
        if (!file) { addLog(`⚠️ ${label}: 파일 객체 없음`); return null; }
        if (!(file instanceof File) && !(file instanceof Blob)) {
          addLog(`⚠️ ${label}: 유효하지 않은 파일 타입 (${typeof file})`);
          console.dir({ invalidFile: file, label });
          return null;
        }
        try {
          console.log(`[업로드 시도] ${label} | 파일:`, file, '| size:', file.size, 'type:', file.type);
          const form = new FormData();
          form.append('file', file, file.name || 'photo.jpg');
          const r = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: form });
          const d = await r.json();

          // 응답 구조 전체 로그 (URL 필드명 진단용)
          console.log(`[업로드 응답] ${label}:`, JSON.stringify(d));
          addLog(`[응답] ${label}: success=${d.success} | data=${JSON.stringify(d.data)?.slice(0, 120)}`);

          if (!d.success) {
            addLog(`⚠️ ${label} 업로드 실패: ${d.message || '서버 오류'}`);
            console.dir({ uploadFail: d, label });
            return null;
          }

          // SweetBook Photos API 실제 URL 필드명 — 모든 가능한 경우 탐색
          const raw = d.data;
          const url =
            // d.data 자체가 URL 문자열인 경우
            (typeof raw === 'string' && raw.startsWith('http') ? raw : null) ||
            // 일반적인 URL 필드명들
            raw?.url ||
            raw?.downloadUrl ||
            raw?.originalUrl ||
            raw?.photoUrl ||
            raw?.fileUrl ||
            raw?.imageUrl ||
            raw?.cdnUrl ||
            raw?.publicUrl ||
            raw?.uploadedUrl ||
            raw?.uploadUrl ||
            raw?.originalFileUrl ||
            raw?.fileDownloadUrl ||
            // 중첩 photo 객체 내 URL
            raw?.photo?.url ||
            raw?.photo?.downloadUrl ||
            raw?.photo?.originalUrl ||
            // fileName 기반 URL 조합 (마지막 수단)
            null;

          if (url) {
            addLog(`✅ ${label} 업로드 완료 (URL) → ${url.slice(0, 60)}`);
            return url;
          }

          // SweetBook Photos API는 URL을 반환하지 않고 fileName(내부 참조 ID)만 반환함.
          // 템플릿 파라미터(photo1, coverPhoto)에 fileName을 그대로 전달하면
          // SweetBook 렌더링 엔진이 해당 book 내 업로드된 사진을 자동으로 조회함.
          if (raw?.fileName) {
            addLog(`✅ ${label} 업로드 완료 (fileName 참조) → ${raw.fileName}`);
            return raw.fileName;
          }

          addLog(`⚠️ ${label} 업로드 성공했으나 URL/fileName 모두 미발견. 응답: ${JSON.stringify(raw)?.slice(0, 200)}`);
          console.warn(`[참조값 없음] ${label}:`, raw);
          return null;
        } catch (err) {
          addLog(`⚠️ ${label} 업로드 예외: ${err.message}`);
          console.dir({ uploadException: err, label });
          return null;
        }
      };

      // 앞표지 URL 확보
      let coverFrontUrl = `https://picsum.photos/seed/${session.serviceType}-front/600/600`;
      if (frontFile) {
        const url = await uploadFile(frontFile, '앞표지');
        if (url) coverFrontUrl = url;
      } else if (frontItem.previewUrl?.startsWith('http')) {
        coverFrontUrl = frontItem.previewUrl;
      }
      addLog(`📗 앞표지 URL: ${coverFrontUrl.slice(0, 70)}`);

      // 뒤표지 URL 확보
      let coverBackUrl = `https://picsum.photos/seed/${session.serviceType}-back/600/600`;
      if (backFile) {
        const url = await uploadFile(backFile, '뒤표지');
        if (url) coverBackUrl = url;
      } else if (backItem.previewUrl?.startsWith('http')) {
        coverBackUrl = backItem.previewUrl;
      }
      addLog(`📘 뒤표지 URL: ${coverBackUrl.slice(0, 70)}`);

      // ── 내지 사진 업로드 — contentFileMap[ci] 기준 (절대 인덱스 매핑) ──
      const contentPageData = [];
      addLog(`📄 내지 ${contentItems.length}장 처리 중...`);

      for (let ci = 0; ci < contentItems.length; ci++) {
        const item          = contentItems[ci];
        const fileToUpload  = contentFileMap[ci]; // 절대 인덱스로 파일 취득
        const fallbackUrl   = `https://picsum.photos/seed/${session.serviceType}-c${ci}/600/600`;

        if (item.useSpread && item.isLandscape && fileToUpload) {
          // Canvas API 양면 분할 (가로형 사진 → 좌/우 2페이지)
          addLog(`↔️ 양면 분할: 내지 ${ci + 1} (itemId: ${item.id})`);
          try {
            const [lb, rb]  = await splitImageHalves(fileToUpload);
            const leftFile  = new File([lb], 'spread-left.jpg',  { type: 'image/jpeg' });
            const rightFile = new File([rb], 'spread-right.jpg', { type: 'image/jpeg' });
            const leftUrl   = (await uploadFile(leftFile,  `내지 ${ci + 1}-L`)) || fallbackUrl;
            const rightUrl  = (await uploadFile(rightFile, `내지 ${ci + 1}-R`)) || fallbackUrl;
            contentPageData.push({ imageUrl: leftUrl,  text: item.text || '', title: item.title || '', date: item.date, isSpreadPage: true });
            contentPageData.push({ imageUrl: rightUrl, text: '',               title: '',               date: item.date, isSpreadPage: true });
            addLog(`✅ 양면 분할 완료 → 2페이지 (내지 ${ci + 1})`);
          } catch (e) {
            addLog(`⚠️ 양면 분할 실패(${e.message}) — 원본 단일 처리`);
            console.dir({ spreadSplitError: e, ci });
            const singleUrl = (await uploadFile(fileToUpload, `내지 ${ci + 1}`)) || fallbackUrl;
            contentPageData.push({ imageUrl: singleUrl, text: item.text || '', title: item.title || '', date: item.date });
          }
        } else {
          // 일반 내지: contentFileMap → previewUrl(http) → 빈 슬롯이면 null → 아니면 fallback
          let imgUrl = null;
          if (fileToUpload) {
            imgUrl = await uploadFile(fileToUpload, `내지 ${ci + 1}`);
            if (!imgUrl) {
              addLog(`⚠️ 내지 ${ci + 1} 업로드 실패 — picsum fallback 적용`);
              imgUrl = fallbackUrl;
            }
          } else if (item.previewUrl?.startsWith('http')) {
            imgUrl = item.previewUrl; // 더미/AI 데이터 picsum URL (직접 참조)
          } else if (!item.isBlankSlot) {
            imgUrl = fallbackUrl; // 파일도 previewUrl도 없는 일반 아이템 → fallback
            addLog(`📎 내지 ${ci + 1}: 파일 없음(isBlankSlot=${item.isBlankSlot}) → picsum fallback`);
          }
          // isBlankSlot = true 이면 imgUrl = null 유지 → TPL_TEXT_ONLY로 전송
          contentPageData.push({
            imageUrl: imgUrl,
            text:  item.text  || '',
            title: item.title || '',
            date:  item.date  || new Date().toISOString().slice(0, 10),
          });
        }
      }
      setUploadingPhoto(false);
      addLog(`✅ 내지 처리 완료 — 실제 페이지 ${contentPageData.length}개 (이미지 있음: ${contentPageData.filter(p => p.imageUrl).length}개)`);

      // ── 판형 최소 페이지 충족 — pageMin + pageIncrement 수학적 준수 ──
      const specPageMin       = BOOK_SPECS[bookSpecUid]?.pageMin       || 24;
      const specPageIncrement = BOOK_SPECS[bookSpecUid]?.pageIncrement || 2;
      const rawCount          = Math.max(specPageMin, contentPageData.length);
      const rem               = rawCount % specPageIncrement;
      const targetContentCount = rem === 0 ? rawCount : rawCount + (specPageIncrement - rem);

      // 패딩 페이지 — picsum fallback URL 사용으로 API 400 방지
      const paddedPages = [...contentPageData];
      let ri = 0;
      while (paddedPages.length < targetContentCount) {
        const pIdx    = paddedPages.length;
        const srcPage = contentPageData[ri % contentPageData.length];
        // 패딩 페이지는 반드시 이미지 URL 확보 (null 이미지로 API 전송 시 400 위험)
        const padImgUrl = srcPage.imageUrl
          || `https://picsum.photos/seed/${session.serviceType}-pad${pIdx}/600/600`;
        paddedPages.push({
          imageUrl: padImgUrl,
          text:  srcPage.text  || '',
          title: srcPage.title || '',
          date:  srcPage.date  || new Date().toISOString().slice(0, 10),
        });
        ri++;
      }
      if (paddedPages.length > contentPageData.length) {
        const targetTotal = targetContentCount + 1;
        addLog(`📋 판형 최소 ${specPageMin}p / 증분 ${specPageIncrement}p 충족 — ${paddedPages.length - contentPageData.length}p 패딩 (내지 ${targetContentCount}p, 총 ${targetTotal}p)`);
      }

      // ── STEP 3: 앞표지 추가 ────────────────────────────────────
      // session.coverTemplateUid는 create 단계에서 API가 동적으로 반환한 값으로
      // 검증되지 않은 UID(예: 4MY2fokVjkeY)가 들어올 수 있음 → 항상 검증된 상수 사용
      const coverTplUid = tplMap.cover;
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
      // 템플릿 동적 선택 원칙 (API 매핑 기반):
      //   - 이미지+텍스트 있음  → tplMap.photoText (사진+텍스트 레이아웃)
      //   - 이미지만 있음       → tplMap.photoOnly (사진 전용 레이아웃, 없으면 photoText 폴백)
      //   - 텍스트만 있음       → tplMap.textOnly  (텍스트 전용 레이아웃)
      //   - 양면(Spread) 페이지 → tplMap.spread    (사진 전용 우선)
      addLog(`📄 내지 ${paddedPages.length}페이지 추가 중...`);
      let contentsFailCount = 0;
      for (let i = 0; i < paddedPages.length; i++) {
        const page = paddedPages[i];
        const hasImage = !!(page.imageUrl);
        const hasText  = !!(page.text || '').trim();
        // 동적 템플릿 선택: 페이지 데이터 조합에 따른 최적 매핑
        let tplUid;
        if (page.isSpreadPage) {
          tplUid = tplMap.spread;  // 양면 분할 페이지 → 사진 전용 우선
        } else if (hasImage && hasText) {
          tplUid = tplMap.photoText;  // 사진 + 텍스트
        } else if (hasImage && !hasText) {
          tplUid = tplMap.photoOnly;  // 사진만 (Full-bleed)
        } else {
          tplUid = tplMap.textOnly;   // 텍스트만 또는 빈 페이지
        }
        const params = {
          date:      page.date  || new Date().toISOString().slice(0, 10),
          title:     page.title || `페이지 ${i + 1}`,
          // 빈 문자열은 일부 API 검증 실패 → 단일 공백으로 폴백
          diaryText: (page.text || '').trim() || ' ',
        };
        if (hasImage) params.photo1 = page.imageUrl;

        try {
          const r = await fetch(`/api/books/${uid}/contents`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ templateUid: tplUid, parameters: params, breakBefore: 'page' }),
          });
          const d = await r.json();
          if (!d.success) {
            contentsFailCount++;
            const detail = d.details ? JSON.stringify(d.details) : '';
            addLog(`⚠️ 페이지 ${i + 1} 실패: ${d.message} | tpl=${tplUid} hasImg=${hasImage} | ${detail}`);
            console.dir({ contentsError: d, page, tplUid, params, pageIndex: i });
          } else if (i % 5 === 0 || i === paddedPages.length - 1) {
            addLog(`📄 내지 ${i + 1}/${paddedPages.length}`);
          }
        } catch (err) {
          contentsFailCount++;
          addLog(`⚠️ 페이지 ${i + 1} 전송 예외: ${err.message}`);
          console.dir({ contentsException: err, pageIndex: i });
        }
      }
      if (contentsFailCount > 0) {
        addLog(`⚠️ 내지 전송 중 ${contentsFailCount}페이지 실패 (${paddedPages.length - contentsFailCount}페이지 성공)`);
      } else {
        addLog(`✅ 내지 ${paddedPages.length}페이지 모두 완료`);
      }

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

        // 미리보기 페이지용 스프레드 데이터 저장 (실데이터 기반 렌더링)
        const previewData = {
          coverFront: { url: coverFrontUrl, title },
          coverBack:  { url: coverBackUrl,  title: '뒤표지' },
          pages: paddedPages.map((p, idx) => ({
            imageUrl: p.imageUrl,
            title:    p.title || `페이지 ${idx + 1}`,
            text:     p.text  || '',
            date:     p.date  || '',
            isSpreadPage: p.isSpreadPage || false,
          })),
        };
        sessionStorage.setItem('bookmaker_preview', JSON.stringify(previewData));
      } else {
        const finalDetail = finalData.details ? ` | 상세: ${JSON.stringify(finalData.details)}` : '';
        addLog(`❌ 최종화 실패: ${finalData.message}${finalDetail}`);
        console.dir({ finalizeError: finalData, uid, paddedPagesCount: paddedPages.length });
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

  // 선택된 아이템의 스프레드 슬롯 정보 (내지일 때만 유효)
  const contentIdxOfSelected = (modalItem?.role === 'content')
    ? contentItems.findIndex((c) => c === modalItem)
    : -1;
  const spreadNumOfSelected  = contentIdxOfSelected >= 0
    ? Math.floor(contentIdxOfSelected / 2) + 1
    : null;
  const isLeftPage  = contentIdxOfSelected >= 0 && contentIdxOfSelected % 2 === 0;
  const partnerItem = contentIdxOfSelected >= 0
    ? (isLeftPage
        ? contentItems[contentIdxOfSelected + 1]
        : contentItems[contentIdxOfSelected - 1]) ?? null
    : null;

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

              {/* ── 내지 스프레드 뷰 ────────────────────────────── */}
              {/* pageIncrement: 2 규격에 맞춰 2장씩 묶어 [L | R] 쌍으로 표시 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-ink-500">내지 (스프레드 뷰)</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isPageMinMet && isIncrementOk
                      ? 'bg-green-100 text-green-700'
                      : isPageMinMet
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {totalContentPages}p / 최소 {specPageMinUI}p
                  </span>
                </div>

                {/* 스프레드 그룹 목록 */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {spreadGroups.length === 0 && (
                    <p className="text-xs text-ink-400 text-center py-6">
                      갤러리에서 내지를 지정하거나<br/>아래 버튼으로 추가하세요
                    </p>
                  )}
                  {spreadGroups.map((sg) => (
                    <div key={`sg-${sg.spreadNum}`} className="rounded-xl border border-ink-200 overflow-hidden bg-white">
                      {/* 스프레드 헤더 */}
                      <div className="flex items-center px-2 py-0.5 bg-ink-50 border-b border-ink-100">
                        <span className="text-[9px] font-bold text-ink-500 tracking-wide">
                          스프레드 {sg.spreadNum} · {sg.leftPageNum}–{sg.rightPageNum}쪽
                        </span>
                      </div>
                      {/* L / R 두 슬롯 */}
                      <div className="grid grid-cols-2 divide-x divide-ink-100">
                        {[
                          { item: sg.leftItem,  slot: 'L', pageNum: sg.leftPageNum  },
                          { item: sg.rightItem, slot: 'R', pageNum: sg.rightPageNum },
                        ].map(({ item, slot, pageNum }) => (
                          <div
                            key={slot}
                            className={`relative flex items-center gap-1.5 p-1.5 transition-colors group ${
                              item
                                ? 'cursor-pointer hover:bg-warm-50'
                                : 'bg-ink-50 cursor-default opacity-40'
                            }`}
                            onClick={() => item && setSelectedIdx(gallery.indexOf(item))}
                            title={item ? (item.isBlankSlot ? '클릭하여 사진 업로드 또는 텍스트 편집' : '클릭하여 편집') : ''}
                          >
                            <span className="text-[9px] font-bold text-ink-400 w-3 shrink-0">{slot}</span>
                            {item ? (
                              item.previewUrl ? (
                                <img
                                  src={item.previewUrl}
                                  alt=""
                                  className="w-6 h-6 object-cover rounded shrink-0"
                                />
                              ) : (
                                /* 빈 슬롯 — 클릭 가능(편집 패널 열림) */
                                <div className="w-6 h-6 bg-ink-200 rounded flex items-center justify-center shrink-0 border border-dashed border-ink-400">
                                  <span className="text-ink-500 text-[8px]">📄</span>
                                </div>
                              )
                            ) : (
                              <div className="w-6 h-6 border border-dashed border-ink-300 rounded shrink-0 bg-ink-100" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-ink-700 truncate">
                                {item ? (item.isBlankSlot ? `${pageNum}쪽 (빈)` : (item.title || `${pageNum}쪽`)) : `${pageNum}쪽`}
                              </p>
                              <p className="text-[9px] text-ink-400">
                                {item
                                  ? (item.isBlankSlot
                                      ? '✏️ 클릭 편집'
                                      : ((item.text || '').trim() ? '📝' : '🖼️'))
                                  : '—'}
                              </p>
                            </div>
                            {item && (
                              <span className="text-ink-300 opacity-0 group-hover:opacity-100 text-[10px] shrink-0">
                                {item.isBlankSlot ? '➕' : '✏️'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* + 2페이지 추가 버튼 */}
                <button
                  type="button"
                  onClick={addSpread}
                  className="mt-2 w-full py-1.5 rounded-xl text-xs font-medium border border-dashed border-warm-400 text-warm-600 hover:bg-warm-50 transition-all flex items-center justify-center gap-1"
                >
                  <span>＋</span>
                  <span>2페이지(1장) 추가</span>
                </button>
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
                      {/* 이미지 or 빈 슬롯 플레이스홀더 */}
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="w-full h-full object-cover pointer-events-none"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full bg-ink-100 flex flex-col items-center justify-center gap-1 pointer-events-none">
                          <span className="text-2xl text-ink-300">📄</span>
                          <span className="text-[9px] text-ink-400 font-medium">빈 슬롯</span>
                        </div>
                      )}

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

                      {/* 내지 텍스트 유무 (빈 슬롯 제외) */}
                      {item.role === 'content' && !item.isBlankSlot && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5 text-center leading-none">
                          {(item.text || '').trim() ? '📝' : '🖼️'}
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
                    {/* 사진 미리보기 — 빈 슬롯일 때 업로드 유도 플레이스홀더 표시 */}
                    {modalItem.previewUrl ? (
                      <img
                        src={modalItem.previewUrl}
                        alt="미리보기"
                        className="w-full h-44 object-cover rounded-xl"
                      />
                    ) : (
                      <label
                        htmlFor={`blank-slot-upload-${selectedIdx}`}
                        className="w-full h-44 rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 hover:bg-ink-100 hover:border-warm-400 cursor-pointer flex flex-col items-center justify-center gap-2 transition-all"
                      >
                        <input
                          id={`blank-slot-upload-${selectedIdx}`}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleBlankSlotUpload(selectedIdx, f);
                          }}
                        />
                        <span className="text-4xl">📄</span>
                        <p className="text-sm font-medium text-ink-600">빈 슬롯</p>
                        <p className="text-xs text-ink-400 text-center px-4">
                          클릭하여 사진 업로드<br/>
                          <span className="text-[10px]">(업로드 없이도 텍스트 전용 페이지로 저장됩니다)</span>
                        </p>
                      </label>
                    )}

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

                      {/* 스프레드 슬롯 인디케이터 */}
                      {contentIdxOfSelected >= 0 && (
                        <div className="bg-ink-50 rounded-xl p-3 border border-ink-200">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-bold text-ink-700">
                              📄 스프레드 {spreadNumOfSelected} · {isLeftPage ? '왼쪽(L)' : '오른쪽(R)'} 페이지
                            </p>
                            <button
                              type="button"
                              onClick={() => swapSpreadSlot(selectedIdx)}
                              className="text-[11px] text-ink-500 hover:text-warm-700 border border-ink-200 hover:border-warm-400 px-2 py-0.5 rounded-lg transition-all"
                            >
                              ↔ L/R 교체
                            </button>
                          </div>
                          {/* 미니 스프레드 미리보기 */}
                          <div className="flex gap-0.5 h-10 rounded-lg overflow-hidden border border-ink-200">
                            {/* L 슬롯 */}
                            <div className="flex-1 relative overflow-hidden border-r border-ink-200">
                              {(isLeftPage ? modalItem : partnerItem)?.previewUrl ? (
                                <img
                                  src={(isLeftPage ? modalItem : partnerItem).previewUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-ink-100 flex items-center justify-center">
                                  <span className="text-[8px] text-ink-400">빈</span>
                                </div>
                              )}
                              {isLeftPage && (
                                <div className="absolute inset-0 bg-warm-600/40 flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">현재</span>
                                </div>
                              )}
                            </div>
                            {/* R 슬롯 */}
                            <div className="flex-1 relative overflow-hidden">
                              {(!isLeftPage ? modalItem : partnerItem)?.previewUrl ? (
                                <img
                                  src={(!isLeftPage ? modalItem : partnerItem).previewUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-ink-100 flex items-center justify-center">
                                  <span className="text-[8px] text-ink-400">빈</span>
                                </div>
                              )}
                              {!isLeftPage && (
                                <div className="absolute inset-0 bg-warm-600/40 flex items-center justify-center">
                                  <span className="text-white text-[8px] font-bold">현재</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-[9px] text-ink-400 text-center mt-1">← L (왼쪽) | R (오른쪽) →</p>
                        </div>
                      )}

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
                    onClick={() =>
                      modalItem.role === 'content'
                        ? removeSpreadPair(selectedIdx)
                        : removeGalleryItem(selectedIdx)
                    }
                    className="px-4 py-2 rounded-xl text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-all"
                  >
                    {modalItem.role === 'content' ? '스프레드 삭제 (2p)' : '이 사진 삭제'}
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
