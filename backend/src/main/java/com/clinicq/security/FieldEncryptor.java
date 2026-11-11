package com.clinicq.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * AES-256-GCM field encryption for sensitive columns (phone, date of birth, notes).
 * Stored form: "v1:" + base64(12-byte random IV || ciphertext+tag). A fresh IV per value means equal inputs
 * give different ciphertexts, and GCM's tag makes any tampering fail loudly on decrypt.
 */
@Component
public class FieldEncryptor {
    private static final Logger log = LoggerFactory.getLogger(FieldEncryptor.class);
    static final String DEV_KEY_TEXT = "dev-only-key-dev-only-key-32byte"; // 32 bytes; local development only
    private static final String PREFIX = "v1:";
    private final SecretKey key;
    private final SecureRandom random = new SecureRandom();

    public FieldEncryptor(@Value("${clinicq.crypto.key:}") String base64Key) {
        byte[] raw;
        if (base64Key == null || base64Key.isBlank()) {
            log.warn("FIELD_ENCRYPTION_KEY is not set: using the insecure development key. Set it for any shared or deployed environment.");
            raw = DEV_KEY_TEXT.getBytes(StandardCharsets.UTF_8);
        } else {
            raw = Base64.getDecoder().decode(base64Key.trim());
        }
        if (raw.length != 32) throw new IllegalStateException("FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes");
        this.key = new SecretKeySpec(raw, "AES");
    }

    public String encrypt(String plain) {
        if (plain == null) return null;
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("encryption failed");   // no input in the message
        }
    }

    public String decrypt(String stored) {
        if (stored == null) return null;
        if (!stored.startsWith(PREFIX)) throw new IllegalStateException("unknown ciphertext format");
        try {
            byte[] in = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, in, 0, 12));
            return new String(c.doFinal(in, 12, in.length - 12), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("decryption failed");
        }
    }
}
