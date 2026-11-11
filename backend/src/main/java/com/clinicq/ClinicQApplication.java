package com.clinicq;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ClinicQApplication {
    public static void main(String[] args) {
        SpringApplication.run(ClinicQApplication.class, args);
    }
}
