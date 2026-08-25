package com.soham.expencetracker.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdatePersonRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        @Size(max = 255, message = "Contact info must be at most 255 characters")
        String contactInfo,

        @NotNull(message = "archived is required (true or false)")
        Boolean archived) {
}
