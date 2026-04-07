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

// sessionStorage 자동 저장 키 — 에디터 갤러리 상태 보존
const ARCHIVE_EDITOR_STATE_KEY = 'KIDCANVAS_EDITOR_STATE';

// ─── 검증된 폴백 상수 (SQUAREBOOK_HC 기준) ─────────────────────────
const COVER_TEMPLATE_FALLBACK = '79yjMH3qRPly';
const TPL_WITH_PHOTO_FALLBACK = '3FhSEhJ94c0T';
const TPL_TEXT_ONLY_FALLBACK  = 'vHA59XPPKqak';
// 하위 호환
const COVER_TEMPLATE = COVER_TEMPLATE_FALLBACK;
const TPL_WITH_PHOTO = TPL_WITH_PHOTO_FALLBACK;
const TPL_TEXT_ONLY  = TPL_TEXT_ONLY_FALLBACK;

// ─── API 카테고리(theme 필드) 기반 템플릿 그룹화 ──────────────────────
// SweetBook API 템플릿 응답의 공식 필드만 사용:
//   - theme: API가 제공하는 테마 그룹명 (일기장A, 알림장B, 구글포토북A 등)
//   - templateKind: cover | content | divider | publish
//   - parameters.definitions[key].binding: file | text | rowGallery | collageGallery
// 문자열 파싱(split('_')) 기반 추론은 전면 폐기.

// 서비스 타입 → 추천 카테고리(theme) 매핑
// KidCanvas: 일기장B(동화책 스타일) — 아이 그림 + 스토리텔링 구조에 최적
const SERVICE_CATEGORY_MAP = {
  kidcanvas:    '일기장B',
  // Legacy mappings (하위 호환)
  archive:      '구글포토북A',
  baby:         '일기장A',
  kindergarten: '알림장B',
  fairytale:    '일기장B',
  travel:       '구글포토북A',
  selfpublish:  '구글포토북B',
  pet:          '구글포토북C',
};

// 카테고리(theme)별 한글 라벨
const CATEGORY_LABELS = {
  '일기장A':     '일기장 A',
  '일기장B':     '일기장 B',
  '알림장A':     '알림장 A',
  '알림장B':     '알림장 B',
  '알림장C':     '알림장 C',
  '구글포토북A':  '구글 포토북 A',
  '구글포토북B':  '구글 포토북 B',
  '구글포토북C':  '구글 포토북 C',
  '공용':        '공용',
};

// ── 장식용 파일 바인딩 vs 사용자 사진 바인딩 구분 ──────────────────
// 장식용 파일: lineVertical, pencilIcon, weatherIcon, parentBalloon 등 — 템플릿 내장 에셋
// 사용자 사진: photo, photo1, photos, coverPhoto, collagePhotos 등 — 사용자가 업로드한 이미지
const DECORATIVE_FILE_KEYS = new Set([
  'lineVertical', 'pencilIcon', 'weatherIcon', 'parentBalloon',
  'teacherBalloon', 'heartIcon', 'starIcon', 'lineHorizontal',
  'borderImage', 'backgroundImage', 'watermark', 'logo',
  'pointColor',  // 색상값이지만 file binding으로 정의된 경우 있음
]);
const isDecorativeFile = (key) => DECORATIVE_FILE_KEYS.has(key);

// parameters.definitions에서 사용자 사진(file/gallery) binding 유무로 세부 역할 판별
// 장식용 파일(lineVertical, pencilIcon 등)은 사진으로 간주하지 않음
const hasFileBinding = (t) => {
  const defs = t.parameters?.definitions;
  if (!defs) return false;
  return Object.entries(defs).some(([key, d]) =>
    (d.binding === 'file' && !isDecorativeFile(key)) ||
    d.binding === 'rowGallery' ||
    d.binding === 'collageGallery'
  );
};

// 카테고리 그룹 빌드: API 응답 → { [theme]: { covers[], withPhoto[], textOnly[], blank[], all[] } }
const buildCategoryGroups = (apiTemplates) => {
  const groups = {};

  apiTemplates.forEach((t) => {
    const kind = (t.templateKind || '').toLowerCase();
    // divider / publish 제외 — 책 구조에 직접 사용하지 않음
    if (kind === 'divider' || kind === 'publish') return;

    const cat = t.theme || '공용';  // API theme 필드 사용 (null → 공용)

    if (!groups[cat]) {
      groups[cat] = {
        name:      cat,
        label:     CATEGORY_LABELS[cat] || cat,
        covers:    [],   // templateKind=cover
        withPhoto: [],   // templateKind=content + file binding 있음
        textOnly:  [],   // templateKind=content + file binding 없음
        blank:     [],   // templateKind=content + parameters 자체 없음 (빈 내지)
        all:       [],   // 전체 (cover+content)
      };
    }
    groups[cat].all.push(t);

    if (kind === 'cover') {
      groups[cat].covers.push(t);
    } else {
      // content → parameters 유무로 세부 분류
      const defs = t.parameters?.definitions;
      if (!defs || Object.keys(defs).length === 0) {
        groups[cat].blank.push(t);
      } else if (hasFileBinding(t)) {
        groups[cat].withPhoto.push(t);
      } else {
        groups[cat].textOnly.push(t);
      }
    }
  });

  return groups;
};

// 카테고리 그룹 → handleCreateBook용 tplMap 변환
// { cover, photoText, photoOnly, textOnly, spread, blankPad, source, coverParams, contentParamsMap }
const categoryToTplMap = (catGroup) => {
  if (!catGroup) {
    return {
      cover: COVER_TEMPLATE_FALLBACK,
      photoText: TPL_WITH_PHOTO_FALLBACK,
      photoOnly: TPL_WITH_PHOTO_FALLBACK,
      textOnly:  TPL_TEXT_ONLY_FALLBACK,
      spread:    TPL_WITH_PHOTO_FALLBACK,
      blankPad:  null,  // 패딩 전용 blank 템플릿 (없으면 null → photoText로 대체)
      source:    'fallback',
      coverTpl:  null,
      contentTpls: {},
      tplMeta: {},
    };
  }
  const cover     = catGroup.covers[0]?.templateUid    || COVER_TEMPLATE_FALLBACK;
  const photoText = catGroup.withPhoto[0]?.templateUid || TPL_WITH_PHOTO_FALLBACK;
  // withPhoto에 2번째가 있으면 photoOnly로 사용, 없으면 photoText 공유
  const photoOnly = (catGroup.withPhoto[1] || catGroup.withPhoto[0])?.templateUid || TPL_WITH_PHOTO_FALLBACK;

  // ── 유령 템플릿 완전 퇴마: 현재 카테고리 내 UID만 사용 (글로벌 상수 fallback 절대 금지) ──
  // 타 카테고리 전용 UID(예: 일기장A의 vHA59XPPKqak)가 구글포토북에 혼입되면 400 에러 발생
  const textOnlyRaw = catGroup.textOnly[0]?.templateUid || null;
  const blankTpl    = catGroup.blank[0]?.templateUid    || null;
  // 우선순위: 현재 카테고리 textOnly → blank → photoOnly (절대 글로벌 상수 참조 금지)
  const finalTextOnly = (textOnlyRaw && textOnlyRaw !== photoText)
    ? textOnlyRaw
    : (blankTpl || photoOnly);

  // blankPad: 패딩 전용 — blank 우선, 없으면 photoText (현재 카테고리 내 UID만)
  const blankPad = blankTpl || photoText;

  // ── 카테고리 내 유효 UID 집합 — handleCreateBook에서 교차검증용 ──
  const validUids = new Set(catGroup.all.map((t) => t.templateUid));

  // 개별 템플릿의 parameter definitions + 메타데이터 맵 (UID → definitions)
  // tplMeta: UID → { templateKind, breakBefore } (동적 레이아웃 제어용)
  const contentTpls = {};
  const tplMeta = {};
  catGroup.all.forEach((t) => {
    if (t.parameters?.definitions) {
      contentTpls[t.templateUid] = t.parameters.definitions;
    }
    tplMeta[t.templateUid] = {
      templateKind: t.templateKind || 'content',
      breakBefore:  t.layoutRules?.breakBefore || null, // 템플릿 정의에 명시된 breakBefore
    };
  });

  return {
    cover, photoText, photoOnly, textOnly: finalTextOnly,
    spread: photoOnly,
    blankPad,  // 패딩 페이지 전용: 현재 카테고리 blank[0] 우선, 없으면 photoText
    validUids, // 현재 카테고리의 유효 UID 집합 — 타 카테고리 UID 차단용
    source: 'category:' + catGroup.name,
    coverTpl: catGroup.covers[0] || null,
    contentTpls,
    tplMeta,
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

  // ── 카테고리(Category) state ────────────────────────────────
  const [categoryGroups, setCategoryGroups]     = useState({});    // { theme명: CatGroup }
  const [selectedCategory, setSelectedCategory] = useState(null);  // 현재 선택된 카테고리명

  // ── 갤러리 state ─────────────────────────────────────────────
  // item shape: { id, file, previewUrl, role, title, text, date, templateUid, isLandscape, useSpread, params }
  const [gallery, setGallery]               = useState([]);
  const [selectedIdx, setSelectedIdx]       = useState(null);   // 인라인 편집 패널 대상 인덱스
  const [galleryDragIdx, setGalleryDragIdx] = useState(null);
  const [galleryDropActive, setGalleryDropActive] = useState(false);

  // ── stagedFiles: itemId → File 보조 맵 ──────────────────────
  // gallery state 업데이트와 독립적으로 파일 객체를 보관.
  // gallery.filter/map/splice 등이 새 배열을 만들어도 파일 참조가 끊어지지 않도록 이중 보관.
  // 키: 갤러리 아이템의 고유 id (문자열), 값: File | Blob 객체
  const stagedFilesRef = useRef({});

  // ── 인라인 편집 패널 자동 스크롤 ref ──────────────────────────
  const editPanelRef = useRef(null);

  // ── API 상태 ────────────────────────────────────────────────────
  const [loading, setLoading]           = useState(false);
  const [bookCreated, setBookCreated]   = useState(false);
  const [bookUid, setBookUid]           = useState(null);
  const [apiLog, setApiLog]             = useState([]);
  const [showLog, setShowLog]           = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // ── 세션 복원 + 더미/AI 데이터 → 갤러리로 변환 ──────────────
  useEffect(() => {
    // ── ?isNew=true 감지: URL 파라미터로 "신규 시작"과 "뒤로가기 복원"을 구분 ──
    const urlParams = new URLSearchParams(window.location.search);
    const isNew = urlParams.get('isNew') === 'true';
    if (isNew) {
      // 신규 시작 — 이전 에디터 갤러리 상태 완전 삭제
      try { sessionStorage.removeItem(ARCHIVE_EDITOR_STATE_KEY); } catch (e) {}
      // URL에서 isNew 파라미터 제거 (history 오염 방지)
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('isNew');
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    setSession(data);

    // ── 테마 초기화: allTemplates → 테마 그룹 빌드 + 추천 테마 선택 ──
    // ── 카테고리 초기화: 템플릿 상세 조회 → 카테고리 그룹 빌드 ──
    const allTpls = data.allTemplates || [];
    if (allTpls.length > 0) {
      (async () => {
        try {
          // 각 템플릿의 parameters.definitions를 비동기 상세 조회로 보강
          const detailed = await Promise.all(
            allTpls.map(async (t) => {
              if (t.parameters?.definitions) return t;
              try {
                const res = await fetch(`/api/templates/${t.templateUid}`);
                const d = await res.json();
                const enriched = d?.data || d;
                const params = enriched?.parameters || null;
                if (!params?.definitions) {
                  console.warn(`[템플릿 보강 실패] ${t.templateUid} — definitions 없음`, enriched);
                }
                return { ...t, parameters: params };
              } catch (err) {
                console.warn(`[템플릿 상세 조회 실패] ${t.templateUid}:`, err.message);
                return t;
              }
            })
          );
          const groups = buildCategoryGroups(detailed);
          setCategoryGroups(groups);
          const recommended = SERVICE_CATEGORY_MAP[data.serviceType];
          const catNames = Object.keys(groups);
          const defaultCat = catNames.includes(recommended) ? recommended : (catNames[0] || null);
          setSelectedCategory(defaultCat);
          console.log('[카테고리 초기화]', { 추천: recommended, 선택: defaultCat, 전체: catNames.length, 목록: catNames });

          // ── 템플릿 데이터 구조 디버깅 로그 ──────────────────────
          // 각 카테고리별 템플릿의 parameters/binding 구조를 상세 출력
          Object.entries(groups).forEach(([catName, catGroup]) => {
            console.group(`[템플릿 구조] 카테고리: ${catName} (${catGroup.label})`);
            console.log('요약:', {
              covers: catGroup.covers.length,
              withPhoto: catGroup.withPhoto.length,
              textOnly: catGroup.textOnly.length,
              blank: catGroup.blank.length,
              total: catGroup.all.length,
            });
            // 표지 템플릿 상세
            catGroup.covers.forEach((t) => {
              const defs = t.parameters?.definitions || {};
              const bindings = Object.entries(defs).map(([k, d]) => `${k}:${d.binding}`);
              console.log(`  [cover] ${t.templateUid} | theme=${t.theme} | bindings=[${bindings.join(', ')}]`);
            });
            // 내지(사진+글) 템플릿 상세
            catGroup.withPhoto.forEach((t) => {
              const defs = t.parameters?.definitions || {};
              const bindings = Object.entries(defs).map(([k, d]) => `${k}:${d.binding}`);
              console.log(`  [withPhoto] ${t.templateUid} | theme=${t.theme} | bindings=[${bindings.join(', ')}]`);
            });
            // 내지(텍스트 전용) 템플릿 상세
            catGroup.textOnly.forEach((t) => {
              const defs = t.parameters?.definitions || {};
              const bindings = Object.entries(defs).map(([k, d]) => `${k}:${d.binding}`);
              console.log(`  [textOnly] ${t.templateUid} | theme=${t.theme} | bindings=[${bindings.join(', ')}]`);
            });
            // 빈 내지
            catGroup.blank.forEach((t) => {
              console.log(`  [blank] ${t.templateUid} | theme=${t.theme} | params=${JSON.stringify(t.parameters)}`);
            });
            console.groupEnd();
          });
        } catch (err) {
          console.error('[카테고리 초기화 실패]', err);
          const groups = buildCategoryGroups(allTpls);
          setCategoryGroups(groups);
          setSelectedCategory(Object.keys(groups)[0] || null);
        }
      })();
    }

    // ── 갤러리 초기화 분기: isNew vs 뒤로가기/새로고침 복원 ──
    if (!isNew) {
      // 뒤로가기/새로고침 — 자동 저장된 갤러리 + 카테고리 상태 복원
      try {
        const savedState = sessionStorage.getItem(ARCHIVE_EDITOR_STATE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          const savedGallery = parsed.gallery;
          const savedCategory = parsed.selectedCategory;
          if (savedGallery && savedGallery.length > 0) {
            // File 객체는 직렬화 불가 → null로 복원 (previewUrl은 유지)
            setGallery(savedGallery.map((item) => ({ ...item, file: null })));
            // 저장된 카테고리가 있으면 복원 (카테고리 그룹 로딩 완료 후 덮어쓰기 방지용 ref)
            if (savedCategory) {
              setSelectedCategory(savedCategory);
              prevCategoryRef.current = savedCategory; // 복원 시 카테고리 변경 이벤트 방지
            }
            console.log('[ARCHIVE_EDITOR_STATE 복원]', savedGallery.length, '개 아이템, 카테고리:', savedCategory);
            return; // dummy 데이터 로드 스킵
          }
        }
      } catch (e) {
        console.warn('[ARCHIVE_EDITOR_STATE 복원 실패]', e);
      }
    }

    // isNew=true이거나 저장된 상태가 없으면 → AI/더미 데이터로 초기화 (기존 로직)
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
      // 이미지 URL 판별: http(s) URL, 로컬 경로(/images/...) 모두 허용
      const isValidImageUrl = (url) => url && (url.startsWith('http') || url.startsWith('/'));
      const makePageUrl = (p, fallbackSeed) =>
        (p?.image === null || p?.image === '') ? null
        : (isValidImageUrl(p?.image) ? p.image : `https://picsum.photos/seed/${fallbackSeed}/600/600`);

      // ── 앞표지 (frontCover에서 가져옴 — pages 배열과 무관) ──
      if (frontCoverData) {
        items.push({
          id: `init-front-${ts}`, file: null,
          previewUrl: makePageUrl(frontCoverData, `${data.serviceType}-cover-front`),
          role: 'front', title: frontCoverData.title || '', text: '', date: new Date().toISOString().slice(0, 10),
          templateUid: null, isLandscape: false, useSpread: false, params: {},
        });
      }

      // ── 뒤표지 (backCover에서 가져옴 — pages 배열과 무관) ──
      if (backCoverData) {
        items.push({
          id: `init-back-${ts}`, file: null,
          previewUrl: makePageUrl(backCoverData, `${data.serviceType}-cover-back`),
          role: 'back', title: backCoverData.title || '', text: '', date: new Date().toISOString().slice(0, 10),
          templateUid: null, isLandscape: false, useSpread: false, params: {},
        });
      }

      // ── 내지 24장 (pages 배열 전체 — 표지에 빼앗기지 않음) ──
      const svcKey = data.serviceType || 'kidcanvas';
      initialPages.forEach((p, i) => {
        items.push({
          id:          `init-${i}-${ts}`,
          file:        null,
          previewUrl:  makePageUrl(p, `${svcKey}-${i}`),
          role:        'content',
          title:       p.title || '',
          text:        p.text  || '',
          date:        p.date  || new Date().toISOString().slice(0, 10),
          templateUid: null,
          isLandscape: p.isLandscape || false,
          useSpread:   false,
          params:      {},
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
          params:      {},
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
    params:      {},
  });

  // 스프레드 1장(2페이지) 추가 — pageIncrement: 2 규격 준수
  const addSpread = () => {
    setGallery((prev) => [...prev, makeBlankItem(), makeBlankItem()]);
    toast.success('스프레드 1장(2페이지)이 추가됐습니다');
  };

  // ── AI 자동 구성 (Auto-Compose) ────────────────────────────────
  const [showAutoCompose, setShowAutoCompose] = useState(false);
  const [autoComposePages, setAutoComposePages] = useState(24);

  const handleAutoCompose = () => {
    // 현재 갤러리에서 이미지가 있는 아이템만 수집 (역할 무관)
    const imageItems = gallery.filter(item => item.previewUrl && !item.isBlankSlot);
    if (imageItems.length === 0) {
      toast.error('먼저 사진을 업로드해 주세요');
      return;
    }

    const targetPages = Math.max(24, Math.min(130, autoComposePages));
    // 짝수로 맞추기 (2페이지 단위)
    const adjustedTarget = targetPages % 2 === 0 ? targetPages : targetPages + 1;

    const ts = Date.now();
    const newGallery = [];

    // 1. 앞표지: 첫 번째 이미지
    const frontImg = imageItems[0];
    newGallery.push({
      ...frontImg,
      id: `auto-front-${ts}`,
      role: 'front',
    });

    // 2. 뒤표지: 마지막 이미지 (이미지가 2장 이상일 때)
    const backImg = imageItems.length > 1 ? imageItems[imageItems.length - 1] : null;
    if (backImg) {
      newGallery.push({
        ...backImg,
        id: `auto-back-${ts}`,
        role: 'back',
      });
    }

    // 3. 내지: 나머지 이미지 순서대로 배치
    const contentImages = imageItems.slice(1, backImg ? -1 : undefined);
    contentImages.forEach((img, i) => {
      newGallery.push({
        ...img,
        id: `auto-c${i}-${ts}`,
        role: 'content',
        title: img.title || `Page ${i + 1}`,
      });
    });

    // 4. 부족한 페이지 → 빈 슬롯(text-only)으로 자동 패딩
    const currentContentCount = contentImages.length;
    const neededPadding = adjustedTarget - currentContentCount;
    for (let i = 0; i < neededPadding; i++) {
      newGallery.push({
        ...makeBlankItem(),
        id: `auto-blank-${i}-${ts}`,
      });
    }

    setGallery(newGallery);
    setSelectedIdx(null);
    setShowAutoCompose(false);
    toast.success(`자동 구성 완료: 표지 2장 + 내지 ${Math.max(adjustedTarget, currentContentCount)}장`);
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

  // ── 사진 클릭 시 인라인 편집 패널로 자동 스크롤 ──────────────
  useEffect(() => {
    if (selectedIdx !== null && editPanelRef.current) {
      editPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIdx]);

  // ── 갤러리 자동 저장 (Auto-save to ARCHIVE_EDITOR_STATE) ──────────────────────────
  // File 객체는 직렬화 불가 → 제외, previewUrl/role/text 등 직렬화 가능 필드만 저장
  // selectedCategory도 함께 저장 → 뒤로가기/새로고침 시 카테고리 복원
  const autoSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!session) return; // 세션 로드 전에는 저장 안 함
    if (gallery.length === 0) return; // 빈 갤러리 덮어쓰기 방지
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        const serializable = gallery.map(({ file, ...rest }) => rest); // File 제외
        sessionStorage.setItem(ARCHIVE_EDITOR_STATE_KEY, JSON.stringify({
          gallery: serializable,
          selectedCategory: selectedCategory || null,
        }));
        console.log('[Auto-save] 갤러리 저장:', serializable.length, '개, 카테고리:', selectedCategory);
      } catch (e) {
        console.warn('[Auto-save 실패]', e);
      }
    }, 800);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [gallery, session, selectedCategory]);

  // ── 카테고리 변경 시 갤러리 templateUid 전체 초기화 (유령 템플릿 퇴마) ──
  // 이전 카테고리의 UID가 gallery item에 남아있으면 400 에러 유발 → 완전 교체(Replace)
  const prevCategoryRef = useRef(null);
  useEffect(() => {
    if (!selectedCategory || selectedCategory === prevCategoryRef.current) return;
    if (prevCategoryRef.current !== null) {
      // 카테고리가 실제로 변경된 경우에만 갤러리 templateUid 초기화
      const newCatGroup = categoryGroups[selectedCategory];
      const newValidUids = newCatGroup ? new Set(newCatGroup.all.map((t) => t.templateUid)) : new Set();
      setGallery((prev) =>
        prev.map((item) => {
          // 현재 카테고리에 존재하지 않는 templateUid → null로 초기화
          if (item.templateUid && !newValidUids.has(item.templateUid)) {
            return { ...item, templateUid: null };
          }
          return item;
        })
      );
      console.log(`[카테고리 변경] ${prevCategoryRef.current} → ${selectedCategory} | 유효 UID ${newValidUids.size}개로 갤러리 정리`);
    }
    prevCategoryRef.current = selectedCategory;
  }, [selectedCategory, categoryGroups]);

  // ── 카테고리 스위처 (Category Switcher) ─────────────────────────
  const catNames = useMemo(() => Object.keys(categoryGroups), [categoryGroups]);
  const recommendedCat = session?.serviceType ? SERVICE_CATEGORY_MAP[session.serviceType] : null;
  const activeCatGroup = categoryGroups[selectedCategory] || null;

  // 현재 카테고리의 슬롯 요약
  const activeCatSummary = useMemo(() => {
    if (!activeCatGroup) return null;
    const parts = [];
    if (activeCatGroup.covers.length)    parts.push(`표지 ${activeCatGroup.covers.length}`);
    if (activeCatGroup.withPhoto.length) parts.push(`사진+글 ${activeCatGroup.withPhoto.length}`);
    if (activeCatGroup.textOnly.length)  parts.push(`텍스트 ${activeCatGroup.textOnly.length}`);
    if (activeCatGroup.blank.length)     parts.push(`빈내지 ${activeCatGroup.blank.length}`);
    return parts.join(' · ');
  }, [activeCatGroup]);

  // 카테고리 선택 UI 렌더
  const renderCategorySwitcher = () => {
    if (catNames.length === 0) {
      return (
        <div className="text-center py-4">
          <p className="text-xs text-ink-400">카테고리를 불러오는 중...</p>
        </div>
      );
    }

    return (
      <div>
        <p className="text-xs font-medium text-ink-700 mb-2">
          디자인 카테고리
          <span className="ml-1.5 font-normal text-ink-400">
            ({catNames.length}개 · 표지+내지 일괄 적용)
          </span>
        </p>

        {/* 현재 카테고리 표시 */}
        {activeCatGroup && (
          <div className="flex items-center gap-2 mb-3 bg-warm-50 border border-warm-200 rounded-xl px-3 py-2">
            <span className="text-warm-600 text-sm">🎨</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-warm-800 truncate">
                {activeCatGroup.label}
                {selectedCategory === recommendedCat && (
                  <span className="ml-1.5 text-[10px] font-normal bg-warm-200 text-warm-700 px-1.5 py-0.5 rounded-full">추천</span>
                )}
              </p>
              {activeCatSummary && (
                <p className="text-[11px] text-warm-600 mt-0.5">{activeCatSummary}</p>
              )}
            </div>
            <span className="shrink-0 text-warm-600 font-bold text-sm">적용 중</span>
          </div>
        )}

        {/* 카테고리 카드 그리드 */}
        <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {catNames.map((name) => {
            const cat = categoryGroups[name];
            const isActive = name === selectedCategory;
            const isRec = name === recommendedCat;
            // 대표 썸네일: 표지 템플릿 이미지 우선
            const thumbTpl = cat.covers[0] || cat.all[0];
            const thumbUrl = thumbTpl?.thumbnails?.layout || thumbTpl?.thumbnails?.baseLayerOdd || null;

            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedCategory(name)}
                className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                  isActive
                    ? 'border-warm-600 bg-warm-50 ring-1 ring-warm-300'
                    : 'border-ink-100 hover:border-ink-300 bg-white'
                }`}
              >
                <div className="w-full h-[56px] rounded-lg mb-2 overflow-hidden bg-ink-100 relative">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={cat.label} className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200">
                      <span className="text-ink-400 text-lg">🎨</span>
                    </div>
                  )}
                  {isRec && !isActive && (
                    <span className="absolute top-1 right-1 text-[9px] bg-warm-500 text-white px-1.5 py-0.5 rounded-full font-medium shadow-sm">추천</span>
                  )}
                  {isActive && (
                    <span className="absolute top-1 right-1 text-[9px] bg-warm-600 text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm">✓ 적용</span>
                  )}
                </div>
                <p className={`text-[12px] font-semibold leading-tight truncate ${isActive ? 'text-warm-800' : 'text-ink-700'}`}>
                  {cat.label}
                </p>
                <p className="text-[10px] text-ink-400 mt-0.5">
                  {cat.all.length}개 템플릿
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 페이지별 레이아웃(템플릿) 썸네일 선택 UI ──────────────────
  // 선택된 카테고리 내 content 템플릿들의 썸네일을 보여줌
  const renderLayoutThumbnails = (item, idx) => {
    if (!activeCatGroup) return null;
    // 내지일 때: withPhoto + textOnly + blank 표시
    const isCover = item?.role === 'front' || item?.role === 'back';
    const templates = isCover
      ? activeCatGroup.covers
      : [...activeCatGroup.withPhoto, ...activeCatGroup.textOnly, ...activeCatGroup.blank];

    if (templates.length === 0) return null;

    const currentTplUid = item?.templateUid;

    return (
      <div>
        <p className="text-xs font-medium text-ink-700 mb-2">
          {isCover ? '표지' : '내지'} 레이아웃 선택
          <span className="ml-1.5 font-normal text-ink-400">
            ({activeCatGroup.label} · {templates.length}종)
          </span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {templates.map((tpl) => {
            const thumbUrl = tpl.thumbnails?.layout || tpl.thumbnails?.baseLayerOdd || tpl.thumbnails?.baseLayerEven || null;
            const isActive = currentTplUid === tpl.templateUid;
            // 세부 분류 라벨
            const hasFile = hasFileBinding(tpl);
            const defs = tpl.parameters?.definitions;
            const hasDefs = defs && Object.keys(defs).length > 0;
            const label = isCover ? '표지'
              : !hasDefs ? '빈 내지'
              : hasFile ? '사진+글' : '텍스트';

            return (
              <button
                key={tpl.templateUid}
                type="button"
                onClick={async () => {
                  const updates = { templateUid: tpl.templateUid };
                  // ── 온디맨드 definitions 보강: tpl에 definitions 없으면 즉시 상세 조회 ──
                  let resolvedDefs = tpl.parameters?.definitions;
                  if (!resolvedDefs) {
                    try {
                      const res = await fetch(`/api/templates/${tpl.templateUid}`);
                      const d = await res.json();
                      const enrichedParams = (d?.data || d)?.parameters || null;
                      if (enrichedParams?.definitions) {
                        resolvedDefs = enrichedParams.definitions;
                        // categoryGroups의 원본 템플릿 객체에 definitions 주입 (캐시 역할)
                        tpl.parameters = enrichedParams;
                        console.log(`[온디맨드 보강 성공] ${tpl.templateUid}:`, Object.keys(resolvedDefs));
                      }
                    } catch (err) {
                      console.warn(`[온디맨드 보강 실패] ${tpl.templateUid}:`, err.message);
                    }
                  }
                  // 단일→다중 마이그레이션: 새 템플릿에 갤러리 바인딩이 있고,
                  // 현재 아이템에 단일 사진(previewUrl)은 있지만 images 배열이 없으면
                  // 기존 단일 사진을 images[0]으로 자동 이관
                  const hasGalleryBinding = resolvedDefs && Object.values(resolvedDefs).some(d => d.binding === 'rowGallery' || d.binding === 'collageGallery');
                  const currentItem = gallery[idx];
                  if (hasGalleryBinding && currentItem?.previewUrl && (!currentItem.images || currentItem.images.length === 0)) {
                    updates.images = [{
                      id: `migrated-${Date.now()}`,
                      file: currentItem.file || null,
                      previewUrl: currentItem.previewUrl,
                    }];
                  }
                  updateGalleryItem(idx, updates);
                }}
                className={`rounded-xl border-2 overflow-hidden transition-all ${
                  isActive
                    ? 'border-warm-600 ring-1 ring-warm-300 shadow-sm'
                    : 'border-ink-100 hover:border-ink-300'
                }`}
              >
                <div className="w-full h-16 bg-ink-100 relative overflow-hidden">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt={label} className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ink-100 to-ink-200">
                      <span className="text-ink-400 text-sm">{isCover ? '📔' : hasFile ? '🖼️' : '📝'}</span>
                    </div>
                  )}
                  {isActive && (
                    <span className="absolute top-0.5 right-0.5 text-[8px] bg-warm-600 text-white px-1 py-0.5 rounded-full font-bold">✓</span>
                  )}
                </div>
                <p className="text-[10px] text-center py-1 font-medium text-ink-600 truncate px-1">{label}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // ── 갤러리 바인딩 감지 — 선택된 템플릿의 parameters.definitions에서
  //    binding === 'rowGallery' 또는 'collageGallery'인 파라미터를 핀포인트로 감지 ──
  // 반환: { isGallery: true, key: 'photos', type: 'rowGallery'|'collageGallery', max: number }
  //       또는 null (갤러리 바인딩 없음 = 일반 단일 사진 템플릿)
  const getGalleryBindingInfo = (item) => {
    if (!item) return null;
    const tplUid = item.templateUid;
    if (!tplUid) return null;
    // findDefinitions 다층 탐색 (contentTpls → catGroup.all → 전체 순회)
    const defs = findDefinitions(tplUid);
    if (!defs) return null;
    // definitions 순회 — binding이 rowGallery 또는 collageGallery인 파라미터 키 탐색
    for (const [key, def] of Object.entries(defs)) {
      if (def.binding === 'rowGallery') {
        return { isGallery: true, key, type: 'rowGallery', max: 50 };
      }
      if (def.binding === 'collageGallery') {
        return { isGallery: true, key, type: 'collageGallery', max: 9 };
      }
    }
    return null;
  };

  // ── 템플릿 UID → definitions 탐색 (다층 폴백) ──────────────────
  // contentTpls 맵에 없더라도 catGroup.all에서 직접 찾아보는 안전망
  const findDefinitions = (tplUid) => {
    if (!tplUid) return null;
    // 1순위: contentTpls 맵 (정상 경로)
    if (activeCatGroup) {
      const tplMap = categoryToTplMap(activeCatGroup);
      if (tplMap.contentTpls[tplUid]) return tplMap.contentTpls[tplUid];
      // 2순위: catGroup.all에서 직접 탐색 (비동기 보강 실패 대비)
      const found = activeCatGroup.all?.find((t) => t.templateUid === tplUid);
      if (found?.parameters?.definitions) return found.parameters.definitions;
    }
    // 3순위: 전체 카테고리 그룹 순회
    for (const cat of Object.values(categoryGroups)) {
      const found = cat.all?.find((t) => t.templateUid === tplUid);
      if (found?.parameters?.definitions) return found.parameters.definitions;
    }
    return null;
  };

  // ── 템플릿 definitions에서 텍스트 바인딩 필드 추출 ──────────────
  // file / rowGallery / collageGallery는 별도 UI(사진 업로드/갤러리 트레이)가 있으므로 제외
  const getTextDefinitions = (item) => {
    if (!item) return [];
    const tplUid = item.templateUid;
    if (!tplUid) return [];
    const defs = findDefinitions(tplUid);
    if (!defs) return [];
    return Object.entries(defs)
      .filter(([, def]) => def.binding === 'text')
      .map(([key, def]) => ({ key, ...def }));
  };

  // ── 템플릿 definitions에서 모든 필드(file 포함) 추출 ──────────
  const getAllDefinitions = (tplUid) => {
    const defs = findDefinitions(tplUid);
    return defs ? Object.entries(defs) : [];
  };

  // ── 텍스트 바인딩 키 → 사용자 친화적 라벨 매핑 ──────────────────
  const TEXT_FIELD_LABELS = {
    title:      '작품 제목',
    bookTitle:  '작품집 제목',
    date:       '그린 날짜',
    dateLabel:  '날짜 라벨',
    dayLabel:   '날짜 라벨',
    dayNum:     '일',
    monthNum:   '월',
    month:      '월',
    year:       '연도',
    weather:    '그날의 기분',
    meal:       '사용한 재료',
    memo:       '메모',
    diaryText:  '작품 해설 / 아이의 이야기',
    text:       '텍스트',
    content:    '내용',
    spineTitle: '책등 제목',
    subTitle:   '서브타이틀',
    author:     'Author',
    location:   '프로젝트 환경',
    comment:    '리뷰 코멘트',
    teacherComment: '멘토 / 리드 코멘트',
    description: '설명',
  };

  // 키 이름으로 input type 결정 (긴 텍스트면 textarea)
  const isLongTextField = (key) =>
    ['diaryText', 'text', 'content', 'memo', 'comment', 'teacherComment', 'description'].includes(key);

  // 키 이름으로 date input 결정
  const isDateField = (key) =>
    ['date', 'dateLabel', 'dayLabel'].includes(key);

  // ── AI 텍스트 생성 (Gemini API) ────────────────────────────
  const [aiTextLoading, setAiTextLoading] = useState(null); // 로딩 중인 idx
  const handleGenerateAiText = async (item, idx) => {
    setAiTextLoading(idx);
    try {
      const fd = session?.formData || {};
      const contentItems = gallery.filter(g => g.role === 'content');
      const pageIndex = contentItems.indexOf(item);
      const res = await fetch('/api/generate-page-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle:       fd.bookTitle || '',
          authorName:      fd.authorName || '',
          bookDescription: fd.bookDescription || '',
          techStack:       fd.techStack || '',
          role:            fd.role || '',
          period:          fd.period || '',
          pageTitle:       item.title || '',
          pageIndex:       pageIndex >= 0 ? pageIndex : idx,
          totalPages:      contentItems.length || 24,
        }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        // 레거시 text 필드 + params 동적 필드 동시 업데이트
        const textKey = getTextDefinitions(item).find(d => isLongTextField(d.key))?.key;
        const updates = { text: data.text };
        if (textKey) {
          updates.params = { ...item.params, [textKey]: data.text };
        }
        updateGalleryItem(idx, updates);
        toast.success('AI 텍스트가 생성됐습니다');
      } else {
        toast.error(data.message || 'AI 텍스트 생성 실패');
      }
    } catch (err) {
      console.error('AI 텍스트 생성 오류:', err);
      toast.error('AI 텍스트 생성 중 오류가 발생했습니다');
    } finally {
      setAiTextLoading(null);
    }
  };

  // ── 동적 폼 렌더링 — 선택된 템플릿의 text binding 필드를 자동 입력창으로 변환 ──
  const renderDynamicTextFields = (item, idx) => {
    const textDefs = getTextDefinitions(item);

    // 템플릿이 선택되지 않았거나 text 필드가 없으면 레거시 폴백 (제목/날짜/텍스트)
    if (textDefs.length === 0) {
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">페이지 제목</label>
              <input
                type="text"
                className="input-field text-sm"
                placeholder="예) 첫 미소"
                value={item.title}
                onChange={(e) => updateGalleryItem(idx, { title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-700 mb-1">날짜</label>
              <input
                type="date"
                className="input-field text-sm"
                value={item.date}
                onChange={(e) => updateGalleryItem(idx, { date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-ink-700">텍스트</label>
              <button
                onClick={() => handleGenerateAiText(item, idx)}
                disabled={aiTextLoading === idx}
                className={`text-[10px] font-mono font-medium px-2.5 py-1 rounded transition-all ${
                  aiTextLoading === idx
                    ? 'bg-neutral-400 text-white cursor-wait animate-pulse'
                    : 'bg-neutral-900 text-white hover:bg-neutral-700'
                }`}
              >
                {aiTextLoading === idx ? '생성중...' : 'AI TEXT'}
              </button>
            </div>
            <textarea
              className="input-field min-h-[80px] text-sm"
              placeholder="이 페이지에 들어갈 텍스트를 입력하세요"
              value={item.text}
              onChange={(e) => updateGalleryItem(idx, { text: e.target.value })}
            />
          </div>
        </>
      );
    }

    // ── 동적 폼: definitions의 text binding 필드를 순회하며 입력창 생성 ──
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">
            동적 필드 · {textDefs.length}개
          </span>
        </div>
        {textDefs.map(({ key }) => {
          const label = TEXT_FIELD_LABELS[key] || key;
          // 값 읽기: item.params[key] → 레거시 필드 폴백 (title/text/date)
          const currentVal = item.params?.[key]
            ?? (key === 'title' ? item.title : undefined)
            ?? (key === 'diaryText' || key === 'text' || key === 'content' ? item.text : undefined)
            ?? (key === 'date' || key === 'dateLabel' || key === 'dayLabel' ? item.date : undefined)
            ?? '';

          const handleChange = (val) => {
            // params 객체에 저장 + 레거시 필드 동기화 (handleCreateBook 호환)
            const newParams = { ...item.params, [key]: val };
            const legacyUpdates = {};
            if (key === 'title') legacyUpdates.title = val;
            if (key === 'diaryText' || key === 'text' || key === 'content') legacyUpdates.text = val;
            if (key === 'date' || key === 'dateLabel') legacyUpdates.date = val;
            updateGalleryItem(idx, { params: newParams, ...legacyUpdates });
          };

          if (isDateField(key)) {
            return (
              <div key={key}>
                <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={currentVal}
                  onChange={(e) => handleChange(e.target.value)}
                />
              </div>
            );
          }

          if (isLongTextField(key)) {
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-ink-700">{label}</label>
                  <button
                    onClick={() => handleGenerateAiText(item, idx)}
                    disabled={aiTextLoading === idx}
                    className={`text-[10px] font-mono font-medium px-2.5 py-1 rounded transition-all ${
                      aiTextLoading === idx
                        ? 'bg-neutral-400 text-white cursor-wait animate-pulse'
                        : 'bg-neutral-900 text-white hover:bg-neutral-700'
                    }`}
                  >
                    {aiTextLoading === idx ? '생성중...' : 'AI TEXT'}
                  </button>
                </div>
                <textarea
                  className="input-field min-h-[80px] text-sm"
                  placeholder={`${label}을(를) 입력하세요`}
                  value={currentVal}
                  onChange={(e) => handleChange(e.target.value)}
                />
              </div>
            );
          }

          return (
            <div key={key}>
              <label className="block text-xs font-medium text-ink-700 mb-1">{label}</label>
              <input
                type="text"
                className="input-field text-sm"
                placeholder={`${label}을(를) 입력하세요`}
                value={currentVal}
                onChange={(e) => handleChange(e.target.value)}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // ── 다중 사진 누적 업로드 핸들러 (갤러리 바인딩용) ──────────────
  const handleMultiPhotoAppend = (galleryIdx, files) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;

    const item = gallery[galleryIdx];
    const bindingInfo = getGalleryBindingInfo(item);
    const maxImages = bindingInfo?.max || 50;
    const existing = item.images || [];
    const total = existing.length + arr.length;

    if (total > maxImages) {
      const typeLabel = bindingInfo?.type === 'collageGallery' ? '콜라주 갤러리' : '행 갤러리';
      toast.warn(`${typeLabel} 템플릿은 최대 ${maxImages}장까지 가능합니다. 초과분 ${total - maxImages}장은 제외됩니다.`);
    }

    const newImages = arr.slice(0, Math.max(0, maxImages - existing.length)).map((file) => ({
      id: `mi-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    if (newImages.length === 0) return;

    updateGalleryItem(galleryIdx, {
      images: [...existing, ...newImages],
    });
    toast.success(`${newImages.length}장이 추가됐습니다 (총 ${existing.length + newImages.length}장)`);
  };

  // ── 다중 사진 개별 삭제 핸들러 ──────────────────────────────────
  const handleMultiPhotoRemove = (galleryIdx, imageId) => {
    const item = gallery[galleryIdx];
    if (!item?.images) return;
    const removed = item.images.find((img) => img.id === imageId);
    if (removed?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl);
    updateGalleryItem(galleryIdx, {
      images: item.images.filter((img) => img.id !== imageId),
    });
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
      const service = SERVICE_TYPES[session.serviceType] || SERVICE_TYPES.kidcanvas || Object.values(SERVICE_TYPES)[0];
      if (!service) throw new Error('서비스 타입을 찾을 수 없습니다. 처음부터 다시 시작해 주세요.');
      const fd      = session.formData || {};
      const name    = fd.childName || fd.authorName || fd.babyName || fd.heroName || fd.petName || '';
      const title   = name
        ? `${name}의 ${service.name}`
        : fd.bookTitle || fd.tripName || service.name || 'KidCanvas';

      // bookSpecUid 검증 — API에서 실제로 책 생성 가능한 UID인지 확인 후 보정
      // bs_ 접두사 UID(bs_6a8OUY 등)는 빈 플레이스홀더로 API가 400 반환 — 반드시 내부 키(SQUAREBOOK_HC 등) 사용
      const VALID_SPEC_UIDS = ['SQUAREBOOK_HC', 'PHOTOBOOK_A4_SC', 'PHOTOBOOK_A5_SC'];
      const rawSpecUid  = session?.bookSpecUid;
      const bookSpecUid = VALID_SPEC_UIDS.includes(rawSpecUid) ? rawSpecUid : 'SQUAREBOOK_HC';
      if (bookSpecUid !== rawSpecUid)
        addLog(`⚠️ bookSpecUid 보정: "${rawSpecUid || '(없음)'}" → "${bookSpecUid}"`);
      addLog(`📐 판형: ${BOOK_SPEC_LABELS[bookSpecUid] || bookSpecUid}`);

      // ── 카테고리 기반 템플릿 매핑 ────────────────────────────────────
      // 선택된 카테고리의 templateKind + parameters 기반 UID 매핑
      const tplMap = categoryToTplMap(categoryGroups[selectedCategory] || null);
      addLog(`🎨 카테고리: ${selectedCategory || '(없음)'} (${tplMap.source})`);
      addLog(`   표지: ${tplMap.cover} / 사진+텍스트: ${tplMap.photoText} / 텍스트: ${tplMap.textOnly}`);

      // ── STEP 1: 책 생성 ────────────────────────────────────────
      addLog(`📗 책 생성 중... (${title})`);
      const bookRes  = await fetchWithRetry('/api/books', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, bookSpecUid, creationType: 'TEST', externalRef: `bookmaker-${crypto.randomUUID()}` }),
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
      } else if (frontItem.previewUrl?.startsWith('http') || frontItem.previewUrl?.startsWith('/')) {
        // 로컬 경로(/images/...)는 같은 origin에서 fetch → File로 변환 → 업로드
        if (frontItem.previewUrl.startsWith('/')) {
          try {
            const resp = await fetch(frontItem.previewUrl);
            const blob = await resp.blob();
            const file = new File([blob], 'front-cover.png', { type: blob.type });
            const url = await uploadFile(file, '앞표지(로컬)');
            if (url) coverFrontUrl = url;
          } catch (e) { console.warn('앞표지 로컬 업로드 실패:', e); }
        } else {
          coverFrontUrl = frontItem.previewUrl;
        }
      }
      addLog(`📗 앞표지 URL: ${coverFrontUrl.slice(0, 70)}`);

      // 뒤표지 URL 확보
      let coverBackUrl = `https://picsum.photos/seed/${session.serviceType}-back/600/600`;
      if (backFile) {
        const url = await uploadFile(backFile, '뒤표지');
        if (url) coverBackUrl = url;
      } else if (backItem.previewUrl?.startsWith('http') || backItem.previewUrl?.startsWith('/')) {
        if (backItem.previewUrl.startsWith('/')) {
          try {
            const resp = await fetch(backItem.previewUrl);
            const blob = await resp.blob();
            const file = new File([blob], 'back-cover.png', { type: blob.type });
            const url = await uploadFile(file, '뒤표지(로컬)');
            if (url) coverBackUrl = url;
          } catch (e) { console.warn('뒤표지 로컬 업로드 실패:', e); }
        } else {
          coverBackUrl = backItem.previewUrl;
        }
      }
      addLog(`📘 뒤표지 URL: ${coverBackUrl.slice(0, 70)}`);

      // ── STEP 2-b: 모든 내지 사진 일괄 사전 업로드 ──
      // POST /contents 루프 전에, 모든 로컬 File 객체를 서버에 업로드하여 fileName/URL로 변환
      // 이렇게 하면 POST /contents 시점에는 모든 이미지가 서버 참조 가능한 값이다.
      const svcKey = session.serviceType || 'kidcanvas';

      // 내지별 사전 업로드 결과 맵: ci → string (단일 서버 참조) 또는 string[] (다중 사진)
      const preUploadedImagesMap = {};
      addLog(`📸 내지 ${contentItems.length}장 사진 일괄 사전 업로드 시작...`);

      for (let ci = 0; ci < contentItems.length; ci++) {
        const item = contentItems[ci];
        const fileToUpload = contentFileMap[ci]; // stagedFilesRef 또는 item.file

        // ── Case 1: 다중 사진(item.images) — rowGallery/collageGallery 바인딩용 ──
        if (item.images && item.images.length > 0) {
          const urls = [];
          for (const img of item.images) {
            if (img.file || img instanceof File || img instanceof Blob) {
              const f = img.file || img;
              const url = await uploadFile(f, `내지 ${ci + 1} 갤러리`);
              if (url) urls.push(url);
            } else if (typeof img === 'string' && (img.startsWith('http') || img.startsWith('/'))) {
              // 로컬 경로는 fetch → File → 업로드
              if (img.startsWith('/')) {
                try {
                  const resp = await fetch(img);
                  const blob = await resp.blob();
                  const f = new File([blob], `gallery-${ci}-${urls.length}.png`, { type: blob.type });
                  const url = await uploadFile(f, `내지 ${ci + 1} 갤러리(로컬)`);
                  if (url) urls.push(url);
                } catch (e) { console.warn('갤러리 로컬 업로드 실패:', e); }
              } else {
                urls.push(img);
              }
            } else if (img.previewUrl && (img.previewUrl.startsWith('http') || img.previewUrl.startsWith('/'))) {
              if (img.previewUrl.startsWith('/')) {
                try {
                  const resp = await fetch(img.previewUrl);
                  const blob = await resp.blob();
                  const f = new File([blob], `gallery-${ci}-${urls.length}.png`, { type: blob.type });
                  const url = await uploadFile(f, `내지 ${ci + 1} 갤러리(로컬)`);
                  if (url) urls.push(url);
                } catch (e) { console.warn('갤러리 로컬 업로드 실패:', e); }
              } else {
                urls.push(img.previewUrl);
              }
            }
          }
          if (urls.length > 0) {
            preUploadedImagesMap[ci] = urls;
            addLog(`✅ 내지 ${ci + 1}: 다중 사진 ${urls.length}장 업로드 완료`);
          }
        }
        // ── Case 2: 단일 사진 (File/Blob) — 가장 일반적인 케이스 ──
        else if (fileToUpload) {
          const serverRef = await uploadFile(fileToUpload, `내지 ${ci + 1}`);
          if (serverRef) {
            preUploadedImagesMap[ci] = serverRef;
          } else {
            addLog(`⚠️ 내지 ${ci + 1} 업로드 실패 — picsum fallback 적용`);
            preUploadedImagesMap[ci] = `https://picsum.photos/seed/${svcKey}-c${ci}/600/600`;
          }
        }
        // ── Case 3: 파일 없음 — previewUrl(http 또는 로컬 경로)이 있으면 사용 ──
        else if (item.previewUrl?.startsWith('http') || item.previewUrl?.startsWith('/')) {
          if (item.previewUrl.startsWith('/')) {
            // 로컬 경로: fetch → File → 업로드
            try {
              const resp = await fetch(item.previewUrl);
              const blob = await resp.blob();
              const file = new File([blob], `content-${ci}.png`, { type: blob.type });
              const serverRef = await uploadFile(file, `내지 ${ci + 1}(로컬)`);
              preUploadedImagesMap[ci] = serverRef || `https://picsum.photos/seed/${svcKey}-c${ci}/600/600`;
            } catch (e) {
              console.warn(`내지 ${ci + 1} 로컬 업로드 실패:`, e);
              preUploadedImagesMap[ci] = `https://picsum.photos/seed/${svcKey}-c${ci}/600/600`;
            }
          } else {
            preUploadedImagesMap[ci] = item.previewUrl;
          }
        }
        // ── Case 4: 빈 슬롯이 아닌데 파일도 URL도 없음 → fallback ──
        else if (!item.isBlankSlot) {
          preUploadedImagesMap[ci] = `https://picsum.photos/seed/${svcKey}-c${ci}/600/600`;
        }
        // Case 5: isBlankSlot = true → 맵에 넣지 않음 (TPL_TEXT_ONLY로 처리)
      }

      // ── 사전 업로드 결과 검증 로그 ──
      console.log('[contentFileMap 스냅샷]', contentFileMap);
      console.log('업로드 매핑 결과:', preUploadedImagesMap);
      const mapEntries = Object.entries(preUploadedImagesMap).map(([k, v]) => ({
        index: k,
        type: Array.isArray(v) ? `array[${v.length}]` : typeof v,
        value: Array.isArray(v) ? v.map(u => u?.slice?.(0, 40)).join(', ') : String(v)?.slice(0, 60),
      }));
      try { console.table(mapEntries); } catch(e) { /* 빈 맵 */ }
      addLog(`📸 사전 업로드 완료: ${Object.keys(preUploadedImagesMap).length}/${contentItems.length}장 매핑됨`);

      // ── 내지 contentPageData 조립 — preUploadedImagesMap 참조 (업로드 없음) ──
      const contentPageData = [];
      addLog(`📄 내지 ${contentItems.length}장 처리 중...`);

      for (let ci = 0; ci < contentItems.length; ci++) {
        const item         = contentItems[ci];
        const fileToUpload = contentFileMap[ci];
        const fallbackUrl  = `https://picsum.photos/seed/${svcKey}-c${ci}/600/600`;
        const uploaded     = preUploadedImagesMap[ci]; // 사전 업로드 결과 (string | string[] | undefined)

        if (item.useSpread && item.isLandscape && fileToUpload) {
          // Canvas API 양면 분할 (가로형 사진 → 좌/우 2페이지)
          // 양면 분할은 특수 케이스 — 사전 업로드 결과 대신 직접 분할 후 재업로드
          addLog(`↔️ 양면 분할: 내지 ${ci + 1} (itemId: ${item.id})`);
          try {
            const [lb, rb]  = await splitImageHalves(fileToUpload);
            const leftFile  = new File([lb], 'spread-left.jpg',  { type: 'image/jpeg' });
            const rightFile = new File([rb], 'spread-right.jpg', { type: 'image/jpeg' });
            const leftUrl   = (await uploadFile(leftFile,  `내지 ${ci + 1}-L`)) || fallbackUrl;
            const rightUrl  = (await uploadFile(rightFile, `내지 ${ci + 1}-R`)) || fallbackUrl;
            contentPageData.push({ imageUrl: leftUrl,  text: item.text || '', title: item.title || '', date: item.date || new Date().toISOString().slice(0, 10), isSpreadPage: true, params: item.params || {} });
            contentPageData.push({ imageUrl: rightUrl, text: '',               title: '',               date: item.date || new Date().toISOString().slice(0, 10), isSpreadPage: true, params: {} });
            addLog(`✅ 양면 분할 완료 → 2페이지 (내지 ${ci + 1})`);
          } catch (e) {
            addLog(`⚠️ 양면 분할 실패(${e.message}) — 원본 단일 처리`);
            console.dir({ spreadSplitError: e, ci });
            // 분할 실패 시 사전 업로드 결과 사용
            const singleUrl = (typeof uploaded === 'string' ? uploaded : null) || fallbackUrl;
            contentPageData.push({ imageUrl: singleUrl, text: item.text || '', title: item.title || '', date: item.date || new Date().toISOString().slice(0, 10), params: item.params || {} });
          }
        } else {
          // ── 일반 내지: preUploadedImagesMap에서 서버 참조값 취득 (업로드 없음) ──
          let imgUrl    = null;  // 단일 이미지 서버 참조
          let imagesArr = null;  // 다중 사진 서버 참조 배열

          if (Array.isArray(uploaded)) {
            // 다중 사진 (rowGallery/collageGallery 바인딩용)
            imagesArr = uploaded;
            imgUrl    = uploaded[0] || fallbackUrl; // 대표 이미지는 첫 번째
          } else if (typeof uploaded === 'string') {
            // 단일 사진 (가장 일반적인 케이스)
            imgUrl = uploaded;
          } else if (item.isBlankSlot) {
            // 빈 슬롯 → imgUrl = null 유지 → TPL_TEXT_ONLY로 전송
            imgUrl = null;
          } else {
            // 사전 업로드 맵에도 없고 빈 슬롯도 아님 — fallback
            imgUrl = fallbackUrl;
            addLog(`📎 내지 ${ci + 1}: preUploadedImagesMap 미등록 → picsum fallback`);
          }

          contentPageData.push({
            imageUrl:    imgUrl,
            images:      imagesArr,
            templateUid: item.templateUid || null,
            text:  item.text  || '',
            title: item.title || '',
            date:  item.date  || new Date().toISOString().slice(0, 10),
            params: item.params || {},
          });
        }
      }
      setUploadingPhoto(false);
      addLog(`✅ 내지 처리 완료 — 실제 페이지 ${contentPageData.length}개 (이미지 있음: ${contentPageData.filter(p => p.imageUrl).length}개, 갤러리 있음: ${contentPageData.filter(p => p.images).length}개)`);

      // ── 판형 최소 페이지 충족 — pageMin + pageIncrement 수학적 준수 ──
      const specPageMin       = BOOK_SPECS[bookSpecUid]?.pageMin       || 24;
      const specPageIncrement = BOOK_SPECS[bookSpecUid]?.pageIncrement || 2;
      const rawCount          = Math.max(specPageMin, contentPageData.length);
      const rem               = rawCount % specPageIncrement;
      const targetContentCount = rem === 0 ? rawCount : rawCount + (specPageIncrement - rem);

      console.log('[패딩 전] contentPageData.length:', contentPageData.length, '/ targetContentCount:', targetContentCount);
      addLog(`📊 패딩 전 내지: ${contentPageData.length}장 / 목표: ${targetContentCount}장 (판형 최소 ${specPageMin}p, 증분 ${specPageIncrement}p)`);

      // 패딩 페이지 — picsum fallback URL 사용으로 API 400 방지
      const paddedPages = [...contentPageData];
      while (paddedPages.length < targetContentCount) {
        const pIdx = paddedPages.length;
        // 패딩 페이지는 반드시 이미지 URL 확보 (null 이미지로 API 전송 시 400 위험)
        const padImgUrl = `https://picsum.photos/seed/${session.serviceType || 'kidcanvas'}-pad${pIdx}/600/600`;
        paddedPages.push({
          imageUrl:    padImgUrl,
          text:        '',           // 패딩은 항상 텍스트 없음
          title:       `Page ${pIdx + 1}`,
          date:        new Date().toISOString().slice(0, 10),
          params:      {},
          templateUid: tplMap.blankPad || null,  // 현재 카테고리 blank 템플릿 명시
          isBlankSlot: true,         // 파라미터 없는 blank 처리
        });
      }
      if (paddedPages.length > contentPageData.length) {
        const padded = paddedPages.length - contentPageData.length;
        addLog(`📋 판형 최소 ${specPageMin}p / 증분 ${specPageIncrement}p 충족 — ${padded}p 패딩 추가 (최종 내지 ${paddedPages.length}p)`);
      }

      // ── STEP 3: 앞표지 추가 — parameters.definitions 기반 안전 바인딩 ──
      const coverTplUid = tplMap.cover;
      // templateKind 검증: 표지에 반드시 cover 템플릿만 사용
      const coverTplObj = tplMap.coverTpl;
      if (coverTplObj && coverTplObj.templateKind !== 'cover') {
        addLog(`❌ 표지 templateKind 불일치: ${coverTplObj.templateKind} (cover 필요)`);
      }
      addLog(`🎨 표지 추가 중... (템플릿: ${coverTplUid})`);
      // 표지 파라미터를 definitions 기반으로 빌드
      const coverDefs = tplMap.contentTpls[coverTplUid] || findDefinitions(coverTplUid) || {};
      const dateRange = fd.period || fd.semester
        ? `${fd.year || new Date().getFullYear()}년 ${fd.semester || fd.period}`
        : String(new Date().getFullYear());
      const coverParams = {};
      Object.entries(coverDefs).forEach(([key, def]) => {
        if (def.binding === 'file') {
          // file 바인딩: 사진 URL 매핑 (이름 기반 추론)
          if (key.toLowerCase().includes('front') || key === 'coverPhoto') {
            coverParams[key] = coverFrontUrl;
          } else if (key.toLowerCase().includes('back')) {
            coverParams[key] = coverBackUrl;
          } else {
            coverParams[key] = coverFrontUrl; // 기본: 앞표지 URL
          }
        } else if (def.binding === 'text') {
          // text 바인딩: sessionStorage(Create 페이지) 데이터 자동 매핑
          // spineTitle/bookTitle/title 계열 → 책 제목 자동 바인딩 (사용자 이중 입력 방지)
          const kl = key.toLowerCase();
          if (kl === 'title' || kl === 'spinetitle' || kl === 'booktitle' || kl === 'maintitle') coverParams[key] = title;
          else if (kl === 'daterange' || kl === 'periodtext' || kl === 'period') coverParams[key] = dateRange;
          else if (kl === 'subtitle' || kl === 'subtext') coverParams[key] = fd.subtitle || service.subtitle || '';
          else if (kl === 'childname' || kl === 'authorname' || kl === 'name') coverParams[key] = fd.childName || fd.babyName || fd.authorName || name;
          else if (kl === 'schoolname' || kl === 'classname') coverParams[key] = fd.className || '';
          else if (kl === 'volumelabel' || kl === 'volume') coverParams[key] = fd.semester || fd.period || '';
          else coverParams[key] = title; // 기본 폴백: 책 제목
        }
      });
      // definitions가 비어있으면 레거시 폴백 파라미터 사용
      if (Object.keys(coverParams).length === 0) {
        coverParams.coverPhoto = coverFrontUrl;
        coverParams.backPhoto  = coverBackUrl;
        coverParams.title      = title;
        coverParams.spineTitle = title; // 책등 제목 자동 바인딩
        coverParams.dateRange  = dateRange;
      }
      addLog(`📋 표지 파라미터: ${Object.keys(coverParams).join(', ')}`);

      const coverRes  = await fetch(`/api/books/${uid}/cover`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ templateUid: coverTplUid, parameters: coverParams }),
      });
      const coverData = await coverRes.json();
      if (coverData.success) {
        addLog('✅ 표지 추가 완료');
      } else {
        const coverDetail = coverData.details ? ` / 상세: ${JSON.stringify(coverData.details)}` : '';
        addLog(`⚠️ 표지 실패: ${coverData.message}${coverDetail}`);
      }

      // ── STEP 4: 내지 추가 — parameters.definitions 기반 안전 바인딩 ──
      // 절대 규칙: UI 페이지 1개 = POST /contents 1회 호출 (1:1 매핑)
      // 갤러리 바인딩(rowGallery/collageGallery)은 현재 페이지 스코프 내 사진만 배열로 전달
      console.log('총 전송할 내지 페이지 수:', paddedPages.length);
      addLog(`📄 내지 ${paddedPages.length}페이지 추가 중... (원본 ${contentPageData.length}장 + 패딩 ${paddedPages.length - contentPageData.length}장)`);
      if (paddedPages.length === 0) {
        addLog('❌ 전송할 내지 페이지가 0장입니다 — 최종화가 실패할 수 있습니다.');
        console.error('[handleCreateBook] paddedPages가 비어있음. contentItems:', contentItems.length, 'contentPageData:', contentPageData.length);
      }
      let contentsSuccessCount = 0;

      for (let i = 0; i < paddedPages.length; i++) {
        const page = paddedPages[i];
        const hasImage    = !!(page.imageUrl);
        const hasImages   = !!(page.images && page.images.length > 0); // 다중 사진 배열
        const hasAnyImage = hasImage || hasImages;
        const hasText     = !!(page.text || '').trim();
        // templateKind 검증: 내지에 content 템플릿만 사용
        // 사용자가 에디터에서 직접 선택한 templateUid가 있으면 우선 사용
        // ★ 유령 템플릿 방어: 현재 카테고리 validUids에 없는 UID는 무시
        let tplUid;
        if (page.templateUid && tplMap.validUids?.has(page.templateUid) && tplMap.contentTpls[page.templateUid]) {
          tplUid = page.templateUid;
        } else if (page.isSpreadPage) {
          tplUid = tplMap.spread;
        } else if (hasAnyImage && hasText) {
          tplUid = tplMap.photoText;
        } else if (hasAnyImage && !hasText) {
          tplUid = tplMap.photoOnly;
        } else {
          tplUid = tplMap.textOnly;
        }
        // definitions 기반 파라미터 빌드 — findDefinitions 다층 탐색 + 온디맨드 보강
        let contentDefs = tplMap.contentTpls[tplUid] || findDefinitions(tplUid) || {};
        // 온디맨드 보강: definitions가 여전히 비어있으면 API에서 직접 조회
        if (Object.keys(contentDefs).length === 0 && tplUid) {
          try {
            const tplRes = await fetch(`/api/templates/${tplUid}`);
            const tplData = await tplRes.json();
            const fetchedDefs = (tplData?.data || tplData)?.parameters?.definitions;
            if (fetchedDefs && Object.keys(fetchedDefs).length > 0) {
              contentDefs = fetchedDefs;
              addLog(`🔧 템플릿 ${tplUid} definitions 온디맨드 보강 성공 (${Object.keys(fetchedDefs).length}개 필드)`);
            }
          } catch (e) { /* 무시 — 레거시 폴백 */ }
        }
        const params = {};
        if (Object.keys(contentDefs).length > 0) {
          Object.entries(contentDefs).forEach(([key, def]) => {
            const binding = def?.binding || 'text';
            if (binding === 'file') {
              // ── 장식용 파일(lineVertical, pencilIcon 등)과 사용자 사진 구분 ──
              if (isDecorativeFile(key)) {
                // 장식용 파일: 빈 문자열은 API 400 유발 → 투명 placeholder 이미지 전송
                // SweetBook 엔진이 렌더링 시 해당 요소를 거의 보이지 않게 처리함
                params[key] = `https://picsum.photos/seed/deco-${key}/10/10`;
              } else {
                // 사용자 사진: 사전 업로드된 서버 참조(fileName/URL)만 사용
                // ⚠️ blob: URL이 여기에 들어오면 API 실패 — 반드시 서버 참조값만 전달
                const fileRef = hasImage ? page.imageUrl : null;
                const isSafeRef = fileRef && !String(fileRef).startsWith('blob:');
                params[key] = isSafeRef ? fileRef : `https://picsum.photos/seed/${session.serviceType || 'kidcanvas'}-p${i}/600/600`;
              }
            } else if (binding === 'text') {
              // 1순위: 사용자가 동적 폼에서 직접 입력한 params[key]
              const userVal = page.params?.[key];
              if (userVal !== undefined && userVal !== null && String(userVal).trim() !== '') {
                params[key] = String(userVal);
              }
              // 2순위: 레거시 필드 폴백 + 자동 생성 로직
              else if (key === 'date' || key === 'dayLabel' || key === 'dateLabel') params[key] = page.date || new Date().toISOString().slice(0, 10);
              else if (key === 'monthYearLabel') {
                // 구글포토북A/B 전용 — "2026년 3월" 형식
                const d = new Date(page.date || Date.now());
                params[key] = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
              }
              else if (key === 'title') params[key] = page.title || `Page ${i + 1}`;
              else if (key === 'diaryText' || key === 'text' || key === 'content' || key === 'memo' || key === 'comment' || key === 'teacherComment' || key === 'parentComment' || key === 'description') params[key] = (page.text || '').trim() || ' ';
              else if (key === 'monthNum' || key === 'month') params[key] = String(new Date(page.date || Date.now()).getMonth() + 1);
              else if (key === 'monthNameCapitalized') {
                const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                params[key] = months[new Date(page.date || Date.now()).getMonth()];
              }
              else if (key === 'monthColor' || key === 'pointColor') params[key] = '#000000';
              else if (key === 'dayNum') params[key] = String(new Date(page.date || Date.now()).getDate());
              else if (key === 'dayOfWeek') {
                const days = ['일','월','화','수','목','금','토'];
                params[key] = days[new Date(page.date || Date.now()).getDay()];
              }
              else if (key === 'dayOfWeekX') params[key] = '0';
              else if (key === 'year') params[key] = String(new Date(page.date || Date.now()).getFullYear());
              else if (key === 'bookTitle' || key === 'spineTitle') params[key] = title;
              else if (key === 'author' || key === 'authorName') params[key] = name || ' ';
              else if (key === 'subTitle' || key === 'subtitle') params[key] = fd.bookDescription || service.subtitle || ' ';
              // 알림장 전용 필드 — 기본값 자동 채움
              else if (key === 'weather') params[key] = '☀️';
              else if (key === 'meal') params[key] = ' ';
              else if (key === 'nap') params[key] = ' ';
              else if (key === 'weatherLabelX' || key === 'weatherValueX' || key === 'mealLabelX' || key === 'mealValueX' || key === 'napLabelX' || key === 'napValueX') params[key] = '0';
              // visible 토글 필드 — 기본값 false (숨김)
              else if (key === 'hasParentComment' || key === 'hasTeacherComment' || key === 'hasDayLabel') params[key] = 'false';
              else params[key] = ' '; // required text 필드 빈값 방지 — 절대 undefined 전송 금지
            } else if (binding === 'rowGallery' || binding === 'collageGallery') {
              // 갤러리 바인딩: preUploadedImagesMap에서 전달된 서버 참조 배열만 사용
              // ⚠️ blob: URL 절대 전송 금지 — 모든 값은 서버 fileName 또는 http URL이어야 함
              let images;
              if (page.images && page.images.length > 0) {
                // 사전 업로드 완료된 서버 참조 배열
                // images 원소가 string이면 직접 사용, 객체({previewUrl})이면 URL 추출
                images = page.images
                  .map(u => typeof u === 'string' ? u : u?.previewUrl || u?.url || null)
                  .filter(u => u && typeof u === 'string' && !u.startsWith('blob:'));
              }
              if (!images || images.length === 0) {
                // 폴백: 단일 사진 서버 참조를 배열로 감싸기
                const singleRef = hasImage && !String(page.imageUrl).startsWith('blob:') ? page.imageUrl : null;
                images = singleRef
                  ? [singleRef]
                  : [`https://picsum.photos/seed/${session.serviceType || 'kidcanvas'}-gallery-${i}/600/600`];
              }
              params[key] = images;
              console.log(`[갤러리 바인딩] 페이지 ${i + 1} key=${key} binding=${binding} urls=${images.length}개:`, images);
            } else {
              // 알 수 없는 바인딩 타입 → 빈 문자열로 안전 처리
              params[key] = ' ';
            }
          });
        } else {
          // definitions 없는 템플릿 = 진정한 blank (파라미터 기대하지 않음)
          // ⚠️ 알 수 없는 파라미터를 보내면 API 400 가능 → 빈 객체 전송
          // 단, 온디맨드 보강이 실패한 경우를 위한 최소 안전망
          if (page.isBlankSlot) {
            // 진정한 빈 슬롯 — 파라미터 없이 전송
            console.log(`[빈 슬롯] 페이지 ${i + 1} tpl=${tplUid} — 파라미터 없이 전송`);
          } else {
            // definitions 보강 실패했지만 사용자 데이터가 있는 경우 — 레거시 폴백
            params.date      = page.date  || new Date().toISOString().slice(0, 10);
            params.title     = page.title || `Page ${i + 1}`;
            params.diaryText = (page.text || '').trim() || ' ';
            if (hasImage) {
              const safeRef = !String(page.imageUrl).startsWith('blob:') ? page.imageUrl : null;
              if (safeRef) params.photo1 = safeRef;
            }
            console.log(`[레거시 폴백] 페이지 ${i + 1} tpl=${tplUid} params:`, params);
          }
        }

        // breakBefore 동적 제어: 템플릿 메타데이터 → templateKind 기반 폴백
        // ★ rowGallery/dynamic 템플릿은 'none' 사용 시 페이지 카운트가 예측 불가능해져 finalize 400 유발
        // ★ 안전 기본값: 'page' — 각 content가 독립 페이지로 배치되어 pageCount = 내지 수와 일치
        const meta = tplMap.tplMeta?.[tplUid] || {};
        const resolvedBreakBefore = meta.breakBefore || 'page';

        // 전송 전 진단 로그 (첫 페이지 + 매 5번째 + 마지막)
        if (i === 0 || i % 5 === 0 || i === paddedPages.length - 1) {
          console.log(`[내지 ${i + 1}/${paddedPages.length}] tpl=${tplUid} hasImg=${hasImage} hasText=${hasText} paramKeys=[${Object.keys(params).join(',')}]`);
        }
        // ── CRITICAL: 내지 전송 실패 시 즉시 throw — finalize 진입 차단 ──
        const r = await fetch(`/api/books/${uid}/contents`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ templateUid: tplUid, parameters: params, breakBefore: resolvedBreakBefore }),
        });
        const d = await r.json();
        if (!d.success) {
          const detail = d.details ? JSON.stringify(d.details) : '';
          addLog(`❌ 페이지 ${i + 1} 전송 실패 — 파이프라인 중단: ${d.message} | tpl=${tplUid} | ${detail}`);
          console.dir({ contentsError: d, page, tplUid, params, pageIndex: i });
          throw new Error(`내지 ${i + 1}페이지 전송 실패: ${d.message || 'unknown'}. 최종화를 진행할 수 없습니다.`);
        }
        contentsSuccessCount++;
        if (i === 0 || i % 5 === 0 || i === paddedPages.length - 1) {
          addLog(`✅ 내지 ${i + 1}/${paddedPages.length} 전송 성공`);
        }
      }
      // 모든 내지 전송 성공 (실패 시 위에서 throw됨)
      addLog(`✅ 내지 ${contentsSuccessCount}/${paddedPages.length}페이지 모두 전송 완료`);

      // ── STEP 5: 최종화 ────────────────────────────────────────
      addLog('🔒 최종화 중...');
      const finalRes  = await fetch(`/api/books/${uid}/finalize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      });

      // 응답 HTTP 상태 먼저 로깅 — 4xx/5xx 포함
      if (!finalRes.ok) {
        let errBody = {};
        try { errBody = await finalRes.json(); } catch (e) { errBody = { raw: await finalRes.text().catch(() => '') }; }
        console.error('최종화 실패 상세 사유:', {
          status:    finalRes.status,
          bookUid:   uid,
          pageCount: paddedPages.length,
          body:      errBody,
          // 어떤 파라미터가 문제인지 추적용
          tplMapSnapshot: { ...tplMap },
          bookSpecUid,
        });
        addLog(`❌ 최종화 HTTP ${finalRes.status}: ${errBody?.message || errBody?.error || JSON.stringify(errBody).slice(0, 200)}`);
        if (errBody?.details) addLog(`   상세: ${JSON.stringify(errBody.details).slice(0, 300)}`);
        toast.warn(`최종화 실패 (${finalRes.status}): ${errBody?.message || '응답 확인 필요'}`);
        sessionStorage.setItem('bookmaker_session', JSON.stringify({ ...session, bookUid: uid }));
        return; // catch 없이 early-return — finally에서 로딩 해제
      }

      const finalData = await finalRes.json();

      if (finalData.success) {
        addLog(`✅ 최종화 완료! (${finalData.data?.pageCount || '?'}페이지)`);
        setBookCreated(true);
        toast.success(`책 생성 완료! ${finalData.data?.pageCount || ''}페이지 포토북이 준비됐습니다.`);
        sessionStorage.setItem('bookmaker_session',
          JSON.stringify({ ...session, bookUid: uid, pageCount: finalData.data?.pageCount }));

        // 미리보기 페이지용 스프레드 데이터 저장
        // ⚠️ 핵심: API 전송용 fileName(photo~.PNG)이 아닌, 원본 UI previewUrl을 사용
        // fileName은 SweetBook 내부 참조용이며 브라우저가 직접 렌더링할 수 없음 (404 발생)
        const safePreviewUrl = (apiUrl, uiUrl) => {
          if (!apiUrl) return uiUrl || null;
          // http/https/blob/data 또는 로컬 경로(/) 로 시작하면 브라우저 렌더링 가능
          if (/^(https?:|blob:|data:)/i.test(apiUrl) || apiUrl.startsWith('/')) return apiUrl;
          // 순수 fileName이면 UI 원본 URL로 대체
          return uiUrl || null;
        };

        const previewData = {
          coverFront: { url: safePreviewUrl(coverFrontUrl, frontItem.previewUrl), title },
          coverBack:  { url: safePreviewUrl(coverBackUrl,  backItem.previewUrl),  title: '뒤표지' },
          pages: paddedPages.map((p, idx) => {
            // 원본 갤러리 아이템의 previewUrl 찾기 (패딩 페이지는 원본이 없음)
            const origItem = idx < contentItems.length ? contentItems[idx] : null;
            const uiUrl    = origItem?.previewUrl || null;
            return {
              imageUrl:     safePreviewUrl(p.imageUrl, uiUrl),
              title:        p.title || `페이지 ${idx + 1}`,
              text:         p.text  || '',
              date:         p.date  || '',
              isSpreadPage: p.isSpreadPage || false,
            };
          }),
        };
        sessionStorage.setItem('bookmaker_preview', JSON.stringify(previewData));
      } else {
        // finalRes.ok였지만 success:false인 케이스 (SDK 레벨 오류)
        const finalDetail = finalData.details ? ` | 상세: ${JSON.stringify(finalData.details)}` : '';
        addLog(`❌ 최종화 실패(SDK): ${finalData.message}${finalDetail}`);
        console.error('최종화 실패 상세 사유:', {
          status:    finalRes.status,
          bookUid:   uid,
          pageCount: paddedPages.length,
          body:      finalData,
          tplMapSnapshot: { ...tplMap },
          bookSpecUid,
        });
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
      <div className="min-h-screen pb-20 page-transition">
        <StepIndicator currentStep="editor" />
        <div className="max-w-5xl mx-auto px-6">
          <div className="skeleton-heading mx-auto" style={{ width: '200px' }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton-card" style={{ height: '160px' }} />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <div className="skeleton-text" style={{ width: '80%' }} />
            <div className="skeleton-text" style={{ width: '50%' }} />
          </div>
        </div>
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
    <div className="min-h-screen pb-20 page-transition">
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

              {/* ── 카테고리(테마) 스위처 — 사이드바 최상단 ──────── */}
              {!bookCreated && renderCategorySwitcher()}

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

              {/* AI 자동 구성 버튼 */}
              {gallery.filter(g => g.previewUrl && !g.isBlankSlot).length > 0 && (
                <div className="mb-4">
                  {!showAutoCompose ? (
                    <button
                      onClick={() => setShowAutoCompose(true)}
                      className="w-full py-3 bg-neutral-900 text-white text-sm font-mono font-medium tracking-wider hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>AUTO COMPOSE</span>
                      <span className="text-neutral-400 text-xs">({gallery.filter(g => g.previewUrl && !g.isBlankSlot).length}장)</span>
                    </button>
                  ) : (
                    <div className="border border-neutral-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-mono font-medium text-neutral-900">AUTO COMPOSE</p>
                        <button onClick={() => setShowAutoCompose(false)} className="text-neutral-400 hover:text-neutral-600 text-lg leading-none">&times;</button>
                      </div>
                      <p className="text-xs text-neutral-500">
                        업로드된 {gallery.filter(g => g.previewUrl && !g.isBlankSlot).length}장의 사진을 자동으로 배치합니다.
                        첫 장 → 앞표지, 마지막 → 뒤표지, 나머지 → 내지 순서. 부족분은 빈 페이지로 자동 패딩.
                      </p>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-neutral-600 font-mono whitespace-nowrap">페이지 수</label>
                        <input
                          type="number"
                          min={24}
                          max={130}
                          step={2}
                          value={autoComposePages}
                          onChange={(e) => setAutoComposePages(Number(e.target.value))}
                          className="input-field w-24 text-center text-sm"
                        />
                        <span className="text-xs text-neutral-400">(24~130, 2 단위)</span>
                      </div>
                      <button
                        onClick={handleAutoCompose}
                        className="w-full py-2.5 bg-neutral-900 text-white text-sm font-mono font-medium tracking-wider hover:bg-neutral-800 transition-colors"
                      >
                        COMPOSE ({autoComposePages}p)
                      </button>
                    </div>
                  )}
                </div>
              )}

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

                      {/* 다중 사진 배지 */}
                      {item.images && item.images.length > 0 && (
                        <div className="absolute bottom-5 right-0.5 text-[9px] bg-violet-600 text-white px-1 py-0.5 rounded leading-none font-bold">
                          {item.images.length}장
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

            {/* ── 인라인 편집 패널 (사진 선택 시) 또는 책 생성 액션 (미선택 시) ── */}
            {selectedIdx !== null && modalItem ? (
              /* 인라인 속성 편집 패널 — 모달 대체 */
              <div ref={editPanelRef} className="bg-white rounded-2xl border-2 border-warm-200 shadow-md animate-fade-up">
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
                    {/* 사진 미리보기 — 갤러리 바인딩 여부에 따라 단일/다중 완전 분기 */}
                    {(() => {
                      const gInfo = getGalleryBindingInfo(modalItem);
                      // ── 갤러리 모드: 다중 사진 누적 트레이 ──
                      if (gInfo?.isGallery) {
                        const currentImages = modalItem.images || [];
                        return (
                          <div className="rounded-xl border-2 border-violet-300 bg-violet-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-violet-800">
                                🖼️ {gInfo.type === 'collageGallery' ? '콜라주 갤러리' : '행 갤러리'} 모드
                              </p>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                currentImages.length > 0
                                  ? 'bg-violet-200 text-violet-800'
                                  : 'bg-ink-100 text-ink-400'
                              }`}>
                                {currentImages.length} / {gInfo.max}장
                              </span>
                            </div>
                            <p className="text-[11px] text-violet-600 leading-relaxed">
                              이 템플릿은 한 페이지에 여러 장의 사진을 배치합니다.<br/>
                              사진을 추가하면 기존 사진에 <strong>누적</strong>됩니다.
                            </p>

                            {/* 업로드 버튼 */}
                            {currentImages.length < gInfo.max && (
                              <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-dashed border-violet-300 hover:border-violet-500 hover:bg-violet-100 cursor-pointer transition-all text-sm text-violet-700 font-medium">
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => { handleMultiPhotoAppend(selectedIdx, e.target.files); e.target.value = ''; }}
                                />
                                📸 사진 추가 ({gInfo.max - currentImages.length}장 추가 가능)
                              </label>
                            )}

                            {/* 썸네일 격자 */}
                            {currentImages.length > 0 ? (
                              <div className="grid grid-cols-3 gap-1.5">
                                {currentImages.map((img, imgIdx) => (
                                  <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border border-violet-200 group">
                                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => handleMultiPhotoRemove(selectedIdx, img.id)}
                                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                      title="이 사진 제거"
                                    >✕</button>
                                    <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[8px] text-center py-0.5">
                                      {imgIdx + 1}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <span className="text-3xl">📷</span>
                                <p className="text-[10px] text-violet-400 mt-1">위 버튼을 클릭하여 사진을 추가하세요</p>
                              </div>
                            )}
                          </div>
                        );
                      }
                      // ── 일반 모드: 단일 사진 미리보기 (기존) ──
                      if (modalItem.previewUrl) {
                        return (
                          <img
                            src={modalItem.previewUrl}
                            alt="미리보기"
                            className="w-full h-44 object-cover rounded-xl"
                          />
                        );
                      }
                      // ── 빈 슬롯: 업로드 플레이스홀더 ──
                      return (
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
                      );
                    })()}

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

                    {/* 표지 전용 — 레이아웃 선택 */}
                    {(modalItem.role === 'front' || modalItem.role === 'back') && renderLayoutThumbnails(modalItem, selectedIdx)}
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

                      {/* 동적 텍스트 입력 필드 — 선택된 템플릿의 definitions 기반 자동 생성 */}
                      {renderDynamicTextFields(modalItem, selectedIdx)}

                      {/* 세부 레이아웃(템플릿) 선택 */}
                      {renderLayoutThumbnails(modalItem, selectedIdx)}

                      {/* 양면(Spread) 분할 옵션 — 갤러리 모드가 아닌 단일 사진일 때만 표시 */}
                      {modalItem.isLandscape && !getGalleryBindingInfo(modalItem)?.isGallery && (
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
              <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-6">

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

        {/* ── API 로그 — 레이아웃 하단 고정 ──────────────────── */}
        {showLog && (
          <div className="mt-6 bg-ink-900 rounded-2xl p-6 text-sm font-mono">
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
      </div>
    </div>
  );
}
