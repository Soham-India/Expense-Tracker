package com.soham.expencetracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ConfirmRecurringRequest(

        @NotBlank(message = "Month is required")
        @Pattern(regexp = "\\d{4}-\\d{2}", message = "Month must be in yyyy-MM format")
        String month) {
}
