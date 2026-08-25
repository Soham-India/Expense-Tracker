package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.DashboardResponse;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public DashboardResponse dashboard(@AuthenticationPrincipal AuthenticatedUser principal,
                                       @RequestParam(required = false) String month) {
        return dashboardService.snapshot(principal.id(), month);
    }
}
