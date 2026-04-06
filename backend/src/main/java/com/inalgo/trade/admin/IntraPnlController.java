package com.inalgo.trade.admin;

import com.inalgo.trade.security.TenantContext;
import jakarta.validation.ValidationException;
import jakarta.validation.constraints.NotBlank;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Locale;

@Validated
@RestController
@RequestMapping("/api/v1/admin/intra-trade/pnl")
public class IntraPnlController {

    private final AdminAuthService adminAuthService;
    private final IntraPnlService intraPnlService;

    public IntraPnlController(AdminAuthService adminAuthService, IntraPnlService intraPnlService) {
        this.adminAuthService = adminAuthService;
        this.intraPnlService = intraPnlService;
    }

    @GetMapping("/dashboard")
    public IntraPnlDtos.PnlDashboardResponse dashboard(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String strategy,
            @RequestParam(required = false) String instrument,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String account
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);
        intraPnlService.refreshDailyAggregates(tenantId, username);
        return intraPnlService.dashboard(tenantId, username, mode, fromDate, toDate, strategy, instrument, status, account);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestHeader("Authorization") @NotBlank String authorizationHeader,
            @RequestParam @NotBlank String username,
            @RequestParam(defaultValue = "CSV") String format,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String strategy,
            @RequestParam(required = false) String instrument,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String account
    ) {
        String tenantId = requireTenantId();
        adminAuthService.validateToken(tenantId, authorizationHeader);

        intraPnlService.refreshDailyAggregates(tenantId, username);
        IntraPnlDtos.PnlDashboardResponse dashboard = intraPnlService.dashboard(
                tenantId,
                username,
                mode,
                fromDate,
                toDate,
                strategy,
                instrument,
                status,
                account
        );

        String normalized = StringUtils.hasText(format) ? format.trim().toUpperCase(Locale.ROOT) : "CSV";
        byte[] payload = intraPnlService.export(normalized, dashboard);
        String ext;
        MediaType mediaType;
        switch (normalized) {
            case "XLSX" -> {
                ext = "xlsx";
                mediaType = MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            }
            case "PDF" -> {
                ext = "pdf";
                mediaType = MediaType.APPLICATION_PDF;
            }
            case "CSV" -> {
                ext = "csv";
                mediaType = MediaType.TEXT_PLAIN;
            }
            default -> throw new ValidationException("format must be CSV, XLSX, or PDF");
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(mediaType);
        headers.setContentDisposition(ContentDisposition.attachment().filename("intra-pnl-report." + ext).build());
        return ResponseEntity.ok().headers(headers).body(payload);
    }

    private String requireTenantId() {
        String tenantId = TenantContext.getTenantId();
        if (!StringUtils.hasText(tenantId)) {
            throw new ValidationException("Missing tenant context");
        }
        return tenantId;
    }
}
