package com.soham.expencetracker.dto;

import java.util.List;

/**
 * `allStartingBalancesConfigured` is false when at least one account has no
 * starting balance — per §6.6, balance figures must then be treated as
 * partial data.
 */
public record AccountsResponse(List<AccountResponse> accounts, boolean allStartingBalancesConfigured) {
}
