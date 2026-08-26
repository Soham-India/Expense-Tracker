import { apiSlice } from "@/store/api/apiSlice";
import type { DashboardResponse } from "@/types/api";
import type { MonthString } from "@/lib/dates";

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getDashboard: build.query<DashboardResponse, MonthString | void>({
      query: (month) => (month ? `dashboard?month=${month}` : "dashboard"),
      providesTags: ["Dashboard"],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
