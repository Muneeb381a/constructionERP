import axios, { type AxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import type { AuthResponse } from "./types";

// Same-origin "/api" works when the frontend and API share a domain (local dev, via
// Vite's proxy in vite.config.ts, or a single combined deployment). Deployed as two
// separate Vercel projects, set VITE_API_URL to the API project's full base URL, e.g.
// "https://construction-erp-api.vercel.app/api".
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// de-dupe concurrent refreshes — each refresh rotates the token, so firing more than
// one at a time would invalidate the one still in flight
let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshPromise) {
        // raw axios, deliberately not apiClient — routing this through apiClient would
        // re-enter this same response interceptor if the refresh call itself 401s
        refreshPromise = axios
          .post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
          .then((res) => {
            useAuthStore.getState().setAuth(res.data);
            return res.data.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      const newAccessToken = await refreshPromise;
      original.headers = { ...original.headers, Authorization: `Bearer ${newAccessToken}` };
      return apiClient(original);
    } catch (refreshError) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(refreshError);
    }
  },
);
