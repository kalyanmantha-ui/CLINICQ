package com.clinicq.repo;

import com.clinicq.domain.Appointment;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    Optional<Appointment> findByPatientIdAndIdempotencyKey(UUID patientId, String key);
    List<Appointment> findByPatientIdOrderByCreatedAtDesc(UUID patientId);
}
