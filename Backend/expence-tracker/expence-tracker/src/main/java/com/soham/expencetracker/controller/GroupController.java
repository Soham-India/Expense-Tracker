package com.soham.expencetracker.controller;

import com.soham.expencetracker.dto.AddGroupMemberRequest;
import com.soham.expencetracker.dto.CreateGroupRequest;
import com.soham.expencetracker.dto.GroupResponse;
import com.soham.expencetracker.dto.UpdateGroupRequest;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/splits/groups")
@RequiredArgsConstructor
public class GroupController {

    private final SplitService splitService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupResponse create(@AuthenticationPrincipal AuthenticatedUser principal,
                                @Valid @RequestBody CreateGroupRequest request) {
        return splitService.createGroup(principal.id(), request);
    }

    @GetMapping
    public List<GroupResponse> list(@AuthenticationPrincipal AuthenticatedUser principal) {
        return splitService.listGroups(principal.id());
    }

    @GetMapping("/{groupId}")
    public GroupResponse get(@AuthenticationPrincipal AuthenticatedUser principal,
                             @PathVariable UUID groupId) {
        return splitService.getGroup(principal.id(), groupId);
    }

    @PutMapping("/{groupId}")
    public GroupResponse update(@AuthenticationPrincipal AuthenticatedUser principal,
                                @PathVariable UUID groupId,
                                @Valid @RequestBody UpdateGroupRequest request) {
        return splitService.updateGroup(principal.id(), groupId, request);
    }

    @PostMapping("/{groupId}/members")
    public GroupResponse addMember(@AuthenticationPrincipal AuthenticatedUser principal,
                                   @PathVariable UUID groupId,
                                   @Valid @RequestBody AddGroupMemberRequest request) {
        return splitService.addGroupMember(principal.id(), groupId, request);
    }

    @DeleteMapping("/{groupId}/members/{personId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@AuthenticationPrincipal AuthenticatedUser principal,
                             @PathVariable UUID groupId,
                             @PathVariable UUID personId) {
        splitService.removeGroupMember(principal.id(), groupId, personId);
    }

    @DeleteMapping("/{groupId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthenticatedUser principal,
                       @PathVariable UUID groupId) {
        splitService.deleteGroup(principal.id(), groupId);
    }
}
