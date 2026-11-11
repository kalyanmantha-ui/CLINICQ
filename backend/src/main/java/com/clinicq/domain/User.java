package com.clinicq.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private String email;
    @Column(name = "password_hash") private String passwordHash;
    @Column(name = "full_name") private String fullName;
    @Enumerated(EnumType.STRING) private Role role;
    private boolean enabled = true;
    @Column(name = "created_at", insertable = false, updatable = false) private Instant createdAt;

    protected User() {}
    public User(String email, String passwordHash, String fullName, Role role) {
        this.email = email; this.passwordHash = passwordHash; this.fullName = fullName; this.role = role;
    }
    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFullName() { return fullName; }
    public Role getRole() { return role; }
    public boolean isEnabled() { return enabled; }
    public Instant getCreatedAt() { return createdAt; }
}
