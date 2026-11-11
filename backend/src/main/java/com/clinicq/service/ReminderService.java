package com.clinicq.service;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * 24h and 2h reminders. A reminder is CLAIMED first by inserting into reminders (UNIQUE(appointment_id, type)),
 * then sent. Whichever app instance inserts the row owns the send, so several instances never double-send.
 * If sending fails the claim is released so the next sweep retries. (A crash between claim and send loses one
 * reminder; chosen over the risk of sending twice.) Not @Transactional on purpose: each claim commits at once.
 */
@Service
public class ReminderService {
    private static final Logger log = LoggerFactory.getLogger(ReminderService.class);
    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("EEEE, MMM d 'at' h:mm a z").withZone(Sql.CLINIC_ZONE);

    private record Due(UUID appointmentId, String email, String doctorName, Instant startAt) {}

    private final JdbcTemplate jdbc;
    private final JavaMailSender mail;
    private final AuditService audit;
    private final String from;

    public ReminderService(JdbcTemplate jdbc, JavaMailSender mail, AuditService audit, @Value("${clinicq.reminders.from}") String from) {
        this.jdbc = jdbc; this.mail = mail; this.audit = audit; this.from = from;
    }

    public int sweep() {
        // H24 only while the visit is still more than 2h away: someone who books 3h ahead gets just the 2h reminder.
        int n = send("H24", "s.start_at > now() + interval '2 hours' and s.start_at <= now() + interval '24 hours'", "in about 24 hours");
        n += send("H2", "s.start_at > now() and s.start_at <= now() + interval '2 hours'", "in about 2 hours");
        return n;
    }

    private int send(String type, String timeWindow, String phrase) {
        List<Due> due = jdbc.query("""
            select a.id, u.email, d.full_name, s.start_at
              from appointments a
              join slots s on s.id = a.slot_id
              join users u on u.id = a.patient_id
              join users d on d.id = s.doctor_id
             where a.status = 'BOOKED' and %s
               and not exists (select 1 from reminders r where r.appointment_id = a.id and r.type = ?)
             order by s.start_at limit 100""".formatted(timeWindow),
                (rs, i) -> new Due(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), Sql.ts(rs, "start_at")), type);
        int sent = 0;
        for (Due d : due) {
            int claimed = jdbc.update("insert into reminders(appointment_id, type) values (?, ?) on conflict do nothing", d.appointmentId(), type);
            if (claimed == 0) continue;   // another instance got it
            try {
                SimpleMailMessage m = new SimpleMailMessage();
                m.setFrom(from);
                m.setTo(d.email());
                m.setSubject("Reminder: your appointment is " + phrase);
                m.setText("Hello,\n\nThis is a reminder of your appointment with " + d.doctorName() + " on " + WHEN.format(d.startAt())
                        + ".\n\nNeed to cancel? Log in to ClinicQ and cancel so someone on the waitlist can take the slot.\n");
                mail.send(m);
                audit.record(null, "system", "SEND_REMINDER_" + type, "appointment", d.appointmentId().toString());
                sent++;
            } catch (RuntimeException e) {
                jdbc.update("delete from reminders where appointment_id = ? and type = ?", d.appointmentId(), type);   // release claim -> retry
                log.warn("reminder {} failed: {}", type, e.getClass().getSimpleName());   // never log the address
            }
        }
        return sent;
    }
}
