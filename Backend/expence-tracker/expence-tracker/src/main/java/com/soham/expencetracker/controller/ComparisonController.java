package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.ComparisonResponse;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.ComparisonService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/comparison")
@RequiredArgsConstructor
public class ComparisonController {

    private final ComparisonService comparisonService;

    @GetMapping
    public ComparisonResponse compare(@AuthenticationPrincipal AuthenticatedUser principal,
                                      @RequestParam(required = false) String month) {
        return comparisonService.compare(principal.id(), month);
    }
}
