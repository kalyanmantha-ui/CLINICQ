package com.clinicq.service;

import com.clinicq.domain.AuditLog;
import com.clinicq.repo.AuditLogRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final AuditLogRepository repo;
    public AuditService(AuditLogRepository repo) { this.repo = repo; }

    /** Joins the caller's transaction: the audit row commits or rolls back with the change it describes. */
    public void record(UUID actorId, String actorLabel, String action, String entityType, String entityId) {
        repo.save(new AuditLog(actorId, actorLabel, action, entityType, entityId));
    }
}
