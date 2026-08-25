package com.soham.expencetracker.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Bound from jwt.* properties. Values come exclusively from environment
 * variables or the git-ignored application-local.properties.
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(String secret, long expirationMs) {
}
