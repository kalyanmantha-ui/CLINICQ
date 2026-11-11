package com.clinicq.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "slots")
public class Slot {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "doctor_id") private UUID doctorId;
    @Column(name = "start_at") private Instant startAt;
    @Column(name = "end_at") private Instant endAt;
    @Enumerated(EnumType.STRING) private SlotStatus status = SlotStatus.OPEN;

    protected Slot() {}
    public Slot(UUID doctorId, Instant startAt, Instant endAt) {
        this.doctorId = doctorId; this.startAt = startAt; this.endAt = endAt;
    }
    public UUID getId() { return id; }
    public UUID getDoctorId() { return doctorId; }
    public Instant getStartAt() { return startAt; }
    public Instant getEndAt() { return endAt; }
    public SlotStatus getStatus() { return status; }
    public void setStatus(SlotStatus status) { this.status = status; }
}
