'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ORDER_STATUS } from '@/lib/constants';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Webhook 이벤트 로그
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [simulatingOrder, setSimulatingOrder] = useState(null);
  // 주문별 시뮬레이션 진행 상태 (실제 SweetBook 상태와 별개로 추적)
  const [simulatedStatuses, setSimulatedStatuses] = useState({});

  // Webhook 설정 (ngrok URL 등록)
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookConfigLoading, setWebhookConfigLoading] = useState(false);
  const [webhookConfigResult, setWebhookConfigResult] = useState(null);
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);

  // 배송지 변경 모달 state
  const [shippingModal, setShippingModal] = useState(false);
  const [shippingForm, setShippingForm] = useState({
    recipientName: '',
    recipientPhone: '',
    postalCode: '',
    address1: '',
    address2: '',
    shippingMemo: '',
  });
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchWebhookEvents();
    // 30초마다 Webhook 이벤트 폴링
    const interval = setInterval(fetchWebhookEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.data?.orders || []);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetail = async (orderUid) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderUid}`);
      const data = await res.json();
      if (data.success) {
        setSelectedOrder(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancel = async (orderUid) => {
    if (!confirm('정말 이 주문을 취소하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/orders/${orderUid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReason: '고객 요청 취소' }),
      });
      const data = await res.json();
      if (data.success) {
        alert('주문이 취소되었습니다.');
        fetchOrders();
        setSelectedOrder(null);
      } else {
        alert(`취소 실패: ${data.message}`);
      }
    } catch (err) {
      alert(`취소 실패: ${err.message}`);
    }
  };

  // 배송지 변경 모달 열기 — 현재 주문 정보 pre-fill
  const openShippingModal = () => {
    if (!selectedOrder) return;
    setShippingForm({
      recipientName: selectedOrder.recipientName || '',
      recipientPhone: selectedOrder.recipientPhone || '',
      postalCode: selectedOrder.postalCode || '',
      address1: selectedOrder.address1 || '',
      address2: selectedOrder.address2 || '',
      shippingMemo: selectedOrder.shippingMemo || '',
    });
    setShippingError(null);
    setShippingModal(true);
  };

  const handleShippingSubmit = async (e) => {
    e.preventDefault();
    setShippingLoading(true);
    setShippingError(null);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.orderUid}/shipping`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shippingForm),
      });
      const data = await res.json();
      if (data.success) {
        // 모달 닫고, 상세 정보 갱신
        setShippingModal(false);
        await fetchOrderDetail(selectedOrder.orderUid);
        alert('배송지가 변경되었습니다.');
      } else {
        setShippingError(data.message || '배송지 변경에 실패했습니다.');
      }
    } catch (err) {
      setShippingError(err.message);
    } finally {
      setShippingLoading(false);
    }
  };

  // Webhook 이벤트 로그 조회
  const fetchWebhookEvents = async () => {
    try {
      const res = await fetch('/api/webhooks/sweetbook?limit=50');
      const data = await res.json();
      if (data.success) {
        setWebhookEvents(data.events || []);
      }
    } catch (err) {
      console.error('[Webhook 조회 실패]:', err.message);
    }
  };

  // Webhook 상태 변경 시뮬레이션 (로컬 시연용)
  const handleSimulateWebhook = async (orderUid, currentStatus) => {
    setSimulatingOrder(orderUid);
    try {
      const res = await fetch('/api/webhooks/sweetbook/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderUid, currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        // 시뮬레이션된 상태를 주문별로 추적 — 목록 뱃지 + 모달에 반영
        const nextSimulatedStatus = data.simulatedEvent?.status;
        if (nextSimulatedStatus !== undefined) {
          setSimulatedStatuses(prev => ({ ...prev, [orderUid]: nextSimulatedStatus }));
        }
        // 이벤트 로그 즉시 갱신 + 주문 목록 갱신
        await Promise.all([fetchWebhookEvents(), fetchOrders()]);
        if (selectedOrder?.orderUid === orderUid) {
          await fetchOrderDetail(orderUid);
        }
      }
    } catch (err) {
      console.error('[시뮬레이션 실패]:', err.message);
    } finally {
      setSimulatingOrder(null);
    }
  };

  // Webhook URL 등록 (SweetBook API PUT /webhooks/config)
  const handleWebhookConfig = async () => {
    if (!webhookUrl.startsWith('https://')) {
      setWebhookConfigResult({ success: false, message: 'https:// URL이 필요합니다. ngrok URL을 입력하세요.' });
      return;
    }
    setWebhookConfigLoading(true);
    setWebhookConfigResult(null);
    try {
      const fullUrl = webhookUrl.replace(/\/$/, '') + '/api/webhooks/sweetbook';
      const res = await fetch('/api/webhooks/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: fullUrl }),
      });
      const data = await res.json();
      setWebhookConfigResult(data);
    } catch (err) {
      setWebhookConfigResult({ success: false, message: err.message });
    } finally {
      setWebhookConfigLoading(false);
    }
  };

  // Webhook 테스트 이벤트 전송
  const handleWebhookTest = async (eventType = 'order.created') => {
    setWebhookTestLoading(true);
    try {
      const res = await fetch('/api/webhooks/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType }),
      });
      const data = await res.json();
      if (data.success) {
        // 이벤트 로그 갱신
        setTimeout(fetchWebhookEvents, 1500);
      }
      setWebhookConfigResult(data);
    } catch (err) {
      setWebhookConfigResult({ success: false, message: err.message });
    } finally {
      setWebhookTestLoading(false);
    }
  };

  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  // raw UID(예: ord_AbCdEfGhIjKl)를 사용자 친화적 짧은 주문번호로 변환
  const formatOrderId = (uid) => {
    if (!uid) return '—';
    const clean = uid.replace(/^[a-z]+_/i, ''); // ord_ 같은 접두사 제거
    return `#${clean.slice(-8).toUpperCase()}`; // 마지막 8자리만 대문자로
  };

  const getStatusBadge = (status) => {
    const info = ORDER_STATUS[status] || { label: `상태 ${status}`, color: 'gray' };
    const colorMap = {
      blue: 'bg-blue-100 text-blue-700',
      cyan: 'bg-cyan-100 text-cyan-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      lime: 'bg-lime-100 text-lime-700',
      green: 'bg-green-100 text-green-700',
      teal: 'bg-teal-100 text-teal-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      red: 'bg-red-100 text-red-700',
      rose: 'bg-rose-100 text-rose-700',
      gray: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colorMap[info.color] || colorMap.gray}`}>
        {info.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-peach-50 pb-20 page-transition">
      <div className="max-w-4xl mx-auto px-6 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-ink-900">주문 내역</h1>
            <p className="text-ink-400 text-sm mt-1">Book Print API를 통해 생성된 주문 목록입니다</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchOrders} className="btn-secondary text-sm !px-4 !py-2">
              새로고침
            </button>
            <Link href="/" className="btn-primary text-sm !px-4 !py-2">
              새 책 만들기
            </Link>
          </div>
        </div>

        {/* Webhook 설정 패널 (ngrok 연동) */}
        <div className="mb-6">
          <button
            onClick={() => setShowWebhookConfig(!showWebhookConfig)}
            className="text-xs font-mono text-ink-400 hover:text-ink-700 border border-ink-200 rounded px-3 py-1.5 transition-colors"
          >
            {showWebhookConfig ? '▾ Webhook 설정 닫기' : '▸ Webhook 설정 (ngrok)'}
          </button>

          {showWebhookConfig && (
            <div className="mt-3 bg-neutral-950 rounded-xl border border-neutral-800 p-5">
              <h3 className="font-mono text-sm font-bold text-white mb-1">Webhook URL 등록</h3>
              <p className="text-[11px] text-neutral-500 mb-4">
                ngrok http 3000 실행 후 발급된 https URL을 입력하세요. /api/webhooks/sweetbook 경로는 자동 추가됩니다.
              </p>

              <div className="flex gap-2 mb-3">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://xxxx-xx-xx.ngrok-free.app"
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm font-mono text-white placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
                />
                <button
                  onClick={handleWebhookConfig}
                  disabled={webhookConfigLoading || !webhookUrl}
                  className={`px-4 py-2 text-xs font-mono font-bold rounded transition-all ${
                    webhookConfigLoading
                      ? 'bg-neutral-700 text-neutral-400 cursor-wait animate-pulse'
                      : 'bg-white text-black hover:bg-neutral-200'
                  }`}
                >
                  {webhookConfigLoading ? '등록중...' : '등록'}
                </button>
              </div>

              {/* 테스트 이벤트 버튼 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">테스트 이벤트:</span>
                {['order.created', 'production.confirmed', 'shipping.departed'].map((evt) => (
                  <button
                    key={evt}
                    onClick={() => handleWebhookTest(evt)}
                    disabled={webhookTestLoading}
                    className="text-[10px] font-mono px-2 py-1 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white rounded transition-colors disabled:opacity-50"
                  >
                    {evt.split('.')[1]}
                  </button>
                ))}
              </div>

              {/* 결과 메시지 */}
              {webhookConfigResult && (
                <div className={`text-xs font-mono px-3 py-2 rounded ${
                  webhookConfigResult.success
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {webhookConfigResult.message}
                </div>
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-ink-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="skeleton-text" style={{ width: '100px', height: '20px', marginBottom: 0 }} />
                  <div className="skeleton-text" style={{ width: '70px', height: '20px', marginBottom: 0, borderRadius: '9999px' }} />
                </div>
                <div className="skeleton-text" style={{ width: '60%' }} />
                <div className="skeleton-text" style={{ width: '40%' }} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <p className="font-medium">주문 목록 조회 실패</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-ink-400 mb-6">아직 주문 내역이 없습니다</p>
            <Link href="/" className="btn-primary inline-block">첫 번째 책 만들기</Link>
          </div>
        )}

        {/* 주문 목록 */}
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.orderUid}
              className="bg-white rounded-2xl border border-ink-100 p-6 card-hover cursor-pointer"
              onClick={() => fetchOrderDetail(order.orderUid)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-sm text-ink-900">주문 {formatOrderId(order.orderUid)}</span>
                    {getStatusBadge(simulatedStatuses[order.orderUid] ?? order.orderStatus)}
                    {order.isTest && (
                      <span className="text-xs bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">Sandbox</span>
                    )}
                  </div>
                  <p className="text-sm text-ink-400">
                    {formatDate(order.orderedAt)} · {order.itemCount || 1}건 · {order.recipientName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-ink-900">{formatPrice(order.totalAmount)}원</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Webhook 이벤트 로그 */}
        {webhookEvents.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-xl text-ink-900">Webhook 이벤트 로그</h2>
                <p className="text-ink-400 text-xs mt-1">SweetBook 서버로부터 수신된 주문 상태 변경 이벤트</p>
              </div>
              <button onClick={fetchWebhookEvents} className="btn-secondary text-xs !px-3 !py-1.5">
                새로고침
              </button>
            </div>
            <div className="bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 px-4 py-2 bg-neutral-900 text-[10px] font-mono uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                <span>시각</span>
                <span>이벤트</span>
                <span>주문</span>
              </div>
              <div className="max-h-[240px] overflow-y-auto divide-y divide-neutral-800/50">
                {webhookEvents.map((evt) => (
                  <div key={evt.id} className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-center px-4 py-2 text-xs font-mono hover:bg-neutral-900/50 transition-colors">
                    <span className="text-neutral-500 text-[10px]">
                      {new Date(evt.receivedAt).toLocaleTimeString('ko-KR')}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-emerald-400 font-medium">{evt.eventType}</span>
                      {evt.simulated && <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">SIM</span>}
                      {evt.isTest && <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded">TEST</span>}
                      {evt.trackingNumber && <span className="text-[9px] text-cyan-400">{evt.trackingNumber}</span>}
                    </span>
                    <span className="text-neutral-400 truncate">
                      {evt.orderUid?.slice(-8) || '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 주문 상세 모달 */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setSelectedOrder(null); }}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 modal-enter" onClick={(e) => e.stopPropagation()}>
              {detailLoading ? (
                <div className="space-y-4 py-4">
                  <div className="flex justify-between"><div className="skeleton-heading" style={{ width: '120px' }} /><div className="skeleton-circle" style={{ width: '24px', height: '24px' }} /></div>
                  <div className="skeleton-text" /><div className="skeleton-text" /><div className="skeleton-text" style={{ width: '50%' }} />
                  <div className="skeleton-card" style={{ height: '80px' }} />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-xl text-ink-900">주문 상세</h2>
                    <button onClick={() => { setSelectedOrder(null); }} className="text-ink-400 hover:text-ink-800 text-xl">✕</button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-sm items-center">
                      <span className="text-ink-400">주문번호</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink-900">{formatOrderId(selectedOrder.orderUid)}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(selectedOrder.orderUid)}
                          title="전체 주문번호 복사"
                          className="text-xs text-ink-400 hover:text-ink-700 border border-ink-200 rounded px-1.5 py-0.5 transition-colors"
                        >
                          복사
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-400">상태</span>
                      {getStatusBadge(simulatedStatuses[selectedOrder.orderUid] ?? selectedOrder.orderStatus)}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-400">주문일시</span>
                      <span className="text-ink-800">{formatDate(selectedOrder.orderedAt)}</span>
                    </div>

                    <div className="border-t border-ink-100 pt-4">
                      <p className="text-xs text-ink-400 mb-2">주문 항목</p>
                      {selectedOrder.items?.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-ink-600">{item.bookTitle || item.bookUid} × {item.quantity}</span>
                          <span className="text-ink-800">{formatPrice(item.itemAmount)}원</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-ink-100 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-400">상품금액</span>
                        <span>{formatPrice(selectedOrder.totalProductAmount)}원</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-400">배송비</span>
                        <span>{formatPrice(selectedOrder.totalShippingFee)}원</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-400">포장비</span>
                        <span>{formatPrice(selectedOrder.totalPackagingFee)}원</span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t border-ink-100">
                        <span>합계</span>
                        <span className="text-warm-600">{formatPrice(selectedOrder.totalAmount)}원</span>
                      </div>
                    </div>

                    <div className="border-t border-ink-100 pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-ink-400">배송지</p>
                        {/* 배송지 변경 버튼: PAID(20)·PDF_READY(25)·CONFIRMED(30) 이하에서만 노출 */}
                        {[20, 25, 30].includes(selectedOrder.orderStatus) && (
                          <button
                            onClick={openShippingModal}
                            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5 transition-colors"
                          >
                            배송지 변경
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-ink-800">{selectedOrder.recipientName} ({selectedOrder.recipientPhone})</p>
                      <p className="text-sm text-ink-600">[{selectedOrder.postalCode}] {selectedOrder.address1} {selectedOrder.address2}</p>
                      {selectedOrder.shippingMemo && <p className="text-sm text-ink-400 mt-1">메모: {selectedOrder.shippingMemo}</p>}
                    </div>

                    {/* 취소 버튼 (PAID·PDF_READY 상태: 제작 확정 전까지 가능) */}
                    {[20, 25].includes(selectedOrder.orderStatus) && (
                      <button
                        onClick={() => handleCancel(selectedOrder.orderUid)}
                        className="w-full mt-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
                      >
                        주문 취소
                      </button>
                    )}

                    {/* Webhook 시뮬레이션 (로컬 시연용) */}
                    {(() => {
                      const currentSimStatus = simulatedStatuses[selectedOrder.orderUid] ?? selectedOrder.orderStatus;
                      if (currentSimStatus >= 70) return null;
                      return (
                        <div className="border-t border-ink-100 pt-4 mt-4">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-400 mb-2">Webhook 시뮬레이션</p>
                          <button
                            onClick={() => handleSimulateWebhook(selectedOrder.orderUid, currentSimStatus)}
                            disabled={simulatingOrder === selectedOrder.orderUid}
                            className={`w-full py-2 text-xs font-mono rounded-lg border transition-all ${
                              simulatingOrder === selectedOrder.orderUid
                                ? 'bg-neutral-100 text-neutral-400 border-neutral-200 cursor-wait animate-pulse'
                                : 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700'
                            }`}
                          >
                            {simulatingOrder === selectedOrder.orderUid
                              ? '시뮬레이션 중...'
                              : `다음 상태로 전이 (현재: ${currentSimStatus})`}
                          </button>
                          <p className="text-[10px] text-ink-400 mt-1">localhost에서 SweetBook Webhook 수신을 시뮬레이션합니다</p>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 배송지 변경 모달 */}
        {shippingModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setShippingModal(false)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-bold text-lg text-ink-900">배송지 변경</h3>
                <button onClick={() => setShippingModal(false)} className="text-ink-400 hover:text-ink-800 text-xl">✕</button>
              </div>

              <form onSubmit={handleShippingSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-ink-500 mb-1">수령인 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.recipientName}
                    onChange={(e) => setShippingForm((f) => ({ ...f, recipientName: e.target.value }))}
                    required
                    className="input-field w-full text-sm"
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 mb-1">연락처 <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    value={shippingForm.recipientPhone}
                    onChange={(e) => setShippingForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                    required
                    className="input-field w-full text-sm"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 mb-1">우편번호 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.postalCode}
                    onChange={(e) => setShippingForm((f) => ({ ...f, postalCode: e.target.value }))}
                    required
                    className="input-field w-full text-sm"
                    placeholder="12345"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 mb-1">주소 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={shippingForm.address1}
                    onChange={(e) => setShippingForm((f) => ({ ...f, address1: e.target.value }))}
                    required
                    className="input-field w-full text-sm"
                    placeholder="기본 주소"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 mb-1">상세 주소</label>
                  <input
                    type="text"
                    value={shippingForm.address2}
                    onChange={(e) => setShippingForm((f) => ({ ...f, address2: e.target.value }))}
                    className="input-field w-full text-sm"
                    placeholder="동/호수 등"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ink-500 mb-1">배송 메모</label>
                  <input
                    type="text"
                    value={shippingForm.shippingMemo}
                    onChange={(e) => setShippingForm((f) => ({ ...f, shippingMemo: e.target.value }))}
                    className="input-field w-full text-sm"
                    placeholder="예) 문 앞에 놓아주세요"
                  />
                </div>

                {shippingError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                    {shippingError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShippingModal(false)}
                    className="flex-1 py-2.5 border border-ink-200 text-ink-600 rounded-lg text-sm hover:bg-ink-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={shippingLoading}
                    className="flex-1 py-2.5 btn-primary text-sm disabled:opacity-50"
                  >
                    {shippingLoading ? '변경 중...' : '저장'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
