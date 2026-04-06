package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(
        name = "intra_strategy_version",
        indexes = {
                @Index(name = "idx_intra_strategy_version_lookup", columnList = "tenant_id, username, strategy_id, version DESC")
        }
)
public class IntraStrategyVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "strategy_id", nullable = false)
    private Long strategyId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "advanced_mode", nullable = false)
    private Boolean advancedMode;

    @Column(name = "timeframe_unit", nullable = false, length = 16)
    private String timeframeUnit;

    @Column(name = "timeframe_interval", nullable = false)
    private Integer timeframeInterval;

    @Column(name = "strategy_json", nullable = false, columnDefinition = "TEXT")
    private String strategyJson;

    @Column(name = "validation_errors_json", columnDefinition = "TEXT")
    private String validationErrorsJson;

    @Column(name = "validation_summary_json", columnDefinition = "TEXT")
    private String validationSummaryJson;

    @Column(name = "validation_warnings_json", columnDefinition = "TEXT")
    private String validationWarningsJson;

    @Column(name = "paper_eligible", nullable = false)
    private Boolean paperEligible;

    @Column(name = "live_eligible", nullable = false)
    private Boolean liveEligible;

    @Column(name = "validated_at")
    private Instant validatedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected IntraStrategyVersionEntity() {
    }

    public IntraStrategyVersionEntity(
            Long strategyId,
            String tenantId,
            String username,
            Integer version,
            Boolean advancedMode,
            String timeframeUnit,
            Integer timeframeInterval,
            String strategyJson,
            String validationErrorsJson,
            String validationSummaryJson,
            String validationWarningsJson,
            Boolean paperEligible,
            Boolean liveEligible,
            Instant validatedAt
    ) {
        this.strategyId = strategyId;
        this.tenantId = tenantId;
        this.username = username;
        this.version = version;
        this.advancedMode = advancedMode;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.strategyJson = strategyJson;
        this.validationErrorsJson = validationErrorsJson;
        this.validationSummaryJson = validationSummaryJson;
        this.validationWarningsJson = validationWarningsJson;
        this.paperEligible = paperEligible;
        this.liveEligible = liveEligible;
        this.validatedAt = validatedAt;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Long getStrategyId() {
        return strategyId;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getUsername() {
        return username;
    }

    public Integer getVersion() {
        return version;
    }

    public Boolean getAdvancedMode() {
        return advancedMode;
    }

    public String getTimeframeUnit() {
        return timeframeUnit;
    }

    public Integer getTimeframeInterval() {
        return timeframeInterval;
    }

    public String getStrategyJson() {
        return strategyJson;
    }

    public String getValidationErrorsJson() {
        return validationErrorsJson;
    }

    public void setValidationErrorsJson(String validationErrorsJson) {
        this.validationErrorsJson = validationErrorsJson;
    }

    public String getValidationSummaryJson() {
        return validationSummaryJson;
    }

    public void setValidationSummaryJson(String validationSummaryJson) {
        this.validationSummaryJson = validationSummaryJson;
    }

    public String getValidationWarningsJson() {
        return validationWarningsJson;
    }

    public void setValidationWarningsJson(String validationWarningsJson) {
        this.validationWarningsJson = validationWarningsJson;
    }

    public Boolean getPaperEligible() {
        return paperEligible;
    }

    public void setPaperEligible(Boolean paperEligible) {
        this.paperEligible = paperEligible;
    }

    public Boolean getLiveEligible() {
        return liveEligible;
    }

    public void setLiveEligible(Boolean liveEligible) {
        this.liveEligible = liveEligible;
    }

    public Instant getValidatedAt() {
        return validatedAt;
    }

    public void setValidatedAt(Instant validatedAt) {
        this.validatedAt = validatedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
