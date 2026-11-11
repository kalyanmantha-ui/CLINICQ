package com.clinicq.web;

import com.clinicq.domain.Appointment;
import com.clinicq.security.AuthUser;
import com.clinicq.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class WaitlistController {
    public record JoinRequest(@NotNull UUID doctorId, @Pattern(regexp = "ANY|MORNING|AFTERNOON") String preferredWindow) {}
    public record AppointmentDto(UUID id, UUID slotId, String status) {}

    private final OfferService offers;
    private final AuditService audit;
    public WaitlistController(OfferService offers, AuditService audit) { this.offers = offers; this.audit = audit; }

    @PostMapping("/waitlist")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<OfferService.EntryDto> join(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody JoinRequest r) {
        return ResponseEntity.status(HttpStatus.CREATED).body(offers.join(me.id(), r.doctorId(), r.preferredWindow()));
    }

    @GetMapping("/waitlist/mine")
    @PreAuthorize("hasRole('PATIENT')")
    public List<OfferService.EntryDto> mine(@AuthenticationPrincipal AuthUser me) { return offers.myEntries(me.id()); }

    @DeleteMapping("/waitlist/{id}")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<Void> leave(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        offers.leave(id, me.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/offers/mine")
    @PreAuthorize("hasRole('PATIENT')")
    public List<OfferService.OfferDto> myOffers(@AuthenticationPrincipal AuthUser me) { return offers.myOpenOffers(me.id()); }

    @PostMapping("/offers/{id}/accept")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<AppointmentDto> accept(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        Appointment a = offers.accept(id, me.id());
        return ResponseEntity.status(HttpStatus.CREATED).body(new AppointmentDto(a.getId(), a.getSlotId(), a.getStatus().name()));
    }

    @PostMapping("/offers/{id}/decline")
    @PreAuthorize("hasRole('PATIENT')")
    public ResponseEntity<Void> decline(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        offers.decline(id, me.id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/reception/waitlist")
    public List<OfferService.ReceptionEntryDto> queue(@AuthenticationPrincipal AuthUser me) {
        audit.record(me.id(), me.role().name(), "VIEW_WAITLIST", "waitlist", "all");   // staff reads are audited
        return offers.receptionQueue();
    }
}
