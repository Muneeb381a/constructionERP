import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Camera, RefreshCw, ShieldCheck, User as UserIcon } from "lucide-react";
import { Loader } from "../components/Loader";
import { inputClass, labelClass } from "../lib/formStyles";
import { axiosErrorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { getMe, updateMe, uploadMyAvatar } from "../lib/api/users";
import { getMyTenant, updateTenant, uploadTenantLogo, type Tenant } from "../lib/api/tenants";
import { verifyLedgerIntegrity, type LedgerIntegrityResult } from "../lib/api/ledger";
import { getLastReconciliationRun, runReconciliationNow, type ReconciliationResult } from "../lib/api/reconciliation";

function AvatarPicker({
  imageUrl,
  fallback,
  onPick,
  uploading,
  shape = "circle",
}: {
  imageUrl: string | null;
  fallback: React.ReactNode;
  onPick: (file: File) => void;
  uploading: boolean;
  shape?: "circle" | "square";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shapeClass = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div className="relative h-20 w-20 shrink-0">
      <div className={`flex h-20 w-20 items-center justify-center overflow-hidden ${shapeClass} bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400`}>
        {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : fallback}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader size="sm" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Change photo"
        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
      >
        <Camera size={13} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function ProfileSection() {
  const queryClient = useQueryClient();
  const updateStoredUser = useAuthStore((s) => s.updateUser);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const { data: me, isLoading, isError } = useQuery({ queryKey: ["me"], queryFn: getMe });

  const saveMutation = useMutation({
    mutationFn: (input: { name: string }) => updateMe(input),
    onSuccess: (user) => {
      updateStoredUser({ name: user.name });
      queryClient.setQueryData(["me"], user);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to save profile"),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadMyAvatar(file),
    onSuccess: (user) => {
      updateStoredUser({ avatarUrl: user.avatarUrl });
      queryClient.setQueryData(["me"], user);
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to upload photo"),
  });

  if (isLoading) return <Loader />;
  if (isError || !me) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load your profile. Try refreshing.</p>;

  const displayName = name ?? me.name;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <UserIcon size={16} className="text-gray-400" />
        My Profile
      </h2>

      <div className="flex items-start gap-5">
        <AvatarPicker
          imageUrl={me.avatarUrl}
          fallback={<UserIcon size={28} />}
          uploading={avatarMutation.isPending}
          onPick={(file) => avatarMutation.mutate(file)}
        />

        <div className="flex-1 space-y-3">
          <div>
            <label className={labelClass}>Name</label>
            <input value={displayName} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={me.email} disabled className={inputClass + " opacity-60"} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <p className="mt-1 inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {me.role}
            </p>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {savedMsg && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

          <div className="flex justify-end">
            <button
              onClick={() => {
                setError(null);
                saveMutation.mutate({ name: displayName });
              }}
              disabled={saveMutation.isPending || displayName.trim().length < 2}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShopDetailsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ businessName: string; address: string; phone: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const { data: tenant, isLoading, isError } = useQuery({ queryKey: ["tenant"], queryFn: getMyTenant });

  const saveMutation = useMutation({
    mutationFn: (input: { businessName: string; address: string | null; phone: string | null }) => updateTenant(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["tenant"], updated);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to save shop details"),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => uploadTenantLogo(file),
    onSuccess: (updated) => queryClient.setQueryData<Tenant>(["tenant"], updated),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to upload logo"),
  });

  if (isLoading) return <Loader />;
  if (isError || !tenant) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load shop settings. Try refreshing.</p>;

  const current = form ?? { businessName: tenant.businessName, address: tenant.address ?? "", phone: tenant.phone ?? "" };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <Building2 size={16} className="text-gray-400" />
        Shop Details
      </h2>

      <div className="flex items-start gap-5">
        <AvatarPicker
          imageUrl={tenant.logoUrl}
          fallback={<Building2 size={28} />}
          uploading={logoMutation.isPending}
          shape="square"
          onPick={(file) => logoMutation.mutate(file)}
        />

        <div className="flex-1 space-y-3">
          <div>
            <label className={labelClass}>Shop / Business Name</label>
            <input
              value={current.businessName}
              onChange={(e) => setForm({ ...current, businessName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input
              value={current.address}
              onChange={(e) => setForm({ ...current, address: e.target.value })}
              placeholder="Shop address for receipts"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              value={current.phone}
              onChange={(e) => setForm({ ...current, phone: e.target.value })}
              placeholder="03xx-xxxxxxx"
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {savedMsg && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

          <div className="flex justify-end">
            <button
              onClick={() => {
                setError(null);
                saveMutation.mutate({
                  businessName: current.businessName,
                  address: current.address || null,
                  phone: current.phone || null,
                });
              }}
              disabled={saveMutation.isPending || current.businessName.trim().length < 2}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving…" : "Save Shop Details"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreferencesSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data: tenant, isLoading, isError } = useQuery({ queryKey: ["tenant"], queryFn: getMyTenant });

  const toggleMutation = useMutation({
    mutationFn: (allowNegativeStock: boolean) => updateTenant({ allowNegativeStock }),
    onSuccess: (updated) => queryClient.setQueryData<Tenant>(["tenant"], updated),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to update preference"),
  });

  const reminderIntervalMutation = useMutation({
    mutationFn: (reminderIntervalDays: number) => updateTenant({ reminderIntervalDays }),
    onSuccess: (updated) => queryClient.setQueryData<Tenant>(["tenant"], updated),
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to update preference"),
  });

  if (isLoading) return <Loader />;
  if (isError || !tenant) return <p className="text-sm text-red-600 dark:text-red-400">Failed to load shop settings. Try refreshing.</p>;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Preferences</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Allow Negative Stock</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Lets a sale go through even if it would take a product's stock below zero.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={tenant.allowNegativeStock}
          onClick={() => {
            setError(null);
            toggleMutation.mutate(!tenant.allowNegativeStock);
          }}
          disabled={toggleMutation.isPending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            tenant.allowNegativeStock ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              tenant.allowNegativeStock ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-gray-100 pt-4 dark:border-gray-800">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reminder Interval</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            How often a customer/supplier with a balance shows up as "due" for a payment reminder.
          </p>
        </div>
        <select
          value={tenant.reminderIntervalDays}
          onChange={(e) => {
            setError(null);
            reminderIntervalMutation.mutate(Number(e.target.value));
          }}
          disabled={reminderIntervalMutation.isPending}
          className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value={3}>Every 3 days</option>
          <option value={7}>Every 7 days</option>
          <option value={14}>Every 14 days</option>
          <option value={30}>Every 30 days</option>
        </select>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}

function LedgerIntegritySection() {
  const [result, setResult] = useState<LedgerIntegrityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: verifyLedgerIntegrity,
    onSuccess: setResult,
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to verify ledger"),
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <ShieldCheck size={16} className="text-gray-400" />
        Ledger Integrity
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Every ledger entry is cryptographically chained to the one before it. This checks that no historical
        balance-affecting record has been altered outside the app.
      </p>

      <button
        onClick={() => {
          setError(null);
          mutation.mutate();
        }}
        disabled={mutation.isPending}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {mutation.isPending ? "Verifying…" : "Verify Ledger Integrity"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            result.valid
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
          }`}
        >
          {result.valid ? (
            <p>
              Chain intact — {result.checkedCount} of {result.totalEntries} entries verified
              {result.legacyUncheckedCount > 0 ? ` (${result.legacyUncheckedCount} legacy entries unchecked)` : ""}.
            </p>
          ) : (
            <p>Chain broken at entry {result.brokenAt} — a historical record no longer matches its recorded hash.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ReconciliationSection() {
  const role = useAuthStore((s) => s.user?.role);
  const canRun = role === "owner";
  const queryClient = useQueryClient();
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: lastRun, isLoading } = useQuery({ queryKey: ["reconciliation-last-run"], queryFn: getLastReconciliationRun });

  const mutation = useMutation({
    mutationFn: runReconciliationNow,
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["reconciliation-last-run"] });
    },
    onError: (err) => setError(axiosErrorMessage(err) ?? "Failed to run reconciliation"),
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <RefreshCw size={16} className="text-gray-400" />
        Balance Reconciliation
      </h2>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Every customer/supplier balance is re-checked against their ledger history automatically every night. This shows
        the result of that check, and lets an owner run it on demand.
      </p>

      {isLoading ? (
        <Loader />
      ) : lastRun ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            lastRun.mismatchCount === 0
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300"
              : "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          }`}
        >
          Last checked {new Date(lastRun.createdAt).toLocaleString()} ({lastRun.triggeredBy === "cron" ? "automatic" : "manual"}) —{" "}
          {lastRun.mismatchCount === 0 ? "all balances matched their ledger history." : `${lastRun.mismatchCount} mismatch(es) found and corrected.`}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No reconciliation has run yet.</p>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          {result.mismatches.map((m) => (
            <div key={m.partyId} className="rounded-md border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:text-amber-300">
              <span className="font-medium">{m.partyName}</span>: was {formatCurrency(m.before)}, corrected to {formatCurrency(m.after)} (
              {m.drift > 0 ? "+" : ""}
              {formatCurrency(m.drift)})
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {canRun && (
        <button
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
          disabled={mutation.isPending}
          className="mt-4 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          {mutation.isPending ? "Running…" : "Run Reconciliation Now"}
        </button>
      )}
    </section>
  );
}

export function SettingsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canManageShop = role === "owner" || role === "manager";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>

      <ProfileSection />

      {canManageShop && (
        <>
          <ShopDetailsSection />
          <PreferencesSection />
          <LedgerIntegritySection />
          <ReconciliationSection />
        </>
      )}
    </div>
  );
}
