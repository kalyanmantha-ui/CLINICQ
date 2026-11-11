package com.clinicq.security;

import com.clinicq.domain.Role;
import java.util.UUID;

public record AuthUser(UUID id, Role role) {}
