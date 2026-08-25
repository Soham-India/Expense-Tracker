package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.BalancesResponse;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.SplitService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/splits/balances")
@RequiredArgsConstructor
public class BalancesController {

    private final SplitService splitService;

    @GetMapping
    public BalancesResponse balances(@AuthenticationPrincipal AuthenticatedUser principal) {
        return splitService.balances(principal.id());
    }
}
