package com.clinicq.web;

import com.clinicq.security.*;
import com.clinicq.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Staff views. URL rules in SecurityConfig restrict /api/reception/** and /api/doctor/**; every read is audited. */
@RestController
@RequestMapping("/api")
public class ScheduleController {
    public record DayAppointment(UUID appointmentId, UUID slotId, Instant startAt, Instant endAt, String status, String patientName, String doctorName) {}
    public record PatientRecord(String patientName, String phone, String dob, String patientNotes, String visitNotes, String status) {}
    public record VisitNotes(@Size(max = 4000) String visitNotes) {}

    private static final String DAY_SQL = """
        select a.id, a.slot_id, s.start_at, s.end_at, a.status, p.full_name, d.full_name
          from appointments a
          join slots s on s.id = a.slot_id
          join users p on p.id = a.patient_id
          join users d on d.id = s.doctor_id
         where a.status in ('BOOKED','COMPLETED') and s.start_at >= ? and s.start_at < ? %s
         order by s.start_at""";

    private final JdbcTemplate jdbc;
    private final FieldEncryptor crypto;
    private final AuditService audit;
    public ScheduleController(JdbcTemplate jdbc, FieldEncryptor crypto, AuditService audit) { this.jdbc = jdbc; this.crypto = crypto; this.audit = audit; }

    private List<DayAppointment> day(LocalDate date, UUID doctorId) {
        Timestamp from = Timestamp.from(date.atStartOfDay(Sql.CLINIC_ZONE).toInstant());
        Timestamp to = Timestamp.from(date.plusDays(1).atStartOfDay(Sql.CLINIC_ZONE).toInstant());
        var mapper = (org.springframework.jdbc.core.RowMapper<DayAppointment>) (rs, i) -> new DayAppointment(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
                Sql.ts(rs, "start_at"), Sql.ts(rs, "end_at"), rs.getString(5), rs.getString(6), rs.getString(7));
        return doctorId == null ? jdbc.query(DAY_SQL.formatted(""), mapper, from, to)
                                : jdbc.query(DAY_SQL.formatted("and s.doctor_id = ?"), mapper, from, to, doctorId);
    }

    @GetMapping("/reception/schedule")
    public List<DayAppointment> receptionDay(@AuthenticationPrincipal AuthUser me, @RequestParam(required = false) LocalDate date) {
        audit.record(me.id(), me.role().name(), "VIEW_SCHEDULE", "schedule", "all");
        return day(date == null ? LocalDate.now(Sql.CLINIC_ZONE) : date, null);
    }

    @GetMapping("/doctor/schedule")
    public List<DayAppointment> doctorDay(@AuthenticationPrincipal AuthUser me, @RequestParam(required = false) LocalDate date) {
        audit.record(me.id(), "DOCTOR", "VIEW_SCHEDULE", "schedule", me.id().toString());
        return day(date == null ? LocalDate.now(Sql.CLINIC_ZONE) : date, me.id());
    }

    @GetMapping("/doctor/appointments/{id}/record")
    public PatientRecord record(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        var rows = jdbc.query("""
            select u.full_name, p.phone_enc, p.dob_enc, p.notes_enc, a.visit_notes_enc, a.status
              from appointments a join slots s on s.id = a.slot_id
              join patients p on p.user_id = a.patient_id join users u on u.id = a.patient_id
             where a.id = ? and s.doctor_id = ?""",
                (rs, i) -> new PatientRecord(rs.getString(1), crypto.decrypt(rs.getString(2)), crypto.decrypt(rs.getString(3)),
                        crypto.decrypt(rs.getString(4)), crypto.decrypt(rs.getString(5)), rs.getString(6)), id, me.id());
        if (rows.isEmpty()) throw ApiException.notFound("APPOINTMENT");   // not your patient -> looks like it doesn't exist
        audit.record(me.id(), "DOCTOR", "VIEW_PATIENT_RECORD", "appointment", id.toString());
        return rows.get(0);
    }

    @PutMapping("/doctor/appointments/{id}/notes")
    public ResponseEntity<Void> notes(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id, @Valid @RequestBody VisitNotes n) {
        int updated = jdbc.update("update appointments a set visit_notes_enc = ? from slots s where a.id = ? and s.id = a.slot_id and s.doctor_id = ?",
                crypto.encrypt(n.visitNotes()), id, me.id());
        if (updated == 0) throw ApiException.notFound("APPOINTMENT");
        audit.record(me.id(), "DOCTOR", "UPDATE_VISIT_NOTES", "appointment", id.toString());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/doctor/appointments/{id}/complete")
    public ResponseEntity<Void> complete(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        int updated = jdbc.update("update appointments a set status = 'COMPLETED' from slots s where a.id = ? and a.status = 'BOOKED' and s.id = a.slot_id and s.doctor_id = ?", id, me.id());
        if (updated == 0) throw ApiException.notFound("APPOINTMENT");
        audit.record(me.id(), "DOCTOR", "COMPLETE_APPOINTMENT", "appointment", id.toString());
        return ResponseEntity.noContent().build();
    }
}
