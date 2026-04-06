package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.TradingScriptEntity;
import com.inalgo.trade.entity.TradingScriptPerfSnapshotEntity;
import com.inalgo.trade.entity.TradingScriptVersionEntity;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
import com.inalgo.trade.repository.TradingScriptPerfSnapshotRepository;
import com.inalgo.trade.repository.TradingScriptRepository;
import com.inalgo.trade.repository.TradingScriptVersionRepository;
import jakarta.transaction.Transactional;
import jakarta.validation.ValidationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class TradingScriptService {

    private static final Set<String> ALLOWED_STATUS = Set.of("DRAFT", "COMPILED", "PAPER_READY", "LIVE_READY", "ARCHIVED");
    private static final Set<String> ALLOWED_COMPILE_STATUS = Set.of("PENDING", "SUCCESS", "FAILED");

    private final TradingScriptRepository tradingScriptRepository;
    private final TradingScriptVersionRepository tradingScriptVersionRepository;
    private final TradingScriptPerfSnapshotRepository perfSnapshotRepository;
    private final TradingScriptMapperSupport mapper;
    private final BacktestRunService backtestRunService;
    private final IntraStrategyRepository intraStrategyRepository;
    private final IntraTradeExecutionRepository intraTradeExecutionRepository;
    private final TradingScriptWorkflowSupport workflowSupport;
    private final TradingScriptPublishSupport publishSupport;

    public TradingScriptService(
            TradingScriptRepository tradingScriptRepository,
            TradingScriptVersionRepository tradingScriptVersionRepository,
            TradingScriptPerfSnapshotRepository perfSnapshotRepository,
            TradingScriptMapperSupport mapper,
            BacktestRunService backtestRunService,
            IntraStrategyRepository intraStrategyRepository,
            IntraTradeExecutionRepository intraTradeExecutionRepository,
            TradingScriptWorkflowSupport workflowSupport,
            TradingScriptPublishSupport publishSupport
    ) {
        this.tradingScriptRepository = tradingScriptRepository;
        this.tradingScriptVersionRepository = tradingScriptVersionRepository;
        this.perfSnapshotRepository = perfSnapshotRepository;
        this.mapper = mapper;
        this.backtestRunService = backtestRunService;
        this.intraStrategyRepository = intraStrategyRepository;
        this.intraTradeExecutionRepository = intraTradeExecutionRepository;
        this.workflowSupport = workflowSupport;
        this.publishSupport = publishSupport;
    }

    public TradingScriptDtos.TradingScriptLibraryResponse listLibrary(
            String tenantId,
            String username,
            String search,
            String status,
            String instrument,
            String timeframe,
            String compileStatus,
            String sort,
            Integer page,
            Integer size
    ) {
        String normalizedUsername = mapper.requireText(username, "username");
        int boundedPage = Math.max(page == null ? 0 : page, 0);
        int boundedSize = Math.min(Math.max(size == null ? 10 : size, 1), 200);
        String normalizedSort = mapper.normalizeSort(sort);
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase(Locale.ENGLISH);
        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(Locale.ENGLISH);
        String normalizedInstrument = instrument == null ? "" : instrument.trim();
        String normalizedCompileStatus = compileStatus == null ? "" : compileStatus.trim().toUpperCase(Locale.ENGLISH);
        IntraStrategyMapperSupport.TimeframeFilter timeframeFilter = mapper.parseTimeframeFilter(timeframe);

        if (!normalizedStatus.isEmpty() && !ALLOWED_STATUS.contains(normalizedStatus)) {
            throw new ValidationException("Invalid status filter");
        }
        if (!normalizedCompileStatus.isEmpty() && !ALLOWED_COMPILE_STATUS.contains(normalizedCompileStatus)) {
            throw new ValidationException("Invalid compileStatus filter");
        }

        List<TradingScriptEntity> raw = tradingScriptRepository.findAllByTenantIdAndUsername(tenantId, normalizedUsername);
        Map<Long, TradingScriptPerfSnapshotEntity> perfByScript = perfSnapshotRepository.findAllByTenantIdAndUsername(tenantId, normalizedUsername)
                .stream()
                .collect(Collectors.toMap(TradingScriptPerfSnapshotEntity::getScriptId, item -> item));

        List<TradingScriptDtos.TradingScriptLibraryItem> filtered = raw.stream()
                .filter(item -> normalizedSearch.isEmpty() || item.getScriptName().toLowerCase(Locale.ENGLISH).contains(normalizedSearch))
                .filter(item -> normalizedStatus.isEmpty() || normalizedStatus.equals(item.getStatus()))
                .filter(item -> normalizedCompileStatus.isEmpty() || normalizedCompileStatus.equals(item.getCompileStatus()))
                .filter(item -> normalizedInstrument.isEmpty() || normalizedInstrument.equals(item.getInstrumentKey()))
                .filter(item -> timeframeFilter.matches(item.getTimeframeUnit(), item.getTimeframeInterval()))
                .map(item -> mapper.toLibraryItem(item, perfByScript.get(item.getId())))
                .sorted(mapper.comparatorForSort(normalizedSort))
                .toList();

        int from = Math.min(filtered.size(), boundedPage * boundedSize);
        int to = Math.min(filtered.size(), from + boundedSize);
        int totalPages = boundedSize == 0 ? 1 : (int) Math.ceil((double) filtered.size() / boundedSize);
        return new TradingScriptDtos.TradingScriptLibraryResponse(
                List.copyOf(filtered.subList(from, to)),
                filtered.size(),
                totalPages,
                boundedPage,
                boundedSize
        );
    }

    @Transactional
    public TradingScriptDtos.TradingScriptDetailsResponse createDraft(
            String tenantId,
            TradingScriptDtos.TradingScriptCreateDraftRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        String sourceJs = workflowSupport.normalizeSource(request.builder().sourceJs());
        TradingScriptWorkflowSupport.TradingScriptCompileBundle compile = workflowSupport.compileSource(sourceJs);

        TradingScriptEntity entity = saveScript(workflowSupport.newDraftEntity(tenantId, normalizedUsername, compile.response()));
        TradingScriptVersionEntity version = workflowSupport.createVersion(entity, normalizedUsername, 1, sourceJs, compile.response());
        entity.setCurrentVersionId(version.getId());
        entity = tradingScriptRepository.save(entity);
        return workflowSupport.toDetails(entity, version);
    }

    @Transactional
    public TradingScriptDtos.TradingScriptDetailsResponse updateDraft(
            String tenantId,
            Long scriptId,
            TradingScriptDtos.TradingScriptUpdateDraftRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        TradingScriptEntity entity = loadOwnedScript(tenantId, scriptId, normalizedUsername);
        String sourceJs = workflowSupport.normalizeSource(request.builder().sourceJs());
        TradingScriptWorkflowSupport.TradingScriptCompileBundle compile = workflowSupport.compileSource(sourceJs);

        int nextVersion = entity.getCurrentVersion() + 1;
        TradingScriptVersionEntity version = workflowSupport.createVersion(entity, normalizedUsername, nextVersion, sourceJs, compile.response());
        workflowSupport.applyDraftUpdate(entity, nextVersion, compile.response());
        entity.setCurrentVersionId(version.getId());
        entity = saveScript(entity);
        return workflowSupport.toDetails(entity, version);
    }

    @Transactional
    public TradingScriptDtos.TradingScriptCompileResponse compile(String tenantId, Long scriptId, String username) {
        TradingScriptEntity entity = loadOwnedScript(tenantId, scriptId, mapper.requireText(username, "username"));
        TradingScriptVersionEntity version = workflowSupport.loadCurrentVersion(entity);
        return workflowSupport.refreshCompile(entity, version, true).response();
    }

    @Transactional
    public TradingScriptDtos.TradingScriptCompileResponse validate(String tenantId, Long scriptId, String username) {
        return compile(tenantId, scriptId, username);
    }

    @Transactional
    public TradingScriptDtos.TradingScriptBacktestResponse backtest(String tenantId, Long scriptId, String username) {
        String normalizedUsername = mapper.requireText(username, "username");
        TradingScriptEntity entity = loadOwnedScript(tenantId, scriptId, normalizedUsername);
        TradingScriptVersionEntity version = workflowSupport.ensureCompiled(entity);
        TradingScriptDtos.TradingScriptCompiledArtifact artifact = workflowSupport.requireCompiledArtifact(version);

        AdminDtos.BacktestRunResponse result = backtestRunService.runBacktest(
                tenantId,
                new AdminDtos.BacktestRunRequest(normalizedUsername, artifact.compiledStrategy())
        );
        perfSnapshotRepository.upsert(
                entity.getId(),
                tenantId,
                normalizedUsername,
                result.totalPnl(),
                result.executedTrades(),
                result.realWorldAccuracyPct(),
                Instant.now()
        );
        if (!Set.of("PAPER_READY", "LIVE_READY", "ARCHIVED").contains(entity.getStatus()) && "SUCCESS".equalsIgnoreCase(entity.getCompileStatus())) {
            entity.setStatus("COMPILED");
            tradingScriptRepository.save(entity);
        }

        TradingScriptDtos.TradingScriptBacktestSummary summary = new TradingScriptDtos.TradingScriptBacktestSummary(
                result.totalPnl(),
                result.averagePnl(),
                result.executedTrades(),
                result.winTrades(),
                result.lossTrades(),
                result.realWorldAccuracyPct(),
                result.marketPricedTrades(),
                result.fallbackPricedTrades(),
                Instant.now(),
                result.notes()
        );
        return new TradingScriptDtos.TradingScriptBacktestResponse(summary, result);
    }

    @Transactional
    public TradingScriptDtos.TradingScriptDetailsResponse publish(
            String tenantId,
            Long scriptId,
            TradingScriptDtos.TradingScriptPublishRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        String targetStatus = mapper.normalizePublishTarget(request.targetStatus());
        TradingScriptEntity entity = loadOwnedScript(tenantId, scriptId, normalizedUsername);
        TradingScriptVersionEntity version = workflowSupport.ensureCompiled(entity);

        if (perfSnapshotRepository.findByScriptIdAndTenantIdAndUsername(scriptId, tenantId, normalizedUsername).isEmpty()) {
            throw new ValidationException("Run a successful backtest before publishing this script");
        }
        if ("LIVE_READY".equals(targetStatus)) {
            if (!"PAPER_READY".equals(entity.getStatus())) {
                throw new ValidationException("Promote this script to paper-ready before live publish");
            }
            if (!Boolean.TRUE.equals(version.getLiveEligible())) {
                throw new ValidationException("Script is not live-ready");
            }
        }
        if ("PAPER_READY".equals(targetStatus) && !Boolean.TRUE.equals(version.getPaperEligible())) {
            throw new ValidationException("Script is not paper-ready");
        }

        publishSupport.syncIntraStrategy(
                tenantId,
                normalizedUsername,
                entity,
                workflowSupport.requireCompiledArtifact(version),
                targetStatus
        );
        entity.setStatus(targetStatus);
        entity.setPublishState("PUBLISHED");
        entity.setArchivedAt(null);
        tradingScriptRepository.save(entity);
        return workflowSupport.toDetails(entity, version);
    }

    @Transactional
    public TradingScriptDtos.TradingScriptDetailsResponse duplicate(
            String tenantId,
            Long scriptId,
            TradingScriptDtos.TradingScriptDuplicateRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        TradingScriptEntity source = loadOwnedScript(tenantId, scriptId, normalizedUsername);
        TradingScriptVersionEntity version = workflowSupport.loadCurrentVersion(source);
        String nextName = publishSupport.dedupeCopiedName(source.getScriptName(), tenantId, normalizedUsername);
        String nextSource = version.getSourceJs().replaceFirst("Copy of ", "").replaceFirst(source.getScriptName(), nextName);
        return createDraft(
                tenantId,
                new TradingScriptDtos.TradingScriptCreateDraftRequest(
                        normalizedUsername,
                        new TradingScriptDtos.TradingScriptBuilderPayload(nextSource)
                )
        );
    }

    @Transactional
    public TradingScriptDtos.TradingScriptActionResponse archive(String tenantId, Long scriptId, String username) {
        String normalizedUsername = mapper.requireText(username, "username");
        TradingScriptEntity entity = loadOwnedScript(tenantId, scriptId, normalizedUsername);
        entity.setStatus("ARCHIVED");
        entity.setArchivedAt(Instant.now());
        tradingScriptRepository.save(entity);
        intraStrategyRepository.findByTenantIdAndUsernameAndSourceTradingScriptId(tenantId, normalizedUsername, scriptId)
                .ifPresent(linked -> {
                    linked.setStatus("ARCHIVED");
                    linked.setArchivedAt(Instant.now());
                    intraStrategyRepository.save(linked);
                });
        return new TradingScriptDtos.TradingScriptActionResponse("archived", scriptId);
    }

    @Transactional
    public TradingScriptDtos.TradingScriptActionResponse delete(String tenantId, Long scriptId, String username) {
        String normalizedUsername = mapper.requireText(username, "username");
        TradingScriptEntity entity = loadOwnedScript(tenantId, scriptId, normalizedUsername);
        IntraStrategyEntity linked = intraStrategyRepository
                .findByTenantIdAndUsernameAndSourceTradingScriptId(tenantId, normalizedUsername, scriptId)
                .orElse(null);
        if (linked != null && intraTradeExecutionRepository.existsByTenantIdAndStrategyId(tenantId, linked.getId())) {
            throw new ValidationException("Script cannot be deleted because published executions reference it. Archive it instead.");
        }
        publishSupport.linkedDelete(linked);
        tradingScriptRepository.delete(entity);
        return new TradingScriptDtos.TradingScriptActionResponse("deleted", scriptId);
    }

    public List<TradingScriptDtos.TradingScriptVersionResponse> listVersions(String tenantId, Long scriptId, String username) {
        String normalizedUsername = mapper.requireText(username, "username");
        loadOwnedScript(tenantId, scriptId, normalizedUsername);
        return tradingScriptVersionRepository.findAllByScriptIdAndTenantIdAndUsernameOrderByVersionDesc(scriptId, tenantId, normalizedUsername)
                .stream()
                .map(mapper::toVersionResponse)
                .toList();
    }

    public TradingScriptDtos.TradingScriptVersionResponse getVersion(String tenantId, Long scriptId, Integer version, String username) {
        String normalizedUsername = mapper.requireText(username, "username");
        loadOwnedScript(tenantId, scriptId, normalizedUsername);
        TradingScriptVersionEntity entity = tradingScriptVersionRepository
                .findByScriptIdAndVersionAndTenantIdAndUsername(scriptId, version, tenantId, normalizedUsername)
                .orElseThrow(() -> new ValidationException("Trading script version was not found"));
        return mapper.toVersionResponse(entity);
    }

    private TradingScriptEntity loadOwnedScript(String tenantId, Long scriptId, String username) {
        TradingScriptEntity entity = tradingScriptRepository.findByIdAndTenantId(scriptId, tenantId)
                .orElseThrow(() -> new ValidationException("Trading script was not found"));
        if (!username.equals(entity.getUsername())) {
            throw new ValidationException("Trading script belongs to another user");
        }
        return entity;
    }

    private TradingScriptEntity saveScript(TradingScriptEntity entity) {
        try {
            return tradingScriptRepository.save(entity);
        } catch (DataIntegrityViolationException ex) {
            throw new ValidationException("Script name already exists for this user");
        }
    }
}
