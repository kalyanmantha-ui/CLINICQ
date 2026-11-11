package com.clinicq.service;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    public ApiException(HttpStatus status, String code) { super(code); this.status = status; this.code = code; }
    public HttpStatus status() { return status; }
    public String code() { return code; }
    public static ApiException slotTaken() { return new ApiException(HttpStatus.CONFLICT, "SLOT_TAKEN"); }
    public static ApiException notFound(String what) { return new ApiException(HttpStatus.NOT_FOUND, what + "_NOT_FOUND"); }
    public static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN"); }
}
