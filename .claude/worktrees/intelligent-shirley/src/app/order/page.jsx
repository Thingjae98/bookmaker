'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES } from '@/lib/constants';
import StepIndicator from '@/components/StepIndicator';

export default function OrderPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [shipping, setShipping] = useState({
    recipientName: '',
    recipientPhone: '',
    postalCode: '',
    address1: '',
    address2: '',
    memo: '',
  });
  const [loading, setLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    if (!data.bookUid) { router.push('/editor'); return; }
    setSession(data);
  }, [router]);

  const fillDummyShipping = () => {
    setShipping({
      recipientName: '홍길동',
      recipientPhone: '010-1234-5678',
      postalCode: '06236',
      address1: '서울특별시 강남구 테헤란로 123',
      address2: '4층 401호',
      memo: '부재시 경비실에 맡겨주세요',
    });
  };

  const handleChange = (key, value) => {
    setShipping((prev) => ({ ...prev, [key]: value }));
  };

  const handleOrder = async () => {
    const required = ['recipientName', 'recipientPhone', 'postalCode', 'address1'];
    const missing = required.filter((k) => !shipping[k]);
    if (missing.length > 0) {
      alert('수령인, 연락처, 우편번호, 주소를 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ bookUid: session.bookUid, quantity: 1 }],
          shipping: {
            recipientName: shipping.recipientName,
            recipientPhone: shipping.recipientPhone,
            postalCode: shipping.postalCode,
            address1: shipping.address1,
            address2: shipping.address2,
            memo: shipping.memo,
          },
          externalRef: `bookmaker-order-${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setOrderResult(data.data);
      } else {
        setError(data.message || '주문 생성 실패');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner text-warm-600" /></div>;
  }

  const service = SERVICE_TYPES[session.serviceType];
  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');

  // 주문 완료 화면
  if (orderResult) {
    return (
      <div className="min-h-screen pb-20">
        <StepIndicator currentStep="order" />
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="bg-white rounded-2xl border border-ink-100 p-10 opacity-0 animate-fade-up">
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">
              주문이 완료되었습니다!
            </h1>
            <p className="text-ink-400 mb-8">
              Sandbox 환경이므로 실제 인쇄·배송은 진행되지 않습니다.
            </p>

            <div className="bg-ink-50 rounded-xl p-6 text-left space-y-3 mb-8">
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">주문번호</span>
                <span className="font-mono text-ink-800">{orderResult.orderUid}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">주문상태</span>
                <span className="text-blue-600 font-medium">{orderResult.orderStatusDisplay || '결제완료'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">상품금액</span>
                <span className="text-ink-800">{formatPrice(orderResult.totalProductAmount)}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">배송비</span>
                <span className="text-ink-800">{formatPrice(orderResult.totalShippingFee)}원</span>
              </div>
              <div className="flex justify-between text-sm border-t border-ink-200 pt-3">
                <span className="font-bold text-ink-900">총 결제금액</span>
                <span className="font-bold text-warm-600">{formatPrice(orderResult.totalAmount)}원</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">수령인</span>
                <span className="text-ink-800">{orderResult.recipientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">배송지</span>
                <span className="text-ink-800 text-right max-w-[200px]">{orderResult.address1} {orderResult.address2}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/" className="btn-secondary flex-1 text-center">
                새 책 만들기
              </Link>
              <Link href="/orders" className="btn-primary flex-1 text-center">
                주문 내역 보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <StepIndicator currentStep="order" />

      <div className="max-w-2xl mx-auto px-6">
        <div className="text-center mb-10 opacity-0 animate-fade-up">
          <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">배송 정보 입력</h1>
          <p className="text-ink-400">책을 받으실 곳의 정보를 입력해주세요</p>
        </div>

        {/* 더미 배송지 버튼 */}
        <div className="mb-6 p-4 bg-warm-50 rounded-xl border border-warm-200/50 opacity-0 animate-fade-up delay-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink-800">🧪 테스트 배송지 사용</p>
              <p className="text-xs text-ink-400 mt-0.5">Sandbox 환경용 더미 배송지를 채웁니다</p>
            </div>
            <button onClick={fillDummyShipping} className="px-4 py-2 bg-warm-600 text-white text-sm rounded-lg hover:bg-warm-800 transition-colors">
              자동 채우기
            </button>
          </div>
        </div>

        {/* 배송 폼 */}
        <div className="bg-white rounded-2xl border border-ink-100 p-6 space-y-5 mb-6 opacity-0 animate-fade-up delay-200">
          <div>
            <label className="block text-sm font-medium text-ink-800 mb-1">수령인 <span className="text-red-400">*</span></label>
            <input type="text" className="input-field" placeholder="홍길동" value={shipping.recipientName} onChange={(e) => handleChange('recipientName', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-800 mb-1">연락처 <span className="text-red-400">*</span></label>
            <input type="tel" className="input-field" placeholder="010-1234-5678" value={shipping.recipientPhone} onChange={(e) => handleChange('recipientPhone', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-800 mb-1">우편번호 <span className="text-red-400">*</span></label>
            <input type="text" className="input-field" placeholder="06236" value={shipping.postalCode} onChange={(e) => handleChange('postalCode', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-800 mb-1">주소 <span className="text-red-400">*</span></label>
            <input type="text" className="input-field" placeholder="서울특별시 강남구 테헤란로 123" value={shipping.address1} onChange={(e) => handleChange('address1', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-800 mb-1">상세주소</label>
            <input type="text" className="input-field" placeholder="4층 401호" value={shipping.address2} onChange={(e) => handleChange('address2', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-800 mb-1">배송 메모</label>
            <input type="text" className="input-field" placeholder="부재시 경비실에 맡겨주세요" value={shipping.memo} onChange={(e) => handleChange('memo', e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <p className="font-medium">주문 실패</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex gap-3 opacity-0 animate-fade-up delay-300">
          <Link href="/preview" className="btn-secondary flex-1 text-center">뒤로</Link>
          <button
            onClick={handleOrder}
            disabled={loading}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><span className="spinner" /> 주문 처리 중...</>
            ) : (
              '📦 주문하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
