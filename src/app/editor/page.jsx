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

// ─── 유효성 임계값 ─────────────────────────────────────────────
const MIN_CONTENT = 8;   // [최종 생성] 버튼 활성화 최소 내지 수 (UI)

export default function EditorPage() {
  const router = useRouter();
  const [session, setSession]       = useState(null);

  // ── 갤러리 state ─────────────────────────────────────────────
  // item shape: { id, file, previewUrl, role, title, text, date, templateUid, isLandscape, useSpread }
  const [gallery, setGallery]               = useState([]);
  const [galleryModal, setGalleryModal]     = useState({ open: false, idx: null });
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
    if (galleryModal.open && galleryModal.idx === idx)
      setGalleryModal({ open: false, idx: null });
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
  const frontItems   = useMemo(() => gallery.filter((g) => g.role === 'front'),   [gallery]);
  const backItems    = useMemo(() => gallery.filter((g) => g.role === 'back'),    [gallery]);
  const contentItems = useMemo(() => gallery.filter((g) => g.role === 'content'), [gallery]);
  const isReady      = frontItems.length === 1 && backItems.length === 1 && contentItems.length >= MIN_CONTENT;

  // 세션에서 내지용 템플릿 목록 추출 (templateKind가 content/page 포함)
  const contentTemplates = useMemo(() => {
    const all = session?.allTemplates || [];
    const filtered = all.filter((t) => {
      const kind = (t.templateKind || t.category || '').toLowerCase();
      return kind.includes('content') || kind.includes('page');
    });
    return filtered;
  }, [session]);

  // ── 책 생성 API — 선 구성 후 순차 처리 (트랜잭션 방식) ───────
  const handleCreateBook = async () => {
    if (!isReady) {
      toast.warn(`앞표지·뒤표지 각 1장, 내지 ${MIN_CONTENT}장 이상이 필요합니다.`);
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
        const uploadDetail = d.details ? ` | ${JSON.stringify(d.details)}` : '';
        addLog(`⚠️ ${label} 실패: ${d.message}${uploadDetail}`);
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
      // SweetBook 총 페이지 = 앞표지(1) + contentInserts + 뒤표지(1) = contentInserts + 2
      // 따라서 contentInserts 개수 = targetTotal - 2
      const specPageMin       = BOOK_SPECS[bookSpecUid]?.pageMin       || 24;
      const specPageIncrement = BOOK_SPECS[bookSpecUid]?.pageIncrement || 2;
      const rawTotal          = Math.max(specPageMin, contentPageData.length + 2);
      const rem               = rawTotal % specPageIncrement;
      const targetTotal       = rem === 0 ? rawTotal : rawTotal + (specPageIncrement - rem);
      const targetContentCount = targetTotal - 2;

      const paddedPages = [...contentPageData];
      let ri = 0;
      while (paddedPages.length < targetContentCount) {
        paddedPages.push({ ...contentPageData[ri % contentPageData.length] });
        ri++;
      }
      if (paddedPages.length > contentPageData.length)
        addLog(`📋 판형 최소 ${specPageMin}p / 증분 ${specPageIncrement}p 충족 위해 ${paddedPages.length - contentPageData.length}페이지 패딩 (총 ${targetTotal}p)`);

      // ── STEP 3: 앞표지 추가 ────────────────────────────────────
      // session.coverTemplateUid는 사용하지 않음 — 검증된 상수 COVER_TEMPLATE 고정 사용
      // (session에 저장된 templateUid가 잘못된 UID일 경우 400 에러의 원인이 됨)
      const coverTplUid = dynamicCoverTpl;
      addLog(`🎨 앞표지 추가 중... (템플릿: ${coverTplUid})`);
      const dateRange = fd.period || fd.semester
        ? `${fd.year || new Date().getFullYear()}년 ${fd.semester || fd.period}`
        : String(new Date().getFullYear());
      const coverRes  = await fetch(`/api/books/${uid}/cover`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ templateUid: coverTplUid, parameters: { coverPhoto: coverFrontUrl, title, dateRange } }),
      });
      const coverData = await coverRes.json();
      if (coverData.success) {
        addLog('✅ 앞표지 추가 완료');
      } else {
        const coverDetail = coverData.details ? ` | ${JSON.stringify(coverData.details)}` : '';
        addLog(`⚠️ 앞표지 실패: ${coverData.message}${coverDetail}`);
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
          const detail = d.details ? ` | ${JSON.stringify(d.details)}` : '';
          addLog(`⚠️ 페이지 ${i + 1} 실패: ${d.message}${detail}`);
        } else if (i % 5 === 0 || i === paddedPages.length - 1)
          addLog(`📄 내지 ${i + 1}/${paddedPages.length}`);
      }
      addLog(`✅ 내지 ${paddedPages.length}페이지 완료`);

      // ── STEP 4-b: 뒤표지 (마지막 contents 페이지) ────────────
      addLog('🎨 뒤표지 추가 중...');
      const backRes  = await fetch(`/api/books/${uid}/contents`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          templateUid:  dynamicImageOnly,
          parameters:   { date: new Date().toISOString().slice(0, 10), title: '뒤표지', diaryText: '', photo1: coverBackUrl },
          breakBefore:  'page',
        }),
      });
      const backData = await backRes.json();
      if (backData.success) {
        addLog('✅ 뒤표지 추가 완료');
      } else {
        const backDetail = backData.details ? ` | ${JSON.stringify(backData.details)}` : '';
        addLog(`⚠️ 뒤표지 실패: ${backData.message}${backDetail}`);
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

  const service     = SERVICE_TYPES[session.serviceType];
  const modalItem   = galleryModal.open ? gallery[galleryModal.idx] : null;
  const hasFrontElse = gallery.some((g, i) => g.role === 'front' && i !== galleryModal.idx);
  const hasBackElse  = gallery.some((g, i) => g.role === 'back'  && i !== galleryModal.idx);

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="editor" />

      {/* ── 갤러리 모달 ─────────────────────────────────────────── */}
      {galleryModal.open && modalItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setGalleryModal({ open: false, idx: null })}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-ink-100">
              <h2 className="font-display font-bold text-ink-900">페이지 구성 설정</h2>
              <button
                onClick={() => setGalleryModal({ open: false, idx: null })}
                className="p-2 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-ink-50"
              >✕</button>
            </div>

            <div className="px-6 pt-4 pb-2 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* 미리보기 */}
              <img
                src={modalItem.previewUrl}
                alt="미리보기"
                className="w-full h-44 object-cover rounded-xl"
              />

              {/* 역할 지정 */}
              <div>
                <p className="text-sm font-bold text-ink-800 mb-2">이 사진의 역할</p>
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
                      onClick={() =>
                        assignGalleryRole(
                          galleryModal.idx,
                          modalItem.role === role ? null : role
                        )
                      }
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

              {/* 내지 전용 — 제목·날짜·텍스트 입력 */}
              {modalItem.role === 'content' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">페이지 제목</label>
                      <input
                        type="text"
                        className="input-field text-sm"
                        placeholder="예) 첫 미소"
                        value={modalItem.title}
                        onChange={(e) =>
                          updateGalleryItem(galleryModal.idx, { title: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">날짜</label>
                      <input
                        type="date"
                        className="input-field text-sm"
                        value={modalItem.date}
                        onChange={(e) =>
                          updateGalleryItem(galleryModal.idx, { date: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink-700 mb-1">
                      텍스트
                      <span className="ml-1 font-normal text-ink-400">(선택 — 입력 시 텍스트+사진 템플릿 적용)</span>
                    </label>
                    <textarea
                      className="input-field min-h-[72px] text-sm"
                      placeholder="이 페이지에 들어갈 텍스트를 입력하세요"
                      value={modalItem.text}
                      onChange={(e) =>
                        updateGalleryItem(galleryModal.idx, { text: e.target.value })
                      }
                    />
                    <p className={`text-xs mt-1 ${modalItem.text.trim() ? 'text-green-600' : 'text-ink-400'}`}>
                      {modalItem.text.trim()
                        ? `✓ 사진+텍스트 템플릿 적용 예정`
                        : '이미지 전용 템플릿 적용 예정'}
                    </p>
                  </div>

                  {/* 템플릿 선택 (session.allTemplates에서 내지용 필터) */}
                  {contentTemplates.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-ink-700 mb-1">
                        내지 템플릿
                        <span className="ml-1 font-normal text-ink-400">(선택하지 않으면 텍스트 유무로 자동 결정)</span>
                      </label>
                      <select
                        className="input-field text-sm"
                        value={modalItem.templateUid || ''}
                        onChange={(e) =>
                          updateGalleryItem(galleryModal.idx, { templateUid: e.target.value || null })
                        }
                      >
                        <option value="">자동 (텍스트 유무 기반)</option>
                        <option value={TPL_IMAGE_ONLY}>이미지 전용 (6dJ0Qy6ZmXej)</option>
                        <option value={TPL_TEXT_IMAGE}>텍스트+사진 (cnH0Ud1nl1f9)</option>
                        {contentTemplates.map((t) => (
                          <option key={t.templateUid} value={t.templateUid}>
                            {t.name || t.templateUid}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 양면(Spread) 분할 옵션 */}
                  {modalItem.isLandscape && (
                    <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modalItem.useSpread}
                          onChange={(e) =>
                            updateGalleryItem(galleryModal.idx, { useSpread: e.target.checked })
                          }
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
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-6 py-4 flex gap-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => removeGalleryItem(galleryModal.idx)}
                className="px-4 py-2 rounded-xl text-sm text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-all"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={() => setGalleryModal({ open: false, idx: null })}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-warm-600 hover:bg-warm-800 transition-all"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

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

              {/* 앞표지 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-ink-500">앞표지</p>
                  {frontItems.length === 1
                    ? <span className="text-xs text-green-600 font-medium">✓ 지정됨</span>
                    : <span className="text-xs text-red-500">필수</span>}
                </div>
                {frontItems[0] ? (
                  <div
                    className="relative h-20 rounded-xl overflow-hidden border-2 border-green-400 cursor-pointer"
                    onClick={() =>
                      setGalleryModal({ open: true, idx: gallery.indexOf(frontItems[0]) })
                    }
                  >
                    <img src={frontItems[0].previewUrl} alt="앞표지" className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-md">앞표지</div>
                  </div>
                ) : (
                  <div className="h-20 border-2 border-dashed border-red-300 rounded-xl flex items-center justify-center bg-red-50">
                    <p className="text-xs text-red-400">갤러리에서 지정 필요</p>
                  </div>
                )}
              </div>

              {/* 내지 목록 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-ink-500">내지</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    contentItems.length >= MIN_CONTENT
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {contentItems.length}/{MIN_CONTENT}장
                  </span>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {contentItems.map((item, i) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 p-2 bg-ink-50 rounded-lg cursor-pointer hover:bg-warm-50 transition-colors group"
                      onClick={() =>
                        setGalleryModal({ open: true, idx: gallery.indexOf(item) })
                      }
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

              {/* 뒤표지 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-ink-500">뒤표지</p>
                  {backItems.length === 1
                    ? <span className="text-xs text-green-600 font-medium">✓ 지정됨</span>
                    : <span className="text-xs text-red-500">필수</span>}
                </div>
                {backItems[0] ? (
                  <div
                    className="relative h-20 rounded-xl overflow-hidden border-2 border-blue-400 cursor-pointer"
                    onClick={() =>
                      setGalleryModal({ open: true, idx: gallery.indexOf(backItems[0]) })
                    }
                  >
                    <img src={backItems[0].previewUrl} alt="뒤표지" className="w-full h-full object-cover" />
                    <div className="absolute top-1 left-1 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-md">뒤표지</div>
                  </div>
                ) : (
                  <div className="h-20 border-2 border-dashed border-red-300 rounded-xl flex items-center justify-center bg-red-50">
                    <p className="text-xs text-red-400">갤러리에서 지정 필요</p>
                  </div>
                )}
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
                    {frontItems.length !== 1 && <li>• 앞표지 1장 지정 필요</li>}
                    {backItems.length !== 1  && <li>• 뒤표지 1장 지정 필요</li>}
                    {contentItems.length < MIN_CONTENT && (
                      <li>• 내지 {MIN_CONTENT - contentItems.length}장 더 필요</li>
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
                        contentItems.length >= MIN_CONTENT
                          ? 'bg-warm-100 text-warm-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        내지 {contentItems.length}장
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
                      onClick={() => setGalleryModal({ open: true, idx })}
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

            {/* 책 생성 액션 */}
            <div className="bg-white rounded-2xl border border-ink-100 p-6">
              <div className="mb-4">
                <h3 className="font-display font-bold text-ink-900">
                  {bookCreated ? '✅ 책이 생성되었습니다!' : '최종 생성 및 주문'}
                </h3>
                <p className="text-sm text-ink-400 mt-1">
                  {bookCreated
                    ? `BookUID: ${bookUid} — 아래 버튼으로 다음 단계로 이동하세요`
                    : isReady
                    ? `앞표지 1장 · 내지 ${contentItems.length}장 · 뒤표지 1장 — 구성 완료`
                    : `앞표지·뒤표지 각 1장, 내지 ${MIN_CONTENT}장 이상 지정 후 생성 가능`}
                </p>
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

          </div>
        </div>
      </div>
    </div>
  );
}
