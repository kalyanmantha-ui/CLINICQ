package com.clinicq.service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.*;

public final class Sql {
    public static final ZoneId CLINIC_ZONE = ZoneId.of("America/Los_Angeles");
    private Sql() {}
    public static Instant ts(ResultSet rs, String col) throws SQLException {
        OffsetDateTime t = rs.getObject(col, OffsetDateTime.class);
        return t == null ? null : t.toInstant();
    }
}
