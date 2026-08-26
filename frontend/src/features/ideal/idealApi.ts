import { apiSlice } from "@/store/api/apiSlice";
import type {
  IdealMonthResponse,
  IdealSummaryResponse,
  IdealTransactionRequest,
  IdealTransactionResponse,
  StartIdealMonthRequest,
  TransactionType,
  UpdateIdealMonthRequest,
} from "@/types/api";
import type { MonthString } from "@/lib/dates";

export interface ListIdealTransactionsArgs {
  month?: MonthString;
  type?: TransactionType;
}

export const idealApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getIdealMonths: build.query<IdealMonthResponse[], void>({
      query: () => "ideal/months",
      providesTags: ["IdealMonth"],
    }),
    startIdealMonth: build.mutation<IdealMonthResponse, StartIdealMonthRequest>({
      query: (body) => ({ url: "ideal/months", method: "POST", body }),
      invalidatesTags: ["Dashboard", "IdealMonth", "IdealSummary"],
    }),
    updateIdealMonth: build.mutation<
      IdealMonthResponse,
      { id: string; body: UpdateIdealMonthRequest }
    >({
      query: ({ id, body }) => ({
        url: `ideal/months/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Dashboard", "IdealMonth", "IdealSummary"],
    }),
    getIdealSummary: build.query<IdealSummaryResponse, MonthString>({
      query: (month) => `ideal/summary?month=${month}`,
      providesTags: (_r, _e, month) => [{ type: "IdealSummary", id: month }],
    }),
    getIdealTransactions: build.query<
      IdealTransactionResponse[],
      ListIdealTransactionsArgs | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.month) params.set("month", args.month);
        if (args?.type) params.set("type", args.type);
        const qs = params.toString();
        return `ideal/transactions${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["IdealTransactions"],
    }),
    addIdealTransaction: build.mutation<
      IdealTransactionResponse,
      IdealTransactionRequest
    >({
      query: (body) => ({ url: "ideal/transactions", method: "POST", body }),
      invalidatesTags: ["Dashboard", "IdealSummary", "IdealTransactions"],
    }),
    updateIdealTransaction: build.mutation<
      IdealTransactionResponse,
      { id: string; body: IdealTransactionRequest }
    >({
      query: ({ id, body }) => ({
        url: `ideal/transactions/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Dashboard", "IdealSummary", "IdealTransactions"],
    }),
    deleteIdealTransaction: build.mutation<void, string>({
      query: (id) => ({ url: `ideal/transactions/${id}`, method: "DELETE" }),
      invalidatesTags: ["Dashboard", "IdealSummary", "IdealTransactions"],
    }),
  }),
});

export const {
  useGetIdealMonthsQuery,
  useStartIdealMonthMutation,
  useUpdateIdealMonthMutation,
  useGetIdealSummaryQuery,
  useGetIdealTransactionsQuery,
  useAddIdealTransactionMutation,
  useUpdateIdealTransactionMutation,
  useDeleteIdealTransactionMutation,
} = idealApi;
