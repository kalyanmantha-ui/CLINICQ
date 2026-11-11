package com.clinicq.service;

import com.clinicq.domain.*;
import com.clinicq.repo.AppointmentRepository;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Waitlist + slot offers.
 * Concurrency rules:
 *  - the slot row lock (taken by cancel) plus ux_offers_one_open_per_slot means a slot has at most one open offer;
 *  - accept / decline / expire all lock the offer row, so only one of them can win;
 *  - the expiry sweep uses FOR UPDATE SKIP LOCKED, so several app instances can run it without clashing.
 */
@Service
public class OfferService {
    static final String CLINIC_TZ = "America/Los_Angeles";

    public record EntryDto(UUID id, UUID doctorId, String preferredWindow, String status, Instant createdAt) {}
    public record OfferDto(UUID id, UUID slotId, UUID doctorId, Instant startAt, Instant endAt, Instant expiresAt) {}
    public record ReceptionEntryDto(UUID id, String patientName, String doctorName, String preferredWindow, String status, Instant createdAt) {}

    private final JdbcTemplate jdbc;
    private final AppointmentRepository appts;
    private final AuditService audit;
    private final int expirySeconds;

    public OfferService(JdbcTemplate jdbc, AppointmentRepository appts, AuditService audit,
                        @Value("${clinicq.offers.expiry-seconds}") int expirySeconds) {
        this.jdbc = jdbc; this.appts = appts; this.audit = audit; this.expirySeconds = expirySeconds;
    }

    private static Instant ts(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
        OffsetDateTime t = rs.getObject(col, OffsetDateTime.class);
        return t == null ? null : t.toInstant();
    }

    // ---------- waitlist membership ----------

    @Transactional
    public EntryDto join(UUID patientId, UUID doctorId, String window) {
        Integer doc = jdbc.queryForObject("select count(*) from doctors where user_id = ?", Integer.class, doctorId);
        if (doc == null || doc == 0) throw ApiException.notFound("DOCTOR");
        try {
            UUID id = jdbc.queryForObject(
                "insert into waitlist_entries(patient_id, doctor_id, preferred_window) values (?,?,?) returning id",
                UUID.class, patientId, doctorId, window == null ? "ANY" : window);
            return new EntryDto(id, doctorId, window == null ? "ANY" : window, "WAITING", Instant.now());
        } catch (DuplicateKeyException e) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_WAITING");
        }
    }

    @Transactional
    public void leave(UUID entryId, UUID patientId) {
        var rows = jdbc.query("select patient_id, status from waitlist_entries where id = ? for update",
                (rs, i) -> new Object[]{rs.getObject(1, UUID.class), rs.getString(2)}, entryId);
        if (rows.isEmpty() || !rows.get(0)[0].equals(patientId)) throw ApiException.notFound("WAITLIST_ENTRY");
        String status = (String) rows.get(0)[1];
        if ("OFFERED".equals(status)) throw new ApiException(HttpStatus.CONFLICT, "RESPOND_TO_OFFER_FIRST");
        if ("WAITING".equals(status)) jdbc.update("update waitlist_entries set status = 'LEFT' where id = ?", entryId);
    }

    public List<EntryDto> myEntries(UUID patientId) {
        return jdbc.query("select id, doctor_id, preferred_window, status, created_at from waitlist_entries where patient_id = ? order by created_at desc",
                (rs, i) -> new EntryDto(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getString(4), ts(rs, "created_at")), patientId);
    }

    public List<OfferDto> myOpenOffers(UUID patientId) {
        return jdbc.query("""
            select o.id, o.slot_id, s.doctor_id, s.start_at, s.end_at, o.expires_at
              from slot_offers o
              join waitlist_entries e on e.id = o.waitlist_entry_id
              join slots s on s.id = o.slot_id
             where e.patient_id = ? and o.status = 'OFFERED' and o.expires_at > now()
             order by o.expires_at""",
                (rs, i) -> new OfferDto(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        ts(rs, "start_at"), ts(rs, "end_at"), ts(rs, "expires_at")), patientId);
    }

    public List<ReceptionEntryDto> receptionQueue() {
        return jdbc.query("""
            select e.id, p.full_name, d.full_name, e.preferred_window, e.status, e.created_at
              from waitlist_entries e
              join users p on p.id = e.patient_id
              join users d on d.id = e.doctor_id
             where e.status in ('WAITING','OFFERED')
             order by e.created_at""",
                (rs, i) -> new ReceptionEntryDto(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3),
                        rs.getString(4), rs.getString(5), ts(rs, "created_at")));
    }

    // ---------- offering a freed slot ----------

    /**
     * Offer a just-freed slot to the next matching waiting patient, or re-open it if nobody is waiting.
     * The caller must already hold the slot's row lock and be inside a transaction.
     * Patients who already had an offer for this slot (expired/declined) and the canceller are skipped.
     */
    public void offerOrReopen(UUID slotId, UUID excludePatientId) {
        List<UUID> next = jdbc.query("""
            select e.id from waitlist_entries e
              join slots s on s.id = ? and s.doctor_id = e.doctor_id
             where e.status = 'WAITING'
               and (e.preferred_window = 'ANY'
                    or (e.preferred_window = 'MORNING'   and extract(hour from s.start_at at time zone ?) < 12)
                    or (e.preferred_window = 'AFTERNOON' and extract(hour from s.start_at at time zone ?) >= 12))
               and (?::uuid is null or e.patient_id <> ?::uuid)
               and not exists (select 1 from slot_offers o where o.slot_id = s.id and o.waitlist_entry_id = e.id)
             order by e.created_at
             limit 1
             for update of e skip locked""",
                (rs, i) -> rs.getObject(1, UUID.class), slotId, CLINIC_TZ, CLINIC_TZ, excludePatientId, excludePatientId);
        if (next.isEmpty()) {
            jdbc.update("update slots set status = 'OPEN' where id = ?", slotId);
            return;
        }
        UUID entryId = next.get(0);
        jdbc.update("update slots set status = 'OFFERED' where id = ?", slotId);
        UUID offerId = jdbc.queryForObject(
            "insert into slot_offers(slot_id, waitlist_entry_id, expires_at) values (?, ?, now() + (? * interval '1 second')) returning id",
            UUID.class, slotId, entryId, expirySeconds);
        jdbc.update("update waitlist_entries set status = 'OFFERED' where id = ?", entryId);
        audit.record(null, "system", "OFFER_SLOT", "slot_offer", offerId.toString());
    }

    // ---------- patient responds ----------

    private record OfferRow(UUID slotId, UUID entryId, String status, boolean expired, UUID patientId) {}

    private OfferRow lockOffer(UUID offerId, UUID patientId) {
        var rows = jdbc.query("""
            select o.slot_id, o.waitlist_entry_id, o.status, o.expires_at <= now(), e.patient_id
              from slot_offers o join waitlist_entries e on e.id = o.waitlist_entry_id
             where o.id = ? for update of o""",
                (rs, i) -> new OfferRow(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getBoolean(4), rs.getObject(5, UUID.class)), offerId);
        if (rows.isEmpty() || !rows.get(0).patientId().equals(patientId)) throw ApiException.notFound("OFFER"); // don't reveal others' offers
        OfferRow r = rows.get(0);
        if (!"OFFERED".equals(r.status())) throw new ApiException(HttpStatus.CONFLICT, "OFFER_NOT_AVAILABLE");
        if (r.expired()) throw new ApiException(HttpStatus.CONFLICT, "OFFER_EXPIRED");
        return r;
    }

    @Transactional
    public Appointment accept(UUID offerId, UUID patientId) {
        OfferRow r = lockOffer(offerId, patientId);
        jdbc.queryForObject("select status from slots where id = ? for update", String.class, r.slotId());
        jdbc.update("update slots set status = 'BOOKED' where id = ?", r.slotId());
        Appointment a = appts.saveAndFlush(new Appointment(r.slotId(), patientId, null));
        jdbc.update("update slot_offers set status = 'ACCEPTED' where id = ?", offerId);
        jdbc.update("update waitlist_entries set status = 'FULFILLED' where id = ?", r.entryId());
        audit.record(patientId, Role.PATIENT.name(), "ACCEPT_OFFER", "slot_offer", offerId.toString());
        return a;
    }

    @Transactional
    public void decline(UUID offerId, UUID patientId) {
        OfferRow r = lockOffer(offerId, patientId);
        jdbc.queryForObject("select status from slots where id = ? for update", String.class, r.slotId());
        jdbc.update("update slot_offers set status = 'DECLINED' where id = ?", offerId);
        jdbc.update("update waitlist_entries set status = 'WAITING' where id = ?", r.entryId());
        audit.record(patientId, Role.PATIENT.name(), "DECLINE_OFFER", "slot_offer", offerId.toString());
        offerOrReopen(r.slotId(), patientId);
    }

    // ---------- background expiry ----------

    /** Expires ONE overdue offer and passes the slot on. Returns false when nothing is overdue. */
    @Transactional
    public boolean expireOne() {
        var rows = jdbc.query("""
            select o.id, o.slot_id, o.waitlist_entry_id from slot_offers o
             where o.status = 'OFFERED' and o.expires_at <= now()
             order by o.expires_at limit 1
             for update skip locked""",
                (rs, i) -> new UUID[]{rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class)});
        if (rows.isEmpty()) return false;
        UUID offerId = rows.get(0)[0], slotId = rows.get(0)[1], entryId = rows.get(0)[2];
        jdbc.queryForObject("select status from slots where id = ? for update", String.class, slotId);
        jdbc.update("update slot_offers set status = 'EXPIRED' where id = ?", offerId);
        jdbc.update("update waitlist_entries set status = 'WAITING' where id = ?", entryId);
        audit.record(null, "system", "EXPIRE_OFFER", "slot_offer", offerId.toString());
        offerOrReopen(slotId, null);
        return true;
    }
}
