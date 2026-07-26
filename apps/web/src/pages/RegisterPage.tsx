import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "../lib/apiClient";
import { axiosErrorMessage } from "../lib/errors";
import { inputClass, labelClass } from "../lib/formStyles";
import { useAuthStore } from "../store/authStore";
import type { AuthResponse } from "../lib/types";

export function RegisterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post<AuthResponse>("/auth/register", {
        businessName,
        ownerName,
        email,
        password,
      });
      setAuth(res.data);
      navigate("/dashboard");
    } catch (err) {
      setError(axiosErrorMessage(err) ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("auth.registerTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("app.name")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass}>{t("auth.businessName")}</label>
            <input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t("auth.yourName")}</label>
            <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t("auth.email")}</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t("auth.password")}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {t("auth.alreadyHaveAccount")}{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            {t("auth.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}
