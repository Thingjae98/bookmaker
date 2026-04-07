'use client';

const STEPS = [
  { key: 'info', label: '정보 입력', num: '01', emoji: '📝' },
  { key: 'editor', label: '꾸미기', num: '02', emoji: '🎨' },
  { key: 'preview', label: '미리보기', num: '03', emoji: '📖' },
  { key: 'order', label: '주문하기', num: '04', emoji: '🎁' },
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
                className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-mono font-semibold transition-all duration-300 ${
                  isActive
                    ? 'bg-peach-500 text-white scale-110 shadow-md shadow-peach-200'
                    : isCompleted
                      ? 'bg-mint-400 text-white'
                      : 'bg-peach-50 text-peach-300 border-2 border-peach-200'
                }`}
              >
                {isCompleted ? '✓' : step.emoji}
              </div>
              <span
                className={`text-[10px] sm:text-xs mt-1.5 whitespace-nowrap tracking-wider transition-all duration-300 ${
                  isActive
                    ? 'text-peach-600 font-semibold'
                    : isCompleted
                      ? 'text-mint-600 font-medium'
                      : 'text-peach-300'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 mt-[-14px] rounded-full transition-all duration-300 ${
                  isCompleted ? 'bg-mint-400' : 'bg-peach-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
