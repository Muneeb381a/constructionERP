import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Building2, Eye, EyeOff, HardHat, Lock, Mail, Receipt, Wallet } from "lucide-react";
import { apiClient } from "../lib/apiClient";
import { axiosErrorMessage } from "../lib/errors";
import { useAuthStore } from "../store/authStore";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import type { AuthResponse } from "../lib/types";

const FEATURES = [
  { icon: Wallet, key: "stock" as const, label: "Stock aur inventory, live" },
  { icon: Receipt, key: "invoices" as const, label: "Sale, purchase, aur returns" },
  { icon: Building2, key: "ledger" as const, label: "Har party ka hisaab, aik jagah" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post<AuthResponse>("/auth/login", { email, password });
      setAuth(res.data);
      navigate("/dashboard");
    } catch (err) {
      const message = axiosErrorMessage(err);
      setError(message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Branding panel — hidden below md, this is the app's construction identity, not
          just decoration, so it's built with the same iconography as the main nav. */}
      <div className="brick-pattern relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-gray-900 via-gray-900 to-stone-900 p-12 text-white md:flex">
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500">
            <HardHat size={20} className="text-amber-950" strokeWidth={2.25} />
          </div>
          <span className="text-lg font-semibold tracking-tight">{t("app.name")}</span>
        </div>

        <div className="relative space-y-8">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-balance">
              Building material dealers ke liye, banaya gaya.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-300">
              Purchase, sale, ledger, aur stock — sab kuch aik hi jagah, seedha aapke hath mein.
            </p>
          </div>

          <ul className="space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f.key} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <f.icon size={15} className="text-amber-400" />
                </div>
                <span className="text-sm text-gray-200">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-gray-500">© {new Date().getFullYear()} {t("app.name")}</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center bg-white px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between md:justify-end">
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
                <HardHat size={16} className="text-amber-950" strokeWidth={2.25} />
              </div>
              <span className="text-sm font-semibold text-gray-900">{t("app.name")}</span>
            </div>
            <LanguageSwitcher />
          </div>

          <h2 className="text-2xl font-semibold text-gray-900">{t("auth.login")}</h2>
          <p className="mt-1.5 text-sm text-gray-500">Apni shop ke account mein sign in karein.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{t("auth.email")}</label>
              <div className="relative mt-1.5">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="you@business.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t("auth.password")}</label>
              <div className="relative mt-1.5">
                <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? t("auth.loggingIn") : t("auth.login")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
