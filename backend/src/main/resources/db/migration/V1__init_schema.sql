-- ClinicQ schema v1
-- Design notes:
--  * Double-booking is prevented by the partial unique index on appointments(slot_id)
--    (database-level guarantee). The booking service ALSO takes a row lock on the slot
--    (SELECT ... FOR UPDATE) so concurrent requests queue up instead of failing.
--  * Sensitive patient fields are stored encrypted (*_enc), written by the application.
--  * audit_log stores references (ids), never patient details.

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text        NOT NULL,
    password_hash text        NOT NULL,
    full_name     text        NOT NULL,
    role          text        NOT NULL CHECK (role IN ('PATIENT','RECEPTIONIST','DOCTOR','ADMIN')),
    enabled       boolean     NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));

CREATE TABLE patients (
    user_id   uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone_enc text,
    dob_enc   text,
    notes_enc text
);

CREATE TABLE doctors (
    user_id   uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    specialty text NOT NULL
);

CREATE TABLE slots (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id uuid        NOT NULL REFERENCES doctors(user_id),
    start_at  timestamptz NOT NULL,
    end_at    timestamptz NOT NULL,
    status    text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','BOOKED','OFFERED')),
    CONSTRAINT ck_slots_time CHECK (end_at > start_at),
    CONSTRAINT uq_slots_doctor_start UNIQUE (doctor_id, start_at)
);
CREATE INDEX ix_slots_doctor_start ON slots (doctor_id, start_at);

CREATE TABLE appointments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id         uuid        NOT NULL REFERENCES slots(id),
    patient_id      uuid        NOT NULL REFERENCES patients(user_id),
    status          text        NOT NULL CHECK (status IN ('BOOKED','CANCELLED','COMPLETED')),
    idempotency_key text,
    visit_notes_enc text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    cancelled_at    timestamptz
);
-- THE no-double-booking guarantee: at most one active appointment per slot.
CREATE UNIQUE INDEX ux_appointments_one_active_per_slot
    ON appointments (slot_id) WHERE status IN ('BOOKED','COMPLETED');
-- Idempotent retries: same patient + same key returns the original booking.
CREATE UNIQUE INDEX ux_appointments_idempotency
    ON appointments (patient_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX ix_appointments_patient ON appointments (patient_id);

CREATE TABLE waitlist_entries (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id       uuid        NOT NULL REFERENCES patients(user_id),
    doctor_id        uuid        NOT NULL REFERENCES doctors(user_id),
    preferred_window text        NOT NULL DEFAULT 'ANY' CHECK (preferred_window IN ('MORNING','AFTERNOON','ANY')),
    status           text        NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','OFFERED','FULFILLED','LEFT')),
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_waitlist_queue ON waitlist_entries (doctor_id, status, created_at);

CREATE TABLE slot_offers (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id           uuid        NOT NULL REFERENCES slots(id),
    waitlist_entry_id uuid        NOT NULL REFERENCES waitlist_entries(id),
    status            text        NOT NULL DEFAULT 'OFFERED' CHECK (status IN ('OFFERED','ACCEPTED','EXPIRED','DECLINED')),
    offered_at        timestamptz NOT NULL DEFAULT now(),
    expires_at        timestamptz NOT NULL
);
-- A slot can have only one open offer at a time.
CREATE UNIQUE INDEX ux_offers_one_open_per_slot ON slot_offers (slot_id) WHERE status = 'OFFERED';
CREATE INDEX ix_offers_expiry ON slot_offers (expires_at) WHERE status = 'OFFERED';

CREATE TABLE reminders (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id uuid        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    type           text        NOT NULL CHECK (type IN ('H24','H2')),
    sent_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_reminder_once UNIQUE (appointment_id, type)   -- never send the same reminder twice
);

CREATE TABLE audit_log (
    id          bigserial PRIMARY KEY,
    actor_id    uuid,                       -- null for system/background jobs
    actor_label text        NOT NULL,       -- e.g. role or 'system'; never a patient detail
    action      text        NOT NULL,       -- e.g. VIEW_APPOINTMENT, CANCEL_APPOINTMENT
    entity_type text        NOT NULL,
    entity_id   text        NOT NULL,       -- an id only
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX ix_audit_time   ON audit_log (occurred_at DESC);
