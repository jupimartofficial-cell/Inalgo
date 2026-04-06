package com.inalgo.trade.admin;

import com.inalgo.trade.entity.IntraStrategyEntity;
import com.inalgo.trade.entity.IntraStrategyVersionEntity;
import com.inalgo.trade.entity.TradingScriptEntity;
import com.inalgo.trade.entity.TradingScriptPerfSnapshotEntity;
import com.inalgo.trade.repository.IntraStrategyPerfSnapshotRepository;
import com.inalgo.trade.repository.IntraStrategyRepository;
import com.inalgo.trade.repository.TradingScriptPerfSnapshotRepository;
import com.inalgo.trade.repository.TradingScriptRepository;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TradingScriptPublishSupport {

    private final TradingScriptRepository tradingScriptRepository;
    private final TradingScriptPerfSnapshotRepository perfSnapshotRepository;
    private final IntraStrategyRepository intraStrategyRepository;
    private final IntraStrategyPerfSnapshotRepository intraStrategyPerfSnapshotRepository;
    private final IntraStrategyDraftSupport intraStrategyDraftSupport;
    private final IntraStrategyValidationEngine intraStrategyValidationEngine;

    public TradingScriptPublishSupport(
            TradingScriptRepository tradingScriptRepository,
            TradingScriptPerfSnapshotRepository perfSnapshotRepository,
            IntraStrategyRepository intraStrategyRepository,
            IntraStrategyPerfSnapshotRepository intraStrategyPerfSnapshotRepository,
            IntraStrategyDraftSupport intraStrategyDraftSupport,
            IntraStrategyValidationEngine intraStrategyValidationEngine
    ) {
        this.tradingScriptRepository = tradingScriptRepository;
        this.perfSnapshotRepository = perfSnapshotRepository;
        this.intraStrategyRepository = intraStrategyRepository;
        this.intraStrategyPerfSnapshotRepository = intraStrategyPerfSnapshotRepository;
        this.intraStrategyDraftSupport = intraStrategyDraftSupport;
        this.intraStrategyValidationEngine = intraStrategyValidationEngine;
    }

    public void syncIntraStrategy(
            String tenantId,
            String username,
            TradingScriptEntity script,
            TradingScriptDtos.TradingScriptCompiledArtifact artifact,
            String targetStatus
    ) {
        IntraStrategyDtos.IntraStrategyBuilderPayload builderPayload = new IntraStrategyDtos.IntraStrategyBuilderPayload(
                artifact.compiledStrategy(),
                artifact.meta().timeframeUnit(),
                artifact.meta().timeframeInterval(),
                Boolean.TRUE,
                artifact.meta().marketSession()
        );
        IntraStrategyDraftSupport.BuilderModel builderModel = intraStrategyDraftSupport.normalizeBuilder(builderPayload);
        IntraStrategyDtos.IntraStrategyValidationResult validation = intraStrategyValidationEngine.validate(builderModel.builderPayload());

        IntraStrategyEntity linked = intraStrategyRepository
                .findByTenantIdAndUsernameAndSourceTradingScriptId(tenantId, username, script.getId())
                .orElse(null);
        if (linked == null) {
            linked = new IntraStrategyEntity(
                    tenantId,
                    username,
                    artifact.meta().name(),
                    artifact.meta().instrumentKey(),
                    artifact.meta().timeframeUnit(),
                    artifact.meta().timeframeInterval(),
                    artifact.meta().strategyType(),
                    artifact.meta().marketSession(),
                    targetStatus,
                    "PUBLISHED",
                    1,
                    null,
                    validation.paperEligible(),
                    validation.liveEligible(),
                    username,
                    null
            );
            linked.setSourceTradingScriptId(script.getId());
            linked = intraStrategyRepository.save(linked);
            IntraStrategyVersionEntity version = intraStrategyDraftSupport.createVersion(linked, 1, username, builderModel, validation);
            linked.setCurrentVersionId(version.getId());
            intraStrategyRepository.save(linked);
        } else {
            int nextVersion = linked.getCurrentVersion() + 1;
            IntraStrategyVersionEntity version = intraStrategyDraftSupport.createVersion(linked, nextVersion, username, builderModel, validation);
            linked.setStrategyName(artifact.meta().name());
            linked.setUnderlyingKey(artifact.meta().instrumentKey());
            linked.setTimeframeUnit(artifact.meta().timeframeUnit());
            linked.setTimeframeInterval(artifact.meta().timeframeInterval());
            linked.setStrategyType(artifact.meta().strategyType());
            linked.setMarketSession(artifact.meta().marketSession());
            linked.setStatus(targetStatus);
            linked.setPublishState("PUBLISHED");
            linked.setCurrentVersion(nextVersion);
            linked.setCurrentVersionId(version.getId());
            linked.setPaperEligible(validation.paperEligible());
            linked.setLiveEligible(validation.liveEligible());
            linked.setArchivedAt(null);
            intraStrategyRepository.save(linked);
        }

        TradingScriptPerfSnapshotEntity perf = perfSnapshotRepository
                .findByScriptIdAndTenantIdAndUsername(script.getId(), tenantId, username)
                .orElse(null);
        if (perf != null) {
            intraStrategyPerfSnapshotRepository.upsert(
                    linked.getId(),
                    tenantId,
                    username,
                    perf.getLatestTotalPnl(),
                    perf.getLatestExecutedTrades(),
                    perf.getLatestEvaluatedAt()
            );
        }
    }

    public void linkedDelete(IntraStrategyEntity linked) {
        if (linked != null) {
            intraStrategyRepository.delete(linked);
        }
    }

    public String dedupeCopiedName(String originalName, String tenantId, String username) {
        String base = "Copy of " + originalName;
        List<String> names = tradingScriptRepository.findAllByTenantIdAndUsername(tenantId, username)
                .stream()
                .map(TradingScriptEntity::getScriptName)
                .toList();
        if (!names.contains(base)) {
            return base;
        }
        int index = 2;
        while (names.contains(base + " (" + index + ")")) {
            index++;
        }
        return base + " (" + index + ")";
    }
}
