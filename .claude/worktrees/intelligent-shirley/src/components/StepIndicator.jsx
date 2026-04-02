'use client';

const STEPS = [
  { key: 'select', label: '서비스 선택' },
  { key: 'info', label: '정보 입력' },
  { key: 'editor', label: '콘텐츠 편집' },
  { key: 'preview', label: '미리보기' },
  { key: 'order', label: '주문' },
];

export default function StepIndicator({ currentStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`step-dot ${
                i < currentIdx ? 'completed' : i === currentIdx ? 'active' : 'pending'
              }`}
            />
            <span
              className={`text-xs mt-1.5 whitespace-nowrap ${
                i === currentIdx ? 'text-warm-600 font-medium' : 'text-ink-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 h-px mx-1 mt-[-14px] ${
                i < currentIdx ? 'bg-warm-600' : 'bg-ink-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
