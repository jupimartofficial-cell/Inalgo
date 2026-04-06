package com.inalgo.trade.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(
        name = "trading_script",
        indexes = {
                @Index(name = "idx_trading_script_library_lookup", columnList = "tenant_id, username, updated_at DESC"),
                @Index(name = "idx_trading_script_library_filters", columnList = "tenant_id, username, status, compile_status, instrument_key, timeframe_unit, timeframe_interval")
        }
)
public class TradingScriptEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "script_name", nullable = false, length = 120)
    private String scriptName;

    @Column(name = "instrument_key", nullable = false, length = 128)
    private String instrumentKey;

    @Column(name = "timeframe_unit", nullable = false, length = 16)
    private String timeframeUnit;

    @Column(name = "timeframe_interval", nullable = false)
    private Integer timeframeInterval;

    @Column(name = "strategy_type", nullable = false, length = 16)
    private String strategyType;

    @Column(name = "market_session", length = 64)
    private String marketSession;

    @Column(name = "status", nullable = false, length = 24)
    private String status;

    @Column(name = "publish_state", nullable = false, length = 24)
    private String publishState;

    @Column(name = "compile_status", nullable = false, length = 24)
    private String compileStatus;

    @Column(name = "current_version", nullable = false)
    private Integer currentVersion;

    @Column(name = "current_version_id")
    private Long currentVersionId;

    @Column(name = "paper_eligible", nullable = false)
    private Boolean paperEligible;

    @Column(name = "live_eligible", nullable = false)
    private Boolean liveEligible;

    @Column(name = "creator", nullable = false, length = 64)
    private String creator;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TradingScriptEntity() {
    }

    public TradingScriptEntity(
            String tenantId,
            String username,
            String scriptName,
            String instrumentKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String strategyType,
            String marketSession,
            String status,
            String publishState,
            String compileStatus,
            Integer currentVersion,
            Long currentVersionId,
            Boolean paperEligible,
            Boolean liveEligible,
            String creator
    ) {
        this.tenantId = tenantId;
        this.username = username;
        this.scriptName = scriptName;
        this.instrumentKey = instrumentKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.strategyType = strategyType;
        this.marketSession = marketSession;
        this.status = status;
        this.publishState = publishState;
        this.compileStatus = compileStatus;
        this.currentVersion = currentVersion;
        this.currentVersionId = currentVersionId;
        this.paperEligible = paperEligible;
        this.liveEligible = liveEligible;
        this.creator = creator;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getUsername() { return username; }
    public String getScriptName() { return scriptName; }
    public void setScriptName(String scriptName) { this.scriptName = scriptName; }
    public String getInstrumentKey() { return instrumentKey; }
    public void setInstrumentKey(String instrumentKey) { this.instrumentKey = instrumentKey; }
    public String getTimeframeUnit() { return timeframeUnit; }
    public void setTimeframeUnit(String timeframeUnit) { this.timeframeUnit = timeframeUnit; }
    public Integer getTimeframeInterval() { return timeframeInterval; }
    public void setTimeframeInterval(Integer timeframeInterval) { this.timeframeInterval = timeframeInterval; }
    public String getStrategyType() { return strategyType; }
    public void setStrategyType(String strategyType) { this.strategyType = strategyType; }
    public String getMarketSession() { return marketSession; }
    public void setMarketSession(String marketSession) { this.marketSession = marketSession; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPublishState() { return publishState; }
    public void setPublishState(String publishState) { this.publishState = publishState; }
    public String getCompileStatus() { return compileStatus; }
    public void setCompileStatus(String compileStatus) { this.compileStatus = compileStatus; }
    public Integer getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(Integer currentVersion) { this.currentVersion = currentVersion; }
    public Long getCurrentVersionId() { return currentVersionId; }
    public void setCurrentVersionId(Long currentVersionId) { this.currentVersionId = currentVersionId; }
    public Boolean getPaperEligible() { return paperEligible; }
    public void setPaperEligible(Boolean paperEligible) { this.paperEligible = paperEligible; }
    public Boolean getLiveEligible() { return liveEligible; }
    public void setLiveEligible(Boolean liveEligible) { this.liveEligible = liveEligible; }
    public String getCreator() { return creator; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
