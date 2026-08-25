package com.soham.expencetracker.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AddGroupMemberRequest(

        @NotNull(message = "personId is required")
        UUID personId) {
}
