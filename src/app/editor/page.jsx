'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';

export default function EditorPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [pages, setPages] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookCreated, setBookCreated] = useState(false);
  const [bookUid, setBookUid] = useState(null);
  const [apiLog, setApiLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [stagedFiles, setStagedFiles] = useState({}); // { pageId: File } — 업로드 대기 파일
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // AI 초안 생성 모달 (입력 폼)
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiFormData, setAiFormData] = useState({});
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

  // AI 초안 미리보기 모달
  const [draftData, setDraftData] = useState(null);       // 생성된 초안 임시 저장
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // 세션 복원
  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    setSession(data);

    // 페이지 초기화 우선순위: AI 생성 > 더미 데이터
    const aiPages = sessionStorage.getItem('bookmaker_ai_pages');
    if (aiPages) {
      setPages(JSON.parse(aiPages));
      sessionStorage.removeItem('bookmaker_ai_pages'); // 1회 사용 후 삭제
    } else if (data.useDummy) {
      const dummy = DUMMY_DATA[data.serviceType];
      if (dummy) {
        setPages(dummy.pages.map((p, i) => ({ ...p, id: `page-${i}` })));
      }
    }
  }, [router]);

  const addLog = (msg) => {
    setApiLog((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
  };

  // 페이지 추가
  const addPage = () => {
    const newPage = {
      id: `page-${Date.now()}`,
      title: '',
      text: '',
      date: '',
      image: '',
    };
    setPages((prev) => [...prev, newPage]);
    setEditingIdx(pages.length);
  };

  // 페이지 수정
  const updatePage = (idx, field, value) => {
    setPages((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  // 페이지 삭제
  const removePage = (idx) => {
    setPages((prev) => prev.filter((_, i) => i !== idx));
    if (editingIdx === idx) setEditingIdx(null);
    else if (editingIdx > idx) setEditingIdx(editingIdx - 1);
  };

  // 파일 선택 → blob URL 즉시 미리보기, 파일은 staged 보관
  const handleFileSelect = (file, pageId) => {
    if (!file || !file.type.startsWith('image/')) return;
    const blobUrl = URL.createObjectURL(file);
    const idx = pages.findIndex((p) => p.id === pageId);
    if (idx >= 0) updatePage(idx, 'image', blobUrl);
    setStagedFiles((prev) => ({ ...prev, [pageId]: file }));
  };

  // 드래그 앤 드롭 핸들러
  const handleDrop = (e, pageId) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file, pageId);
  };

  // ── AI 초안 생성 ─────────────────────────────────────────────

  // 서비스별 AI 입력 폼 필드 정의
  const AI_FORM_FIELDS = {
    baby: [
      { key: 'babyName', label: '아이 이름', type: 'text', placeholder: '예) 하은이', required: true },
      { key: 'period', label: '기록 기간', type: 'select', options: ['1개월', '3개월', '6개월', '1년'], required: true },
      { key: 'message', label: '아이에게 전하는 한마디', type: 'text', placeholder: '예) 사랑해, 우리 아가', required: false },
    ],
    kindergarten: [
      { key: 'childName', label: '원아 이름', type: 'text', placeholder: '예) 김서준', required: true },
      { key: 'className', label: '반 이름', type: 'text', placeholder: '예) 해바라기반', required: false },
      { key: 'semester', label: '학기', type: 'select', options: ['1학기', '2학기', '전체'], required: true },
    ],
    fairytale: [
      { key: 'heroName', label: '주인공 이름', type: 'text', placeholder: '예) 하은이', required: true },
      { key: 'heroAge', label: '주인공 나이', type: 'select', options: ['3살', '4살', '5살', '6살', '7살', '8살'], required: false },
      { key: 'theme', label: '동화 주제', type: 'text', placeholder: '예) 숲속 친구들과의 모험', required: true },
      { key: 'moralLesson', label: '담을 교훈', type: 'text', placeholder: '예) 용기와 우정', required: false },
    ],
    travel: [
      { key: 'destination', label: '여행지', type: 'text', placeholder: '예) 제주도', required: true },
      { key: 'tripName', label: '여행 제목', type: 'text', placeholder: '예) 2025 가족 제주 여행', required: false },
      { key: 'companions', label: '동행인', type: 'text', placeholder: '예) 가족 3명', required: false },
    ],
    selfpublish: [
      { key: 'bookTitle', label: '책 제목', type: 'text', placeholder: '예) 나의 첫 에세이', required: true },
      { key: 'genre', label: '장르', type: 'select', options: ['에세이', '시집', '사진집', '일러스트집', '기타'], required: true },
      { key: 'bookDescription', label: '책 소개 (선택)', type: 'text', placeholder: '어떤 이야기를 담을지 간략히', required: false },
    ],
    pet: [
      { key: 'petName', label: '반려동물 이름', type: 'text', placeholder: '예) 뽀삐', required: true },
      { key: 'petType', label: '종류', type: 'select', options: ['강아지', '고양이', '토끼', '햄스터', '기타'], required: true },
      { key: 'ownerMessage', label: '우리 아이에게 한마디', type: 'text', placeholder: '예) 언제나 사랑해!', required: false },
    ],
  };

  const handleAiGenerate = async () => {
    if (!session) return;
    const fields = AI_FORM_FIELDS[session.serviceType] || [];
    const missing = fields.filter((f) => f.required && !aiFormData[f.key]).map((f) => f.label);
    if (missing.length > 0) {
      setAiError(`필수 항목을 입력해주세요: ${missing.join(', ')}`);
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    try {
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: session.serviceType, ...aiFormData }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      // 즉시 적용하지 않고 임시 저장 → 미리보기 모달로 이동
      setDraftData({ ...data.data, source: data.source, notice: data.notice });
      setShowAiPanel(false);
      setIsPreviewModalOpen(true);
      setAiFormData({});
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  // AI 초안 미리보기 모달 액션 핸들러
  const handleDraftReplace = () => {
    setPages(draftData.pages);
    setEditingIdx(0);
    setDraftData(null);
    setIsPreviewModalOpen(false);
  };

  const handleDraftAppend = () => {
    setPages((prev) => [...prev, ...draftData.pages]);
    setDraftData(null);
    setIsPreviewModalOpen(false);
  };

  const handleDraftCancel = () => {
    setDraftData(null);
    setIsPreviewModalOpen(false);
  };

  // 페이지 순서 변경
  const movePage = (idx, direction) => {
    const newPages = [...pages];
    const target = idx + direction;
    if (target < 0 || target >= newPages.length) return;
    [newPages[idx], newPages[target]] = [newPages[target], newPages[idx]];
    setPages(newPages);
    setEditingIdx(target);
  };

  // ─── API 호출: 책 생성 + 콘텐츠 추가 + 최종화 ───────────
  const handleCreateBook = async () => {
    if (pages.length < 10) {
      alert('최소 10개 이상의 페이지가 필요합니다.\n(최종화 시 최소 20페이지 = 표지 + 내지 약 10~15개)');
      return;
    }

    setLoading(true);
    try {
      const service = SERVICE_TYPES[session.serviceType];
      const title = session.formData.bookTitle || session.formData.tripName || session.formData.babyName
        ? `${session.formData.babyName || session.formData.childName || session.formData.heroName || session.formData.petName || session.formData.authorName || ''}의 ${service.name}`
        : service.name;

      // 1. 책 생성
      addLog(`📗 책 생성 중... (${title})`);
      const bookRes = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          bookSpecUid: session.bookSpecUid,
          creationType: 'TEST',
          externalRef: `bookmaker-${Date.now()}`,
        }),
      });
      const bookData = await bookRes.json();

      if (!bookData.success) {
        throw new Error(bookData.message || '책 생성 실패');
      }

      const uid = bookData.data.bookUid;
      setBookUid(uid);
      addLog(`✅ 책 생성 완료: ${uid}`);

      // 1-b. staged 파일을 Photos API로 업로드 → blob URL을 실제 URL로 교체
      const uploadedUrlMap = {}; // pageId → 업로드된 실제 URL
      const stagedEntries = Object.entries(stagedFiles);
      if (stagedEntries.length > 0) {
        setUploadingPhoto(true);
        addLog(`📸 사진 ${stagedEntries.length}장 업로드 시작...`);
        for (const [pageId, file] of stagedEntries) {
          try {
            const fd = new FormData();
            fd.append('file', file);
            addLog(`📤 업로드 중: ${file.name}`);
            const photoRes = await fetch(`/api/books/${uid}/photos`, {
              method: 'POST',
              body: fd,
            });
            const photoData = await photoRes.json();
            if (photoData.success) {
              const uploadedUrl = photoData.data?.url || photoData.data?.photoUrl || photoData.data?.fileUrl;
              if (uploadedUrl) {
                uploadedUrlMap[pageId] = uploadedUrl;
                addLog(`✅ 업로드 완료: ${uploadedUrl}`);
              } else {
                addLog(`⚠️ 업로드 성공 but URL 없음 (API 응답 확인 필요)`);
              }
            } else {
              addLog(`⚠️ 사진 업로드 실패: ${photoData.message}`);
            }
          } catch (uploadErr) {
            addLog(`⚠️ 업로드 오류 (${file.name}): ${uploadErr.message}`);
          }
        }
        setUploadingPhoto(false);
        addLog(`✅ 사진 업로드 완료 (${Object.keys(uploadedUrlMap).length}/${stagedEntries.length}장 성공)`);
      }

      // 2. 표지 추가 — 템플릿 79yjMH3qRPly (일기장A): coverPhoto + title + dateRange 필수
      addLog('🎨 표지 추가 중...');
      const firstImage = pages.find(p => p.image && p.image.startsWith('http'))?.image;
      const coverPhoto = firstImage || `https://picsum.photos/seed/${session.serviceType}-cover/600/600`;
      const dateRange = session.formData.period || session.formData.semester
        ? `${session.formData.year || '2025'}년 ${session.formData.semester || session.formData.period || ''}`
        : pages[0]?.date
          ? `${pages[0].date} ~ ${pages[pages.length - 1]?.date || ''}`
          : '2025';
      const coverRes = await fetch(`/api/books/${uid}/cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateUid: '79yjMH3qRPly',
          parameters: {
            coverPhoto,
            title,
            dateRange,
          },
        }),
      });
      const coverData = await coverRes.json();
      addLog(coverData.success ? '✅ 표지 추가 완료' : `⚠️ 표지: ${coverData.message}`);

      // 3. 콘텐츠 페이지 추가 — 템플릿 vHA59XPPKqak (일기장B): date + title + diaryText 필수
      // API 최소 24p 요건 충족을 위해 페이지가 부족하면 반복 추가
      const MIN_PAGES = 24;
      const pagesForApi = [...pages];
      let repeatIdx = 0;
      while (pagesForApi.length < MIN_PAGES) {
        pagesForApi.push({ ...pages[repeatIdx % pages.length], title: `${pages[repeatIdx % pages.length].title} (${Math.floor(repeatIdx / pages.length) + 2}회차)` });
        repeatIdx++;
      }
      if (pagesForApi.length > pages.length) {
        addLog(`📋 API 최소 페이지(24p) 충족을 위해 ${pagesForApi.length - pages.length}개 페이지 반복 추가`);
      }

      for (let i = 0; i < pagesForApi.length; i++) {
        const page = pagesForApi[i];
        addLog(`📄 페이지 ${i + 1}/${pagesForApi.length} 추가 중...`);

        const params = {
          date: page.date || new Date().toISOString().slice(0, 10),
          title: page.title || `페이지 ${i + 1}`,
          diaryText: page.text || page.teacherComment || '내용이 없습니다.',
        };

        // 이미지가 있을 경우 — 업로드된 실제 URL 우선, blob URL은 스킵
        const resolvedImage = uploadedUrlMap[page.id] || (page.image?.startsWith('http') ? page.image : null);
        if (resolvedImage) {
          params.diaryPhoto = resolvedImage;
        }

        const contentRes = await fetch(`/api/books/${uid}/contents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateUid: 'vHA59XPPKqak',
            parameters: params,
            breakBefore: 'page',
          }),
        });
        const contentData = await contentRes.json();

        if (!contentData.success) {
          addLog(`⚠️ 페이지 ${i + 1}: ${contentData.message}`);
        }
      }
      addLog(`✅ 전체 ${pagesForApi.length}개 페이지 추가 완료`);

      // 4. 최종화
      addLog('🔒 책 최종화 중...');
      const finalRes = await fetch(`/api/books/${uid}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const finalData = await finalRes.json();

      if (finalData.success) {
        addLog(`✅ 최종화 완료! (${finalData.data?.pageCount || '?'}페이지)`);
        setBookCreated(true);

        // 세션에 bookUid 저장
        const updated = { ...session, bookUid: uid, pageCount: finalData.data?.pageCount };
        sessionStorage.setItem('bookmaker_session', JSON.stringify(updated));
      } else {
        addLog(`❌ 최종화 실패: ${finalData.message}`);
        // 페이지 수 부족 등의 에러라도 bookUid는 저장
        const updated = { ...session, bookUid: uid };
        sessionStorage.setItem('bookmaker_session', JSON.stringify(updated));
      }
    } catch (err) {
      addLog(`❌ 오류: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const goToPreview = () => {
    router.push('/preview');
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner text-warm-600" /></div>;
  }

  const service = SERVICE_TYPES[session.serviceType];

  const aiFields = session ? (AI_FORM_FIELDS[session.serviceType] || []) : [];

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="editor" />

      {/* ── AI 초안 미리보기 모달 ── */}
      {isPreviewModalOpen && draftData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col animate-fade-up">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-ink-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h2 className="font-display font-bold text-ink-900">AI 초안 미리보기</h2>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {draftData.source === 'gemini' ? 'Gemini AI 생성' : '기본 템플릿 생성'} · {draftData.pages.length}페이지
                  </p>
                </div>
              </div>
              <button
                onClick={handleDraftCancel}
                className="p-2 text-ink-400 hover:text-ink-700 transition-colors rounded-lg hover:bg-ink-50"
              >
                ✕
              </button>
            </div>

            {/* 폴백 사용 안내 */}
            {draftData.notice && (
              <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex-shrink-0">
                ⚠️ {draftData.notice}
              </div>
            )}

            {/* 책 제목 */}
            <div className="px-6 pt-4 pb-2 flex-shrink-0">
              <p className="text-sm text-ink-500">책 제목</p>
              <p className="font-display font-bold text-ink-900 text-base">{draftData.title}</p>
            </div>

            {/* 페이지 목록 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2 min-h-0">
              {draftData.pages.map((page, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-ink-50 rounded-xl">
                  <span className="text-xs font-bold text-ink-400 w-6 flex-shrink-0 mt-0.5">#{idx + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-800 truncate">{page.title}</p>
                    <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{page.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 하단 버튼 3종 */}
            <div className="px-6 pb-6 pt-4 border-t border-ink-100 flex-shrink-0 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={handleDraftReplace}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  전체 페이지 교체
                </button>
                <button
                  onClick={handleDraftAppend}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-violet-700 border-2 border-violet-300 bg-violet-50 hover:bg-violet-100 transition-all"
                >
                  페이지 뒤에 추가
                </button>
              </div>
              <button
                onClick={handleDraftCancel}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-ink-500 hover:text-ink-700 hover:bg-ink-50 transition-all border border-ink-200"
              >
                작업 취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI 초안 생성 모달 (입력 폼) ── */}
      {showAiPanel && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-up">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h2 className="font-display font-bold text-ink-900">AI 페이지 초안 생성</h2>
                  <p className="text-xs text-ink-400 mt-0.5">{SERVICE_TYPES[session.serviceType]?.name} · Gemini AI</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAiPanel(false); setAiError(null); }}
                className="p-2 text-ink-400 hover:text-ink-700 transition-colors rounded-lg hover:bg-ink-50"
              >
                ✕
              </button>
            </div>

            {/* 서비스별 입력 폼 */}
            <div className="space-y-3 mb-4">
              {aiFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-ink-800 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      className="input-field text-sm"
                      value={aiFormData[field.key] || ''}
                      onChange={(e) => setAiFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                    >
                      <option value="">선택해주세요</option>
                      {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input-field text-sm"
                      placeholder={field.placeholder}
                      value={aiFormData[field.key] || ''}
                      onChange={(e) => setAiFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* 에러 메시지 */}
            {aiError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {aiError}
              </div>
            )}

            {/* 생성 중 힌트 */}
            {aiGenerating && (
              <div className="mb-4 space-y-1.5">
                {['아이디어 구상 중...', '문장 구성 중...', '페이지 편집 중...'].map((hint, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-violet-500 opacity-0 animate-fade-in" style={{ animationDelay: `${i * 0.7}s`, animationFillMode: 'forwards' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                    {hint}
                  </div>
                ))}
              </div>
            )}

            {/* 버튼 */}
            <button
              onClick={handleAiGenerate}
              disabled={aiGenerating}
              className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60"
              style={{ background: aiGenerating ? '#7c3aed80' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              {aiGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" />
                  AI가 페이지를 집필 중입니다...
                </span>
              ) : (
                '🪄 AI 초안 생성하기'
              )}
            </button>
            <p className="text-xs text-ink-400 text-center mt-3">
              생성 후 모든 내용을 자유롭게 수정할 수 있습니다
            </p>
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
              {session.aiGenerated && (
                <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full font-normal">✨ AI 생성</span>
              )}
            </h1>
            <p className="text-ink-400 text-sm mt-1">
              {session.aiGenerated
                ? `AI가 생성한 "${session.aiTitle}" · 자유롭게 수정하세요`
                : `페이지를 추가하고 내용을 편집하세요 · 판형: ${BOOK_SPEC_LABELS[session.bookSpecUid] || session.bookSpecUid}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLog(!showLog)}
              className="btn-secondary text-sm !px-3 !py-2"
            >
              {showLog ? 'API 로그 닫기' : 'API 로그'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 페이지 목록 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-ink-100 p-4 sticky top-20">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-ink-900">페이지 목록</h2>
                <span className="text-xs text-ink-400 bg-ink-50 px-2 py-0.5 rounded-full">
                  {pages.length}개
                </span>
              </div>

              {/* AI 초안 생성 버튼 */}
              <button
                onClick={() => { setShowAiPanel(true); setAiError(null); }}
                className="w-full mb-3 py-2 rounded-xl text-sm font-medium text-violet-700 border-2 border-violet-200 bg-violet-50 hover:bg-violet-100 hover:border-violet-400 transition-all flex items-center justify-center gap-1.5"
              >
                <span>✨</span> AI로 페이지 초안 생성
              </button>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {pages.map((page, idx) => (
                  <button
                    key={page.id}
                    onClick={() => setEditingIdx(idx)}
                    className={`w-full text-left p-3 rounded-xl text-sm transition-all ${
                      editingIdx === idx
                        ? 'bg-warm-50 border-2 border-warm-600'
                        : 'bg-ink-50 border-2 border-transparent hover:border-ink-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-400 w-5">#{idx + 1}</span>
                      <span className="text-ink-800 truncate flex-1">
                        {page.title || page.date || `페이지 ${idx + 1}`}
                      </span>
                    </div>
                    {page.text && (
                      <p className="text-xs text-ink-400 mt-1 ml-7 truncate">{page.text}</p>
                    )}
                  </button>
                ))}

                {pages.length === 0 && (
                  <p className="text-sm text-ink-400 text-center py-8">
                    아직 페이지가 없습니다
                  </p>
                )}
              </div>

              <button
                onClick={addPage}
                className="mt-4 w-full py-2.5 border-2 border-dashed border-ink-200 rounded-xl text-sm text-ink-400 hover:border-warm-600 hover:text-warm-600 transition-colors"
              >
                + 페이지 추가
              </button>
            </div>
          </div>

          {/* 우측: 편집 영역 */}
          <div className="lg:col-span-2 space-y-6">
            {editingIdx !== null && pages[editingIdx] ? (
              <div className="bg-white rounded-2xl border border-ink-100 p-6 opacity-0 animate-fade-in" key={editingIdx} style={{ animationFillMode: 'forwards' }}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display font-bold text-lg text-ink-900">
                    페이지 #{editingIdx + 1} 편집
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => movePage(editingIdx, -1)}
                      disabled={editingIdx === 0}
                      className="p-2 text-ink-400 hover:text-ink-800 disabled:opacity-30 transition-colors"
                      title="위로"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => movePage(editingIdx, 1)}
                      disabled={editingIdx === pages.length - 1}
                      className="p-2 text-ink-400 hover:text-ink-800 disabled:opacity-30 transition-colors"
                      title="아래로"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removePage(editingIdx)}
                      className="p-2 text-red-400 hover:text-red-600 transition-colors"
                      title="삭제"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* 날짜 */}
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-1">날짜</label>
                    <input
                      type="date"
                      className="input-field"
                      value={pages[editingIdx].date || ''}
                      onChange={(e) => updatePage(editingIdx, 'date', e.target.value)}
                    />
                  </div>

                  {/* 제목 */}
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-1">제목</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="페이지 제목을 입력하세요"
                      value={pages[editingIdx].title || ''}
                      onChange={(e) => updatePage(editingIdx, 'title', e.target.value)}
                    />
                  </div>

                  {/* 텍스트 */}
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-1">내용</label>
                    <textarea
                      className="input-field min-h-[120px]"
                      placeholder="페이지에 들어갈 텍스트를 입력하세요"
                      value={pages[editingIdx].text || ''}
                      onChange={(e) => updatePage(editingIdx, 'text', e.target.value)}
                    />
                  </div>

                  {/* 이미지 — 파일 업로드 또는 URL 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-ink-800 mb-2">사진</label>

                    {/* 드래그 앤 드롭 업로드 존 */}
                    <div
                      className="relative border-2 border-dashed border-ink-200 rounded-xl p-5 text-center hover:border-warm-400 transition-colors cursor-pointer group"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, pages[editingIdx].id)}
                      onClick={() => document.getElementById(`file-input-${editingIdx}`).click()}
                    >
                      <input
                        id={`file-input-${editingIdx}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files[0], pages[editingIdx].id)}
                      />

                      {pages[editingIdx].image ? (
                        <div className="flex items-center gap-4">
                          <img
                            src={pages[editingIdx].image}
                            alt="미리보기"
                            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <div className="text-left flex-1 min-w-0">
                            {stagedFiles[pages[editingIdx].id] ? (
                              <>
                                <p className="text-sm font-medium text-ink-800 truncate">
                                  {stagedFiles[pages[editingIdx].id].name}
                                </p>
                                <p className="text-xs text-ink-400 mt-0.5">
                                  {(stagedFiles[pages[editingIdx].id].size / 1024).toFixed(0)} KB · 책 생성 시 자동 업로드
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-ink-400 truncate">{pages[editingIdx].image}</p>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePage(editingIdx, 'image', '');
                                setStagedFiles((prev) => {
                                  const next = { ...prev };
                                  delete next[pages[editingIdx].id];
                                  return next;
                                });
                              }}
                              className="mt-1 text-xs text-red-400 hover:text-red-600"
                            >
                              삭제
                            </button>
                          </div>
                          <span className="text-xs text-ink-300 group-hover:text-warm-500 transition-colors">클릭하여 변경</span>
                        </div>
                      ) : (
                        <div className="py-2">
                          <p className="text-2xl mb-2">🖼️</p>
                          <p className="text-sm font-medium text-ink-600 group-hover:text-warm-600 transition-colors">
                            클릭하거나 파일을 드래그하세요
                          </p>
                          <p className="text-xs text-ink-400 mt-1">JPG, PNG, WEBP · 최대 10MB</p>
                        </div>
                      )}
                    </div>

                    {/* URL 직접 입력 (더미 데이터 / 외부 URL용 fallback) */}
                    <div className="mt-2">
                      <p className="text-xs text-ink-400 mb-1">또는 이미지 URL 직접 입력</p>
                      <input
                        type="text"
                        className="input-field text-xs"
                        placeholder="https://example.com/image.jpg"
                        value={pages[editingIdx].image?.startsWith('blob:') ? '' : (pages[editingIdx].image || '')}
                        onChange={(e) => {
                          updatePage(editingIdx, 'image', e.target.value);
                          // URL 입력 시 staged 파일 제거
                          setStagedFiles((prev) => {
                            const next = { ...prev };
                            delete next[pages[editingIdx].id];
                            return next;
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* 서비스별 추가 필드 (유치원 알림장) */}
                  {session.serviceType === 'kindergarten' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-ink-800 mb-1">요일</label>
                        <input type="text" className="input-field" placeholder="월요일"
                          value={pages[editingIdx].dayOfWeek || ''}
                          onChange={(e) => updatePage(editingIdx, 'dayOfWeek', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-800 mb-1">선생님 코멘트</label>
                        <textarea className="input-field min-h-[80px]" placeholder="선생님의 한마디"
                          value={pages[editingIdx].teacherComment || ''}
                          onChange={(e) => updatePage(editingIdx, 'teacherComment', e.target.value)}
                        />
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
                  {apiLog.length === 0 ? (
                    <p className="text-ink-400">아직 API 호출 기록이 없습니다.</p>
                  ) : (
                    apiLog.map((log, i) => (
                      <div key={i} className="text-ink-200">
                        <span className="text-ink-400">[{log.time}]</span> {log.msg}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 하단 액션 */}
            <div className="bg-white rounded-2xl border border-ink-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-ink-900">
                    {bookCreated ? '✅ 책이 생성되었습니다!' : '책 생성하기'}
                  </h3>
                  <p className="text-sm text-ink-400 mt-1">
                    {bookCreated
                      ? `BookUID: ${bookUid} — 다음 단계로 진행하세요`
                      : `현재 ${pages.length}개 페이지 · API를 호출하여 책을 생성합니다`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Link href={`/create/${session?.serviceType}`} className="btn-secondary flex-1 text-center">
                  뒤로
                </Link>
                {!bookCreated ? (
                  <button
                    onClick={handleCreateBook}
                    disabled={loading || pages.length < 1}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <span className="spinner" />
                        {uploadingPhoto ? '사진 업로드 중...' : 'API 호출 중...'}
                      </>
                    ) : (
                      <>
                        📗 책 생성 & 최종화
                        {Object.keys(stagedFiles).length > 0 && (
                          <span className="ml-1.5 text-xs bg-warm-200 text-warm-800 px-1.5 py-0.5 rounded-full">
                            사진 {Object.keys(stagedFiles).length}장
                          </span>
                        )}
                      </>
                    )}
                  </button>
                ) : (
                  <button onClick={goToPreview} className="btn-primary flex-1">
                    다음: 미리보기 & 주문 →
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
