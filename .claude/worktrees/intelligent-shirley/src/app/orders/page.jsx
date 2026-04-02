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

  useEffect(() => {
    fetchOrders();
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

  const formatPrice = (n) => (n ? n.toLocaleString('ko-KR') : '—');
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const getStatusBadge = (status) => {
    const info = ORDER_STATUS[status] || { label: `상태 ${status}`, color: 'gray' };
    const colorMap = {
      blue: 'bg-blue-100 text-blue-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      yellow: 'bg-yellow-100 text-yellow-700',
      green: 'bg-green-100 text-green-700',
      teal: 'bg-teal-100 text-teal-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      red: 'bg-red-100 text-red-700',
      gray: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${colorMap[info.color]}`}>
        {info.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen pb-20">
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

        {loading && (
          <div className="flex items-center justify-center py-20">
            <span className="spinner text-warm-600 mr-3" />
            <span className="text-ink-400">주문 목록을 불러오고 있습니다...</span>
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
                    <span className="font-mono text-sm text-ink-600">{order.orderUid}</span>
                    {getStatusBadge(order.orderStatus)}
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

        {/* 주문 상세 모달 */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
              {detailLoading ? (
                <div className="flex items-center justify-center py-8"><span className="spinner text-warm-600" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display font-bold text-xl text-ink-900">주문 상세</h2>
                    <button onClick={() => setSelectedOrder(null)} className="text-ink-400 hover:text-ink-800 text-xl">✕</button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-400">주문번호</span>
                      <span className="font-mono text-ink-800">{selectedOrder.orderUid}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-400">상태</span>
                      {getStatusBadge(selectedOrder.orderStatus)}
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
                      <p className="text-xs text-ink-400 mb-2">배송지</p>
                      <p className="text-sm text-ink-800">{selectedOrder.recipientName} ({selectedOrder.recipientPhone})</p>
                      <p className="text-sm text-ink-600">[{selectedOrder.postalCode}] {selectedOrder.address1} {selectedOrder.address2}</p>
                      {selectedOrder.shippingMemo && <p className="text-sm text-ink-400 mt-1">메모: {selectedOrder.shippingMemo}</p>}
                    </div>

                    {/* 취소 버튼 (PAID 상태일 때만) */}
                    {selectedOrder.orderStatus === 20 && (
                      <button
                        onClick={() => handleCancel(selectedOrder.orderUid)}
                        className="w-full mt-4 py-2.5 border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors"
                      >
                        주문 취소
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
