'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';
import { toast } from '@/lib/toast';

export default function CreatePage() {
  const router = useRouter();
  const params = useParams();
  const serviceType = params.serviceType;
  const service = SERVICE_TYPES[serviceType];

  // ── sessionStorage 기반 폼 임시 저장(Draft) 키 ──────────────
  const DRAFT_KEY = `BOOK_DRAFT_${serviceType}`;

  const [formData, setFormData] = useState({});
  const [selectedSpec, setSelectedSpec] = useState('');
  const [useDummy, setUseDummy] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Draft 복원된 판형 UID를 ref로 보관 — API 로딩 완료 후 덮어쓰기 방지용
  const restoredSpecRef = useRef(null);

  // API에서 불러온 판형 목록 (GET /book-specs)
  const [bookSpecs, setBookSpecs] = useState([]);
  const [specsLoading, setSpecsLoading] = useState(true);

  // API에서 받아온 전체 템플릿 raw 데이터 — 에디터 모달 템플릿 선택에서 사용
  const [allTemplates, setAllTemplates] = useState([]);

  // ── 마운트 시 Draft 복원 (1회) ──────────────────────────────
  // 복원 우선순위: 1) DRAFT_KEY (폼 자동 저장), 2) bookmaker_session (에디터에서 뒤로 온 경우)
  useEffect(() => {
    let restored = false;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.formData && Object.keys(draft.formData).length > 0) {
          setFormData(draft.formData);
          restored = true;
        }
        if (draft.selectedSpec) {
          setSelectedSpec(draft.selectedSpec);
          restoredSpecRef.current = draft.selectedSpec;
        }
        if (draft.useDummy) {
          setUseDummy(true);
        }
        console.log(`[Draft 복원] ${serviceType}:`, draft);
      }
    } catch (err) {
      console.warn('[Draft 복원 실패]', err);
    }
    // DRAFT_KEY에 formData가 없으면 bookmaker_session에서 폴백 복원
    if (!restored) {
      try {
        const sessionRaw = sessionStorage.getItem('bookmaker_session');
        if (sessionRaw) {
          const sess = JSON.parse(sessionRaw);
          if (sess.formData && Object.keys(sess.formData).length > 0) {
            setFormData(sess.formData);
            restored = true;
          }
          if (sess.bookSpecUid) {
            setSelectedSpec(sess.bookSpecUid);
            restoredSpecRef.current = sess.bookSpecUid;
          }
          if (sess.useDummy) {
            setUseDummy(true);
          }
          console.log(`[Session 폴백 복원] ${serviceType}:`, sess);
        }
      } catch (err) {
        console.warn('[Session 폴백 복원 실패]', err);
      }
    }
    if (restored) {
      setDraftRestored(true);
      const hasEditorSession = sessionStorage.getItem('bookmaker_session');
      if (!hasEditorSession) {
        toast.info('이전에 입력한 내용이 복원되었습니다');
      }
    }
  }, [DRAFT_KEY, serviceType]);

  // ── 폼 변경 시 Draft 자동 저장 (500ms Debounce) ─────────────
  const debounceRef = useRef(null);
  const saveDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (Object.keys(formData).length === 0 && !useDummy && !selectedSpec) return;
      try {
        const draft = { formData, selectedSpec, useDummy };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        console.log('[Draft 저장]', DRAFT_KEY);
      } catch (err) {
        console.warn('[Draft 저장 실패]', err);
      }
    }, 500);
  }, [formData, selectedSpec, useDummy, DRAFT_KEY]);

  useEffect(() => {
    saveDraft();
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [saveDraft]);

  // 1단계: 마운트 시 GET /book-specs 호출
  useEffect(() => {
    const loadBookSpecs = async () => {
      setSpecsLoading(true);
      try {
        const res = await fetch('/api/book-specs');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setBookSpecs(data.data);
          if (restoredSpecRef.current) {
            const exists = data.data.some(s => s.bookSpecUid === restoredSpecRef.current);
            if (!exists) {
              const recommended = data.data.find(s => s.bookSpecUid === service?.recommendedSpec);
              setSelectedSpec(recommended ? recommended.bookSpecUid : data.data[0]?.bookSpecUid || '');
            }
          } else {
            const recommended = data.data.find(s => s.bookSpecUid === service?.recommendedSpec);
            setSelectedSpec(recommended ? recommended.bookSpecUid : data.data[0]?.bookSpecUid || service?.recommendedSpec || '');
          }
        } else {
          setBookSpecs(Object.values(BOOK_SPECS).map(s => ({ bookSpecUid: s.uid, name: s.name, ...s })));
          if (!restoredSpecRef.current) {
            setSelectedSpec(service?.recommendedSpec || '');
          }
        }
      } catch {
        setBookSpecs(Object.values(BOOK_SPECS).map(s => ({ bookSpecUid: s.uid, name: s.name, ...s })));
        if (!restoredSpecRef.current) {
          setSelectedSpec(service?.recommendedSpec || '');
        }
      } finally {
        setSpecsLoading(false);
      }
    };
    loadBookSpecs();
  }, [service]);

  // 2단계: 판형 선택 시 GET /templates 호출
  useEffect(() => {
    if (!selectedSpec) return;
    const loadTemplates = async () => {
      try {
        const res = await fetch(`/api/templates?bookSpecUid=${selectedSpec}&limit=50`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setAllTemplates(data.data);
        }
      } catch {
        // 실패 시 빈 배열 유지
      }
    };
    loadTemplates();
  }, [selectedSpec]);

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-peach-50">
        <div className="text-center">
          <h1 className="font-display text-3xl text-ink-900 mb-4">페이지를 찾을 수 없어요</h1>
          <Link href="/" className="btn-primary inline-block">홈으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const fillDummy = () => {
    const dummy = DUMMY_DATA[serviceType];
    if (dummy) {
      setFormData(dummy.meta);
      setUseDummy(true);
      toast.success('샘플 데이터가 채워졌어요!');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const missingFields = service.fields
      .filter((f) => f.required && !formData[f.key])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      toast.error(`필수 항목을 입력해주세요: ${missingFields.join(', ')}`);
      return;
    }

    const sessionData = {
      serviceType,
      formData,
      bookSpecUid: selectedSpec,
      allTemplates,
      useDummy,
    };
    sessionStorage.setItem('bookmaker_session', JSON.stringify(sessionData));
    // DRAFT 즉시 저장 (debounce 대기 없이) — 에디터에서 back 시 폼 데이터 100% 복원 보장
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, selectedSpec, useDummy }));
    } catch (e) { /* 무시 */ }
    router.push('/editor?isNew=true');  // isNew=true: 에디터에서 이전 갤러리 상태를 초기화하고 새로 시작
  };

  return (
    <div className="min-h-screen bg-peach-50 pb-20 page-transition">
      <StepIndicator currentStep="info" />

      <div className="max-w-xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12 opacity-0 animate-fade-up">
          <p className="text-peach-400 font-body text-sm tracking-[0.2em] uppercase mb-4">정보 입력</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink-900 tracking-tight mb-3">
            새 작품집
          </h1>
          <p className="text-ink-600 text-sm">아이와 작품집에 대한 정보를 입력해 주세요</p>
        </div>

        {/* Quick Fill */}
        <div className="mb-8 p-5 bg-white border-2 border-peach-100 rounded-2xl opacity-0 animate-fade-up delay-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-800">✨ 샘플 데이터</p>
              <p className="text-xs text-ink-400 mt-0.5">더미 데이터로 빠르게 체험해 보세요</p>
            </div>
            <div className="flex items-center gap-2">
              {draftRestored && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({});
                    setUseDummy(false);
                    setDraftRestored(false);
                    sessionStorage.removeItem(DRAFT_KEY);
                    toast.info('초기화되었습니다');
                  }}
                  className="px-3 py-2 text-xs text-ink-400 border-2 border-peach-200 rounded-xl hover:bg-peach-50 transition-colors"
                >
                  초기화
                </button>
              )}
              <button onClick={fillDummy} className="px-4 py-2 bg-peach-500 text-white text-xs font-semibold rounded-xl hover:bg-peach-600 transition-colors shadow-sm">
                샘플 채우기
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 opacity-0 animate-fade-up delay-200">
          {/* Service Fields */}
          <div className="bg-white border-2 border-peach-100 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-ink-900 tracking-wide flex items-center gap-2">
              <span>🎨</span> 작품집 정보
            </h2>

            {service.fields.map((field) => {
              if (field.showWhen) {
                const { field: depField, value } = field.showWhen;
                if (formData[depField] !== value) return null;
              }

              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-ink-600 mb-1.5 tracking-wide">
                    {field.label}
                    {field.required && <span className="text-coral-400 ml-0.5">*</span>}
                  </label>

                  {field.type === 'text' && (
                    <input
                      type="text"
                      className="input-field"
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  )}

                  {field.type === 'date' && (
                    <input
                      type="date"
                      className="input-field"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  )}

                  {field.type === 'select' && (
                    <select
                      className="input-field"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    >
                      <option value="">선택해 주세요...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.type === 'textarea' && (
                    <textarea
                      className="input-field min-h-[100px]"
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Book Spec Selection */}
          <div className="bg-white border-2 border-peach-100 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink-900 tracking-wide flex items-center gap-2">
                <span>📚</span> 작품집 판형
              </h2>
              {specsLoading && <span className="text-xs text-peach-400 flex items-center gap-1"><span className="spinner" style={{width:12,height:12}} /> 불러오는 중...</span>}
            </div>
            <div className="space-y-3">
              {(bookSpecs.length > 0 ? bookSpecs : Object.values(BOOK_SPECS).map(s => ({ bookSpecUid: s.uid, ...s }))).map((s) => {
                const uid = s.bookSpecUid || s.uid;
                const displayName = BOOK_SPEC_LABELS[uid] || s.name || uid;
                const displayDetail = s.width && s.height
                  ? `${s.width}x${s.height}mm / ${s.coverType || ''} / ${s.bindingType || ''}`.replace(/ \/ $/, '')
                  : BOOK_SPECS[uid]
                    ? `${BOOK_SPECS[uid].size} / ${BOOK_SPECS[uid].cover} / ${BOOK_SPECS[uid].binding} / ${BOOK_SPECS[uid].pages}`
                    : s.description || uid;
                return (
                  <label
                    key={uid}
                    className={`block p-4 border-2 cursor-pointer transition-all rounded-xl ${
                      selectedSpec === uid
                        ? 'border-peach-400 bg-peach-50'
                        : 'border-peach-100 hover:border-peach-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="bookSpec"
                        value={uid}
                        checked={selectedSpec === uid}
                        onChange={() => setSelectedSpec(uid)}
                        className="mt-1 accent-peach-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink-900 text-sm">{displayName}</span>
                          {uid === service.recommendedSpec && (
                            <span className="text-xs bg-peach-500 text-white px-2 py-0.5 rounded-full font-medium">추천</span>
                          )}
                        </div>
                        <p className="text-xs text-ink-400 mt-1 font-mono">{displayDetail}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4">
            <Link href="/" className="btn-secondary flex-1 text-center">
              뒤로
            </Link>
            <button type="submit" className="btn-primary flex-1">
              다음: 꾸미기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
