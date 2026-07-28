import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { useShopContext } from "../hooks/useShopContext";
import { listUnits } from "../lib/api/units";
import { getProduct } from "../lib/api/products";
import { getQuotation, updateQuotationStatus, convertQuotation, type QuotationStatus } from "../lib/api/quotations";

const STATUS_STYLES: Record<QuotationStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  accepted: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
  converted: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

function ConvertForm({ quotationId, onDone }: { quotationId: string; onDone: (invoiceId: string) => void }) {
  const shop = useShopContext();
  const [error, setError] = useState<string | null>(null);
  const role = useAuthStore((s) => s.user?.role);
  const canOverride = role === "owner" || role === "manager";

  const mutation = useMutation({
    mutationFn: (overrideCreditLimit: boolean) => convertQuotation(quotationId, { warehouseId: shop.warehouseId, overrideCreditLimit }),
    onSuccess: (result) => onDone(result.invoice.id),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to convert"),
  });

  const canOverrideNow = canOverride && error?.includes("pass overrideCreditLimit");

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">This will create an invoice and deduct stock accordingly.</p>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          <p>{error}</p>
          {canOverrideNow && (
            <button
              onClick={() => {
                setError(null);
                mutation.mutate(true);
              }}
              className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Proceed anyway (will be audit-logged)
            </button>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => {
            setError(null);
            mutation.mutate(false);
          }}
          disabled={!shop.warehouseId || mutation.isPending}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {mutation.isPending ? "Converting…" : "Create Invoice"}
        </button>
      </div>
    </div>
  );
}

export function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canAct = role === "owner" || role === "manager" || role === "cashier";

  const [showConvert, setShowConvert] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quotation", id],
    queryFn: () => getQuotation(id!),
    enabled: !!id,
  });

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });

  const items = data?.items ?? [];
  const productIds = useMemo(() => [...new Set(items.map((i) => i.productId))], [items]);
  const productQueries = useQueries({
    queries: productIds.map((productId) => ({ queryKey: ["product", productId], queryFn: () => getProduct(productId) })),
  });
  const productNames = useMemo(() => {
    const map = new Map<string, string>();
    productIds.forEach((productId, i) => {
      const name = productQueries[i]?.data?.name;
      if (name) map.set(productId, name);
    });
    return map;
  }, [productIds, productQueries]);

  const statusMutation = useMutation({
    mutationFn: (status: "sent" | "accepted" | "rejected" | "expired") => updateQuotationStatus(id!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotation", id] }),
    onError: (err) => setStatusError(axiosErrorMessage(err) ?? "Failed to update status"),
  });

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600 dark:text-red-400">Quotation not found.</p>;

  const { quotation } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/quotations" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Back to Quotations
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{quotation.quotationNo}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(quotation.createdAt).toLocaleString()}</p>
        </div>
        <span className={`h-fit rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[quotation.status]}`}>{quotation.status}</span>
      </div>

      {quotation.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{quotation.notes}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            <tr>
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Unit</th>
              <th className="px-4 py-2 font-medium">Qty</th>
              <th className="px-4 py-2 font-medium">Unit Price</th>
              <th className="px-4 py-2 font-medium">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{productNames.get(item.productId) ?? item.productId}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{units?.find((u) => u.id === item.unitId)?.name ?? item.unitId}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{item.quantity}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatCurrency(Number(item.unitPrice))}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{formatCurrency(Number(item.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Subtotal</span>
            <span>{formatCurrency(Number(quotation.subtotal))}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Discount</span>
            <span>{formatCurrency(Number(quotation.discount))}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
            <span>Total</span>
            <span>{formatCurrency(Number(quotation.totalAmount))}</span>
          </div>
        </div>
      </div>

      {quotation.convertedInvoiceId && (
        <div className="rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300">
          Converted to invoice.{" "}
          <Link to={`/invoices/${quotation.convertedInvoiceId}`} className="font-medium hover:underline">
            View invoice
          </Link>
        </div>
      )}

      {statusError && <p className="text-sm text-red-600 dark:text-red-400">{statusError}</p>}

      {canAct && quotation.status !== "converted" && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
          {quotation.status === "draft" && (
            <button
              onClick={() => statusMutation.mutate("sent")}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Mark as Sent
            </button>
          )}
          {(quotation.status === "draft" || quotation.status === "sent") && (
            <>
              <button
                onClick={() => statusMutation.mutate("accepted")}
                className="rounded-md border border-green-300 px-3 py-2 text-sm text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                Mark Accepted
              </button>
              <button
                onClick={() => statusMutation.mutate("rejected")}
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                Mark Rejected
              </button>
              <button
                onClick={() => statusMutation.mutate("expired")}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Mark Expired
              </button>
            </>
          )}
          {quotation.status === "accepted" && (
            <button
              onClick={() => setShowConvert(true)}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Convert to Invoice
            </button>
          )}
        </div>
      )}

      {showConvert && (
        <Modal title="Convert to Invoice" onClose={() => setShowConvert(false)}>
          <ConvertForm quotationId={id!} onDone={(invoiceId) => navigate(`/invoices/${invoiceId}`)} />
        </Modal>
      )}
    </div>
  );
}
