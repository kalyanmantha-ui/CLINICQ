package com.clinicq.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class OfferExpiryJob {
    private static final Logger log = LoggerFactory.getLogger(OfferExpiryJob.class);
    private final OfferService offers;
    public OfferExpiryJob(OfferService offers) { this.offers = offers; }

    @Scheduled(fixedDelayString = "${clinicq.offers.sweep-ms}")
    void sweep() {
        try {
            int n = 0;
            while (offers.expireOne()) n++;      // each offer expires in its own short transaction
            if (n > 0) log.info("expired {} offer(s)", n);
        } catch (RuntimeException e) {
            log.warn("offer sweep failed: {}", e.getClass().getSimpleName());   // class only; never log row data
        }
    }
}
