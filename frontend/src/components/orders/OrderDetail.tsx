import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ProductItem from "../products/ProductItem";
import { NavBar } from "@/components/ui/navbar";
import EditOrderForm from "./EditOrderForm";
import { getSessionIdFromCookie } from '../../lib/utils';
import { apiUrl } from '../../config';

export default function OrderDetail() {
  const { order_id } = useParams<{ order_id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [editing, setEditing] = useState(false);

  const loadOrder = () => {
    if (!order_id) return;
    setLoading(true);
    const sessionId = getSessionIdFromCookie();
    fetch(apiUrl(`/api/v1/orders/${order_id}`), {
      headers: { 'Authorization': `Bearer ${sessionId}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch order details");
        return res.json();
      })
      .then((data) => {
        setOrder(data);
        setError(null);
        // Fetch product details for each order item
        if (data.items && data.items.length > 0) {
          Promise.all(
            data.items.map((item: any) => {
              return fetch(apiUrl(`/api/v1/products/${item.product_id}`), {
                headers: { 'Authorization': `Bearer ${sessionId}` }
              })
                .then((res) => res.ok ? res.json() : null)
                .catch(() => null)
            })
          ).then((products) => setProducts(products.filter(Boolean)));
        } else {
          setProducts([]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order_id]);

  const handleCancelOrder = async () => {
    if (!order_id) return;
    setCancelling(true);
    const sessionId = getSessionIdFromCookie();
    try {
      const res = await fetch(apiUrl(`/api/v1/orders/${order_id}`), { method: 'DELETE', headers: { 'Authorization': `Bearer ${sessionId}` } });
      if (!res.ok) throw new Error('Failed to cancel order');
      // Show banner on /orders
      localStorage.setItem(
        'deletedOrderBanner',
        JSON.stringify({ customer_email: order.customer_email, itemCount: order.items.length })
      );
      navigate('/orders');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="text-center py-8" data-testId="order-detail-loading">Loading order details...</div>;
  if (error) return <div className="text-center text-red-500 py-8" data-testId="order-detail-error">{error}</div>;
  if (!order) return <div className="text-center py-8" data-testId="order-detail-notfound">Order not found.</div>;

  const subtotal = (order.items ?? []).reduce((sum: number, item: any) => {
    const product = products.find((p) => String(p.product_id) === String(item.product_id));
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);
  const discountPercent = order.discount_percent ?? 0;

  return (
    <div className="min-h-screen bg-white px-6 py-10" style={{ width: '100%', maxWidth: '64rem', margin: '0 auto', boxSizing: 'border-box' }} data-testId="order-detail-root">
      {/* Top Navigation */}
      <NavBar active="orders" />
      {editing && (
        <EditOrderForm
          order={order}
          onClose={() => setEditing(false)}
          onSaved={() => loadOrder()}
        />
      )}
      {/* Move heading and details to align with nav bar (same left padding) */}
      <div className="w-full" style={{ width: '100%', maxWidth: '48rem', margin: '0 auto', padding: 0 }} data-testId="order-detail-main">
        <h1
          style={{
            fontWeight: 700,
            fontSize: '1.5rem',
            lineHeight: '2rem',
            textAlign: 'left',
            margin: 0,
            marginTop: '1.5rem',
            marginBottom: '1.5rem',
            paddingLeft: 0,
          }}
          data-testId="order-detail-heading"
        >
          Order Details
        </h1>
        <div className="mb-8" style={{ textAlign: 'left', paddingLeft: 0, marginBottom: '2.5rem' }} data-testId="order-detail-info">
          <div style={{ marginBottom: '1rem', textAlign: 'left' }} className="mb-1" data-testId="order-detail-customer-email">
            <span style={{ color: '#9ca3af', display: 'block', textAlign: 'left' }} data-testId="order-detail-label-customer-email">Customer Email:</span>
            <div style={{ fontSize: '1.125rem', fontWeight: 500 }} className="text-gray-900 mt-1" data-testId="order-detail-value-customer-email">{order.customer_email}</div>
          </div>
          <div style={{ marginBottom: '1rem' }} className="mb-1" data-testId="order-detail-status">
            <span style={{ color: '#9ca3af' }} data-testId="order-detail-label-status">Status:</span>
            <div style={{ fontSize: '1.125rem', fontWeight: 500, textTransform: 'capitalize' }} className="text-gray-900 mt-1" data-testId="order-detail-value-status">{order.status === 'confirmed' ? 'Confirmed' : order.status}</div>
          </div>
          <div style={{ marginBottom: '1rem' }} className="mb-1" data-testId="order-detail-subtotal">
            <span style={{ color: '#9ca3af' }} data-testId="order-detail-label-subtotal">Subtotal:</span>
            <div style={{ fontSize: '1.125rem', fontWeight: 500 }} className="text-gray-900 mt-1" data-testId="order-detail-value-subtotal">${subtotal.toFixed(2)}</div>
          </div>
          {discountPercent > 0 && (
            <div style={{ marginBottom: '1rem' }} className="mb-1" data-testId="order-detail-discount">
              <span style={{ color: '#9ca3af' }} data-testId="order-detail-label-discount">Discount:</span>
              <div style={{ fontSize: '1.125rem', fontWeight: 500, color: '#16a34a' }} className="mt-1" data-testId="order-detail-value-discount">{discountPercent}% (−${(subtotal - order.total_amount).toFixed(2)})</div>
            </div>
          )}
          <div style={{ marginBottom: '1rem' }} className="mb-1" data-testId="order-detail-total">
            <span style={{ color: '#9ca3af' }} data-testId="order-detail-label-total">Total:</span>
            <div style={{ fontSize: '1.125rem', fontWeight: 500 }} className="text-gray-900 mt-1" data-testId="order-detail-value-total">${order.total_amount.toFixed(2)}</div>
          </div>
        </div>
        <h2 style={{ fontWeight: 700, fontSize: '1.5rem', lineHeight: '2rem', textAlign: 'left', margin: 0, marginBottom: '1.5rem', paddingLeft: 0 }} data-testId="order-detail-items-heading">
          Order Items
        </h2>
        <div className="flex flex-col gap-4 mb-8" style={{ textAlign: 'left', paddingLeft: 0 }} data-testId="order-detail-items">
          {products.length === 0 && <div className="text-gray-500" data-testId="order-detail-no-products">No products found for this order.</div>}
          {products.map((product, idx) => {
            // Find the quantity for this product from order.items
            const item = order.items?.find((i: any) => String(i.product_id) === String(product.product_id));
            const quantity = item?.quantity ?? 1;
            return (
              <div key={product.product_id || idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ minWidth: '2.5rem', textAlign: 'center', fontWeight: 600, color: '#374151', fontSize: '1.1rem', flexShrink: 0 }} data-testId={`order-detail-product-qty-${product.name || idx}`}>x{quantity}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ProductItem product={product} horizontal={true} data-testId={`order-detail-product-${product.name || idx}`} />
                </div>
              </div>
            );
          })}
        </div>
        {/* Add extra space below order items */}
        <div style={{ height: '1.5rem' }} />
        <div className="flex flex-col items-center" style={{ marginTop: '0.5rem', gap: '1rem', alignItems: 'center', justifyContent: 'center', display: 'flex' }} data-testId="order-detail-buttons">
          {order.status !== 'cancelled' && (
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => setEditing(true)}
              data-testId="order-detail-edit-btn"
              style={{
                color: '#111',
                background: '#f3f4f6',
                border: '1.5px solid #d1d5db',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.borderColor = '#111';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
            >
              Edit Order
            </Button>
          )}
          {order.status !== 'cancelled' && (
            <Button
              variant="destructive"
              className="w-fit"
              onClick={handleCancelOrder}
              disabled={cancelling}
              style={{
                color: '#fff',
                background: '#dc2626',
                border: '1.5px solid transparent',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = '#f87171';
                e.currentTarget.style.borderColor = '#991b1b';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = '#dc2626';
                e.currentTarget.style.borderColor = 'transparent';
              }}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          )}
          <Button
            variant="link"
            className="w-48"
            onClick={() => navigate('/orders')}
            style={{
              color: '#111',
              background: '#e5e7eb',
              border: '1.5px solid transparent',
              transition: 'background 0.2s, border-color 0.2s, color 0.2s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.background = '#d1d5db';
              e.currentTarget.style.borderColor = '#111';
              e.currentTarget.style.color = '#111';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = '#e5e7eb';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#111';
            }}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
