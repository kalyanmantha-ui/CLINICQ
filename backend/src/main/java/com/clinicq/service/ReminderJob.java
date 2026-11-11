package com.clinicq.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ReminderJob {
    private static final Logger log = LoggerFactory.getLogger(ReminderJob.class);
    private final ReminderService reminders;
    public ReminderJob(ReminderService reminders) { this.reminders = reminders; }

    @Scheduled(initialDelay = 3000, fixedDelayString = "${clinicq.reminders.sweep-ms}")
    void run() {
        try {
            int n = reminders.sweep();
            if (n > 0) log.info("sent {} reminder(s)", n);
        } catch (RuntimeException e) {
            log.warn("reminder sweep failed: {}", e.getClass().getSimpleName());
        }
    }
}
