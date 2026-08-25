package com.soham.expencetracker.report;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/**
 * Report periods per PRD §14: weeks run Monday–Sunday; months are calendar
 * months. `ref` is any date inside the wanted period.
 */
public record ReportPeriod(LocalDate start, LocalDate end) {

    public static ReportPeriod weekly(LocalDate ref) {
        LocalDate start = ref.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        return new ReportPeriod(start, start.plusDays(6));
    }

    public static ReportPeriod monthly(LocalDate firstOfMonth) {
        LocalDate start = firstOfMonth.withDayOfMonth(1);
        return new ReportPeriod(start, start.withDayOfMonth(start.lengthOfMonth()));
    }

    public boolean contains(LocalDate date) {
        return !date.isBefore(start) && !date.isAfter(end);
    }
}
