package com.soham.expencetracker.exception;

import org.springframework.http.HttpStatus;

/**
 * 409 for delete attempts on records that still have financial history
 * pointing at them (PRD §26: archive instead of delete).
 */
public class ResourceInUseException extends ApiException {

    public ResourceInUseException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
