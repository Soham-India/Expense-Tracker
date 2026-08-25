package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.ActualTransactionRequest;
import com.soham.expencetracker.dto.ActualTransactionResponse;
import com.soham.expencetracker.entity.ActualTxnType;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.ActualService;
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
@RequestMapping("/api/actual/transactions")
@RequiredArgsConstructor
public class ActualTransactionController {

    private final ActualService actualService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActualTransactionResponse add(@AuthenticationPrincipal AuthenticatedUser principal,
                                         @Valid @RequestBody ActualTransactionRequest request) {
        return actualService.addTransaction(principal.id(), request);
    }

    @GetMapping
    public List<ActualTransactionResponse> list(@AuthenticationPrincipal AuthenticatedUser principal,
                                                @RequestParam(required = false) String month,
                                                @RequestParam(required = false) ActualTxnType type,
                                                @RequestParam(required = false) UUID accountId) {
        return actualService.listTransactions(principal.id(), month, type, accountId);
    }

    @PutMapping("/{txnId}")
    public ActualTransactionResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                            @PathVariable UUID txnId,
                                            @Valid @RequestBody ActualTransactionRequest request) {
        return actualService.updateTransaction(principal.id(), txnId, request);
    }

    @DeleteMapping("/{txnId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID txnId) {
        actualService.deleteTransaction(principal.id(), txnId);
    }
}
