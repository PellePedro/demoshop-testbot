import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import "@/styles/select-zindex-workaround.css";
import { getSessionIdFromCookie } from "../../lib/utils";
import { apiUrl } from "../../config";

const STATUS_OPTIONS = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

interface EditOrderFormProps {
  order: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
}

const EditOrderForm: React.FC<EditOrderFormProps> = ({ order, onClose, onSaved }) => {
  const [customerEmail, setCustomerEmail] = useState<string>(order.customer_email ?? "");
  const [status, setStatus] = useState<string>(order.status ?? "pending");
  const [discountPercent, setDiscountPercent] = useState<number>(order.discount_percent ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerEmail) {
      setError("Customer email is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/orders/${order.order_id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getSessionIdFromCookie()}`,
        },
        body: JSON.stringify({
          customer_email: customerEmail,
          status,
          discount_percent: Number(discountPercent),
        }),
      });
      if (!res.ok) throw new Error("Failed to update order");
      const data = await res.json();
      onSaved(data);
      onClose();
    } catch (err) {
      setError("Failed to update order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(31, 41, 55, 0.35)",
        position: "fixed",
        inset: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: "32rem",
          minWidth: "28rem",
          width: "100%",
          background: "#fff",
          borderRadius: "0.75rem",
          boxShadow:
            "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          padding: "1.5rem",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
        data-testId="edit-order-modal-box"
      >
        <button
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            color: "#6b7280",
            background: "white",
            borderRadius: "9999px",
            fontSize: "1.25rem",
            fontWeight: 700,
            width: "1.75rem",
            height: "1.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
            zIndex: 10,
            border: "1.5px solid #888",
            cursor: "pointer",
          }}
          onClick={onClose}
          aria-label="Close"
          type="button"
          data-testId="edit-order-dismiss-btn"
        >
          ×
        </button>
        <h3 className="text-2xl font-semibold text-center mb-6" data-testId="edit-order-heading">
          Edit order
        </h3>
        {error && (
          <div className="text-red-500 text-center mb-2" data-testId="edit-order-error">
            {error}
          </div>
        )}
        <form className="flex flex-col" style={{ gap: "1rem" }} onSubmit={handleSubmit}>
          <div className="pb-1">
            <label
              className="block text-sm font-medium text-gray-700 mb-1 text-left"
              data-testId="edit-order-label-email"
            >
              Customer Email
            </label>
            <Input
              name="customer_email"
              placeholder="e.g. user@email.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="w-full min-w-[280px] max-w-full px-4 py-2"
              style={{ fontSize: "1rem", border: "1.5px solid #d1d5db" }}
              data-testId="edit-order-input-email"
            />
          </div>
          <div className="pb-1">
            <label
              className="block text-sm font-medium text-gray-700 mb-1 text-left"
              data-testId="edit-order-label-status"
            >
              Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                style={{
                  border: "1.5px solid #d1d5db",
                  width: "100%",
                  padding: "0.5rem 1rem",
                  background: "#fff",
                  borderRadius: "0.375rem",
                  fontSize: "1rem",
                  color: "#111827",
                  textAlign: "left",
                }}
                data-testId="edit-order-status-trigger"
              >
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} data-testId={`edit-order-status-option-${s}`}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pb-1">
            <label
              className="block text-sm font-medium text-gray-700 mb-1 text-left"
              data-testId="edit-order-label-discount"
            >
              Discount (%)
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              value={discountPercent}
              onChange={(e) => {
                const val = Number(e.target.value);
                const clamped = Number.isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
                setDiscountPercent(clamped);
              }}
              style={{ fontSize: "1rem", border: "1.5px solid #d1d5db", width: "8rem" }}
              data-testId="edit-order-input-discount"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="w-full text-black mt-2"
            style={{ background: "#f3f4f6", color: "#111", width: "100%", marginTop: "0.5rem" }}
            data-testId="edit-order-submit-btn"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default EditOrderForm;
