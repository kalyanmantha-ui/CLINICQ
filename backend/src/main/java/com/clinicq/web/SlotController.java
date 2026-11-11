package com.clinicq.web;

import com.clinicq.domain.*;
import com.clinicq.repo.SlotRepository;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class SlotController {
    public record SlotDto(UUID id, UUID doctorId, Instant startAt, Instant endAt, SlotStatus status) {}
    public record DoctorDto(UUID id, String fullName, String specialty) {}

    private final SlotRepository slots;
    private final JdbcTemplate jdbc;
    public SlotController(SlotRepository slots, JdbcTemplate jdbc) { this.slots = slots; this.jdbc = jdbc; }

    @GetMapping("/doctors")
    public List<DoctorDto> doctors() {
        return jdbc.query("select d.user_id, u.full_name, d.specialty from doctors d join users u on u.id = d.user_id order by u.full_name",
                (rs, i) -> new DoctorDto(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)));
    }

    @GetMapping("/slots")
    public List<SlotDto> openSlots(@RequestParam(required = false) UUID doctorId) {
        var page = PageRequest.of(0, 100);
        List<Slot> found = doctorId == null
                ? slots.findByStatusAndStartAtAfterOrderByStartAt(SlotStatus.OPEN, Instant.now(), page)
                : slots.findByDoctorIdAndStatusAndStartAtAfterOrderByStartAt(doctorId, SlotStatus.OPEN, Instant.now(), page);
        return found.stream().map(s -> new SlotDto(s.getId(), s.getDoctorId(), s.getStartAt(), s.getEndAt(), s.getStatus())).toList();
    }
}
