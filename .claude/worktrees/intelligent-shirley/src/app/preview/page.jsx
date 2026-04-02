'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS } from '@/lib/constants';
import StepIndicator from '@/components/StepIndicator';

export default function PreviewPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    if (!data.bookUid) { router.push('/editor'); return; }
    setSession(data);
    fetchEstimate(data.bookUid);
  }, [router]);

  const fetchEstimate = async (bookUid) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ bookUid, quantity: 1 }],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEstimate(data.data);
      } else {
        setError(data.message || '견적 조회 실패');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const goToOrder = () => {
    router.push('/order');
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner text-warm-600" /></div>;
  }

  const service = SERVICE_TYPES[session.serviceType];
  const spec = BOOK_SPECS[session.bookSpecUid];

  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="preview" />

      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-10 opacity-0 animate-fade-up">
          <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">
            미리보기 & 가격 확인
          </h1>
          <p className="text-ink-400">책이 최종화되었습니다. 가격을 확인하고 주문하세요.</p>
        </div>

        {/* 책 요약 */}
        <div className="bg-white rounded-2xl border border-ink-100 p-6 mb-6 opacity-0 animate-fade-up delay-100">
          <h2 className="font-display font-bold text-lg text-ink-900 mb-4 flex items-center gap-2">
            <span>{service.icon}</span>
            책 정보
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-ink-50 rounded-xl">
              <p className="text-xs text-ink-400 mb-0.5">서비스</p>
              <p className="text-sm font-medium text-ink-800">{service.name}</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl">
              <p className="text-xs text-ink-400 mb-0.5">판형</p>
              <p className="text-sm font-medium text-ink-800">{spec?.name || session.bookSpecUid}</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl">
              <p className="text-xs text-ink-400 mb-0.5">Book UID</p>
              <p className="text-sm font-mono text-ink-600 break-all">{session.bookUid}</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl">
              <p className="text-xs text-ink-400 mb-0.5">페이지 수</p>
              <p className="text-sm font-medium text-ink-800">{session.pageCount || '—'} 페이지</p>
            </div>
          </div>

          {/* 입력한 정보 요약 */}
          <div className="mt-4 pt-4 border-t border-ink-100">
            <p className="text-xs text-ink-400 mb-2">입력 정보</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(session.formData || {}).map(([key, value]) => (
                value && (
                  <span key={key} className="text-xs bg-warm-50 text-warm-800 px-2.5 py-1 rounded-full">
                    {value}
                  </span>
                )
              ))}
            </div>
          </div>
        </div>

        {/* 가격 견적 */}
        <div className="bg-white rounded-2xl border border-ink-100 p-6 mb-6 opacity-0 animate-fade-up delay-200">
          <h2 className="font-display font-bold text-lg text-ink-900 mb-4">💰 가격 견적</h2>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <span className="spinner text-warm-600 mr-3" />
              <span className="text-ink-400">견적을 조회하고 있습니다...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <p className="font-medium">견적 조회 실패</p>
              <p className="mt-1">{error}</p>
              <button
                onClick={() => fetchEstimate(session.bookUid)}
                className="mt-2 text-sm text-red-800 underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {estimate && (
            <div className="space-y-3">
              {estimate.items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-ink-600">상품 금액 ({item.pageCount}p × {item.quantity}부)</span>
                  <span className="font-medium text-ink-800">{formatPrice(item.itemAmount)}원</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-ink-600">포장비</span>
                <span className="font-medium text-ink-800">{formatPrice(estimate.packagingFee)}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-600">배송비</span>
                <span className="font-medium text-ink-800">{formatPrice(estimate.shippingFee)}원</span>
              </div>
              <div className="border-t border-ink-100 pt-3 flex justify-between">
                <span className="font-bold text-ink-900">합계</span>
                <span className="font-bold text-xl text-warm-600">{formatPrice(estimate.totalAmount)}원</span>
              </div>
              <div className="flex justify-between text-xs text-ink-400 mt-1">
                <span>충전금 잔액</span>
                <span>{formatPrice(estimate.creditBalance)}원 {estimate.creditSufficient ? '✅' : '❌ 부족'}</span>
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 opacity-0 animate-fade-up delay-300">
          <Link href="/editor" className="btn-secondary flex-1 text-center">
            뒤로
          </Link>
          <button
            onClick={goToOrder}
            disabled={!estimate || !estimate.creditSufficient}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            다음: 주문하기 →
          </button>
        </div>
      </div>
    </div>
  );
}
