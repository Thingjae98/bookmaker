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
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.formData && Object.keys(draft.formData).length > 0) {
          setFormData(draft.formData);
        }
        if (draft.selectedSpec) {
          setSelectedSpec(draft.selectedSpec);
          restoredSpecRef.current = draft.selectedSpec;
        }
        if (draft.useDummy) {
          setUseDummy(true);
        }
        setDraftRestored(true);
        toast.info('이전에 입력한 내용이 복원되었습니다');
        console.log(`[Draft 복원] ${serviceType}:`, draft);
      }
    } catch (err) {
      console.warn('[Draft 복원 실패]', err);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-neutral-900 mb-4">Page not found</h1>
          <Link href="/" className="btn-primary inline-block">Back to Home</Link>
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
      toast.success('더미 데이터가 채워졌습니다');
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
    sessionStorage.removeItem(DRAFT_KEY);
    router.push('/editor');
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      <StepIndicator currentStep="info" />

      <div className="max-w-xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12 opacity-0 animate-fade-up">
          <p className="text-neutral-400 font-mono text-xs tracking-[0.3em] uppercase mb-4">Configure</p>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-neutral-900 tracking-tight mb-3">
            New Archive
          </h1>
          <p className="text-neutral-500 text-sm">프로젝트 정보를 입력하고 아카이브를 구성하세요</p>
        </div>

        {/* Quick Fill */}
        <div className="mb-8 p-4 border border-neutral-200 opacity-0 animate-fade-up delay-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-800 font-mono">Quick Fill</p>
              <p className="text-xs text-neutral-400 mt-0.5">더미 데이터로 빠르게 체험</p>
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
                  className="px-3 py-2 text-xs text-neutral-500 border border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  Reset
                </button>
              )}
              <button onClick={fillDummy} className="px-4 py-2 bg-neutral-900 text-white text-xs font-medium tracking-wider hover:bg-neutral-800 transition-colors">
                Fill Demo Data
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 opacity-0 animate-fade-up delay-200">
          {/* Service Fields */}
          <div className="border border-neutral-200 p-6 space-y-5">
            <h2 className="font-mono text-sm font-medium text-neutral-900 tracking-wide uppercase">Project Info</h2>

            {service.fields.map((field) => {
              if (field.showWhen) {
                const { field: depField, value } = field.showWhen;
                if (formData[depField] !== value) return null;
              }

              return (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5 tracking-wide uppercase">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
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
                      <option value="">Select...</option>
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
          <div className="border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm font-medium text-neutral-900 tracking-wide uppercase">Book Format</h2>
              {specsLoading && <span className="text-xs text-neutral-400 flex items-center gap-1"><span className="spinner" style={{width:12,height:12}} /> Loading...</span>}
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
                    className={`block p-4 border cursor-pointer transition-all ${
                      selectedSpec === uid
                        ? 'border-neutral-900 bg-neutral-50'
                        : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="bookSpec"
                        value={uid}
                        checked={selectedSpec === uid}
                        onChange={() => setSelectedSpec(uid)}
                        className="mt-1 accent-neutral-900"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-900 text-sm">{displayName}</span>
                          {uid === service.recommendedSpec && (
                            <span className="text-xs bg-neutral-900 text-white px-2 py-0.5 font-mono">REC</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1 font-mono">{displayDetail}</p>
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
              Back
            </Link>
            <button type="submit" className="btn-primary flex-1">
              Next: Compose
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
