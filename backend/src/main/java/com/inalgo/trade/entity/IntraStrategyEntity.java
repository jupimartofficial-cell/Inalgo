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
        name = "intra_strategy",
        indexes = {
                @Index(name = "idx_intra_strategy_library_lookup", columnList = "tenant_id, username, updated_at DESC"),
                @Index(name = "idx_intra_strategy_library_filters", columnList = "tenant_id, username, status, underlying_key, timeframe_unit, timeframe_interval")
        }
)
public class IntraStrategyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "strategy_name", nullable = false, length = 120)
    private String strategyName;

    @Column(name = "underlying_key", nullable = false, length = 128)
    private String underlyingKey;

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

    @Column(name = "source_backtest_strategy_id")
    private Long sourceBacktestStrategyId;

    @Column(name = "source_trading_script_id")
    private Long sourceTradingScriptId;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected IntraStrategyEntity() {
    }

    public IntraStrategyEntity(
            String tenantId,
            String username,
            String strategyName,
            String underlyingKey,
            String timeframeUnit,
            Integer timeframeInterval,
            String strategyType,
            String marketSession,
            String status,
            String publishState,
            Integer currentVersion,
            Long currentVersionId,
            Boolean paperEligible,
            Boolean liveEligible,
            String creator,
            Long sourceBacktestStrategyId
    ) {
        this.tenantId = tenantId;
        this.username = username;
        this.strategyName = strategyName;
        this.underlyingKey = underlyingKey;
        this.timeframeUnit = timeframeUnit;
        this.timeframeInterval = timeframeInterval;
        this.strategyType = strategyType;
        this.marketSession = marketSession;
        this.status = status;
        this.publishState = publishState;
        this.currentVersion = currentVersion;
        this.currentVersionId = currentVersionId;
        this.paperEligible = paperEligible;
        this.liveEligible = liveEligible;
        this.creator = creator;
        this.sourceBacktestStrategyId = sourceBacktestStrategyId;
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

    public Long getId() {
        return id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public String getUsername() {
        return username;
    }

    public String getStrategyName() {
        return strategyName;
    }

    public void setStrategyName(String strategyName) {
        this.strategyName = strategyName;
    }

    public String getUnderlyingKey() {
        return underlyingKey;
    }

    public void setUnderlyingKey(String underlyingKey) {
        this.underlyingKey = underlyingKey;
    }

    public String getTimeframeUnit() {
        return timeframeUnit;
    }

    public void setTimeframeUnit(String timeframeUnit) {
        this.timeframeUnit = timeframeUnit;
    }

    public Integer getTimeframeInterval() {
        return timeframeInterval;
    }

    public void setTimeframeInterval(Integer timeframeInterval) {
        this.timeframeInterval = timeframeInterval;
    }

    public String getStrategyType() {
        return strategyType;
    }

    public void setStrategyType(String strategyType) {
        this.strategyType = strategyType;
    }

    public String getMarketSession() {
        return marketSession;
    }

    public void setMarketSession(String marketSession) {
        this.marketSession = marketSession;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPublishState() {
        return publishState;
    }

    public void setPublishState(String publishState) {
        this.publishState = publishState;
    }

    public Integer getCurrentVersion() {
        return currentVersion;
    }

    public void setCurrentVersion(Integer currentVersion) {
        this.currentVersion = currentVersion;
    }

    public Long getCurrentVersionId() {
        return currentVersionId;
    }

    public void setCurrentVersionId(Long currentVersionId) {
        this.currentVersionId = currentVersionId;
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

    public String getCreator() {
        return creator;
    }

    public Long getSourceBacktestStrategyId() {
        return sourceBacktestStrategyId;
    }

    public Long getSourceTradingScriptId() {
        return sourceTradingScriptId;
    }

    public void setSourceTradingScriptId(Long sourceTradingScriptId) {
        this.sourceTradingScriptId = sourceTradingScriptId;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public void setArchivedAt(Instant archivedAt) {
        this.archivedAt = archivedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
