package com.inalgo.trade.admin;

import com.inalgo.trade.entity.TradingScriptEntity;
import com.inalgo.trade.entity.TradingScriptPerfSnapshotEntity;
import com.inalgo.trade.entity.TradingScriptVersionEntity;
import com.inalgo.trade.repository.TradingScriptPerfSnapshotRepository;
import com.inalgo.trade.repository.TradingScriptRepository;
import com.inalgo.trade.repository.TradingScriptVersionRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
public class TradingScriptWorkflowSupport {

    private static final String UNTITLED_SCRIPT = "Untitled Script";

    private final TradingScriptRepository tradingScriptRepository;
    private final TradingScriptVersionRepository tradingScriptVersionRepository;
    private final TradingScriptPerfSnapshotRepository perfSnapshotRepository;
    private final TradingScriptMapperSupport mapper;
    private final TradingScriptWorkerClient workerClient;
    private final BacktestStrategyService backtestStrategyService;
    private final IntraStrategyValidationEngine intraStrategyValidationEngine;
    public TradingScriptWorkflowSupport(
            TradingScriptRepository tradingScriptRepository,
            TradingScriptVersionRepository tradingScriptVersionRepository,
            TradingScriptPerfSnapshotRepository perfSnapshotRepository,
            TradingScriptMapperSupport mapper,
            TradingScriptWorkerClient workerClient,
            BacktestStrategyService backtestStrategyService,
            IntraStrategyValidationEngine intraStrategyValidationEngine
    ) {
        this.tradingScriptRepository = tradingScriptRepository;
        this.tradingScriptVersionRepository = tradingScriptVersionRepository;
        this.perfSnapshotRepository = perfSnapshotRepository;
        this.mapper = mapper;
        this.workerClient = workerClient;
        this.backtestStrategyService = backtestStrategyService;
        this.intraStrategyValidationEngine = intraStrategyValidationEngine;
    }

    public String normalizeSource(String sourceJs) {
        String normalized = mapper.requireText(sourceJs, "sourceJs");
        if (normalized.length() > 50000) {
            throw new ValidationException("sourceJs exceeds the maximum length");
        }
        return normalized;
    }

    public TradingScriptCompileBundle compileSource(String sourceJs) {
        TradingScriptDtos.TradingScriptCompileResponse workerResponse = workerClient.compile(sourceJs);
        if (!workerResponse.valid() || workerResponse.artifact() == null) {
            return new TradingScriptCompileBundle(workerResponse);
        }
        try {
            AdminDtos.BacktestStrategyPayload normalized = backtestStrategyService.normalizeStrategyPayload(workerResponse.artifact().compiledStrategy());
            backtestStrategyService.validateStrategyPayload(normalized);
            TradingScriptDtos.TradingScriptCompiledArtifact artifact = new TradingScriptDtos.TradingScriptCompiledArtifact(
                    workerResponse.artifact().meta(),
                    workerResponse.artifact().inputs(),
                    normalized,
                    workerResponse.artifact().imports(),
                    workerResponse.artifact().notes(),
                    workerResponse.artifact().runtimeHints(),
                    workerResponse.artifact().sourceHash()
            );
            IntraStrategyDtos.IntraStrategyValidationResult validation = intraStrategyValidationEngine.validate(
                    new IntraStrategyDtos.IntraStrategyBuilderPayload(
                            artifact.compiledStrategy(),
                            artifact.meta().timeframeUnit(),
                            artifact.meta().timeframeInterval(),
                            Boolean.TRUE,
                            artifact.meta().marketSession()
                    )
            );
            boolean liveEligible = validation.liveEligible() && normalized.legs().stream().allMatch(leg -> "OPTIONS".equalsIgnoreCase(leg.segment()));
            List<String> warnings = new ArrayList<>(workerResponse.warnings());
            if (validation.liveEligible() && !liveEligible) {
                warnings.add("Live publish is restricted to option-only strategies in Trading Scripts v1.");
            }
            return new TradingScriptCompileBundle(new TradingScriptDtos.TradingScriptCompileResponse(
                    workerResponse.compileStatus(),
                    workerResponse.valid(),
                    validation.paperEligible(),
                    liveEligible,
                    workerResponse.diagnostics(),
                    artifact,
                    List.copyOf(warnings)
            ));
        } catch (ValidationException ex) {
            List<TradingScriptDtos.TradingScriptDiagnostic> diagnostics = new ArrayList<>(workerResponse.diagnostics());
            diagnostics.add(new TradingScriptDtos.TradingScriptDiagnostic("error", "INVALID_COMPILED_STRATEGY", ex.getMessage(), 1, 1, 1, 2));
            return new TradingScriptCompileBundle(new TradingScriptDtos.TradingScriptCompileResponse(
                    "FAILED",
                    false,
                    false,
                    false,
                    List.copyOf(diagnostics),
                    null,
                    workerResponse.warnings()
            ));
        }
    }

    public TradingScriptEntity newDraftEntity(String tenantId, String username, TradingScriptDtos.TradingScriptCompileResponse response) {
        return new TradingScriptEntity(
                tenantId,
                username,
                resolveScriptName(null, response),
                resolveInstrumentKey(null, response),
                resolveTimeframeUnit(null, response),
                resolveTimeframeInterval(null, response),
                resolveStrategyType(null, response),
                resolveMarketSession(null, response),
                "DRAFT",
                "DRAFT",
                response.compileStatus(),
                1,
                null,
                response.paperEligible(),
                response.liveEligible(),
                username
        );
    }

    public void applyDraftUpdate(
            TradingScriptEntity entity,
            int nextVersion,
            TradingScriptDtos.TradingScriptCompileResponse response
    ) {
        entity.setScriptName(resolveScriptName(entity, response));
        entity.setInstrumentKey(resolveInstrumentKey(entity, response));
        entity.setTimeframeUnit(resolveTimeframeUnit(entity, response));
        entity.setTimeframeInterval(resolveTimeframeInterval(entity, response));
        entity.setStrategyType(resolveStrategyType(entity, response));
        entity.setMarketSession(resolveMarketSession(entity, response));
        entity.setCurrentVersion(nextVersion);
        entity.setStatus("DRAFT");
        entity.setPublishState("DRAFT");
        entity.setCompileStatus(response.compileStatus());
        entity.setPaperEligible(response.paperEligible());
        entity.setLiveEligible(response.liveEligible());
        entity.setArchivedAt(null);
    }

    public TradingScriptVersionEntity createVersion(
            TradingScriptEntity entity,
            String username,
            int versionNumber,
            String sourceJs,
            TradingScriptDtos.TradingScriptCompileResponse compileResponse
    ) {
        return tradingScriptVersionRepository.save(new TradingScriptVersionEntity(
                entity.getId(),
                entity.getTenantId(),
                username,
                versionNumber,
                sourceJs,
                mapper.toJson(compileResponse.artifact() == null ? List.of() : compileResponse.artifact().inputs()),
                mapper.toJson(compileResponse.diagnostics()),
                compileResponse.artifact() == null ? null : mapper.toJson(compileResponse.artifact()),
                compileResponse.compileStatus(),
                compileResponse.paperEligible(),
                compileResponse.liveEligible(),
                Instant.now()
        ));
    }

    public TradingScriptVersionEntity loadCurrentVersion(TradingScriptEntity entity) {
        if (entity.getCurrentVersionId() == null) {
            throw new ValidationException("Trading script version history is incomplete");
        }
        return tradingScriptVersionRepository.findByIdAndScriptIdAndTenantIdAndUsername(
                        entity.getCurrentVersionId(),
                        entity.getId(),
                        entity.getTenantId(),
                        entity.getUsername()
                )
                .orElseThrow(() -> new ValidationException("Trading script version was not found"));
    }

    public TradingScriptCompileResponseWrapper refreshCompile(
            TradingScriptEntity entity,
            TradingScriptVersionEntity version,
            boolean promoteCompiledStatus
    ) {
        TradingScriptCompileBundle bundle = compileSource(version.getSourceJs());
        applyCompileToVersion(version, bundle.response());
        applyCompileToEntity(entity, bundle.response(), promoteCompiledStatus);
        tradingScriptVersionRepository.save(version);
        tradingScriptRepository.save(entity);
        return new TradingScriptCompileResponseWrapper(version, mapper.toCompileResponse(version));
    }

    public TradingScriptVersionEntity ensureCompiled(TradingScriptEntity entity) {
        TradingScriptVersionEntity version = loadCurrentVersion(entity);
        if (!"SUCCESS".equalsIgnoreCase(version.getCompileStatus()) || version.getCompiledArtifactJson() == null) {
            TradingScriptCompileResponseWrapper refreshed = refreshCompile(entity, version, true);
            version = refreshed.version();
            if (!refreshed.response().valid()) {
                throw new ValidationException("Fix compile errors before continuing");
            }
        }
        return version;
    }

    public void applyCompileToVersion(
            TradingScriptVersionEntity version,
            TradingScriptDtos.TradingScriptCompileResponse response
    ) {
        version.setDeclaredInputsJson(mapper.toJson(response.artifact() == null ? List.of() : response.artifact().inputs()));
        version.setCompileDiagnosticsJson(mapper.toJson(response.diagnostics()));
        version.setCompiledArtifactJson(response.artifact() == null ? null : mapper.toJson(response.artifact()));
        version.setCompileStatus(response.compileStatus());
        version.setPaperEligible(response.paperEligible());
        version.setLiveEligible(response.liveEligible());
        version.setCompiledAt(Instant.now());
    }

    public void applyCompileToEntity(
            TradingScriptEntity entity,
            TradingScriptDtos.TradingScriptCompileResponse response,
            boolean promoteCompiledStatus
    ) {
        entity.setCompileStatus(response.compileStatus());
        entity.setPaperEligible(response.paperEligible());
        entity.setLiveEligible(response.liveEligible());
        if (response.artifact() != null) {
            entity.setScriptName(resolveScriptName(entity, response));
            entity.setInstrumentKey(resolveInstrumentKey(entity, response));
            entity.setTimeframeUnit(resolveTimeframeUnit(entity, response));
            entity.setTimeframeInterval(resolveTimeframeInterval(entity, response));
            entity.setStrategyType(resolveStrategyType(entity, response));
            entity.setMarketSession(resolveMarketSession(entity, response));
        }
        if (promoteCompiledStatus && "SUCCESS".equalsIgnoreCase(response.compileStatus()) && Set.of("DRAFT", "COMPILED").contains(entity.getStatus())) {
            entity.setStatus("COMPILED");
        }
    }

    public TradingScriptDtos.TradingScriptDetailsResponse toDetails(
            TradingScriptEntity entity,
            TradingScriptVersionEntity version
    ) {
        TradingScriptPerfSnapshotEntity perf = perfSnapshotRepository
                .findByScriptIdAndTenantIdAndUsername(entity.getId(), entity.getTenantId(), entity.getUsername())
                .orElse(null);
        TradingScriptDtos.TradingScriptBacktestSummary latestBacktest = perf == null ? null : new TradingScriptDtos.TradingScriptBacktestSummary(
                perf.getLatestTotalPnl(),
                null,
                perf.getLatestExecutedTrades(),
                null,
                null,
                perf.getLatestRealWorldAccuracyPct(),
                null,
                null,
                perf.getLatestEvaluatedAt(),
                List.of()
        );
        return new TradingScriptDtos.TradingScriptDetailsResponse(
                mapper.toLibraryItem(entity, perf),
                mapper.toVersionResponse(version),
                latestBacktest
        );
    }

    public TradingScriptDtos.TradingScriptCompiledArtifact requireCompiledArtifact(TradingScriptVersionEntity version) {
        TradingScriptDtos.TradingScriptCompiledArtifact artifact = mapper.parseArtifact(version.getCompiledArtifactJson());
        if (artifact == null) {
            throw new ValidationException("No compiled artifact is available for the current script version");
        }
        return artifact;
    }

    private String resolveScriptName(TradingScriptEntity current, TradingScriptDtos.TradingScriptCompileResponse response) {
        if (response.artifact() != null && StringUtils.hasText(response.artifact().meta().name())) {
            return response.artifact().meta().name().trim();
        }
        return current == null ? UNTITLED_SCRIPT : current.getScriptName();
    }

    private String resolveInstrumentKey(TradingScriptEntity current, TradingScriptDtos.TradingScriptCompileResponse response) {
        if (response.artifact() != null && StringUtils.hasText(response.artifact().meta().instrumentKey())) {
            return response.artifact().meta().instrumentKey().trim();
        }
        return current == null ? "NSE_INDEX|Nifty Bank" : current.getInstrumentKey();
    }

    private String resolveTimeframeUnit(TradingScriptEntity current, TradingScriptDtos.TradingScriptCompileResponse response) {
        if (response.artifact() != null && StringUtils.hasText(response.artifact().meta().timeframeUnit())) {
            return response.artifact().meta().timeframeUnit().trim();
        }
        return current == null ? "minutes" : current.getTimeframeUnit();
    }

    private Integer resolveTimeframeInterval(TradingScriptEntity current, TradingScriptDtos.TradingScriptCompileResponse response) {
        if (response.artifact() != null && response.artifact().meta().timeframeInterval() != null) {
            return response.artifact().meta().timeframeInterval();
        }
        return current == null ? 5 : current.getTimeframeInterval();
    }

    private String resolveStrategyType(TradingScriptEntity current, TradingScriptDtos.TradingScriptCompileResponse response) {
        if (response.artifact() != null && StringUtils.hasText(response.artifact().meta().strategyType())) {
            return response.artifact().meta().strategyType().trim();
        }
        return current == null ? "INTRADAY" : current.getStrategyType();
    }

    private String resolveMarketSession(TradingScriptEntity current, TradingScriptDtos.TradingScriptCompileResponse response) {
        if (response.artifact() != null) {
            String marketSession = response.artifact().meta().marketSession();
            return marketSession == null ? "" : marketSession.trim();
        }
        return current == null ? "" : current.getMarketSession();
    }

    public record TradingScriptCompileBundle(
            TradingScriptDtos.TradingScriptCompileResponse response
    ) {
    }

    public record TradingScriptCompileResponseWrapper(
            TradingScriptVersionEntity version,
            TradingScriptDtos.TradingScriptCompileResponse response
    ) {
    }
}
