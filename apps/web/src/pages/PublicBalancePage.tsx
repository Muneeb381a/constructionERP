import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { formatCurrency } from "../lib/format";
import { getPublicBalance, type PublicBalanceBill } from "../lib/api/parties";

const STATUS_STYLES: Record<PublicBalanceBill["status"], string> = {
  paid: "bg-green-50 text-green-700",
  partial: "bg-amber-50 text-amber-700",
  unpaid: "bg-red-50 text-red-700",
  void: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<PublicBalanceBill["status"], string> = {
  paid: "Paid",
  partial: "Partially Paid",
  unpaid: "Unpaid",
  void: "Void",
};

export function PublicBalancePage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-balance", token],
    queryFn: () => getPublicBalance(token!),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        {isLoading ? (
          <p className="text-center text-sm text-gray-500">Loading…</p>
        ) : isError || !data ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-red-600">This link is invalid or has expired.</p>
            <p className="mt-1 text-xs text-gray-400">Please contact the shop for an updated link.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-gray-500">Account Balance</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{data.partyName}</p>
              <p className="mt-3 text-3xl font-bold text-gray-900">{formatCurrency(Number(data.balance))}</p>
              <p className="mt-1 text-xs text-gray-400">
                {Number(data.balance) > 0 ? "Outstanding balance" : "No outstanding balance"}
                {data.balanceUpdatedAt && ` · updated ${new Date(data.balanceUpdatedAt).toLocaleDateString()}`}
              </p>
            </div>

            {data.bills.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recent Bills
                </p>
                <div className="divide-y divide-gray-100">
                  {data.bills.map((bill) => (
                    <div key={bill.invoiceNo} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{bill.invoiceNo}</p>
                        <p className="text-xs text-gray-400">{new Date(bill.date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-900">{formatCurrency(Number(bill.totalAmount))}</p>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[bill.status]}`}>
                          {STATUS_LABELS[bill.status]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400">This is a read-only summary shared by the shop.</p>
          </div>
        )}
      </div>
    </div>
  );
}
