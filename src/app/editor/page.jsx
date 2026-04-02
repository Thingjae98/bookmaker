'use client';

// 에디터 페이지 — 포토북 콘텐츠 편집, 갤러리 사진 관리, 표지 지정, Canvas 양면 분할, 책 생성 API 호출
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';
import { toast } from '@/lib/toast';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

// 텍스트 유무에 따른 내지 템플릿 동적 분기
const TEMPLATE_TEXT_IMAGE = 'cnH0Ud1nl1f9'; // 사진+텍스트형
const TEMPLATE_IMAGE_ONLY = '6dJ0Qy6ZmXej'; // 이미지 전용

export default function EditorPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  // ── 페이지 편집 패널 상태 ──────────────────────────────────────
  const [pages, setPages] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookCreated, setBookCreated] = useState(false);
  const [bookUid, setBookUid] = useState(null);
  const [apiLog, setApiLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [stagedFiles, setStagedFiles] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);


  // ── 갤러리 상태 ───────────────────────────────────────────────
  // item shape: { id, file, previewUrl, role: null|'front'|'back'|'content', text: '', isLandscape: false, useSpread: false }
  const [gallery, setGallery] = useState([]);
  const [galleryModal, setGalleryModal] = useState({ open: false, idx: null });
  const [galleryDragIdx, setGalleryDragIdx] = useState(null);
  const [galleryDropActive, setGalleryDropActive] = useState(false);

  // ── 세션 복원 ─────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    setSession(data);

    const aiPages = sessionStorage.getItem('bookmaker_ai_pages');
    if (aiPages) {
      setPages(JSON.parse(aiPages));
      sessionStorage.removeItem('bookmaker_ai_pages');
    } else if (data.useDummy) {
      const dummy = DUMMY_DATA[data.serviceType];
      if (dummy) setPages(dummy.pages.map((p, i) => ({ ...p, id: `page-${i}` })));
    }
  }, [router]);

  const addLog = (msg) => setApiLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg }]);

  // ── 페이지 편집 패널 함수 ──────────────────────────────────────
  const addPage = () => {
    const newPage = { id: `page-${Date.now()}`, title: '', text: '', date: '', image: '' };
    setPages((prev) => [...prev, newPage]);
    setEditingIdx(pages.length);
  };
  const updatePage = (idx, field, value) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };
  const removePage = (idx) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
    else if (editingIdx > idx) setEditingIdx(editingIdx - 1);
  };
  const movePage = (idx, direction) => {
    const next = [...pages];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setPages(next);
    setEditingIdx(target);
  };

  // 페이지 편집 패널 파일 선택
  const handleFileSelect = (file, pageId) => {
    if (!file || !file.type.startsWith('image/')) return;
    const blobUrl = URL.createObjectURL(file);
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx >= 0) updatePage(idx, 'image', blobUrl);
    setStagedFiles((prev) => ({ ...prev, [pageId]: file }));
  };
  const handleDrop = (e, pageId) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files[0], pageId);
  };

  // ── 갤러리 헬퍼 함수 ──────────────────────────────────────────

  // 이미지 가로형 여부 감지 (width > height × 1.6)
  const detectLandscape = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth > img.naturalHeight * 1.6); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      img.src = url;
    });

  // Canvas API: 이미지를 좌/우로 정확히 반분할 → [leftBlob, rightBlob] (최고 화질 JPEG)
  const splitImageHalves = (file) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const halfW = Math.floor(img.naturalWidth / 2);
        const rightW = img.naturalWidth - halfW;
        const h = img.naturalHeight;

        const leftCanvas = document.createElement('canvas');
        leftCanvas.width = halfW; leftCanvas.height = h;
        leftCanvas.getContext('2d').drawImage(img, 0, 0, halfW, h, 0, 0, halfW, h);

        const rightCanvas = document.createElement('canvas');
        rightCanvas.width = rightW; rightCanvas.height = h;
        rightCanvas.getContext('2d').drawImage(img, halfW, 0, rightW, h, 0, 0, rightW, h);

        Promise.all([
          new Promise((res) => leftCanvas.toBlob(res, 'image/jpeg', 1.0)),
          new Promise((res) => rightCanvas.toBlob(res, 'image/jpeg', 1.0)),
        ]).then(([lb, rb]) => resolve([lb, rb])).catch(reject);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });

  // 파일들을 갤러리에 추가 (가로형 여부 자동 감지)
  const handleGalleryUpload = async (files) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    const newItems = await Promise.all(
      arr.map(async (file) => ({
        id: `gallery-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        role: null,
        text: '',
        isLandscape: await detectLandscape(file),
        useSpread: false,
      }))
    );
    setGallery((prev) => [...prev, ...newItems]);
    toast.success(`${arr.length}장이 갤러리에 추가됐습니다`);
  };

  // 갤러리 아이템 업데이트
  const updateGalleryItem = (idx, updates) => {
    setGallery((prev) => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  };

  // 갤러리 아이템 삭제
  const removeGalleryItem = (idx) => {
    setGallery((prev) => {
      const item = prev[idx];
      if (item?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
    if (galleryModal.open && galleryModal.idx === idx) setGalleryModal({ open: false, idx: null });
  };

  // 역할 지정 — 앞표지/뒤표지 중복 시 기존 지정 자동 해제
  const assignGalleryRole = (idx, role) => {
    setGallery((prev) =>
      prev.map((item, i) => {
        if (i === idx) return { ...item, role };
        if (role === 'front' && item.role === 'front') return { ...item, role: null };
        if (role === 'back' && item.role === 'back') return { ...item, role: null };
        return item;
      })
    );
  };

  // 갤러리 드래그 리오더
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
  const handleGalleryDragEnd = () => setGalleryDragIdx(null);

  // 갤러리 드롭 존 (신규 파일 업로드)
  const handleGalleryZoneDrop = (e) => {
    e.preventDefault();
    setGalleryDropActive(false);
    handleGalleryUpload(e.dataTransfer.files);
  };

  // ── 책 생성 API (갤러리 통합) ──────────────────────────────────
  const handleCreateBook = async () => {
    const contentCount = pages.length + gallery.filter((g) => g.role !== 'front' && g.role !== 'back').length;
    if (contentCount < 1) {
      toast.warn('최소 1개 이상의 페이지 또는 갤러리 사진이 필요합니다.');
      return;
    }

    setLoading(true);
    try {
      const coverTplUid = session.coverTemplateUid || 'tpl_F8d15af9fd';
      addLog(`📋 표지 템플릿: ${coverTplUid}`);

      const service = SERVICE_TYPES[session.serviceType];
      const fd = session.formData;
      const name = fd.babyName || fd.childName || fd.heroName || fd.petName || fd.authorName || '';
      const title = name ? `${name}의 ${service.name}` : fd.bookTitle || fd.tripName || service.name;

      // 1. 책 생성
      addLog(`📗 책 생성 중... (${title})`);
      const bookRes = await fetchWithRetry('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, bookSpecUid: session.bookSpecUid, creationType: 'TEST', externalRef: `bookmaker-${Date.now()}` }),
      });
      const bookData = await bookRes.json();
      if (!bookData.success) throw new Error(bookData.message || '책 생성 실패');

      const uid = bookData.data.bookUid;
      setBookUid(uid);
      addLog(`✅ 책 생성 완료: ${uid}`);

      // 1-b. 편집 패널 staged 파일 업로드
      const uploadedUrlMap = {};
      const stagedEntries = Object.entries(stagedFiles);
      if (stagedEntries.length > 0) {
        setUploadingPhoto(true);
        addLog(`📸 편집 패널 사진 ${stagedEntries.length}장 업로드 중...`);
        for (const [pageId, file] of stagedEntries) {
          try {
            const form = new FormData(); form.append('file', file);
            const r = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: form });
            const d = await r.json();
            const url = d.data?.url || d.data?.photoUrl || d.data?.fileUrl;
            if (d.success && url) { uploadedUrlMap[pageId] = url; addLog(`✅ ${file.name}`); }
            else addLog(`⚠️ ${file.name}: ${d.message}`);
          } catch (e) { addLog(`⚠️ 업로드 오류: ${e.message}`); }
        }
        setUploadingPhoto(false);
      }

      // 2. 표지 URL 초기화 (기본값 → 갤러리 지정 순으로 덮어씀)
      let coverFrontUrl = `https://picsum.photos/seed/${session.serviceType}-front/600/600`;
      let coverBackUrl  = `https://picsum.photos/seed/${session.serviceType}-back/600/600`;

      const uploadCover = async (file, label) => {
        const form = new FormData(); form.append('file', file);
        const r = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: form });
        const d = await r.json();
        const url = d.data?.url || d.data?.photoUrl || d.data?.fileUrl;
        if (d.success && url) { addLog(`✅ ${label} 업로드 완료`); return url; }
        addLog(`⚠️ ${label} 업로드 실패: ${d.message}`); return null;
      };

      // 갤러리 표지
      const galleryFront   = gallery.find((g) => g.role === 'front');
      const galleryBack    = gallery.find((g) => g.role === 'back');
      const galleryContent = gallery.filter((g) => g.role !== 'front' && g.role !== 'back');

      if (galleryFront?.file) {
        const url = await uploadCover(galleryFront.file, '앞표지(갤러리)');
        if (url) coverFrontUrl = url;
      }
      if (galleryBack?.file) {
        const url = await uploadCover(galleryBack.file, '뒤표지(갤러리)');
        if (url) coverBackUrl = url;
      }

      // 2-c. 갤러리 내지 사진 업로드 (양면 분할 포함)
      const galleryPageData = [];
      if (galleryContent.length > 0) {
        addLog(`📸 갤러리 내지 ${galleryContent.length}장 처리 중...`);
        for (const item of galleryContent) {
          if (item.useSpread && item.isLandscape && item.file) {
            addLog(`↔️ 양면 분할: ${item.file.name}`);
            try {
              const [leftBlob, rightBlob] = await splitImageHalves(item.file);
              const leftFile  = new File([leftBlob],  'spread-left.jpg',  { type: 'image/jpeg' });
              const rightFile = new File([rightBlob], 'spread-right.jpg', { type: 'image/jpeg' });

              const fL = new FormData(); fL.append('file', leftFile);
              const rL = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: fL });
              const dL = await rL.json();
              const leftUrl = dL.data?.url || dL.data?.photoUrl || dL.data?.fileUrl;

              const fR = new FormData(); fR.append('file', rightFile);
              const rR = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: fR });
              const dR = await rR.json();
              const rightUrl = dR.data?.url || dR.data?.photoUrl || dR.data?.fileUrl;

              galleryPageData.push({ imageUrl: leftUrl,  text: item.text });
              galleryPageData.push({ imageUrl: rightUrl, text: '' });
              addLog(`✅ 양면 분할 완료 → 2페이지 생성`);
            } catch (e) {
              addLog(`⚠️ 양면 분할 실패(${e.message}) — 원본 단일 업로드`);
              if (item.file) {
                const form = new FormData(); form.append('file', item.file);
                const r = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: form });
                const d = await r.json();
                galleryPageData.push({ imageUrl: d.data?.url || d.data?.photoUrl || d.data?.fileUrl, text: item.text });
              }
            }
          } else if (item.file) {
            const form = new FormData(); form.append('file', item.file);
            const r = await fetch(`/api/books/${uid}/photos`, { method: 'POST', body: form });
            const d = await r.json();
            galleryPageData.push({ imageUrl: d.data?.url || d.data?.photoUrl || d.data?.fileUrl, text: item.text });
          }
        }
        addLog(`✅ 갤러리 내지 처리 완료 (→${galleryPageData.length}페이지)`);
      }

      // 3-a. 앞표지 추가
      addLog('🎨 앞표지 추가 중...');
      const dateRange = fd.period || fd.semester
        ? `${fd.year || '2025'}년 ${fd.semester || fd.period || ''}`
        : pages[0]?.date ? `${pages[0].date} ~ ${pages[pages.length - 1]?.date || ''}` : '2025';
      const coverRes = await fetch(`/api/books/${uid}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateUid: coverTplUid, parameters: { coverPhoto: coverFrontUrl, title, dateRange } }),
      });
      const coverData = await coverRes.json();
      addLog(coverData.success ? '✅ 앞표지 추가 완료' : `⚠️ 앞표지: ${coverData.message}`);

      // 3-b. 내지 추가 — 갤러리 내지 + 편집 패널 페이지 통합
      // 텍스트 유무에 따라 템플릿 동적 분기 (cnH0Ud1nl1f9 vs 6dJ0Qy6ZmXej)
      const galleryApiPages = galleryPageData.map((gp, i) => ({
        id: `gallery-api-${i}`, title: '', text: gp.text || '',
        date: new Date().toISOString().slice(0, 10),
        image: gp.imageUrl || '', _fromGallery: true,
      }));

      const combinedPages = [...galleryApiPages, ...pages];
      const pagesForApi = [...combinedPages];
      let repeatIdx = 0;
      const MIN_PAGES = 24;
      while (pagesForApi.length < MIN_PAGES) {
        const src = combinedPages[repeatIdx % Math.max(combinedPages.length, 1)];
        if (!src) break;
        pagesForApi.push({ ...src, id: `repeat-${repeatIdx}`, title: `${src.title || ''} (${Math.floor(repeatIdx / combinedPages.length) + 2}회차)` });
        repeatIdx++;
      }
      if (pagesForApi.length > combinedPages.length)
        addLog(`📋 최소 24p 충족 위해 ${pagesForApi.length - combinedPages.length}페이지 반복 추가`);

      for (let i = 0; i < pagesForApi.length; i++) {
        const page = pagesForApi[i];
        addLog(`📄 페이지 ${i + 1}/${pagesForApi.length}...`);

        const hasText = !!(page.text || page.teacherComment || '').trim();
        const templateUid = hasText ? TEMPLATE_TEXT_IMAGE : TEMPLATE_IMAGE_ONLY;

        const resolvedImage = page._fromGallery
          ? page.image
          : (uploadedUrlMap[page.id] || (page.image?.startsWith('http') ? page.image : null));

        const params = {
          date: page.date || new Date().toISOString().slice(0, 10),
          title: page.title || `페이지 ${i + 1}`,
          diaryText: page.text || page.teacherComment || '',
        };
        if (resolvedImage) params.diaryPhoto = resolvedImage;

        const contentRes = await fetch(`/api/books/${uid}/contents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateUid, parameters: params, breakBefore: 'page' }),
        });
        const contentData = await contentRes.json();
        if (!contentData.success) addLog(`⚠️ 페이지 ${i + 1}: ${contentData.message}`);
      }
      addLog(`✅ 내지 ${pagesForApi.length}페이지 추가 완료`);

      // 3-c. 뒤표지
      addLog('🎨 뒤표지 추가 중...');
      const backCoverRes = await fetch(`/api/books/${uid}/contents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUid: TEMPLATE_IMAGE_ONLY,
          parameters: { date: new Date().toISOString().slice(0, 10), title: '뒤표지', diaryText: '', diaryPhoto: coverBackUrl },
          breakBefore: 'page',
        }),
      });
      const backCoverData = await backCoverRes.json();
      addLog(backCoverData.success ? '✅ 뒤표지 추가 완료' : `⚠️ 뒤표지: ${backCoverData.message}`);

      // 4. 최종화
      addLog('🔒 책 최종화 중...');
      const finalRes = await fetch(`/api/books/${uid}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const finalData = await finalRes.json();

      if (finalData.success) {
        addLog(`✅ 최종화 완료! (${finalData.data?.pageCount || '?'}페이지)`);
        setBookCreated(true);
        toast.success(`책 생성 완료! ${finalData.data?.pageCount || ''}페이지 포토북이 준비됐습니다.`);
        sessionStorage.setItem('bookmaker_session', JSON.stringify({ ...session, bookUid: uid, pageCount: finalData.data?.pageCount }));
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
    }
  };

  if (!session) return <div className="min-h-screen flex items-center justify-center"><div className="spinner text-warm-600" /></div>;

  const service = SERVICE_TYPES[session.serviceType];
  const galleryItem = galleryModal.open ? gallery[galleryModal.idx] : null;
  const modalHasFront = gallery.some((g, i) => g.role === 'front' && i !== galleryModal.idx);
  const modalHasBack  = gallery.some((g, i) => g.role === 'back'  && i !== galleryModal.idx);

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="editor" />

      {/* ── 갤러리 페이지 구성 모달 ── */}
      {galleryModal.open && galleryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-ink-100">
              <h2 className="font-display font-bold text-ink-900">페이지 구성 설정</h2>
              <button onClick={() => setGalleryModal({ open: false, idx: null })} className="p-2 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-ink-50">✕</button>
            </div>

            <div className="px-6 pt-4 pb-1">
              {/* 사진 미리보기 */}
              <img src={galleryItem.previewUrl} alt="미리보기" className="w-full h-44 object-cover rounded-xl" />
              <p className="text-xs text-ink-400 mt-1 text-center truncate">
                {galleryItem.file?.name}
                {galleryItem.isLandscape && <span className="text-sky-500 ml-1">· 가로형 이미지</span>}
              </p>

              {/* 역할 지정 */}
              <div className="mt-4">
                <p className="text-sm font-medium text-ink-800 mb-2">이 사진의 역할</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { role: 'front',   label: '앞표지', icon: '📗', disabled: modalHasFront },
                    { role: 'back',    label: '뒤표지', icon: '📘', disabled: modalHasBack  },
                    { role: 'content', label: '내지',   icon: '📄', disabled: false },
                  ].map(({ role, label, icon, disabled }) => (
                    <button
                      key={role}
                      type="button"
                      disabled={disabled}
                      onClick={() => assignGalleryRole(galleryModal.idx, galleryItem.role === role ? null : role)}
                      className={`py-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                        galleryItem.role === role
                          ? 'border-warm-600 bg-warm-50 text-warm-800'
                          : disabled
                          ? 'border-ink-100 text-ink-300 cursor-not-allowed bg-ink-50'
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

              {/* 내지 텍스트 입력 */}
              {galleryItem.role === 'content' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-ink-800 mb-1">
                    텍스트 입력
                    <span className="ml-1 text-xs font-normal text-ink-400">(선택)</span>
                  </label>
                  <textarea
                    className="input-field min-h-[72px] text-sm"
                    placeholder="이 페이지에 들어갈 텍스트 (비우면 이미지 전용 템플릿 사용)"
                    value={galleryItem.text}
                    onChange={(e) => updateGalleryItem(galleryModal.idx, { text: e.target.value })}
                  />
                  <p className={`text-xs mt-1 ${galleryItem.text.trim() ? 'text-green-600' : 'text-ink-400'}`}>
                    {galleryItem.text.trim()
                      ? '✓ 사진+텍스트 템플릿(cnH0Ud1nl1f9) 적용 예정'
                      : '이미지 전용 템플릿(6dJ0Qy6ZmXej) 적용 예정'}
                  </p>
                </div>
              )}

              {/* 양면(Spread) 분할 옵션 — 가로형 + 내지일 때만 표시 */}
              {galleryItem.isLandscape && galleryItem.role === 'content' && (
                <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={galleryItem.useSpread}
                      onChange={(e) => updateGalleryItem(galleryModal.idx, { useSpread: e.target.checked })}
                      className="mt-0.5 accent-sky-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-sky-900">↔ 양면(2p) 꽉 차게 배치</p>
                      <p className="text-xs text-sky-600 mt-0.5">Canvas API로 좌/우 반분할 → 연속된 2페이지에 펼침(Spread)으로 배치</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-6 py-5 flex gap-2">
              <button
                type="button"
                onClick={() => { removeGalleryItem(galleryModal.idx); }}
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
        <div className="flex items-center justify-between mb-8 opacity-0 animate-fade-up">
          <div>
            <h1 className="font-display font-bold text-2xl text-ink-900 flex items-center gap-2">
              <span>{service.icon}</span>
              콘텐츠 편집
              {session.aiGenerated && <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-normal">✨ AI 생성</span>}
            </h1>
            <p className="text-ink-400 text-sm mt-1">
              {session.aiGenerated
                ? `AI가 생성한 "${session.aiTitle}" · 자유롭게 수정하세요`
                : `페이지를 추가하거나 아래 갤러리에서 사진을 업로드하세요 · 판형: ${BOOK_SPEC_LABELS[session.bookSpecUid] || session.bookSpecUid}`}
            </p>
          </div>
          <button onClick={() => setShowLog(!showLog)} className="btn-secondary text-sm !px-3 !py-2">
            {showLog ? 'API 로그 닫기' : 'API 로그'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 페이지 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-ink-100 p-4 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-ink-900">페이지 목록</h2>
                <span className="text-xs text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">{pages.length}개</span>
              </div>

              {/* 표지 상태 (갤러리 연동 — 읽기 전용) */}
              <div className="mb-3 p-3 bg-ink-50 rounded-xl">
                <p className="text-xs font-bold text-ink-600 mb-2">📖 표지 상태</p>
                <div className="grid grid-cols-2 gap-2">
                  {['front', 'back'].map((type) => {
                    const item = gallery.find((g) => g.role === type);
                    const label = type === 'front' ? '앞표지' : '뒤표지';
                    return (
                      <div key={type} className="text-center">
                        <div className={`w-full h-20 rounded-lg border-2 overflow-hidden flex items-center justify-center ${item ? 'border-warm-400' : 'border-dashed border-ink-200 bg-white'}`}>
                          {item ? (
                            <img src={item.previewUrl} alt={label} className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center text-ink-300">
                              <span className="text-lg">🖼️</span>
                              <span className="text-[10px] mt-0.5">미지정</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-ink-400 mt-1">{label}{item ? ' ✓' : ''}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-ink-400 mt-1.5">갤러리에서 앞표지·뒤표지 역할을 지정하세요</p>
              </div>

              {/* 페이지 목록 */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {pages.map((page, idx) => (
                  <button key={page.id} onClick={() => setEditingIdx(idx)} className={`w-full text-left p-3 rounded-xl text-sm transition-all ${editingIdx === idx ? 'bg-warm-50 border-2 border-warm-600' : 'bg-ink-50 border-2 border-transparent hover:border-ink-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-400 w-5">#{idx + 1}</span>
                      <span className="text-ink-800 truncate flex-1">{page.title || page.date || `페이지 ${idx + 1}`}</span>
                    </div>
                    {page.text && <p className="text-xs text-ink-400 mt-1 ml-7 truncate">{page.text}</p>}
                  </button>
                ))}
                {pages.length === 0 && <p className="text-sm text-ink-400 text-center py-8">아직 페이지가 없습니다</p>}
              </div>

              <button onClick={addPage} className="mt-4 w-full py-2.5 border-2 border-dashed border-ink-200 rounded-xl text-sm text-ink-400 hover:border-warm-600 hover:text-warm-600 transition-colors">
                + 페이지 추가
              </button>
            </div>
          </div>

          {/* 우측: 편집 영역 */}
          <div className="lg:col-span-2 space-y-6">

            {/* ── 사진 갤러리 ── */}
            <div className="bg-white rounded-2xl border border-ink-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display font-bold text-ink-900">📷 사진 갤러리</h2>
                  <p className="text-xs text-ink-400 mt-0.5">사진을 업로드하고 썸네일을 클릭해 앞표지·뒤표지·내지 역할을 지정하세요 · 드래그로 순서 변경 가능</p>
                </div>
                {gallery.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    <span>총 {gallery.length}장</span>
                    {gallery.find((g) => g.role === 'front') && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">앞표지 ✓</span>}
                    {gallery.find((g) => g.role === 'back')  && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">뒤표지 ✓</span>}
                  </div>
                )}
              </div>

              {/* 드래그 앤 드롭 업로드 존 */}
              <div
                onDragOver={(e) => { e.preventDefault(); setGalleryDropActive(true); }}
                onDragLeave={() => setGalleryDropActive(false)}
                onDrop={handleGalleryZoneDrop}
                onClick={() => document.getElementById('gallery-upload-input').click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-5 ${
                  galleryDropActive ? 'border-warm-600 bg-warm-50' : 'border-ink-200 hover:border-warm-400 hover:bg-ink-50'
                }`}
              >
                <input id="gallery-upload-input" type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleGalleryUpload(e.target.files)} />
                <p className="text-2xl mb-2">📸</p>
                <p className="text-sm font-medium text-ink-600">사진을 드래그하거나 클릭하여 업로드</p>
                <p className="text-xs text-ink-400 mt-1">여러 장 동시 선택 가능 · 가로형 이미지는 자동 감지 (↔)</p>
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
                        galleryDragIdx === idx ? 'opacity-40 scale-95 cursor-grabbing' : 'hover:shadow-lg cursor-grab'
                      } ${
                        item.role === 'front'   ? 'border-green-500 ring-2 ring-green-200' :
                        item.role === 'back'    ? 'border-blue-500  ring-2 ring-blue-200'  :
                        item.role === 'content' ? 'border-warm-500  ring-2 ring-warm-200'  :
                        'border-transparent hover:border-ink-300'
                      }`}
                    >
                      <img src={item.previewUrl} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />

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
                        <div className="absolute top-1 right-1 text-[10px] bg-sky-600 text-white px-1.5 py-0.5 rounded-md leading-none">2p</div>
                      )}

                      {/* 가로형 표시 (분할 안 할 때) */}
                      {item.isLandscape && !item.useSpread && (
                        <div className="absolute top-1 right-1 text-[10px] bg-sky-500/80 text-white px-1 py-0.5 rounded leading-none">↔</div>
                      )}

                      {/* 내지 텍스트 유무 */}
                      {item.role === 'content' && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-0.5 text-center leading-none">
                          {item.text.trim() ? '📝' : '🖼️'}
                        </div>
                      )}

                      {/* 호버 오버레이 */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                        <span className="text-white text-lg opacity-0 group-hover:opacity-100 transition-opacity drop-shadow">✏️</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">🖼️</p>
                  <p className="text-sm text-ink-400">사진을 업로드하면 여기에 표시됩니다</p>
                  <p className="text-xs text-ink-300 mt-1">썸네일을 클릭하면 앞표지·뒤표지·내지 역할을 지정할 수 있습니다</p>
                </div>
              )}
            </div>

            {editingIdx !== null && pages[editingIdx] ? (
              <div className="bg-white rounded-2xl border border-ink-100 p-6 opacity-0 animate-fade-in" key={editingIdx} style={{ animationFillMode: 'forwards' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-bold text-lg text-ink-900">페이지 #{editingIdx + 1} 편집</h3>
                  <div className="flex gap-2">
                    <button onClick={() => movePage(editingIdx, -1)} disabled={editingIdx === 0} className="p-2 text-ink-400 hover:text-ink-800 disabled:opacity-30" title="위로">↑</button>
                    <button onClick={() => movePage(editingIdx, 1)} disabled={editingIdx === pages.length - 1} className="p-2 text-ink-400 hover:text-ink-800 disabled:opacity-30" title="아래로">↓</button>
                    <button onClick={() => removePage(editingIdx)} className="p-2 text-red-400 hover:text-red-600" title="삭제">🗑</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-1">날짜</label>
                    <input type="date" className="input-field" value={pages[editingIdx].date || ''} onChange={(e) => updatePage(editingIdx, 'date', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-1">제목</label>
                    <input type="text" className="input-field" placeholder="페이지 제목을 입력하세요" value={pages[editingIdx].title || ''} onChange={(e) => updatePage(editingIdx, 'title', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-1">내용</label>
                    <textarea className="input-field min-h-[120px]" placeholder="페이지에 들어갈 텍스트를 입력하세요" value={pages[editingIdx].text || ''} onChange={(e) => updatePage(editingIdx, 'text', e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-2">사진</label>
                    <div className="relative border-2 border-dashed border-ink-200 rounded-xl p-5 text-center hover:border-warm-400 transition-colors cursor-pointer group" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, pages[editingIdx].id)} onClick={() => document.getElementById(`file-input-${editingIdx}`).click()}>
                      <input id={`file-input-${editingIdx}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files[0], pages[editingIdx].id)} />
                      {pages[editingIdx].image ? (
                        <div className="flex items-center gap-4">
                          <img src={pages[editingIdx].image} alt="미리보기" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                          <div className="text-left flex-1 min-w-0">
                            {stagedFiles[pages[editingIdx].id] ? (
                              <>
                                <p className="text-sm font-medium text-ink-800 truncate">{stagedFiles[pages[editingIdx].id].name}</p>
                                <p className="text-xs text-ink-400 mt-0.5">{(stagedFiles[pages[editingIdx].id].size / 1024).toFixed(0)} KB · 책 생성 시 자동 업로드</p>
                              </>
                            ) : (
                              <p className="text-xs text-ink-400 truncate">{pages[editingIdx].image}</p>
                            )}
                            <button type="button" onClick={(e) => { e.stopPropagation(); updatePage(editingIdx, 'image', ''); setStagedFiles((prev) => { const next = { ...prev }; delete next[pages[editingIdx].id]; return next; }); }} className="mt-1 text-xs text-red-400 hover:text-red-600">삭제</button>
                          </div>
                          <span className="text-xs text-ink-300 group-hover:text-warm-500">클릭하여 변경</span>
                        </div>
                      ) : (
                        <div className="py-2">
                          <p className="text-2xl mb-2">🖼️</p>
                          <p className="text-sm font-medium text-ink-600 group-hover:text-warm-600">클릭하거나 파일을 드래그하세요</p>
                          <p className="text-xs text-ink-400 mt-1">JPG, PNG, WEBP · 최대 10MB</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-ink-400 mb-1">또는 이미지 URL 직접 입력</p>
                      <input type="text" className="input-field text-xs" placeholder="https://example.com/image.jpg" value={pages[editingIdx].image?.startsWith('blob:') ? '' : (pages[editingIdx].image || '')} onChange={(e) => { updatePage(editingIdx, 'image', e.target.value); setStagedFiles((prev) => { const next = { ...prev }; delete next[pages[editingIdx].id]; return next; }); }} />
                    </div>
                  </div>
                  {session.serviceType === 'kindergarten' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-ink-800 mb-1">요일</label>
                        <input type="text" className="input-field" placeholder="월요일" value={pages[editingIdx].dayOfWeek || ''} onChange={(e) => updatePage(editingIdx, 'dayOfWeek', e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-800 mb-1">선생님 코멘트</label>
                        <textarea className="input-field min-h-[80px]" placeholder="선생님의 한마디" value={pages[editingIdx].teacherComment || ''} onChange={(e) => updatePage(editingIdx, 'teacherComment', e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-ink-100 p-12 text-center">
                <p className="text-4xl mb-4">📝</p>
                <p className="text-ink-400">좌측 목록에서 페이지를 선택하거나<br />새 페이지를 추가하세요</p>
              </div>
            )}

            {/* API 로그 */}
            {showLog && (
              <div className="bg-ink-900 rounded-2xl p-6 text-sm font-mono">
                <h3 className="text-warm-200 font-bold mb-3">📋 API 호출 로그</h3>
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {apiLog.length === 0 ? <p className="text-ink-400">아직 API 호출 기록이 없습니다.</p> : apiLog.map((log, i) => (
                    <div key={i} className="text-ink-200"><span className="text-ink-400">[{log.time}]</span> {log.msg}</div>
                  ))}
                </div>
              </div>
            )}

            {/* 하단 책 생성 액션 */}
            <div className="bg-white rounded-2xl border border-ink-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-ink-900">{bookCreated ? '✅ 책이 생성되었습니다!' : '책 생성하기'}</h3>
                  <p className="text-sm text-ink-400 mt-1">
                    {bookCreated
                      ? `BookUID: ${bookUid} — 다음 단계로 진행하세요`
                      : `편집 패널 ${pages.length}페이지 + 갤러리 ${gallery.filter((g) => g.role !== 'front' && g.role !== 'back').length}장`}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href={`/create/${session?.serviceType}`} className="btn-secondary flex-1 text-center">뒤로</Link>
                {!bookCreated ? (
                  <button onClick={handleCreateBook} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? (
                      <><span className="spinner" />{uploadingPhoto ? '사진 업로드 중...' : 'API 호출 중...'}</>
                    ) : (
                      <>📗 책 생성 &amp; 최종화</>
                    )}
                  </button>
                ) : (
                  <button onClick={() => router.push('/preview')} className="btn-primary flex-1">다음: 미리보기 &amp; 주문 →</button>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
