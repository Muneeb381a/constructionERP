import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { CheckCircle2, Circle, PackageCheck, Truck } from "lucide-react";
import { formatCurrency } from "../lib/format";
import { Loader } from "../components/Loader";
import { getPublicTracking } from "../lib/api/invoices";

const STEPS = [
  { key: "confirmed", label: "Order Confirmed", icon: CheckCircle2 },
  { key: "dispatched", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: PackageCheck },
] as const;

export function PublicOrderStatusPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-tracking", token],
    queryFn: () => getPublicTracking(token!),
    enabled: !!token,
    retry: false,
  });

  // Walk-in / no-driver orders skip straight to "delivered" (picked up at the counter) —
  // deliveryStatus "not_applicable" means there was never a dispatch step to track.
  const activeStep =
    data?.deliveryStatus === "delivered" ? 2 : data?.deliveryStatus === "pending" ? 1 : data?.deliveryStatus === "not_applicable" ? 2 : 0;

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
              <p className="text-sm text-gray-500">Order</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{data.invoiceNo}</p>
              <p className="mt-1 text-xs text-gray-400">{new Date(data.createdAt).toLocaleDateString()}</p>
            </div>

            {data.status === "void" ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500 shadow-sm">
                This order was cancelled.
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="space-y-4">
                  {STEPS.map((step, i) => {
                    const Icon = i <= activeStep ? step.icon : Circle;
                    const done = i <= activeStep;
                    return (
                      <div key={step.key} className="flex items-center gap-3">
                        <Icon size={20} className={done ? "text-green-600" : "text-gray-300"} />
                        <span className={`text-sm ${done ? "font-medium text-gray-900" : "text-gray-400"}`}>{step.label}</span>
                        {i === 2 && data.deliveredAt && done && (
                          <span className="ml-auto text-xs text-gray-400">{new Date(data.deliveredAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {data.driverName && (
                  <p className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">
                    Driver: <span className="font-medium text-gray-900">{data.driverName}</span>
                    {data.driverPhone && ` · ${data.driverPhone}`}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Items</p>
              <div className="divide-y divide-gray-100">
                {data.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <p className="text-gray-900">{item.productName}</p>
                    <p className="text-gray-500">
                      {item.quantity} {item.unitName}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatCurrency(Number(data.totalAmount))}</span>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400">This is a read-only order summary shared by the shop.</p>
          </div>
        )}
      </div>
    </div>
  );
}
