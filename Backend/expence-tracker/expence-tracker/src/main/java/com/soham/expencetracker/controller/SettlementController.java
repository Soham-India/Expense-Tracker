package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.SettlementRequest;
import com.soham.expencetracker.dto.SettlementResponse;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.SplitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/splits/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SplitService splitService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SettlementResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                     @Valid @RequestBody SettlementRequest request) {
        return splitService.createSettlement(principal.id(), request);
    }

    @GetMapping
    public List<SettlementResponse> list(@AuthenticationPrincipal AuthenticatedUser principal,
                                         @RequestParam(required = false) String month) {
        return splitService.listSettlements(principal.id(), month);
    }
}
