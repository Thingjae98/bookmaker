'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';

export default function CreatePage() {
  const router = useRouter();
  const params = useParams();
  const serviceType = params.serviceType;
  const service = SERVICE_TYPES[serviceType];

  const [formData, setFormData] = useState({});
  const [selectedSpec, setSelectedSpec] = useState('');
  const [useDummy, setUseDummy] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (service) {
      setSelectedSpec(service.recommendedSpec);
    }
  }, [service]);

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-ink-900 mb-4">서비스를 찾을 수 없습니다</h1>
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
    }
  };

  // AI 동화 생성 (fairytale 서비스 전용)
  const handleGenerateStory = async () => {
    const missing = ['heroName', 'theme'].filter((k) => !formData[k]);
    if (missing.length > 0) {
      alert('주인공 이름과 동화 주제를 먼저 입력해주세요.');
      return;
    }

    setAiGenerating(true);
    setAiError(null);

    try {
      const res = await fetch('/api/generate-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroName: formData.heroName,
          heroAge: formData.heroAge,
          theme: formData.theme === '직접 입력' ? formData.customTheme : formData.theme,
          moralLesson: formData.moralLesson,
        }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.message);

      // 생성된 페이지를 sessionStorage에 임시 저장 (에디터에서 로드)
      sessionStorage.setItem('bookmaker_ai_pages', JSON.stringify(data.data.pages));

      // 세션 메타데이터 저장 후 에디터로 이동
      const sessionData = {
        serviceType,
        formData: { ...formData, bookTitle: data.data.title },
        bookSpecUid: selectedSpec,
        useDummy: false,
        aiGenerated: true,
        aiTitle: data.data.title,
      };
      sessionStorage.setItem('bookmaker_session', JSON.stringify(sessionData));
      router.push('/editor');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // 필수 필드 검증
    const missingFields = service.fields
      .filter((f) => f.required && !formData[f.key])
      .map((f) => f.label);

    if (missingFields.length > 0) {
      alert(`다음 필수 항목을 입력해주세요:\n${missingFields.join(', ')}`);
      return;
    }

    // 세션 스토리지에 저장 후 에디터로 이동
    const sessionData = {
      serviceType,
      formData,
      bookSpecUid: selectedSpec,
      useDummy,
    };
    sessionStorage.setItem('bookmaker_session', JSON.stringify(sessionData));
    router.push('/editor');
  };

  const spec = BOOK_SPECS[selectedSpec];

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="info" />

      <div className="max-w-2xl mx-auto px-6">
        {/* 헤더 */}
        <div className="text-center mb-10 opacity-0 animate-fade-up">
          <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${service.color} flex items-center justify-center text-4xl`}>
            {service.icon}
          </div>
          <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">{service.name}</h1>
          <p className="text-ink-400">{service.subtitle}</p>
        </div>

        {/* 더미 데이터 버튼 */}
        <div className="mb-8 p-4 bg-warm-50 rounded-xl border border-warm-200/50 opacity-0 animate-fade-up delay-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-800">🧪 테스트 데이터로 빠르게 체험</p>
              <p className="text-xs text-ink-400 mt-0.5">더미 데이터를 자동으로 채워줍니다</p>
            </div>
            <button onClick={fillDummy} className="px-4 py-2 bg-warm-600 text-white text-sm rounded-lg hover:bg-warm-800 transition-colors">
              더미 데이터 채우기
            </button>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="space-y-6 opacity-0 animate-fade-up delay-200">
          {/* 서비스별 필드 */}
          <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-5">
            <h2 className="font-display font-bold text-lg text-ink-900">기본 정보</h2>

            {service.fields.map((field) => {
              // showWhen 조건 처리
              if (field.showWhen) {
                const { field: depField, value } = field.showWhen;
                if (formData[depField] !== value) return null;
              }

              return (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-ink-800 mb-1.5">
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
                      <option value="">선택해주세요</option>
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

          {/* 판형 선택 */}
          <div className="bg-white rounded-2xl border border-ink-100 p-6">
            <h2 className="font-display font-bold text-lg text-ink-900 mb-4">판형 선택</h2>
            <div className="space-y-3">
              {Object.values(BOOK_SPECS).map((s) => (
                <label
                  key={s.uid}
                  className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedSpec === s.uid
                      ? 'border-warm-600 bg-warm-50'
                      : 'border-ink-100 hover:border-ink-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="bookSpec"
                      value={s.uid}
                      checked={selectedSpec === s.uid}
                      onChange={() => setSelectedSpec(s.uid)}
                      className="mt-1 accent-warm-600"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900">{BOOK_SPEC_LABELS[s.uid] || s.name}</span>
                        {s.uid === service.recommendedSpec && (
                          <span className="text-xs bg-warm-600 text-white px-2 py-0.5 rounded-full">추천</span>
                        )}
                      </div>
                      <p className="text-sm text-ink-400 mt-1">
                        {s.size} · {s.cover} · {s.binding} · {s.pages}
                      </p>
                      <p className="text-xs text-ink-400 mt-0.5">{s.description}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* AI 동화 생성 패널 (fairytale 전용) */}
          {serviceType === 'fairytale' && (
            <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">✨</span>
                <h2 className="font-display font-bold text-lg text-violet-900">AI 동화 자동 생성</h2>
                <span className="text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">Gemini AI</span>
              </div>
              <p className="text-sm text-violet-700 mb-4 leading-relaxed">
                위에 입력한 정보를 바탕으로 AI가 10페이지 분량의 동화를 자동으로 집필합니다.<br />
                생성된 내용은 에디터에서 자유롭게 수정할 수 있습니다.
              </p>

              {aiError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  <p className="font-medium">생성 실패</p>
                  <p className="mt-0.5">{aiError}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateStory}
                disabled={aiGenerating}
                className="w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: aiGenerating ? '#7c3aed80' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              >
                {aiGenerating ? (
                  <span className="flex items-center justify-center gap-3">
                    <span className="spinner" />
                    <span>
                      AI가 <strong>{formData.heroName || '주인공'}</strong>을(를) 위한 동화를 집필 중입니다...
                    </span>
                  </span>
                ) : (
                  '🪄 AI 동화 생성하기'
                )}
              </button>

              {/* 로딩 중 애니메이션 힌트 */}
              {aiGenerating && (
                <div className="mt-4 space-y-2">
                  {['이야기 구조 설계 중...', '캐릭터와 배경 구성 중...', '각 장면 집필 중...'].map((hint, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-violet-500 opacity-0 animate-fade-in" style={{ animationDelay: `${i * 0.8}s`, animationFillMode: 'forwards' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
                      {hint}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex gap-3 pt-4">
            <Link href="/" className="btn-secondary flex-1 text-center">
              뒤로
            </Link>
            <button type="submit" className="btn-primary flex-1">
              {serviceType === 'fairytale' ? '직접 편집하기 →' : '다음: 콘텐츠 편집 →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
