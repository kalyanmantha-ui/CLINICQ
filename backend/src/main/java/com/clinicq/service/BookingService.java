package com.clinicq.service;

import com.clinicq.domain.*;
import com.clinicq.repo.*;
import com.clinicq.security.AuthUser;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {
    private final SlotRepository slots;
    private final AppointmentRepository appts;
    private final AuditService audit;
    private final OfferService offers;
    private final boolean naive;

    public BookingService(SlotRepository slots, AppointmentRepository appts, AuditService audit, OfferService offers,
                          @Value("${clinicq.booking.mode}") String mode) {
        this.slots = slots; this.appts = appts; this.audit = audit; this.offers = offers;
        this.naive = "naive".equalsIgnoreCase(mode);
    }

    /**
     * Two layers stop double-booking:
     *  1. SELECT ... FOR UPDATE on the slot row serialises concurrent bookers of the same slot.
     *  2. A partial unique index on appointments(slot_id) is the last line of defence.
     * "naive" mode skips layer 1 (check-then-act race) and exists only to reproduce the bug.
     */
    @Transactional
    public Appointment book(UUID patientId, UUID slotId, String idempotencyKey) {
        if (idempotencyKey != null) {
            var existing = appts.findByPatientIdAndIdempotencyKey(patientId, idempotencyKey);
            if (existing.isPresent()) return existing.get();   // retry of the same request: same result
        }
        Slot slot = (naive ? slots.findById(slotId) : slots.findByIdForUpdate(slotId))
                .orElseThrow(() -> ApiException.notFound("SLOT"));
        if (slot.getStatus() != SlotStatus.OPEN || !slot.getStartAt().isAfter(Instant.now())) {
            throw ApiException.slotTaken();
        }
        slot.setStatus(SlotStatus.BOOKED);
        Appointment a = appts.saveAndFlush(new Appointment(slotId, patientId, idempotencyKey));
        audit.record(patientId, Role.PATIENT.name(), "BOOK_APPOINTMENT", "appointment", a.getId().toString());
        return a;
    }

    @Transactional
    public void cancel(UUID appointmentId, AuthUser actor) {
        Appointment a = appts.findById(appointmentId).orElseThrow(() -> ApiException.notFound("APPOINTMENT"));
        boolean staff = actor.role() == Role.RECEPTIONIST || actor.role() == Role.ADMIN;
        if (!staff && !a.getPatientId().equals(actor.id())) throw ApiException.forbidden();
        if (a.getStatus() != AppointmentStatus.BOOKED) return;   // already cancelled: idempotent
        Slot slot = slots.findByIdForUpdate(a.getSlotId()).orElseThrow(() -> ApiException.notFound("SLOT"));
        a.cancel();
        offers.offerOrReopen(slot.getId(), a.getPatientId());   // next in the waitlist gets it, else it re-opens
        audit.record(actor.id(), actor.role().name(), "CANCEL_APPOINTMENT", "appointment", a.getId().toString());
    }
}
