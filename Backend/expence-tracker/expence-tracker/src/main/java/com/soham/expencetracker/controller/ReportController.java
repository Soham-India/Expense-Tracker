package com.soham.expencetracker.controller;

import com.soham.expencetracker.report.ActualMonthlyReport;
import com.soham.expencetracker.report.ActualReportService;
import com.soham.expencetracker.report.ActualWeeklyReport;
import com.soham.expencetracker.report.IdealMonthlyReport;
import com.soham.expencetracker.report.IdealReportService;
import com.soham.expencetracker.report.IdealWeeklyReport;
import com.soham.expencetracker.report.SplitMonthlyReport;
import com.soham.expencetracker.report.SplitReportService;
import com.soham.expencetracker.report.SplitWeeklyReport;
import com.soham.expencetracker.security.AuthenticatedUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Domain-owned reporting engines (PRD §14): each system reports through its
 * own weekly/monthly engine — there is no shared generic report.
 */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final IdealReportService idealReportService;
    private final ActualReportService actualReportService;
    private final SplitReportService splitReportService;

    @GetMapping("/ideal/weekly")
    public IdealWeeklyReport idealWeekly(@AuthenticationPrincipal AuthenticatedUser principal,
                                         @RequestParam(required = false) String ref) {
        return idealReportService.weekly(principal.id(), ref);
    }

    @GetMapping("/ideal/monthly")
    public IdealMonthlyReport idealMonthly(@AuthenticationPrincipal AuthenticatedUser principal,
                                           @RequestParam(required = false) String ref) {
        return idealReportService.monthly(principal.id(), ref);
    }

    @GetMapping("/actual/weekly")
    public ActualWeeklyReport actualWeekly(@AuthenticationPrincipal AuthenticatedUser principal,
                                           @RequestParam(required = false) String ref) {
        return actualReportService.weekly(principal.id(), ref);
    }

    @GetMapping("/actual/monthly")
    public ActualMonthlyReport actualMonthly(@AuthenticationPrincipal AuthenticatedUser principal,
                                             @RequestParam(required = false) String ref) {
        return actualReportService.monthly(principal.id(), ref);
    }

    @GetMapping("/splits/weekly")
    public SplitWeeklyReport splitsWeekly(@AuthenticationPrincipal AuthenticatedUser principal,
                                          @RequestParam(required = false) String ref) {
        return splitReportService.weekly(principal.id(), ref);
    }

    @GetMapping("/splits/monthly")
    public SplitMonthlyReport splitsMonthly(@AuthenticationPrincipal AuthenticatedUser principal,
                                            @RequestParam(required = false) String ref) {
        return splitReportService.monthly(principal.id(), ref);
    }
}
