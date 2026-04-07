'use client';

const STEPS = [
  { key: 'info', label: 'Configure', num: '01' },
  { key: 'editor', label: 'Compose', num: '02' },
  { key: 'preview', label: 'Preview', num: '03' },
  { key: 'order', label: 'Order', num: '04' },
];

export default function StepIndicator({ currentStep }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-6 px-4">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isActive = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              {/* Step number badge */}
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-neutral-900 text-white scale-110'
                    : isCompleted
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                }`}
              >
                {isCompleted ? '✓' : step.num}
              </div>
              <span
                className={`text-[10px] sm:text-xs mt-1.5 whitespace-nowrap font-mono tracking-wider transition-all duration-300 ${
                  isActive
                    ? 'text-neutral-900 font-semibold'
                    : isCompleted
                      ? 'text-neutral-600 font-medium'
                      : 'text-neutral-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-px mx-1 sm:mx-2 mt-[-14px] transition-all duration-300 ${
                  isCompleted ? 'bg-neutral-900' : 'bg-neutral-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
