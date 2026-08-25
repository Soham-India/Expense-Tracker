package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.SplitExpenseRequest;
import com.soham.expencetracker.dto.SplitExpenseResponse;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.SplitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/splits/expenses")
@RequiredArgsConstructor
public class SplitExpenseController {

    private final SplitService splitService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SplitExpenseResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                       @Valid @RequestBody SplitExpenseRequest request) {
        return splitService.createExpense(principal.id(), request);
    }

    @GetMapping
    public List<SplitExpenseResponse> list(@AuthenticationPrincipal AuthenticatedUser principal,
                                           @RequestParam(required = false) String month,
                                           @RequestParam(required = false) UUID groupId) {
        return splitService.listExpenses(principal.id(), month, groupId);
    }

    @GetMapping("/{expenseId}")
    public SplitExpenseResponse get(@AuthenticationPrincipal AuthenticatedUser principal,
                                    @PathVariable UUID expenseId) {
        return splitService.getExpense(principal.id(), expenseId);
    }

    @PutMapping("/{expenseId}")
    public SplitExpenseResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                       @PathVariable UUID expenseId,
                                       @Valid @RequestBody SplitExpenseRequest request) {
        return splitService.updateExpense(principal.id(), expenseId, request);
    }

    @DeleteMapping("/{expenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID expenseId) {
        splitService.deleteExpense(principal.id(), expenseId);
    }
}
