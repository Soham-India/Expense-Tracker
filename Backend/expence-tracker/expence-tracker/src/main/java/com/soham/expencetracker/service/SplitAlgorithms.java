package com.soham.expencetracker.service;

import com.soham.expencetracker.exception.InvalidRequestException;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/**
 * Pure split-math per PRD §7.6:
 *  - Share distribution floors every exact share to cents, then distributes
 *    the leftover cents by largest fractional remainder (ties broken by the
 *    participant's order in the request).
 *  - Ledger pairing zeroes out net = paid − share by greedily matching the
 *    largest debtor against the largest creditor.
 */
public final class SplitAlgorithms {

    private static final int CENTS = 2;

    private SplitAlgorithms() {
    }

    public record LedgerEntry(UUID debtorId, UUID creditorId, BigDecimal amount) {
    }

    public static List<BigDecimal> distributeEqual(BigDecimal total, int personCount) {
        return distributeByUnits(total, java.util.Collections.nCopies(personCount, BigDecimal.ONE));
    }

    public static List<BigDecimal> distributeExact(BigDecimal total, List<BigDecimal> exactShares) {
        BigDecimal sum = exactShares.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sum.compareTo(total) != 0) {
            throw new InvalidRequestException(
                    "EXACT shares (" + sum + ") must add up to the total amount (" + total + ")");
        }
        return normalize(exactShares);
    }

    public static List<BigDecimal> distributePercentage(BigDecimal total, List<BigDecimal> percentages) {
        BigDecimal sum = percentages.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(3, RoundingMode.HALF_UP);
        if (sum.compareTo(new BigDecimal("100")) != 0) {
            throw new InvalidRequestException(
                    "PERCENTAGE shares must add up to exactly 100% (got " + sum + "%)");
        }
        List<BigDecimal> weights = percentages.stream()
                .map(pct -> pct.divide(new BigDecimal("100"), MathContext.DECIMAL64))
                .toList();
        return distributeByWeights(total, weights);
    }

    public static List<BigDecimal> distributeByUnits(BigDecimal total, List<BigDecimal> units) {
        BigDecimal unitSum = units.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        if (unitSum.signum() <= 0) {
            throw new InvalidRequestException("SHARE split requires at least one positive unit value");
        }
        List<BigDecimal> weights = units.stream()
                .map(u -> u.divide(unitSum, MathContext.DECIMAL64))
                .toList();
        return distributeByWeights(total, weights);
    }

    private static List<BigDecimal> distributeByWeights(BigDecimal total, List<BigDecimal> weightRatios) {
        long totalCents = toCents(total);
        List<Long> floored = new ArrayList<>(weightRatios.size());
        List<Double> fractions = new ArrayList<>(weightRatios.size());
        long assigned = 0;
        for (BigDecimal ratio : weightRatios) {
            double exact = ratio.doubleValue() * totalCents;
            long floor = (long) Math.floor(exact + 1e-9);
            floored.add(floor);
            fractions.add(exact - floor);
            assigned += floor;
        }
        long leftover = totalCents - assigned;
        List<Integer> order = new ArrayList<>();
        for (int i = 0; i < floored.size(); i++) {
            order.add(i);
        }
        Comparator<Integer> byLargestRemainderThenIndex =
                Comparator.comparingDouble((Integer i) -> fractions.get(i)).reversed()
                        .thenComparingInt(i -> i);
        order.sort(byLargestRemainderThenIndex);
        for (int i = 0; i < leftover; i++) {
            floored.set(order.get(i % order.size()), floored.get(order.get(i % order.size())) + 1);
        }
        return floored.stream().map(SplitAlgorithms::fromCents).toList();
    }

    /**
     * Greedy §7.6 pairing over net = paid − share. Returns immutable ledger
     * entries debtor → creditor that zero every net position.
     */
    public static List<LedgerEntry> greedyPairing(Map<UUID, BigDecimal> netByPerson) {
        TreeMap<UUID, BigDecimal> debtors = new TreeMap<>();
        TreeMap<UUID, BigDecimal> creditors = new TreeMap<>();
        netByPerson.forEach((person, net) -> {
            if (net.signum() < 0) {
                debtors.put(person, net.negate());
            } else if (net.signum() > 0) {
                creditors.put(person, net);
            }
        });

        List<Map.Entry<UUID, BigDecimal>> debtorList = sortedDesc(debtors);
        List<Map.Entry<UUID, BigDecimal>> creditorList = sortedDesc(creditors);

        List<LedgerEntry> entries = new ArrayList<>();
        int d = 0;
        int c = 0;
        while (d < debtorList.size() && c < creditorList.size()) {
            var debtor = debtorList.get(d);
            var creditor = creditorList.get(c);
            BigDecimal settled = debtor.getValue().min(creditor.getValue());
            if (settled.signum() > 0) {
                entries.add(new LedgerEntry(debtor.getKey(), creditor.getKey(), settled));
            }
            debtor.setValue(debtor.getValue().subtract(settled));
            creditor.setValue(creditor.getValue().subtract(settled));
            if (debtor.getValue().signum() == 0) {
                d++;
            }
            if (creditor.getValue().signum() == 0) {
                c++;
            }
        }
        return entries;
    }

    private static List<Map.Entry<UUID, BigDecimal>> sortedDesc(TreeMap<UUID, BigDecimal> map) {
        return map.entrySet().stream()
                .sorted(java.util.Map.Entry.<UUID, BigDecimal>comparingByValue().reversed())
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }

    private static List<BigDecimal> normalize(List<BigDecimal> values) {
        return values.stream().map(v -> v.setScale(CENTS, RoundingMode.HALF_UP)).toList();
    }

    private static long toCents(BigDecimal amount) {
        return amount.setScale(CENTS, RoundingMode.HALF_UP).movePointRight(CENTS).longValueExact();
    }

    private static BigDecimal fromCents(long cents) {
        return BigDecimal.valueOf(cents, CENTS);
    }
}
