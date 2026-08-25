package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.AccountResponse;
import com.soham.expencetracker.dto.AccountsResponse;
import com.soham.expencetracker.dto.CreateAccountRequest;
import com.soham.expencetracker.dto.UpdateAccountRequest;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/actual/accounts")
@RequiredArgsConstructor
public class ActualAccountController {

    private final ActualService actualService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                  @Valid @RequestBody CreateAccountRequest request) {
        return actualService.createAccount(principal.id(), request);
    }

    @GetMapping
    public AccountsResponse list(@AuthenticationPrincipal AuthenticatedUser principal,
                                 @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {
        return actualService.listAccounts(principal.id(), includeArchived);
    }

    @GetMapping("/{accountId}")
    public AccountResponse get(@AuthenticationPrincipal AuthenticatedUser principal,
                               @PathVariable UUID accountId) {
        return actualService.getAccount(principal.id(), accountId);
    }

    @PutMapping("/{accountId}")
    public AccountResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                  @PathVariable UUID accountId,
                                  @Valid @RequestBody UpdateAccountRequest request) {
        return actualService.updateAccount(principal.id(), accountId, request);
    }

    @DeleteMapping("/{accountId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID accountId) {
        actualService.deleteAccount(principal.id(), accountId);
    }
}
