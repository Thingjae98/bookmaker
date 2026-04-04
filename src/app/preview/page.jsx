'use client';

// src/app/preview/page.jsx
// 미리보기 & 가격 확인 페이지
// 실제 책을 펼쳐 넘기는 듯한 스프레드 페이징(Spread Paging) 뷰
// [< 이전] [다음 >] 버튼으로 2페이지(스프레드)씩 이동

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';

export default function PreviewPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [currentSpread, setCurrentSpread] = useState(0); // 현재 스프레드 인덱스

  useEffect(() => {
    const raw = sessionStorage.getItem('bookmaker_session');
    if (!raw) { router.push('/'); return; }
    const data = JSON.parse(raw);
    if (!data.bookUid) { router.push('/editor'); return; }
    setSession(data);
    fetchEstimate(data.bookUid);

    // 에디터에서 저장한 실데이터 로드
    const previewRaw = sessionStorage.getItem('bookmaker_preview');
    if (previewRaw) {
      setPreviewData(JSON.parse(previewRaw));
    } else {
      buildFallbackPreview(data);
    }
  }, [router]);

  // 폴백: 에디터 데이터가 없을 때 더미 기반 구성
  const buildFallbackPreview = (data) => {
    const serviceType = data.serviceType || 'baby';
    const dummy = DUMMY_DATA[serviceType];
    const dummyPages = dummy?.pages || [];
    const totalCount = data.pageCount || Math.max(dummyPages.length, 12);

    const pages = Array.from({ length: totalCount }, (_, i) => {
      const dp = dummyPages[i % dummyPages.length];
      return {
        imageUrl: dp?.image || `https://picsum.photos/seed/${serviceType}-pg${i}/480/640`,
        title: dp?.title || `${i + 1}페이지`,
        text: dp?.text || '',
        date: dp?.date || '',
      };
    });

    setPreviewData({
      coverFront: {
        url: dummy?.frontCover?.image || pages[0]?.imageUrl,
        title: data.formData?.bookTitle || SERVICE_TYPES[serviceType]?.name || '표지',
      },
      coverBack: {
        url: dummy?.backCover?.image || pages[pages.length - 1]?.imageUrl,
        title: '뒤표지',
      },
      pages,
    });
  };

  // 스프레드 그룹 생성: [뒤표지|앞표지], [내지1|내지2], ...
  const spreads = useMemo(() => {
    if (!previewData) return [];
    const result = [];

    // 첫 스프레드: 표지 (뒤표지 좌 | 앞표지 우)
    result.push({
      type: 'cover',
      left:  { imageUrl: previewData.coverBack?.url,  title: previewData.coverBack?.title  || '뒤표지', isCover: true, label: '뒤표지' },
      right: { imageUrl: previewData.coverFront?.url, title: previewData.coverFront?.title || '앞표지', isCover: true, label: '앞표지' },
    });

    // 내지 스프레드: 2페이지씩 묶기
    const pages = previewData.pages || [];
    for (let i = 0; i < pages.length; i += 2) {
      result.push({
        type: 'content',
        left:  pages[i] || null,
        right: pages[i + 1] || null,
        pageNumL: i + 1,
        pageNumR: i + 2,
      });
    }

    return result;
  }, [previewData]);

  // 네비게이션
  const totalSpreads = spreads.length;
  const goPrev = useCallback(() => setCurrentSpread((p) => Math.max(0, p - 1)), []);
  const goNext = useCallback(() => setCurrentSpread((p) => Math.min(totalSpreads - 1, p + 1)), [totalSpreads]);

  // 키보드 좌/우 화살표
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext]);

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
  const totalPages = previewData?.pages?.length || 0;
  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');
  const spread = spreads[currentSpread] || null;
  const isCover = spread?.type === 'cover';

  // 블러 여부: 표지(0) + 상위 3 스프레드(1~3)는 선명, 나머지 블러
  const CLEAR_LIMIT = 4; // 0=표지, 1~3=상위 내지
  const isBlurred = currentSpread >= CLEAR_LIMIT;

  return (
    <div className="min-h-screen pb-20 bg-ink-50">
      <StepIndicator currentStep="preview" />

      <div className="max-w-5xl mx-auto px-6">
        {/* 헤더 */}
        <div className="text-center mb-6 opacity-0 animate-fade-up">
          <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">
            미리보기
          </h1>
          <p className="text-ink-400">
            총 {totalPages}페이지 · {totalSpreads}스프레드
          </p>
        </div>

        {/* ── 스프레드 뷰어 (중앙 고정, 좌우 버튼) ── */}
        {spread && (
          <div className="mb-8 opacity-0 animate-fade-up delay-100">
            {/* 스프레드 라벨 */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-[11px] font-medium text-ink-500 bg-white border border-ink-100 px-3 py-1 rounded-full">
                {isCover ? '표지 스프레드' : `스프레드 ${currentSpread}`}
              </span>
              {!isCover && (
                <span className="text-[10px] text-ink-400">
                  {spread.pageNumL}–{spread.pageNumR}쪽
                </span>
              )}
            </div>

            {/* 메인 뷰어: [< 이전] [스프레드] [다음 >] */}
            <div className="flex items-center justify-center gap-4">
              {/* 이전 버튼 */}
              <button
                onClick={goPrev}
                disabled={currentSpread === 0}
                className="shrink-0 w-12 h-12 rounded-full bg-white border border-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-50 hover:border-ink-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                aria-label="이전 스프레드"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {/* 스프레드 본체 */}
              <div className="flex-1 max-w-3xl relative">
                {/* 블러 오버레이 */}
                {isBlurred && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl backdrop-blur-sm"
                    style={{ background: 'rgba(249,247,243,0.75)' }}
                  >
                    <div className="text-center px-6 py-6 max-w-xs">
                      <div className="w-12 h-12 rounded-2xl bg-warm-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <p className="font-display font-bold text-ink-900 text-base mb-1">
                        미리보기 잠금
                      </p>
                      <p className="text-ink-500 text-sm mb-4 leading-relaxed">
                        전체 내용은 주문 후 확인하실 수 있습니다
                      </p>
                      <button
                        onClick={() => router.push('/order')}
                        disabled={!estimate || !estimate.creditSufficient}
                        className="btn-primary w-full text-sm disabled:opacity-50"
                      >
                        주문하러 가기
                      </button>
                    </div>
                  </div>
                )}

                {/* 책 본체 */}
                <div
                  className="relative bg-white rounded-2xl overflow-hidden border border-ink-200"
                  style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.05)' }}
                >
                  {/* 책등 중앙 그림자 효과 */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 z-10 pointer-events-none"
                    style={{
                      background: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 25%, transparent 50%, rgba(0,0,0,0.03) 75%, rgba(0,0,0,0.08) 100%)',
                    }}
                  />
                  {/* 책등 중앙선 */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-[0.5px] w-[1px] bg-ink-200/80 z-10" />

                  <div className="grid grid-cols-2">
                    <SpreadPage
                      page={spread.left}
                      side="left"
                      isCover={isCover}
                      label={isCover ? spread.left?.label : null}
                      pageNum={!isCover ? spread.pageNumL : null}
                    />
                    <SpreadPage
                      page={spread.right}
                      side="right"
                      isCover={isCover}
                      label={isCover ? spread.right?.label : null}
                      pageNum={!isCover ? spread.pageNumR : null}
                    />
                  </div>
                </div>
              </div>

              {/* 다음 버튼 */}
              <button
                onClick={goNext}
                disabled={currentSpread >= totalSpreads - 1}
                className="shrink-0 w-12 h-12 rounded-full bg-white border border-ink-200 flex items-center justify-center text-ink-500 hover:bg-ink-50 hover:border-ink-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                aria-label="다음 스프레드"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* 페이지 인디케이터 */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              {spreads.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSpread(idx)}
                  className={`transition-all rounded-full ${
                    idx === currentSpread
                      ? 'w-6 h-2 bg-warm-600'
                      : idx < CLEAR_LIMIT
                        ? 'w-2 h-2 bg-ink-300 hover:bg-ink-400'
                        : 'w-2 h-2 bg-ink-200 hover:bg-ink-300'
                  }`}
                  aria-label={`스프레드 ${idx}`}
                />
              ))}
            </div>

            {/* 키보드 힌트 */}
            <p className="text-center text-[10px] text-ink-300 mt-2">
              키보드 ← → 로 탐색
            </p>
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
              <p className="text-sm font-medium text-ink-800">{BOOK_SPEC_LABELS[session.bookSpecUid] || session.bookSpecUid}</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl">
              <p className="text-xs text-ink-400 mb-0.5">Book UID</p>
              <p className="text-sm font-mono text-ink-600 break-all">{session.bookUid}</p>
            </div>
            <div className="p-3 bg-ink-50 rounded-xl">
              <p className="text-xs text-ink-400 mb-0.5">페이지 수</p>
              <p className="text-sm font-medium text-ink-800">{session.pageCount || totalPages || '—'} 페이지</p>
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
          <h2 className="font-display font-bold text-lg text-ink-900 mb-4">가격 견적</h2>

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
            다음: 주문하기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 스프레드 내 단일 페이지 렌더링 ────────────────────────────────
function SpreadPage({ page, side, isCover, label, pageNum }) {
  if (!page) {
    return (
      <div className="aspect-[3/4] bg-ink-50 flex items-center justify-center">
        <span className="text-ink-300 text-xs">빈 페이지</span>
      </div>
    );
  }

  const hasImage = !!page.imageUrl;
  const hasText = !!(page.text || '').trim();
  const isTextOnly = !hasImage && hasText;

  return (
    <div className={`relative aspect-[3/4] overflow-hidden ${side === 'left' ? 'border-r-0' : 'border-l-0'}`}>
      {/* 이미지가 있는 페이지 */}
      {hasImage && (
        <img
          src={page.imageUrl}
          alt={page.title || ''}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}

      {/* 텍스트 전용 페이지 */}
      {isTextOnly && (
        <div className="w-full h-full bg-cream flex flex-col justify-center px-6 py-8">
          {page.title && (
            <p className="font-display font-bold text-ink-800 text-sm mb-3 leading-tight">{page.title}</p>
          )}
          <p className="text-ink-600 text-[11px] leading-relaxed line-clamp-[12]">{page.text}</p>
          {page.date && (
            <p className="text-ink-400 text-[10px] mt-auto pt-3">{page.date}</p>
          )}
        </div>
      )}

      {/* 이미지+텍스트 오버레이 */}
      {hasImage && hasText && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 py-4">
          {page.title && (
            <p className="text-white font-bold text-xs leading-tight mb-1">{page.title}</p>
          )}
          <p className="text-white/80 text-[11px] leading-relaxed line-clamp-3">{page.text}</p>
        </div>
      )}

      {/* 이미지만 있는 페이지(Full-bleed) */}
      {hasImage && !hasText && page.title && !isCover && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
          <p className="text-white text-[10px] leading-tight line-clamp-1">{page.title}</p>
        </div>
      )}

      {/* 표지 라벨 배지 */}
      {isCover && label && (
        <div className="absolute top-3 left-3 bg-warm-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
          {label}
        </div>
      )}

      {/* 표지 타이틀 */}
      {isCover && hasImage && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-4">
          <p className="text-white font-display font-bold text-base leading-tight">{page.title}</p>
        </div>
      )}

      {/* 페이지 번호 */}
      {pageNum && (
        <div className={`absolute bottom-2 text-[9px] text-ink-400/60 ${side === 'left' ? 'left-3' : 'right-3'}`}>
          {pageNum}
        </div>
      )}

      {/* 이미지도 텍스트도 없는 빈 페이지 */}
      {!hasImage && !hasText && (
        <div className="w-full h-full bg-ink-50 flex items-center justify-center">
          <span className="text-ink-300 text-[10px]">{page.title || '빈 페이지'}</span>
        </div>
      )}
    </div>
  );
}
