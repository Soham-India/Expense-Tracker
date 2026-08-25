package com.soham.expencetracker.security;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.WeakKeyException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET_64_CHARS =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    void generateThenParse_roundTripsIdentity() {
        JwtService service = new JwtService(new JwtProperties(SECRET_64_CHARS, 3_600_000L));
        UUID userId = UUID.randomUUID();

        String token = service.generateToken(userId, "user@example.com");
        JwtService.ParsedToken parsed = service.parseToken(token);

        assertThat(parsed.userId()).isEqualTo(userId);
        assertThat(parsed.email()).isEqualTo("user@example.com");
    }

    @Test
    void parse_rejectsGarbageToken() {
        JwtService service = new JwtService(new JwtProperties(SECRET_64_CHARS, 3_600_000L));

        assertThatThrownBy(() -> service.parseToken("not-a-jwt"))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_rejectsTamperedSignature() {
        JwtService service = new JwtService(new JwtProperties(SECRET_64_CHARS, 3_600_000L));
        String token = service.generateToken(UUID.randomUUID(), "user@example.com");

        String tampered = token.substring(0, token.length() - 2)
                + (token.endsWith("aa") ? "bb" : "aa");

        assertThatThrownBy(() -> service.parseToken(tampered))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_rejectsExpiredToken() {
        // Negative expiration => already expired at issuance.
        JwtService expiredService = new JwtService(new JwtProperties(SECRET_64_CHARS, -1_000L));
        String token = expiredService.generateToken(UUID.randomUUID(), "user@example.com");

        assertThatThrownBy(() -> expiredService.parseToken(token))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void constructor_rejectsShortSecret_failFast() {
        assertThatThrownBy(() -> new JwtService(new JwtProperties("too-short", 3_600_000L)))
                .isInstanceOf(WeakKeyException.class);
    }
}
