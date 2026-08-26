import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ActualTransactionRequest,
  IdealTransactionRequest,
  SplitParticipantInput,
} from "@/types/api";

export type QuickAddDomain = "ideal" | "actual" | "splits";

/** Recents-driven prefill; forms merge these into their defaults and let the user edit. */
export interface QuickAddPrefill {
  ideal?: Partial<IdealTransactionRequest>;
  actual?: Partial<ActualTransactionRequest>;
  splits?: {
    groupId?: string;
    createdByPersonId?: string;
    description?: string;
    totalAmount?: number;
    date?: string;
    participants?: SplitParticipantInput[];
  };
}

interface UiState {
  quickAdd: {
    open: boolean;
    domain: QuickAddDomain;
    prefill: QuickAddPrefill | null;
  };
  startMonthOpen: boolean;
}

const initialState: UiState = {
  quickAdd: { open: false, domain: "ideal", prefill: null },
  startMonthOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    openQuickAdd(
      state,
      action: PayloadAction<{
        domain: QuickAddDomain;
        prefill?: QuickAddPrefill | null;
      }>,
    ) {
      state.quickAdd.open = true;
      state.quickAdd.domain = action.payload.domain;
      state.quickAdd.prefill = action.payload.prefill ?? null;
    },
    closeQuickAdd(state) {
      state.quickAdd.open = false;
      state.quickAdd.prefill = null;
    },
    setQuickAddDomain(state, action: PayloadAction<QuickAddDomain>) {
      state.quickAdd.domain = action.payload;
    },
    openStartMonth(state) {
      state.startMonthOpen = true;
    },
    closeStartMonth(state) {
      state.startMonthOpen = false;
    },
  },
});

export default uiSlice.reducer;
export const {
  openQuickAdd,
  closeQuickAdd,
  setQuickAddDomain,
  openStartMonth,
  closeStartMonth,
} = uiSlice.actions;
