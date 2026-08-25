package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.CreatePersonRequest;
import com.soham.expencetracker.dto.PersonResponse;
import com.soham.expencetracker.dto.UpdatePersonRequest;
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
@RequestMapping("/api/splits/people")
@RequiredArgsConstructor
public class PersonController {

    private final SplitService splitService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PersonResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                 @Valid @RequestBody CreatePersonRequest request) {
        return splitService.createPerson(principal.id(), request);
    }

    @GetMapping
    public List<PersonResponse> list(@AuthenticationPrincipal AuthenticatedUser principal,
                                     @RequestParam(required = false, defaultValue = "false") boolean includeArchived) {
        return splitService.listPeople(principal.id(), includeArchived);
    }

    @PutMapping("/{personId}")
    public PersonResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                 @PathVariable UUID personId,
                                 @Valid @RequestBody UpdatePersonRequest request) {
        return splitService.updatePerson(principal.id(), personId, request);
    }

    @DeleteMapping("/{personId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID personId) {
        splitService.deletePerson(principal.id(), personId);
    }
}
