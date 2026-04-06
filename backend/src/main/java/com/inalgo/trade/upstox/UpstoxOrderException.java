package com.inalgo.trade.upstox;

import jakarta.validation.ValidationException;

/**
 * Domain-level exception for Upstox order API failures so callers can react to
 * known provider error codes without relying on brittle string matching.
 */
public class UpstoxOrderException extends ValidationException {

    public enum Reason {
        STATIC_IP_RESTRICTION,
        PROVIDER_REJECTION,
        API_CONNECTIVITY
    }

    private final Reason reason;
    private final String errorCode;
    private final int httpStatus;

    public UpstoxOrderException(String message, Reason reason, String errorCode, int httpStatus) {
        super(message);
        this.reason = reason;
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public UpstoxOrderException(String message, Reason reason, String errorCode, int httpStatus, Throwable cause) {
        super(message, cause);
        this.reason = reason;
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
    }

    public Reason reason() {
        return reason;
    }

    public String errorCode() {
        return errorCode;
    }

    public int httpStatus() {
        return httpStatus;
    }
}
