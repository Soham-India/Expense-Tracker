package com.soham.expencetracker.exception;

import java.time.Instant;
import java.util.Map;

/**
 * Consistent error envelope for every failed API response.
 */
public record ErrorResponse(
        int status,
        String message,
        Instant timestamp,
        Map<String, String> fieldErrors) {

    public static ErrorResponse of(int status, String message) {
        return new ErrorResponse(status, message, Instant.now(), null);
    }

    public static ErrorResponse withFieldErrors(int status, String message, Map<String, String> fieldErrors) {
        return new ErrorResponse(status, message, Instant.now(), fieldErrors);
    }
}
