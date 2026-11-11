package com.clinicq;

import static org.junit.jupiter.api.Assertions.*;

import com.clinicq.security.FieldEncryptor;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class FieldEncryptorTest {
    private final FieldEncryptor enc = new FieldEncryptor("");

    @Test void roundTrips() {
        assertEquals("555-0100", enc.decrypt(enc.encrypt("555-0100")));
        assertEquals("héllo ✓", enc.decrypt(enc.encrypt("héllo ✓")));
    }
    @Test void nullStaysNull() { assertNull(enc.encrypt(null)); assertNull(enc.decrypt(null)); }
    @Test void ciphertextHidesPlaintextAndIsRandomised() {
        String a = enc.encrypt("555-0100"), b = enc.encrypt("555-0100");
        assertFalse(a.contains("555"));
        assertNotEquals(a, b);   // fresh IV every time
    }
    @Test void tamperingIsDetected() {
        String stored = enc.encrypt("secret");
        byte[] raw = Base64.getDecoder().decode(stored.substring(3));
        raw[raw.length - 1] ^= 1;
        String tampered = "v1:" + Base64.getEncoder().encodeToString(raw);
        assertThrows(IllegalStateException.class, () -> enc.decrypt(tampered));
    }
    @Test void wrongKeyCannotDecrypt() {
        String other = Base64.getEncoder().encodeToString("another-32-byte-key-another-32by".getBytes());
        assertThrows(IllegalStateException.class, () -> new FieldEncryptor(other).decrypt(enc.encrypt("secret")));
    }
    @Test void rejectsWrongKeyLength() {
        assertThrows(IllegalStateException.class, () -> new FieldEncryptor(Base64.getEncoder().encodeToString(new byte[16])));
    }
}
