'use client';

const STEPS = [
  { key: 'info', label: 'Configure' },
  { key: 'editor', label: 'Compose' },
  { key: 'preview', label: 'Preview' },
  { key: 'order', label: 'Order' },
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
              className={`text-xs mt-1.5 whitespace-nowrap font-mono tracking-wide ${
                i === currentIdx ? 'text-neutral-900 font-medium' : 'text-neutral-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 h-px mx-1 mt-[-14px] ${
                i < currentIdx ? 'bg-neutral-900' : 'bg-neutral-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
