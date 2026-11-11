package com.clinicq.seed;

import com.clinicq.domain.*;
import com.clinicq.repo.*;
import java.time.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Demo accounts + a week of slots. Only runs when SEED_DEMO=true and the DB is empty. */
@Component
@ConditionalOnProperty(name = "clinicq.seed.enabled", havingValue = "true")
class DemoDataSeeder implements CommandLineRunner {
    static final String DEMO_PASSWORD = "Demo#2026!";
    private final UserRepository users; private final SlotRepository slots;
    private final PasswordEncoder encoder; private final JdbcTemplate jdbc;

    DemoDataSeeder(UserRepository users, SlotRepository slots, PasswordEncoder encoder, JdbcTemplate jdbc) {
        this.users = users; this.slots = slots; this.encoder = encoder; this.jdbc = jdbc;
    }

    @Override
    public void run(String... args) {
        if (users.count() > 0) return;
        String hash = encoder.encode(DEMO_PASSWORD);
        users.save(new User("admin@clinicq.demo", hash, "Avery Admin", Role.ADMIN));
        users.save(new User("reception@clinicq.demo", hash, "Riley Reception", Role.RECEPTIONIST));
        User doc = users.saveAndFlush(new User("doctor@clinicq.demo", hash, "Dr. Dana Doctor", Role.DOCTOR));
        User pat = users.saveAndFlush(new User("patient@clinicq.demo", hash, "Pat Patient", Role.PATIENT));
        jdbc.update("insert into doctors(user_id, specialty) values (?, 'General Practice')", doc.getId());
        jdbc.update("insert into patients(user_id) values (?)", pat.getId());

        ZoneId zone = ZoneId.of("America/Los_Angeles");
        LocalDate start = LocalDate.now(zone).plusDays(1);
        for (int d = 0; d < 7; d++) {
            for (int h = 9; h < 17; h++) {
                for (int m : new int[]{0, 30}) {
                    Instant s = start.plusDays(d).atTime(h, m).atZone(zone).toInstant();
                    slots.save(new Slot(doc.getId(), s, s.plus(Duration.ofMinutes(30))));
                }
            }
        }
    }
}
