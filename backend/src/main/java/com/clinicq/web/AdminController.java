package com.clinicq.web;

import com.clinicq.domain.*;
import com.clinicq.repo.*;
import com.clinicq.security.AuthUser;
import com.clinicq.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
    public record UserDto(UUID id, String email, String fullName, Role role, boolean enabled) {}
    public record AuditDto(Long id, UUID actorId, String actorLabel, String action, String entityType, String entityId, Instant occurredAt) {}
    public record CreateUser(@Email @NotBlank String email, @Size(min = 8, max = 100) String password, @NotBlank @Size(max = 100) String fullName,
                             @NotNull Role role, @Size(max = 100) String specialty) {}
    public record SetEnabled(boolean enabled) {}
    public record GenerateSlots(@NotNull UUID doctorId, @NotNull LocalDate date, @Min(0) @Max(23) int startHour, @Min(1) @Max(24) int endHour, @Min(10) @Max(120) int minutes) {}

    private final UserRepository users;
    private final AuditLogRepository audit;
    private final AuditService auditSvc;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;
    public AdminController(UserRepository users, AuditLogRepository audit, AuditService auditSvc, PasswordEncoder encoder, JdbcTemplate jdbc) {
        this.users = users; this.audit = audit; this.auditSvc = auditSvc; this.encoder = encoder; this.jdbc = jdbc;
    }

    @GetMapping("/users")
    public List<UserDto> users() {
        return users.findAll().stream().map(u -> new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.isEnabled())).toList();
    }

    /** Staff accounts only; patients register themselves. */
    @PostMapping("/users")
    @Transactional
    public ResponseEntity<?> create(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody CreateUser r) {
        if (r.role() == Role.PATIENT) return ResponseEntity.badRequest().body(Map.of("error", "PATIENTS_SELF_REGISTER"));
        if (r.role() == Role.DOCTOR && (r.specialty() == null || r.specialty().isBlank())) return ResponseEntity.badRequest().body(Map.of("error", "SPECIALTY_REQUIRED"));
        if (users.existsByEmail(r.email())) return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "EMAIL_TAKEN"));
        User u = users.saveAndFlush(new User(r.email().trim(), encoder.encode(r.password()), r.fullName().trim(), r.role()));
        if (r.role() == Role.DOCTOR) jdbc.update("insert into doctors(user_id, specialty) values (?, ?)", u.getId(), r.specialty().trim());
        auditSvc.record(me.id(), "ADMIN", "CREATE_USER", "user", u.getId().toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole(), u.isEnabled()));
    }

    @PatchMapping("/users/{id}")
    @Transactional
    public ResponseEntity<?> setEnabled(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @RequestBody SetEnabled r) {
        if (id.equals(me.id())) return ResponseEntity.badRequest().body(Map.of("error", "CANNOT_DISABLE_SELF"));
        int n = jdbc.update("update users set enabled = ? where id = ?", r.enabled(), id);
        if (n == 0) throw ApiException.notFound("USER");
        auditSvc.record(me.id(), "ADMIN", r.enabled() ? "ENABLE_USER" : "DISABLE_USER", "user", id.toString());
        return ResponseEntity.noContent().build();
    }

    /** Creates back-to-back slots for one doctor on one clinic-local day; existing slots are left untouched. */
    @PostMapping("/slots")
    @Transactional
    public ResponseEntity<?> slots(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody GenerateSlots r) {
        if (r.endHour() <= r.startHour()) return ResponseEntity.badRequest().body(Map.of("error", "BAD_HOURS"));
        Integer isDoc = jdbc.queryForObject("select count(*) from doctors where user_id = ?", Integer.class, r.doctorId());
        if (isDoc == null || isDoc == 0) throw ApiException.notFound("DOCTOR");
        ZonedDateTime t = r.date().atTime(r.startHour(), 0).atZone(Sql.CLINIC_ZONE);
        ZonedDateTime end = r.date().atTime(0, 0).atZone(Sql.CLINIC_ZONE).plusHours(r.endHour());
        int created = 0;
        while (!t.plusMinutes(r.minutes()).isAfter(end)) {
            created += jdbc.update("insert into slots(doctor_id, start_at, end_at) values (?, ?, ?) on conflict (doctor_id, start_at) do nothing",
                    r.doctorId(), Timestamp.from(t.toInstant()), Timestamp.from(t.plusMinutes(r.minutes()).toInstant()));
            t = t.plusMinutes(r.minutes());
        }
        auditSvc.record(me.id(), "ADMIN", "CREATE_SLOTS", "doctor", r.doctorId().toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("created", created));
    }

    @GetMapping("/audit")
    public List<AuditDto> audit(@RequestParam(defaultValue = "50") int limit) {
        return audit.findAllByOrderByIdDesc(PageRequest.of(0, Math.min(limit, 200))).stream()
                .map(a -> new AuditDto(a.getId(), a.getActorId(), a.getActorLabel(), a.getAction(), a.getEntityType(), a.getEntityId(), a.getOccurredAt())).toList();
    }
}
