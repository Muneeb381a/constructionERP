import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toPng } from "html-to-image";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { assignDelivery, fetchInvoicePdf, getInvoice, markDelivered, voidInvoice, type Invoice } from "../lib/api/invoices";
import { getProduct } from "../lib/api/products";
import { listUnits } from "../lib/api/units";
import { getParty } from "../lib/api/parties";
import { getMyTenant } from "../lib/api/tenants";
import { listEmployees } from "../lib/api/employees";
import { Modal } from "../components/Modal";
import { ReceiptImage, type ReceiptLine } from "../components/ReceiptImage";

const TYPE_LABELS = {
  sale: "Sale",
  purchase: "Purchase",
  sale_return: "Sale Return",
  purchase_return: "Purchase Return",
} as const;

const DELIVERY_STATUS_STYLES: Record<Invoice["deliveryStatus"], string> = {
  not_applicable: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  delivered: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function DeliverySection({ invoice, canManage }: { invoice: Invoice; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useQuery({ queryKey: ["employees", ""], queryFn: () => listEmployees() });

  const assignMutation = useMutation({
    mutationFn: () => assignDelivery(invoice.id, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      setError(null);
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to assign delivery"),
  });

  const deliveredMutation = useMutation({
    mutationFn: () => markDelivered(invoice.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoice", invoice.id] }),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to mark delivered"),
  });

  const assignedEmployee = employees?.find((e) => e.id === invoice.deliveryEmployeeId);

  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delivery</h2>
          {assignedEmployee ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Assigned to <span className="font-medium text-gray-900 dark:text-gray-100">{assignedEmployee.name}</span>
              {assignedEmployee.designation && ` (${assignedEmployee.designation})`}
              {invoice.deliveredAt && ` · delivered ${new Date(invoice.deliveredAt).toLocaleString()}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No driver/loader assigned yet.</p>
          )}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${DELIVERY_STATUS_STYLES[invoice.deliveryStatus]}`}>
          {invoice.deliveryStatus.replace("_", " ")}
        </span>
      </div>

      {canManage && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
            <option value="">Select driver/loader…</option>
            {employees?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
                {emp.designation ? ` — ${emp.designation}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={() => assignMutation.mutate()}
            disabled={!employeeId || assignMutation.isPending}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {invoice.deliveryEmployeeId ? "Reassign" : "Assign"}
          </button>
          {invoice.deliveryStatus === "pending" && (
            <button
              onClick={() => deliveredMutation.mutate()}
              disabled={deliveredMutation.isPending}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Mark Delivered
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canVoid = role === "owner" || role === "manager";

  const [voidReason, setVoidReason] = useState("");
  const [showVoidForm, setShowVoidForm] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [printWidth, setPrintWidth] = useState<"58mm" | "80mm">("80mm");
  const receiptRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
  });

  const { data: units } = useQuery({ queryKey: ["units"], queryFn: listUnits });

  const { data: party } = useQuery({
    queryKey: ["party", data?.invoice.partyId],
    queryFn: () => getParty(data!.invoice.partyId!),
    enabled: !!data?.invoice.partyId && showShareModal,
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: getMyTenant,
    enabled: showShareModal,
  });

  const productIds = useMemo(() => [...new Set((data?.items ?? []).map((i) => i.productId))], [data]);
  const productQueries = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: ["product", productId],
      queryFn: () => getProduct(productId),
    })),
  });
  const productNames = useMemo(() => {
    const map = new Map<string, string>();
    productIds.forEach((productId, i) => {
      const name = productQueries[i]?.data?.name;
      if (name) map.set(productId, name);
    });
    return map;
  }, [productIds, productQueries]);

  const voidMutation = useMutation({
    mutationFn: () => voidInvoice(id!, voidReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowVoidForm(false);
    },
    onError: (err) => setVoidError(axiosErrorMessage(err) ?? "Failed to void invoice"),
  });

  async function handleDownloadPdf(invoiceId: string) {
    const blob = await fetchInvoicePdf(invoiceId);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function generateReceiptPng(): Promise<Blob> {
    if (!receiptRef.current) throw new Error("Receipt not ready");
    const dataUrl = await toPng(receiptRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function handleShareImage(invoiceNo: string) {
    setSharing(true);
    setShareError(null);
    try {
      const blob = await generateReceiptPng();
      const file = new File([blob], `${invoiceNo}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Invoice ${invoiceNo}` });
      } else {
        downloadBlob(blob, `${invoiceNo}.png`);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setShareError("Image share nahi ho saka. Download Image try karein.");
      }
    } finally {
      setSharing(false);
    }
  }

  async function handleDownloadImage(invoiceNo: string) {
    setSharing(true);
    setShareError(null);
    try {
      const blob = await generateReceiptPng();
      downloadBlob(blob, `${invoiceNo}.png`);
    } catch {
      setShareError("Image generate nahi ho saki.");
    } finally {
      setSharing(false);
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  if (!data) return <p className="text-sm text-red-600 dark:text-red-400">Invoice not found.</p>;

  const { invoice, items } = data;

  const receiptItems: ReceiptLine[] = items.map((item) => ({
    productName: productNames.get(item.productId) ?? item.productId,
    unitName: units?.find((u) => u.id === item.unitId)?.name ?? "",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← Back
          </button>
          <h1 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{invoice.invoiceNo}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {TYPE_LABELS[invoice.type]} · {new Date(invoice.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleDownloadPdf(invoice.id)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Download PDF
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Share / Print
          </button>
          {(invoice.type === "sale" || invoice.type === "purchase") && invoice.status !== "void" && (
            <Link
              to={`/invoices/${invoice.id}/return`}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Return
            </Link>
          )}
          <span
            className={`h-fit rounded-full px-3 py-1 text-xs font-medium ${
              invoice.status === "void"
                ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
            }`}
          >
            {invoice.status}
          </span>
        </div>
      </div>

      {(invoice.type === "sale" || invoice.type === "purchase") && invoice.status !== "void" && (
        <DeliverySection invoice={invoice} canManage={canVoid || role === "cashier"} />
      )}

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
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {units?.find((u) => u.id === item.unitId)?.name ?? item.unitId}
                </td>
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
            <span>{formatCurrency(Number(invoice.subtotal))}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Discount</span>
            <span>{formatCurrency(Number(invoice.discount))}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-semibold text-gray-900 dark:border-gray-800 dark:text-gray-100">
            <span>Total</span>
            <span>{formatCurrency(Number(invoice.totalAmount))}</span>
          </div>
        </div>
      </div>

      {invoice.status === "void" && (
        <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Voided on {invoice.voidedAt ? new Date(invoice.voidedAt).toLocaleString() : "—"}.
        </p>
      )}

      {canVoid && invoice.status !== "void" && (
        <div className="border-t border-gray-200 pt-4 dark:border-gray-800">
          {!showVoidForm ? (
            <button
              onClick={() => setShowVoidForm(true)}
              className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Void Invoice
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reason for voiding</label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                placeholder="e.g. Customer changed mind, wrong item billed…"
              />
              {voidError && <p className="text-sm text-red-600 dark:text-red-400">{voidError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowVoidForm(false)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setVoidError(null);
                    voidMutation.mutate();
                  }}
                  disabled={voidReason.trim().length < 3 || voidMutation.isPending}
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {voidMutation.isPending ? "Voiding…" : "Confirm Void"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showShareModal && (
        <Modal title="Share / Print Invoice" onClose={() => setShowShareModal(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2 text-sm">
              <label className="text-gray-500 dark:text-gray-400">Paper width</label>
              <select value={printWidth} onChange={(e) => setPrintWidth(e.target.value as "58mm" | "80mm")} className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-md border border-gray-200 bg-gray-100 p-4 dark:border-gray-800 dark:bg-gray-950">
              <div id="printable-receipt" ref={receiptRef} className="mx-auto w-fit" style={{ "--print-width": printWidth } as CSSProperties}>
                <ReceiptImage
                  businessName={tenant?.businessName ?? "…"}
                  invoiceNo={invoice.invoiceNo}
                  type={invoice.type}
                  createdAt={invoice.createdAt}
                  partyName={party?.name}
                  partyPhone={party?.phone}
                  items={receiptItems}
                  subtotal={invoice.subtotal}
                  discount={invoice.discount}
                  totalAmount={invoice.totalAmount}
                />
              </div>
            </div>
            {shareError && <p className="text-sm text-red-600 dark:text-red-400">{shareError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Print Receipt
              </button>
              <button
                onClick={() => handleDownloadImage(invoice.invoiceNo)}
                disabled={sharing}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Download Image
              </button>
              <button
                onClick={() => handleShareImage(invoice.invoiceNo)}
                disabled={sharing}
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {sharing ? "Preparing…" : "Share via WhatsApp"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
