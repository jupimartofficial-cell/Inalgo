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
        name = "trading_script_version",
        indexes = {
                @Index(name = "idx_trading_script_version_lookup", columnList = "tenant_id, username, script_id, version DESC")
        }
)
public class TradingScriptVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "script_id", nullable = false)
    private Long scriptId;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "source_js", nullable = false, columnDefinition = "TEXT")
    private String sourceJs;

    @Column(name = "declared_inputs_json", columnDefinition = "TEXT")
    private String declaredInputsJson;

    @Column(name = "compile_diagnostics_json", columnDefinition = "TEXT")
    private String compileDiagnosticsJson;

    @Column(name = "compiled_artifact_json", columnDefinition = "TEXT")
    private String compiledArtifactJson;

    @Column(name = "compile_status", nullable = false, length = 24)
    private String compileStatus;

    @Column(name = "paper_eligible", nullable = false)
    private Boolean paperEligible;

    @Column(name = "live_eligible", nullable = false)
    private Boolean liveEligible;

    @Column(name = "compiled_at")
    private Instant compiledAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected TradingScriptVersionEntity() {
    }

    public TradingScriptVersionEntity(
            Long scriptId,
            String tenantId,
            String username,
            Integer version,
            String sourceJs,
            String declaredInputsJson,
            String compileDiagnosticsJson,
            String compiledArtifactJson,
            String compileStatus,
            Boolean paperEligible,
            Boolean liveEligible,
            Instant compiledAt
    ) {
        this.scriptId = scriptId;
        this.tenantId = tenantId;
        this.username = username;
        this.version = version;
        this.sourceJs = sourceJs;
        this.declaredInputsJson = declaredInputsJson;
        this.compileDiagnosticsJson = compileDiagnosticsJson;
        this.compiledArtifactJson = compiledArtifactJson;
        this.compileStatus = compileStatus;
        this.paperEligible = paperEligible;
        this.liveEligible = liveEligible;
        this.compiledAt = compiledAt;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getScriptId() { return scriptId; }
    public String getTenantId() { return tenantId; }
    public String getUsername() { return username; }
    public Integer getVersion() { return version; }
    public String getSourceJs() { return sourceJs; }
    public void setSourceJs(String sourceJs) { this.sourceJs = sourceJs; }
    public String getDeclaredInputsJson() { return declaredInputsJson; }
    public void setDeclaredInputsJson(String declaredInputsJson) { this.declaredInputsJson = declaredInputsJson; }
    public String getCompileDiagnosticsJson() { return compileDiagnosticsJson; }
    public void setCompileDiagnosticsJson(String compileDiagnosticsJson) { this.compileDiagnosticsJson = compileDiagnosticsJson; }
    public String getCompiledArtifactJson() { return compiledArtifactJson; }
    public void setCompiledArtifactJson(String compiledArtifactJson) { this.compiledArtifactJson = compiledArtifactJson; }
    public String getCompileStatus() { return compileStatus; }
    public void setCompileStatus(String compileStatus) { this.compileStatus = compileStatus; }
    public Boolean getPaperEligible() { return paperEligible; }
    public void setPaperEligible(Boolean paperEligible) { this.paperEligible = paperEligible; }
    public Boolean getLiveEligible() { return liveEligible; }
    public void setLiveEligible(Boolean liveEligible) { this.liveEligible = liveEligible; }
    public Instant getCompiledAt() { return compiledAt; }
    public void setCompiledAt(Instant compiledAt) { this.compiledAt = compiledAt; }
    public Instant getCreatedAt() { return createdAt; }
}
