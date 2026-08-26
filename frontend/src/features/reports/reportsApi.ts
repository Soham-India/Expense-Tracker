import { apiSlice } from "@/store/api/apiSlice";
import type {
  ActualMonthlyReport,
  ActualWeeklyReport,
  ComparisonResponse,
  IdealMonthlyReport,
  IdealWeeklyReport,
  ReportDomain,
  SplitMonthlyReport,
  SplitWeeklyReport,
} from "@/types/api";

export interface ReportArgs {
  /** weekly: any date inside the wanted Monday-Sunday week; monthly: yyyy-MM */
  ref?: string;
}

/**
 * Reports are analysis, not records - no invalidation tags. Each visit
 * fetches fresh; RTK's short-lived cache covers back-and-forth navigation.
 */
export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    getIdealWeekly: build.query<IdealWeeklyReport, ReportArgs | void>({
      query: (args) => `reports/ideal/weekly${refQ(args?.ref)}`,
    }),
    getIdealMonthly: build.query<IdealMonthlyReport, ReportArgs | void>({
      query: (args) => `reports/ideal/monthly${refQ(args?.ref)}`,
    }),
    getActualWeekly: build.query<ActualWeeklyReport, ReportArgs | void>({
      query: (args) => `reports/actual/weekly${refQ(args?.ref)}`,
    }),
    getActualMonthly: build.query<ActualMonthlyReport, ReportArgs | void>({
      query: (args) => `reports/actual/monthly${refQ(args?.ref)}`,
    }),
    getSplitsWeekly: build.query<SplitWeeklyReport, ReportArgs | void>({
      query: (args) => `reports/splits/weekly${refQ(args?.ref)}`,
    }),
    getSplitsMonthly: build.query<SplitMonthlyReport, ReportArgs | void>({
      query: (args) => `reports/splits/monthly${refQ(args?.ref)}`,
    }),
    getComparison: build.query<ComparisonResponse, ReportArgs | void>({
      query: (args) => `comparison${args?.ref ? `?month=${args.ref}` : ""}`,
    }),
  }),
});

function refQ(ref?: string): string {
  return ref ? `?ref=${ref}` : "";
}

export const {
  useGetIdealWeeklyQuery,
  useGetIdealMonthlyQuery,
  useGetActualWeeklyQuery,
  useGetActualMonthlyQuery,
  useGetSplitsWeeklyQuery,
  useGetSplitsMonthlyQuery,
  useGetComparisonQuery,
} = reportsApi;

export const reportDomains: ReportDomain[] = ["ideal", "actual", "splits"];

export function isReportDomain(v: string): v is ReportDomain {
  return (reportDomains as string[]).includes(v);
}
