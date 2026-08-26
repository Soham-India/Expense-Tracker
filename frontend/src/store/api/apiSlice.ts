import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { logout } from "@/store/slices/authSlice";
import type { RootState } from "@/store/index";

/**
 * All backend routes live under /api/** on the Spring Boot origin.
 * next.config.ts rewrites /api/* to $API_ORIGIN/api/*, so a same-origin
 * baseUrl of "/api" dodges CORS entirely in dev.
 */
const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders(headers, { getState }) {
    const token = (getState() as RootState).auth.token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

/**
 * Single global 401 handler (handoff §2/§5): clear credentials and bounce
 * to /login. Login/register failures are excluded so bad credentials do not
 * trigger a redirect loop.
 */
const baseQueryWithAuthGuard: BaseQueryFn<
  FetchArgs | string,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401) {
    const url = typeof args === "string" ? args : args.url;
    if (!url.startsWith("auth/")) {
      api.dispatch(logout());
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    }
  }
  return result;
};

/**
 * Domain tags drive invalidation across systems, e.g. confirming a recurring
 * template invalidates both "Recurring" and the target domain's tag.
 */
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAuthGuard,
  tagTypes: [
    "User",
    "Categories",
    "IdealMonth",
    "IdealTransactions",
    "IdealSummary",
    "Accounts",
    "ActualTransactions",
    "People",
    "Groups",
    "SplitExpenses",
    "Settlements",
    "Balances",
    "Recurring",
    "Dashboard",
  ],
  endpoints: () => ({}),
});
