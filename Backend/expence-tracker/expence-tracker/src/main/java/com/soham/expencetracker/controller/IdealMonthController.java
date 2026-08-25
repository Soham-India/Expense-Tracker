package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.IdealMonthResponse;
import com.soham.expencetracker.dto.IdealSummaryResponse;
import com.soham.expencetracker.dto.StartIdealMonthRequest;
import com.soham.expencetracker.dto.UpdateIdealMonthRequest;
import com.soham.expencetracker.security.AuthenticatedUser;
import com.soham.expencetracker.service.IdealService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
@RequestMapping("/api/ideal")
@RequiredArgsConstructor
public class IdealMonthController {

    private final IdealService idealService;

    @PostMapping("/months")
    @ResponseStatus(HttpStatus.CREATED)
    public IdealMonthResponse start(@AuthenticationPrincipal AuthenticatedUser principal,
                                    @Valid @RequestBody StartIdealMonthRequest request) {
        return idealService.startMonth(principal.id(), request);
    }

    @GetMapping("/months")
    public List<IdealMonthResponse> list(@AuthenticationPrincipal AuthenticatedUser principal) {
        return idealService.listMonths(principal.id());
    }

    @PutMapping("/months/{monthId}")
    public IdealMonthResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                     @PathVariable UUID monthId,
                                     @Valid @RequestBody UpdateIdealMonthRequest request) {
        return idealService.updateMonth(principal.id(), monthId, request);
    }

    @GetMapping("/summary")
    public IdealSummaryResponse summary(@AuthenticationPrincipal AuthenticatedUser principal,
                                        @RequestParam(required = false) String month) {
        return idealService.summary(principal.id(), month);
    }
}
