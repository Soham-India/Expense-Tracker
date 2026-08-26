import { apiSlice } from "@/store/api/apiSlice";
import type {
  AddGroupMemberRequest,
  BalancesResponse,
  CreateGroupRequest,
  CreatePersonRequest,
  GroupResponse,
  PersonResponse,
  SettlementRequest,
  SettlementResponse,
  SplitExpenseRequest,
  SplitExpenseResponse,
  UpdateGroupRequest,
  UpdatePersonRequest,
} from "@/types/api";
import type { MonthString } from "@/lib/dates";

export interface ListSplitExpensesArgs {
  month?: MonthString;
  groupId?: string;
}

export interface ListSettlementsArgs {
  month?: MonthString;
}

export const splitsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getPeople: build.query<PersonResponse[], boolean | void>({
      query: (includeArchived) =>
        `splits/people${includeArchived ? "?includeArchived=true" : ""}`,
      providesTags: ["People"],
    }),
    createPerson: build.mutation<PersonResponse, CreatePersonRequest>({
      query: (body) => ({ url: "splits/people", method: "POST", body }),
      invalidatesTags: ["People", "Dashboard"],
    }),
    updatePerson: build.mutation<
      PersonResponse,
      { id: string; body: UpdatePersonRequest }
    >({
      query: ({ id, body }) => ({
        url: `splits/people/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["People"],
    }),
    deletePerson: build.mutation<void, string>({
      query: (id) => ({ url: `splits/people/${id}`, method: "DELETE" }),
      // 409 when referenced; 400 for the self record (UI hides delete there).
      invalidatesTags: ["People"],
    }),
    getGroups: build.query<GroupResponse[], void>({
      query: () => "splits/groups",
      providesTags: ["Groups"],
    }),
    createGroup: build.mutation<GroupResponse, CreateGroupRequest>({
      query: (body) => ({ url: "splits/groups", method: "POST", body }),
      invalidatesTags: ["Groups"],
    }),
    updateGroup: build.mutation<
      GroupResponse,
      { id: string; body: UpdateGroupRequest }
    >({
      query: ({ id, body }) => ({
        url: `splits/groups/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    deleteGroup: build.mutation<void, string>({
      query: (id) => ({ url: `splits/groups/${id}`, method: "DELETE" }),
      invalidatesTags: ["Groups"],
    }),
    addGroupMember: build.mutation<
      GroupResponse,
      { groupId: string; body: AddGroupMemberRequest }
    >({
      query: ({ groupId, body }) => ({
        url: `splits/groups/${groupId}/members`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Groups"],
    }),
    removeGroupMember: build.mutation<
      void,
      { groupId: string; personId: string }
    >({
      query: ({ groupId, personId }) => ({
        url: `splits/groups/${groupId}/members/${personId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Groups"],
    }),
    getSplitExpenses: build.query<
      SplitExpenseResponse[],
      ListSplitExpensesArgs | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.month) params.set("month", args.month);
        if (args?.groupId) params.set("groupId", args.groupId);
        const qs = params.toString();
        return `splits/expenses${qs ? `?${qs}` : ""}`;
      },
      providesTags: ["SplitExpenses"],
    }),
    addSplitExpense: build.mutation<
      SplitExpenseResponse,
      SplitExpenseRequest
    >({
      query: (body) => ({ url: "splits/expenses", method: "POST", body }),
      invalidatesTags: ["Dashboard", "SplitExpenses", "Balances"],
    }),
    updateSplitExpense: build.mutation<
      SplitExpenseResponse,
      { id: string; body: SplitExpenseRequest }
    >({
      query: ({ id, body }) => ({
        url: `splits/expenses/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Dashboard", "SplitExpenses", "Balances"],
    }),
    deleteSplitExpense: build.mutation<void, string>({
      query: (id) => ({ url: `splits/expenses/${id}`, method: "DELETE" }),
      invalidatesTags: ["Dashboard", "SplitExpenses", "Balances"],
    }),
    getSettlements: build.query<SettlementResponse[], ListSettlementsArgs | void>({
      query: (args) =>
        `splits/settlements${args?.month ? `?month=${args.month}` : ""}`,
      providesTags: ["Settlements"],
    }),
    createSettlement: build.mutation<SettlementResponse, SettlementRequest>({
      query: (body) => ({ url: "splits/settlements", method: "POST", body }),
      // Recorded as stated - never creates an Actual transaction unless
      // actualTransactionId is explicitly passed (§3.5).
      invalidatesTags: ["Dashboard", "Settlements", "Balances"],
    }),
    getBalances: build.query<BalancesResponse, void>({
      query: () => "splits/balances",
      providesTags: ["Balances"],
    }),
  }),
});

export const {
  useGetPeopleQuery,
  useCreatePersonMutation,
  useUpdatePersonMutation,
  useDeletePersonMutation,
  useGetGroupsQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useAddGroupMemberMutation,
  useRemoveGroupMemberMutation,
  useGetSplitExpensesQuery,
  useAddSplitExpenseMutation,
  useUpdateSplitExpenseMutation,
  useDeleteSplitExpenseMutation,
  useGetSettlementsQuery,
  useCreateSettlementMutation,
  useGetBalancesQuery,
} = splitsApi;
