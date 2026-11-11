package com.clinicq.web;

import com.clinicq.domain.*;
import com.clinicq.security.AuthUser;
import com.clinicq.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {
    public record BookRequest(@NotNull UUID slotId) {}
    public record AppointmentDto(UUID id, UUID slotId, AppointmentStatus status) {}
    public record MyAppointment(UUID id, UUID slotId, String status, Instant startAt, Instant endAt, String doctorName, String specialty) {}

    private final BookingService booking;
    private final JdbcTemplate jdbc;
    public AppointmentController(BookingService booking, JdbcTemplate jdbc) { this.booking = booking; this.jdbc = jdbc; }

    @PostMapping
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<AppointmentDto> book(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody BookRequest r,
                                               @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        Appointment a = booking.book(me.id(), r.slotId(), key);
        return ResponseEntity.status(HttpStatus.CREATED).body(new AppointmentDto(a.getId(), a.getSlotId(), a.getStatus()));
    }

    @GetMapping("/mine")
    @PreAuthorize("hasRole('PATIENT')")
    public List<MyAppointment> mine(@AuthenticationPrincipal AuthUser me) {
        return jdbc.query("""
            select a.id, a.slot_id, a.status, s.start_at, s.end_at, u.full_name, d.specialty
              from appointments a
              join slots s on s.id = a.slot_id
              join doctors d on d.user_id = s.doctor_id
              join users u on u.id = s.doctor_id
             where a.patient_id = ?
             order by s.start_at desc""",
                (rs, i) -> new MyAppointment(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                        Sql.ts(rs, "start_at"), Sql.ts(rs, "end_at"), rs.getString(6), rs.getString(7)), me.id());
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('PATIENT','RECEPTIONIST','ADMIN')")
    public ResponseEntity<Void> cancel(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        booking.cancel(id, me);
        return ResponseEntity.noContent().build();
    }
}
