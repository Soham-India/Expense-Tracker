/**
 * Mirrors the backend API contract exactly (docs/FRONTEND_HANDOFF.md §3).
 * Dates: yyyy-MM-dd strings. Months: yyyy-MM strings.
 * Money: JSON numbers (decimals semantically) - always use lib/money for math.
 * IDs: UUIDv4 strings. No pagination anywhere.
 */

// ---------------------------------------------------------------------------
// Shared enums / primitives
// ---------------------------------------------------------------------------

export type TransactionType = "INCOMING" | "OUTGOING";
export type ActualTransactionType = "INCOMING" | "OUTGOING" | "TRANSFER";
export type PaymentMethod = "UPI" | "CASH" | "CARD" | "NETBANKING" | "OTHER";
export type AccountType = "BANK" | "CASH" | "UPI" | "CARD" | "OTHER";
export type CategoryScope = "IDEAL" | "ACTUAL" | "BOTH";
export type SplitMethod = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARE";
export type GroupStatus = "ACTIVE" | "ARCHIVED";
export type RecurringDomain = "IDEAL" | "ACTUAL";
export type ReportDomain = "ideal" | "actual" | "splits";
export type ReportPeriod = "weekly" | "monthly";

// ---------------------------------------------------------------------------
// Auth (§3.1)
// ---------------------------------------------------------------------------

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  createdAt: string; // ISO-8601 with offset
}

export interface AuthResponse {
  token: string;
  tokenType: "Bearer";
  expiresInMs: number;
  user: UserResponse;
}

export interface RegisterRequest {
  email: string;
  password: string; // 8-72 chars
  displayName: string; // 2-120 chars
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Categories & Subcategories (§3.2)
// ---------------------------------------------------------------------------

export interface SubcategoryResponse {
  id: string;
  name: string;
  hidden: boolean;
  sortOrder: number;
}

export interface CategoryResponse {
  id: string;
  name: string;
  scope: CategoryScope;
  hidden: boolean;
  sortOrder: number;
  subcategories: SubcategoryResponse[];
}

export interface CreateCategoryRequest {
  name: string; // <=80
  scope: CategoryScope;
}

export interface UpdateCategoryRequest {
  name: string;
  scope: CategoryScope;
  hidden: boolean;
}

export interface ReorderCategoriesRequest {
  categoryIds: string[];
}

export interface CreateSubcategoryRequest {
  name: string; // <=80
}

export interface UpdateSubcategoryRequest {
  name: string;
  hidden: boolean;
}

// ---------------------------------------------------------------------------
// Ideal (§3.3)
// ---------------------------------------------------------------------------

export interface IdealMonthResponse {
  id: string;
  month: string; // yyyy-MM
  startingIncoming: number;
}

export interface StartIdealMonthRequest {
  month: string; // yyyy-MM
  startingIncoming: number; // >= 0
}

export interface UpdateIdealMonthRequest {
  startingIncoming: number; // >= 0
}

export interface IdealTransactionRequest {
  type: TransactionType;
  amount: number; // > 0
  categoryId?: string;
  subcategoryId?: string;
  description?: string; // <=255
  date: string; // yyyy-MM-dd
  notes?: string; // <=2000
}

export interface IdealTransactionResponse extends IdealTransactionRequest {
  id: string;
  categoryName: string | null;
  subcategoryName: string | null;
  createdAt: string;
}

export interface IdealSummaryResponse {
  month: string;
  monthStarted: boolean;
  startingIncoming: number;
  additionalIncoming: number;
  totalIncoming: number;
  totalOutgoing: number;
  budgetRemaining: number;
  overBudget: boolean;
  overBudgetAmount: number;
  utilizationPercent: number | null; // null => render "N/A" (zero incoming)
}

// ---------------------------------------------------------------------------
// Actual (§3.4)
// ---------------------------------------------------------------------------

export interface AccountResponse {
  id: string;
  name: string;
  accountType: AccountType;
  startingBalance: number | null;
  archived: boolean;
  totalInflow: number;
  totalOutflow: number;
  currentBalance: number | null;
}

export interface AccountsResponse {
  accounts: AccountResponse[];
  allStartingBalancesConfigured: boolean;
}

export interface CreateAccountRequest {
  name: string; // <=80
  accountType: AccountType;
  startingBalance?: number; // >= 0
}

export interface UpdateAccountRequest {
  name: string;
  accountType: AccountType;
  startingBalance: number | null;
  archived: boolean;
}

export interface ActualTransactionRequest {
  type: ActualTransactionType;
  amount: number; // > 0
  categoryId?: string;
  subcategoryId?: string;
  accountId?: string;
  transferToAccountId?: string;
  paymentMethod?: PaymentMethod;
  description?: string; // <=255
  date: string; // yyyy-MM-dd
  notes?: string; // <=2000
}

export interface ActualTransactionResponse extends ActualTransactionRequest {
  id: string;
  categoryName: string | null;
  subcategoryName: string | null;
  accountName: string | null;
  transferToAccountName: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Splits (§3.5)
// ---------------------------------------------------------------------------

export interface PersonResponse {
  id: string;
  name: string;
  contactInfo: string | null;
  self: boolean;
  archived: boolean;
}

export interface CreatePersonRequest {
  name: string; // <=120
  contactInfo?: string;
}

export interface UpdatePersonRequest {
  name: string;
  contactInfo?: string | null;
  archived: boolean;
}

export interface GroupMemberResponse {
  personId: string;
  personName: string;
  self: boolean;
}

export interface GroupResponse {
  id: string;
  name: string;
  description: string | null;
  status: GroupStatus;
  members: GroupMemberResponse[];
}

export interface CreateGroupRequest {
  name: string; // <=120
  description?: string;
  memberPersonIds?: string[];
}

export interface UpdateGroupRequest {
  name: string;
  description?: string | null;
  status: GroupStatus;
}

export interface AddGroupMemberRequest {
  personId: string;
}

export interface SplitParticipantInput {
  personId: string;
  paidAmount?: number; // >= 0, default 0
  shareValue?: number; // required for EXACT/PERCENTAGE/SHARE
}

export interface SplitExpenseRequest {
  groupId?: string;
  createdByPersonId: string; // required
  description?: string;
  totalAmount: number; // > 0
  splitMethod?: SplitMethod; // default EQUAL
  date: string; // yyyy-MM-dd
  participants: SplitParticipantInput[]; // unique personIds, no duplicates
}

export interface SplitParticipantResponse {
  personId: string;
  personName: string;
  shareAmount: number;
  paidAmount: number;
  splitPercentage: number | null;
  splitUnits: number | null;
}

export interface SplitExpenseResponse {
  id: string;
  groupId: string | null;
  groupName: string | null;
  createdByPersonId: string;
  createdByPersonName: string;
  totalAmount: number;
  splitMethod: SplitMethod;
  description: string | null;
  date: string;
  participants: SplitParticipantResponse[];
}

export interface SettlementRequest {
  fromPersonId: string; // must differ from toPersonId
  toPersonId: string;
  amount: number; // > 0
  date: string; // yyyy-MM-dd
  note?: string;
  actualTransactionId?: string; // explicit link ONLY
}

export interface SettlementResponse {
  id: string;
  fromPersonId: string;
  fromPersonName: string;
  toPersonId: string;
  toPersonName: string;
  amount: number;
  date: string;
  note: string | null;
  actualTransactionId: string | null;
  createdAt: string;
}

export interface PersonBalance {
  personId: string;
  personName: string;
  self: false;
  /** amount > 0 => user owes them; < 0 => they owe user */
  amount: number;
}

export interface PairBalance {
  fromPersonId: string; // debtor
  fromPersonName: string;
  toPersonId: string; // creditor
  toPersonName: string;
  amount: number;
}

export interface BalancesResponse {
  youOwe: number;
  owedToYou: number;
  netBalance: number; // owedToYou - youOwe
  people: PersonBalance[];
  pairs: PairBalance[];
}

// ---------------------------------------------------------------------------
// Reports (§3.6)
// ---------------------------------------------------------------------------

export interface IdealWeeklyReport {
  weekStart: string;
  weekEnd: string;
  idealIncoming: number;
  idealOutgoing: number;
  monthBudgetUsedPercent: number;
  monthBudgetRemaining: number;
  categoryBreakdown: { name: string; amount: number; percentOfWeek: number }[];
  dailySpending: { date: string; amount: number }[]; // all 7 days, zeros included
  highestSpendingDay: { date: string; amount: number } | null;
  lowestSpendingDay: { date: string; amount: number } | null;
  highestCategory: string | null;
  lowestCategory: string | null;
  mostFrequentCategory: string | null;
}

export interface IdealMonthlyReport {
  month: string;
  overview: {
    totalIncoming: number;
    totalOutgoing: number;
    budgetRemaining: number;
    overBudget: boolean;
    utilizationPercent: number | null;
  };
  incomingAnalysis: {
    startingIncoming: number;
    additionalIncoming: number;
    totalIncoming: number;
    incomingCount: number;
    largestIncoming: number;
    largestIncomingDescription: string | null;
  };
  overBudgetAnalysis: {
    overBudget: boolean;
    overBudgetAmount: number;
    crossedOn: string | null;
  };
  dailySpending: { date: string; amount: number }[];
  weeklySpending: { weekStart: string; amount: number }[];
  categoryBreakdown: {
    name: string;
    amount: number;
    percentOfMonth: number;
    txnCount: number;
  }[];
  subcategoryBreakdown: { categoryName: string; subcategoryName: string; amount: number }[];
  spendingFrequency: { name: string; txnCount: number; total: number }[];
  highestSpendingDay: { date: string; amount: number } | null;
  lowestSpendingDay: { date: string; amount: number } | null;
  burnRate: {
    usedPercent: number;
    elapsedPercent: number;
    verdict:
      | "ahead of the month"
      | "behind the month"
      | "roughly on track"
      | "not enough data";
  };
  projection: {
    projectedMonthEndOutgoing: number;
    isFullMonthActual: boolean;
  };
  previousMonthComparison: {
    previousMonth: string;
    previousIncoming: number;
    previousOutgoing: number;
    outgoingDelta: number;
    outgoingDeltaPercent: number | null;
  };
  categoryTrends: { category: string; months: { month: string; outgoing: number }[] }[];
  keyInsights: string[];
}

export interface ActualWeeklyReport {
  weekStart: string;
  weekEnd: string;
  moneyIn: number;
  moneyOut: number;
  netCashFlow: number;
  incomeBreakdown: { name: string; amount: number; txnCount: number }[];
  expenseBreakdown: { name: string; amount: number; txnCount: number }[];
  paymentMethodBreakdown: { method: string; amount: number; txnCount: number }[];
  dailyCashFlow: { date: string; inflow: number; outflow: number; net: number }[];
}

export interface SideAnalysis {
  total: number;
  txnCount: number;
  largest: number;
  largestDescription: string | null;
  byCategory: {
    name: string;
    amount: number;
    txnCount: number;
    percentOfSide: number;
  }[];
}

export interface ActualMonthlyReport {
  month: string;
  cashFlowOverview: {
    moneyIn: number;
    moneyOut: number;
    netCashFlow: number;
    txnCount: number;
  };
  incomeAnalysis: SideAnalysis;
  expenseAnalysis: SideAnalysis;
  categoryBreakdown: {
    name: string;
    amount: number;
    txnCount: number;
    percentOfSide: number;
  }[];
  accountAnalysis: {
    accountId: string;
    name: string;
    accountType: AccountType;
    totalInflow: number;
    totalOutflow: number;
    netMovement: number;
    startingBalance: number | null;
    currentBalance: number | null;
  }[];
  allStartingBalancesConfigured: boolean;
  paymentMethodAnalysis: { method: string; amount: number; txnCount: number }[];
  transactionCount: { total: number; incoming: number; outgoing: number; transfers: number };
  dailyCashFlow: { date: string; inflow: number; outflow: number; net: number }[];
  largestTransactions: {
    id: string;
    type: ActualTransactionType;
    amount: number;
    description: string | null;
    date: string;
  }[];
  previousMonthComparison: {
    previousMonth: string;
    previousIn: number;
    previousOut: number;
    inDelta: null;
    outDelta: null;
  };
  categoryTrends: { category: string; months: { month: string; outgoing: number }[] }[];
  cashFlowTrends: { month: string; in: number; out: number; net: number }[];
  keyInsights: string[];
}

export interface SplitWeeklyReport {
  weekStart: string;
  weekEnd: string;
  newSplitExpenseCount: number;
  newSplitExpenseTotal: number;
  settlementCount: number;
  settlementsPaidByMe: number;
  settlementsReceivedByMe: number;
  currentYouOwe: number;
  currentOwedToYou: number;
  currentNetBalance: number;
  peopleOverview: { personId: string; name: string; netWithMe: number }[];
}

export interface SplitMonthlyReport {
  month: string;
  moneyYouOwe: number;
  moneyOwedToYou: number;
  netBalance: number;
  moneyYouFronted: number;
  moneyFrontedForYou: number;
  newSplitExpenses: { count: number; total: number };
  settlements: { count: number; paidByMe: number; receivedByMe: number };
  personBreakdown: {
    personId: string;
    name: string;
    netWithMe: number;
    sharedExpenseCount: number;
  }[];
  groupBreakdown: {
    groupId: string;
    name: string;
    expenseCount: number;
    totalAmount: number;
    myShare: number;
    myPaid: number;
  }[];
  outstandingBalances: {
    fromPersonId: string;
    fromPersonName: string;
    toPersonId: string;
    toPersonName: string;
    amount: number;
  }[];
  settlementRatePercent: number | null;
  previousMonthComparison: {
    previousMonth: string;
    previousExpenseCount: number;
    previousExpenseTotal: number;
    previousSettlementCount: number;
    previousSettlementTotal: number;
  };
  debtTrends: { month: string; newDebtCreated: number; settledAmount: number }[];
  keyInsights: string[];
}

// ---------------------------------------------------------------------------
// Dashboard (§3.7)
// ---------------------------------------------------------------------------

export interface DashboardResponse {
  month: string;
  ideal: {
    monthStarted: boolean;
    totalIncoming: number;
    totalOutgoing: number;
    budgetRemaining: number;
    overBudget: boolean;
    overBudgetAmount: number;
    utilizationPercent: number | null;
  };
  actual: {
    moneyIn: number;
    moneyOut: number;
    netCashFlow: number;
    txnCount: number;
  };
  splits: {
    youOwe: number;
    owedToYou: number;
    netBalance: number;
  };
  recents: {
    ideal: IdealTransactionResponse[];
    actual: ActualTransactionResponse[];
    splits: SplitExpenseResponse[];
  };
  hints: {
    needsIdealMonth: boolean;
    hasNoAccounts: boolean;
    hasNoPeople: boolean;
  };
}

// ---------------------------------------------------------------------------
// Comparison (§3.8)
// ---------------------------------------------------------------------------

export interface ComparisonRow {
  metric: "Incoming" | "Outgoing";
  ideal: number;
  actual: number;
  difference: number; // actual - ideal
  differencePercent: number | null; // null when ideal is 0
  note: string; // neutral sentence - render verbatim
}

export interface ComparisonResponse {
  month: string;
  rows: ComparisonRow[];
}

// ---------------------------------------------------------------------------
// Recurring (§3.9)
// ---------------------------------------------------------------------------

export interface CreateRecurringRequest {
  domain: RecurringDomain;
  type: TransactionType; // TRANSFER rejected
  amount: number; // > 0
  categoryId?: string;
  subcategoryId?: string;
  accountId?: string; // ACTUAL only (400 for IDEAL)
  description: string; // <=255, required
  dayOfMonth: number; // 1-31
}

export interface UpdateRecurringRequest extends CreateRecurringRequest {
  isActive: boolean;
}

export interface RecurringEntryResponse {
  id: string;
  domain: RecurringDomain;
  type: TransactionType;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  subcategoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  description: string;
  dayOfMonth: number;
  isActive: boolean;
  lastConfirmedMonth: string | null; // yyyy-MM-dd
  createdAt: string;
}

export interface PrepareRecurringTemplate {
  templateId: string;
  domain: RecurringDomain;
  type: TransactionType;
  description: string;
  amount: number;
  dayOfMonth: number;
  targetDate: string; // day clamped to month length (31 -> Feb 28)
  alreadyConfirmed: boolean;
  blockReason: string | null;
}

export interface PrepareRecurringResponse {
  month: string;
  templates: PrepareRecurringTemplate[];
}
