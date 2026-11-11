package com.clinicq.repo;

import com.clinicq.domain.*;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SlotRepository extends JpaRepository<Slot, UUID> {
    /** SELECT ... FOR UPDATE: concurrent bookers of the same slot queue up here. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Slot s where s.id = :id")
    Optional<Slot> findByIdForUpdate(@Param("id") UUID id);

    List<Slot> findByStatusAndStartAtAfterOrderByStartAt(SlotStatus status, Instant after, Pageable page);
    List<Slot> findByDoctorIdAndStatusAndStartAtAfterOrderByStartAt(UUID doctorId, SlotStatus status, Instant after, Pageable page);
}
