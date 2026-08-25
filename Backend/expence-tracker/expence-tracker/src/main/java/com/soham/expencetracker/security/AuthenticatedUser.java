package com.soham.expencetracker.security;

import java.util.UUID;

/**
 * The authenticated principal placed into the SecurityContext by
 * {@link JwtAuthFilter}. Injected into controllers via @AuthenticationPrincipal.
 */
public record AuthenticatedUser(UUID id, String email) {
}
