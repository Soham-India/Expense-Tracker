package com.soham.expencetracker.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Balance view per PRD §7.6/§20. `amount` in people entries is signed from
 * the current user's perspective: positive means the user owes that person.
 */
public record BalancesResponse(
        BigDecimal youOwe,
        BigDecimal owedToYou,
        BigDecimal netBalance,
        List<PersonBalance> people,
        List<PairDebt> pairs) {

    public record PersonBalance(UUID personId, String personName, boolean self, BigDecimal amount) {
    }

    public record PairDebt(UUID fromPersonId, String fromPersonName,
                           UUID toPersonId, String toPersonName, BigDecimal amount) {
    }
}
