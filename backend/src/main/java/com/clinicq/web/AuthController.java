package com.clinicq.web;

import com.clinicq.domain.*;
import com.clinicq.repo.UserRepository;
import com.clinicq.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    public record RegisterRequest(@Email @NotBlank String email, @Size(min = 8, max = 100) String password,
                                  @NotBlank @Size(max = 100) String fullName) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record AuthResponse(String token, UUID userId, Role role, String fullName) {}

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final JdbcTemplate jdbc;

    public AuthController(UserRepository users, PasswordEncoder encoder, JwtService jwt, JdbcTemplate jdbc) {
        this.users = users; this.encoder = encoder; this.jwt = jwt; this.jdbc = jdbc;
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest r) {
        if (users.existsByEmail(r.email())) return ResponseEntity.status(HttpStatus.CONFLICT).body(java.util.Map.of("error", "EMAIL_TAKEN"));
        User u = users.saveAndFlush(new User(r.email().trim(), encoder.encode(r.password()), r.fullName().trim(), Role.PATIENT));
        jdbc.update("insert into patients(user_id) values (?)", u.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AuthResponse(jwt.issue(u), u.getId(), u.getRole(), u.getFullName()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest r) {
        var found = users.findByEmail(r.email().trim());
        if (found.isEmpty() || !found.get().isEnabled() || !encoder.matches(r.password(), found.get().getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(java.util.Map.of("error", "BAD_CREDENTIALS"));
        }
        User u = found.get();
        return ResponseEntity.ok(new AuthResponse(jwt.issue(u), u.getId(), u.getRole(), u.getFullName()));
    }

    /** Sliding session: swap a still-valid token for a fresh one. Disabled users and sessions past the hard cap are refused. */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestHeader(value = "Authorization", required = false) String header) {
        var denied = ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(java.util.Map.of("error", "SESSION_EXPIRED"));
        if (header == null || !header.startsWith("Bearer ")) return denied;
        try {
            var p = jwt.parseForRefresh(header.substring(7));
            if (!jwt.withinMaxSession(p.authTime())) return denied;
            var u = users.findById(p.userId()).filter(User::isEnabled);
            if (u.isEmpty()) return denied;
            User user = u.get();
            return ResponseEntity.ok(new AuthResponse(jwt.issue(user, p.authTime()), user.getId(), user.getRole(), user.getFullName()));
        } catch (RuntimeException e) { return denied; }
    }
}
