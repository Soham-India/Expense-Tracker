import { apiSlice } from "@/store/api/apiSlice";
import type {
  CreateRecurringRequest,
  PrepareRecurringResponse,
  RecurringEntryResponse,
  UpdateRecurringRequest,
} from "@/types/api";
import type { RecurringDomain } from "@/types/api";

/**
 * Recurring templates never auto-post (§10): prepare gives a read-only
 * preview, confirm creates the real entry through domain validations.
 */
export const recurringApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getRecurring: build.query<
      RecurringEntryResponse[],
      { domain?: RecurringDomain; activeOnly?: boolean } | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.domain) params.set("domain", args.domain);
        if (args?.activeOnly) params.set("activeOnly", "true");
        const qs = params.toString();
        return `recurring${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["Recurring"],
    }),
    createRecurring: build.mutation<RecurringEntryResponse, CreateRecurringRequest>({
      query: (body) => ({ url: "recurring", method: "POST", body }),
      invalidatesTags: ["Recurring"],
    }),
    updateRecurring: build.mutation<
      RecurringEntryResponse,
      { id: string; body: UpdateRecurringRequest }
    >({
      query: ({ id, body }) => ({
        url: `recurring/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Recurring"],
    }),
    deleteRecurring: build.mutation<void, string>({
      query: (id) => ({ url: `recurring/${id}`, method: "DELETE" }),
      invalidatesTags: ["Recurring"],
    }),
    prepareRecurring: build.query<PrepareRecurringResponse, string | void>({
      query: (month) => `recurring/prepare${month ? `?month=${month}` : ""}`,
      providesTags: ["Recurring"],
    }),
    confirmRecurring: build.mutation<
      RecurringEntryResponse,
      { id: string; month: string }
    >({
      query: ({ id, month }) => ({
        url: `recurring/${id}/confirm`,
        method: "POST",
        body: { month },
      }),
      // Creates the real entry via domain services - refresh everything.
      invalidatesTags: [
        "Recurring",
        "Dashboard",
        "IdealSummary",
        "IdealTransactions",
        "ActualTransactions",
        "Accounts",
      ],
    }),
  }),
});

export const {
  useGetRecurringQuery,
  useCreateRecurringMutation,
  useUpdateRecurringMutation,
  useDeleteRecurringMutation,
  usePrepareRecurringQuery,
  useConfirmRecurringMutation,
} = recurringApi;
