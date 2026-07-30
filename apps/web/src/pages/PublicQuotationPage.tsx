import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { Loader } from "../components/Loader";
import { getPublicQuotation, acceptPublicQuotation } from "../lib/api/quotations";

const STATUS_LABELS: Record<string, string> = {
  draft: "Awaiting Review",
  sent: "Awaiting Your Response",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  converted: "Confirmed & Processed",
};

export function PublicQuotationPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-quotation", token],
    queryFn: () => getPublicQuotation(token!),
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptPublicQuotation(token!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["public-quotation", token] }),
    onError: () => setError("Could not accept this quotation — please contact the shop."),
  });

  const canAccept = data?.status === "draft" || data?.status === "sent";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        {isLoading ? (
          <Loader />
        ) : isError || !data ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-red-600">This link is invalid or has expired.</p>
            <p className="mt-1 text-xs text-gray-400">Please contact the shop for an updated link.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-gray-500">Quotation</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{data.quotationNo}</p>
              <span className="mt-2 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {STATUS_LABELS[data.status] ?? data.status}
              </span>
              {data.validUntil && (
                <p className="mt-2 text-xs text-gray-400">Valid until {new Date(data.validUntil).toLocaleDateString()}</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Items</p>
              <div className="divide-y divide-gray-100">
                {data.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-xs text-gray-400">
                        {item.quantity} {item.unitName} × {formatCurrency(Number(item.unitPrice))}
                      </p>
                    </div>
                    <p className="text-gray-900">{formatCurrency(Number(item.lineTotal))}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(Number(data.subtotal))}</span>
                </div>
                {Number(data.discount) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Discount</span>
                    <span>{formatCurrency(Number(data.discount))}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(Number(data.totalAmount))}</span>
                </div>
              </div>
            </div>

            {data.notes && <p className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">{data.notes}</p>}

            {canAccept && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {acceptMutation.isPending ? "Accepting…" : "Accept Quotation"}
              </button>
            )}
            {acceptMutation.isSuccess && (
              <p className="text-center text-sm font-medium text-green-700">Accepted — the shop will follow up to arrange your order.</p>
            )}
            {error && <p className="text-center text-sm text-red-600">{error}</p>}

            <p className="text-center text-xs text-gray-400">Shared by the shop — prices are only valid until the date shown above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
