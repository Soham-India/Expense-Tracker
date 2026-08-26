import { apiSlice } from "@/store/api/apiSlice";
import type {
  AccountResponse,
  AccountsResponse,
  ActualTransactionRequest,
  ActualTransactionResponse,
  ActualTransactionType,
  CreateAccountRequest,
  UpdateAccountRequest,
} from "@/types/api";
import type { MonthString } from "@/lib/dates";

export interface ListActualTransactionsArgs {
  month?: MonthString;
  type?: ActualTransactionType;
  accountId?: string;
}

export const actualApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getAccounts: build.query<AccountsResponse, boolean | void>({
      query: (includeArchived) =>
        `actual/accounts${includeArchived ? "?includeArchived=true" : ""}`,
      providesTags: ["Accounts"],
    }),
    getAccount: build.query<AccountResponse, string>({
      query: (id) => `actual/accounts/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Accounts", id }],
    }),
    createAccount: build.mutation<AccountResponse, CreateAccountRequest>({
      query: (body) => ({ url: "actual/accounts", method: "POST", body }),
      invalidatesTags: ["Accounts"],
    }),
    updateAccount: build.mutation<
      AccountResponse,
      { id: string; body: UpdateAccountRequest }
    >({
      query: ({ id, body }) => ({
        url: `actual/accounts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Accounts"],
    }),
    deleteAccount: build.mutation<void, string>({
      query: (id) => ({ url: `actual/accounts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Accounts"],
    }),
    getActualTransactions: build.query<
      ActualTransactionResponse[],
      ListActualTransactionsArgs | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.month) params.set("month", args.month);
        if (args?.type) params.set("type", args.type);
        if (args?.accountId) params.set("accountId", args.accountId);
        const qs = params.toString();
        return `actual/transactions${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["ActualTransactions"],
    }),
    addActualTransaction: build.mutation<
      ActualTransactionResponse,
      ActualTransactionRequest
    >({
      query: (body) => ({ url: "actual/transactions", method: "POST", body }),
      invalidatesTags: ["Dashboard", "ActualTransactions", "Accounts"],
    }),
    updateActualTransaction: build.mutation<
      ActualTransactionResponse,
      { id: string; body: ActualTransactionRequest }
    >({
      query: ({ id, body }) => ({
        url: `actual/transactions/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Dashboard", "ActualTransactions", "Accounts"],
    }),
    deleteActualTransaction: build.mutation<void, string>({
      query: (id) => ({ url: `actual/transactions/${id}`, method: "DELETE" }),
      invalidatesTags: ["Dashboard", "ActualTransactions", "Accounts"],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
  useGetActualTransactionsQuery,
  useAddActualTransactionMutation,
  useUpdateActualTransactionMutation,
  useDeleteActualTransactionMutation,
} = actualApi;
