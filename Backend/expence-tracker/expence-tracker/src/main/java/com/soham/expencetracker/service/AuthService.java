package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.AuthResponse;
import com.soham.expencetracker.dto.LoginRequest;
import com.soham.expencetracker.dto.RegisterRequest;
import com.soham.expencetracker.dto.UserResponse;
import com.soham.expencetracker.entity.PersonEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidCredentialsException;
import com.soham.expencetracker.exception.ResourceNotFoundException;
import com.soham.expencetracker.repository.PersonRepository;
import com.soham.expencetracker.repository.UserRepository;
import com.soham.expencetracker.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final CategoryService categoryService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * Registers a new account and creates the user's self Person row
     * (is_self = true, required before any Split feature is used) in the
     * same transaction — satisfying the one-self-per-user partial unique index.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("An account with this email already exists");
        }

        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setDisplayName(request.displayName().trim());
        user = userRepository.save(user);

        PersonEntity self = new PersonEntity();
        self.setUser(user);
        self.setName(user.getDisplayName());
        self.setSelf(true);
        personRepository.save(self);

        categoryService.seedDefaults(user);

        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        UserEntity user = userRepository.findByEmail(normalizeEmail(request.email()))
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid email or password");
        }
        return buildAuthResponse(user);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(UUID userId) {
        return userRepository.findById(userId)
                .map(UserResponse::from)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    private AuthResponse buildAuthResponse(UserEntity user) {
        String token = jwtService.generateToken(user.getId(), user.getEmail());
        return new AuthResponse(token, "Bearer", jwtService.expirationMs(), UserResponse.from(user));
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }
}
