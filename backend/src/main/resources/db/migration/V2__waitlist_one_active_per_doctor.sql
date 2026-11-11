-- A patient can wait for a given doctor only once at a time (WAITING or holding an OFFER).
CREATE UNIQUE INDEX ux_waitlist_one_active_per_doctor
    ON waitlist_entries (patient_id, doctor_id)
    WHERE status IN ('WAITING', 'OFFERED');
