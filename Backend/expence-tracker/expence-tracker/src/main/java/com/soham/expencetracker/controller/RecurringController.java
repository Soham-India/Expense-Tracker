package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.ConfirmRecurringRequest;
import com.soham.expencetracker.dto.CreateRecurringRequest;
import com.soham.expencetracker.dto.PrepareRecurringResponse;
import com.soham.expencetracker.dto.RecurringEntryResponse;
import com.soham.expencetracker.dto.UpdateRecurringRequest;
import com.soham.expencetracker.entity.RecurringDomain;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.RecurringService;
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
@RequestMapping("/api/recurring")
@RequiredArgsConstructor
public class RecurringController {

    private final RecurringService recurringService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RecurringEntryResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                         @Valid @RequestBody CreateRecurringRequest request) {
        return recurringService.create(principal.id(), request);
    }

    @GetMapping
    public List<RecurringEntryResponse> list(@AuthenticationPrincipal AuthenticatedUser principal,
                                             @RequestParam(required = false) RecurringDomain domain,
                                             @RequestParam(required = false, defaultValue = "false") boolean activeOnly) {
        return recurringService.list(principal.id(), domain, activeOnly);
    }

    @GetMapping("/prepare")
    public PrepareRecurringResponse prepare(@AuthenticationPrincipal AuthenticatedUser principal,
                                            @RequestParam(required = false) String month) {
        return recurringService.prepare(principal.id(), month);
    }

    @PutMapping("/{templateId}")
    public RecurringEntryResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                         @PathVariable UUID templateId,
                                         @Valid @RequestBody UpdateRecurringRequest request) {
        return recurringService.update(principal.id(), templateId, request);
    }

    @PostMapping("/{templateId}/confirm")
    public RecurringEntryResponse confirm(@AuthenticationPrincipal AuthenticatedUser principal,
                                          @PathVariable UUID templateId,
                                          @Valid @RequestBody ConfirmRecurringRequest request) {
        return recurringService.confirm(principal.id(), templateId, request);
    }

    @DeleteMapping("/{templateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID templateId) {
        recurringService.delete(principal.id(), templateId);
    }
}
