'use client';

// src/app/preview/page.jsx
// 미리보기 & 가격 확인 페이지
// 상위 5페이지는 선명하게, 이후 페이지는 blur 처리하여 구매 전환 유도

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';

// 선명하게 보여주는 페이지 수
const PREVIEW_THRESHOLD = 5;

export default function PreviewPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageImages, setPageImages] = useState([]);

  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    if (!data.bookUid) { router.push('/editor'); return; }
    setSession(data);
    fetchEstimate(data.bookUid);
    buildPagePreviews(data);
  }, [router]);

  // 페이지 미리보기 이미지 구성
  // 더미 데이터 사용 시 실제 이미지 URL 활용, 아니면 서비스별 시드 기반 플레이스홀더 사용
  const buildPagePreviews = (data) => {
    const serviceType = data.serviceType || 'baby';
    const dummy = DUMMY_DATA[serviceType];
    const dummyPages = dummy?.pages || [];

    const totalCount = data.pageCount || Math.max(dummyPages.length, 12);

    const images = Array.from({ length: totalCount }, (_, i) => {
      const dummyPage = dummyPages[i % dummyPages.length];
      return {
        index: i,
        src: dummyPage?.image || `https://picsum.photos/seed/${serviceType}-pg${i}/480/640`,
        title: dummyPage?.title || `${i + 1}페이지`,
        date: dummyPage?.date || '',
      };
    });

    setPageImages(images);
  };

  const fetchEstimate = async (bookUid) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/orders/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ bookUid, quantity: 1 }] }),
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner text-warm-600" />
      </div>
    );
  }

  const service = SERVICE_TYPES[session.serviceType];
  const spec = BOOK_SPECS[session.bookSpecUid];
  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');

  const clearPages = pageImages.slice(0, PREVIEW_THRESHOLD);
  const blurredPages = pageImages.slice(PREVIEW_THRESHOLD);
  const hasBlurred = blurredPages.length > 0;

  return (
    <div className="min-h-screen pb-20 bg-ink-50">
      <StepIndicator currentStep="preview" />

      <div className="max-w-4xl mx-auto px-6">
        {/* 헤더 */}
        <div className="text-center mb-10 opacity-0 animate-fade-up">
          <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">
            미리보기 & 가격 확인
          </h1>
          <p className="text-ink-400">책이 완성되었습니다. 일부 페이지를 미리 확인하세요.</p>
        </div>

        {/* ── 페이지 미리보기 갤러리 ── */}
        {pageImages.length > 0 && (
          <div className="mb-8 opacity-0 animate-fade-up delay-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-ink-900">
                {service.icon} 페이지 미리보기
              </h2>
              <span className="text-xs text-ink-400 bg-white border border-ink-100 px-3 py-1 rounded-full">
                전체 {pageImages.length}페이지
              </span>
            </div>

            {/* 선명한 페이지 (상위 N장) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-3">
              {clearPages.map((page) => (
                <PageCard key={page.index} page={page} blurred={false} />
              ))}
            </div>

            {/* 블러 처리된 나머지 페이지 + 구매 유도 오버레이 */}
            {hasBlurred && (
              <div className="relative">
                {/* 블러 페이지 그리드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 select-none">
                  {blurredPages.map((page) => (
                    <PageCard key={page.index} page={page} blurred={true} />
                  ))}
                </div>

                {/* 오버레이 CTA */}
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
                  style={{ background: 'linear-gradient(to bottom, rgba(249,247,243,0.15) 0%, rgba(249,247,243,0.88) 35%, rgba(249,247,243,0.97) 100%)' }}
                >
                  <div className="text-center px-6 py-8 max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-warm-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="font-display font-bold text-ink-900 text-lg mb-1">
                      나머지 {blurredPages.length}페이지
                    </p>
                    <p className="text-ink-500 text-sm mb-6 leading-relaxed">
                      전체 내용은 주문 후<br />확인하실 수 있습니다
                    </p>
                    <button
                      onClick={() => router.push('/order')}
                      disabled={!estimate || !estimate.creditSufficient}
                      className="btn-primary w-full text-sm disabled:opacity-50"
                    >
                      주문하러 가기 →
                    </button>
                    {estimate && !estimate.creditSufficient && (
                      <p className="text-xs text-red-400 mt-2">충전금이 부족합니다</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 책 정보 요약 ── */}
        <div className="bg-white rounded-2xl border border-ink-100 p-6 mb-6 opacity-0 animate-fade-up delay-200">
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

          <div className="mt-4 pt-4 border-t border-ink-100">
            <p className="text-xs text-ink-400 mb-2">입력 정보</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(session.formData || {}).map(([key, value]) =>
                value ? (
                  <span key={key} className="text-xs bg-warm-50 text-warm-800 px-2.5 py-1 rounded-full">
                    {value}
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* ── 가격 견적 ── */}
        <div className="bg-white rounded-2xl border border-ink-100 p-6 mb-6 opacity-0 animate-fade-up delay-300">
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
                <span>
                  {formatPrice(estimate.creditBalance)}원{' '}
                  {estimate.creditSufficient ? '✅' : '❌ 부족'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── 하단 버튼 ── */}
        <div className="flex gap-3 opacity-0 animate-fade-up delay-300">
          <Link href="/editor" className="btn-secondary flex-1 text-center">
            뒤로
          </Link>
          <button
            onClick={() => router.push('/order')}
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

// ── 단일 페이지 카드 컴포넌트 ──────────────────────────────────
function PageCard({ page, blurred }) {
  return (
    <div className={`relative rounded-xl overflow-hidden aspect-[3/4] bg-ink-100 shadow-sm ${blurred ? 'blur-md pointer-events-none' : ''}`}>
      {/* 페이지 이미지 */}
      <img
        src={page.src}
        alt={page.title}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />

      {/* 페이지 번호 뱃지 */}
      {!blurred && (
        <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
          {page.index + 1}p
        </div>
      )}

      {/* 하단 제목 그라디언트 */}
      {!blurred && page.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2">
          <p className="text-white text-[10px] leading-tight line-clamp-2">{page.title}</p>
        </div>
      )}
    </div>
  );
}
