package com.inalgo.trade.admin;

import jakarta.validation.ValidationException;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.Locale;

final class AdminMigrationJobKeySupport {
    private AdminMigrationJobKeySupport() {
    }

    static String normalizeJobKeyForLookup(String rawJobKey, String defaultJobType) {
        JobIdentity identity = parseJobKey(rawJobKey, defaultJobType);
        return jobKey(identity.instrumentKey(), identity.timeframeUnit(), identity.timeframeInterval(), identity.jobType());
    }

    static JobIdentity parseJobKey(String rawJobKey, String defaultJobType) {
        if (!StringUtils.hasText(rawJobKey)) {
            throw new ValidationException("Invalid migration job key");
        }
        String[] parts = rawJobKey.trim().split("\\|");
        if (parts.length < 3) {
            throw new ValidationException("Invalid migration job key");
        }

        boolean hasExplicitJobType = !isInteger(parts[parts.length - 1]);

        String instrumentKey;
        String timeframeUnit;
        Integer timeframeInterval;
        String jobType;
        if (hasExplicitJobType) {
            if (parts.length < 4) {
                throw new ValidationException("Invalid migration job key");
            }
            timeframeInterval = parseTimeframeInterval(parts[parts.length - 2]);
            timeframeUnit = parts[parts.length - 3];
            instrumentKey = String.join("|", Arrays.copyOf(parts, parts.length - 3)).trim();
            jobType = parts[parts.length - 1].trim();
        } else {
            timeframeInterval = parseTimeframeInterval(parts[parts.length - 1]);
            timeframeUnit = parts[parts.length - 2];
            instrumentKey = String.join("|", Arrays.copyOf(parts, parts.length - 2)).trim();
            jobType = defaultJobType;
        }

        if (!StringUtils.hasText(instrumentKey) || !StringUtils.hasText(timeframeUnit)) {
            throw new ValidationException("Invalid migration job key");
        }
        if (!StringUtils.hasText(jobType)) {
            jobType = defaultJobType;
        }
        return new JobIdentity(instrumentKey, timeframeUnit, timeframeInterval, jobType.trim().toUpperCase(Locale.ROOT));
    }

    static String jobKey(String instrumentKey, String timeframeUnit, Integer timeframeInterval, String jobType) {
        return instrumentKey.trim() + "|" + timeframeUnit.trim() + "|" + timeframeInterval + "|" + jobType.trim();
    }

    static String tenantScopedKey(String tenantId, String jobKey) {
        return tenantId + "::" + jobKey;
    }

    private static Integer parseTimeframeInterval(String value) {
        try {
            return Integer.valueOf(value.trim());
        } catch (RuntimeException ex) {
            throw new ValidationException("Invalid migration job key");
        }
    }

    private static boolean isInteger(String value) {
        try {
            Integer.parseInt(value.trim());
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    record JobIdentity(
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String jobType
    ) {
    }
}
