package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyPerfSnapshotEntity;
import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import com.inalgo.trade.repository.IntraStrategyPerfSnapshotRepository;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.IntraStrategyVersionRepository;
import jakarta.validation.ValidationException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Component
public class IntraStrategyDraftSupport {

    private final IntraStrategyVersionRepository intraStrategyVersionRepository;
    private final IntraStrategyPerfSnapshotRepository perfSnapshotRepository;
    private final IntraStrategyRepository intraStrategyRepository;
    private final BacktestStrategyService backtestStrategyService;
    private final IntraStrategyMapperSupport mapper;

    public IntraStrategyDraftSupport(
            IntraStrategyVersionRepository intraStrategyVersionRepository,
            IntraStrategyPerfSnapshotRepository perfSnapshotRepository,
            IntraStrategyRepository intraStrategyRepository,
            BacktestStrategyService backtestStrategyService,
            IntraStrategyMapperSupport mapper
    ) {
        this.intraStrategyVersionRepository = intraStrategyVersionRepository;
        this.perfSnapshotRepository = perfSnapshotRepository;
        this.intraStrategyRepository = intraStrategyRepository;
        this.backtestStrategyService = backtestStrategyService;
        this.mapper = mapper;
    }

    public IntraStrategyVersionEntity createVersion(
            IntraStrategyEntity strategyEntity,
            int versionNumber,
            String username,
            BuilderModel builder,
            IntraStrategyDtos.IntraStrategyValidationResult validation
    ) {
        return intraStrategyVersionRepository.save(new IntraStrategyVersionEntity(
                strategyEntity.getId(),
                strategyEntity.getTenantId(),
                username,
                versionNumber,
                builder.advancedMode(),
                builder.timeframeUnit(),
                builder.timeframeInterval(),
                mapper.toJson(builder.strategy()),
                mapper.toJson(validation.fieldErrors()),
                mapper.toJson(validation.summaryErrors()),
                mapper.toJson(validation.warnings()),
                validation.paperEligible(),
                validation.liveEligible(),
                Instant.now()
        ));
    }

    public IntraStrategyDtos.IntraStrategyDetailsResponse toDetails(
            IntraStrategyEntity strategyEntity,
            IntraStrategyVersionEntity versionEntity,
            IntraStrategyDtos.IntraStrategyValidationResult validation
    ) {
        IntraStrategyPerfSnapshotEntity perf = perfSnapshotRepository
                .findByStrategyIdAndTenantIdAndUsername(strategyEntity.getId(), strategyEntity.getTenantId(), strategyEntity.getUsername())
                .orElse(null);
        return new IntraStrategyDtos.IntraStrategyDetailsResponse(
                mapper.toLibraryItem(strategyEntity, perf),
                mapper.toVersionResponse(versionEntity, validation)
        );
    }

    public BuilderModel normalizeBuilder(IntraStrategyDtos.IntraStrategyBuilderPayload builder) {
        if (builder == null) {
            throw new ValidationException("builder is required");
        }
        AdminDtos.BacktestStrategyPayload strategy = backtestStrategyService.normalizeStrategyPayload(builder.strategy());
        String timeframeUnit = mapper.requireText(builder.timeframeUnit(), "timeframeUnit").toLowerCase(Locale.ENGLISH);
        Integer timeframeInterval = builder.timeframeInterval();
        if (timeframeInterval == null || timeframeInterval < 1 || timeframeInterval > 1440) {
            throw new ValidationException("timeframeInterval must be between 1 and 1440");
        }
        String marketSession = builder.marketSession() == null ? "" : builder.marketSession().trim();
        return new BuilderModel(
                new IntraStrategyDtos.IntraStrategyBuilderPayload(
                        strategy,
                        timeframeUnit,
                        timeframeInterval,
                        Boolean.TRUE.equals(builder.advancedMode()),
                        marketSession
                ),
                strategy,
                timeframeUnit,
                timeframeInterval,
                Boolean.TRUE.equals(builder.advancedMode()),
                marketSession
        );
    }

    public BuilderModel fromVersion(IntraStrategyVersionEntity version) {
        AdminDtos.BacktestStrategyPayload strategy = mapper.readStrategy(version.getStrategyJson());
        String marketSession = mapper.inferMarketSession(strategy.entryTime().toString(), strategy.exitTime().toString());
        return new BuilderModel(
                new IntraStrategyDtos.IntraStrategyBuilderPayload(
                        strategy,
                        version.getTimeframeUnit(),
                        version.getTimeframeInterval(),
                        version.getAdvancedMode(),
                        marketSession
                ),
                strategy,
                version.getTimeframeUnit(),
                version.getTimeframeInterval(),
                Boolean.TRUE.equals(version.getAdvancedMode()),
                marketSession
        );
    }

    public String dedupeCopiedName(String originalName, String tenantId, String username) {
        String base = "Copy of " + originalName;
        List<String> names = intraStrategyRepository.findAllByTenantIdAndUsername(tenantId, username)
                .stream()
                .map(IntraStrategyEntity::getStrategyName)
                .toList();
        if (!names.contains(base)) {
            return base;
        }
        int idx = 2;
        while (names.contains(base + " (" + idx + ")")) {
            idx++;
        }
        return base + " (" + idx + ")";
    }

    public record BuilderModel(
            IntraStrategyDtos.IntraStrategyBuilderPayload builderPayload,
            AdminDtos.BacktestStrategyPayload strategy,
            String timeframeUnit,
            Integer timeframeInterval,
            boolean advancedMode,
            String marketSession
    ) {
    }
}
