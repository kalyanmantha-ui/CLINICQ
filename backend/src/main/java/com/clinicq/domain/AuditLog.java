package com.clinicq.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Ids and labels only. Never store patient details here. */
@Entity
@Table(name = "audit_log")
public class AuditLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "actor_id") private UUID actorId;
    @Column(name = "actor_label") private String actorLabel;
    private String action;
    @Column(name = "entity_type") private String entityType;
    @Column(name = "entity_id") private String entityId;
    @Column(name = "occurred_at", insertable = false, updatable = false) private Instant occurredAt;

    protected AuditLog() {}
    public AuditLog(UUID actorId, String actorLabel, String action, String entityType, String entityId) {
        this.actorId = actorId; this.actorLabel = actorLabel; this.action = action;
        this.entityType = entityType; this.entityId = entityId;
    }
    public Long getId() { return id; }
    public UUID getActorId() { return actorId; }
    public String getActorLabel() { return actorLabel; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public Instant getOccurredAt() { return occurredAt; }
}
