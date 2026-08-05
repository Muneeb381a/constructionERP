import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { axiosErrorMessage } from "../../lib/errors";
import { inputClass, labelClass } from "../../lib/formStyles";
import { usePlatformAdminAuthStore } from "../store/platformAdminAuthStore";
import { loginPlatformAdmin } from "../lib/platformAdminApi";

export function PlatformAdminLoginPage() {
  const navigate = useNavigate();
  const setAuth = usePlatformAdminAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-amber-400" />
          <h1 className="text-xl font-semibold text-gray-100">Platform Admin</h1>
        </div>
        <p className="mt-1 text-sm text-gray-400">Operator console — not for shop staff.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={`${labelClass} text-gray-300`}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={`${labelClass} text-gray-300`}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className={`${labelClass} text-gray-300`}>{useRecoveryCode ? "Recovery code" : "Authenticator code"}</label>
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
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={useRecoveryCode ? "e.g. a1b2c3d4e5" : "6-digit code"}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
