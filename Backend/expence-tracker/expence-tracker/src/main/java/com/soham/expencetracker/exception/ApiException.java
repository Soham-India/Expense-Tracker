package com.soham.expencetracker.exception;

import org.springframework.http.HttpStatus;

/**
 * Base class for expected, user-facing API errors. Handled centrally by
 * {@link GlobalExceptionHandler}.
 */
public abstract class ApiException extends RuntimeException {

    private final HttpStatus status;

    protected ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
