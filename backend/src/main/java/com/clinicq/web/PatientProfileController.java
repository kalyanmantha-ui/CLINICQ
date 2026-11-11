package com.clinicq.web;

import com.clinicq.security.*;
import com.clinicq.service.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** A patient's own sensitive details. Stored encrypted; decrypted only for the owner (or their doctor, audited). */
@RestController
@RequestMapping("/api/patients/me")
@PreAuthorize("hasRole('PATIENT')")
public class PatientProfileController {
    public record Profile(@Size(max = 40) String phone, @Size(max = 20) String dob, @Size(max = 2000) String notes) {}

    private final JdbcTemplate jdbc;
    private final FieldEncryptor crypto;
    private final AuditService audit;
    public PatientProfileController(JdbcTemplate jdbc, FieldEncryptor crypto, AuditService audit) { this.jdbc = jdbc; this.crypto = crypto; this.audit = audit; }

    @GetMapping
    public Profile get(@AuthenticationPrincipal AuthUser me) {
        return jdbc.queryForObject("select phone_enc, dob_enc, notes_enc from patients where user_id = ?",
                (rs, i) -> new Profile(crypto.decrypt(rs.getString(1)), crypto.decrypt(rs.getString(2)), crypto.decrypt(rs.getString(3))), me.id());
    }

    @PutMapping
    public ResponseEntity<Void> put(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody Profile p) {
        jdbc.update("update patients set phone_enc = ?, dob_enc = ?, notes_enc = ? where user_id = ?",
                crypto.encrypt(p.phone()), crypto.encrypt(p.dob()), crypto.encrypt(p.notes()), me.id());
        audit.record(me.id(), "PATIENT", "UPDATE_PROFILE", "patient", me.id().toString());
        return ResponseEntity.noContent().build();
    }
}
