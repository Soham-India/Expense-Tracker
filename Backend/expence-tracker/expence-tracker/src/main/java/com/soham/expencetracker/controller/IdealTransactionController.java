package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.IdealTransactionRequest;
import com.soham.expencetracker.dto.IdealTransactionResponse;
import com.soham.expencetracker.entity.IdealTxnType;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.IdealService;
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
@RequestMapping("/api/ideal/transactions")
@RequiredArgsConstructor
public class IdealTransactionController {

    private final IdealService idealService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IdealTransactionResponse add(@AuthenticationPrincipal AuthenticatedUser principal,
                                        @Valid @RequestBody IdealTransactionRequest request) {
        return idealService.addTransaction(principal.id(), request);
    }

    @GetMapping
    public List<IdealTransactionResponse> list(@AuthenticationPrincipal AuthenticatedUser principal,
                                               @RequestParam(required = false) String month,
                                               @RequestParam(required = false) IdealTxnType type) {
        return idealService.listTransactions(principal.id(), month, type);
    }

    @PutMapping("/{txnId}")
    public IdealTransactionResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                           @PathVariable UUID txnId,
                                           @Valid @RequestBody IdealTransactionRequest request) {
        return idealService.updateTransaction(principal.id(), txnId, request);
    }

    @DeleteMapping("/{txnId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID txnId) {
        idealService.deleteTransaction(principal.id(), txnId);
    }
}
