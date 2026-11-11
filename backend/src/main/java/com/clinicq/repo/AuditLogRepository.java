package com.clinicq.repo;

import com.clinicq.domain.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    java.util.List<AuditLog> findAllByOrderByIdDesc(org.springframework.data.domain.Pageable page);
}
