package com.clinicq.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "appointments")
public class Appointment {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "slot_id") private UUID slotId;
    @Column(name = "patient_id") private UUID patientId;
    @Enumerated(EnumType.STRING) private AppointmentStatus status = AppointmentStatus.BOOKED;
    @Column(name = "idempotency_key") private String idempotencyKey;
    @Column(name = "created_at", insertable = false, updatable = false) private Instant createdAt;
    @Column(name = "cancelled_at") private Instant cancelledAt;

    protected Appointment() {}
    public Appointment(UUID slotId, UUID patientId, String idempotencyKey) {
        this.slotId = slotId; this.patientId = patientId; this.idempotencyKey = idempotencyKey;
    }
    public UUID getId() { return id; }
    public UUID getSlotId() { return slotId; }
    public UUID getPatientId() { return patientId; }
    public AppointmentStatus getStatus() { return status; }
    public Instant getCancelledAt() { return cancelledAt; }
    public void cancel() { this.status = AppointmentStatus.CANCELLED; this.cancelledAt = Instant.now(); }
}
