'use client';

// src/app/preview/page.jsx
// 미리보기 & 가격 확인 페이지
// 에디터에서 작성된 실제 데이터 기반 스프레드 뷰(Spread View) 렌더링
// 상위 스프레드는 선명하게, 이후는 blur 처리하여 구매 전환 유도

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPES, BOOK_SPECS, BOOK_SPEC_LABELS } from '@/lib/constants';
import { DUMMY_DATA } from '@/data/dummy';
import StepIndicator from '@/components/StepIndicator';

// 선명하게 보여주는 스프레드 수
const CLEAR_SPREAD_COUNT = 3;

export default function PreviewPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState(null);

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
      // 폴백: 더미 데이터 기반 미리보기 구성
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
      coverFront: { url: pages[0]?.imageUrl, title: data.formData?.bookTitle || SERVICE_TYPES[serviceType]?.name || '표지' },
      coverBack:  { url: pages[pages.length - 1]?.imageUrl, title: '뒤표지' },
      pages: pages.slice(1, -1),
    });
  };

  // 스프레드 그룹 생성: [뒤표지|앞표지], [내지1|내지2], [내지3|내지4], ...
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

  const clearSpreads = spreads.slice(0, CLEAR_SPREAD_COUNT + 1); // +1 for cover
  const blurredSpreads = spreads.slice(CLEAR_SPREAD_COUNT + 1);

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
  const totalPages = previewData?.pages?.length || 0;
  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');

  return (
    <div className="min-h-screen pb-20 bg-ink-50">
      <StepIndicator currentStep="preview" />

      <div className="max-w-5xl mx-auto px-6">
        {/* 헤더 */}
        <div className="text-center mb-10 opacity-0 animate-fade-up">
          <h1 className="font-display font-bold text-3xl text-ink-900 mb-2">
            스프레드 미리보기
          </h1>
          <p className="text-ink-400">
            책을 펼친 모습으로 미리 확인하세요 — 총 {totalPages}페이지, {spreads.length}스프레드
          </p>
        </div>

        {/* ── 스프레드 뷰 ── */}
        {spreads.length > 0 && (
          <div className="mb-10 space-y-6 opacity-0 animate-fade-up delay-100">
            {/* 선명한 스프레드 */}
            {clearSpreads.map((spread, idx) => (
              <SpreadCard key={idx} spread={spread} index={idx} blurred={false} />
            ))}

            {/* 블러 스프레드 + 구매 유도 오버레이 */}
            {blurredSpreads.length > 0 && (
              <div className="relative">
                <div className="space-y-6 select-none">
                  {blurredSpreads.slice(0, 3).map((spread, idx) => (
                    <SpreadCard key={idx} spread={spread} index={clearSpreads.length + idx} blurred={true} />
                  ))}
                </div>

                {/* 오버레이 CTA */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
                  style={{ background: 'linear-gradient(to bottom, rgba(249,247,243,0.1) 0%, rgba(249,247,243,0.85) 30%, rgba(249,247,243,0.98) 100%)' }}
                >
                  <div className="text-center px-6 py-8 max-w-sm">
                    <div className="w-14 h-14 rounded-2xl bg-warm-100 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="font-display font-bold text-ink-900 text-lg mb-1">
                      나머지 {blurredSpreads.length}스프레드
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
              <p className="text-sm font-medium text-ink-800">{BOOK_SPEC_LABELS[session.bookSpecUid] || spec?.name || session.bookSpecUid}</p>
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

// ── 스프레드 카드 (책을 펼친 2페이지 뷰) ──────────────────────────
function SpreadCard({ spread, index, blurred }) {
  const isCover = spread.type === 'cover';

  return (
    <div className={`${blurred ? 'blur-md pointer-events-none' : ''}`}>
      {/* 스프레드 라벨 */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-medium text-ink-500 bg-white border border-ink-100 px-2.5 py-0.5 rounded-full">
          {isCover ? '📔 표지 스프레드' : `📖 스프레드 ${index}`}
        </span>
        {!isCover && (
          <span className="text-[10px] text-ink-400">
            {spread.pageNumL}–{spread.pageNumR}쪽
          </span>
        )}
      </div>

      {/* 스프레드 본체: 책등(Spine) 구분선 + 좌/우 페이지 */}
      <div
        className="relative bg-white rounded-2xl overflow-hidden border border-ink-200"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)' }}
      >
        {/* 책등 중앙 그림자 효과 */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 30%, transparent 50%, rgba(0,0,0,0.02) 70%, rgba(0,0,0,0.06) 100%)',
          }}
        />
        {/* 책등 중앙선 */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-[0.5px] w-[1px] bg-ink-200 z-10" />

        <div className="grid grid-cols-2">
          {/* 왼쪽 페이지 */}
          <SpreadPage
            page={spread.left}
            side="left"
            isCover={isCover}
            label={isCover ? spread.left?.label : null}
            pageNum={!isCover ? spread.pageNumL : null}
          />
          {/* 오른쪽 페이지 */}
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
  );
}

// ── 스프레드 내 단일 페이지 렌더링 ────────────────────────────────
function SpreadPage({ page, side, isCover, label, pageNum }) {
  if (!page) {
    // 빈 페이지 (내지 홀수일 때 우측이 비는 경우)
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
          onError={(e) => {
            e.target.style.display = 'none';
          }}
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
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-3 py-3">
          {page.title && (
            <p className="text-white font-bold text-[11px] leading-tight mb-0.5">{page.title}</p>
          )}
          <p className="text-white/80 text-[10px] leading-relaxed line-clamp-3">{page.text}</p>
        </div>
      )}

      {/* 이미지만 있는 페이지(Full-bleed) — 제목만 하단에 */}
      {hasImage && !hasText && page.title && !isCover && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-2">
          <p className="text-white text-[10px] leading-tight line-clamp-1">{page.title}</p>
        </div>
      )}

      {/* 표지 라벨 */}
      {isCover && label && (
        <div className="absolute top-2 left-2 bg-warm-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          {label}
        </div>
      )}

      {/* 표지 타이틀 오버레이 */}
      {isCover && hasImage && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-3">
          <p className="text-white font-display font-bold text-sm leading-tight">{page.title}</p>
        </div>
      )}

      {/* 페이지 번호 */}
      {pageNum && (
        <div className={`absolute bottom-1.5 text-[9px] text-ink-400 ${side === 'left' ? 'left-2' : 'right-2'}`}>
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
