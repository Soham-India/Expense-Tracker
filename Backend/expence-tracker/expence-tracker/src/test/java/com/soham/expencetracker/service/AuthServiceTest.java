package com.soham.expencetracker.service;

import com.soham.expencetracker.dto.LoginRequest;
import com.soham.expencetracker.dto.RegisterRequest;
import com.soham.expencetracker.entity.PersonEntity;
import com.soham.expencetracker.entity.UserEntity;
import com.soham.expencetracker.exception.DuplicateResourceException;
import com.soham.expencetracker.exception.InvalidCredentialsException;
import com.soham.expencetracker.repository.PersonRepository;
import com.soham.expencetracker.repository.UserRepository;
import com.soham.expencetracker.security.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PersonRepository personRepository;
    @Mock
    private CategoryService categoryService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    @Test
    void register_createsUser_andSelfPerson_andReturnsToken() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("bcrypt-hash");
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity user = invocation.getArgument(0);
            user.setId(UUID.randomUUID());
            return user;
        });
        when(jwtService.generateToken(any(UUID.class), eq("alice@example.com"))).thenReturn("jwt-token");
        when(jwtService.expirationMs()).thenReturn(3_600_000L);

        var response = authService.register(
                new RegisterRequest("Alice@Example.com", "password123", "Alice"));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.user().email()).isEqualTo("alice@example.com");
        assertThat(response.user().displayName()).isEqualTo("Alice");

        ArgumentCaptor<PersonEntity> personCaptor = ArgumentCaptor.forClass(PersonEntity.class);
        verify(personRepository).save(personCaptor.capture());
        PersonEntity self = personCaptor.getValue();
        assertThat(self.isSelf()).isTrue();
        assertThat(self.getName()).isEqualTo("Alice");
        assertThat(self.getUser().getEmail()).isEqualTo("alice@example.com");

        verify(categoryService).seedDefaults(self.getUser());
    }

    @Test
    void register_duplicateEmail_throwsConflict_withoutSavingAnything() {
        when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);

        assertThatThrownBy(() ->
                authService.register(new RegisterRequest("taken@example.com", "password123", "X")))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("already exists");

        verify(userRepository, never()).save(any());
        verify(personRepository, never()).save(any(PersonEntity.class));
        verify(categoryService, never()).seedDefaults(any());
    }

    @Test
    void login_withCorrectPassword_returnsToken() {
        UserEntity user = existingUser();
        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password123", "stored-hash")).thenReturn(true);
        when(jwtService.generateToken(user.getId(), "bob@example.com")).thenReturn("jwt-token");
        when(jwtService.expirationMs()).thenReturn(3_600_000L);

        var response = authService.login(new LoginRequest("Bob@Example.com", "password123"));

        assertThat(response.token()).isEqualTo("jwt-token");
        assertThat(response.user().id()).isEqualTo(user.getId());
    }

    @Test
    void login_unknownEmail_throwsInvalidCredentials() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(new LoginRequest("ghost@example.com", "whatever123")))
                .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void login_wrongPassword_throwsInvalidCredentials() {
        when(userRepository.findByEmail("bob@example.com"))
                .thenReturn(Optional.of(existingUser()));
        when(passwordEncoder.matches(eq("wrong-password"), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(new LoginRequest("bob@example.com", "wrong-password")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessageContaining("Invalid email or password");
    }

    private UserEntity existingUser() {
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID());
        user.setEmail("bob@example.com");
        user.setPasswordHash("stored-hash");
        user.setDisplayName("Bob");
        return user;
    }
}
