import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Copy, ShieldCheck } from "lucide-react";
import { inputClass, labelClass } from "../../lib/formStyles";
import { axiosErrorMessage } from "../../lib/errors";
import { createTenant } from "../lib/platformAdminApi";

export function CreateTenantPage() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState<{ ownerEmail: string; ownerPassword: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => createTenant({ businessName, ownerName, email, idempotencyKey }),
    onSuccess: (data) => {
      setError(null);
      setResult({ ownerEmail: data.ownerEmail, ownerPassword: data.ownerPassword });
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to create shop"),
  });

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <ShieldCheck size={20} />
          <h1 className="text-lg font-semibold">Shop created</h1>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
            This password is shown once and cannot be retrieved again. Hand it to the owner now.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Login email: </span>
              <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{result.ownerEmail}</span>
            </div>
            {result.ownerPassword ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-500 dark:text-gray-400">Password: </span>
                <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{result.ownerPassword}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(result.ownerPassword!);
                    setCopied(true);
                  }}
                  className="flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Copy size={12} />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">
                This shop was already created from an earlier request — the password was only shown then.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link
            to="/platform-admin/tenants"
            className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400"
          >
            Back to Shops
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Create a new shop</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
      >
        <div>
          <label className={labelClass}>Business name</label>
          <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Owner's name</label>
          <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Owner's email (used to log in)</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          A temporary password is generated automatically and shown once after creation.
        </p>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {mutation.isPending ? "Creating…" : "Create Shop"}
        </button>
      </form>
    </div>
  );
}
