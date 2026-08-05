import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldAlert } from "lucide-react";
import { axiosErrorMessage } from "../../lib/errors";
import { usePlatformAdminAuthStore } from "../store/platformAdminAuthStore";
import { loginPlatformAdmin } from "../lib/platformAdminApi";

const darkInputClass =
  "w-full rounded-lg border border-gray-700 bg-gray-950 py-2.5 pl-10 pr-3 text-sm text-gray-100 placeholder:text-gray-600 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20";

export function PlatformAdminLoginPage() {
  const navigate = useNavigate();
  const setAuth = usePlatformAdminAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await loginPlatformAdmin({
        email,
        password,
        ...(useRecoveryCode ? { recoveryCode: code } : { totpCode: code }),
      });
      setAuth(result);
      navigate("/platform-admin/tenants");
    } catch (err) {
      setError(axiosErrorMessage(err) ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-2xl shadow-black/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 ring-1 ring-amber-500/30">
            <ShieldAlert size={17} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-100">Platform Admin</h1>
            <p className="text-xs text-gray-500">Operator console — not for shop staff</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Email</label>
            <div className="relative mt-1.5">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={darkInputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">Password</label>
            <div className="relative mt-1.5">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${darkInputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-300">
                {useRecoveryCode ? "Recovery code" : "Authenticator code"}
              </label>
              <button
                type="button"
                onClick={() => {
                  setUseRecoveryCode((v) => !v);
                  setCode("");
                }}
                className="text-xs font-medium text-amber-400 hover:underline"
              >
                {useRecoveryCode ? "Use authenticator code instead" : "Lost your device? Use a recovery code"}
              </button>
            </div>
            <div className="relative mt-1.5">
              <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={useRecoveryCode ? "e.g. a1b2c3d4e5" : "6-digit code"}
                className={darkInputClass}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 px-3 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
