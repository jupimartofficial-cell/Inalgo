package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyPerfSnapshotEntity;
import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import com.inalgo.trade.entity.IntraTradeExecutionEntity;
import com.inalgo.trade.repository.IntraStrategyPerfSnapshotRepository;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.IntraStrategyVersionRepository;
import com.inalgo.trade.repository.IntraTradeExecutionRepository;
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
public class IntraStrategyService {

    private static final Set<String> ALLOWED_STATUS = Set.of("DRAFT", "PAPER_READY", "LIVE_READY", "ARCHIVED");

    private final IntraStrategyRepository intraStrategyRepository;
    private final IntraStrategyVersionRepository intraStrategyVersionRepository;
    private final IntraStrategyPerfSnapshotRepository perfSnapshotRepository;
    private final IntraTradeExecutionRepository intraTradeExecutionRepository;
    private final IntraStrategyValidationEngine validationEngine;
    private final IntraStrategyMapperSupport mapper;
    private final IntraStrategyImportService importService;
    private final IntraStrategyDraftSupport draftSupport;

    public IntraStrategyService(
            IntraStrategyRepository intraStrategyRepository,
            IntraStrategyVersionRepository intraStrategyVersionRepository,
            IntraStrategyPerfSnapshotRepository perfSnapshotRepository,
            IntraTradeExecutionRepository intraTradeExecutionRepository,
            IntraStrategyValidationEngine validationEngine,
            IntraStrategyMapperSupport mapper,
            IntraStrategyImportService importService,
            IntraStrategyDraftSupport draftSupport
    ) {
        this.intraStrategyRepository = intraStrategyRepository;
        this.intraStrategyVersionRepository = intraStrategyVersionRepository;
        this.perfSnapshotRepository = perfSnapshotRepository;
        this.intraTradeExecutionRepository = intraTradeExecutionRepository;
        this.validationEngine = validationEngine;
        this.mapper = mapper;
        this.importService = importService;
        this.draftSupport = draftSupport;
    }

    @Transactional
    public IntraStrategyDtos.IntraStrategyLibraryResponse listLibrary(
            String tenantId,
            String username,
            String search,
            String status,
            String instrument,
            String timeframe,
            Boolean paperEligible,
            Boolean liveEligible,
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
        IntraStrategyMapperSupport.TimeframeFilter timeframeFilter = mapper.parseTimeframeFilter(timeframe);

        if (!normalizedStatus.isEmpty() && !ALLOWED_STATUS.contains(normalizedStatus)) {
            throw new ValidationException("Invalid status filter");
        }

        List<IntraStrategyEntity> raw = intraStrategyRepository.findAllByTenantIdAndUsername(tenantId, normalizedUsername);
        Map<Long, IntraStrategyPerfSnapshotEntity> perfByStrategy = perfSnapshotRepository
                .findAllByTenantIdAndUsername(tenantId, normalizedUsername)
                .stream()
                .collect(Collectors.toMap(IntraStrategyPerfSnapshotEntity::getStrategyId, item -> item));
        for (IntraStrategyEntity strategyEntity : raw) {
            if (perfByStrategy.containsKey(strategyEntity.getId())) {
                continue;
            }
            IntraTradeExecutionEntity latest = intraTradeExecutionRepository
                    .findTopByTenantIdAndUsernameAndStrategyIdOrderByEvaluatedAtDesc(
                            tenantId,
                            normalizedUsername,
                            strategyEntity.getId()
                    )
                    .orElse(null);
            if (latest == null) {
                continue;
            }
            perfSnapshotRepository.upsert(
                    strategyEntity.getId(),
                    tenantId,
                    normalizedUsername,
                    latest.getTotalPnl(),
                    latest.getExecutedTrades(),
                    latest.getEvaluatedAt()
            );
            IntraStrategyPerfSnapshotEntity snapshot = new IntraStrategyPerfSnapshotEntity(
                    strategyEntity.getId(),
                    tenantId,
                    normalizedUsername,
                    latest.getTotalPnl(),
                    latest.getExecutedTrades(),
                    latest.getEvaluatedAt()
            );
            perfByStrategy.put(strategyEntity.getId(), snapshot);
        }

        List<IntraStrategyDtos.IntraStrategyLibraryItem> filtered = raw.stream()
                .filter(item -> normalizedSearch.isEmpty() || item.getStrategyName().toLowerCase(Locale.ENGLISH).contains(normalizedSearch))
                .filter(item -> normalizedStatus.isEmpty() || normalizedStatus.equals(item.getStatus()))
                .filter(item -> normalizedInstrument.isEmpty() || normalizedInstrument.equals(item.getUnderlyingKey()))
                .filter(item -> timeframeFilter.matches(item.getTimeframeUnit(), item.getTimeframeInterval()))
                .filter(item -> paperEligible == null || paperEligible.equals(item.getPaperEligible()))
                .filter(item -> liveEligible == null || liveEligible.equals(item.getLiveEligible()))
                .map(item -> mapper.toLibraryItem(item, perfByStrategy.get(item.getId())))
                .sorted(mapper.comparatorForSort(normalizedSort))
                .toList();

        int from = Math.min(filtered.size(), boundedPage * boundedSize);
        int to = Math.min(filtered.size(), from + boundedSize);
        int totalPages = boundedSize == 0 ? 1 : (int) Math.ceil((double) filtered.size() / boundedSize);
        return new IntraStrategyDtos.IntraStrategyLibraryResponse(
                List.copyOf(filtered.subList(from, to)),
                filtered.size(),
                totalPages,
                boundedPage,
                boundedSize
        );
    }

    public IntraStrategyDtos.IntraStrategyDetailsResponse createDraft(
            String tenantId,
            IntraStrategyDtos.IntraStrategyCreateDraftRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        IntraStrategyDraftSupport.BuilderModel builder = draftSupport.normalizeBuilder(request.builder());
        IntraStrategyDtos.IntraStrategyValidationResult validation = validationEngine.validate(builder.builderPayload());

        IntraStrategyEntity strategyEntity = new IntraStrategyEntity(
                tenantId,
                normalizedUsername,
                builder.strategy().strategyName(),
                builder.strategy().underlyingKey(),
                builder.timeframeUnit(),
                builder.timeframeInterval(),
                builder.strategy().strategyType(),
                builder.marketSession(),
                "DRAFT",
                "DRAFT",
                1,
                null,
                validation.paperEligible(),
                validation.liveEligible(),
                normalizedUsername,
                null
        );
        strategyEntity = saveStrategy(strategyEntity);
        IntraStrategyVersionEntity version = draftSupport.createVersion(strategyEntity, 1, normalizedUsername, builder, validation);
        strategyEntity.setCurrentVersionId(version.getId());
        strategyEntity = intraStrategyRepository.save(strategyEntity);
        return draftSupport.toDetails(strategyEntity, version, validation);
    }

    public IntraStrategyDtos.IntraStrategyDetailsResponse updateDraft(
            String tenantId,
            Long strategyId,
            IntraStrategyDtos.IntraStrategyUpdateDraftRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        IntraStrategyEntity strategyEntity = loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        if ("ARCHIVED".equals(strategyEntity.getStatus())) {
            throw new ValidationException("Archived strategies cannot be edited");
        }
        IntraStrategyDraftSupport.BuilderModel builder = draftSupport.normalizeBuilder(request.builder());
        IntraStrategyDtos.IntraStrategyValidationResult validation = validationEngine.validate(builder.builderPayload());

        int nextVersion = strategyEntity.getCurrentVersion() + 1;
        IntraStrategyVersionEntity version = draftSupport.createVersion(strategyEntity, nextVersion, normalizedUsername, builder, validation);

        strategyEntity.setStrategyName(builder.strategy().strategyName());
        strategyEntity.setUnderlyingKey(builder.strategy().underlyingKey());
        strategyEntity.setTimeframeUnit(builder.timeframeUnit());
        strategyEntity.setTimeframeInterval(builder.timeframeInterval());
        strategyEntity.setStrategyType(builder.strategy().strategyType());
        strategyEntity.setMarketSession(builder.marketSession());
        strategyEntity.setCurrentVersion(nextVersion);
        strategyEntity.setCurrentVersionId(version.getId());
        strategyEntity.setPublishState("DRAFT");
        strategyEntity.setStatus("DRAFT");
        strategyEntity.setPaperEligible(validation.paperEligible());
        strategyEntity.setLiveEligible(validation.liveEligible());
        strategyEntity.setArchivedAt(null);
        strategyEntity = saveStrategy(strategyEntity);
        return draftSupport.toDetails(strategyEntity, version, validation);
    }

    public IntraStrategyDtos.IntraStrategyValidationResult validate(
            String tenantId,
            Long strategyId,
            IntraStrategyDtos.IntraStrategyValidateRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        IntraStrategyEntity strategyEntity = loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        IntraStrategyVersionEntity version = loadCurrentVersion(strategyEntity, tenantId, normalizedUsername);
        IntraStrategyDraftSupport.BuilderModel builder = draftSupport.fromVersion(version);
        IntraStrategyDtos.IntraStrategyValidationResult validation = validationEngine.validate(builder.builderPayload());
        updateVersionValidation(version, validation);
        strategyEntity.setPaperEligible(validation.paperEligible());
        strategyEntity.setLiveEligible(validation.liveEligible());
        intraStrategyRepository.save(strategyEntity);
        return validation;
    }

    public IntraStrategyDtos.IntraStrategyDetailsResponse publish(
            String tenantId,
            Long strategyId,
            IntraStrategyDtos.IntraStrategyPublishRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        String targetStatus = mapper.normalizePublishTarget(request.targetStatus());
        IntraStrategyEntity strategyEntity = loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        IntraStrategyVersionEntity version = loadCurrentVersion(strategyEntity, tenantId, normalizedUsername);
        IntraStrategyDraftSupport.BuilderModel builder = draftSupport.fromVersion(version);
        IntraStrategyDtos.IntraStrategyValidationResult validation = validationEngine.validate(builder.builderPayload());
        if ("LIVE_READY".equals(targetStatus) && !validation.liveEligible()) {
            throw new ValidationException("Strategy is not live-ready");
        }
        if ("PAPER_READY".equals(targetStatus) && !validation.paperEligible()) {
            throw new ValidationException("Strategy is not paper-ready");
        }
        updateVersionValidation(version, validation);
        strategyEntity.setStatus(targetStatus);
        strategyEntity.setPublishState("PUBLISHED");
        strategyEntity.setPaperEligible(validation.paperEligible());
        strategyEntity.setLiveEligible(validation.liveEligible());
        strategyEntity.setArchivedAt(null);
        strategyEntity = saveStrategy(strategyEntity);
        return draftSupport.toDetails(strategyEntity, version, validation);
    }

    public IntraStrategyDtos.IntraStrategyDetailsResponse duplicate(
            String tenantId,
            Long strategyId,
            IntraStrategyDtos.IntraStrategyDuplicateRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        IntraStrategyEntity source = loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        IntraStrategyVersionEntity sourceVersion = loadCurrentVersion(source, tenantId, normalizedUsername);
        IntraStrategyDraftSupport.BuilderModel sourceBuilder = draftSupport.fromVersion(sourceVersion);

        AdminDtos.BacktestStrategyPayload copied = new AdminDtos.BacktestStrategyPayload(
                draftSupport.dedupeCopiedName(source.getStrategyName(), tenantId, normalizedUsername),
                sourceBuilder.strategy().underlyingKey(),
                sourceBuilder.strategy().underlyingSource(),
                sourceBuilder.strategy().strategyType(),
                sourceBuilder.strategy().entryTime(),
                sourceBuilder.strategy().exitTime(),
                sourceBuilder.strategy().startDate(),
                sourceBuilder.strategy().endDate(),
                sourceBuilder.strategy().legs(),
                sourceBuilder.strategy().legwiseSettings(),
                sourceBuilder.strategy().overallSettings(),
                sourceBuilder.strategy().advancedConditions()
        );
        return createDraft(
                tenantId,
                new IntraStrategyDtos.IntraStrategyCreateDraftRequest(
                        normalizedUsername,
                        new IntraStrategyDtos.IntraStrategyBuilderPayload(
                                copied,
                                sourceBuilder.timeframeUnit(),
                                sourceBuilder.timeframeInterval(),
                                sourceBuilder.advancedMode(),
                                sourceBuilder.marketSession()
                        )
                )
        );
    }

    public IntraStrategyDtos.IntraStrategyActionResponse archive(
            String tenantId,
            Long strategyId,
            IntraStrategyDtos.IntraStrategyArchiveRequest request
    ) {
        String normalizedUsername = mapper.requireText(request.username(), "username");
        IntraStrategyEntity strategyEntity = loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        strategyEntity.setStatus("ARCHIVED");
        strategyEntity.setArchivedAt(Instant.now());
        saveStrategy(strategyEntity);
        return new IntraStrategyDtos.IntraStrategyActionResponse("archived", strategyId);
    }

    public IntraStrategyDtos.IntraStrategyActionResponse delete(
            String tenantId,
            Long strategyId,
            String username
    ) {
        String normalizedUsername = mapper.requireText(username, "username");
        IntraStrategyEntity strategyEntity = loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        if (intraTradeExecutionRepository.existsByTenantIdAndStrategyId(tenantId, strategyId)) {
            throw new ValidationException("Strategy cannot be deleted because executions reference it. Archive it instead.");
        }
        intraStrategyRepository.delete(strategyEntity);
        return new IntraStrategyDtos.IntraStrategyActionResponse("deleted", strategyId);
    }

    public List<IntraStrategyDtos.IntraStrategyVersionResponse> listVersions(String tenantId, Long strategyId, String username) {
        String normalizedUsername = mapper.requireText(username, "username");
        loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        return intraStrategyVersionRepository
                .findAllByStrategyIdAndTenantIdAndUsernameOrderByVersionDesc(strategyId, tenantId, normalizedUsername)
                .stream()
                .map(mapper::toVersionResponse)
                .toList();
    }

    public IntraStrategyDtos.IntraStrategyVersionResponse getVersion(
            String tenantId,
            Long strategyId,
            Integer version,
            String username
    ) {
        String normalizedUsername = mapper.requireText(username, "username");
        loadOwnedStrategy(tenantId, strategyId, normalizedUsername);
        IntraStrategyVersionEntity entity = intraStrategyVersionRepository
                .findByStrategyIdAndVersionAndTenantIdAndUsername(strategyId, version, tenantId, normalizedUsername)
                .orElseThrow(() -> new ValidationException("Strategy version was not found"));
        return mapper.toVersionResponse(entity);
    }

    public IntraStrategyDtos.IntraStrategyImportResponse importFromBacktest(
            String tenantId,
            IntraStrategyDtos.IntraStrategyImportFromBacktestRequest request
    ) {
        return importService.importFromBacktest(tenantId, request);
    }

    private IntraStrategyEntity loadOwnedStrategy(String tenantId, Long strategyId, String username) {
        IntraStrategyEntity entity = intraStrategyRepository.findByIdAndTenantId(strategyId, tenantId)
                .orElseThrow(() -> new ValidationException("Intra strategy was not found"));
        if (!username.equals(entity.getUsername())) {
            throw new ValidationException("Strategy belongs to another user");
        }
        return entity;
    }

    private IntraStrategyVersionEntity loadCurrentVersion(IntraStrategyEntity strategy, String tenantId, String username) {
        return intraStrategyVersionRepository
                .findByStrategyIdAndVersionAndTenantIdAndUsername(
                        strategy.getId(),
                        strategy.getCurrentVersion(),
                        tenantId,
                        username
                )
                .orElseThrow(() -> new ValidationException("Strategy version was not found"));
    }

    private void updateVersionValidation(
            IntraStrategyVersionEntity version,
            IntraStrategyDtos.IntraStrategyValidationResult validation
    ) {
        version.setValidationErrorsJson(mapper.toJson(validation.fieldErrors()));
        version.setValidationSummaryJson(mapper.toJson(validation.summaryErrors()));
        version.setValidationWarningsJson(mapper.toJson(validation.warnings()));
        version.setPaperEligible(validation.paperEligible());
        version.setLiveEligible(validation.liveEligible());
        version.setValidatedAt(Instant.now());
        intraStrategyVersionRepository.save(version);
    }

    private IntraStrategyEntity saveStrategy(IntraStrategyEntity entity) {
        try {
            return intraStrategyRepository.save(entity);
        } catch (DataIntegrityViolationException ex) {
            throw new ValidationException("Strategy name already exists for this user");
        }
    }

}
