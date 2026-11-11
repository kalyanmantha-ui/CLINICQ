package com.clinicq.security;

import com.clinicq.domain.*;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class JwtService {
    private final SecretKey key;
    private final long minutes;
    private final long maxSessionSeconds;

    public JwtService(@Value("${clinicq.jwt.secret}") String secret,
                      @Value("${clinicq.jwt.access-minutes}") long minutes,
                      @Value("${clinicq.jwt.max-session-hours:12}") long maxSessionHours) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.minutes = minutes;
        this.maxSessionSeconds = maxSessionHours * 3600;
    }

    /** Token carries only the user id and role: no email or name. */
    public String issue(User u) { return issue(u, Instant.now().getEpochSecond()); }

    /** authTime = when the user actually typed a password; a refreshed token keeps it, so sessions have a hard cap. */
    public String issue(User u, long authTime) {
        Instant now = Instant.now();
        return Jwts.builder().subject(u.getId().toString()).claim("role", u.getRole().name()).claim("auth", authTime)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(minutes * 60)))
                .signWith(key).compact();
    }

    public record Parsed(UUID userId, long authTime) {}

    /** For refresh: only a still-valid token is accepted (expired tokens throw). */
    public Parsed parseForRefresh(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        Number a = c.get("auth", Number.class);
        long at = a != null ? a.longValue() : c.getIssuedAt().toInstant().getEpochSecond();
        return new Parsed(UUID.fromString(c.getSubject()), at);
    }

    public boolean withinMaxSession(long authTime) { return Instant.now().getEpochSecond() - authTime < maxSessionSeconds; }

    public AuthUser parse(String token) {
        Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        return new AuthUser(UUID.fromString(c.getSubject()), Role.valueOf(c.get("role", String.class)));
    }
}
